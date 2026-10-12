const { pool } = require('../database/db');

async function catatAuditLog({ tipe_aktor, id_aktor, nama_aktor, aksi, detail, req, status }) {
  try {
    const ip_address = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
    const user_agent = req.headers['user-agent'] || null;
    // Isi kolom id_warga ATAU id_petugas sesuai tipe_aktor (relasi FK formal),
    // id_aktor tetap diisi untuk kompatibilitas mundur.
    const id_warga = tipe_aktor === 'warga' ? id_aktor : null;
    const id_petugas = tipe_aktor === 'petugas' ? id_aktor : null;
    await pool.execute(
      'INSERT INTO audit_log (tipe_aktor, id_warga, id_petugas, id_aktor, nama_aktor, aksi, detail, ip_address, user_agent, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [tipe_aktor, id_warga, id_petugas, id_aktor, nama_aktor, aksi, detail || null, ip_address, user_agent, status]
    );
  } catch (error) {
    console.error('Gagal mencatat audit log:', error.message);
  }
}

module.exports = { catatAuditLog };
