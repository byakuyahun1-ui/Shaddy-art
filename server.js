/**
 * Shaddy Art - Backend Server
 * Pure Node.js (no npm install needed). Run with: node server.js
 *
 * Features:
 * - Public API to list artworks
 * - Admin login (username: Shaddy / password: jokekingmaker)
 * - Admin CRUD for artworks (add/edit/delete/mark sold, price change)
 * - Image upload (saved to /public/uploads)
 * - Simple file-based JSON "database" (data/artworks.json)
 * - Simple session via signed token in memory
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const querystring = require('querystring');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');
const DATA_FILE = path.join(ROOT, 'data', 'artworks.json');

const ADMIN_USER = 'Shaddy';
const ADMIN_PASS = 'jokekingmaker';

// In-memory session store: token -> expiry timestamp
const sessions = new Map();
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

// ---------- Ensure data file exists ----------
if (!fs.existsSync(path.dirname(DATA_FILE))) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function loadArtworks() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}
function saveArtworks(list) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
}

function makeId() {
  return 'a_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
}
function makeToken() {
  return crypto.randomBytes(24).toString('hex');
}

function getCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach(function (pair) {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

function isAuthed(req) {
  const cookies = getCookies(req);
  const token = cookies.session;
  if (!token) return false;
  const expiry = sessions.get(token);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function sendJson(res, statusCode, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req, maxBytes, cb) {
  let size = 0;
  const chunks = [];
  let tooLarge = false;
  req.on('data', function (chunk) {
    size += chunk.length;
    if (size > maxBytes) {
      tooLarge = true;
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', function () {
    if (tooLarge) return cb(new Error('Payload too large'));
    cb(null, Buffer.concat(chunks));
  });
  req.on('error', function (err) { cb(err); });
}

// ---------- Very small multipart/form-data parser (for image upload) ----------
function parseMultipart(buffer, boundary) {
  const result = { fields: {}, files: {} };
  const boundaryBuf = Buffer.from('--' + boundary);
  let start = buffer.indexOf(boundaryBuf, 0);
  while (start !== -1) {
    const nextStart = buffer.indexOf(boundaryBuf, start + boundaryBuf.length);
    if (nextStart === -1) break;
    let part = buffer.slice(start + boundaryBuf.length, nextStart);
    // strip leading CRLF and trailing CRLF
    if (part.slice(0, 2).toString() === '\r\n') part = part.slice(2);
    if (part.slice(-2).toString() === '\r\n') part = part.slice(0, -2);

    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd !== -1) {
      const headerStr = part.slice(0, headerEnd).toString('utf8');
      const content = part.slice(headerEnd + 4);

      const nameMatch = headerStr.match(/name="([^"]+)"/);
      const filenameMatch = headerStr.match(/filename="([^"]*)"/);
      const typeMatch = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);

      if (nameMatch) {
        const fieldName = nameMatch[1];
        if (filenameMatch && filenameMatch[1]) {
          result.files[fieldName] = {
            filename: filenameMatch[1],
            contentType: typeMatch ? typeMatch[1] : 'application/octet-stream',
            data: content,
          };
        } else {
          result.fields[fieldName] = content.toString('utf8');
        }
      }
    }
    start = nextStart;
  }
  return result;
}

function serveStatic(req, res, filePath) {
  fs.readFile(filePath, function (err, data) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(function (req, res) {
  const urlObj = new URL(req.url, 'http://localhost');
  const pathname = urlObj.pathname;

  // ---------- API: LOGIN ----------
  if (pathname === '/api/login' && req.method === 'POST') {
    readBody(req, 1024 * 10, function (err, buf) {
      if (err) return sendJson(res, 400, { error: 'Bad request' });
      let data;
      try {
        data = JSON.parse(buf.toString('utf8'));
      } catch (e) {
        return sendJson(res, 400, { error: 'Invalid JSON' });
      }
      if (data.username === ADMIN_USER && data.password === ADMIN_PASS) {
        const token = makeToken();
        sessions.set(token, Date.now() + SESSION_TTL_MS);
        res.setHeader(
          'Set-Cookie',
          'session=' + token + '; HttpOnly; Path=/; Max-Age=' + SESSION_TTL_MS / 1000
        );
        return sendJson(res, 200, { ok: true });
      }
      return sendJson(res, 401, { error: 'Galat username ya password' });
    });
    return;
  }

  // ---------- API: LOGOUT ----------
  if (pathname === '/api/logout' && req.method === 'POST') {
    const cookies = getCookies(req);
    if (cookies.session) sessions.delete(cookies.session);
    res.setHeader('Set-Cookie', 'session=; HttpOnly; Path=/; Max-Age=0');
    return sendJson(res, 200, { ok: true });
  }

  // ---------- API: CHECK SESSION ----------
  if (pathname === '/api/me' && req.method === 'GET') {
    return sendJson(res, 200, { loggedIn: isAuthed(req) });
  }

  // ---------- API: LIST ARTWORKS (public) ----------
  if (pathname === '/api/artworks' && req.method === 'GET') {
    return sendJson(res, 200, loadArtworks());
  }

  // ---------- API: CREATE ARTWORK (admin) ----------
  if (pathname === '/api/artworks' && req.method === 'POST') {
    if (!isAuthed(req)) return sendJson(res, 401, { error: 'Login required' });

    const contentType = req.headers['content-type'] || '';
    if (contentType.indexOf('multipart/form-data') !== -1) {
      const boundaryMatch = contentType.match(/boundary=(.+)$/);
      if (!boundaryMatch) return sendJson(res, 400, { error: 'Bad multipart' });
      readBody(req, 1024 * 1024 * 15, function (err, buf) {
        if (err) return sendJson(res, 413, { error: 'File too large (max 15MB)' });
        const parsed = parseMultipart(buf, boundaryMatch[1]);
        let imagePath = parsed.fields.imageUrl || '';
        if (parsed.files.image && parsed.files.image.data.length > 0) {
          const ext = path.extname(parsed.files.image.filename) || '.jpg';
          const fname = makeId() + ext;
          fs.writeFileSync(path.join(UPLOADS_DIR, fname), parsed.files.image.data);
          imagePath = '/uploads/' + fname;
        }
        const list = loadArtworks();
        const art = {
          id: makeId(),
          name: (parsed.fields.name || '').trim(),
          description: (parsed.fields.description || '').trim(),
          price: (parsed.fields.price || '').trim(),
          image: imagePath,
          sold: parsed.fields.sold === 'true',
          createdAt: Date.now(),
        };
        if (!art.name || !art.price) return sendJson(res, 400, { error: 'Name aur price zaroori hain' });
        list.unshift(art);
        saveArtworks(list);
        return sendJson(res, 200, art);
      });
      return;
    } else {
      readBody(req, 1024 * 1024, function (err, buf) {
        if (err) return sendJson(res, 400, { error: 'Bad request' });
        let data;
        try { data = JSON.parse(buf.toString('utf8')); } catch (e) { return sendJson(res, 400, { error: 'Invalid JSON' }); }
        const list = loadArtworks();
        const art = {
          id: makeId(),
          name: (data.name || '').trim(),
          description: (data.description || '').trim(),
          price: (data.price || '').trim(),
          image: (data.image || '').trim(),
          sold: !!data.sold,
          createdAt: Date.now(),
        };
        if (!art.name || !art.price) return sendJson(res, 400, { error: 'Name aur price zaroori hain' });
        list.unshift(art);
        saveArtworks(list);
        return sendJson(res, 200, art);
      });
      return;
    }
  }

  // ---------- API: UPDATE ARTWORK (admin) ----------
  const updateMatch = pathname.match(/^\/api\/artworks\/([^/]+)$/);
  if (updateMatch && req.method === 'PUT') {
    if (!isAuthed(req)) return sendJson(res, 401, { error: 'Login required' });
    const id = updateMatch[1];

    const contentType = req.headers['content-type'] || '';
    if (contentType.indexOf('multipart/form-data') !== -1) {
      const boundaryMatch = contentType.match(/boundary=(.+)$/);
      if (!boundaryMatch) return sendJson(res, 400, { error: 'Bad multipart' });
      readBody(req, 1024 * 1024 * 15, function (err, buf) {
        if (err) return sendJson(res, 413, { error: 'File too large (max 15MB)' });
        const parsed = parseMultipart(buf, boundaryMatch[1]);
        const list = loadArtworks();
        const art = list.find(function (a) { return a.id === id; });
        if (!art) return sendJson(res, 404, { error: 'Not found' });

        if (parsed.fields.name !== undefined) art.name = parsed.fields.name.trim();
        if (parsed.fields.description !== undefined) art.description = parsed.fields.description.trim();
        if (parsed.fields.price !== undefined) art.price = parsed.fields.price.trim();
        if (parsed.fields.sold !== undefined) art.sold = parsed.fields.sold === 'true';
        if (parsed.fields.imageUrl) art.image = parsed.fields.imageUrl.trim();
        if (parsed.files.image && parsed.files.image.data.length > 0) {
          const ext = path.extname(parsed.files.image.filename) || '.jpg';
          const fname = makeId() + ext;
          fs.writeFileSync(path.join(UPLOADS_DIR, fname), parsed.files.image.data);
          art.image = '/uploads/' + fname;
        }
        saveArtworks(list);
        return sendJson(res, 200, art);
      });
      return;
    } else {
      readBody(req, 1024 * 1024, function (err, buf) {
        if (err) return sendJson(res, 400, { error: 'Bad request' });
        let data;
        try { data = JSON.parse(buf.toString('utf8')); } catch (e) { return sendJson(res, 400, { error: 'Invalid JSON' }); }
        const list = loadArtworks();
        const art = list.find(function (a) { return a.id === id; });
        if (!art) return sendJson(res, 404, { error: 'Not found' });

        if (data.name !== undefined) art.name = String(data.name).trim();
        if (data.description !== undefined) art.description = String(data.description).trim();
        if (data.price !== undefined) art.price = String(data.price).trim();
        if (data.sold !== undefined) art.sold = !!data.sold;
        if (data.image !== undefined && data.image) art.image = String(data.image).trim();

        saveArtworks(list);
        return sendJson(res, 200, art);
      });
      return;
    }
  }

  // ---------- API: DELETE ARTWORK (admin) ----------
  if (updateMatch && req.method === 'DELETE') {
    if (!isAuthed(req)) return sendJson(res, 401, { error: 'Login required' });
    const id = updateMatch[1];
    let list = loadArtworks();
    const before = list.length;
    list = list.filter(function (a) { return a.id !== id; });
    saveArtworks(list);
    return sendJson(res, 200, { ok: true, deleted: before - list.length });
  }

  // ---------- STATIC FILES ----------
  if (pathname.startsWith('/uploads/')) {
    return serveStatic(req, res, path.join(PUBLIC_DIR, pathname));
  }
  if (pathname === '/' || pathname === '/index.html') {
    return serveStatic(req, res, path.join(PUBLIC_DIR, 'index.html'));
  }
  if (pathname === '/app.js') {
    return serveStatic(req, res, path.join(PUBLIC_DIR, 'app.js'));
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, function () {
  console.log('Shaddy Art server chal raha hai: http://localhost:' + PORT);
});
