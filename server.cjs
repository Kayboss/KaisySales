/**
 * KaisySales Node.js + SQLite Backend
 *
 * Serves the React static files AND the REST API.
 * Deploy via cPanel → Setup Node.js App → point to server.js.
 */

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const PORT = process.env.PORT || 3000;
const TOKEN_DAYS = 30;

// ----------------------------------------------------------------
// Database setup (auto-creates on first run)
// ----------------------------------------------------------------

const db = new Database(path.join(__dirname, 'database.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    business_name TEXT DEFAULT '',
    owner_name TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    location TEXT DEFAULT '',
    category TEXT DEFAULT '',
    avatar_color TEXT DEFAULT '#6F240A',
    is_onboarded INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS auth_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    item TEXT NOT NULL,
    category TEXT DEFAULT '',
    quantity INTEGER DEFAULT 1,
    unit_price REAL DEFAULT 0,
    amount TEXT DEFAULT '',
    payment_method TEXT DEFAULT 'Cash',
    date TEXT DEFAULT NULL,
    time TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    customer TEXT NOT NULL,
    date TEXT DEFAULT NULL,
    total REAL DEFAULT 0,
    status TEXT DEFAULT 'Pending',
    items TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    amount REAL DEFAULT 0,
    category TEXT DEFAULT '',
    date TEXT DEFAULT NULL,
    trend TEXT DEFAULT 'down',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    category TEXT DEFAULT '',
    quantity INTEGER DEFAULT 0,
    unit TEXT DEFAULT 'pcs',
    status TEXT DEFAULT 'In Stock',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS stores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT DEFAULT '',
    location TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    contact_name TEXT DEFAULT '',
    status TEXT DEFAULT 'Active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_tokens_token ON auth_tokens(token);
  CREATE INDEX IF NOT EXISTS idx_tokens_user ON auth_tokens(user_id);
`);

console.log('Database ready');

// ----------------------------------------------------------------
// Express app
// ----------------------------------------------------------------

const app = express();
app.use(express.json());

// Serve React static files
app.use(express.static(path.join(__dirname)));

// ----------------------------------------------------------------
// Middleware
// ----------------------------------------------------------------

function authenticate(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ success: false, error: 'Missing or invalid Authorization header' });

  const row = db.prepare(`
    SELECT u.* FROM users u
    JOIN auth_tokens t ON t.user_id = u.id
    WHERE t.token = ? AND t.expires_at > datetime('now')
    LIMIT 1
  `).get(match[1]);

  if (!row) return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  req.user = row;
  next();
}

function generateToken() {
  return crypto.randomBytes(48).toString('hex');
}

// ----------------------------------------------------------------
// Auth routes
// ----------------------------------------------------------------

app.post('/api/auth/signup', (req, res) => {
  const { email, password, businessName, ownerName, phone, location, category } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, error: 'Missing required fields' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success: false, error: 'Invalid email' });
  if (password.length < 6) return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ success: false, error: 'An account with this email already exists' });

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare(
    'INSERT INTO users (email, password_hash, business_name, owner_name, phone, location, category) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(email.toLowerCase(), hash, businessName || '', ownerName || '', phone || '', location || '', category || '');

  const token = generateToken();
  const expires = new Date(Date.now() + TOKEN_DAYS * 86400000).toISOString();
  db.prepare('INSERT INTO auth_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(info.lastInsertRowid, token, expires);

  res.json({
    success: true,
    token,
    user: { uid: String(info.lastInsertRowid), email: email.toLowerCase(), businessName: businessName || '', ownerName: ownerName || '', phone: phone || '', location: location || '', category: category || '', isOnboarded: false },
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, error: 'Missing required fields' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ success: false, error: 'Invalid email or password' });
  }

  const token = generateToken();
  const expires = new Date(Date.now() + TOKEN_DAYS * 86400000).toISOString();
  db.prepare('INSERT INTO auth_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(user.id, token, expires);

  res.json({
    success: true,
    token,
    user: {
      uid: String(user.id), email: user.email,
      businessName: user.business_name, ownerName: user.owner_name,
      phone: user.phone, location: user.location, category: user.category,
      avatarColor: user.avatar_color, isOnboarded: !!user.is_onboarded,
    },
  });
});

app.get('/api/auth/verify', authenticate, (req, res) => {
  res.json({
    success: true,
    user: {
      uid: String(req.user.id), email: req.user.email,
      businessName: req.user.business_name, ownerName: req.user.owner_name,
      phone: req.user.phone, location: req.user.location, category: req.user.category,
      avatarColor: req.user.avatar_color, isOnboarded: !!req.user.is_onboarded,
    },
  });
});

// ----------------------------------------------------------------
// Profile routes
// ----------------------------------------------------------------

app.get('/api/profile', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      uid: String(req.user.id), email: req.user.email,
      businessName: req.user.business_name, ownerName: req.user.owner_name,
      phone: req.user.phone, location: req.user.location, category: req.user.category,
      avatarColor: req.user.avatar_color, isOnboarded: !!req.user.is_onboarded,
    },
  });
});

app.put('/api/profile', authenticate, (req, res) => {
  const allowed = ['businessName', 'ownerName', 'phone', 'location', 'category', 'avatarColor', 'isOnboarded'];
  const dbMap = { businessName: 'business_name', ownerName: 'owner_name', phone: 'phone', location: 'location', category: 'category', avatarColor: 'avatar_color', isOnboarded: 'is_onboarded' };

  const sets = [];
  const vals = [];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      sets.push(`${dbMap[key]} = ?`);
      vals.push(key === 'isOnboarded' ? (req.body[key] ? 1 : 0) : req.body[key]);
    }
  }
  if (!sets.length) return res.status(400).json({ success: false, error: 'No fields to update' });

  vals.push(req.user.id);
  db.prepare(`UPDATE users SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...vals);

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({
    success: true,
    data: {
      uid: String(updated.id), email: updated.email,
      businessName: updated.business_name, ownerName: updated.owner_name,
      phone: updated.phone, location: updated.location, category: updated.category,
      avatarColor: updated.avatar_color, isOnboarded: !!updated.is_onboarded,
    },
  });
});

