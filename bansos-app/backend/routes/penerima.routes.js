const express = require('express');
const router = express.Router();
const { pool } = require('../database/db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { getContract } = require('../fabric/connection');
const axios = require('axios');
require('dotenv').config();
const { catatAuditLog } = require('../services/auditLog');

// ── Get semua penerima aktif ────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT pr.id_penerima, pr.id_warga, pr.id_pengajuan,
             pr.tanggal_daftar, pr.status_aktif, pr.tx_id_blockchain, pr.created_at,
             w.nama_warga, w.nik, w.alamat, w.no_hp, p.jenis_bantuan
      FROM penerima pr
      JOIN warga w ON pr.id_warga = w.id_warga
      JOIN pengajuan p ON pr.id_pengajuan = p.id_pengajuan
      WHERE pr.status_aktif = 1
      ORDER BY pr.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Cek status penerima aktif (portal warga) ────────────
router.get('/cek-status/:id_warga', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT pr.id_penerima, pr.status_aktif, p.jenis_bantuan
       FROM penerima pr
       JOIN pengajuan p ON pr.id_pengajuan = p.id_pengajuan
       WHERE pr.id_warga = ? AND pr.status_aktif = 1
       LIMIT 1`,
      [req.params.id_warga]
    );
    if (rows.length === 0)
      return res.json({ success: false, data: null });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Riwayat penerimaan by id_warga (portal warga) ───────
router.get('/riwayat/:id_warga', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT k.id_konfirmasi, k.tanggal_ambil, k.periode_bantuan,
             k.status_verifikasi, k.tx_id_blockchain,
             p.jenis_bantuan, pt.nama_petugas,
             w.nama_warga, w.nik
      FROM konfirmasi_penerimaan k
      JOIN penerima pr ON k.id_penerima = pr.id_penerima
      JOIN pengajuan p ON pr.id_pengajuan = p.id_pengajuan
      JOIN warga w ON pr.id_warga = w.id_warga
      LEFT JOIN petugas pt ON k.petugas_verifikasi = pt.id_petugas
      WHERE pr.id_warga = ?
      ORDER BY k.tanggal_ambil DESC
    `, [req.params.id_warga]);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Konfirmasi penerimaan oleh warga dari HP ────────────
router.post('/warga/konfirmasi', authenticateToken, authorizeRole('Warga'), async (req, res) => {
  try {
    const id_warga = req.user.id;
    const [rows] = await pool.execute(
      `SELECT pr.*, w.nama_warga, w.nik, p.jenis_bantuan
       FROM penerima pr
       JOIN warga w ON pr.id_warga = w.id_warga
       JOIN pengajuan p ON pr.id_pengajuan = p.id_pengajuan
       WHERE pr.id_warga = ? AND pr.status_aktif = 1`,
      [id_warga]
    );
    if (rows.length === 0)
      return res.status(404).json({ success: false, message: 'Anda belum terdaftar sebagai penerima bantuan aktif' });
    const penerima = rows[0];
    const periode_bantuan = new Date().toISOString().slice(0, 7);
    const tanggal_ambil = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const [existing] = await pool.execute(
      'SELECT id_konfirmasi FROM konfirmasi_penerimaan WHERE id_penerima = ? AND periode_bantuan = ?',
      [penerima.id_penerima, periode_bantuan]
    );
    if (existing.length > 0)
      return res.json({ success: false, message: `Anda sudah konfirmasi penerimaan untuk periode ${periode_bantuan}` });
    const conn = await pool.getConnection();
    let id_konfirmasi, txId;
    try {
      await conn.beginTransaction();

      const [konfirmasi] = await conn.execute(
        'INSERT INTO konfirmasi_penerimaan (id_penerima, tanggal_ambil, periode_bantuan, status_verifikasi, petugas_verifikasi) VALUES (?, ?, ?, ?, ?)',
        [penerima.id_penerima, tanggal_ambil, periode_bantuan, 'Berhasil', null]
      );
      id_konfirmasi = konfirmasi.insertId;

      const { gateway, contract } = await getContract();
      const transaction = contract.createTransaction('CatatKonfirmasi');
      await transaction.submit(
        id_konfirmasi.toString(), penerima.id_penerima.toString(),
        tanggal_ambil, periode_bantuan, 'Mandiri (Warga)'
      );
      txId = transaction.getTransactionId();
      await conn.execute(
        'UPDATE konfirmasi_penerimaan SET tx_id_blockchain = ? WHERE id_konfirmasi = ?',
        [txId, id_konfirmasi]
      );
      await gateway.disconnect();

      await conn.commit();
      conn.release();
    } catch (fabricError) {
      console.error('Fabric error, membatalkan konfirmasi:', fabricError.message);
      await conn.rollback();
      conn.release();
      return res.status(503).json({
        success: false,
        message: 'Konfirmasi gagal dicatat ke blockchain karena gangguan jaringan. Silakan coba lagi.',
        blockchain_tercatat: false,
      });
    }

    res.json({
      success: true,
      message: `Konfirmasi penerimaan bantuan ${penerima.jenis_bantuan} berhasil dicatat untuk periode ${periode_bantuan}.`,
      tx_id_blockchain: txId,
      periode_bantuan,
      jenis_bantuan: penerima.jenis_bantuan,
      blockchain_tercatat: true
    });
  } catch (error) {
    console.error('Warga konfirmasi error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Get penerima by ID ──────────────────────────────────
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT pr.id_penerima, pr.id_warga, pr.id_pengajuan,
             pr.tanggal_daftar, pr.status_aktif, pr.tx_id_blockchain,
             w.nama_warga, w.nik, w.alamat, w.no_hp, p.jenis_bantuan
      FROM penerima pr
      JOIN warga w ON pr.id_warga = w.id_warga
      JOIN pengajuan p ON pr.id_pengajuan = p.id_pengajuan
      WHERE pr.id_penerima = ?
    `, [req.params.id]);

    if (rows.length === 0)
      return res.status(404).json({ success: false, message: 'Penerima tidak ditemukan' });
    if (req.user.role === 'warga' && rows[0].id_warga !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke data ini' });
    }
    await catatAuditLog({
      tipe_aktor: req.user.role === 'warga' ? 'warga' : 'petugas',
      id_aktor: req.user.id,
      nama_aktor: req.user.nama,
      aksi: 'Lihat Detail Penerima',
      detail: 'Membuka data penerima: ' + rows[0].nama_warga + ' (NIK: ' + rows[0].nik + ')',
      req,
      status: 'Berhasil'
    });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Riwayat konfirmasi per penerima (Lihat Detail admin) ─
router.get('/:id/riwayat-konfirmasi', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'warga') {
      const [cekMilik] = await pool.execute(
        'SELECT id_warga FROM penerima WHERE id_penerima = ?', [req.params.id]
      );
      if (cekMilik.length === 0 || cekMilik[0].id_warga !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke data ini' });
      }
    }
    const [rows] = await pool.execute(
      `SELECT id_konfirmasi, tanggal_ambil, periode_bantuan, status_verifikasi, tx_id_blockchain
       FROM konfirmasi_penerimaan
       WHERE id_penerima = ?
       ORDER BY tanggal_ambil DESC`,
      [req.params.id]
    );
    await catatAuditLog({
      tipe_aktor: req.user.role === 'warga' ? 'warga' : 'petugas',
      id_aktor: req.user.id,
      nama_aktor: req.user.nama,
      aksi: 'Lihat Riwayat Konfirmasi',
      detail: 'Melihat riwayat konfirmasi penerima #' + req.params.id,
      req,
      status: 'Berhasil'
    });
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Tetapkan penerima (Admin Kelurahan) ─────────────────
router.post('/', authenticateToken, authorizeRole('Admin Kelurahan'), async (req, res) => {
  try {
    const { id_warga, id_pengajuan } = req.body;
    if (!id_warga || !id_pengajuan)
      return res.status(400).json({ success: false, message: 'id_warga dan id_pengajuan wajib diisi' });

    const [cekDuplikat] = await pool.execute(
      'SELECT id_penerima FROM penerima WHERE id_pengajuan = ?', [id_pengajuan]
    );
    if (cekDuplikat.length > 0) {
      return res.status(400).json({ success: false, message: 'Pengajuan ini sudah memiliki data penerima' });
    }

    const tanggal_daftar = new Date().toISOString().split('T')[0];

    const conn = await pool.getConnection();
    let id_penerima;
    try {
      await conn.beginTransaction();

      const [result] = await conn.execute(
        'INSERT INTO penerima (id_warga, id_pengajuan, tanggal_daftar, status_aktif) VALUES (?, ?, ?, ?)',
        [id_warga, id_pengajuan, tanggal_daftar, true]
      );
      id_penerima = result.insertId;

      const { gateway, contract } = await getContract();
      const [warga] = await conn.execute('SELECT * FROM warga WHERE id_warga = ?', [id_warga]);
      const transaction = contract.createTransaction('CatatPenerima');
      await transaction.submit(
        id_penerima.toString(), id_warga.toString(), id_pengajuan.toString(),
        warga[0].nama_warga, warga[0].nik, tanggal_daftar
      );
      const txId = transaction.getTransactionId();
      await conn.execute('UPDATE penerima SET tx_id_blockchain = ? WHERE id_penerima = ?', [txId, id_penerima]);
      await gateway.disconnect();

      await conn.commit();
      conn.release();
    } catch (fabricError) {
      console.error('Fabric error, membatalkan tetapkan penerima:', fabricError.message);
      await conn.rollback();
      conn.release();
      return res.status(503).json({
        success: false,
        message: 'Penetapan penerima gagal dicatat ke blockchain karena gangguan jaringan. Silakan coba lagi.',
        blockchain_tercatat: false,
      });
    }

    res.status(201).json({
      success: true,
      message: 'Penerima berhasil ditetapkan',
      id_penerima,
      blockchain_tercatat: true
    });
  } catch (error) {
    console.error('Tetapkan penerima error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;