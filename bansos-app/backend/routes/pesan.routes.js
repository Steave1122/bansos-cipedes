const express = require('express');
const router = express.Router();
const { pool } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

function escapeHtmlServer(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Cek akses: warga cuma boleh akses pesan pengajuan miliknya sendiri;
// petugas cuma boleh akses pengajuan yang statusnya sedang di tahap dia
async function cekAkses(req, id_pengajuan) {
  const [rows] = await pool.execute(
    'SELECT id_warga, status_pengajuan FROM pengajuan WHERE id_pengajuan = ?',
    [id_pengajuan]
  );
  if (rows.length === 0) return { ok: false, message: 'Pengajuan tidak ditemukan' };
  const p = rows[0];

  if (req.user.role === 'warga') {
    if (p.id_warga !== req.user.id) return { ok: false, message: 'Anda tidak memiliki akses ke pengajuan ini' };
    return { ok: true };
  }

  // Petugas: cek apakah statusnya cocok dengan tahap jabatannya saat ini
  const statusMap = {
    'RT': 'Diajukan',
    'RW': 'Verifikasi RT',
    'IPSM': 'Verifikasi RW',
    'Puskesos': 'Verifikasi IPSM',
    'Admin Kelurahan': 'Verifikasi Puskesos'
  };
  const statusUntukJabatan = statusMap[req.user.jabatan];
  // Admin Kelurahan & petugas yang sudah pernah proses tahap ini tetap boleh akses riwayat chat,
  // jadi kita longgarkan: petugas boleh akses kalau statusnya SEDANG di tahap dia ATAU SUDAH lewat tahap dia
  const urutan = ['Diajukan', 'Verifikasi RT', 'Verifikasi RW', 'Verifikasi IPSM', 'Verifikasi Puskesos', 'Disetujui', 'Ditolak'];
  const idxSekarang = urutan.indexOf(p.status_pengajuan);
  const idxTahapPetugas = urutan.indexOf(statusUntukJabatan);
  if (req.user.jabatan === 'Admin Kelurahan') return { ok: true }; // admin selalu boleh
  if (idxSekarang === -1 || idxTahapPetugas === -1) return { ok: false, message: 'Akses ditolak' };
  if (idxSekarang < idxTahapPetugas) return { ok: false, message: 'Pengajuan belum sampai tahap Anda' };
  return { ok: true };
}

// GET riwayat pesan untuk 1 pengajuan
router.get('/:id_pengajuan', authenticateToken, async (req, res) => {
  try {
    const akses = await cekAkses(req, req.params.id_pengajuan);
    if (!akses.ok) return res.status(403).json({ success: false, message: akses.message });

    const [rows] = await pool.execute(
      'SELECT id_pesan, tipe_pengirim, id_pengirim, nama_pengirim, isi_pesan, dibaca, created_at FROM pesan_pengajuan WHERE id_pengajuan = ? ORDER BY created_at ASC',
      [req.params.id_pengajuan]
    );

    // Tandai pesan dari lawan bicara sebagai sudah dibaca
    const tipeLawan = req.user.role === 'warga' ? 'petugas' : 'warga';
    await pool.execute(
      'UPDATE pesan_pengajuan SET dibaca = 1 WHERE id_pengajuan = ? AND tipe_pengirim = ?',
      [req.params.id_pengajuan, tipeLawan]
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Rate-limit sederhana: 1 pesan per 2 detik per pengirim (in-memory, cukup untuk skala prototipe)
const lastSentAt = new Map();

// POST kirim pesan baru
router.post('/:id_pengajuan', authenticateToken, async (req, res) => {
  try {
    const rateLimitKey = req.user.role + '_' + req.user.id;
    const sekarang = Date.now();
    const terakhirKirim = lastSentAt.get(rateLimitKey);
    if (terakhirKirim && (sekarang - terakhirKirim) < 2000) {
      return res.status(429).json({ success: false, message: 'Terlalu cepat mengirim pesan. Tunggu sebentar.' });
    }

    const { isi_pesan } = req.body;
    if (!isi_pesan || !isi_pesan.trim()) {
      return res.status(400).json({ success: false, message: 'Pesan tidak boleh kosong' });
    }
    if (isi_pesan.length > 1000) {
      return res.status(400).json({ success: false, message: 'Pesan maksimal 1000 karakter' });
    }

    const akses = await cekAkses(req, req.params.id_pengajuan);
    if (!akses.ok) return res.status(403).json({ success: false, message: akses.message });

    lastSentAt.set(rateLimitKey, sekarang);

    const tipe_pengirim = req.user.role === 'warga' ? 'warga' : 'petugas';
    const nama_pengirim = req.user.nama;
    // Isi kolom id_warga ATAU id_petugas sesuai tipe_pengirim (relasi FK formal)
    const id_warga = tipe_pengirim === 'warga' ? req.user.id : null;
    const id_petugas = tipe_pengirim === 'petugas' ? req.user.id : null;

    const [result] = await pool.execute(
      'INSERT INTO pesan_pengajuan (id_pengajuan, tipe_pengirim, id_warga, id_petugas, id_pengirim, nama_pengirim, isi_pesan) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.params.id_pengajuan, tipe_pengirim, id_warga, id_petugas, req.user.id, nama_pengirim, isi_pesan.trim()]
    );

    res.status(201).json({
      success: true,
      message: 'Pesan terkirim',
      data: {
        id_pesan: result.insertId,
        tipe_pengirim,
        id_pengirim: req.user.id,
        nama_pengirim,
        isi_pesan: isi_pesan.trim(),
        created_at: new Date()
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET jumlah pesan belum dibaca (untuk badge notifikasi) — dipanggil saat polling
router.get('/:id_pengajuan/unread-count', authenticateToken, async (req, res) => {
  try {
    const akses = await cekAkses(req, req.params.id_pengajuan);
    if (!akses.ok) return res.status(403).json({ success: false, message: akses.message });

    const tipeLawan = req.user.role === 'warga' ? 'petugas' : 'warga';
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as total FROM pesan_pengajuan WHERE id_pengajuan = ? AND tipe_pengirim = ? AND dibaca = 0',
      [req.params.id_pengajuan, tipeLawan]
    );
    res.json({ success: true, unread: rows[0].total });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
