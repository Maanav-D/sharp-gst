import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoicesApi } from '../api/client';
import { formatINR, formatDate, STATUS_COLORS } from '../utils/format';
import { FileText, Download, XCircle, Search, Filter } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUSES = ['', 'DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'];

const SORTABLE_KEYS = {
  invoice_no: 'Invoice No',
  date: 'Date',
  buyer_name: 'Buyer',
  type: 'Type',
  taxable_value: 'Taxable Value',
  gst: 'GST',
  total: 'Total',
  status: 'Status',
};

function SortIcon({ column, sortKey, sortDir }) {
  if (sortKey !== column) {
    return <span className="ml-1 text-gray-300 text-xs">&#8597;</span>;
  }
  return (
    <span className="ml-1 text-indigo-500 text-xs">
      {sortDir === 'asc' ? '\u25B2' : '\u25BC'}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-3 py-2"><div className="h-4 w-4 bg-gray-200 rounded" /></td>
      {[...Array(9)].map((_, i) => (
        <td key={i} className="px-3 py-2">
          <div className="h-4 bg-gray-200 rounded w-full" />
        </td>
      ))}
    </tr>
  );
}

export default function Invoices() {
  const navigate = useNavigate();

  // Data state
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchText, setSearchText] = useState('');

  // Sort state
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  // Selection state
  const [selected, setSelected] = useState(new Set());

  // Fetch invoices
  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      if (searchText.trim()) params.buyer = searchText.trim();

      const data = await invoicesApi.getAll(params);
      setInvoices(Array.isArray(data) ? data : data.invoices || []);
      setSelected(new Set());
    } catch (err) {
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, fromDate, toDate, searchText]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Sort invoices locally
  const sortedInvoices = useMemo(() => {
    const copy = [...invoices];
    copy.sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];

      // Numeric columns
      if (['taxable_value', 'gst', 'total'].includes(sortKey)) {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // Date column
      if (sortKey === 'date') {
        aVal = new Date(aVal || 0).getTime();
        bVal = new Date(bVal || 0).getTime();
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // String columns
      aVal = String(aVal || '').toLowerCase();
      bVal = String(bVal || '').toLowerCase();
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [invoices, sortKey, sortDir]);

  // Toggle sort
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // Selection helpers
  const allSelected = sortedInvoices.length > 0 && selected.size === sortedInvoices.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sortedInvoices.map(inv => inv.id)));
    }
  };

  const toggleOne = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Bulk actions
  const handleBulkAction = async (action) => {
    if (selected.size === 0) return;
    try {
      await invoicesApi.bulkAction([...selected], action);
      toast.success(`${selected.size} invoice(s) marked as ${action === 'mark_sent' ? 'Sent' : 'Paid'}`);
      fetchInvoices();
    } catch (err) {
      toast.error(`Bulk action failed: ${err.message || 'Unknown error'}`);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const rows = sortedInvoices.filter(inv => selected.has(inv.id));
    if (rows.length === 0) {
      toast.error('No invoices selected for export');
      return;
    }

    const headers = ['Invoice No', 'Date', 'Buyer', 'Type', 'Taxable Value', 'GST', 'Total', 'Status'];
    const csvContent = [
      headers.join(','),
      ...rows.map(inv => [
        `"${inv.invoice_no || ''}"`,
        `"${inv.date || ''}"`,
        `"${(inv.buyer_name || '').replace(/"/g, '""')}"`,
        `"${inv.type || ''}"`,
        inv.taxable_value || 0,
        inv.gst || 0,
        inv.total || 0,
        `"${inv.status || ''}"`,
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `invoices_export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} invoice(s) to CSV`);
  };

  // Cancel invoice
  const handleCancel = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to cancel this invoice? This action cannot be undone.')) return;
    try {
      await invoicesApi.cancel(id);
      toast.success('Invoice cancelled');
      fetchInvoices();
    } catch (err) {
      toast.error(`Failed to cancel invoice: ${err.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Invoices</h1>
        <button
          onClick={() => navigate('/invoices/create')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <FileText size={16} />
          New Invoice
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3 text-sm font-medium text-gray-600">
          <Filter size={14} />
          Filters
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
            >
              {STATUSES.map(s => (
                <option key={s} value={s}>{s || 'All Statuses'}</option>
              ))}
            </select>
          </div>

          {/* From Date */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
            />
          </div>

          {/* Search */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Search Buyer</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Buyer name..."
                className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex items-center justify-between shadow-sm">
          <span className="text-sm font-medium text-indigo-700">
            {selected.size} invoice{selected.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkAction('mark_sent')}
              className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Mark as Sent
            </button>
            <button
              onClick={() => handleBulkAction('mark_paid')}
              className="px-3 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Mark as Paid
            </button>
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download size={14} />
              Export CSV
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                {Object.entries(SORTABLE_KEYS).map(([key, label]) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 transition-colors whitespace-nowrap"
                  >
                    {label}
                    <SortIcon column={key} sortKey={sortKey} sortDir={sortDir} />
                  </th>
                ))}
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                [...Array(8)].map((_, i) => <SkeletonRow key={i} />)
              ) : sortedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-16 text-center">
                    <FileText size={40} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 font-medium">No invoices found</p>
                    <p className="text-gray-400 text-xs mt-1">
                      Try adjusting your filters or create a new invoice
                    </p>
                  </td>
                </tr>
              ) : (
                sortedInvoices.map((inv, idx) => (
                  <tr
                    key={inv.id}
                    onClick={() => navigate(`/invoices/${inv.id}`)}
                    className={`h-10 cursor-pointer transition-colors hover:bg-gray-100 ${
                      idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'
                    }`}
                  >
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(inv.id)}
                        onChange={() => toggleOne(inv.id)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-3 py-2 font-medium text-indigo-600 whitespace-nowrap">
                      {inv.invoice_no}
                    </td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                      {formatDate(inv.date)}
                    </td>
                    <td className="px-3 py-2 text-gray-700 max-w-[180px] truncate">
                      {inv.buyer_name}
                    </td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                      {inv.type}
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-700 whitespace-nowrap text-right">
                      {formatINR(inv.taxable_value)}
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-700 whitespace-nowrap text-right">
                      {formatINR(inv.gst)}
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-900 font-medium whitespace-nowrap text-right">
                      {formatINR(inv.total)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        STATUS_COLORS[inv.status] || 'bg-gray-100 text-gray-600'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => navigate(`/invoices/${inv.id}`)}
                          title="View"
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                        >
                          <FileText size={14} />
                        </button>
                        <button
                          onClick={() => window.open(invoicesApi.getPdfUrl(inv.id), '_blank')}
                          title="Download PDF"
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        >
                          <Download size={14} />
                        </button>
                        {inv.status !== 'CANCELLED' && (
                          <button
                            onClick={(e) => handleCancel(e, inv.id)}
                            title="Cancel"
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          >
                            <XCircle size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
