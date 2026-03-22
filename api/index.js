const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const companyScope = require('../server/middleware/companyScope');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

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

module.exports = app;
