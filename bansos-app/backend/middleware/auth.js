const jwt = require('jsonwebtoken');
require('dotenv').config();

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'Token tidak ditemukan' });
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Token tidak valid' });
    }
    req.user = user;
    next();
  });
}

function authorizeRole(...roles) {
  return (req, res, next) => {
    const userRole = req.user.jabatan || req.user.role;
    if (!roles.map(r => r.toLowerCase()).includes(userRole.toLowerCase())) {
      return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }
    next();
  };
}

module.exports = { authenticateToken, authorizeRole };