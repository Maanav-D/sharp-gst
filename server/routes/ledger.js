const express = require('express');
const router = express.Router();
const csvStore = require('../services/csvStore');

// GET /api/ledger - list all journal entries
router.get('/', (req, res) => {
  try {
    let entries = req.store.getAll('journal_entries.csv');
    const { from_date, to_date, account_name, account_type } = req.query;
    if (from_date) entries = entries.filter(e => e.date >= from_date);
    if (to_date) entries = entries.filter(e => e.date <= to_date);
    if (account_name) entries = entries.filter(e => (e.account_name || '').toLowerCase().includes(account_name.toLowerCase()));
    if (account_type) entries = entries.filter(e => e.account_type === account_type);
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ledger - create manual journal entry
router.post('/', (req, res) => {
  try {
    const entry = req.store.insert('journal_entries.csv', req.body);
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ledger/accounts - account summary
router.get('/accounts', (req, res) => {
  try {
    const entries = req.store.getAll('journal_entries.csv');
    const accounts = {};

    entries.forEach(e => {
      const name = e.account_name;
      if (!accounts[name]) {
        accounts[name] = {
          account_name: name,
          account_type: e.account_type,
          total_debit: 0,
          total_credit: 0,
          balance: 0,
        };
      }
      accounts[name].total_debit += Number(e.debit) || 0;
      accounts[name].total_credit += Number(e.credit) || 0;
    });

    Object.values(accounts).forEach(a => {
      a.balance = a.total_debit - a.total_credit;
      a.total_debit = a.total_debit.toFixed(2);
      a.total_credit = a.total_credit.toFixed(2);
      a.balance = Number(a.balance).toFixed(2);
    });

    res.json(Object.values(accounts));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ledger/trial-balance
router.get('/trial-balance', (req, res) => {
  try {
    const entries = req.store.getAll('journal_entries.csv');
    const accounts = {};

    entries.forEach(e => {
      const name = e.account_name;
      if (!accounts[name]) {
        accounts[name] = {
          account_name: name,
          account_type: e.account_type,
          total_debit: 0,
          total_credit: 0,
        };
      }
      accounts[name].total_debit += Number(e.debit) || 0;
      accounts[name].total_credit += Number(e.credit) || 0;
    });

    const accountList = Object.values(accounts).map(a => ({
      ...a,
      total_debit: a.total_debit.toFixed(2),
      total_credit: a.total_credit.toFixed(2),
      balance: (a.total_debit - a.total_credit).toFixed(2),
    }));

    const totalDebits = accountList.reduce((s, a) => s + Number(a.total_debit), 0);
    const totalCredits = accountList.reduce((s, a) => s + Number(a.total_credit), 0);

    res.json({
      accounts: accountList,
      total_debits: totalDebits.toFixed(2),
      total_credits: totalCredits.toFixed(2),
      balanced: Math.abs(totalDebits - totalCredits) < 0.01,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
