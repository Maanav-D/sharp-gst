/**
 * Build GSTR-1 data for a given month/year
 */
function buildGSTR1(store, month, year) {
  const invoices = store.getAll('invoices.csv');
  const lineItems = store.getAll('line_items.csv');

  // Filter sales invoices for the month
  const salesInvoices = invoices.filter(inv => {
    if (inv.invoice_type === 'PURCHASE') return false;
    if (inv.status === 'CANCELLED') return false;
    const d = new Date(inv.invoice_date);
    return d.getMonth() + 1 === Number(month) && d.getFullYear() === Number(year);
  });

  // Classify
  const b2b = []; // Buyer has GSTIN
  const b2cLarge = []; // Inter-state, no GSTIN, taxable > 2.5L
  const b2cSmall = []; // Everything else
  const creditDebitNotes = []; // CREDIT NOTE or DEBIT NOTE types

  salesInvoices.forEach(inv => {
    if (inv.invoice_type === 'CREDIT NOTE' || inv.invoice_type === 'DEBIT NOTE') {
      creditDebitNotes.push(inv);
    } else if (inv.buyer_gstin && inv.buyer_gstin.trim().length > 0) {
      b2b.push(inv);
    } else {
      const isInterState = inv.seller_state_code !== (inv.place_of_supply || inv.buyer_state_code);
      const taxableValue = Number(inv.taxable_value) || 0;
      if (isInterState && taxableValue > 250000) {
        b2cLarge.push(inv);
      } else {
        b2cSmall.push(inv);
      }
    }
  });

  // Aggregate B2B by buyer GSTIN
  const b2bSummary = {};
  b2b.forEach(inv => {
    const key = inv.buyer_gstin;
    if (!b2bSummary[key]) {
      b2bSummary[key] = {
        buyer_gstin: inv.buyer_gstin,
        buyer_name: inv.buyer_name,
        invoice_count: 0,
        taxable_value: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        total: 0,
      };
    }
    b2bSummary[key].invoice_count++;
    b2bSummary[key].taxable_value += Number(inv.taxable_value) || 0;
    b2bSummary[key].cgst += Number(inv.cgst) || 0;
    b2bSummary[key].sgst += Number(inv.sgst) || 0;
    b2bSummary[key].igst += Number(inv.igst) || 0;
    b2bSummary[key].total += Number(inv.total_amount) || 0;
  });

  return {
    period: `${month}/${year}`,
    b2b: Object.values(b2bSummary),
    b2cLarge,
    b2cSmall,
    creditDebitNotes,
    totalInvoices: salesInvoices.length,
  };
}

/**
 * Build GSTR-3B summary for a given month/year
 */
function buildGSTR3B(store, month, year) {
  const invoices = store.getAll('invoices.csv');

  const filterByMonth = (inv) => {
    const d = new Date(inv.invoice_date);
    return d.getMonth() + 1 === Number(month) && d.getFullYear() === Number(year) && inv.status !== 'CANCELLED';
  };

  const sales = invoices.filter(inv => inv.invoice_type !== 'PURCHASE' && filterByMonth(inv));
  const purchases = invoices.filter(inv => inv.invoice_type === 'PURCHASE' && filterByMonth(inv));

  // 3.1 Outward taxable supplies
  const outward = {
    taxable_value: 0, cgst: 0, sgst: 0, igst: 0,
  };
  sales.forEach(inv => {
    outward.taxable_value += Number(inv.taxable_value) || 0;
    outward.cgst += Number(inv.cgst) || 0;
    outward.sgst += Number(inv.sgst) || 0;
    outward.igst += Number(inv.igst) || 0;
  });

  // 3.2 Interstate supplies to unregistered
  const interstateUnregistered = {
    taxable_value: 0, igst: 0,
  };
  sales.forEach(inv => {
    const isInterState = inv.seller_state_code !== (inv.place_of_supply || inv.buyer_state_code);
    const hasGstin = inv.buyer_gstin && inv.buyer_gstin.trim().length > 0;
    if (isInterState && !hasGstin) {
      interstateUnregistered.taxable_value += Number(inv.taxable_value) || 0;
      interstateUnregistered.igst += Number(inv.igst) || 0;
    }
  });

  // 4. ITC Available
  const itc = { cgst: 0, sgst: 0, igst: 0 };
  purchases.forEach(inv => {
    itc.cgst += Number(inv.cgst) || 0;
    itc.sgst += Number(inv.sgst) || 0;
    itc.igst += Number(inv.igst) || 0;
  });

  // 5. Net tax payable
  const netPayable = {
    cgst: Math.max(0, outward.cgst - itc.cgst),
    sgst: Math.max(0, outward.sgst - itc.sgst),
    igst: Math.max(0, outward.igst - itc.igst),
  };
  netPayable.total = netPayable.cgst + netPayable.sgst + netPayable.igst;

  const totalOutput = outward.cgst + outward.sgst + outward.igst;
  const totalItc = itc.cgst + itc.sgst + itc.igst;

  return {
    period: `${month}/${year}`,
    section3_1: outward,
    section3_2: interstateUnregistered,
    section4_itc: itc,
    section5_net: netPayable,
    summary: {
      total_output_tax: totalOutput,
      total_itc: totalItc,
      net_payable: totalOutput - totalItc,
      is_refundable: totalOutput - totalItc < 0,
    },
  };
}

/**
 * ITC Reconciliation: compare books vs uploaded GSTR-2B data
 */
function reconcileITC(store, uploaded2BData) {
  const purchases = store.getAll('invoices.csv').filter(inv => inv.invoice_type === 'PURCHASE');

  const matched = [];
  const onlyInBooks = [];
  const onlyIn2B = [];

  const booksMap = {};
  purchases.forEach(inv => {
    const key = `${inv.seller_gstin || inv.buyer_gstin}_${inv.invoice_number}`;
    booksMap[key] = inv;
  });

  const twoBMap = {};
  uploaded2BData.forEach(row => {
    const key = `${row.supplier_gstin}_${row.invoice_number}`;
    twoBMap[key] = row;
  });

  // Find matches and only-in-books
  Object.keys(booksMap).forEach(key => {
    if (twoBMap[key]) {
      matched.push({
        key,
        books: booksMap[key],
        gstr2b: twoBMap[key],
      });
    } else {
      onlyInBooks.push(booksMap[key]);
    }
  });

  // Find only-in-2B
  Object.keys(twoBMap).forEach(key => {
    if (!booksMap[key]) {
      onlyIn2B.push(twoBMap[key]);
    }
  });

  const booksTotal = purchases.reduce((sum, inv) =>
    sum + Number(inv.cgst || 0) + Number(inv.sgst || 0) + Number(inv.igst || 0), 0);
  const twoBTotal = uploaded2BData.reduce((sum, row) =>
    sum + Number(row.cgst || 0) + Number(row.sgst || 0) + Number(row.igst || 0), 0);
  const matchedTotal = matched.reduce((sum, m) =>
    sum + Number(m.books.cgst || 0) + Number(m.books.sgst || 0) + Number(m.books.igst || 0), 0);

  return {
    matched,
    onlyInBooks,
    onlyIn2B,
    summary: {
      total_itc_books: booksTotal,
      total_itc_2b: twoBTotal,
      matched_itc: matchedTotal,
      variance: booksTotal - twoBTotal,
    },
  };
}

module.exports = { buildGSTR1, buildGSTR3B, reconcileITC };
