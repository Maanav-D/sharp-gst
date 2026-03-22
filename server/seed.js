const csvStore = require('./services/csvStore');
const { v4: uuidv4 } = require('uuid');
const { getSupplyType, calculateInvoiceTotals } = require('./services/gstCalc');

const INDIAN_STATES = {
  '29': 'Karnataka', '27': 'Maharashtra', '07': 'Delhi', '33': 'Tamil Nadu',
  '06': 'Haryana', '09': 'Uttar Pradesh', '24': 'Gujarat', '36': 'Telangana',
};

const CSV_HEADERS = {
  'invoices.csv': ['id', 'invoice_number', 'invoice_type', 'invoice_date', 'due_date', 'seller_gstin', 'seller_name', 'seller_address', 'seller_state_code', 'buyer_gstin', 'buyer_name', 'buyer_address', 'buyer_state_code', 'place_of_supply', 'taxable_value', 'cgst', 'sgst', 'igst', 'total_amount', 'status', 'irn', 'notes', 'created_at', 'updated_at', 'deleted_at'],
  'line_items.csv': ['id', 'invoice_id', 'hsn_sac', 'description', 'quantity', 'unit', 'unit_price', 'discount_pct', 'taxable_value', 'gst_rate', 'cgst_amount', 'sgst_amount', 'igst_amount', 'total_amount'],
  'customers.csv': ['id', 'name', 'gstin', 'email', 'phone', 'address', 'state_code', 'gstin_type', 'created_at', 'updated_at', 'deleted_at'],
  'products.csv': ['id', 'name', 'hsn_sac', 'description', 'unit', 'default_price', 'gst_rate', 'created_at', 'updated_at', 'deleted_at'],
  'inventory.csv': ['id', 'product_id', 'transaction_type', 'quantity', 'reference_id', 'reference_type', 'notes', 'stock_after', 'transaction_date', 'created_at', 'updated_at', 'deleted_at'],
  'journal_entries.csv': ['id', 'date', 'account_name', 'account_type', 'debit', 'credit', 'narration', 'reference_id', 'reference_type', 'created_at', 'updated_at', 'deleted_at'],
  'payments.csv': ['id', 'invoice_id', 'amount', 'payment_date', 'payment_mode', 'reference_number', 'notes', 'created_at', 'updated_at', 'deleted_at'],
};

