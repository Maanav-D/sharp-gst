import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoicesApi, customersApi, productsApi, hsnApi, settingsApi } from '../api/client';
import { formatINR, INDIAN_STATES } from '../utils/format';
import toast from 'react-hot-toast';
import { Plus, Trash2, Save, Send, Download, Search, Upload, FileText, X } from 'lucide-react';

const INVOICE_TYPES = [
  'TAX INVOICE',
  'BILL OF SUPPLY',
  'EXPORT INVOICE',
  'DEBIT NOTE',
  'CREDIT NOTE',
  'PROFORMA',
];

const emptyLineItem = () => ({
  id: Date.now() + Math.random(),
  hsn_sac: '',
  description: '',
  qty: 1,
  unit: 'NOS',
  unit_price: 0,
  discount_pct: 0,
  taxable_value: 0,
  gst_rate: 0,
  cgst: 0,
  sgst: 0,
  igst: 0,
  total: 0,
});

function numberToWords(num) {
  if (num === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
    'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertChunk(n) {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convertChunk(n % 100) : '');
  }

  const intPart = Math.floor(Math.abs(num));
  const paise = Math.round((Math.abs(num) - intPart) * 100);

  if (intPart === 0 && paise > 0) {
    return 'Rupees ' + convertChunk(paise) + ' Paise Only';
  }

  // Indian numbering: crore, lakh, thousand, hundred
  let result = '';
  const crore = Math.floor(intPart / 10000000);
  const lakh = Math.floor((intPart % 10000000) / 100000);
  const thousand = Math.floor((intPart % 100000) / 1000);
  const remainder = intPart % 1000;

  if (crore > 0) result += convertChunk(crore) + ' Crore ';
  if (lakh > 0) result += convertChunk(lakh) + ' Lakh ';
  if (thousand > 0) result += convertChunk(thousand) + ' Thousand ';
  if (remainder > 0) result += convertChunk(remainder);

  result = 'Rupees ' + result.trim();
  if (paise > 0) {
    result += ' and ' + convertChunk(paise) + ' Paise';
  }
  return result + ' Only';
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function CreateInvoice() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  // --- Settings ---
  const [settings, setSettings] = useState(null);
  const [sellerState, setSellerState] = useState('');

  // --- Invoice header ---
  const [invoiceType, setInvoiceType] = useState('TAX INVOICE');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(todayStr());
  const [dueDate, setDueDate] = useState('');
  const [sellerGstin, setSellerGstin] = useState('');

  // --- Customer ---
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [buyerName, setBuyerName] = useState('');
  const [buyerGstin, setBuyerGstin] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [buyerState, setBuyerState] = useState('');
  const customerDropdownRef = useRef(null);
  const customerSearchTimer = useRef(null);

  // --- Line items ---
  const [items, setItems] = useState([emptyLineItem()]);

  // --- Product catalog (loaded once) ---
  const [products, setProducts] = useState([]);

  // --- Unified item search per row (searches products by name + HSN codes) ---
  const [itemSearches, setItemSearches] = useState({});
  const [itemResults, setItemResults] = useState({});
  const [activeItemRow, setActiveItemRow] = useState(null);
  const itemTimers = useRef({});

  // --- HSN typeahead per row (kept for HSN column) ---
  const [hsnSearches, setHsnSearches] = useState({});
  const [hsnResults, setHsnResults] = useState({});
  const [activeHsnRow, setActiveHsnRow] = useState(null);
  const hsnTimers = useRef({});

  // --- Sales account for posting ---
  const [salesAccount, setSalesAccount] = useState('Sales');

  // --- PDF Upload ---
  const [pdfUploading, setPdfUploading] = useState(false);
  const fileInputRef = useRef(null);

  // --- Notes ---
  const [notes, setNotes] = useState('');

  // --- Derived ---
  const isInterState = sellerState && buyerState && sellerState !== buyerState;

  // ==================== EFFECTS ====================

  // Fetch settings on mount
  useEffect(() => {
    settingsApi.get().then(data => {
      setSettings(data);
      setSellerGstin(data.gstin || '');
      setSellerState(data.gstin ? data.gstin.substring(0, 2) : '');
      // Generate invoice number from prefix
      const prefix = data.invoice_prefix || 'INV';
      const nextNum = data.next_invoice_number || 1;
      setInvoiceNumber(`${prefix}-${String(nextNum).padStart(5, '0')}`);
    }).catch(() => {
      toast.error('Failed to load settings');
    });
  }, []);

  // Fetch products on mount
  useEffect(() => {
    productsApi.getAll().then(res => {
      const list = Array.isArray(res) ? res : res.data || [];
      setProducts(list);
    }).catch(() => {});
  }, []);

  // Debounced customer search
  useEffect(() => {
    if (customerSearchTimer.current) clearTimeout(customerSearchTimer.current);
    if (!customerSearch || customerSearch.length < 2) {
      setCustomerResults([]);
      setShowCustomerDropdown(false);
      return;
    }
    customerSearchTimer.current = setTimeout(() => {
      customersApi.getAll({ q: customerSearch }).then(res => {
        const list = Array.isArray(res) ? res : res.data || [];
        setCustomerResults(list);
        setShowCustomerDropdown(list.length > 0);
      }).catch(() => {});
    }, 300);
    return () => clearTimeout(customerSearchTimer.current);
  }, [customerSearch]);

  // Close customer dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target)) {
        setShowCustomerDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ==================== PDF UPLOAD ====================

  const handlePdfUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }
    setPdfUploading(true);
    try {
      const parsed = await invoicesApi.parsePdf(file);
      // Pre-fill form fields from parsed data
      if (parsed.invoice_number) setInvoiceNumber(parsed.invoice_number);
      if (parsed.invoice_date) setInvoiceDate(parsed.invoice_date);
      if (parsed.due_date) setDueDate(parsed.due_date);
      if (parsed.invoice_type) setInvoiceType(parsed.invoice_type);
      if (parsed.buyer_name) {
        setBuyerName(parsed.buyer_name);
        setCustomerSearch(parsed.buyer_name);
      }
      if (parsed.buyer_gstin) setBuyerGstin(parsed.buyer_gstin);
      if (parsed.buyer_address) setBuyerAddress(parsed.buyer_address);
      if (parsed.buyer_state_code) setBuyerState(parsed.buyer_state_code);
      if (parsed.notes) setNotes(parsed.notes);
      // Pre-fill line items
      if (parsed.line_items && parsed.line_items.length > 0) {
        const newItems = parsed.line_items.map(li => {
          const item = emptyLineItem();
          item.hsn_sac = li.hsn_sac || '';
          item.description = li.description || '';
          item.qty = li.quantity || 1;
          item.unit = li.unit || 'NOS';
          item.unit_price = li.unit_price || 0;
          item.discount_pct = li.discount_pct || 0;
          item.gst_rate = li.gst_rate || 0;
          return recalcItem(item);
        });
        setItems(newItems);
        // Update item search display values
        const searches = {};
        newItems.forEach((item, i) => { searches[i] = item.description; });
        setItemSearches(searches);
      }
      const itemCount = parsed.line_items?.length || 0;
      toast.success(`Extracted ${itemCount} item${itemCount !== 1 ? 's' : ''} from PDF`);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to parse PDF';
      toast.error(msg);
    } finally {
      setPdfUploading(false);
      // Reset file input so same file can be re-uploaded
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ==================== HELPERS ====================

  const selectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setBuyerName(customer.name || '');
    setBuyerGstin(customer.gstin || '');
    setBuyerAddress(customer.address || '');
    setBuyerState(customer.state_code || '');
    setCustomerSearch(customer.name || '');
    setShowCustomerDropdown(false);
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setBuyerName('');
    setBuyerGstin('');
    setBuyerAddress('');
    setBuyerState('');
    setCustomerSearch('');
  };

  // --- Line item calculations ---
  const recalcItem = useCallback((item) => {
    const qty = Number(item.qty) || 0;
    const unitPrice = Number(item.unit_price) || 0;
    const discountPct = Number(item.discount_pct) || 0;
    const gstRate = Number(item.gst_rate) || 0;

    const taxableValue = qty * unitPrice * (1 - discountPct / 100);
    let cgst = 0, sgst = 0, igst = 0;

    if (isInterState) {
      igst = taxableValue * gstRate / 100;
    } else {
      cgst = taxableValue * (gstRate / 2) / 100;
      sgst = taxableValue * (gstRate / 2) / 100;
    }

    const total = taxableValue + cgst + sgst + igst;
    return {
      ...item,
      taxable_value: Math.round(taxableValue * 100) / 100,
      cgst: Math.round(cgst * 100) / 100,
      sgst: Math.round(sgst * 100) / 100,
      igst: Math.round(igst * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  }, [isInterState]);

  // Recalculate all items when inter/intra state changes
  useEffect(() => {
    setItems(prev => prev.map(item => recalcItem(item)));
  }, [isInterState, recalcItem]);

  const updateItem = (index, field, value) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      updated[index] = recalcItem(updated[index]);
      return updated;
    });
  };

  const addRow = () => {
    setItems(prev => [...prev, emptyLineItem()]);
  };

  const removeRow = (index) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
    // Clean up HSN state for removed row
    setHsnSearches(prev => { const n = { ...prev }; delete n[index]; return n; });
    setHsnResults(prev => { const n = { ...prev }; delete n[index]; return n; });
  };

  // --- Unified item search (products by name + HSN codes) ---
  const handleItemSearch = (index, query) => {
    setItemSearches(prev => ({ ...prev, [index]: query }));

    if (itemTimers.current[index]) clearTimeout(itemTimers.current[index]);
    if (!query || query.length < 1) {
      setItemResults(prev => ({ ...prev, [index]: [] }));
      setActiveItemRow(null);
      return;
    }

    itemTimers.current[index] = setTimeout(() => {
      const q = query.toLowerCase();
      // Search products by name or HSN
      const matchedProducts = products.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.hsn_sac || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      ).slice(0, 10).map(p => ({ ...p, _type: 'product' }));

      // Also search HSN master
      hsnApi.search(query).then(res => {
        const hsnList = (Array.isArray(res) ? res : res.data || [])
          .slice(0, 10)
          .map(h => ({ ...h, _type: 'hsn' }));
        setItemResults(prev => ({ ...prev, [index]: [...matchedProducts, ...hsnList] }));
        setActiveItemRow(index);
      }).catch(() => {
        setItemResults(prev => ({ ...prev, [index]: matchedProducts }));
        if (matchedProducts.length > 0) setActiveItemRow(index);
      });
    }, 200);
  };

  const selectItem = (index, item) => {
    if (item._type === 'product') {
      // Product selected — fill all fields
      setItems(prev => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          hsn_sac: item.hsn_sac || '',
          description: item.name || item.description || '',
          unit: item.unit || updated[index].unit,
          unit_price: Number(item.default_price) || updated[index].unit_price,
          gst_rate: item.gst_rate != null ? Number(item.gst_rate) : updated[index].gst_rate,
        };
        updated[index] = recalcItem(updated[index]);
        return updated;
      });
      setItemSearches(prev => ({ ...prev, [index]: item.name || '' }));
    } else {
      // HSN selected — fill HSN, description, GST rate
      setItems(prev => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          hsn_sac: item.hsn_code || item.code || '',
          description: item.description || updated[index].description,
          gst_rate: item.gst_rate != null ? Number(item.gst_rate) : updated[index].gst_rate,
        };
        updated[index] = recalcItem(updated[index]);
        return updated;
      });
      setItemSearches(prev => ({ ...prev, [index]: item.description || '' }));
    }
    setItemResults(prev => ({ ...prev, [index]: [] }));
    setActiveItemRow(null);
  };

  // --- HSN typeahead ---
  const handleHsnSearch = (index, query) => {
    setHsnSearches(prev => ({ ...prev, [index]: query }));
    updateItem(index, 'hsn_sac', query);

    if (hsnTimers.current[index]) clearTimeout(hsnTimers.current[index]);
    if (!query || query.length < 2) {
      setHsnResults(prev => ({ ...prev, [index]: [] }));
      setActiveHsnRow(null);
      return;
    }

    hsnTimers.current[index] = setTimeout(() => {
      hsnApi.search(query).then(res => {
        const list = Array.isArray(res) ? res : res.data || [];
        setHsnResults(prev => ({ ...prev, [index]: list }));
        setActiveHsnRow(index);
      }).catch(() => {});
    }, 300);
  };

  const selectHsn = (index, hsn) => {
    updateItem(index, 'hsn_sac', hsn.code || hsn.hsn_code || '');
    // Also fill description and gst_rate
    setItems(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        hsn_sac: hsn.code || hsn.hsn_code || '',
        description: hsn.description || updated[index].description,
        gst_rate: hsn.gst_rate != null ? Number(hsn.gst_rate) : updated[index].gst_rate,
      };
      updated[index] = recalcItem(updated[index]);
      return updated;
    });
    setHsnSearches(prev => ({ ...prev, [index]: hsn.code || hsn.hsn_code || '' }));
    setHsnResults(prev => ({ ...prev, [index]: [] }));
    setActiveHsnRow(null);
  };

  // ==================== SUMMARY ====================

  const summary = items.reduce(
    (acc, item) => {
      const qty = Number(item.qty) || 0;
      const unitPrice = Number(item.unit_price) || 0;
      const discountPct = Number(item.discount_pct) || 0;
      const gross = qty * unitPrice;
      const discount = gross * discountPct / 100;

      acc.subtotal += gross;
      acc.totalDiscount += discount;
      acc.taxableValue += item.taxable_value;
      acc.cgst += item.cgst;
      acc.sgst += item.sgst;
      acc.igst += item.igst;
      acc.grandTotal += item.total;
      return acc;
    },
    { subtotal: 0, totalDiscount: 0, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, grandTotal: 0 }
  );

  // ==================== SUBMIT ====================

  const buildPayload = (status) => ({
    invoice_type: invoiceType,
    invoice_number: invoiceNumber,
    invoice_date: invoiceDate,
    due_date: dueDate || null,
    status,
    seller_gstin: sellerGstin,
    buyer_name: buyerName,
    buyer_gstin: buyerGstin,
    buyer_address: buyerAddress,
    buyer_state_code: buyerState,
    place_of_supply: buyerState,
    is_inter_state: isInterState,
    line_items: items.map(({ id, ...rest }) => ({
      hsn_sac: rest.hsn_sac,
      description: rest.description,
      quantity: rest.qty,
      unit: rest.unit,
      unit_price: rest.unit_price,
      discount_pct: rest.discount_pct,
      gst_rate: rest.gst_rate,
    })),
    subtotal: Math.round(summary.subtotal * 100) / 100,
    total_discount: Math.round(summary.totalDiscount * 100) / 100,
    taxable_value: Math.round(summary.taxableValue * 100) / 100,
    cgst: Math.round(summary.cgst * 100) / 100,
    sgst: Math.round(summary.sgst * 100) / 100,
    igst: Math.round(summary.igst * 100) / 100,
    grand_total: Math.round(summary.grandTotal * 100) / 100,
    amount_in_words: numberToWords(Math.round(summary.grandTotal * 100) / 100),
    notes,
    customer_id: selectedCustomer?.id || null,
    sales_account: salesAccount,
  });

  const handleSave = async (status, downloadPdf = false) => {
    // Basic validation
    if (!invoiceNumber.trim()) {
      toast.error('Invoice number is required');
      return;
    }
    if (!buyerName.trim()) {
      toast.error('Customer name is required');
      return;
    }
    if (items.length === 0 || items.every(i => !i.hsn_sac && !i.description)) {
      toast.error('Add at least one line item');
      return;
    }

    setSubmitting(true);
    try {
      const payload = buildPayload(status);
      const result = await invoicesApi.create(payload);
      toast.success(`Invoice ${status === 'DRAFT' ? 'saved as draft' : 'created'} successfully`);

      if (downloadPdf && result?.id) {
        window.open(invoicesApi.getPdfUrl(result.id), '_blank');
      }

      navigate('/invoices');
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to create invoice';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== RENDER ====================

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold text-gray-900">Create Invoice</h1>
        <div className="flex items-center gap-3">
          {/* PDF Upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handlePdfUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={pdfUploading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
          >
            {pdfUploading ? (
              <span className="inline-block w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Upload size={16} />
            )}
            {pdfUploading ? 'Parsing...' : 'Upload Invoice PDF'}
          </button>
          <button
            onClick={() => handleSave('DRAFT')}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Save size={16} />
            Save as Draft
          </button>
          <button
            onClick={() => handleSave('SENT')}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            <Send size={16} />
            Save & Send
          </button>
          <button
            onClick={() => handleSave('DRAFT', true)}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50"
          >
            <Download size={16} />
            Save & Download PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main form - 2 columns on large */}
        <div className="lg:col-span-2 space-y-6">

          {/* Invoice Header Panel */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Invoice Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Invoice Type */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Invoice Type</label>
                <select
                  value={invoiceType}
                  onChange={e => setInvoiceType(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  {INVOICE_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Invoice Number */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Invoice Number</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={e => setInvoiceNumber(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="INV-00001"
                />
              </div>

              {/* Invoice Date */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Invoice Date</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={e => setInvoiceDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Seller GSTIN */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Seller GSTIN</label>
                <input
                  type="text"
                  value={sellerGstin}
                  readOnly
                  className="w-full px-3 py-2 text-sm font-mono border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>

              {/* Sales Account for Posting */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Sales Account</label>
                <select
                  value={salesAccount}
                  onChange={e => setSalesAccount(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="Sales">Sales</option>
                  <option value="Sales - Services">Sales - Services</option>
                  <option value="Sales - Products">Sales - Products</option>
                  <option value="Sales - Export">Sales - Export</option>
                  <option value="Sales - Exempt">Sales - Exempt</option>
                  <option value="Sales - Capital Goods">Sales - Capital Goods</option>
                </select>
              </div>
            </div>
          </div>

          {/* Customer Section */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Customer / Buyer</h2>

            {/* Search existing customer */}
            <div className="relative mb-4" ref={customerDropdownRef}>
              <label className="block text-xs font-medium text-gray-500 mb-1">Search Customer</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customerSearch}
                  onChange={e => {
                    setCustomerSearch(e.target.value);
                    if (selectedCustomer) clearCustomer();
                  }}
                  placeholder="Type customer name or GSTIN to search..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                {selectedCustomer && (
                  <button
                    onClick={clearCustomer}
                    className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Customer dropdown */}
              {showCustomerDropdown && customerResults.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {customerResults.map(c => (
                    <button
                      key={c.id}
                      onClick={() => selectCustomer(c)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 transition-colors border-b border-gray-50 last:border-0"
                    >
                      <span className="font-medium text-gray-900">{c.name}</span>
                      {c.gstin && (
                        <span className="ml-2 text-xs font-mono text-gray-500">{c.gstin}</span>
                      )}
                      {c.state_code && (
                        <span className="ml-2 text-xs text-gray-400">
                          {INDIAN_STATES.find(s => s.code === c.state_code)?.name || c.state_code}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Manual entry fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                <input
                  type="text"
                  value={buyerName}
                  onChange={e => setBuyerName(e.target.value)}
                  placeholder="Customer / Business name"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">GSTIN</label>
                <input
                  type="text"
                  value={buyerGstin}
                  onChange={e => setBuyerGstin(e.target.value.toUpperCase())}
                  placeholder="22AAAAA0000A1Z5"
                  maxLength={15}
                  className="w-full px-3 py-2 text-sm font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Address</label>
                <input
                  type="text"
                  value={buyerAddress}
                  onChange={e => setBuyerAddress(e.target.value)}
                  placeholder="Full address"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">State</label>
                <select
                  value={buyerState}
                  onChange={e => setBuyerState(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">Select state</option>
                  {INDIAN_STATES.map(s => (
                    <option key={s.code} value={s.code}>{s.code} - {s.name}</option>
                  ))}
                </select>
                {buyerState && sellerState && (
                  <p className={`mt-1 text-xs font-medium ${isInterState ? 'text-amber-600' : 'text-green-600'}`}>
                    {isInterState ? 'Inter-State (IGST applies)' : 'Intra-State (CGST + SGST applies)'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Line Items</h2>
              <button
                onClick={addRow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
              >
                <Plus size={14} />
                Add Item
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={item.id} className="border border-gray-100 rounded-lg p-4 hover:border-gray-200 transition-colors relative group">
                  {/* Remove button */}
                  <button
                    onClick={() => removeRow(index)}
                    disabled={items.length <= 1}
                    className="absolute top-3 right-3 p-1 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-0 disabled:cursor-not-allowed"
                    title="Remove item"
                  >
                    <X size={16} />
                  </button>

                  {/* Row 1: Search + HSN */}
                  <div className="flex gap-3 mb-3">
                    {/* Item search — main input */}
                    <div className="flex-1 relative">
                      <label className="block text-xs font-medium text-gray-400 mb-1">Item / Product</label>
                      <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input
                          type="text"
                          value={itemSearches[index] ?? item.description}
                          onChange={e => handleItemSearch(index, e.target.value)}
                          onFocus={() => {
                            if (itemResults[index]?.length) setActiveItemRow(index);
                          }}
                          onBlur={() => setTimeout(() => setActiveItemRow(null), 200)}
                          placeholder="Search by product name, description, or HSN code..."
                          className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                      </div>
                      {activeItemRow === index && itemResults[index]?.length > 0 && (
                        <div className="absolute z-30 left-0 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                          {itemResults[index].some(r => r._type === 'product') && (
                            <div className="px-3 py-1.5 text-[10px] font-bold text-indigo-500 uppercase tracking-widest bg-indigo-50/50 border-b border-indigo-100">Your Products</div>
                          )}
                          {itemResults[index].filter(r => r._type === 'product').map((p, pi) => (
                            <button
                              key={'p' + pi}
                              onMouseDown={() => selectItem(index, p)}
                              className="w-full text-left px-3 py-2.5 text-sm hover:bg-indigo-50 transition-colors border-b border-gray-50 flex items-center justify-between"
                            >
                              <div>
                                <span className="font-medium text-gray-900">{p.name}</span>
                                <span className="ml-2 text-xs font-mono text-gray-400">{p.hsn_sac}</span>
                              </div>
                              <div className="text-right text-xs text-gray-500 shrink-0 ml-3">
                                <span className="font-mono">{formatINR(p.default_price)}</span>
                                <span className="ml-1.5 text-indigo-500 font-medium">{p.gst_rate}%</span>
                              </div>
                            </button>
                          ))}
                          {itemResults[index].some(r => r._type === 'hsn') && (
                            <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 border-b border-gray-100">HSN Codes</div>
                          )}
                          {itemResults[index].filter(r => r._type === 'hsn').map((h, hi) => (
                            <button
                              key={'h' + hi}
                              onMouseDown={() => selectItem(index, h)}
                              className="w-full text-left px-3 py-2.5 text-sm hover:bg-indigo-50 transition-colors border-b border-gray-50 flex items-center justify-between"
                            >
                              <div>
                                <span className="font-mono font-medium text-indigo-600">{h.hsn_code || h.code}</span>
                                <span className="ml-2 text-gray-600">{h.description}</span>
                              </div>
                              <span className="text-xs text-indigo-500 font-medium shrink-0 ml-3">{h.gst_rate}%</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* HSN — smaller, with its own typeahead */}
                    <div className="w-32 relative">
                      <label className="block text-xs font-medium text-gray-400 mb-1">HSN/SAC</label>
                      <input
                        type="text"
                        value={item.hsn_sac}
                        onChange={e => handleHsnSearch(index, e.target.value)}
                        onFocus={() => {
                          if (hsnResults[index]?.length) setActiveHsnRow(index);
                        }}
                        onBlur={() => setTimeout(() => setActiveHsnRow(null), 200)}
                        placeholder="Code"
                        className="w-full px-2.5 py-2 text-sm font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                      {activeHsnRow === index && hsnResults[index]?.length > 0 && (
                        <div className="absolute z-30 right-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                          {hsnResults[index].map((h, hi) => (
                            <button
                              key={hi}
                              onMouseDown={() => selectHsn(index, h)}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition-colors border-b border-gray-50 last:border-0"
                            >
                              <span className="font-mono font-medium text-indigo-600">{h.code || h.hsn_code}</span>
                              <span className="ml-2 text-gray-600 truncate">{h.description}</span>
                              <span className="ml-2 text-xs text-indigo-500">{h.gst_rate}%</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Qty, Unit, Price, Disc, GST Rate + calculated fields */}
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-xs font-medium text-gray-400 mb-1">Qty</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={item.qty}
                        onChange={e => updateItem(index, 'qty', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm text-right font-mono border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-xs font-medium text-gray-400 mb-1">Unit</label>
                      <select
                        value={item.unit}
                        onChange={e => updateItem(index, 'unit', e.target.value)}
                        className="w-full px-1 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      >
                        <option value="NOS">NOS</option>
                        <option value="PCS">PCS</option>
                        <option value="KGS">KGS</option>
                        <option value="MTR">MTR</option>
                        <option value="LTR">LTR</option>
                        <option value="BOX">BOX</option>
                        <option value="SET">SET</option>
                        <option value="HRS">HRS</option>
                        <option value="SQM">SQM</option>
                        <option value="UNT">UNT</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-400 mb-1">Unit Price</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price}
                        onChange={e => updateItem(index, 'unit_price', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm text-right font-mono border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs font-medium text-gray-400 mb-1">Disc%</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={item.discount_pct}
                        onChange={e => updateItem(index, 'discount_pct', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm text-right font-mono border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-400 mb-1">Taxable</label>
                      <div className="px-2 py-1.5 text-sm text-right font-mono text-gray-700 bg-gray-50 rounded-md border border-gray-100">
                        {formatINR(item.taxable_value)}
                      </div>
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs font-medium text-gray-400 mb-1">GST%</label>
                      <input
                        type="number"
                        min="0"
                        max="28"
                        step="0.01"
                        value={item.gst_rate}
                        onChange={e => updateItem(index, 'gst_rate', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm text-right font-mono border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                    {isInterState ? (
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-400 mb-1">IGST</label>
                        <div className="px-2 py-1.5 text-sm text-right font-mono text-gray-700 bg-gray-50 rounded-md border border-gray-100">
                          {formatINR(item.igst)}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="col-span-1">
                          <label className="block text-xs font-medium text-gray-400 mb-1">CGST</label>
                          <div className="px-2 py-1.5 text-sm text-right font-mono text-gray-700 bg-gray-50 rounded-md border border-gray-100 text-xs">
                            {formatINR(item.cgst)}
                          </div>
                        </div>
                        <div className="col-span-1">
                          <label className="block text-xs font-medium text-gray-400 mb-1">SGST</label>
                          <div className="px-2 py-1.5 text-sm text-right font-mono text-gray-700 bg-gray-50 rounded-md border border-gray-100 text-xs">
                            {formatINR(item.sgst)}
                          </div>
                        </div>
                      </>
                    )}
                    <div className={isInterState ? 'col-span-1' : 'col-span-2'}>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Total</label>
                      <div className="px-2 py-1.5 text-sm text-right font-mono font-semibold text-gray-900 bg-indigo-50 rounded-md border border-indigo-100">
                        {formatINR(item.total)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add row button at bottom */}
            <div className="mt-3 pt-3 border-t border-gray-100">
              <button
                onClick={addRow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-indigo-600 transition-colors"
              >
                <Plus size={14} />
                Add another item
              </button>
            </div>
          </div>

          {/* Notes / Terms */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Notes & Terms</h2>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              placeholder="Payment terms, bank details, additional notes..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>
        </div>

        {/* Summary Panel - right side, sticky */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 lg:sticky lg:top-6">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Invoice Summary</h2>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-mono text-gray-700">{formatINR(summary.subtotal)}</span>
              </div>

              {summary.totalDiscount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total Discount</span>
                  <span className="font-mono text-red-600">-{formatINR(summary.totalDiscount)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Taxable Value</span>
                <span className="font-mono text-gray-700">{formatINR(summary.taxableValue)}</span>
              </div>

              <div className="border-t border-gray-100 pt-3">
                {isInterState ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">IGST</span>
                    <span className="font-mono text-gray-700">{formatINR(summary.igst)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">CGST</span>
                      <span className="font-mono text-gray-700">{formatINR(summary.cgst)}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-gray-500">SGST</span>
                      <span className="font-mono text-gray-700">{formatINR(summary.sgst)}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="border-t border-gray-200 pt-3 mt-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-semibold text-gray-900">Grand Total</span>
                  <span className="text-xl font-bold font-mono text-gray-900">{formatINR(summary.grandTotal)}</span>
                </div>
                <p className="mt-2 text-xs text-gray-500 leading-relaxed">
                  {numberToWords(Math.round(summary.grandTotal * 100) / 100)}
                </p>
              </div>
            </div>

            {/* Supply type indicator */}
            {buyerState && sellerState && (
              <div className={`mt-4 px-3 py-2 rounded-lg text-xs font-medium ${
                isInterState
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-green-50 text-green-700 border border-green-200'
              }`}>
                {isInterState ? 'Inter-State Supply (IGST)' : 'Intra-State Supply (CGST + SGST)'}
              </div>
            )}

            {/* Quick actions in summary */}
            <div className="mt-6 space-y-2">
              <button
                onClick={() => handleSave('DRAFT')}
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                <Save size={16} />
                Save as Draft
              </button>
              <button
                onClick={() => handleSave('SENT')}
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                <Send size={16} />
                Save & Send
              </button>
              <button
                onClick={() => handleSave('DRAFT', true)}
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50"
              >
                <Download size={16} />
                Save & Download PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
