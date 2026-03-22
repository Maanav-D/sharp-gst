const express = require('express');
const router = express.Router();
const csvStore = require('../services/csvStore');

// GET /api/hsn - search HSN codes
router.get('/', (req, res) => {
  try {
    const { q, category } = req.query;
    let codes = csvStore.getAllIncludeDeleted('hsn_master.csv');
    if (q) {
      const query = q.toLowerCase();
      codes = codes.filter(c =>
        (c.hsn_code || '').toLowerCase().includes(query) ||
        (c.description || '').toLowerCase().includes(query)
      );
    }
    if (category) {
      codes = codes.filter(c => c.category === category);
    }
    res.json(codes.slice(0, 50)); // limit results for typeahead
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
