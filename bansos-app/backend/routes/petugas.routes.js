const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../database/db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// Get semua petugas
router.get('/', authenticateToken, authorizeRole('Admin Kelurahan'), async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id_petugas, nama_petugas, jabatan, username, no_hp, created_at FROM petugas'
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Tambah petugas baru
router.post('/', authenticateToken, authorizeRole('Admin Kelurahan'), async (req, res) => {
  try {
    const { nama_petugas, jabatan, username, password, no_hp } = req.body;

    if (!nama_petugas || !jabatan || !username || !password) {
      return res.status(400).json({ success: false, message: 'Semua field wajib diisi' });
    }

    const jabatanValid = ['RT', 'RW', 'IPSM', 'Puskesos', 'Admin Kelurahan'];
    if (!jabatanValid.includes(jabatan)) {
      return res.status(400).json({ success: false, message: 'Jabatan tidak valid' });
    }

    // Cek username sudah ada
    const [cekUsername] = await pool.execute(
      'SELECT id_petugas FROM petugas WHERE username = ?', [username]
    );
    if (cekUsername.length > 0) {
      return res.status(400).json({ success: false, message: 'Username sudah digunakan' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const [result] = await pool.execute(
      'INSERT INTO petugas (nama_petugas, jabatan, username, password_hash, no_hp) VALUES (?, ?, ?, ?, ?)',
      [nama_petugas, jabatan, username, password_hash, no_hp || null]
    );

    res.status(201).json({
      success: true,
      message: 'Petugas berhasil ditambahkan',
      id_petugas: result.insertId
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update petugas
router.put('/:id', authenticateToken, authorizeRole('Admin Kelurahan'), async (req, res) => {
  try {
    const { nama_petugas, jabatan, no_hp } = req.body;
    // Catatan keamanan: Admin Kelurahan TIDAK diizinkan mengganti password
    // petugas lain melalui endpoint ini, untuk menjaga independensi rantai
    // verifikasi berjenjang (RT/RW/IPSM/Puskesos/Kelurahan). Password hanya
    // diset satu kali saat pembuatan akun (POST /).
    await pool.execute(
      'UPDATE petugas SET nama_petugas=?, jabatan=?, no_hp=? WHERE id_petugas=?',
      [nama_petugas, jabatan, no_hp, req.params.id]
    );

    res.json({ success: true, message: 'Data petugas berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Hapus/nonaktifkan petugas
router.delete('/:id', authenticateToken, authorizeRole('Admin Kelurahan'), async (req, res) => {
  try {
    const [cek] = await pool.execute(
      'SELECT id_petugas, jabatan FROM petugas WHERE id_petugas = ?', [req.params.id]
    );
    if (cek.length === 0) {
      return res.status(404).json({ success: false, message: 'Petugas tidak ditemukan' });
    }
    if (cek[0].jabatan === 'Admin Kelurahan') {
      return res.status(400).json({ success: false, message: 'Tidak bisa hapus Admin Kelurahan' });
    }

    // Cek apakah petugas pernah verifikasi
    const [cekVerif] = await pool.execute(
      'SELECT COUNT(*) as total FROM verifikasi WHERE id_petugas = ?', [req.params.id]
    );

    if (cekVerif[0].total > 0) {
      return res.status(400).json({
        success: false,
        message: `Petugas tidak bisa dihapus karena sudah melakukan ${cekVerif[0].total} verifikasi. Data verifikasi harus tetap tersimpan untuk audit blockchain.`
      });
    }

    await pool.execute('DELETE FROM petugas WHERE id_petugas = ?', [req.params.id]);
    res.json({ success: true, message: 'Petugas berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;