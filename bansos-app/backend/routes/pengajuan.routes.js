const express = require('express');
const router = express.Router();
const { pool } = require('../database/db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { getContract } = require('../fabric/connection');
const { rekomendasikanBantuan } = require('../services/recommendationEngine');
const crypto = require('crypto');

function hitungHashPengajuan(id, idWarga, nama, nik, jenis, tanggal, ket) {
  const data = [id, idWarga, nama, nik, jenis, tanggal, ket || ''].join('|');
  return crypto.createHash('sha256').update(data).digest('hex');
}
require('dotenv').config();

router.get('/', authenticateToken, authorizeRole('RT', 'RW', 'IPSM', 'Puskesos', 'Admin Kelurahan'), async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT p.*, w.nama_warga, w.nik, w.alamat
      FROM pengajuan p
      JOIN warga w ON p.id_warga = w.id_warga
      ORDER BY p.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/warga/:id_warga', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT p.*, w.nama_warga, w.nik,
        (SELECT v.catatan FROM verifikasi v
         WHERE v.id_pengajuan = p.id_pengajuan AND v.keputusan = 'Ditolak'
         ORDER BY v.id_verifikasi DESC LIMIT 1) as alasan_penolakan,
        (SELECT v.tahap_verifikasi FROM verifikasi v
         WHERE v.id_pengajuan = p.id_pengajuan AND v.keputusan = 'Ditolak'
         ORDER BY v.id_verifikasi DESC LIMIT 1) as tahap_penolakan
      FROM pengajuan p
      JOIN warga w ON p.id_warga = w.id_warga
      WHERE p.id_warga = ?
      ORDER BY p.created_at DESC
    `, [req.params.id_warga]);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT p.*, w.nama_warga, w.nik, w.alamat
      FROM pengajuan p
      JOIN warga w ON p.id_warga = w.id_warga
      WHERE p.id_pengajuan = ?
    `, [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan' });
    }
    if (req.user.role === 'warga' && rows[0].id_warga !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke pengajuan ini' });
    }
    const [verifikasi] = await pool.execute(`
      SELECT v.*, pt.nama_petugas, pt.jabatan
      FROM verifikasi v
      JOIN petugas pt ON v.id_petugas = pt.id_petugas
      WHERE v.id_pengajuan = ?
      ORDER BY v.created_at ASC
    `, [req.params.id]);
    res.json({ success: true, data: { ...rows[0], riwayat_verifikasi: verifikasi } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const id_warga = req.user.id;
    if (req.user.role !== 'warga') {
      return res.status(403).json({ success: false, message: 'Hanya warga yang dapat mengajukan bantuan' });
    }

    const {
      keterangan,
      penghasilan_bulanan,
      jumlah_anggota_keluarga,
      pekerjaan,
      foto_ktp,
      foto_rumah,
      status_asn_tni_polri,
      status_pensiunan,
      penerima_bansos_lain,
      ada_balita,
      ada_ibu_hamil,
      ada_anak_sekolah,
      ada_lansia,
      ada_disabilitas,
      punya_kks,
      punya_usaha_mikro,
      kondisi_darurat,
      keterangan_kondisi_darurat,
    } = req.body;

    if (penghasilan_bulanan === undefined || !jumlah_anggota_keluarga) {
      return res.status(400).json({
        success: false,
        message: 'penghasilan_bulanan dan jumlah_anggota_keluarga wajib diisi'
      });
    }
    if (!foto_ktp || !foto_rumah) {
      return res.status(400).json({
        success: false,
        message: 'Foto KTP dan foto rumah wajib diunggah'
      });
    }

    const tidakMemenuhiSyaratDasar = status_asn_tni_polri || status_pensiunan || penerima_bansos_lain;

    let hasilRekomendasi = { kategori: null, rekomendasiUtama: null, skorPrioritas: 0, alasan: [] };
    let jenis_bantuan = 'Tidak Memenuhi Syarat Dasar';
    let status_awal = 'Diajukan';

    if (tidakMemenuhiSyaratDasar) {
      status_awal = 'Tidak Memenuhi Syarat Dasar';
      hasilRekomendasi.kategori = 'Tidak Memenuhi Syarat Dasar';
      hasilRekomendasi.alasan = [
        status_asn_tni_polri ? 'Tercatat sebagai ASN/TNI/Polri' : null,
        status_pensiunan ? 'Penerima gaji pensiun bulanan dari negara' : null,
        penerima_bansos_lain ? 'Sudah menerima bantuan lain' : null,
      ].filter(Boolean);
    } else {
      hasilRekomendasi = rekomendasikanBantuan({
        penghasilan_bulanan:     Number(penghasilan_bulanan),
        jumlah_anggota_keluarga: Number(jumlah_anggota_keluarga),
        ada_balita:              !!ada_balita,
        ada_ibu_hamil:           !!ada_ibu_hamil,
        ada_anak_sekolah:        !!ada_anak_sekolah,
        ada_lansia:              !!ada_lansia,
        ada_disabilitas:         !!ada_disabilitas,
        terdaftar_dtks:          false,
        punya_kks:               !!punya_kks,
        punya_usaha_mikro:       !!punya_usaha_mikro,
        kondisi_darurat:         !!kondisi_darurat,
      });

      jenis_bantuan = hasilRekomendasi.kategori || 'Tidak Memenuhi Kriteria';
    }

    const tanggal_pengajuan = new Date().toISOString().split('T')[0];

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [result] = await conn.execute(
        `INSERT INTO pengajuan (
          id_warga, jenis_bantuan, tanggal_pengajuan, status_pengajuan, keterangan,
          penghasilan_bulanan, jumlah_anggota_keluarga, pekerjaan,
          foto_ktp, foto_rumah,
          status_asn_tni_polri, status_pensiunan, penerima_bansos_lain,
          ada_balita, ada_ibu_hamil, ada_anak_sekolah, ada_lansia, ada_disabilitas,
          punya_kks, punya_usaha_mikro, kondisi_darurat, keterangan_kondisi_darurat,
          rekomendasi_sistem, skor_prioritas
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id_warga, jenis_bantuan, tanggal_pengajuan, status_awal, keterangan || '',
          penghasilan_bulanan, jumlah_anggota_keluarga, pekerjaan || null,
          foto_ktp, foto_rumah,
          !!status_asn_tni_polri, !!status_pensiunan, !!penerima_bansos_lain,
          !!ada_balita, !!ada_ibu_hamil, !!ada_anak_sekolah, !!ada_lansia, !!ada_disabilitas,
          !!punya_kks, !!punya_usaha_mikro, !!kondisi_darurat, keterangan_kondisi_darurat || null,
          JSON.stringify(hasilRekomendasi), hasilRekomendasi.skorPrioritas || 0,
        ]
      );
      const id_pengajuan = result.insertId;

      if (!tidakMemenuhiSyaratDasar) {
        try {
          const { gateway, contract } = await getContract();
          const [warga] = await conn.execute('SELECT * FROM warga WHERE id_warga = ?', [id_warga]);
          const transaction = contract.createTransaction('CatatPengajuan');
          const hashData = hitungHashPengajuan(id_pengajuan, id_warga, warga[0].nama_warga, warga[0].nik, jenis_bantuan, tanggal_pengajuan, keterangan);
          await transaction.submit(
            id_pengajuan.toString(),
            id_warga.toString(),
            warga[0].nama_warga,
            warga[0].nik,
            jenis_bantuan,
            tanggal_pengajuan,
            keterangan || '',
            hashData
          );
          const txId = transaction.getTransactionId();
          await conn.execute(
            'UPDATE pengajuan SET tx_id_blockchain = ? WHERE id_pengajuan = ?',
            [txId, id_pengajuan]
          );
          await gateway.disconnect();
        } catch (fabricError) {
          console.error('Fabric error, membatalkan transaksi:', fabricError.message);
          await conn.rollback();
          conn.release();
          return res.status(503).json({
            success: false,
            message: 'Pengajuan gagal dicatat ke blockchain karena gangguan jaringan. Silakan coba lagi.',
            blockchain_tercatat: false,
          });
        }
      }

      await conn.commit();
      conn.release();

      res.status(201).json({
        success: true,
        message: tidakMemenuhiSyaratDasar
          ? 'Pengajuan tidak memenuhi syarat dasar'
          : 'Pengajuan berhasil diajukan dan dicatat di blockchain',
        id_pengajuan,
        rekomendasi: hasilRekomendasi,
        blockchain_tercatat: !tidakMemenuhiSyaratDasar,
      });
    } catch (txError) {
      await conn.rollback();
      conn.release();
      throw txError;
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
