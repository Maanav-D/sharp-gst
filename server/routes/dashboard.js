const express = require('express');
const router = express.Router();
const csvStore = require('../services/csvStore');

router.get('/', (req, res) => {
  try {
    const invoices = req.store.getAll('invoices.csv');
    const payments = req.store.getAll('payments.csv');
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    // Indian FY starts April
    const fyMonth = now.getMonth() >= 3 ? 3 : 3; // April
    const fyYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fyStart = new Date(fyYear, fyMonth, 1).toISOString().split('T')[0];

    const activeSales = invoices.filter(i => i.invoice_type !== 'PURCHASE' && i.status !== 'CANCELLED');
    const activePurchases = invoices.filter(i => i.invoice_type === 'PURCHASE' && i.status !== 'CANCELLED');

    // MTD sales
    const salesMTD = activeSales
      .filter(i => i.invoice_date >= monthStart)
      .reduce((s, i) => s + Number(i.taxable_value || 0), 0);

    // YTD sales
    const salesYTD = activeSales
      .filter(i => i.invoice_date >= fyStart)
      .reduce((s, i) => s + Number(i.taxable_value || 0), 0);

    // GST Collected MTD
    const gstCollectedMTD = activeSales
      .filter(i => i.invoice_date >= monthStart)
      .reduce((s, i) => s + Number(i.cgst || 0) + Number(i.sgst || 0) + Number(i.igst || 0), 0);

    // ITC Available MTD
    const itcAvailableMTD = activePurchases
      .filter(i => i.invoice_date >= monthStart)
      .reduce((s, i) => s + Number(i.cgst || 0) + Number(i.sgst || 0) + Number(i.igst || 0), 0);

    // Net tax liability
    const netTaxLiability = gstCollectedMTD - itcAvailableMTD;

    // Outstanding receivables
    const outstanding = activeSales.reduce((total, inv) => {
      if (inv.status === 'PAID') return total;
      const paid = payments.filter(p => p.invoice_id === inv.id).reduce((s, p) => s + Number(p.amount || 0), 0);
      return total + Number(inv.total_amount || 0) - paid;
    }, 0);

    // Invoices due in 7 days
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const todayStr = now.toISOString().split('T')[0];
    const dueSoon = activeSales.filter(i =>
      i.due_date && i.due_date >= todayStr && i.due_date <= sevenDaysLater && i.status !== 'PAID'
    );

    // Monthly sales vs purchases (last 6 months)
    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('default', { month: 'short' });

      const monthlySales = activeSales
        .filter(inv => (inv.invoice_date || '').startsWith(key))
        .reduce((s, i) => s + Number(i.taxable_value || 0), 0);

      const monthlyPurchases = activePurchases
        .filter(inv => (inv.invoice_date || '').startsWith(key))
        .reduce((s, i) => s + Number(i.taxable_value || 0), 0);

      monthlyData.push({ month: label, sales: monthlySales, purchases: monthlyPurchases });
    }

    // GST liability trend (last 6 months)
    const gstTrend = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('default', { month: 'short' });

      const salesGst = activeSales
        .filter(inv => (inv.invoice_date || '').startsWith(key))
        .reduce((s, i) => s + Number(i.cgst || 0) + Number(i.sgst || 0) + Number(i.igst || 0), 0);

      const purchaseGst = activePurchases
        .filter(inv => (inv.invoice_date || '').startsWith(key))
        .reduce((s, i) => s + Number(i.cgst || 0) + Number(i.sgst || 0) + Number(i.igst || 0), 0);

      gstTrend.push({ month: label, liability: salesGst - purchaseGst });
    }

    // Invoice status distribution
    const statusCounts = { DRAFT: 0, SENT: 0, PAID: 0, OVERDUE: 0, CANCELLED: 0 };
    invoices.forEach(i => {
      if (statusCounts.hasOwnProperty(i.status)) statusCounts[i.status]++;
    });

    // Filing alerts
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const gstr1Due = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 11);
    const gstr3bDue = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 20);
    const gstr1Days = Math.ceil((gstr1Due - now) / (1000 * 60 * 60 * 24));
    const gstr3bDays = Math.ceil((gstr3bDue - now) / (1000 * 60 * 60 * 24));

    // Low stock alerts
    const products = req.store.getAll('products.csv');
    const inventoryTxns = req.store.getAll('inventory.csv');
    const lowStock = products.map(product => {
      const txns = inventoryTxns.filter(t => t.product_id === product.id);
      const stock = txns.reduce((sum, t) => {
        const qty = Number(t.quantity) || 0;
        return t.transaction_type === 'IN' || t.transaction_type === 'ADJUSTMENT' ? sum + qty : sum - qty;
      }, 0);
      return { ...product, current_stock: stock };
    }).filter(p => p.current_stock < 5);

    res.json({
      metrics: {
        salesMTD: salesMTD.toFixed(2),
        salesYTD: salesYTD.toFixed(2),
        gstCollectedMTD: gstCollectedMTD.toFixed(2),
        itcAvailableMTD: itcAvailableMTD.toFixed(2),
        netTaxLiability: netTaxLiability.toFixed(2),
        outstanding: outstanding.toFixed(2),
        dueSoonCount: dueSoon.length,
        dueSoonAmount: dueSoon.reduce((s, i) => s + Number(i.total_amount || 0), 0).toFixed(2),
      },
      charts: {
        monthlyData,
        gstTrend,
        statusDistribution: statusCounts,
      },
      filingAlerts: {
        gstr1: { dueDate: gstr1Due.toISOString().split('T')[0], daysRemaining: gstr1Days },
        gstr3b: { dueDate: gstr3bDue.toISOString().split('T')[0], daysRemaining: gstr3bDays },
      },
      lowStock,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
