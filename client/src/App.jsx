import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Invoices from './pages/Invoices';
import CreateInvoice from './pages/CreateInvoice';
import InvoiceDetail from './pages/InvoiceDetail';
import GSTR1 from './pages/GSTR1';
import GSTR3B from './pages/GSTR3B';
import ITCReconciliation from './pages/ITCReconciliation';
import Ledger from './pages/Ledger';
import Inventory from './pages/Inventory';
import Reports from './pages/Reports';
import Parties from './pages/Parties';
import SettingsPage from './pages/Settings';
import Companies from './pages/Companies';
import { useCompany } from './context/CompanyContext';

function App() {
  const { currentCompany, loading } = useCompany();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8FAFC]">
        <div className="text-slate-500 text-lg">Loading...</div>
      </div>
    );
  }

  if (!currentCompany) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8FAFC]">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-700 mb-2">No Company Found</h2>
          <p className="text-slate-500 mb-4">Run <code className="bg-slate-200 px-2 py-1 rounded">npm run seed</code> to set up initial data.</p>
        </div>
      </div>
    );
  }

  return (
    <Layout key={currentCompany.id}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/invoices/create" element={<CreateInvoice />} />
        <Route path="/invoices/:id" element={<InvoiceDetail />} />
        <Route path="/returns/gstr1" element={<GSTR1 />} />
        <Route path="/returns/gstr3b" element={<GSTR3B />} />
        <Route path="/returns/reconciliation" element={<ITCReconciliation />} />
        <Route path="/parties" element={<Parties />} />
        <Route path="/ledger" element={<Ledger />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/companies" element={<Companies />} />
      </Routes>
    </Layout>
  );
}

export default App;
