const express = require('express');
const router = express.Router();
const csvStore = require('../services/csvStore');

// GET /api/inventory - stock transactions
router.get('/', (req, res) => {
  try {
    let txns = req.store.getAll('inventory.csv');
    const { product_id, transaction_type, from_date, to_date } = req.query;
    if (product_id) txns = txns.filter(t => t.product_id === product_id);
    if (transaction_type) txns = txns.filter(t => t.transaction_type === transaction_type);
    if (from_date) txns = txns.filter(t => t.transaction_date >= from_date);
    if (to_date) txns = txns.filter(t => t.transaction_date <= to_date);
    txns.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));
    res.json(txns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/inventory - create stock transaction
router.post('/', (req, res) => {
  try {
    const txn = req.store.insert('inventory.csv', req.body);
    res.status(201).json(txn);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/inventory/stock-levels - current stock for all products
router.get('/stock-levels', (req, res) => {
  try {
    const products = req.store.getAll('products.csv');
    const txns = req.store.getAll('inventory.csv');

    const stockLevels = products.map(product => {
      const productTxns = txns.filter(t => t.product_id === product.id);
      const currentStock = productTxns.reduce((sum, t) => {
        const qty = Number(t.quantity) || 0;
        if (t.transaction_type === 'IN' || t.transaction_type === 'ADJUSTMENT') return sum + qty;
        return sum - qty;
      }, 0);

      let stockStatus = 'green';
      if (currentStock < 5) stockStatus = 'red';
      else if (currentStock < 20) stockStatus = 'yellow';

      return {
        ...product,
        current_stock: currentStock,
        stock_status: stockStatus,
      };
    });

    res.json(stockLevels);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/inventory/low-stock - products with stock < 5
router.get('/low-stock', (req, res) => {
  try {
    const products = req.store.getAll('products.csv');
    const txns = req.store.getAll('inventory.csv');

    const lowStock = products.map(product => {
      const productTxns = txns.filter(t => t.product_id === product.id);
      const currentStock = productTxns.reduce((sum, t) => {
        const qty = Number(t.quantity) || 0;
        if (t.transaction_type === 'IN' || t.transaction_type === 'ADJUSTMENT') return sum + qty;
        return sum - qty;
      }, 0);
      return { ...product, current_stock: currentStock };
    }).filter(p => p.current_stock < 5);

    res.json(lowStock);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
