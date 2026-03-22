const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const { v4: uuidv4 } = require('uuid');

// In production (Vercel), use /tmp for writable storage; locally use ./data
const IS_VERCEL = !!process.env.VERCEL;
const BUNDLED_DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_DIR = IS_VERCEL ? path.join('/tmp', 'sharp-gst-data') : BUNDLED_DATA_DIR;
const COMPANIES_DIR = path.join(DATA_DIR, 'companies');

// Copy directory recursively
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// On Vercel cold start, copy bundled CSV data to /tmp
let _seedChecked = false;
function ensureSeedData() {
  if (_seedChecked) return;
  _seedChecked = true;
  if (!IS_VERCEL) return;

  const companiesFile = path.join(DATA_DIR, 'companies.csv');
  if (fs.existsSync(companiesFile)) {
    const content = fs.readFileSync(companiesFile, 'utf8').trim();
    if (content && content.split('\n').length > 1) return; // already has data
  }

  // Copy bundled data from server/data/ to /tmp
  console.log('[sharp-gst] Copying bundled data to /tmp...');
  console.log('[sharp-gst] Source:', BUNDLED_DATA_DIR, 'exists:', fs.existsSync(BUNDLED_DATA_DIR));
  try {
    copyDirSync(BUNDLED_DATA_DIR, DATA_DIR);
    console.log('[sharp-gst] Data copied successfully');
  } catch (err) {
    console.error('[sharp-gst] Copy failed:', err.message);
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
