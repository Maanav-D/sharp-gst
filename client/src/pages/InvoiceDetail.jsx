import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invoicesApi } from '../api/client';
import { formatINR, formatDate, STATUS_COLORS } from '../utils/format';
import toast from 'react-hot-toast';
import { ArrowLeft, Download, Send, CheckCircle, XCircle } from 'lucide-react';

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoicesApi.getById(id).then(setInvoice).catch(() => toast.error('Invoice not found')).finally(() => setLoading(false));
  }, [id]);

  const updateStatus = async (status) => {
    try {
      const updated = await invoicesApi.update(id, { status });
      setInvoice(prev => ({ ...prev, ...updated }));
      toast.success(`Invoice marked as ${status}`);
    } catch { toast.error('Failed to update'); }
  };

  if (loading) return (
    <div className="space-y-4">
      <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse"></div>
      <div className="bg-white rounded-xl p-6 h-64 animate-pulse"></div>
    </div>
  );

  if (!invoice) return <p>Invoice not found.</p>;

  const lineItems = invoice.line_items || [];
  const hasIgst = Number(invoice.igst) > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/invoices')} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-gray-900">{invoice.invoice_number}</h1>
          <p className="text-sm text-gray-500">{invoice.invoice_type}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[invoice.status] || ''}`}>
          {invoice.status}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <a href={invoicesApi.getPdfUrl(id)} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
          <Download size={16} /> Download PDF
        </a>
        {invoice.status === 'DRAFT' && (
          <button onClick={() => updateStatus('SENT')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            <Send size={16} /> Mark as Sent
          </button>
        )}
        {(invoice.status === 'SENT' || invoice.status === 'OVERDUE') && (
          <button onClick={() => updateStatus('PAID')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">
            <CheckCircle size={16} /> Mark as Paid
          </button>
        )}
        {invoice.status !== 'CANCELLED' && invoice.status !== 'PAID' && (
          <button onClick={() => {
            if (confirm('Cancel this invoice?')) {
              invoicesApi.cancel(id).then(() => {
                setInvoice(prev => ({ ...prev, status: 'CANCELLED' }));
                toast.success('Invoice cancelled');
              });
            }
          }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 text-sm rounded-lg hover:bg-red-100">
            <XCircle size={16} /> Cancel Invoice
          </button>
        )}
      </div>

      {/* Invoice details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Seller Details</h3>
          <p className="font-semibold text-gray-900">{invoice.seller_name}</p>
          <p className="text-sm text-gray-600">GSTIN: {invoice.seller_gstin}</p>
          <p className="text-sm text-gray-600">{invoice.seller_address}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Buyer Details</h3>
          <p className="font-semibold text-gray-900">{invoice.buyer_name}</p>
          <p className="text-sm text-gray-600">GSTIN: {invoice.buyer_gstin || 'N/A'}</p>
          <p className="text-sm text-gray-600">{invoice.buyer_address}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div><span className="text-gray-500">Invoice Date:</span><br/><span className="font-medium">{formatDate(invoice.invoice_date)}</span></div>
        <div><span className="text-gray-500">Due Date:</span><br/><span className="font-medium">{formatDate(invoice.due_date)}</span></div>
        <div><span className="text-gray-500">Place of Supply:</span><br/><span className="font-medium">{invoice.place_of_supply}</span></div>
        <div><span className="text-gray-500">Supply Type:</span><br/><span className="font-medium">{hasIgst ? 'Inter-State' : 'Intra-State'}</span></div>
      </div>

      {/* Line items table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">#</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Description</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">HSN</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Qty</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Unit Price</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Taxable</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">GST</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, i) => {
              const gst = Number(item.cgst_amount || 0) + Number(item.sgst_amount || 0) + Number(item.igst_amount || 0);
              return (
                <tr key={item.id} className={`border-t border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50'} hover:bg-gray-100`}>
                  <td className="px-4 py-2.5">{i + 1}</td>
                  <td className="px-4 py-2.5">{item.description}</td>
                  <td className="px-4 py-2.5 text-gray-500">{item.hsn_sac}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{item.quantity} {item.unit}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{formatINR(item.unit_price)}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{formatINR(item.taxable_value)}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{formatINR(gst)}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-medium">{formatINR(item.total_amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="flex justify-end">
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm w-80">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Taxable Value</span><span className="font-mono">{formatINR(invoice.taxable_value)}</span></div>
            {hasIgst ? (
              <div className="flex justify-between"><span className="text-gray-500">IGST</span><span className="font-mono">{formatINR(invoice.igst)}</span></div>
            ) : (
              <>
                <div className="flex justify-between"><span className="text-gray-500">CGST</span><span className="font-mono">{formatINR(invoice.cgst)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">SGST</span><span className="font-mono">{formatINR(invoice.sgst)}</span></div>
              </>
            )}
            <div className="border-t border-gray-200 pt-2 flex justify-between font-semibold text-lg">
              <span>Grand Total</span>
              <span className="font-mono text-indigo-600">{formatINR(invoice.total_amount)}</span>
            </div>
          </div>
        </div>
      </div>

      {invoice.notes && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Notes</h3>
          <p className="text-sm text-gray-600">{invoice.notes}</p>
        </div>
      )}
    </div>
  );
}
