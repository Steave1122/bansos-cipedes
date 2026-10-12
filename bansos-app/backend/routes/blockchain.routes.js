const express = require('express');
const router = express.Router();
const { pool } = require('../database/db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const crypto = require('crypto');
const { getContract } = require('../fabric/connection');
const { catatAuditLog } = require('../services/auditLog');

// ═══════════════════════════════════════════════
// ENDPOINT PUBLIK — tanpa login
// ═══════════════════════════════════════════════

router.get('/explorer', async (req, res) => {
  try {
    const [registrasi] = await pool.execute(`
      SELECT 'Registrasi Akun' as jenis_transaksi,
             w.tx_id_registrasi as tx_id_blockchain, w.created_at as tanggal,
             w.nama_warga, '-' as jenis_bantuan,
             'Akun warga berhasil didaftarkan via OTP' as keterangan,
             w.nama_warga as aktor
      FROM warga w
      WHERE w.tx_id_registrasi IS NOT NULL
    `);

    const [pengajuan] = await pool.execute(`
      SELECT 'Pengajuan Bantuan' as jenis_transaksi,
             p.tx_id_blockchain, p.tanggal_pengajuan as tanggal,
             w.nama_warga, p.jenis_bantuan, p.status_pengajuan as keterangan,
             w.nama_warga as aktor
      FROM pengajuan p
      JOIN warga w ON p.id_warga = w.id_warga
      WHERE p.tx_id_blockchain IS NOT NULL
    `);

    const [verifikasi] = await pool.execute(`
      SELECT CONCAT('Verifikasi ', v.tahap_verifikasi) as jenis_transaksi,
             v.tx_id_blockchain, v.tanggal_verifikasi as tanggal,
             w.nama_warga, p.jenis_bantuan,
             CONCAT(v.keputusan, CASE WHEN v.catatan IS NOT NULL AND v.catatan != '' THEN CONCAT(' — ', v.catatan) ELSE '' END) as keterangan,
             pt.nama_petugas as aktor
      FROM verifikasi v
      JOIN pengajuan p ON v.id_pengajuan = p.id_pengajuan
      JOIN warga w ON p.id_warga = w.id_warga
      JOIN petugas pt ON v.id_petugas = pt.id_petugas
      WHERE v.tx_id_blockchain IS NOT NULL
    `);

    const [penerima] = await pool.execute(`
      SELECT 'Penetapan Penerima' as jenis_transaksi,
             pr.tx_id_blockchain, pr.tanggal_daftar as tanggal,
             w.nama_warga, p.jenis_bantuan,
             'Ditetapkan sebagai penerima aktif' as keterangan,
             'Admin Kelurahan' as aktor
      FROM penerima pr
      JOIN warga w ON pr.id_warga = w.id_warga
      JOIN pengajuan p ON pr.id_pengajuan = p.id_pengajuan
      WHERE pr.tx_id_blockchain IS NOT NULL
    `);

    const [konfirmasi] = await pool.execute(`
      SELECT 'Konfirmasi Penerimaan' as jenis_transaksi,
             k.tx_id_blockchain, k.tanggal_ambil as tanggal,
             w.nama_warga, p.jenis_bantuan,
             CONCAT('Periode ', k.periode_bantuan, ' — ', k.status_verifikasi) as keterangan,
             COALESCE(pt.nama_petugas, w.nama_warga) as aktor
      FROM konfirmasi_penerimaan k
      JOIN penerima pr ON k.id_penerima = pr.id_penerima
      JOIN warga w ON pr.id_warga = w.id_warga
      JOIN pengajuan p ON pr.id_pengajuan = p.id_pengajuan
      LEFT JOIN petugas pt ON k.petugas_verifikasi = pt.id_petugas
      WHERE k.tx_id_blockchain IS NOT NULL
    `);

    const semua = [...registrasi, ...pengajuan, ...verifikasi, ...penerima, ...konfirmasi]
      .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

    const [stats] = await pool.execute(`
      SELECT
        (SELECT COUNT(*) FROM warga WHERE tx_id_registrasi IS NOT NULL) as total_registrasi,
        (SELECT COUNT(*) FROM pengajuan WHERE tx_id_blockchain IS NOT NULL) as total_pengajuan,
        (SELECT COUNT(*) FROM verifikasi WHERE tx_id_blockchain IS NOT NULL) as total_verifikasi,
        (SELECT COUNT(*) FROM penerima WHERE tx_id_blockchain IS NOT NULL) as total_penerima,
        (SELECT COUNT(*) FROM konfirmasi_penerimaan WHERE tx_id_blockchain IS NOT NULL) as total_konfirmasi
    `);

    res.json({ success: true, stats: stats[0], total: semua.length, data: semua });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/explorer/verify/:txid', async (req, res) => {
  try {
    const { txid } = req.params;

    const [registrasi] = await pool.execute(
      `SELECT 'Registrasi Akun Warga' as jenis, w.created_at as tanggal,
              w.nama_warga, '-' as jenis_bantuan,
              'Akun berhasil didaftarkan via OTP' as keterangan,
              w.tx_id_registrasi as tx_id_blockchain
       FROM warga w WHERE w.tx_id_registrasi = ?`, [txid]
    );
    const [pengajuan] = await pool.execute(
      `SELECT 'Pengajuan Bantuan Sosial' as jenis, p.tanggal_pengajuan as tanggal,
              w.nama_warga, p.jenis_bantuan, p.status_pengajuan as keterangan,
              p.tx_id_blockchain
       FROM pengajuan p JOIN warga w ON p.id_warga = w.id_warga
       WHERE p.tx_id_blockchain = ?`, [txid]
    );
    const [verifikasi] = await pool.execute(
      `SELECT CONCAT('Verifikasi ', v.tahap_verifikasi) as jenis, v.tanggal_verifikasi as tanggal,
              w.nama_warga, p.jenis_bantuan,
              CONCAT(v.keputusan, ' oleh ', pt.nama_petugas,
                IF(v.catatan IS NOT NULL AND v.catatan != '', CONCAT(' — ', v.catatan), '')
              ) as keterangan,
              v.tx_id_blockchain
       FROM verifikasi v
       JOIN pengajuan p ON v.id_pengajuan = p.id_pengajuan
       JOIN warga w ON p.id_warga = w.id_warga
       JOIN petugas pt ON v.id_petugas = pt.id_petugas
       WHERE v.tx_id_blockchain = ?`, [txid]
    );
    const [penerima] = await pool.execute(
      `SELECT 'Penetapan Penerima' as jenis, pr.tanggal_daftar as tanggal,
              w.nama_warga, p.jenis_bantuan,
              'Ditetapkan sebagai penerima bantuan aktif' as keterangan,
              pr.tx_id_blockchain
       FROM penerima pr
       JOIN warga w ON pr.id_warga = w.id_warga
       JOIN pengajuan p ON pr.id_pengajuan = p.id_pengajuan
       WHERE pr.tx_id_blockchain = ?`, [txid]
    );
    const [konfirmasi] = await pool.execute(
      `SELECT 'Konfirmasi Penerimaan' as jenis, k.tanggal_ambil as tanggal,
              w.nama_warga, p.jenis_bantuan,
              CONCAT('Periode ', k.periode_bantuan, ' — ', k.status_verifikasi) as keterangan,
              k.tx_id_blockchain
       FROM konfirmasi_penerimaan k
       JOIN penerima pr ON k.id_penerima = pr.id_penerima
       JOIN warga w ON pr.id_warga = w.id_warga
       JOIN pengajuan p ON pr.id_pengajuan = p.id_pengajuan
       WHERE k.tx_id_blockchain = ?`, [txid]
    );

    const result = [...registrasi, ...pengajuan, ...verifikasi, ...penerima, ...konfirmasi];
    if (result.length === 0)
      return res.json({ success: false, message: 'TX ID tidak ditemukan' });

    res.json({ success: true, data: result[0], txid });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ═══════════════════════════════════════════════
// ENDPOINT DENGAN LOGIN
// ═══════════════════════════════════════════════

router.get('/query/pengajuan/:id', authenticateToken, async (req, res) => {
  try {
    const { gateway, contract } = await getContract();
    const result = await contract.evaluateTransaction('QueryPengajuan', req.params.id);
    await gateway.disconnect();
    res.json({ success: true, data: JSON.parse(result.toString()) });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
});

router.get('/query/penerima/:id', authenticateToken, async (req, res) => {
  try {
    const { gateway, contract } = await getContract();
    const result = await contract.evaluateTransaction('QueryPenerima', req.params.id);
    await gateway.disconnect();
    res.json({ success: true, data: JSON.parse(result.toString()) });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
});

router.get('/query/riwayat/:id', authenticateToken, async (req, res) => {
  try {
    const { gateway, contract } = await getContract();
    const result = await contract.evaluateTransaction('QueryRiwayatPengajuan', req.params.id);
    await gateway.disconnect();
    res.json({ success: true, data: JSON.parse(result.toString()) });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
});

router.get('/verify-txid/:txid', authenticateToken, async (req, res) => {
  try {
    const { txid } = req.params;

    const [registrasi] = await pool.execute(
      `SELECT w.id_warga, w.nama_warga, w.nik, w.created_at as tanggal_registrasi,
              w.tx_id_registrasi as tx_id_blockchain
       FROM warga w WHERE w.tx_id_registrasi = ?`, [txid]
    );
    const [pengajuan] = await pool.execute(
      `SELECT p.id_pengajuan, p.id_warga, w.nama_warga, w.nik,
              p.jenis_bantuan, p.keterangan, p.status_pengajuan,
              p.tanggal_pengajuan, p.tx_id_blockchain
       FROM pengajuan p
       JOIN warga w ON p.id_warga = w.id_warga
       WHERE p.tx_id_blockchain = ?`, [txid]
    );
    const [verifikasi] = await pool.execute(
      `SELECT v.id_verifikasi, v.id_pengajuan, v.tahap_verifikasi, v.keputusan,
              v.tanggal_verifikasi, v.tx_id_blockchain, pt.nama_petugas, pt.jabatan
       FROM verifikasi v
       JOIN petugas pt ON v.id_petugas = pt.id_petugas
       WHERE v.tx_id_blockchain = ?`, [txid]
    );
    const [penerima] = await pool.execute(
      `SELECT pr.id_penerima, pr.id_warga, pr.tanggal_daftar, pr.tx_id_blockchain,
              w.nama_warga, w.nik
       FROM penerima pr
       JOIN warga w ON pr.id_warga = w.id_warga
       WHERE pr.tx_id_blockchain = ?`, [txid]
    );
    const [konfirmasi] = await pool.execute(
      `SELECT k.id_konfirmasi, k.id_penerima, k.tanggal_ambil, k.periode_bantuan,
              k.status_verifikasi, k.tx_id_blockchain, pt.nama_petugas
       FROM konfirmasi_penerimaan k
       LEFT JOIN petugas pt ON k.petugas_verifikasi = pt.id_petugas
       WHERE k.tx_id_blockchain = ?`, [txid]
    );

    let type = null;
    let data = null;

    if (registrasi.length > 0)      { type = 'Registrasi Akun Warga';    data = registrasi[0]; }
    else if (pengajuan.length > 0)  { type = 'Pengajuan Bantuan Sosial'; data = pengajuan[0]; }
    else if (verifikasi.length > 0) { type = 'Verifikasi Berjenjang';    data = verifikasi[0]; }
    else if (penerima.length > 0)   { type = 'Penetapan Penerima';       data = penerima[0]; }
    else if (konfirmasi.length > 0) { type = 'Konfirmasi Penerimaan';    data = konfirmasi[0]; }

    if (!data)
      return res.json({ success: false, message: 'TX ID tidak ditemukan di database' });

    await catatAuditLog({
      tipe_aktor: req.user.role === 'warga' ? 'warga' : 'petugas',
      id_aktor: req.user.id,
      nama_aktor: req.user.nama,
      aksi: 'Verifikasi TX ID',
      detail: 'Memeriksa TX ID: ' + txid + ' (Tipe: ' + type + ')',
      req,
      status: 'Berhasil'
    });
    res.json({ success: true, type, data, txid });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/channel-info', authenticateToken, async (req, res) => {
  try {
    const [totalRegistrasi] = await pool.execute('SELECT COUNT(*) as total FROM warga WHERE tx_id_registrasi IS NOT NULL');
    const [totalPengajuan] = await pool.execute('SELECT COUNT(*) as total FROM pengajuan WHERE tx_id_blockchain IS NOT NULL');
    const [totalVerifikasi] = await pool.execute('SELECT COUNT(*) as total FROM verifikasi WHERE tx_id_blockchain IS NOT NULL');
    const [totalPenerima] = await pool.execute('SELECT COUNT(*) as total FROM penerima WHERE tx_id_blockchain IS NOT NULL');
    const [totalKonfirmasi] = await pool.execute('SELECT COUNT(*) as total FROM konfirmasi_penerimaan WHERE tx_id_blockchain IS NOT NULL');

    res.json({
      success: true,
      data: {
        channel: 'bansos-channel',
        chaincode: 'bansos',
        platform: 'Hyperledger Fabric 2.5.15',
        consensus: 'Raft',
        hashing: 'SHA-256',
        total_transaksi: {
          registrasi: totalRegistrasi[0].total,
          pengajuan: totalPengajuan[0].total,
          verifikasi: totalVerifikasi[0].total,
          penerima: totalPenerima[0].total,
          konfirmasi: totalKonfirmasi[0].total
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ═══════════════════════════════════════════════
// Verifikasi Integritas Data (Cryptographic Hash Link)
// Bandingkan hash data MySQL saat ini dengan hash yang tercatat permanen di blockchain
// ═══════════════════════════════════════════════
function hitungHashPengajuan(id, idWarga, nama, nik, jenis, tanggal, ket) {
  const data = [id, idWarga, nama, nik, jenis, tanggal, ket || ''].join('|');
  return crypto.createHash('sha256').update(data).digest('hex');
}

router.get('/verify-integrity/:id_pengajuan', authenticateToken, authorizeRole('Admin Kelurahan'), async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT p.id_pengajuan, p.id_warga, p.jenis_bantuan, p.tanggal_pengajuan, p.keterangan, p.tx_id_blockchain,
              w.nama_warga, w.nik
       FROM pengajuan p JOIN warga w ON p.id_warga = w.id_warga
       WHERE p.id_pengajuan = ?`,
      [req.params.id_pengajuan]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan' });
    }
    const p = rows[0];
    if (!p.tx_id_blockchain) {
      return res.json({ success: true, status: 'belum_tercatat', message: 'Pengajuan ini belum tercatat ke blockchain' });
    }

    const tanggalStr = new Date(p.tanggal_pengajuan).toISOString().split('T')[0];
    const hashMySQL = hitungHashPengajuan(p.id_pengajuan, p.id_warga, p.nama_warga, p.nik, p.jenis_bantuan, tanggalStr, p.keterangan);

    const { gateway, contract } = await getContract();
    const result = await contract.evaluateTransaction('QueryPengajuan', p.id_pengajuan.toString());
    await gateway.disconnect();
    const dataLedger = JSON.parse(result.toString());
    const hashLedger = dataLedger.hash_data || '';

    const cocok = hashMySQL === hashLedger;

    await catatAuditLog({
      tipe_aktor: 'petugas', id_aktor: req.user.id, nama_aktor: req.user.nama,
      aksi: 'Verifikasi Integritas Data',
      detail: `Pengajuan #${p.id_pengajuan} - Hasil: ${cocok ? 'Cocok' : 'TIDAK COCOK - kemungkinan data dimanipulasi'}`,
      req, status: cocok ? 'Berhasil' : 'Gagal'
    });

    res.json({
      success: true,
      status: cocok ? 'cocok' : 'tidak_cocok',
      message: cocok
        ? 'Data MySQL konsisten dengan hash yang tercatat di blockchain'
        : 'PERINGATAN: Data MySQL TIDAK cocok dengan hash di blockchain. Data mungkin telah diubah secara tidak sah.',
      hash_mysql: hashMySQL,
      hash_ledger: hashLedger,
      tx_id_blockchain: p.tx_id_blockchain
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;