// Common HSN codes for IT/electronics business
const HSN_CODES = [
  { hsn_code: '84713010', description: 'Laptops, notebooks', gst_rate: '18', category: 'IT Equipment' },
  { hsn_code: '84713020', description: 'Desktop computers', gst_rate: '18', category: 'IT Equipment' },
  { hsn_code: '84713090', description: 'Other portable digital computers', gst_rate: '18', category: 'IT Equipment' },
  { hsn_code: '84716050', description: 'Computer keyboards', gst_rate: '18', category: 'IT Peripherals' },
  { hsn_code: '84716060', description: 'Computer mouse/pointing devices', gst_rate: '18', category: 'IT Peripherals' },
  { hsn_code: '84716070', description: 'Computer input/output units', gst_rate: '18', category: 'IT Peripherals' },
  { hsn_code: '84714100', description: 'Data processing machines with display', gst_rate: '18', category: 'IT Equipment' },
  { hsn_code: '84714900', description: 'Other data processing machines', gst_rate: '18', category: 'IT Equipment' },
  { hsn_code: '84715000', description: 'Processing units for computers', gst_rate: '18', category: 'IT Equipment' },
  { hsn_code: '84717010', description: 'Hard disk drives', gst_rate: '18', category: 'Storage' },
  { hsn_code: '84717020', description: 'Solid state drives', gst_rate: '18', category: 'Storage' },
  { hsn_code: '84717090', description: 'Other storage units', gst_rate: '18', category: 'Storage' },
  { hsn_code: '84433210', description: 'Laser printers', gst_rate: '18', category: 'Printers' },
  { hsn_code: '84433220', description: 'Inkjet printers', gst_rate: '18', category: 'Printers' },
  { hsn_code: '84433290', description: 'Other printers', gst_rate: '18', category: 'Printers' },
  { hsn_code: '84433910', description: 'Printer cartridges/toners', gst_rate: '18', category: 'Printers' },
  { hsn_code: '85285100', description: 'Computer monitors', gst_rate: '28', category: 'Displays' },
  { hsn_code: '85285200', description: 'Projectors', gst_rate: '28', category: 'Displays' },
  { hsn_code: '85285900', description: 'Other monitors/projectors', gst_rate: '28', category: 'Displays' },
  { hsn_code: '85044090', description: 'UPS and inverters', gst_rate: '18', category: 'Power' },
  { hsn_code: '85044010', description: 'Voltage stabilizers', gst_rate: '18', category: 'Power' },
  { hsn_code: '85044020', description: 'Power supply units', gst_rate: '18', category: 'Power' },
  { hsn_code: '85176200', description: 'Routers and switches', gst_rate: '18', category: 'Networking' },
  { hsn_code: '85176290', description: 'Network equipment', gst_rate: '18', category: 'Networking' },
  { hsn_code: '85176100', description: 'Base stations for networking', gst_rate: '18', category: 'Networking' },
  { hsn_code: '85444999', description: 'Network cables and connectors', gst_rate: '18', category: 'Networking' },
  { hsn_code: '85444910', description: 'USB cables', gst_rate: '18', category: 'Cables' },
  { hsn_code: '85444920', description: 'HDMI/Display cables', gst_rate: '18', category: 'Cables' },
  { hsn_code: '85423100', description: 'Processors/CPUs', gst_rate: '18', category: 'Components' },
  { hsn_code: '85423900', description: 'Other integrated circuits', gst_rate: '18', category: 'Components' },
  { hsn_code: '85340000', description: 'Printed circuit boards', gst_rate: '18', category: 'Components' },
  { hsn_code: '84718000', description: 'Other computer units', gst_rate: '18', category: 'IT Equipment' },
  { hsn_code: '84719000', description: 'Computer parts and accessories', gst_rate: '18', category: 'IT Equipment' },
  { hsn_code: '85177010', description: 'Telephone handsets', gst_rate: '18', category: 'Telecom' },
  { hsn_code: '85171100', description: 'Line telephones', gst_rate: '18', category: 'Telecom' },
  { hsn_code: '85171210', description: 'Mobile phones', gst_rate: '12', category: 'Telecom' },
  { hsn_code: '85258010', description: 'Web cameras', gst_rate: '18', category: 'IT Peripherals' },
  { hsn_code: '85182200', description: 'Computer speakers', gst_rate: '18', category: 'IT Peripherals' },
  { hsn_code: '85183000', description: 'Headphones/earphones', gst_rate: '18', category: 'IT Peripherals' },
  { hsn_code: '49019900', description: 'Computer books and manuals', gst_rate: '0', category: 'Books' },
  { hsn_code: '998311', description: 'IT consulting services', gst_rate: '18', category: 'Services' },
  { hsn_code: '998312', description: 'IT design and development services', gst_rate: '18', category: 'Services' },
  { hsn_code: '998313', description: 'IT infrastructure management', gst_rate: '18', category: 'Services' },
  { hsn_code: '998314', description: 'IT infrastructure provisioning', gst_rate: '18', category: 'Services' },
  { hsn_code: '998315', description: 'Hosting and IT infrastructure provisioning', gst_rate: '18', category: 'Services' },
  { hsn_code: '998316', description: 'IT infrastructure network management', gst_rate: '18', category: 'Services' },
  { hsn_code: '998319', description: 'Other IT services', gst_rate: '18', category: 'Services' },
  { hsn_code: '998321', description: 'Software licensing services', gst_rate: '18', category: 'Services' },
  { hsn_code: '998322', description: 'Software download services', gst_rate: '18', category: 'Services' },
  { hsn_code: '998511', description: 'Maintenance and repair services', gst_rate: '18', category: 'Services' },
];

