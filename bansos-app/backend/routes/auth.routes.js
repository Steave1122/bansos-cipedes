const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../database/db');
const { getContract } = require('../fabric/connection');
const axios = require('axios');
require('dotenv').config();
const crypto = require('crypto');

function hitungHashPengajuan(id, idWarga, nama, nik, jenis, tanggal, ket) {
  const data = [id, idWarga, nama, nik, jenis, tanggal, ket || ''].join('|');
  return crypto.createHash('sha256').update(data).digest('hex');
}
const { catatAuditLog } = require('../services/auditLog');

// ── Helper ──────────────────────────────────────────────
function isAkunTerdaftar(password_hash) {
  if (!password_hash) return false;
  if (password_hash === '' || password_hash === 'BELUM_DAFTAR') return false;
  if (password_hash.length < 10) return false;
  return true;
}

// ── Cek NIK (tanpa password) ────────────────────────────
router.get('/warga/cek-nik/:nik', async (req, res) => {
  try {
    const { nik } = req.params;
    if (!nik || nik.length !== 16)
      return res.status(400).json({ success: false, message: 'NIK harus 16 digit' });

    const [rows] = await pool.execute(
      'SELECT id_warga, password_hash FROM warga WHERE nik = ?', [nik]
    );
    if (rows.length === 0)
      return res.json({ success: false, status: 'tidak_ditemukan', message: 'NIK tidak terdaftar di kelurahan' });

    const punya_akun = isAkunTerdaftar(rows[0].password_hash);
    return res.json({
      success: true,
      status: punya_akun ? 'punya_akun' : 'belum_daftar',
      message: punya_akun ? 'Akun ditemukan' : 'NIK terdaftar tapi belum memiliki akun'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Login Warga ─────────────────────────────────────────
router.post('/warga/login', async (req, res) => {
  try {
    const { nik, password } = req.body;
    if (!nik || !password)
      return res.status(400).json({ success: false, message: 'NIK dan password wajib diisi' });

    const [rows] = await pool.execute('SELECT * FROM warga WHERE nik = ?', [nik]);
    if (rows.length === 0)
      return res.status(401).json({ success: false, message: 'NIK tidak ditemukan' });

    const warga = rows[0];
    if (!isAkunTerdaftar(warga.password_hash))
      return res.status(401).json({ success: false, message: 'Akun belum diaktifkan. Silakan daftar terlebih dahulu.' });

    if (warga.locked_until && new Date() < new Date(warga.locked_until)) {
      const sisaMenit = Math.ceil((new Date(warga.locked_until) - new Date()) / 60000);
      return res.status(429).json({ success: false, message: `Akun terkunci sementara karena terlalu banyak percobaan gagal. Coba lagi dalam ${sisaMenit} menit.` });
    }

    const isValid = await bcrypt.compare(password, warga.password_hash);
    if (!isValid) {
      const attemptsBaru = (warga.login_attempts || 0) + 1;
      if (attemptsBaru >= 5) {
        const lockoutCountBaru = (warga.lockout_count || 0) + 1;
        const durasiMenit = lockoutCountBaru === 1 ? 5 : (lockoutCountBaru === 2 ? 8 : 15);
        const lockUntil = new Date(Date.now() + durasiMenit * 60 * 1000);
        await pool.execute('UPDATE warga SET login_attempts = 0, locked_until = ?, lockout_count = ? WHERE id_warga = ?', [lockUntil, lockoutCountBaru, warga.id_warga]);
        return res.status(429).json({ success: false, message: `Terlalu banyak percobaan gagal. Akun dikunci selama ${durasiMenit} menit.` });
      }
      await pool.execute('UPDATE warga SET login_attempts = ? WHERE id_warga = ?', [attemptsBaru, warga.id_warga]);
      return res.status(401).json({ success: false, message: 'Password salah' });
    }

    await pool.execute('UPDATE warga SET login_attempts = 0, locked_until = NULL, lockout_count = 0 WHERE id_warga = ?', [warga.id_warga]);

    const token = jwt.sign(
      { id: warga.id_warga, nik: warga.nik, nama: warga.nama_warga, role: 'warga' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    res.json({
      success: true, message: 'Login berhasil', token,
      user: { id: warga.id_warga, nama: warga.nama_warga, nik: warga.nik, role: 'warga' }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Login Petugas ───────────────────────────────────────
router.post('/petugas/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ success: false, message: 'Username dan password wajib diisi' });

    const [rows] = await pool.execute('SELECT * FROM petugas WHERE username = ?', [username]);
    if (rows.length === 0) {
      await catatAuditLog({ tipe_aktor: 'petugas', id_aktor: 0, nama_aktor: username, aksi: 'Login (Tahap 1)', detail: 'Username tidak ditemukan', req, status: 'Gagal' });
      return res.status(401).json({ success: false, message: 'Username tidak ditemukan' });
    }

    const petugas = rows[0];

    if (petugas.locked_until && new Date() < new Date(petugas.locked_until)) {
      const sisaMenit = Math.ceil((new Date(petugas.locked_until) - new Date()) / 60000);
      await catatAuditLog({ tipe_aktor: 'petugas', id_aktor: petugas.id_petugas, nama_aktor: petugas.nama_petugas, aksi: 'Login (Tahap 1)', detail: 'Akun terkunci sementara', req, status: 'Gagal' });
      return res.status(429).json({ success: false, message: `Akun terkunci sementara karena terlalu banyak percobaan gagal. Coba lagi dalam ${sisaMenit} menit.` });
    }

    const isValid = await bcrypt.compare(password, petugas.password_hash);
    if (!isValid) {
      const attemptsBaru = (petugas.login_attempts || 0) + 1;
      if (attemptsBaru >= 5) {
        const lockoutCountBaru = (petugas.lockout_count || 0) + 1;
        const durasiMenit = lockoutCountBaru === 1 ? 5 : (lockoutCountBaru === 2 ? 8 : 15);
        const lockUntil = new Date(Date.now() + durasiMenit * 60 * 1000);
        await pool.execute('UPDATE petugas SET login_attempts = 0, locked_until = ?, lockout_count = ? WHERE id_petugas = ?', [lockUntil, lockoutCountBaru, petugas.id_petugas]);
        await catatAuditLog({ tipe_aktor: 'petugas', id_aktor: petugas.id_petugas, nama_aktor: petugas.nama_petugas, aksi: 'Login (Tahap 1)', detail: `Terlalu banyak percobaan gagal, akun dikunci ${durasiMenit} menit (lockout ke-${lockoutCountBaru})`, req, status: 'Gagal' });
        return res.status(429).json({ success: false, message: `Terlalu banyak percobaan gagal. Akun dikunci selama ${durasiMenit} menit.` });
      }
      await pool.execute('UPDATE petugas SET login_attempts = ? WHERE id_petugas = ?', [attemptsBaru, petugas.id_petugas]);
      await catatAuditLog({ tipe_aktor: 'petugas', id_aktor: petugas.id_petugas, nama_aktor: petugas.nama_petugas, aksi: 'Login (Tahap 1)', detail: 'Password salah', req, status: 'Gagal' });
      return res.status(401).json({ success: false, message: 'Password salah' });
    }

    await pool.execute('UPDATE petugas SET login_attempts = 0, locked_until = NULL, lockout_count = 0 WHERE id_petugas = ?', [petugas.id_petugas]);

    if (!petugas.no_hp) {
      return res.status(400).json({ success: false, message: 'Nomor HP petugas tidak terdaftar. Hubungi Admin Kelurahan.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expired_at = new Date(Date.now() + 5 * 60 * 1000);
    await pool.execute(
      'UPDATE petugas SET otp_code = ?, otp_expired_at = ?, otp_attempts = 0 WHERE id_petugas = ?',
      [otp, expired_at, petugas.id_petugas]
    );

    const no_hp_masked = petugas.no_hp.substring(0, 4) + '****' + petugas.no_hp.substring(petugas.no_hp.length - 3);
    console.log('[OTP SIMULASI PETUGAS] Username: ' + username + ' | Nama: ' + petugas.nama_petugas + ' | HP: ' + petugas.no_hp + ' | OTP: ' + otp);

    await catatAuditLog({ tipe_aktor: 'petugas', id_aktor: petugas.id_petugas, nama_aktor: petugas.nama_petugas, aksi: 'Login (Tahap 1)', detail: 'Password valid, OTP dikirim', req, status: 'Berhasil' });

    res.json({
      success: true,
      message: 'Password valid. Kode OTP telah dikirim ke nomor ' + no_hp_masked + '. Berlaku 5 menit.',
      no_hp_masked,
      username: petugas.username,
      otp_simulasi: otp
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/petugas/verify-otp-login', async (req, res) => {
  try {
    const { username, otp } = req.body;
    if (!username || !otp)
      return res.status(400).json({ success: false, message: 'Username dan OTP wajib diisi' });

    const [rows] = await pool.execute('SELECT * FROM petugas WHERE username = ?', [username]);
    if (rows.length === 0)
      return res.status(404).json({ success: false, message: 'Username tidak ditemukan' });

    const petugas = rows[0];
    if (!petugas.otp_code)
      return res.status(400).json({ success: false, message: 'OTP belum digenerate. Silakan login ulang.' });
    if (new Date() > new Date(petugas.otp_expired_at)) {
      await catatAuditLog({ tipe_aktor: 'petugas', id_aktor: petugas.id_petugas, nama_aktor: petugas.nama_petugas, aksi: 'Login (Tahap 2 - OTP)', detail: 'OTP kadaluarsa', req, status: 'Gagal' });
      return res.status(400).json({ success: false, message: 'OTP sudah kadaluarsa. Silakan login ulang.' });
    }
    if ((petugas.otp_attempts || 0) >= 3) {
      await pool.execute('UPDATE petugas SET otp_code = NULL, otp_expired_at = NULL, otp_attempts = 0 WHERE id_petugas = ?', [petugas.id_petugas]);
      await catatAuditLog({ tipe_aktor: 'petugas', id_aktor: petugas.id_petugas, nama_aktor: petugas.nama_petugas, aksi: 'Login (Tahap 2 - OTP)', detail: 'Terlalu banyak percobaan OTP salah, akun dikunci sementara', req, status: 'Gagal' });
      return res.status(429).json({ success: false, message: 'Terlalu banyak percobaan salah. Silakan login ulang.' });
    }
    if (petugas.otp_code !== otp.toString()) {
      await pool.execute('UPDATE petugas SET otp_attempts = otp_attempts + 1 WHERE id_petugas = ?', [petugas.id_petugas]);
      await catatAuditLog({ tipe_aktor: 'petugas', id_aktor: petugas.id_petugas, nama_aktor: petugas.nama_petugas, aksi: 'Login (Tahap 2 - OTP)', detail: 'Kode OTP salah', req, status: 'Gagal' });
      return res.status(400).json({ success: false, message: 'Kode OTP salah.' });
    }

    await pool.execute(
      'UPDATE petugas SET otp_code = NULL, otp_expired_at = NULL, otp_attempts = 0 WHERE id_petugas = ?',
      [petugas.id_petugas]
    );

    const token = jwt.sign(
      { id: petugas.id_petugas, username: petugas.username, nama: petugas.nama_petugas, jabatan: petugas.jabatan, role: 'petugas' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    await catatAuditLog({ tipe_aktor: 'petugas', id_aktor: petugas.id_petugas, nama_aktor: petugas.nama_petugas, aksi: 'Login (Tahap 2 - OTP)', detail: 'Login berhasil dengan OTP', req, status: 'Berhasil' });

    res.json({
      success: true, message: 'Login berhasil', token,
      user: { id: petugas.id_petugas, nama: petugas.nama_petugas, username: petugas.username, jabatan: petugas.jabatan, role: 'petugas' }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Generate OTP ────────────────────────────────────────
router.post('/warga/generate-otp', async (req, res) => {
  try {
    const { nik } = req.body;
    if (!nik)
      return res.status(400).json({ success: false, message: 'NIK wajib diisi' });

    const [rows] = await pool.execute(
      'SELECT id_warga, nama_warga, nik, no_hp, password_hash FROM warga WHERE nik = ?', [nik]
    );
    if (rows.length === 0)
      return res.status(404).json({ success: false, message: 'NIK tidak ditemukan dalam data kelurahan. Hubungi petugas kelurahan untuk pendataan.' });

    const warga = rows[0];
    if (isAkunTerdaftar(warga.password_hash))
      return res.status(400).json({ success: false, message: 'Akun dengan NIK ini sudah terdaftar. Silakan login.' });

    if (!warga.no_hp)
      return res.status(400).json({ success: false, message: 'Nomor HP tidak terdaftar. Hubungi petugas kelurahan untuk memperbarui data.' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expired_at = new Date(Date.now() + 5 * 60 * 1000);

    await pool.execute(
      'UPDATE warga SET otp_code = ?, otp_expired_at = ?, otp_attempts = 0 WHERE id_warga = ?',
      [otp, expired_at, warga.id_warga]
    );

    const no_hp_masked = warga.no_hp.substring(0, 4) + '****' + warga.no_hp.substring(warga.no_hp.length - 3);
    console.log(`[OTP SIMULASI] NIK: ${nik} | Nama: ${warga.nama_warga} | HP: ${warga.no_hp} | OTP: ${otp}`);

    res.json({
      success: true,
      message: `Kode OTP telah dikirim ke nomor ${no_hp_masked}. Berlaku 5 menit.`,
      no_hp_masked,
      nama_warga: warga.nama_warga,
      otp_simulasi: otp
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Verifikasi OTP ──────────────────────────────────────
router.post('/warga/verify-otp', async (req, res) => {
  try {
    const { nik, otp } = req.body;
    if (!nik || !otp)
      return res.status(400).json({ success: false, message: 'NIK dan OTP wajib diisi' });

    const [rows] = await pool.execute(
      'SELECT id_warga, nama_warga, nik, alamat, otp_code, otp_expired_at, otp_attempts FROM warga WHERE nik = ?', [nik]
    );
    if (rows.length === 0)
      return res.status(404).json({ success: false, message: 'NIK tidak ditemukan' });

    const warga = rows[0];
    if (!warga.otp_code)
      return res.status(400).json({ success: false, message: 'OTP belum digenerate. Minta OTP terlebih dahulu.' });
    if (new Date() > new Date(warga.otp_expired_at))
      return res.status(400).json({ success: false, message: 'OTP sudah kadaluarsa. Minta OTP baru.' });
    if ((warga.otp_attempts || 0) >= 3) {
      await pool.execute('UPDATE warga SET otp_code = NULL, otp_expired_at = NULL, otp_attempts = 0 WHERE id_warga = ?', [warga.id_warga]);
      return res.status(429).json({ success: false, message: 'Terlalu banyak percobaan salah. Silakan minta OTP baru.' });
    }
    if (warga.otp_code !== otp.toString()) {
      await pool.execute('UPDATE warga SET otp_attempts = otp_attempts + 1 WHERE id_warga = ?', [warga.id_warga]);
      return res.status(400).json({ success: false, message: 'Kode OTP salah.' });
    }

    await pool.execute(
      'UPDATE warga SET otp_code = NULL, otp_expired_at = NULL, otp_attempts = 0 WHERE id_warga = ?',
      [warga.id_warga]
    );
    res.json({
      success: true,
      message: 'OTP valid. Silakan lanjutkan registrasi.',
      data: { id_warga: warga.id_warga, nama_warga: warga.nama_warga, nik: warga.nik, alamat: warga.alamat }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Registrasi Akun Warga ───────────────────────────────
router.post('/warga/register', async (req, res) => {
  try {
    const { nik, password } = req.body;
    if (!nik || !password)
      return res.status(400).json({ success: false, message: 'NIK dan password wajib diisi' });
    if (password.length < 6)
      return res.status(400).json({ success: false, message: 'Password minimal 6 karakter' });

    const [rows] = await pool.execute('SELECT * FROM warga WHERE nik = ?', [nik]);
    if (rows.length === 0)
      return res.status(404).json({ success: false, message: 'NIK tidak ditemukan dalam data kelurahan. Hubungi petugas kelurahan untuk pendataan.' });

    const warga = rows[0];
    if (isAkunTerdaftar(warga.password_hash))
      return res.status(400).json({ success: false, message: 'Akun sudah terdaftar. Silakan login.' });

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    const conn = await pool.getConnection();
    let txId;
    try {
      await conn.beginTransaction();

      await conn.execute(
        'UPDATE warga SET password_hash = ?, username = ? WHERE id_warga = ?',
        [password_hash, nik, warga.id_warga]
      );

      const { gateway, contract } = await getContract();
      const transaction = contract.createTransaction('CatatPengajuan');
      const tanggal = new Date().toISOString().split('T')[0];
      const idPengajuan = 'REG_' + warga.id_warga.toString() + '_' + Date.now();
      const keteranganReg = 'Registrasi akun warga via verifikasi wajah dan OTP';
      const hashReg = hitungHashPengajuan(idPengajuan, warga.id_warga, warga.nama_warga, warga.nik, 'Registrasi Akun', tanggal, keteranganReg);
      await transaction.submit(
        idPengajuan,
        warga.id_warga.toString(),
        warga.nama_warga,
        warga.nik,
        'Registrasi Akun',
        tanggal,
        keteranganReg,
        hashReg
      );
      txId = transaction.getTransactionId();
      await conn.execute('UPDATE warga SET tx_id_registrasi = ? WHERE id_warga = ?', [txId, warga.id_warga]);
      await gateway.disconnect();

      await conn.commit();
      conn.release();
    } catch (fabricError) {
      console.error('Fabric error saat registrasi, membatalkan:', fabricError.message);
      await conn.rollback();
      conn.release();
      return res.status(503).json({
        success: false,
        message: 'Registrasi gagal dicatat ke blockchain karena gangguan jaringan. Silakan coba lagi.',
        blockchain_tercatat: false,
      });
    }

    res.status(201).json({
      success: true,
      message: `Akun berhasil dibuat untuk ${warga.nama_warga}. Silakan login menggunakan NIK dan password Anda.`,
      tx_id_blockchain: txId,
      nama_warga: warga.nama_warga,
      blockchain_tercatat: true
    });
  } catch (error) {
    console.error('Register error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Get Profil Warga ───────────────────────────────────
router.get('/warga/profil', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Token tidak ditemukan' });
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [rows] = await pool.execute(
      'SELECT id_warga, nama_warga, nik, no_hp, alamat, foto_profil FROM warga WHERE id_warga = ?',
      [decoded.id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Warga tidak ditemukan' });
    res.json({ success: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── Update Foto Profil Warga ────────────────────────────
router.put('/warga/foto-profil', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Token tidak ditemukan' });
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { foto_profil } = req.body;
    if (!foto_profil) return res.status(400).json({ success: false, message: 'Foto profil wajib diisi' });
    await pool.execute('UPDATE warga SET foto_profil = ? WHERE id_warga = ?', [foto_profil, decoded.id]);
    res.json({ success: true, message: 'Foto profil berhasil diupdate' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── Get Profil Petugas ──────────────────────────────────
router.get('/petugas/profil', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Token tidak ditemukan' });
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [rows] = await pool.execute(
      'SELECT id_petugas, nama_petugas, username, jabatan, no_hp, foto_profil FROM petugas WHERE id_petugas = ?',
      [decoded.id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Petugas tidak ditemukan' });
    res.json({ success: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── Update Foto Profil Petugas ──────────────────────────
router.put('/petugas/foto-profil', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Token tidak ditemukan' });
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { foto_profil } = req.body;
    if (!foto_profil) return res.status(400).json({ success: false, message: 'Foto profil wajib diisi' });
    await pool.execute('UPDATE petugas SET foto_profil = ? WHERE id_petugas = ?', [foto_profil, decoded.id]);
    res.json({ success: true, message: 'Foto profil berhasil diupdate' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});


// ── Lupa Password Petugas: Kirim OTP ke HP terdaftar sendiri ──
// (Admin sengaja TIDAK dilibatkan, demi independensi rantai verifikasi berjenjang)
router.post('/petugas/forgot-password', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username)
      return res.status(400).json({ success: false, message: 'Username wajib diisi' });

    const [rows] = await pool.execute('SELECT * FROM petugas WHERE username = ?', [username]);
    if (rows.length === 0)
      return res.status(404).json({ success: false, message: 'Username tidak ditemukan' });

    const petugas = rows[0];
    if (!petugas.no_hp)
      return res.status(400).json({ success: false, message: 'Nomor HP tidak terdaftar. Hubungi Admin Kelurahan untuk memperbarui data HP Anda.' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expired_at = new Date(Date.now() + 5 * 60 * 1000);
    await pool.execute(
      'UPDATE petugas SET otp_code = ?, otp_expired_at = ?, otp_attempts = 0 WHERE id_petugas = ?',
      [otp, expired_at, petugas.id_petugas]
    );

    const no_hp_masked = petugas.no_hp.substring(0, 4) + '****' + petugas.no_hp.substring(petugas.no_hp.length - 3);
    console.log('[OTP RESET PASSWORD PETUGAS] Username: ' + username + ' | Nama: ' + petugas.nama_petugas + ' | HP: ' + petugas.no_hp + ' | OTP: ' + otp);

    await catatAuditLog({
      tipe_aktor: 'petugas', id_aktor: petugas.id_petugas, nama_aktor: petugas.nama_petugas,
      aksi: 'Lupa Password - Minta OTP', detail: 'OTP reset password dikirim ke ' + no_hp_masked,
      req, status: 'Berhasil'
    });

    res.json({
      success: true,
      message: 'Kode OTP telah dikirim ke nomor ' + no_hp_masked + '. Berlaku 5 menit.',
      no_hp_masked,
      otp_simulasi: otp
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Lupa Password Petugas: Verifikasi OTP + Set Password Baru ──
router.post('/petugas/reset-password', async (req, res) => {
  try {
    const { username, otp, password_baru } = req.body;
    if (!username || !otp || !password_baru)
      return res.status(400).json({ success: false, message: 'Username, OTP, dan password baru wajib diisi' });
    if (password_baru.length < 6)
      return res.status(400).json({ success: false, message: 'Password baru minimal 6 karakter' });

    const [rows] = await pool.execute('SELECT * FROM petugas WHERE username = ?', [username]);
    if (rows.length === 0)
      return res.status(404).json({ success: false, message: 'Username tidak ditemukan' });

    const petugas = rows[0];
    if (!petugas.otp_code)
      return res.status(400).json({ success: false, message: 'OTP belum digenerate. Silakan minta OTP terlebih dahulu.' });
    if (new Date() > new Date(petugas.otp_expired_at))
      return res.status(400).json({ success: false, message: 'OTP sudah kadaluarsa. Silakan minta OTP baru.' });
    if ((petugas.otp_attempts || 0) >= 3) {
      await pool.execute('UPDATE petugas SET otp_code = NULL, otp_expired_at = NULL, otp_attempts = 0 WHERE id_petugas = ?', [petugas.id_petugas]);
      return res.status(429).json({ success: false, message: 'Terlalu banyak percobaan salah. Silakan minta OTP baru.' });
    }
    if (petugas.otp_code !== otp.toString()) {
      await pool.execute('UPDATE petugas SET otp_attempts = otp_attempts + 1 WHERE id_petugas = ?', [petugas.id_petugas]);
      return res.status(400).json({ success: false, message: 'Kode OTP salah.' });
    }

    const password_hash = await bcrypt.hash(password_baru, 10);
    await pool.execute(
      'UPDATE petugas SET password_hash = ?, otp_code = NULL, otp_expired_at = NULL, otp_attempts = 0 WHERE id_petugas = ?',
      [password_hash, petugas.id_petugas]
    );

    await catatAuditLog({
      tipe_aktor: 'petugas', id_aktor: petugas.id_petugas, nama_aktor: petugas.nama_petugas,
      aksi: 'Reset Password', detail: 'Password berhasil direset mandiri melalui verifikasi OTP',
      req, status: 'Berhasil'
    });

    res.json({ success: true, message: 'Password berhasil direset. Silakan login dengan password baru Anda.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;