const express = require('express');
const router = express.Router();
const csvStore = require('../services/csvStore');

router.get('/', (req, res) => {
  try {
    let payments = req.store.getAll('payments.csv');
    const { invoice_id } = req.query;
    if (invoice_id) payments = payments.filter(p => p.invoice_id === invoice_id);
    payments.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const payment = req.store.insert('payments.csv', req.body);

    // Check if invoice is fully paid
    if (payment.invoice_id) {
      const invoice = req.store.getById('invoices.csv', payment.invoice_id);
      if (invoice) {
        const allPayments = req.store.query('payments.csv', p => p.invoice_id === payment.invoice_id);
        const totalPaid = allPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
        if (totalPaid >= Number(invoice.total_amount)) {
          req.store.update('invoices.csv', invoice.id, { status: 'PAID' });
        }
      }
    }

    res.status(201).json(payment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
