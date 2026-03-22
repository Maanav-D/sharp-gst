const express = require('express');
const router = express.Router();
const multer = require('multer');
const { getSupplyType, calculateInvoiceTotals, isValidGstRate } = require('../services/gstCalc');
const { generateInvoicePDF } = require('../services/pdfService');
const { parseInvoicePDF } = require('../services/invoiceParser');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/invoices - list all invoices
router.get('/', (req, res) => {
  try {
    let invoices = req.store.getAll('invoices.csv');
    const { status, invoice_type, buyer_name, buyer_gstin, from_date, to_date } = req.query;
    if (status) invoices = invoices.filter(i => i.status === status);
    if (invoice_type) invoices = invoices.filter(i => i.invoice_type === invoice_type);
    if (buyer_name) invoices = invoices.filter(i => (i.buyer_name || '').toLowerCase().includes(buyer_name.toLowerCase()));
    if (buyer_gstin) invoices = invoices.filter(i => (i.buyer_gstin || '').includes(buyer_gstin));
    if (from_date) invoices = invoices.filter(i => i.invoice_date >= from_date);
    if (to_date) invoices = invoices.filter(i => i.invoice_date <= to_date);
    invoices.sort((a, b) => new Date(b.invoice_date) - new Date(a.invoice_date));
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/invoices/parse-pdf - extract invoice data from uploaded PDF
router.post('/parse-pdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }
    const parsed = await parseInvoicePDF(req.file.buffer);
    // Try to match buyer GSTIN to existing customer
    if (parsed.buyer_gstin) {
      const customers = req.store.getAll('customers.csv');
      const match = customers.find(c => c.gstin === parsed.buyer_gstin);
      if (match) {
        parsed.customer_id = match.id;
        if (!parsed.buyer_name) parsed.buyer_name = match.name;
        if (!parsed.buyer_address) parsed.buyer_address = match.address;
        if (!parsed.buyer_state_code) parsed.buyer_state_code = match.state_code;
      }
    }
    // Try to match line item HSN codes to products for richer data
    const products = req.store.getAll('products.csv');
    parsed.line_items = parsed.line_items.map(item => {
      const product = products.find(p => p.hsn_sac === item.hsn_sac);
      if (product) {
        if (!item.description || item.description.length < 3) item.description = product.name;
        if (!item.unit_price) item.unit_price = Number(product.default_price) || 0;
        if (!item.gst_rate) item.gst_rate = Number(product.gst_rate) || 0;
        item.unit = product.unit || item.unit;
      }
      return item;
    });
    // Remove raw_text from response (too large)
    delete parsed.raw_text;
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: 'Failed to parse PDF: ' + err.message });
  }
});

