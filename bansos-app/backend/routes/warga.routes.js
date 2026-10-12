const express = require('express');
const router = express.Router();
const { pool } = require('../database/db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
require('dotenv').config();
const { catatAuditLog } = require('../services/auditLog');

// Get semua warga (Admin only)
router.get('/', authenticateToken, authorizeRole('Admin Kelurahan'), async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id_warga, nama_warga, nik, alamat, no_hp, id_rt, id_rw, username, created_at FROM warga'
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get warga by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'warga' && Number(req.params.id) !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke data warga ini' });
    }
    const [rows] = await pool.execute(
      'SELECT id_warga, nama_warga, nik, alamat, no_hp, id_rt, id_rw, username, created_at FROM warga WHERE id_warga = ?',
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Warga tidak ditemukan' });
    }
    await catatAuditLog({
      tipe_aktor: req.user.role === 'warga' ? 'warga' : 'petugas',
      id_aktor: req.user.id,
      nama_aktor: req.user.nama,
      aksi: 'Lihat Detail Warga',
      detail: `Membuka data warga: ${rows[0].nama_warga} (NIK: ${rows[0].nik})`,
      req,
      status: 'Berhasil'
    });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Tambah warga baru (Admin only) — tanpa username dan password
// Warga mendaftarkan akun sendiri via portal menggunakan NIK + OTP + wajah
router.post('/', authenticateToken, authorizeRole('Admin Kelurahan'), async (req, res) => {
  try {
    const { nama_warga, nik, alamat, no_hp, id_rt, id_rw } = req.body;

    // Validasi field wajib — tanpa username dan password
    if (!nama_warga || !nik || !alamat || !id_rt || !id_rw) {
      return res.status(400).json({ success: false, message: 'Nama, NIK, alamat, RT, dan RW wajib diisi' });
    }

    // Validasi NIK 16 digit angka
    if (!/^\d{16}$/.test(nik)) {
      return res.status(400).json({ success: false, message: 'NIK harus tepat 16 digit angka' });
    }

    // Validasi no HP hanya angka
    if (no_hp && !/^\d+$/.test(no_hp)) {
      return res.status(400).json({ success: false, message: 'No HP hanya boleh berisi angka' });
    }

    // Cek NIK sudah terdaftar
    const [cekNik] = await pool.execute(
      'SELECT id_warga FROM warga WHERE nik = ?', [nik]
    );
    if (cekNik.length > 0) {
      return res.status(400).json({ success: false, message: 'NIK sudah terdaftar — 1 NIK hanya untuk 1 warga' });
    }

    // Cek no HP sudah terdaftar
    if (no_hp) {
      const [cekHp] = await pool.execute(
        'SELECT id_warga FROM warga WHERE no_hp = ?', [no_hp]
      );
      if (cekHp.length > 0) {
        return res.status(400).json({ success: false, message: 'No HP sudah terdaftar di sistem' });
      }
    }

    // Insert warga tanpa username dan password — warga daftar akun sendiri nanti
    const [result] = await pool.execute(
      'INSERT INTO warga (nama_warga, nik, alamat, no_hp, id_rt, id_rw, username, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [nama_warga, nik, alamat, no_hp || null, id_rt, id_rw, 'BELUM_DAFTAR', 'BELUM_DAFTAR']
    );

    res.status(201).json({
      success: true,
      message: 'Data warga berhasil ditambahkan. Warga dapat mendaftarkan akun mandiri melalui portal menggunakan NIK dan OTP.',
      id_warga: result.insertId
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update warga (Admin only)
router.put('/:id', authenticateToken, authorizeRole('Admin Kelurahan'), async (req, res) => {
  try {
    const { nama_warga, alamat, no_hp, id_rt, id_rw } = req.body;

    if (no_hp && !/^\d+$/.test(no_hp)) {
      return res.status(400).json({ success: false, message: 'No HP hanya boleh berisi angka' });
    }

    await pool.execute(
      'UPDATE warga SET nama_warga=?, alamat=?, no_hp=?, id_rt=?, id_rw=? WHERE id_warga=?',
      [nama_warga, alamat, no_hp, id_rt, id_rw, req.params.id]
    );

    res.json({ success: true, message: 'Data warga berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;