// ----------------------------------------------------------------
// Generic CRUD routes
// ----------------------------------------------------------------

const COLLECTIONS = ['sales', 'invoices', 'expenses', 'inventory', 'stores', 'categories'];
const ALLOWED_COLS = {
  sales: ['item', 'category', 'quantity', 'unit_price', 'amount', 'payment_method', 'date', 'time'],
  invoices: ['customer', 'date', 'total', 'status', 'items'],
  expenses: ['title', 'amount', 'category', 'date', 'trend'],
  inventory: ['name', 'category', 'quantity', 'unit', 'status'],
  stores: ['name', 'type', 'location', 'phone', 'contact_name', 'status'],
  categories: ['name'],
};

function requireCollection(req, res) {
  if (!COLLECTIONS.includes(req.params.collection)) {
    res.status(404).json({ success: false, error: 'Invalid collection' });
    return false;
  }
  return true;
}

// List records
app.get('/api/records/:collection', authenticate, (req, res) => {
  if (!requireCollection(req, res)) return;
  const rows = db.prepare(`SELECT * FROM "${req.params.collection}" WHERE user_id = ? ORDER BY id DESC`).all(req.user.id);
  const data = rows.map(r => ({ ...r, id: String(r.id) }));
  res.json({ success: true, data });
});

// Create record
app.post('/api/records/:collection', authenticate, (req, res) => {
  if (!requireCollection(req, res)) return;
  const cols = ALLOWED_COLS[req.params.collection];
  const keys = cols.filter(c => req.body[c] !== undefined);
  const placeholders = keys.map(() => '?');
  const values = keys.map(k => typeof req.body[k] === 'object' ? JSON.stringify(req.body[k]) : req.body[k]);

  const info = db.prepare(`INSERT INTO "${req.params.collection}" (user_id, ${keys.map(k => `"${k}"`).join(', ')}) VALUES (?, ${placeholders.join(', ')})`).run(req.user.id, ...values);

  const row = db.prepare(`SELECT * FROM "${req.params.collection}" WHERE id = ?`).get(info.lastInsertRowid);
  row.id = String(row.id);
  res.status(201).json({ success: true, data: row });
});

// Update record
app.put('/api/records/:collection/:id', authenticate, (req, res) => {
  if (!requireCollection(req, res)) return;
  const cols = ALLOWED_COLS[req.params.collection];
  const sets = cols.filter(c => req.body[c] !== undefined).map(c => `"${c}" = ?`);
  const values = cols.filter(c => req.body[c] !== undefined).map(k => typeof req.body[k] === 'object' ? JSON.stringify(req.body[k]) : req.body[k]);

  if (!sets.length) return res.status(400).json({ success: false, error: 'No fields to update' });

  values.push(req.user.id, req.params.id);
  const info = db.prepare(`UPDATE "${req.params.collection}" SET ${sets.join(', ')}, updated_at = datetime('now') WHERE user_id = ? AND id = ?`).run(...values);

  if (info.changes === 0) return res.status(404).json({ success: false, error: 'Record not found' });

  const row = db.prepare(`SELECT * FROM "${req.params.collection}" WHERE id = ?`).get(req.params.id);
  row.id = String(row.id);
  res.json({ success: true, data: row });
});

// Delete record
app.delete('/api/records/:collection/:id', authenticate, (req, res) => {
  if (!requireCollection(req, res)) return;
  const info = db.prepare(`DELETE FROM "${req.params.collection}" WHERE id = ? AND user_id = ?`).run(req.params.id, req.user.id);
  if (info.changes === 0) return res.status(404).json({ success: false, error: 'Record not found' });
  res.json({ success: true });
});

// ----------------------------------------------------------------
// Serve index.html for all other routes (SPA fallback)
// ----------------------------------------------------------------

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ----------------------------------------------------------------
// Start
// ----------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`KaisySales server running on port ${PORT}`);
});
