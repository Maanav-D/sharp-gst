const express = require('express');
const router = express.Router();
const csvStore = require('../services/csvStore');

router.get('/', (req, res) => {
  try {
    const { q } = req.query;
    let customers = req.store.getAll('customers.csv');
    if (q) {
      const query = q.toLowerCase();
      customers = customers.filter(c =>
        (c.name || '').toLowerCase().includes(query) ||
        (c.gstin || '').toLowerCase().includes(query)
      );
    }
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const customer = req.store.getById('customers.csv', req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const customer = req.store.insert('customers.csv', req.body);
    res.status(201).json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const updated = req.store.update('customers.csv', req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Customer not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const deleted = req.store.softDelete('customers.csv', req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Customer not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
