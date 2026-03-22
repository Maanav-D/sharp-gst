# Sharp Computers GST

A fully functional GST accounting web application running entirely on a local machine, using CSV files as the data store.

## Prerequisites

- Node.js 18+

## Quick Start

```bash
npm install
cd client && npm install && cd ..
npm run seed
npm run dev
```

Open http://localhost:5173

## Modules

- **Dashboard** — Sales metrics, GST collection, ITC, outstanding receivables, filing due date alerts, charts
- **Invoices** — Create, view, filter invoices. PDF generation. Bulk actions. Supports TAX INVOICE, PURCHASE, CREDIT NOTE, DEBIT NOTE, and more
- **Returns** — GSTR-1 preview (B2B/B2C/CDN breakdown), GSTR-3B summary, ITC Reconciliation with GSTR-2B CSV upload
- **Ledger** — Journal entries (auto-created on invoice payment), manual entries, account summary, trial balance
- **Inventory** — Product catalogue, stock levels (color-coded), stock transactions log
- **Reports** — Sales register, purchase register, HSN summary, customer outstanding, cash flow chart, tax liability trend
- **Settings** — Business info, GSTIN, invoice prefix, fiscal year configuration

## Stack

- Frontend: React 18 + Vite + Tailwind CSS
- Backend: Node.js + Express
- Data: CSV files in `server/data/` (via papaparse)
- PDF: pdfkit
- Charts: Recharts

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both frontend (5173) and backend (3001) |
| `npm run seed` | Populate CSV files with sample data |
| `npm run build` | Build production frontend |
| `npm start` | Run production server |
