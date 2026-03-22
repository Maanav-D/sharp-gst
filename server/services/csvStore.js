const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const { v4: uuidv4 } = require('uuid');

// In production (Vercel), use /tmp for writable storage; locally use ./data
const IS_VERCEL = !!process.env.VERCEL;
const DATA_DIR = IS_VERCEL ? path.join('/tmp', 'sharp-gst-data') : path.join(__dirname, '..', 'data');
const COMPANIES_DIR = path.join(DATA_DIR, 'companies');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// On Vercel cold start, run seed to generate fresh demo data
let _seedChecked = false;
function ensureSeedData() {
  if (_seedChecked) return;
  _seedChecked = true;

  // Check if data already exists
  const companiesFile = path.join(DATA_DIR, 'companies.csv');
  let hasData = false;
  if (fs.existsSync(companiesFile)) {
    const content = fs.readFileSync(companiesFile, 'utf8').trim();
    hasData = content && content.split('\n').length > 1;
  }

  if (!hasData) {
    console.log('[sharp-gst] No data found, running seed...');
    try {
      const { seedData } = require('../seed');
      seedData();
      console.log('[sharp-gst] Seed completed successfully');
    } catch (err) {
      console.error('[sharp-gst] Auto-seed failed:', err.message, err.stack);
    }
  }
}

// --- Internal helpers (accept baseDir) ---

function ensureFile(filename, baseDir) {
  const filePath = path.join(baseDir, filename);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '', 'utf8');
  }
  return filePath;
}

function readCSV(filename, baseDir) {
  const filePath = ensureFile(filename, baseDir);
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.trim()) return [];
  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  return result.data;
}

function writeCSV(filename, rows, baseDir) {
  const filePath = path.join(baseDir, filename);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tempPath = filePath + '.tmp';
  const csv = Papa.unparse(rows, { header: true });
  fs.writeFileSync(tempPath, csv, 'utf8');
  fs.renameSync(tempPath, filePath);
}

// --- Store factory ---

function buildStore(baseDir) {
  return {
    dataDir: baseDir,

    getAll(filename) {
      return readCSV(filename, baseDir).filter(r => !r.deleted_at);
    },

    getAllIncludeDeleted(filename) {
      return readCSV(filename, baseDir);
    },

    getById(filename, id) {
      return readCSV(filename, baseDir).find(r => r.id === id && !r.deleted_at) || null;
    },

    insert(filename, row) {
      const rows = readCSV(filename, baseDir);
      const now = new Date().toISOString();
      const newRow = {
        id: uuidv4(),
        ...row,
        created_at: row.created_at || now,
        updated_at: row.updated_at || now,
      };
      rows.push(newRow);
      writeCSV(filename, rows, baseDir);
      return newRow;
    },

    insertMany(filename, newRows) {
      const rows = readCSV(filename, baseDir);
      const now = new Date().toISOString();
      const inserted = newRows.map(row => ({
        id: uuidv4(),
        ...row,
        created_at: row.created_at || now,
        updated_at: row.updated_at || now,
      }));
      rows.push(...inserted);
      writeCSV(filename, rows, baseDir);
      return inserted;
    },

    update(filename, id, updates) {
      const rows = readCSV(filename, baseDir);
      const idx = rows.findIndex(r => r.id === id);
      if (idx === -1) return null;
      rows[idx] = { ...rows[idx], ...updates, updated_at: new Date().toISOString() };
      writeCSV(filename, rows, baseDir);
      return rows[idx];
    },

    softDelete(filename, id) {
      const rows = readCSV(filename, baseDir);
      const idx = rows.findIndex(r => r.id === id);
      if (idx === -1) return null;
      const now = new Date().toISOString();
      rows[idx].deleted_at = now;
      rows[idx].updated_at = now;
      writeCSV(filename, rows, baseDir);
      return rows[idx];
    },

    query(filename, filterFn) {
      return readCSV(filename, baseDir).filter(r => !r.deleted_at).filter(filterFn);
    },

    initWithHeaders(filename, headers) {
      const filePath = path.join(baseDir, filename);
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, headers.join(',') + '\n', 'utf8');
    },

    overwrite(filename, rows) {
      writeCSV(filename, rows, baseDir);
    },

    // Settings helpers (for company-scoped settings.json)
    getSettings() {
      const settingsPath = path.join(baseDir, 'settings.json');
      if (!fs.existsSync(settingsPath)) return {};
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    },

    saveSettings(data) {
      const settingsPath = path.join(baseDir, 'settings.json');
      const dir = path.dirname(settingsPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2), 'utf8');
      return data;
    },
  };
}

// Default store (global data directory — for companies.csv, hsn_master.csv)
const csvStore = buildStore(DATA_DIR);

// Factory: create a store scoped to a company's directory
csvStore.scoped = function (companyId) {
  const companyDir = path.join(COMPANIES_DIR, companyId);
  return buildStore(companyDir);
};

// Expose ensureSeedData for the API serverless function
csvStore.ensureSeedData = ensureSeedData;

module.exports = csvStore;
