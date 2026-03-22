const express = require('express');
const router = express.Router();
const csvStore = require('../services/csvStore');

const CSV_HEADERS = {
  'invoices.csv': ['id', 'invoice_number', 'invoice_type', 'invoice_date', 'due_date', 'seller_gstin', 'seller_name', 'seller_address', 'seller_state_code', 'buyer_gstin', 'buyer_name', 'buyer_address', 'buyer_state_code', 'place_of_supply', 'taxable_value', 'cgst', 'sgst', 'igst', 'total_amount', 'status', 'irn', 'notes', 'created_at', 'updated_at', 'deleted_at'],
  'line_items.csv': ['id', 'invoice_id', 'hsn_sac', 'description', 'quantity', 'unit', 'unit_price', 'discount_pct', 'taxable_value', 'gst_rate', 'cgst_amount', 'sgst_amount', 'igst_amount', 'total_amount'],
  'customers.csv': ['id', 'name', 'gstin', 'email', 'phone', 'address', 'state_code', 'gstin_type', 'created_at', 'updated_at', 'deleted_at'],
  'products.csv': ['id', 'name', 'hsn_sac', 'description', 'unit', 'default_price', 'gst_rate', 'created_at', 'updated_at', 'deleted_at'],
  'inventory.csv': ['id', 'product_id', 'transaction_type', 'quantity', 'reference_id', 'reference_type', 'notes', 'stock_after', 'transaction_date', 'created_at', 'updated_at', 'deleted_at'],
  'journal_entries.csv': ['id', 'date', 'account_name', 'account_type', 'debit', 'credit', 'narration', 'reference_id', 'reference_type', 'created_at', 'updated_at', 'deleted_at'],
  'payments.csv': ['id', 'invoice_id', 'amount', 'payment_date', 'payment_mode', 'reference_number', 'notes', 'created_at', 'updated_at', 'deleted_at'],
};

router.get('/', (req, res) => {
  try {
    const companies = csvStore.getAll('companies.csv');
    res.json(companies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const company = csvStore.getById('companies.csv', req.params.id);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    res.json(company);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { business_name, gstin, address, state, state_code, email, phone, invoice_prefix, fiscal_year_start } = req.body;

    const company = csvStore.insert('companies.csv', {
      business_name: business_name || '',
      gstin: gstin || '',
      address: address || '',
      state: state || '',
      state_code: state_code || '',
      email: email || '',
      phone: phone || '',
    });

    // Initialize company directory with CSV files and settings
    const companyStore = csvStore.scoped(company.id);

    companyStore.saveSettings({
      business_name: business_name || '',
      gstin: gstin || '',
      address: address || '',
      state: state || '',
      state_code: state_code || '',
      email: email || '',
      phone: phone || '',
      invoice_prefix: invoice_prefix || 'INV',
      fiscal_year_start: fiscal_year_start || '04',
    });

    Object.entries(CSV_HEADERS).forEach(([file, headers]) => {
      companyStore.initWithHeaders(file, headers);
    });

    res.status(201).json(company);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const updated = csvStore.update('companies.csv', req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Company not found' });

    // Sync settings.json
    const companyStore = csvStore.scoped(req.params.id);
    const currentSettings = companyStore.getSettings();
    const settingsFields = ['business_name', 'gstin', 'address', 'state', 'state_code', 'email', 'phone', 'invoice_prefix', 'fiscal_year_start'];
    const settingsUpdates = {};
    settingsFields.forEach(f => { if (req.body[f] !== undefined) settingsUpdates[f] = req.body[f]; });
    if (Object.keys(settingsUpdates).length > 0) {
      companyStore.saveSettings({ ...currentSettings, ...settingsUpdates });
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const deleted = csvStore.softDelete('companies.csv', req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Company not found' });
    res.json({ message: 'Company deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
