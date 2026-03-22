const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const companyScope = require('./middleware/companyScope');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// --- Global routes (no company scoping) ---
app.use('/api/companies', require('./routes/companies'));
app.use('/api/hsn', require('./routes/hsn'));

// --- Company-scoped routes (require X-Company-Id header) ---
app.use('/api', companyScope);

app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/returns', require('./routes/returns'));
app.use('/api/ledger', require('./routes/ledger'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/products', require('./routes/products'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/dashboard', require('./routes/dashboard'));

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Sharp GST server running on http://localhost:${PORT}`);
});
