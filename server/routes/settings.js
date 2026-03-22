const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  try {
    const settings = req.store.getSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/', (req, res) => {
  try {
    const current = req.store.getSettings();
    const updated = { ...current, ...req.body };
    req.store.saveSettings(updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
