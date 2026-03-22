const pdfParse = require('pdf-parse');

/**
 * Extract structured invoice data from PDF buffer.
 * Uses regex-based heuristics to parse common Indian GST invoice formats.
 */
async function parseInvoicePDF(buffer) {
  const data = await pdfParse(buffer);
  const text = data.text;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const result = {
    invoice_number: extractInvoiceNumber(text),
    invoice_date: extractDate(text, 'invoice'),
    due_date: extractDate(text, 'due'),
    invoice_type: extractInvoiceType(text),
    // Seller
    seller_name: null,
    seller_gstin: null,
    seller_address: null,
    // Buyer
    buyer_name: null,
    buyer_gstin: null,
    buyer_address: null,
    buyer_state_code: null,
    // Totals
    taxable_value: null,
    cgst: null,
    sgst: null,
    igst: null,
    total_amount: null,
    // Line items
    line_items: [],
    // Raw text for debugging
    raw_text: text,
  };

  // Extract GSTINs
  const gstins = extractGSTINs(text);
  if (gstins.length >= 2) {
    result.seller_gstin = gstins[0];
    result.buyer_gstin = gstins[1];
    result.buyer_state_code = gstins[1].substring(0, 2);
  } else if (gstins.length === 1) {
    // Could be either seller or buyer — use context
    const gstinContext = getGSTINContext(text, gstins[0]);
    if (gstinContext === 'buyer') {
      result.buyer_gstin = gstins[0];
      result.buyer_state_code = gstins[0].substring(0, 2);
    } else {
      result.seller_gstin = gstins[0];
    }
  }

  // Extract names near GSTIN or from header
  const parties = extractParties(text, lines);
  if (parties.seller) result.seller_name = parties.seller;
  if (parties.buyer) result.buyer_name = parties.buyer;
  if (parties.sellerAddress) result.seller_address = parties.sellerAddress;
  if (parties.buyerAddress) result.buyer_address = parties.buyerAddress;

  // Extract totals
  const totals = extractTotals(text);
  if (totals.taxable != null) result.taxable_value = totals.taxable;
  if (totals.cgst != null) result.cgst = totals.cgst;
  if (totals.sgst != null) result.sgst = totals.sgst;
  if (totals.igst != null) result.igst = totals.igst;
  if (totals.total != null) result.total_amount = totals.total;

  // Extract line items
  result.line_items = extractLineItems(text, lines);

  // If buyer state not from GSTIN, try from text
  if (!result.buyer_state_code) {
    result.buyer_state_code = extractStateCode(text, 'buyer') || extractStateCode(text, 'ship');
  }

  return result;
}

// ======================== HELPERS ========================