function seedData() {
  // Step 0: Seed HSN master data (global)
  console.log('Seeding HSN master data...');
  csvStore.initWithHeaders('hsn_master.csv', ['hsn_code', 'description', 'gst_rate', 'category']);
  HSN_CODES.forEach(code => {
    csvStore.insert('hsn_master.csv', code);
  });

  // Step 1: Init global companies.csv
  console.log('Initializing companies registry...');
  csvStore.initWithHeaders('companies.csv', [
    'id', 'business_name', 'gstin', 'address', 'state', 'state_code', 'email', 'phone',
    'created_at', 'updated_at', 'deleted_at',
  ]);

  // Step 2: Create default company
  console.log('Creating default company: Sharp Computers...');
  const company = csvStore.insert('companies.csv', {
    business_name: 'Sharp Computers',
    gstin: '29ABCDE1234F1Z5',
    address: '123, MG Road, Bengaluru',
    state: 'Karnataka',
    state_code: '29',
    email: 'contact@sharpcomputers.com',
    phone: '+91-9876543210',
  });

  // Step 3: Create scoped store for this company
  const store = csvStore.scoped(company.id);

  // Step 4: Save company settings
  store.saveSettings({
    business_name: 'Sharp Computers',
    gstin: '29ABCDE1234F1Z5',
    address: '123, MG Road, Bengaluru',
    state: 'Karnataka',
    state_code: '29',
    email: 'contact@sharpcomputers.com',
    phone: '+91-9876543210',
    invoice_prefix: 'INV',
    fiscal_year_start: '04',
  });

  // Step 5: Init CSV files in company directory
  console.log('Initializing CSV files...');
  Object.entries(CSV_HEADERS).forEach(([file, headers]) => {
    store.initWithHeaders(file, headers);
  });

  // Seed Customers
  console.log('Seeding customers...');
  const customers = [
    { name: 'TechVista Solutions Pvt Ltd', gstin: '29AABCT1234Q1Z5', email: 'accounts@techvista.in', phone: '9876543210', address: '45, Koramangala, Bengaluru', state_code: '29', gstin_type: 'REGULAR' },
    { name: 'Mumbai Electronics Hub', gstin: '27BBCDE5678R2Z3', email: 'purchase@mumbaielectronics.com', phone: '9123456780', address: '12, Andheri East, Mumbai', state_code: '27', gstin_type: 'REGULAR' },
    { name: 'Delhi Hardware Store', gstin: '07CDEFG9012S3Z1', email: 'info@delhihardware.in', phone: '9988776655', address: '78, Chandni Chowk, Delhi', state_code: '07', gstin_type: 'REGULAR' },
    { name: 'Raj Computer Services', gstin: '', email: 'raj@rajcomputers.com', phone: '8877665544', address: '23, MG Road, Bengaluru', state_code: '29', gstin_type: 'UNREGISTERED' },
    { name: 'Chennai IT Solutions', gstin: '33GHIJK3456T4Z8', email: 'billing@chennaiit.co.in', phone: '7766554433', address: '56, T Nagar, Chennai', state_code: '33', gstin_type: 'REGULAR' },
  ];
  const savedCustomers = customers.map(c => store.insert('customers.csv', c));

  // Seed Products
  console.log('Seeding products...');
  const products = [
    { name: 'Laptop - Dell Inspiron 15', hsn_sac: '84713010', description: 'Dell Inspiron 15 laptop, 8GB RAM, 512GB SSD', unit: 'NOS', default_price: '45000.00', gst_rate: '18' },
    { name: 'Printer - HP LaserJet', hsn_sac: '84433210', description: 'HP LaserJet Pro M404dn', unit: 'NOS', default_price: '22000.00', gst_rate: '18' },
    { name: 'USB Mouse - Logitech', hsn_sac: '84716060', description: 'Logitech wireless mouse M235', unit: 'NOS', default_price: '800.00', gst_rate: '18' },
    { name: 'Monitor - Samsung 24"', hsn_sac: '85285100', description: 'Samsung 24-inch FHD monitor', unit: 'NOS', default_price: '12000.00', gst_rate: '28' },
    { name: 'Keyboard - TVS Gold', hsn_sac: '84716050', description: 'TVS Gold mechanical keyboard', unit: 'NOS', default_price: '2500.00', gst_rate: '18' },
    { name: 'Network Cable Cat6', hsn_sac: '85444999', description: 'Cat6 Ethernet cable, per meter', unit: 'MTR', default_price: '15.00', gst_rate: '18' },
    { name: 'UPS - APC 1000VA', hsn_sac: '85044090', description: 'APC Back-UPS 1000VA, 230V', unit: 'NOS', default_price: '5500.00', gst_rate: '18' },
    { name: 'IT Consulting Service', hsn_sac: '998311', description: 'IT consulting and advisory services', unit: 'HRS', default_price: '2000.00', gst_rate: '18' },
  ];
  const savedProducts = products.map(p => store.insert('products.csv', p));

  // Seed initial inventory (stock IN for all products)
  console.log('Seeding inventory...');
  savedProducts.forEach(p => {
    const qty = p.unit === 'MTR' ? 500 : (p.unit === 'HRS' ? 0 : Math.floor(Math.random() * 30) + 10);
    if (qty > 0) {
      store.insert('inventory.csv', {
        product_id: p.id,
        transaction_type: 'IN',
        quantity: String(qty),
        reference_id: '',
        reference_type: 'OPENING_STOCK',
        notes: 'Opening stock',
        stock_after: String(qty),
        transaction_date: '2025-12-01',
      });
    }
  });

  // Seed Invoices
  console.log('Seeding invoices...');
  const sellerInfo = {
    seller_gstin: '29ABCDE1234F1Z5',
    seller_name: 'Sharp Computers',
    seller_address: '123, MG Road, Bengaluru',
    seller_state_code: '29',
  };

  const now = new Date();
  function dateOffset(days) {
    const d = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  }

  const invoiceDefinitions = [
    { customer: 0, type: 'TAX INVOICE', dateOff: -60, status: 'PAID', items: [{ product: 0, qty: 2 }, { product: 2, qty: 5 }] },
    { customer: 0, type: 'TAX INVOICE', dateOff: -45, status: 'PAID', items: [{ product: 1, qty: 1 }] },
    { customer: 3, type: 'TAX INVOICE', dateOff: -30, status: 'SENT', items: [{ product: 4, qty: 3 }, { product: 2, qty: 10 }] },
    { customer: 0, type: 'TAX INVOICE', dateOff: -15, status: 'DRAFT', items: [{ product: 7, qty: 8 }] },
    { customer: 3, type: 'TAX INVOICE', dateOff: -5, status: 'SENT', items: [{ product: 6, qty: 2 }] },
    { customer: 1, type: 'TAX INVOICE', dateOff: -55, status: 'PAID', items: [{ product: 0, qty: 3 }] },
    { customer: 2, type: 'TAX INVOICE', dateOff: -40, status: 'PAID', items: [{ product: 0, qty: 1 }, { product: 1, qty: 1 }, { product: 2, qty: 3 }] },
    { customer: 4, type: 'TAX INVOICE', dateOff: -25, status: 'OVERDUE', items: [{ product: 3, qty: 5 }] },
    { customer: 1, type: 'TAX INVOICE', dateOff: -10, status: 'SENT', items: [{ product: 4, qty: 10 }, { product: 5, qty: 100 }] },
    { customer: 4, type: 'TAX INVOICE', dateOff: -3, status: 'DRAFT', items: [{ product: 7, qty: 20 }] },
    { customer: 2, type: 'TAX INVOICE', dateOff: -70, status: 'PAID', items: [{ product: 6, qty: 4 }] },
    { customer: 0, type: 'TAX INVOICE', dateOff: -20, status: 'SENT', items: [{ product: 3, qty: 2 }, { product: 5, qty: 50 }] },
    { customer: 1, type: 'TAX INVOICE', dateOff: -8, status: 'OVERDUE', items: [{ product: 1, qty: 2 }] },
    { customer: 3, type: 'TAX INVOICE', dateOff: -2, status: 'DRAFT', items: [{ product: 2, qty: 20 }] },
    { customer: 1, type: 'PURCHASE', dateOff: -65, status: 'PAID', items: [{ product: 0, qty: 10 }], reverse: true },
    { customer: 2, type: 'PURCHASE', dateOff: -50, status: 'PAID', items: [{ product: 1, qty: 5 }, { product: 2, qty: 50 }], reverse: true },
    { customer: 4, type: 'PURCHASE', dateOff: -35, status: 'PAID', items: [{ product: 3, qty: 10 }], reverse: true },
    { customer: 1, type: 'PURCHASE', dateOff: -20, status: 'SENT', items: [{ product: 4, qty: 20 }], reverse: true },
    { customer: 2, type: 'PURCHASE', dateOff: -7, status: 'SENT', items: [{ product: 6, qty: 8 }], reverse: true },
    { customer: 0, type: 'CREDIT NOTE', dateOff: -12, status: 'SENT', items: [{ product: 2, qty: 2 }] },
  ];

  const savedInvoices = [];

  invoiceDefinitions.forEach((def, idx) => {
    const cust = savedCustomers[def.customer];
    const invoiceDate = dateOffset(def.dateOff);
    const dueDate = dateOffset(def.dateOff + 30);

    let buyerStateCode = cust.state_code;
    let buyerGstin = cust.gstin;
    let buyerName = cust.name;
    let buyerAddress = cust.address;

    const supplyType = getSupplyType(sellerInfo.seller_state_code, buyerStateCode, buyerStateCode);

    const lineItems = def.items.map(item => {
      const prod = savedProducts[item.product];
      return {
        hsn_sac: prod.hsn_sac,
        description: prod.name,
        quantity: String(item.qty),
        unit: prod.unit,
        unit_price: prod.default_price,
        discount_pct: '0',
        gst_rate: prod.gst_rate,
      };
    });

    const calc = calculateInvoiceTotals(lineItems, supplyType);
    const prefix = 'INV';
    const month = invoiceDate.substring(5, 7);
    const year = invoiceDate.substring(0, 4);

    const invoice = store.insert('invoices.csv', {
      invoice_number: `${prefix}-${year}-${month}-${String(idx + 1).padStart(3, '0')}`,
      invoice_type: def.type,
      invoice_date: invoiceDate,
      due_date: dueDate,
      ...sellerInfo,
      buyer_gstin: buyerGstin,
      buyer_name: buyerName,
      buyer_address: buyerAddress,
      buyer_state_code: buyerStateCode,
      place_of_supply: buyerStateCode,
      taxable_value: calc.taxable_value,
      cgst: calc.cgst,
      sgst: calc.sgst,
      igst: calc.igst,
      total_amount: calc.total_amount,
      status: def.status,
      irn: '',
      notes: '',
    });

    calc.lineItems.forEach(li => {
      store.insert('line_items.csv', {
        invoice_id: invoice.id,
        hsn_sac: li.hsn_sac,
        description: li.description,
        quantity: li.quantity,
        unit: li.unit,
        unit_price: li.unit_price,
        discount_pct: li.discount_pct || '0',
        taxable_value: li.taxable_value,
        gst_rate: li.gst_rate,
        cgst_amount: li.cgst_amount,
        sgst_amount: li.sgst_amount,
        igst_amount: li.igst_amount,
        total_amount: li.total_amount,
      });
    });

    savedInvoices.push(invoice);

    if (def.status === 'PAID') {
      const modes = ['BANK_TRANSFER', 'UPI', 'CHEQUE', 'CARD'];
      store.insert('payments.csv', {
        invoice_id: invoice.id,
        amount: calc.total_amount,
        payment_date: dateOffset(def.dateOff + 10),
        payment_mode: modes[idx % modes.length],
        reference_number: `PAY-${String(idx + 1).padStart(4, '0')}`,
        notes: `Payment for ${invoice.invoice_number}`,
      });

      const totalTax = Number(calc.cgst) + Number(calc.sgst) + Number(calc.igst);
      const isPurchase = def.type === 'PURCHASE';

      if (isPurchase) {
        store.insert('journal_entries.csv', {
          date: dateOffset(def.dateOff + 10),
          account_name: 'Purchases', account_type: 'EXPENSE',
          debit: calc.taxable_value, credit: '0.00',
          narration: `Purchase - ${invoice.invoice_number}`,
          reference_id: invoice.id, reference_type: 'INVOICE',
        });
        store.insert('journal_entries.csv', {
          date: dateOffset(def.dateOff + 10),
          account_name: 'Input GST (ITC)', account_type: 'ASSET',
          debit: totalTax.toFixed(2), credit: '0.00',
          narration: `ITC on ${invoice.invoice_number}`,
          reference_id: invoice.id, reference_type: 'INVOICE',
        });
        store.insert('journal_entries.csv', {
          date: dateOffset(def.dateOff + 10),
          account_name: 'Bank', account_type: 'ASSET',
          debit: '0.00', credit: calc.total_amount,
          narration: `Payment for ${invoice.invoice_number}`,
          reference_id: invoice.id, reference_type: 'INVOICE',
        });
      } else {
        store.insert('journal_entries.csv', {
          date: dateOffset(def.dateOff + 10),
          account_name: 'Bank', account_type: 'ASSET',
          debit: calc.total_amount, credit: '0.00',
          narration: `Received for ${invoice.invoice_number}`,
          reference_id: invoice.id, reference_type: 'INVOICE',
        });
        store.insert('journal_entries.csv', {
          date: dateOffset(def.dateOff + 10),
          account_name: 'Sales', account_type: 'INCOME',
          debit: '0.00', credit: calc.taxable_value,
          narration: `Sale - ${invoice.invoice_number}`,
          reference_id: invoice.id, reference_type: 'INVOICE',
        });
        store.insert('journal_entries.csv', {
          date: dateOffset(def.dateOff + 10),
          account_name: 'GST Payable', account_type: 'LIABILITY',
          debit: '0.00', credit: totalTax.toFixed(2),
          narration: `GST on ${invoice.invoice_number}`,
          reference_id: invoice.id, reference_type: 'INVOICE',
        });
      }
    }

    if (def.status === 'SENT' || def.status === 'PAID') {
      def.items.forEach(item => {
        const prod = savedProducts[item.product];
        if (prod.unit === 'HRS') return;
        const txnType = def.type === 'PURCHASE' ? 'IN' : 'OUT';
        store.insert('inventory.csv', {
          product_id: prod.id,
          transaction_type: txnType,
          quantity: String(item.qty),
          reference_id: invoice.id,
          reference_type: 'INVOICE',
          notes: `${txnType === 'IN' ? 'Purchase' : 'Sale'} - ${invoice.invoice_number}`,
          stock_after: '0',
          transaction_date: invoiceDate,
        });
      });
    }
  });

  console.log(`\nSeeded for company: ${company.business_name} (${company.id})`);
  console.log(`  - ${savedCustomers.length} customers`);
  console.log(`  - ${savedProducts.length} products`);
  console.log(`  - ${savedInvoices.length} invoices`);
  console.log(`  - ${store.getAll('line_items.csv').length} line items`);
  console.log(`  - ${store.getAll('payments.csv').length} payments`);
  console.log(`  - ${store.getAll('journal_entries.csv').length} journal entries`);
  console.log(`  - ${store.getAll('inventory.csv').length} inventory transactions`);
  console.log('\nDone! Run `npm run dev` to start the application.');
}

seedData();
