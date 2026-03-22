const { numberToWords } = require('./gstCalc');

// Lazy-load pdfkit to avoid issues on serverless cold starts
let PDFDocument;
function getPDFDocument() {
  if (!PDFDocument) PDFDocument = require('pdfkit');
  return PDFDocument;
}

function formatIndianNumber(num) {
  const n = Number(num);
  const parts = n.toFixed(2).split('.');
  let intPart = parts[0];
  const decPart = parts[1];

  if (intPart.length <= 3) return '₹' + intPart + '.' + decPart;

  const last3 = intPart.slice(-3);
  let rest = intPart.slice(0, -3);
  let result = '';
  while (rest.length > 2) {
    result = ',' + rest.slice(-2) + result;
    rest = rest.slice(0, -2);
  }
  result = rest + result + ',' + last3;
  return '₹' + result + '.' + decPart;
}

function generateInvoicePDF(invoice, lineItems, stream) {
  const PDFDoc = getPDFDocument();
  const doc = new PDFDoc({ size: 'A4', margin: 50 });
  doc.pipe(stream);

  // Watermark for draft
  if (invoice.status === 'DRAFT') {
    doc.save();
    doc.fontSize(60).fillColor('#cccccc').opacity(0.3);
    doc.rotate(-45, { origin: [300, 400] });
    doc.text('DRAFT', 150, 350);
    doc.restore();
  }

  // Header
  doc.fontSize(20).fillColor('#4F46E5').text('TAX INVOICE', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor('#333');

  // Invoice type and number
  const invoiceType = invoice.invoice_type || 'TAX INVOICE';
  doc.fontSize(8).fillColor('#666').text(invoiceType, { align: 'center' });
  doc.moveDown(0.5);

  // Seller / Buyer side by side
  const startY = doc.y;

  // Seller (left)
  doc.fontSize(9).fillColor('#4F46E5').text('From:', 50, startY);
  doc.fontSize(10).fillColor('#000').text(invoice.seller_name || '', 50, startY + 12);
  doc.fontSize(8).fillColor('#333');
  doc.text(`GSTIN: ${invoice.seller_gstin || ''}`, 50, startY + 26);
  doc.text(invoice.seller_address || '', 50, startY + 38);

  // Buyer (right)
  doc.fontSize(9).fillColor('#4F46E5').text('To:', 320, startY);
  doc.fontSize(10).fillColor('#000').text(invoice.buyer_name || '', 320, startY + 12);
  doc.fontSize(8).fillColor('#333');
  doc.text(`GSTIN: ${invoice.buyer_gstin || ''}`, 320, startY + 26);
  doc.text(invoice.buyer_address || '', 320, startY + 38);

  doc.y = startY + 60;
  doc.moveDown(0.5);

  // Invoice details line
  doc.fontSize(8).fillColor('#333');
  doc.text(`Invoice No: ${invoice.invoice_number}    |    Date: ${invoice.invoice_date}    |    Due: ${invoice.due_date || 'N/A'}    |    Place of Supply: ${invoice.place_of_supply || ''}`, 50);
  doc.moveDown(0.5);

  // Line break
  doc.strokeColor('#ddd').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.5);

  // Line items table header
  const tableTop = doc.y;
  const cols = { sn: 50, desc: 70, hsn: 200, qty: 250, unit: 280, price: 310, disc: 360, taxable: 390, gst: 440, total: 490 };

  doc.fontSize(7).fillColor('#4F46E5');
  doc.text('#', cols.sn, tableTop);
  doc.text('Description', cols.desc, tableTop);
  doc.text('HSN', cols.hsn, tableTop);
  doc.text('Qty', cols.qty, tableTop);
  doc.text('Unit', cols.unit, tableTop);
  doc.text('Price', cols.price, tableTop);
  doc.text('Disc%', cols.disc, tableTop);
  doc.text('Taxable', cols.taxable, tableTop);
  doc.text('GST', cols.gst, tableTop);
  doc.text('Total', cols.total, tableTop);

  doc.strokeColor('#ddd').lineWidth(0.5).moveTo(50, tableTop + 12).lineTo(545, tableTop + 12).stroke();

  let y = tableTop + 16;
  doc.fontSize(7).fillColor('#333');

  (lineItems || []).forEach((item, i) => {
    if (y > 700) {
      doc.addPage();
      y = 50;
    }
    const gstAmt = Number(item.cgst_amount || 0) + Number(item.sgst_amount || 0) + Number(item.igst_amount || 0);
    doc.text(String(i + 1), cols.sn, y);
    doc.text((item.description || '').substring(0, 20), cols.desc, y);
    doc.text(item.hsn_sac || '', cols.hsn, y);
    doc.text(String(item.quantity || ''), cols.qty, y);
    doc.text(item.unit || '', cols.unit, y);
    doc.text(Number(item.unit_price || 0).toFixed(2), cols.price, y);
    doc.text((item.discount_pct || '0') + '%', cols.disc, y);
    doc.text(Number(item.taxable_value || 0).toFixed(2), cols.taxable, y);
    doc.text(gstAmt.toFixed(2), cols.gst, y);
    doc.text(Number(item.total_amount || 0).toFixed(2), cols.total, y);
    y += 14;
  });

  // Summary
  y += 10;
  doc.strokeColor('#ddd').lineWidth(1).moveTo(50, y).lineTo(545, y).stroke();
  y += 8;

  const hasIgst = Number(invoice.igst) > 0;
  doc.fontSize(9).fillColor('#333');

  doc.text('Taxable Value:', 350, y);
  doc.text(formatIndianNumber(invoice.taxable_value), 460, y, { align: 'right', width: 85 });
  y += 14;

  if (hasIgst) {
    doc.text('IGST:', 350, y);
    doc.text(formatIndianNumber(invoice.igst), 460, y, { align: 'right', width: 85 });
    y += 14;
  } else {
    doc.text('CGST:', 350, y);
    doc.text(formatIndianNumber(invoice.cgst), 460, y, { align: 'right', width: 85 });
    y += 14;
    doc.text('SGST:', 350, y);
    doc.text(formatIndianNumber(invoice.sgst), 460, y, { align: 'right', width: 85 });
    y += 14;
  }

  doc.fontSize(11).fillColor('#4F46E5');
  doc.text('Grand Total:', 350, y);
  doc.text(formatIndianNumber(invoice.total_amount), 460, y, { align: 'right', width: 85 });
  y += 18;

  // Amount in words
  doc.fontSize(8).fillColor('#666');
  doc.text(`Amount in words: ${numberToWords(Number(invoice.total_amount))}`, 50, y);
  y += 20;

  // Notes
  if (invoice.notes) {
    doc.fontSize(8).fillColor('#666');
    doc.text('Notes: ' + invoice.notes, 50, y);
  }

  doc.end();
  return doc;
}

module.exports = { generateInvoicePDF, formatIndianNumber };