function extractInvoiceNumber(text) {
  const patterns = [
    /invoice\s*(?:no|number|#|num)[.:)#\s-]*\s*([A-Z0-9][\w\-\/]+)/i,
    /inv[.\s-]*(?:no|number|#)?[.:)#\s-]*\s*([A-Z0-9][\w\-\/]+)/i,
    /bill\s*(?:no|number|#)[.:)#\s-]*\s*([A-Z0-9][\w\-\/]+)/i,
    /(?:voucher|receipt)\s*(?:no|number|#)[.:)#\s-]*\s*([A-Z0-9][\w\-\/]+)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

function extractDate(text, type) {
  let patterns;
  if (type === 'due') {
    patterns = [
      /due\s*(?:date|dt)[.:)#\s-]*\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
      /due\s*(?:date|dt)[.:)#\s-]*\s*(\d{1,2}\s+\w{3,9}\s+\d{2,4})/i,
      /payment\s*(?:due|by)[.:)#\s-]*\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
    ];
  } else {
    patterns = [
      /invoice\s*(?:date|dt)[.:)#\s-]*\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
      /(?:date|dt)\s*(?:of\s*invoice)?[.:)#\s-]*\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
      /invoice\s*(?:date|dt)[.:)#\s-]*\s*(\d{1,2}\s+\w{3,9}\s+\d{2,4})/i,
      /(?:date|dt)[.:)#\s-]*\s*(\d{1,2}\s+\w{3,9}\s+\d{2,4})/i,
    ];
  }
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return normalizeDate(m[1].trim());
  }
  return null;
}

function normalizeDate(dateStr) {
  // Try DD/MM/YYYY or DD-MM-YYYY
  let m = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = '20' + y;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Try DD Mon YYYY
  const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
  m = dateStr.match(/^(\d{1,2})\s+(\w{3,9})\s+(\d{2,4})$/i);
  if (m) {
    let [, d, moName, y] = m;
    if (y.length === 2) y = '20' + y;
    const moKey = moName.toLowerCase().substring(0, 3);
    const mo = months[moKey];
    if (mo) return `${y}-${mo}-${d.padStart(2, '0')}`;
  }
  return dateStr;
}

function extractInvoiceType(text) {
  const upper = text.toUpperCase();
  if (upper.includes('CREDIT NOTE')) return 'CREDIT NOTE';
  if (upper.includes('DEBIT NOTE')) return 'DEBIT NOTE';
  if (upper.includes('PROFORMA')) return 'PROFORMA';
  if (upper.includes('EXPORT INVOICE')) return 'EXPORT INVOICE';
  if (upper.includes('BILL OF SUPPLY')) return 'BILL OF SUPPLY';
  return 'TAX INVOICE';
}

function extractGSTINs(text) {
  // Indian GSTIN format: 2-digit state code + 10-char PAN + 1 entity + 1 Z + 1 check digit
  const gstinPattern = /\b(\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z\d][A-Z\d])\b/g;
  const found = [];
  let m;
  while ((m = gstinPattern.exec(text)) !== null) {
    if (!found.includes(m[1])) found.push(m[1]);
  }
  return found;
}

function getGSTINContext(text, gstin) {
  const idx = text.indexOf(gstin);
  if (idx === -1) return 'seller';
  const before = text.substring(Math.max(0, idx - 100), idx).toLowerCase();
  if (before.includes('buyer') || before.includes('bill to') || before.includes('ship to') || before.includes('customer') || before.includes('consignee')) {
    return 'buyer';
  }
  return 'seller';
}

function extractParties(text, lines) {
  const result = { seller: null, buyer: null, sellerAddress: null, buyerAddress: null };

  // Look for "From:" / "To:" patterns
  const fromMatch = text.match(/(?:from|seller|supplier)[:\s]+([^\n]+)/i);
  const toMatch = text.match(/(?:to|buyer|bill\s*to|customer|consignee)[:\s]+([^\n]+)/i);

  if (fromMatch) result.seller = cleanName(fromMatch[1]);
  if (toMatch) result.buyer = cleanName(toMatch[1]);

  // If not found, try first prominent name (often company name is first bold/large text)
  if (!result.seller && !result.buyer) {
    // Look for company-like names near the top
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const line = lines[i];
      if (line.length > 3 && line.length < 80 && !line.match(/invoice|tax|gst|date|no\./i)) {
        if (!result.seller) {
          result.seller = cleanName(line);
          break;
        }
      }
    }
  }

  // Extract addresses near buyer/seller labels
  const buyerAddrMatch = text.match(/(?:bill\s*to|buyer|customer|consignee)[:\s]*[^\n]*\n([^\n]+(?:\n[^\n]+){0,2})/i);
  if (buyerAddrMatch) {
    const addrLines = buyerAddrMatch[1].split('\n').map(l => l.trim()).filter(l => l && !l.match(/gstin|gst\s*no|state/i));
    if (addrLines.length > 0) result.buyerAddress = addrLines.join(', ');
  }

  return result;
}

function cleanName(name) {
  return name.replace(/[:\-|]/g, '').replace(/\s+/g, ' ').trim().substring(0, 100);
}

function extractTotals(text) {
  const result = { taxable: null, cgst: null, sgst: null, igst: null, total: null };

  const amountPattern = (label) => {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(escaped + '[:\\s₹Rs.]*([\\d,]+\\.?\\d{0,2})', 'i');
  };

  // Taxable value
  for (const label of ['taxable value', 'taxable amount', 'sub total', 'subtotal', 'base amount']) {
    const m = text.match(amountPattern(label));
    if (m) { result.taxable = parseIndianNumber(m[1]); break; }
  }

  // CGST
  for (const label of ['total cgst', 'cgst', 'central gst']) {
    const m = text.match(amountPattern(label));
    if (m) { result.cgst = parseIndianNumber(m[1]); break; }
  }

  // SGST
  for (const label of ['total sgst', 'sgst', 'state gst', 'utgst']) {
    const m = text.match(amountPattern(label));
    if (m) { result.sgst = parseIndianNumber(m[1]); break; }
  }

  // IGST
  for (const label of ['total igst', 'igst', 'integrated gst']) {
    const m = text.match(amountPattern(label));
    if (m) { result.igst = parseIndianNumber(m[1]); break; }
  }

  // Grand total
  for (const label of ['grand total', 'total amount', 'net amount', 'invoice total', 'total payable', 'amount payable', 'invoice value']) {
    const m = text.match(amountPattern(label));
    if (m) { result.total = parseIndianNumber(m[1]); break; }
  }
  // Fallback: look for "Total" at end
  if (result.total == null) {
    const m = text.match(/total[:\s₹Rs.]*([\\d,]+\\.?\d{0,2})\s*$/im);
    if (m) result.total = parseIndianNumber(m[1]);
  }

  return result;
}

function parseIndianNumber(str) {
  if (!str) return null;
  const cleaned = str.replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.round(num * 100) / 100;
}

function extractLineItems(text, lines) {
  const items = [];

  // Strategy: find table-like rows with HSN codes, quantities, amounts
  // Common columns: SN | Description | HSN | Qty | Rate | Amount | GST | Total
  // Look for rows containing an HSN-like code (4-8 digit number) plus numeric amounts

  const hsnPattern = /\b(\d{4,8})\b/;
  const amountPattern = /[\d,]+\.\d{2}/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip headers and summary lines
    if (line.match(/^(#|sn|sr|sl|s\.?no|description|particular|hsn|qty|rate|amount|total|sub|tax|cgst|sgst|igst|grand)/i)) continue;
    if (line.match(/(taxable value|grand total|sub total|invoice total|amount in words)/i)) continue;

    const hsnMatch = line.match(hsnPattern);
    if (!hsnMatch) continue;

    const amounts = line.match(amountPattern);
    if (!amounts || amounts.length < 2) continue;

    // This line likely has a line item
    const hsn = hsnMatch[1];

    // Try to extract description — text before the HSN code
    let desc = line.substring(0, line.indexOf(hsn)).replace(/^\d+[\.\)\s]+/, '').trim();
    if (!desc || desc.length < 2) {
      // Maybe description is on previous line
      if (i > 0) desc = lines[i - 1].replace(/^\d+[\.\)\s]+/, '').trim();
    }

    // Parse amounts — typically: unit_price, taxable, gst_amount, total (varies by format)
    const numAmounts = amounts.map(a => parseIndianNumber(a));

    const item = {
      hsn_sac: hsn,
      description: desc || '',
      quantity: 1,
      unit: 'NOS',
      unit_price: 0,
      discount_pct: 0,
      gst_rate: 0,
    };

    // Try to find quantity — look for standalone integer near the HSN
    const afterHsn = line.substring(line.indexOf(hsn) + hsn.length);
    const qtyMatch = afterHsn.match(/^\s*(\d+)\s/);
    if (qtyMatch) item.quantity = parseInt(qtyMatch[1]);

    // Assign amounts based on count
    if (numAmounts.length >= 4) {
      item.unit_price = numAmounts[0];
      // taxable = numAmounts[1], gst = numAmounts[2], total = numAmounts[3]
    } else if (numAmounts.length >= 2) {
      item.unit_price = numAmounts[0];
    }

    // Try to extract GST rate from the line (e.g., "18%" or "18.00%")
    const gstRateMatch = line.match(/(\d+(?:\.\d+)?)\s*%/);
    if (gstRateMatch) {
      const rate = parseFloat(gstRateMatch[1]);
      if ([0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28].includes(rate)) {
        item.gst_rate = rate;
      }
    }

    items.push(item);
  }

  return items;
}

function extractStateCode(text, context) {
  const statePattern = new RegExp(context + '[^\\n]*state[^\\n]*?(\\d{2})', 'i');
  const m = text.match(statePattern);
  if (m) return m[1];

  // Try "State Code: XX"
  const codePattern = /state\s*code[:\s]*(\d{2})/i;
  const m2 = text.match(codePattern);
  if (m2) return m2[1];

  return null;
}

module.exports = { parseInvoicePDF };
