const VALID_GST_RATES = [0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28];

function round2(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function isValidGstRate(rate) {
  return VALID_GST_RATES.includes(Number(rate));
}

/**
 * Determine supply type based on state codes
 * @returns 'INTRA' | 'INTER'
 */
function getSupplyType(sellerStateCode, buyerStateCode, placeOfSupply) {
  const effectiveState = placeOfSupply || buyerStateCode;
  if (String(sellerStateCode) === String(effectiveState)) {
    return 'INTRA';
  }
  return 'INTER';
}

/**
 * Calculate GST for a single line item
 */
function calculateLineItem(item, supplyType) {
  const qty = Number(item.quantity) || 0;
  const unitPrice = Number(item.unit_price) || 0;
  const discountPct = Number(item.discount_pct) || 0;
  const gstRate = Number(item.gst_rate) || 0;

  const taxableValue = round2(qty * unitPrice * (1 - discountPct / 100));

  let cgst_amount = 0;
  let sgst_amount = 0;
  let igst_amount = 0;

  if (supplyType === 'INTRA') {
    cgst_amount = round2(taxableValue * (gstRate / 2) / 100);
    sgst_amount = round2(taxableValue * (gstRate / 2) / 100);
    igst_amount = 0;
  } else {
    cgst_amount = 0;
    sgst_amount = 0;
    igst_amount = round2(taxableValue * gstRate / 100);
  }

  const total_amount = round2(taxableValue + cgst_amount + sgst_amount + igst_amount);

  return {
    taxable_value: taxableValue.toFixed(2),
    cgst_amount: cgst_amount.toFixed(2),
    sgst_amount: sgst_amount.toFixed(2),
    igst_amount: igst_amount.toFixed(2),
    total_amount: total_amount.toFixed(2),
  };
}

/**
 * Calculate totals for an entire invoice (array of line items)
 */
function calculateInvoiceTotals(lineItems, supplyType) {
  let totalTaxable = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;

  const computed = lineItems.map(item => {
    const result = calculateLineItem(item, supplyType);
    totalTaxable += Number(result.taxable_value);
    totalCgst += Number(result.cgst_amount);
    totalSgst += Number(result.sgst_amount);
    totalIgst += Number(result.igst_amount);
    return { ...item, ...result };
  });

  return {
    lineItems: computed,
    taxable_value: round2(totalTaxable).toFixed(2),
    cgst: round2(totalCgst).toFixed(2),
    sgst: round2(totalSgst).toFixed(2),
    igst: round2(totalIgst).toFixed(2),
    total_amount: round2(totalTaxable + totalCgst + totalSgst + totalIgst).toFixed(2),
  };
}

/**
 * Convert number to Indian words for amount
 */
function numberToWords(num) {
  if (num === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertGroup(n) {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convertGroup(n % 100) : '');
  }

  const intPart = Math.floor(Math.abs(num));
  const decPart = Math.round((Math.abs(num) - intPart) * 100);

  let result = '';
  if (intPart >= 10000000) {
    result += convertGroup(Math.floor(intPart / 10000000)) + ' Crore ';
  }
  const remCrore = intPart % 10000000;
  if (remCrore >= 100000) {
    result += convertGroup(Math.floor(remCrore / 100000)) + ' Lakh ';
  }
  const remLakh = remCrore % 100000;
  if (remLakh >= 1000) {
    result += convertGroup(Math.floor(remLakh / 1000)) + ' Thousand ';
  }
  const remThousand = remLakh % 1000;
  if (remThousand > 0) {
    result += convertGroup(remThousand);
  }

  result = result.trim() || 'Zero';
  result = 'Rupees ' + result;

  if (decPart > 0) {
    result += ' and ' + convertGroup(decPart) + ' Paise';
  }

  return result + ' Only';
}

// Unit tests (run in comments)
// Test 1: Intra-state, 18% GST
// Input: qty=10, price=100, discount=0%, rate=18%, INTRA
// Expected: taxable=1000, cgst=90, sgst=90, igst=0, total=1180
// const t1 = calculateLineItem({quantity:10,unit_price:100,discount_pct:0,gst_rate:18}, 'INTRA');
// console.assert(t1.taxable_value === '1000.00' && t1.cgst_amount === '90.00');

// Test 2: Inter-state, 12% GST
// Input: qty=5, price=200, discount=10%, rate=12%, INTER
// Expected: taxable=900, cgst=0, sgst=0, igst=108, total=1008
// const t2 = calculateLineItem({quantity:5,unit_price:200,discount_pct:10,gst_rate:12}, 'INTER');
// console.assert(t2.taxable_value === '900.00' && t2.igst_amount === '108.00');

// Test 3: Intra-state, 5% GST with discount
// Input: qty=3, price=500, discount=5%, rate=5%, INTRA
// Expected: taxable=1425, cgst=35.63, sgst=35.63, igst=0, total=1496.26
// const t3 = calculateLineItem({quantity:3,unit_price:500,discount_pct:5,gst_rate:5}, 'INTRA');
// console.assert(t3.taxable_value === '1425.00' && t3.cgst_amount === '35.63');

module.exports = {
  VALID_GST_RATES,
  round2,
  isValidGstRate,
  getSupplyType,
  calculateLineItem,
  calculateInvoiceTotals,
  numberToWords,
};
