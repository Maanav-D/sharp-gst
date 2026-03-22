const express = require('express');
const router = express.Router();

// GET /api/reports/sales-register
router.get('/sales-register', (req, res) => {
  try {
    let invoices = req.store.getAll('invoices.csv').filter(i => i.invoice_type !== 'PURCHASE');
    const { from_date, to_date } = req.query;
    if (from_date) invoices = invoices.filter(i => i.invoice_date >= from_date);
    if (to_date) invoices = invoices.filter(i => i.invoice_date <= to_date);
    invoices.sort((a, b) => new Date(a.invoice_date) - new Date(b.invoice_date));

    const payments = req.store.getAll('payments.csv');
    const data = invoices.map(inv => {
      const paid = payments.filter(p => p.invoice_id === inv.id).reduce((s, p) => s + Number(p.amount || 0), 0);
      return { ...inv, paid_amount: paid.toFixed(2), outstanding: (Number(inv.total_amount) - paid).toFixed(2) };
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/purchase-register
router.get('/purchase-register', (req, res) => {
  try {
    let invoices = req.store.getAll('invoices.csv').filter(i => i.invoice_type === 'PURCHASE');
    const { from_date, to_date } = req.query;
    if (from_date) invoices = invoices.filter(i => i.invoice_date >= from_date);
    if (to_date) invoices = invoices.filter(i => i.invoice_date <= to_date);
    invoices.sort((a, b) => new Date(a.invoice_date) - new Date(b.invoice_date));
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/hsn-summary
router.get('/hsn-summary', (req, res) => {
  try {
    const { from_date, to_date } = req.query;
    let invoices = req.store.getAll('invoices.csv').filter(i => i.invoice_type !== 'PURCHASE' && i.status !== 'CANCELLED');
    if (from_date) invoices = invoices.filter(i => i.invoice_date >= from_date);
    if (to_date) invoices = invoices.filter(i => i.invoice_date <= to_date);

    const invoiceIds = new Set(invoices.map(i => i.id));
    const lineItems = req.store.getAll('line_items.csv').filter(li => invoiceIds.has(li.invoice_id));

    const hsnMap = {};
    lineItems.forEach(item => {
      const hsn = item.hsn_sac || 'UNKNOWN';
      if (!hsnMap[hsn]) {
        hsnMap[hsn] = { hsn_sac: hsn, description: item.description, total_quantity: 0, taxable_value: 0, cgst: 0, sgst: 0, igst: 0 };
      }
      hsnMap[hsn].total_quantity += Number(item.quantity) || 0;
      hsnMap[hsn].taxable_value += Number(item.taxable_value) || 0;
      hsnMap[hsn].cgst += Number(item.cgst_amount) || 0;
      hsnMap[hsn].sgst += Number(item.sgst_amount) || 0;
      hsnMap[hsn].igst += Number(item.igst_amount) || 0;
    });

    const summary = Object.values(hsnMap).map(h => ({
      ...h,
      taxable_value: h.taxable_value.toFixed(2),
      cgst: h.cgst.toFixed(2),
      sgst: h.sgst.toFixed(2),
      igst: h.igst.toFixed(2),
      total: (h.taxable_value + h.cgst + h.sgst + h.igst).toFixed(2),
    }));

    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/customer-outstanding
router.get('/customer-outstanding', (req, res) => {
  try {
    const invoices = req.store.getAll('invoices.csv').filter(i => i.invoice_type !== 'PURCHASE' && i.status !== 'CANCELLED');
    const payments = req.store.getAll('payments.csv');

    const custMap = {};
    invoices.forEach(inv => {
      const name = inv.buyer_name || 'Unknown';
      if (!custMap[name]) {
        custMap[name] = { customer_name: name, gstin: inv.buyer_gstin, total_invoiced: 0, total_paid: 0 };
      }
      custMap[name].total_invoiced += Number(inv.total_amount) || 0;
      const paid = payments.filter(p => p.invoice_id === inv.id).reduce((s, p) => s + Number(p.amount || 0), 0);
      custMap[name].total_paid += paid;
    });

    const result = Object.values(custMap).map(c => ({
      ...c,
      total_invoiced: c.total_invoiced.toFixed(2),
      total_paid: c.total_paid.toFixed(2),
      outstanding: (c.total_invoiced - c.total_paid).toFixed(2),
    })).sort((a, b) => Number(b.outstanding) - Number(a.outstanding));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/cash-flow
router.get('/cash-flow', (req, res) => {
  try {
    const invoices = req.store.getAll('invoices.csv').filter(i => i.status !== 'CANCELLED');
    const payments = req.store.getAll('payments.csv');

    // Monthly aggregation (last 6 months)
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({
        month: key,
        label: d.toLocaleString('default', { month: 'short', year: 'numeric' }),
        invoiced: 0,
        received: 0,
      });
    }

    invoices.forEach(inv => {
      const key = inv.invoice_date ? inv.invoice_date.substring(0, 7) : '';
      const m = months.find(mo => mo.month === key);
      if (m) m.invoiced += Number(inv.total_amount) || 0;
    });

    payments.forEach(p => {
      const key = p.payment_date ? p.payment_date.substring(0, 7) : '';
      const m = months.find(mo => mo.month === key);
      if (m) m.received += Number(p.amount) || 0;
    });

    months.forEach(m => {
      m.invoiced = m.invoiced.toFixed(2);
      m.received = m.received.toFixed(2);
    });

    res.json(months);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/tax-liability
router.get('/tax-liability', (req, res) => {
  try {
    const invoices = req.store.getAll('invoices.csv').filter(i => i.status !== 'CANCELLED');
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({
        month: key,
        label: d.toLocaleString('default', { month: 'short', year: 'numeric' }),
        cgst_payable: 0, sgst_payable: 0, igst_payable: 0,
        itc_cgst: 0, itc_sgst: 0, itc_igst: 0,
      });
    }

    invoices.forEach(inv => {
      const key = inv.invoice_date ? inv.invoice_date.substring(0, 7) : '';
      const m = months.find(mo => mo.month === key);
      if (!m) return;
      if (inv.invoice_type === 'PURCHASE') {
        m.itc_cgst += Number(inv.cgst) || 0;
        m.itc_sgst += Number(inv.sgst) || 0;
        m.itc_igst += Number(inv.igst) || 0;
      } else {
        m.cgst_payable += Number(inv.cgst) || 0;
        m.sgst_payable += Number(inv.sgst) || 0;
        m.igst_payable += Number(inv.igst) || 0;
      }
    });

    months.forEach(m => {
      m.total_output = m.cgst_payable + m.sgst_payable + m.igst_payable;
      m.total_itc = m.itc_cgst + m.itc_sgst + m.itc_igst;
      m.net_payable = m.total_output - m.total_itc;
      // Format
      Object.keys(m).forEach(k => {
        if (typeof m[k] === 'number') m[k] = m[k].toFixed(2);
      });
    });

    res.json(months);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
