import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { companiesApi } from '../api/client';

const CompanyContext = createContext(null);

export function CompanyProvider({ children }) {
  const [companies, setCompanies] = useState([]);
  const [currentCompany, setCurrentCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshCompanies = useCallback(async () => {
    try {
      const data = await companiesApi.getAll();
      setCompanies(data);

      // Restore saved selection or pick first
      const savedId = localStorage.getItem('currentCompanyId');
      const match = data.find(c => c.id === savedId);
      if (match) {
        setCurrentCompany(match);
      } else if (data.length > 0) {
        setCurrentCompany(data[0]);
        localStorage.setItem('currentCompanyId', data[0].id);
      }
    } catch (err) {
      console.error('Failed to load companies:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCompanies();
  }, [refreshCompanies]);

  const switchCompany = useCallback((company) => {
    setCurrentCompany(company);
    localStorage.setItem('currentCompanyId', company.id);
  }, []);

  return (
    <CompanyContext.Provider value={{ companies, currentCompany, switchCompany, refreshCompanies, loading }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used within CompanyProvider');
  return ctx;
}
