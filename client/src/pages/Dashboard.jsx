import { useState, useEffect } from 'react';
import { dashboardApi } from '../api/client';
import { formatINR } from '../utils/format';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, IndianRupee, Clock, AlertTriangle, Package } from 'lucide-react';

const PIE_COLORS = {
  DRAFT: '#9CA3AF', SENT: '#3B82F6', PAID: '#22C55E', OVERDUE: '#EF4444', CANCELLED: '#D1D5DB',
};

function MetricCard({ title, value, icon: Icon, color = 'indigo', subtitle }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
    blue: 'bg-blue-50 text-blue-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900 font-mono">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
        </div>
        <div className={`p-2.5 rounded-lg ${colors[color]}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function FilingAlert({ title, dueDate, daysRemaining }) {
  const urgent = daysRemaining <= 5;
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${
      urgent ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
    }`}>
      <div className="flex items-center gap-2">
        <Clock size={16} className={urgent ? 'text-red-500' : 'text-amber-500'} />
        <span className="text-sm font-medium">{title}</span>
      </div>
      <div className="text-right">
        <span className={`text-sm font-semibold ${urgent ? 'text-red-600' : 'text-amber-600'}`}>
          {daysRemaining} days
        </span>
        <p className="text-xs text-gray-500">Due: {dueDate}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi.get().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 h-28 animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-1/3 mb-3"></div>
              <div className="h-6 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return <p>Error loading dashboard data.</p>;

  const { metrics, charts, filingAlerts, lowStock } = data;
  const statusData = Object.entries(charts.statusDistribution)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>

      {/* Metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard title="Sales MTD" value={formatINR(metrics.salesMTD)} icon={TrendingUp} color="green"
          subtitle={`YTD: ${formatINR(metrics.salesYTD)}`} />
        <MetricCard title="GST Collected MTD" value={formatINR(metrics.gstCollectedMTD)} icon={IndianRupee} color="indigo" />
        <MetricCard title="ITC Available MTD" value={formatINR(metrics.itcAvailableMTD)} icon={TrendingDown} color="blue" />
        <MetricCard title="Net Tax Liability" value={formatINR(metrics.netTaxLiability)} icon={IndianRupee}
          color={Number(metrics.netTaxLiability) > 0 ? 'red' : 'green'} />
        <MetricCard title="Outstanding Receivables" value={formatINR(metrics.outstanding)} icon={Clock} color="amber" />
        <MetricCard title="Due in 7 Days" value={`${metrics.dueSoonCount} invoices`} icon={AlertTriangle} color="red"
          subtitle={formatINR(metrics.dueSoonAmount)} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Sales vs Purchases */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Monthly Sales vs Purchases</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={charts.monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatINR(v)} />
              <Legend />
              <Bar dataKey="sales" name="Sales" fill="#4F46E5" radius={[4, 4, 0, 0]} />
              <Bar dataKey="purchases" name="Purchases" fill="#94A3B8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* GST Liability Trend */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">GST Liability Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={charts.gstTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatINR(v)} />
              <Line type="monotone" dataKey="liability" name="Net Liability" stroke="#4F46E5" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invoice Status */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Invoice Status</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                dataKey="value" nameKey="name" label={({ name, value }) => `${name}: ${value}`}>
                {statusData.map(entry => (
                  <Cell key={entry.name} fill={PIE_COLORS[entry.name]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Filing Alerts */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Filing Due Dates</h3>
          <div className="space-y-3">
            <FilingAlert title="GSTR-1" dueDate={filingAlerts.gstr1.dueDate}
              daysRemaining={filingAlerts.gstr1.daysRemaining} />
            <FilingAlert title="GSTR-3B" dueDate={filingAlerts.gstr3b.dueDate}
              daysRemaining={filingAlerts.gstr3b.daysRemaining} />
          </div>
        </div>

        {/* Low Stock */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Low Stock Alerts</h3>
          {lowStock.length === 0 ? (
            <p className="text-sm text-gray-500">All products are well stocked.</p>
          ) : (
            <div className="space-y-2">
              {lowStock.map(p => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded-lg border border-red-200 bg-red-50">
                  <div className="flex items-center gap-2">
                    <Package size={14} className="text-red-500" />
                    <span className="text-sm">{p.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-red-600">{p.current_stock} left</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
