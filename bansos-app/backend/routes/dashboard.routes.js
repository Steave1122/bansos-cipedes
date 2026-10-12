const express = require('express');
const router = express.Router();
const { pool } = require('../database/db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// Dashboard Admin Kelurahan
router.get('/admin', authenticateToken, authorizeRole('Admin Kelurahan'), async (req, res) => {
  try {
    const [totalWarga] = await pool.execute('SELECT COUNT(*) as total FROM warga');
    const [totalPengajuan] = await pool.execute('SELECT COUNT(*) as total FROM pengajuan');
    const [totalPenerima] = await pool.execute('SELECT COUNT(*) as total FROM penerima WHERE status_aktif = 1');
    const [totalDisetujui] = await pool.execute("SELECT COUNT(*) as total FROM pengajuan WHERE status_pengajuan = 'Disetujui'");
    const [totalDitolak] = await pool.execute("SELECT COUNT(*) as total FROM pengajuan WHERE status_pengajuan = 'Ditolak'");
    const [totalMenunggu] = await pool.execute("SELECT COUNT(*) as total FROM pengajuan WHERE status_pengajuan NOT IN ('Disetujui', 'Ditolak')");

    const [penerima_per_jenis] = await pool.execute(`
      SELECT p.jenis_bantuan, COUNT(*) as total
      FROM penerima pr
      JOIN pengajuan p ON pr.id_pengajuan = p.id_pengajuan
      WHERE pr.status_aktif = 1
      GROUP BY p.jenis_bantuan
    `);

    const [pengajuan_terbaru] = await pool.execute(`
      SELECT p.id_pengajuan, w.nama_warga, w.nik, p.jenis_bantuan,
             p.keterangan, p.status_pengajuan, p.tanggal_pengajuan, p.tx_id_blockchain
      FROM pengajuan p
      JOIN warga w ON p.id_warga = w.id_warga
      ORDER BY p.created_at DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        statistik: {
          total_warga: totalWarga[0].total,
          total_pengajuan: totalPengajuan[0].total,
          total_penerima: totalPenerima[0].total,
          total_disetujui: totalDisetujui[0].total,
          total_ditolak: totalDitolak[0].total,
          total_menunggu: totalMenunggu[0].total
        },
        penerima_per_jenis,
        pengajuan_terbaru
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Dashboard Petugas
router.get('/petugas', authenticateToken, authorizeRole('RT', 'RW', 'IPSM', 'Puskesos', 'Admin Kelurahan'), async (req, res) => {
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

    const [antrian] = await pool.execute(`
      SELECT COUNT(*) as total FROM pengajuan WHERE status_pengajuan = ?
    `, [status]);

    const [sudah_diverifikasi] = await pool.execute(`
      SELECT COUNT(*) as total FROM verifikasi WHERE id_petugas = ?
    `, [req.user.id]);

    const [verifikasi_terbaru] = await pool.execute(`
      SELECT v.*, w.nama_warga, w.nik, p.jenis_bantuan
      FROM verifikasi v
      JOIN pengajuan p ON v.id_pengajuan = p.id_pengajuan
      JOIN warga w ON p.id_warga = w.id_warga
      WHERE v.id_petugas = ?
      ORDER BY v.created_at DESC
      LIMIT 5
    `, [req.user.id]);

    res.json({
      success: true,
      data: {
        statistik: {
          antrian_menunggu: antrian[0].total,
          sudah_diverifikasi: sudah_diverifikasi[0].total
        },
        verifikasi_terbaru
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;