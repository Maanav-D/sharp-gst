const express = require('express');
const router = express.Router();
const multer = require('multer');
const Papa = require('papaparse');
const fs = require('fs');
const { buildGSTR1, buildGSTR3B, reconcileITC } = require('../services/returnBuilder');

const upload = multer({ dest: '/tmp/gst-uploads/' });

// GET /api/returns/gstr1?month=1&year=2026
router.get('/gstr1', (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ error: 'month and year required' });
    const data = buildGSTR1(req.store, month, year);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/returns/gstr3b?month=1&year=2026
router.get('/gstr3b', (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ error: 'month and year required' });
    const data = buildGSTR3B(req.store, month, year);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/returns/reconcile - upload GSTR-2B CSV for ITC reconciliation
router.post('/reconcile', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'CSV file required' });
    const content = fs.readFileSync(req.file.path, 'utf8');
    const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
    fs.unlinkSync(req.file.path); // cleanup

    const data = reconcileITC(req.store, parsed.data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/returns/gstr1/export?month=1&year=2026 - GSTN-compatible JSON
router.get('/gstr1/export', (req, res) => {
  try {
    const { month, year } = req.query;
    const data = buildGSTR1(req.store, month, year);

    // Build GSTN-compatible structure
    const gstnJson = {
      gstin: '',
      fp: `${String(month).padStart(2, '0')}${year}`,
      b2b: data.b2b.map(b => ({
        ctin: b.buyer_gstin,
        inv: [{
          inum: `INV-${b.buyer_gstin}`,
          idt: '',
          val: b.total,
          itms: [{
            num: 1,
            itm_det: {
              txval: b.taxable_value,
              camt: b.cgst,
              samt: b.sgst,
              iamt: b.igst,
            }
          }]
        }]
      })),
      b2cl: data.b2cLarge.map(inv => ({
        pos: inv.place_of_supply || inv.buyer_state_code,
        inv: [{
          inum: inv.invoice_number,
          idt: inv.invoice_date,
          val: Number(inv.total_amount),
          itms: [{
            num: 1,
            itm_det: {
              txval: Number(inv.taxable_value),
              iamt: Number(inv.igst),
            }
          }]
        }]
      })),
    };

    res.json(gstnJson);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
