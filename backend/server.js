const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const dotenv     = require('dotenv');
const path       = require('path');

dotenv.config();

const app = express();

// ── Middleware ──
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files from /frontend
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/assets', express.static(path.join(__dirname, '../assets')));

// ── Routes ──
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/admin',     require('./routes/admin'));
app.use('/api/client',    require('./routes/client'));
app.use('/api/estimator', require('./routes/estimator'));

// Catch-all: serve frontend
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  }
});

// ── Error handler ──
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Server error', error: err.message });
});

// ── Connect DB & Start ──
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/aarav_interiors';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => {
      console.log(`🚀 AARAV Interiors API running on http://localhost:${PORT}`);
      console.log(`📁 Frontend: http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.warn('⚠️  MongoDB connection failed. Running in API-only mode.');
    console.warn('   Ensure MongoDB is running: mongod --dbpath /data/db');
    // Start server even without DB (frontend still works)
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT} (DB offline)`));
  });

module.exports = app;
