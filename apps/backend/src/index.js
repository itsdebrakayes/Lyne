require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const app = express();

// ── Middleware ────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/businesses',    require('./routes/businesses'));
app.use('/api/branches',      require('./routes/branches'));
app.use('/api/services',      require('./routes/services'));
app.use('/api/queues',        require('./routes/queues'));
app.use('/api/tickets',       require('./routes/tickets'));
app.use('/api/staff',         require('./routes/staff'));
app.use('/api/assignments',   require('./routes/assignments'));
app.use('/api/analytics',     require('./routes/analytics'));
app.use('/api/predictions',   require('./routes/predictions'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/history',       require('./routes/history'));
app.use('/api/saved',         require('./routes/saved'));

// ── Health check ──────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'qme-now-backend' }));

// ── 404 handler ───────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found.' }));

// ── Error handler ─────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Q ME NOW backend running on port ${PORT}`);
});
