const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Ensure seed data exists on every request (no-op if already seeded)
app.use((req, res, next) => {
  try {
    const csvStore = require('../server/services/csvStore');
    csvStore.ensureSeedData();
  } catch (err) {
    console.error('[sharp-gst] ensureSeedData error:', err.message);
  }
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, env: process.env.VERCEL ? 'vercel' : 'local' });
});

try {
  const companyScope = require('../server/middleware/companyScope');

  // --- Global routes (no company scoping) ---
  app.use('/api/companies', require('../server/routes/companies'));
  app.use('/api/hsn', require('../server/routes/hsn'));

  // --- Company-scoped routes (require X-Company-Id header) ---
  app.use('/api', companyScope);

  app.use('/api/invoices', require('../server/routes/invoices'));
  app.use('/api/returns', require('../server/routes/returns'));
  app.use('/api/ledger', require('../server/routes/ledger'));
  app.use('/api/inventory', require('../server/routes/inventory'));
  app.use('/api/reports', require('../server/routes/reports'));
  app.use('/api/customers', require('../server/routes/customers'));
  app.use('/api/products', require('../server/routes/products'));
  app.use('/api/payments', require('../server/routes/payments'));
  app.use('/api/settings', require('../server/routes/settings'));
  app.use('/api/dashboard', require('../server/routes/dashboard'));
} catch (err) {
  console.error('[sharp-gst] Route setup error:', err.message, err.stack);
  // Fallback: at least health endpoint works
  app.use('/api/*', (req, res) => {
    res.status(500).json({ error: 'Server initialization failed: ' + err.message });
  });
}

module.exports = app;
