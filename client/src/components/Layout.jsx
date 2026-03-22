import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileText, ClipboardList, BookOpen,
  Package, BarChart3, Settings, ChevronDown, ChevronRight, Menu, X, Users, Building2, Check,
} from 'lucide-react';
import { useCompany } from '../context/CompanyContext';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  {
    label: 'Invoices', icon: FileText, children: [
      { path: '/invoices', label: 'All Invoices' },
      { path: '/invoices/create', label: 'Create Invoice' },
    ]
  },
  {
    label: 'Returns', icon: ClipboardList, children: [
      { path: '/returns/gstr1', label: 'GSTR-1' },
      { path: '/returns/gstr3b', label: 'GSTR-3B' },
      { path: '/returns/reconciliation', label: 'ITC Reconciliation' },
    ]
  },
  { path: '/parties', label: 'Parties', icon: Users },
  { path: '/ledger', label: 'Ledger', icon: BookOpen },
  { path: '/inventory', label: 'Inventory', icon: Package },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
  { path: '/companies', label: 'Companies', icon: Building2 },
  { path: '/settings', label: 'Settings', icon: Settings },
];

function NavItem({ item, collapsed }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const isActive = item.path === location.pathname ||
    (item.children && item.children.some(c => c.path === location.pathname));

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm rounded-lg transition-colors ${
            isActive ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <item.icon size={18} />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">{item.label}</span>
              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </>
          )}
        </button>
        {open && !collapsed && (
          <div className="ml-8 mt-1 space-y-1">
            {item.children.map(child => (
              <Link
                key={child.path}
                to={child.path}
                className={`block px-3 py-2 text-sm rounded-md transition-colors ${
                  location.pathname === child.path
                    ? 'text-indigo-300 bg-indigo-600/10'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      to={item.path}
      className={`flex items-center gap-3 px-4 py-2.5 text-sm rounded-lg transition-colors ${
        isActive ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <item.icon size={18} />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
}

function CompanySwitcher() {
  const { companies, currentCompany, switchCompany } = useCompany();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!currentCompany) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors"
      >
        <div className="text-white font-semibold text-sm leading-tight truncate">
          {currentCompany.business_name}
        </div>
        <div className="text-slate-500 text-xs truncate">
          {currentCompany.gstin || 'No GSTIN'}
        </div>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
          {companies.map(c => (
            <button
              key={c.id}
              onClick={() => { switchCompany(c); setOpen(false); }}
              className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 hover:bg-slate-700 transition-colors ${
                c.id === currentCompany.id ? 'bg-indigo-600/20' : ''
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-white truncate">{c.business_name}</div>
                <div className="text-slate-500 text-xs truncate">{c.gstin || 'No GSTIN'}</div>
              </div>
              {c.id === currentCompany.id && <Check size={14} className="text-indigo-400 flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${collapsed ? 'w-16' : 'w-60'} flex-shrink-0 bg-[#0F172A] flex flex-col transition-all duration-200`}
      >
        {/* Company Switcher */}
        <div className="flex items-center gap-3 px-3 py-4 border-b border-slate-800">
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <CompanySwitcher />
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto text-slate-500 hover:text-white flex-shrink-0"
          >
            {collapsed ? <Menu size={18} /> : <X size={18} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
          {navItems.map((item, i) => (
            <NavItem key={i} item={item} collapsed={collapsed} />
          ))}
        </nav>

        {/* Footer */}
        {!collapsed && (
          <div className="px-4 py-3 border-t border-slate-800">
            <p className="text-slate-600 text-xs">Sharp GST v1.0</p>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-[#F8FAFC]">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
