const csvStore = require('../services/csvStore');

/**
 * Middleware: extract company ID from X-Company-Id header or ?companyId query param.
 * Validates company exists, attaches req.companyId, req.company, req.store (scoped).
 */
function companyScope(req, res, next) {
  const companyId = req.headers['x-company-id'] || req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ error: 'X-Company-Id header is required' });
  }

  const company = csvStore.getById('companies.csv', companyId);
  if (!company) {
    return res.status(404).json({ error: 'Company not found' });
  }

  req.companyId = companyId;
  req.company = company;
  req.store = csvStore.scoped(companyId);

  next();
}

module.exports = companyScope;
