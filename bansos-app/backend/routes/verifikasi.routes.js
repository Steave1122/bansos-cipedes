const express = require('express');
const router = express.Router();
const { pool } = require('../database/db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { getContract } = require('../fabric/connection');
require('dotenv').config();
const crypto = require('crypto');

function hitungHashPengajuan(id, idWarga, nama, nik, jenis, tanggal, ket) {
  const data = [id, idWarga, nama, nik, jenis, tanggal, ket || ''].join('|');
  return crypto.createHash('sha256').update(data).digest('hex');
}
const { catatAuditLog } = require('../services/auditLog');

router.get('/antrian', authenticateToken, authorizeRole('RT', 'RW', 'IPSM', 'Puskesos', 'Admin Kelurahan'), async (req, res) => {
  try {
    const jabatan = req.user.jabatan;
    const statusMap = {
      'RT': 'Diajukan',
      'RW': 'Verifikasi RT',
      'IPSM': 'Verifikasi RW',
      'Puskesos': 'Verifikasi IPSM',
      'Admin Kelurahan': 'Verifikasi Puskesos'
    };
    const status = statusMap[jabatan];
    if (!status) {
      return res.status(403).json({ success: false, message: 'Jabatan tidak valid' });
    }
    const [rows] = await pool.execute(`
      SELECT p.*, w.nama_warga, w.nik, w.alamat, w.no_hp
      FROM pengajuan p
      JOIN warga w ON p.id_warga = w.id_warga
      WHERE p.status_pengajuan = ?
      ORDER BY p.created_at ASC
    `, [status]);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/riwayat', authenticateToken, authorizeRole('RT', 'RW', 'IPSM', 'Puskesos', 'Admin Kelurahan'), async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT v.*, p.jenis_bantuan, p.status_pengajuan, w.nama_warga, w.nik
      FROM verifikasi v
      JOIN pengajuan p ON v.id_pengajuan = p.id_pengajuan
      JOIN warga w ON p.id_warga = w.id_warga
      WHERE v.id_petugas = ?
      ORDER BY v.created_at DESC
    `, [req.user.id]);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', authenticateToken, authorizeRole('RT', 'RW', 'IPSM', 'Puskesos', 'Admin Kelurahan'), async (req, res) => {
  try {
    const { id_pengajuan, keputusan, catatan } = req.body;
    const id_petugas = req.user.id;
    const jabatan = req.user.jabatan;

    if (!id_pengajuan || !keputusan) {
      return res.status(400).json({ success: false, message: 'id_pengajuan dan keputusan wajib diisi' });
    }

    const [cekPengajuan] = await pool.execute(
      `SELECT p.status_pengajuan, p.tx_id_blockchain, p.id_warga, p.jenis_bantuan,
              p.tanggal_pengajuan, p.keterangan, w.nama_warga, w.nik
       FROM pengajuan p JOIN warga w ON p.id_warga = w.id_warga
       WHERE p.id_pengajuan = ?`, [id_pengajuan]
    );
    if (cekPengajuan.length === 0) {
      return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan' });
    }
    if (cekPengajuan[0].status_pengajuan === 'Disetujui' || cekPengajuan[0].status_pengajuan === 'Ditolak') {
      return res.status(400).json({ success: false, message: 'Pengajuan sudah memiliki keputusan final (' + cekPengajuan[0].status_pengajuan + ') dan tidak dapat diverifikasi ulang' });
    }

    const tanggal_verifikasi = new Date().toISOString().split('T')[0];
    const tahapMap = {
      'RT': 'RT', 'RW': 'RW', 'IPSM': 'IPSM',
      'Puskesos': 'Puskesos', 'Admin Kelurahan': 'Kelurahan'
    };
    const statusMap = {
      'RT': 'Verifikasi RT', 'RW': 'Verifikasi RW',
      'IPSM': 'Verifikasi IPSM', 'Puskesos': 'Verifikasi Puskesos',
      'Admin Kelurahan': keputusan === 'Disetujui' ? 'Disetujui' : 'Ditolak'
    };

    const tahap = tahapMap[jabatan];
    const status_baru = keputusan === 'Ditolak' ? 'Ditolak' : statusMap[jabatan];

    let id_verifikasi;
    let blockchainGagalVerifikasi = false;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [result] = await conn.execute(
        'INSERT INTO verifikasi (id_pengajuan, id_petugas, tahap_verifikasi, keputusan, catatan, tanggal_verifikasi) VALUES (?, ?, ?, ?, ?, ?)',
        [id_pengajuan, id_petugas, tahap, keputusan, catatan || '', tanggal_verifikasi]
      );
      id_verifikasi = result.insertId;

      await conn.execute(
        'UPDATE pengajuan SET status_pengajuan = ? WHERE id_pengajuan = ?',
        [status_baru, id_pengajuan]
      );

      // Self-heal: jika pengajuan induk belum tercatat di blockchain, catat dulu sebelum verifikasi
      if (!cekPengajuan[0].tx_id_blockchain) {
        const p = cekPengajuan[0];
        const { gateway: gwHeal, contract: ctHeal } = await getContract();
        const txHeal = ctHeal.createTransaction('CatatPengajuan');
        const tglHeal = new Date(p.tanggal_pengajuan).toISOString().split('T')[0];
        const hashHeal = hitungHashPengajuan(id_pengajuan, p.id_warga, p.nama_warga, p.nik, p.jenis_bantuan, tglHeal, p.keterangan);
        await txHeal.submit(
          id_pengajuan.toString(), p.id_warga.toString(), p.nama_warga, p.nik,
          p.jenis_bantuan, tglHeal, p.keterangan || '', hashHeal
        );
        const txIdHeal = txHeal.getTransactionId();
        await conn.execute('UPDATE pengajuan SET tx_id_blockchain = ? WHERE id_pengajuan = ?', [txIdHeal, id_pengajuan]);
        await gwHeal.disconnect();
      }

      const { gateway, contract } = await getContract();
      const transaction = contract.createTransaction('CatatVerifikasi');
      await transaction.submit(
        id_verifikasi.toString(),
        id_pengajuan.toString(),
        id_petugas.toString(),
        req.user.nama,
        tahap,
        keputusan,
        catatan || '',
        tanggal_verifikasi
      );
      const txId = transaction.getTransactionId();
      await conn.execute(
        'UPDATE verifikasi SET tx_id_blockchain = ? WHERE id_verifikasi = ?',
        [txId, id_verifikasi]
      );
      await gateway.disconnect();

      await conn.commit();
      conn.release();
    } catch (fabricError) {
      console.error('Fabric error, membatalkan verifikasi:', fabricError.message);
      await conn.rollback();
      conn.release();
      return res.status(503).json({
        success: false,
        message: 'Verifikasi gagal dicatat ke blockchain karena gangguan jaringan. Silakan coba lagi.',
        blockchain_tercatat: false,
      });
    }


    // Jika Admin Kelurahan setujui -> otomatis tetapkan penerima
    if (jabatan === 'Admin Kelurahan' && keputusan === 'Disetujui') {
      const [cekPenerimaAda] = await pool.execute(
        'SELECT id_penerima FROM penerima WHERE id_pengajuan = ?', [id_pengajuan]
      );
      if (cekPenerimaAda.length > 0) {
        console.warn('Penerima untuk pengajuan #' + id_pengajuan + ' sudah ada, skip duplikasi.');
      } else {
        const [pengajuanRows] = await pool.execute(
          'SELECT id_warga FROM pengajuan WHERE id_pengajuan = ?', [id_pengajuan]
        );
        if (pengajuanRows.length > 0) {
          const id_warga = pengajuanRows[0].id_warga;
          const [wargaRows] = await pool.execute(
            'SELECT nama_warga, nik FROM warga WHERE id_warga = ?',
            [id_warga]
          );
          if (wargaRows.length > 0) {
            const warga = wargaRows[0];
            const tanggal_daftar = new Date().toISOString().split('T')[0];

            const conn2 = await pool.getConnection();
            try {
              await conn2.beginTransaction();

              const [penerimaResult] = await conn2.execute(
                'INSERT INTO penerima (id_warga, id_pengajuan, tanggal_daftar, status_aktif) VALUES (?, ?, ?, ?)',
                [id_warga, id_pengajuan, tanggal_daftar, true]
              );
              const id_penerima = penerimaResult.insertId;

              const { gateway: gw2, contract: ct2 } = await getContract();
              const tx2 = ct2.createTransaction('CatatPenerima');
              await tx2.submit(
                id_penerima.toString(), id_warga.toString(), id_pengajuan.toString(),
                warga.nama_warga, warga.nik, tanggal_daftar
              );
              const txIdPenerima = tx2.getTransactionId();
              await conn2.execute(
                'UPDATE penerima SET tx_id_blockchain = ? WHERE id_penerima = ?',
                [txIdPenerima, id_penerima]
              );
              await gw2.disconnect();

              await conn2.commit();
              conn2.release();
            } catch (fabricErr) {
              console.error('Fabric error penerima, membatalkan penetapan penerima:', fabricErr.message);
              await conn2.rollback();
              conn2.release();
              blockchainGagalVerifikasi = true;
            }
          }
        }
      }
    }

    await catatAuditLog({
      tipe_aktor: 'petugas',
      id_aktor: id_petugas,
      nama_aktor: req.user.nama,
      aksi: `Verifikasi ${tahap}`,
      detail: `Pengajuan #${id_pengajuan} - Keputusan: ${keputusan}${catatan ? ' - Catatan: ' + catatan : ''}`,
      req,
      status: 'Berhasil'
    });
    res.status(201).json({
      success: true,
      message: blockchainGagalVerifikasi
        ? `Verifikasi ${keputusan} tersimpan, namun pencatatan ke blockchain tertunda karena gangguan jaringan.`
        : `Verifikasi ${keputusan} berhasil dicatat`,
      id_verifikasi,
      status_baru,
      blockchain_tercatat: !blockchainGagalVerifikasi
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;