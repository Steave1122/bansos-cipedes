const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { testConnection } = require('./database/db');

const authRoutes = require('./routes/auth.routes');
const wargaRoutes = require('./routes/warga.routes');
const pengajuanRoutes = require('./routes/pengajuan.routes');
const verifikasiRoutes = require('./routes/verifikasi.routes');
const penerimaRoutes = require('./routes/penerima.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const blockchainRoutes = require('./routes/blockchain.routes');
const petugasRoutes = require('./routes/petugas.routes');
const auditlogRoutes = require('./routes/auditlog.routes');
const pesanRoutes = require('./routes/pesan.routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(express.static(path.join(__dirname, '../frontend')));

app.use('/api/auth', authRoutes);
app.use('/api/warga', wargaRoutes);
app.use('/api/pengajuan', pengajuanRoutes);
app.use('/api/verifikasi', verifikasiRoutes);
app.use('/api/penerima', penerimaRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/blockchain', blockchainRoutes);
app.use('/api/petugas', petugasRoutes);
app.use('/api/auditlog', auditlogRoutes);
app.use('/api/pesan', pesanRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Bansos Cipedes API running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

async function startServer() {
  await testConnection();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API: http://localhost:${PORT}/api/health`);
  });
}

startServer();