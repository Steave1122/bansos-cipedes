const express = require('express');
const router = express.Router();
const { pool } = require('../database/db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { catatAuditLog } = require('../services/auditLog');

router.post('/catat-export', authenticateToken, authorizeRole('Admin Kelurahan'), async (req, res) => {
  try {
    const { format, jumlah_data, periode } = req.body;
    await catatAuditLog({
      tipe_aktor: 'petugas',
      id_aktor: req.user.id,
      nama_aktor: req.user.nama,
      aksi: 'Export Laporan ' + (format || '').toUpperCase(),
      detail: 'Mengunduh ' + (jumlah_data || 0) + ' data (' + (periode || 'Semua Data') + ')',
      req,
      status: 'Berhasil'
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


router.get('/', authenticateToken, authorizeRole('Admin Kelurahan'), async (req, res) => {
  try {
    const { tipe_aktor, status, limit } = req.query;
    let query = 'SELECT * FROM audit_log WHERE 1=1';
    const params = [];
    if (tipe_aktor) {
      query += ' AND tipe_aktor = ?';
      params.push(tipe_aktor);
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    query += ' ORDER BY id_log DESC LIMIT ?';
    params.push(parseInt(limit) || 100);

    const [rows] = await pool.query(query, params);
    res.json({ success: true, total: rows.length, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