// GET /api/invoices/:id - get single invoice with line items
router.get('/:id', (req, res) => {
  try {
    const invoice = req.store.getById('invoices.csv', req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    const lineItems = req.store.query('line_items.csv', r => r.invoice_id === req.params.id);
    res.json({ ...invoice, line_items: lineItems });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/invoices - create invoice with line items
router.post('/', (req, res) => {
  try {
    const { line_items, ...invoiceData } = req.body;

    // Load settings for seller info
    const settings = req.store.getSettings();

    // Auto-generate invoice number if not provided
    if (!invoiceData.invoice_number) {
      const existing = req.store.getAll('invoices.csv');
      const now = new Date();
      const prefix = settings.invoice_prefix || 'INV';
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const count = existing.filter(i => i.invoice_number && i.invoice_number.startsWith(`${prefix}-${year}-${month}`)).length + 1;
      invoiceData.invoice_number = `${prefix}-${year}-${month}-${String(count).padStart(3, '0')}`;
    }

    // Fill seller info from settings
    if (!invoiceData.seller_gstin) invoiceData.seller_gstin = settings.gstin;
    if (!invoiceData.seller_name) invoiceData.seller_name = settings.business_name;
    if (!invoiceData.seller_address) invoiceData.seller_address = settings.address;
    if (!invoiceData.seller_state_code) invoiceData.seller_state_code = settings.state_code;

    // Determine supply type
    const supplyType = getSupplyType(
      invoiceData.seller_state_code,
      invoiceData.buyer_state_code,
      invoiceData.place_of_supply
    );

    // Validate GST rates
    if (line_items) {
      for (const item of line_items) {
        if (!isValidGstRate(item.gst_rate)) {
          return res.status(400).json({ error: `Invalid GST rate: ${item.gst_rate}` });
        }
      }
    }

    // Calculate totals
    const calc = calculateInvoiceTotals(line_items || [], supplyType);

    // Save invoice
    const invoice = req.store.insert('invoices.csv', {
      ...invoiceData,
      taxable_value: calc.taxable_value,
      cgst: calc.cgst,
      sgst: calc.sgst,
      igst: calc.igst,
      total_amount: calc.total_amount,
      status: invoiceData.status || 'DRAFT',
    });

    // Save line items
    const savedItems = [];
    if (line_items && line_items.length > 0) {
      for (const item of calc.lineItems) {
        const saved = req.store.insert('line_items.csv', {
          invoice_id: invoice.id,
          hsn_sac: item.hsn_sac || '',
          description: item.description || '',
          quantity: item.quantity || '0',
          unit: item.unit || '',
          unit_price: item.unit_price || '0',
          discount_pct: item.discount_pct || '0',
          taxable_value: item.taxable_value,
          gst_rate: item.gst_rate || '0',
          cgst_amount: item.cgst_amount,
          sgst_amount: item.sgst_amount,
          igst_amount: item.igst_amount,
          total_amount: item.total_amount,
        });
        savedItems.push(saved);
      }
    }

    // Auto-create inventory transactions for SENT sales invoices
    if (invoice.status === 'SENT' && invoice.invoice_type !== 'PURCHASE') {
      createInventoryTransactions(req.store, invoice, savedItems, 'OUT');
    }
    // Auto-create inventory transactions for purchase invoices
    if (invoice.invoice_type === 'PURCHASE') {
      createInventoryTransactions(req.store, invoice, savedItems, 'IN');
    }

    res.status(201).json({ ...invoice, line_items: savedItems });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function createInventoryTransactions(store, invoice, lineItems, txnType) {
  const products = store.getAll('products.csv');
  lineItems.forEach(item => {
    const product = products.find(p => p.hsn_sac === item.hsn_sac || p.name === item.description);
    if (product) {
      const inventory = store.getAll('inventory.csv').filter(i => i.product_id === product.id);
      const currentStock = inventory.reduce((sum, i) => {
        if (i.transaction_type === 'IN' || i.transaction_type === 'ADJUSTMENT') return sum + Number(i.quantity);
        return sum - Number(i.quantity);
      }, 0);
      const qty = Number(item.quantity) || 0;
      const stockAfter = txnType === 'IN' ? currentStock + qty : currentStock - qty;

      store.insert('inventory.csv', {
        product_id: product.id,
        transaction_type: txnType,
        quantity: String(qty),
        reference_id: invoice.id,
        reference_type: 'INVOICE',
        notes: `${txnType === 'IN' ? 'Purchase' : 'Sale'} - ${invoice.invoice_number}`,
        stock_after: String(stockAfter),
        transaction_date: invoice.invoice_date,
      });
    }
  });
}

// PUT /api/invoices/:id - update invoice
router.put('/:id', (req, res) => {
  try {
    const existing = req.store.getById('invoices.csv', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Invoice not found' });

    const { line_items, ...updates } = req.body;
    const updated = req.store.update('invoices.csv', req.params.id, updates);

    // If marking as PAID, create journal entries
    if (updates.status === 'PAID' && existing.status !== 'PAID') {
      createJournalEntries(req.store, updated);
    }

    // If marking as SENT (and wasn't before), create inventory OUT transactions
    if (updates.status === 'SENT' && existing.status !== 'SENT' && existing.invoice_type !== 'PURCHASE') {
      const items = req.store.query('line_items.csv', r => r.invoice_id === req.params.id);
      createInventoryTransactions(req.store, updated, items, 'OUT');
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function createJournalEntries(store, invoice) {
  const totalAmount = Number(invoice.total_amount) || 0;
  const taxableValue = Number(invoice.taxable_value) || 0;
  const totalTax = (Number(invoice.cgst) || 0) + (Number(invoice.sgst) || 0) + (Number(invoice.igst) || 0);

  const isPurchase = invoice.invoice_type === 'PURCHASE';
  const date = invoice.invoice_date || new Date().toISOString().split('T')[0];

  if (isPurchase) {
    // DR: Purchase (expense)
    store.insert('journal_entries.csv', {
      date,
      account_name: 'Purchases',
      account_type: 'EXPENSE',
      debit: taxableValue.toFixed(2),
      credit: '0.00',
      narration: `Purchase - ${invoice.invoice_number}`,
      reference_id: invoice.id,
      reference_type: 'INVOICE',
    });
    // DR: Input GST (asset)
    store.insert('journal_entries.csv', {
      date,
      account_name: 'Input GST (ITC)',
      account_type: 'ASSET',
      debit: totalTax.toFixed(2),
      credit: '0.00',
      narration: `ITC on ${invoice.invoice_number}`,
      reference_id: invoice.id,
      reference_type: 'INVOICE',
    });
    // CR: Bank/Cash (asset)
    store.insert('journal_entries.csv', {
      date,
      account_name: 'Bank',
      account_type: 'ASSET',
      debit: '0.00',
      credit: totalAmount.toFixed(2),
      narration: `Payment for ${invoice.invoice_number}`,
      reference_id: invoice.id,
      reference_type: 'INVOICE',
    });
  } else {
    // DR: Bank/Cash (asset)
    store.insert('journal_entries.csv', {
      date,
      account_name: 'Bank',
      account_type: 'ASSET',
      debit: totalAmount.toFixed(2),
      credit: '0.00',
      narration: `Received for ${invoice.invoice_number}`,
      reference_id: invoice.id,
      reference_type: 'INVOICE',
    });
    // CR: Sales (income)
    store.insert('journal_entries.csv', {
      date,
      account_name: invoice.sales_account || 'Sales',
      account_type: 'INCOME',
      debit: '0.00',
      credit: taxableValue.toFixed(2),
      narration: `Sale - ${invoice.invoice_number}`,
      reference_id: invoice.id,
      reference_type: 'INVOICE',
    });
    // CR: GST Payable (liability)
    store.insert('journal_entries.csv', {
      date,
      account_name: 'GST Payable',
      account_type: 'LIABILITY',
      debit: '0.00',
      credit: totalTax.toFixed(2),
      narration: `GST on ${invoice.invoice_number}`,
      reference_id: invoice.id,
      reference_type: 'INVOICE',
    });
  }
}

// DELETE /api/invoices/:id - soft delete
router.delete('/:id', (req, res) => {
  try {
    const deleted = req.store.softDelete('invoices.csv', req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ message: 'Invoice deleted', invoice: deleted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/invoices/:id/cancel - cancel invoice
router.post('/:id/cancel', (req, res) => {
  try {
    const updated = req.store.update('invoices.csv', req.params.id, { status: 'CANCELLED' });
    if (!updated) return res.status(404).json({ error: 'Invoice not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/invoices/:id/pdf - generate and download PDF
router.get('/:id/pdf', (req, res) => {
  try {
    const invoice = req.store.getById('invoices.csv', req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    const lineItems = req.store.query('line_items.csv', r => r.invoice_id === req.params.id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_number}.pdf"`);
    generateInvoicePDF(invoice, lineItems, res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/invoices/bulk-action - bulk status update
router.post('/bulk-action', (req, res) => {
  try {
    const { ids, action } = req.body;
    const results = [];
    ids.forEach(id => {
      const invoice = req.store.getById('invoices.csv', id);
      if (invoice) {
        const updated = req.store.update('invoices.csv', id, { status: action });
        if (action === 'PAID' && invoice.status !== 'PAID') {
          createJournalEntries(req.store, updated);
        }
        results.push(updated);
      }
    });
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
