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

// Debug endpoint
app.get('/api/health', (req, res) => {
  try {
    const csvStore = require('../server/services/csvStore');
    const dataDir = csvStore.dataDir;
    const bundledDir = path.join(__dirname, '..', 'server', 'data');

    let files = [];
    try { files = fs.readdirSync(dataDir); } catch(e) { files = ['ERROR: ' + e.message]; }

    let bundledFiles = [];
    try { bundledFiles = fs.readdirSync(bundledDir); } catch(e) { bundledFiles = ['ERROR: ' + e.message]; }

    let companiesContent = '';
    try { companiesContent = fs.readFileSync(path.join(dataDir, 'companies.csv'), 'utf8').substring(0, 500); } catch(e) { companiesContent = 'ERROR: ' + e.message; }

    // Also test the actual getAll
    let companiesParsed = [];
    try {
      companiesParsed = csvStore.getAll('companies.csv');
    } catch(e) { companiesParsed = [{ error: e.message }]; }

    res.json({
      ok: true,
      env: process.env.VERCEL ? 'vercel' : 'local',
      dataDir,
      bundledDir,
      dataDirExists: fs.existsSync(dataDir),
      bundledDirExists: fs.existsSync(bundledDir),
      files,
      bundledFiles,
      companiesContent,
      companiesParsed,
      companiesCount: companiesParsed.length,
      dirname: __dirname,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message, stack: err.stack });
  }
});

// Global error handler for uncaught route errors
app.use((err, req, res, next) => {
  console.error('[sharp-gst] Unhandled error:', err);
  res.status(500).json({ error: err.message });
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
