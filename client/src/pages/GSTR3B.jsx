import { useState } from 'react';
import { returnsApi } from '../api/client';
import { formatINR } from '../utils/format';
import toast from 'react-hot-toast';

function SectionCard({ title, children, accent }) {
  return (
    <div className={`bg-white rounded-xl border ${accent ? 'border-indigo-200' : 'border-gray-100'} p-5 shadow-sm`}>
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function TaxRow({ label, cgst, sgst, igst, bold }) {
  const cls = bold ? 'font-semibold' : '';
  return (
    <tr className={`border-t border-gray-100 ${cls}`}>
      <td className="px-4 py-2.5 text-sm">{label}</td>
      <td className="px-4 py-2.5 text-right font-mono text-sm">{formatINR(cgst)}</td>
      <td className="px-4 py-2.5 text-right font-mono text-sm">{formatINR(sgst)}</td>
      <td className="px-4 py-2.5 text-right font-mono text-sm">{formatINR(igst)}</td>
      <td className="px-4 py-2.5 text-right font-mono text-sm font-semibold">
        {formatINR(Number(cgst || 0) + Number(sgst || 0) + Number(igst || 0))}
      </td>
    </tr>
  );
}

export default function GSTR3B() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await returnsApi.getGSTR3B(month, year);
      setData(result);
    } catch { toast.error('Failed to fetch GSTR-3B data'); }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">GSTR-3B Summary</h1>

      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Month</label>
            <select value={month} onChange={e => setMonth(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
            <select value={year} onChange={e => setYear(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button onClick={fetchData} disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {loading ? 'Loading...' : 'Generate Summary'}
          </button>
        </div>
      </div>

      {data && (
        <>
          {/* Net payable summary card */}
          <div className={`rounded-xl p-6 ${data.summary.net_payable >= 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  {data.summary.is_refundable ? 'Net Refundable' : 'Net Tax Payable'}
                </p>
                <p className={`text-3xl font-bold font-mono ${data.summary.net_payable >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatINR(Math.abs(data.summary.net_payable))}
                </p>
              </div>
              <div className="text-right text-sm text-gray-500">
                <p>Output Tax: {formatINR(data.summary.total_output_tax)}</p>
                <p>ITC Available: {formatINR(data.summary.total_itc)}</p>
              </div>
            </div>
          </div>

          {/* 3.1 Outward Supplies */}
          <SectionCard title="3.1 Outward Taxable Supplies">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Description</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">CGST</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">SGST</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">IGST</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody>
                <TaxRow label={`Taxable Value: ${formatINR(data.section3_1.taxable_value)}`}
                  cgst={data.section3_1.cgst} sgst={data.section3_1.sgst} igst={data.section3_1.igst} />
              </tbody>
            </table>
          </SectionCard>

          {/* 3.2 Inter-state supplies to unregistered */}
          <SectionCard title="3.2 Interstate Supplies to Unregistered Persons">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Taxable Value</p>
                <p className="font-mono font-semibold">{formatINR(data.section3_2.taxable_value)}</p>
              </div>
              <div>
                <p className="text-gray-500">IGST</p>
                <p className="font-mono font-semibold">{formatINR(data.section3_2.igst)}</p>
              </div>
            </div>
          </SectionCard>

          {/* 4. ITC Available */}
          <SectionCard title="4. Eligible ITC" accent>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Description</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">CGST</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">SGST</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">IGST</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody>
                <TaxRow label="ITC Available (from purchases)"
                  cgst={data.section4_itc.cgst} sgst={data.section4_itc.sgst} igst={data.section4_itc.igst} />
              </tbody>
            </table>
          </SectionCard>

          {/* 5. Net Tax Payable */}
          <SectionCard title="5. Net Tax Payable" accent>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Description</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">CGST</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">SGST</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">IGST</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody>
                <TaxRow label="Net Payable" cgst={data.section5_net.cgst}
                  sgst={data.section5_net.sgst} igst={data.section5_net.igst} bold />
              </tbody>
            </table>
          </SectionCard>
        </>
      )}
    </div>
  );
}
