const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const root = __dirname;
const dataDir = path.join(root, "data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, "terra.sqlite"));
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
db.exec("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL UNIQUE, password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);");
db.exec("CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL, created_at TEXT NOT NULL);");
db.exec("CREATE TABLE IF NOT EXISTS properties (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, category TEXT NOT NULL, intent TEXT NOT NULL, city TEXT NOT NULL, locality TEXT NOT NULL, price INTEGER NOT NULL, area REAL NOT NULL, status TEXT NOT NULL, facing TEXT NOT NULL DEFAULT '', bedrooms INTEGER NOT NULL DEFAULT 0, lat REAL NOT NULL, lng REAL NOT NULL, description TEXT NOT NULL DEFAULT '', contact_phone TEXT NOT NULL, image TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);");
db.exec("CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, property_id TEXT REFERENCES properties(id) ON DELETE SET NULL, name TEXT NOT NULL, phone TEXT NOT NULL, intent TEXT NOT NULL, status TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'Workspace', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);");
db.exec("CREATE INDEX IF NOT EXISTS properties_owner_updated ON properties(user_id, updated_at DESC);");
db.exec("CREATE INDEX IF NOT EXISTS leads_owner_created ON leads(user_id, created_at DESC);");
db.exec("CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);");

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const PORT = Number(process.env.PORT || 4173);
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon" };
const loginAttempts = new Map();

function now() { return new Date().toISOString(); }
function json(res, status, data, extraHeaders = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extraHeaders });
  res.end(JSON.stringify(data));
}
function cookieOptions(maxAge) {
  return "Path=/; HttpOnly; SameSite=Lax; Max-Age=" + maxAge + (process.env.NODE_ENV === "production" ? "; Secure" : "");
}
function normalizedPhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) digits = "91" + digits;
  if (digits.length < 11 || digits.length > 15) return "";
  return "+" + digits;
}
function readCookies(req) {
  const result = {};
  for (const part of String(req.headers.cookie || "").split(";")) {
    const equal = part.indexOf("=");
    if (equal > -1) result[part.slice(0, equal).trim()] = decodeURIComponent(part.slice(equal + 1).trim());
  }
  return result;
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1800000) { reject(Object.assign(new Error("Request body is too large."), { status: 413 })); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}); }
      catch { reject(Object.assign(new Error("Request body must be valid JSON."), { status: 400 })); }
    });
    req.on("error", reject);
  });
}
function passwordDigest(password, salt) {
  return crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 48 * 1024 * 1024 }).toString("hex");
}
function createSession(userId, res) {
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
  const token = crypto.randomBytes(32).toString("base64url");
  db.prepare("INSERT INTO sessions(token_hash, user_id, expires_at, created_at) VALUES(?,?,?,?)").run(crypto.createHash("sha256").update(token).digest("hex"), userId, Date.now() + SESSION_MS, now());
  res.setHeader("Set-Cookie", "terra_session=" + token + "; " + cookieOptions(SESSION_MS / 1000));
}
function getUser(req) {
  const token = readCookies(req).terra_session;
  if (!token) return null;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const session = db.prepare("SELECT user_id, expires_at FROM sessions WHERE token_hash = ?").get(tokenHash);
  if (!session) return null;
  if (session.expires_at < Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
    return null;
  }
  return db.prepare("SELECT id, name, phone, created_at AS createdAt FROM users WHERE id = ?").get(session.user_id) || null;
}
function fields(user) { return { id: user.id, name: user.name, phone: user.phone, createdAt: user.createdAt || user.created_at }; }
function publicProperty(row) {
  return { id: row.id, title: row.title, category: row.category, intent: row.intent, city: row.city, locality: row.locality, price: row.price, area: row.area, status: row.status, facing: row.facing, bedrooms: row.bedrooms, lat: row.lat, lng: row.lng, description: row.description, contactPhone: row.contact_phone, image: row.image, createdAt: row.created_at, updatedAt: row.updated_at };
}
function propertyInput(body, user) {
  const categories = ["plot", "land", "apartment", "villa", "builder-floor", "office", "shop"];
  const intents = ["sale", "rent"];
  const statuses = ["Published", "Review", "Paused"];
  const title = String(body.title || "").trim().slice(0, 100);
  const city = String(body.city || "").trim().slice(0, 80);
  const locality = String(body.locality || "").trim().slice(0, 120);
  const price = Math.round(Number(body.price));
  const area = Number(body.area);
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const contactPhone = normalizedPhone(body.contactPhone || user.phone);
  const image = String(body.image || "");
  if (!title || !city || !locality) throw Object.assign(new Error("Add a title, city and locality."), { status: 400 });
  if (!categories.includes(body.category)) throw Object.assign(new Error("Choose a supported property type."), { status: 400 });
  if (!intents.includes(body.intent)) throw Object.assign(new Error("Choose sale or rent."), { status: 400 });
  if (!Number.isFinite(price) || price < 1 || price > 100000000000) throw Object.assign(new Error("Enter a valid price in rupees."), { status: 400 });
  if (!Number.isFinite(area) || area < 1 || area > 100000000) throw Object.assign(new Error("Enter a valid area in square feet."), { status: 400 });
  if (!Number.isFinite(lat) || lat < 5 || lat > 38 || !Number.isFinite(lng) || lng < 67 || lng > 99) throw Object.assign(new Error("Choose a valid location on the India map."), { status: 400 });
  if (!contactPhone) throw Object.assign(new Error("Enter a valid contact mobile number."), { status: 400 });
  if (image && (!image.startsWith("data:image/") || image.length > 1450000)) throw Object.assign(new Error("Choose an image smaller than 1 MB."), { status: 400 });
  return {
    title, category: body.category, intent: body.intent, city, locality, price, area,
    status: statuses.includes(body.status) ? body.status : "Published",
    facing: String(body.facing || "").slice(0, 30), bedrooms: Math.max(0, Math.min(30, Math.round(Number(body.bedrooms) || 0))),
    lat, lng, description: String(body.description || "").trim().slice(0, 1000), contactPhone, image,
  };
}
function leadInput(body) {
  const name = String(body.name || "").trim().slice(0, 80);
  const phone = normalizedPhone(body.phone);
  const intent = String(body.intent || "More information").trim().slice(0, 80);
  if (!name || !phone || !intent) throw Object.assign(new Error("Add a name, mobile number and enquiry type."), { status: 400 });
  return { name, phone, intent };
}
function recentLoginAllowed(key) {
  const current = Date.now();
  const existing = (loginAttempts.get(key) || []).filter((time) => current - time < 15 * 60 * 1000);
  if (existing.length >= 8) return false;
  existing.push(current);
  loginAttempts.set(key, existing);
  return true;
}
function sendError(res, error) {
  const status = Number(error.status) || 500;
  if (status >= 500) console.error("Request failed:", error.message);
  json(res, status, { error: status >= 500 ? "The request could not be completed. Please try again." : error.message });
}

async function handleApi(req, res, url) {
  const pathname = url.pathname;
  if (req.method === "GET" && pathname === "/api/session") {
    const user = getUser(req);
    return json(res, 200, { user: user ? fields(user) : null });
  }
  if (req.method === "POST" && pathname === "/api/auth/register") {
    const body = await readBody(req);
    const name = String(body.name || "").trim().replace(/\s+/g, " ").slice(0, 80);
    const phone = normalizedPhone(body.phone);
    const password = String(body.password || "");
    if (name.length < 2) return json(res, 400, { error: "Enter your name." });
    if (!phone) return json(res, 400, { error: "Enter a valid mobile number, including country code if outside India." });
    if (password.length < 8 || password.length > 128) return json(res, 400, { error: "Use a password with at least 8 characters." });
    if (db.prepare("SELECT id FROM users WHERE phone = ?").get(phone)) return json(res, 409, { error: "An account already uses this mobile number. Sign in instead." });
    const id = crypto.randomUUID();
    const salt = crypto.randomBytes(16).toString("hex");
    const digest = passwordDigest(password, salt);
    db.prepare("INSERT INTO users(id,name,phone,password_salt,password_hash,created_at) VALUES(?,?,?,?,?,?)").run(id, name, phone, salt, digest, now());
    createSession(id, res);
    return json(res, 201, { user: fields(db.prepare("SELECT id,name,phone,created_at AS createdAt FROM users WHERE id = ?").get(id)) });
  }
  if (req.method === "POST" && pathname === "/api/auth/login") {
    const body = await readBody(req);
    const phone = normalizedPhone(body.phone);
    const address = String(req.socket.remoteAddress || "local");
    if (!recentLoginAllowed(address)) return json(res, 429, { error: "Too many sign-in attempts. Try again in 15 minutes." });
    const user = phone ? db.prepare("SELECT id,name,phone,password_salt,password_hash,created_at FROM users WHERE phone = ?").get(phone) : null;
    const candidate = passwordDigest(String(body.password || "invalid"), user?.password_salt || "terra-login-check-salt");
    const valid = Boolean(user && crypto.timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(user.password_hash, "hex")));
    if (!valid) return json(res, 401, { error: "Mobile number or password is incorrect." });
    loginAttempts.delete(address);
    createSession(user.id, res);
    return json(res, 200, { user: fields(user) });
  }
  if (req.method === "POST" && pathname === "/api/auth/logout") {
    const token = readCookies(req).terra_session;
    if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(crypto.createHash("sha256").update(token).digest("hex"));
    return json(res, 200, { ok: true }, { "Set-Cookie": "terra_session=; " + cookieOptions(0) });
  }

  const user = getUser(req);
  if (!user) return json(res, 401, { error: "Sign in to access your workspace." });

  if (req.method === "GET" && pathname === "/api/bootstrap") {
    const properties = db.prepare("SELECT * FROM properties WHERE user_id = ? ORDER BY updated_at DESC").all(user.id).map(publicProperty);
    const leads = db.prepare("SELECT * FROM leads WHERE user_id = ? ORDER BY created_at DESC").all(user.id);
    return json(res, 200, { user: fields(user), properties, leads });
  }
  if (req.method === "PATCH" && pathname === "/api/me") {
    const body = await readBody(req);
    const name = String(body.name || "").trim().replace(/\s+/g, " ").slice(0, 80);
    const phone = normalizedPhone(body.phone);
    if (name.length < 2 || !phone) return json(res, 400, { error: "Enter a name and valid mobile number." });
    try { db.prepare("UPDATE users SET name = ?, phone = ? WHERE id = ?").run(name, phone, user.id); }
    catch (error) { if (String(error.message).includes("UNIQUE")) return json(res, 409, { error: "That mobile number is already linked to another account." }); throw error; }
    db.prepare("UPDATE properties SET contact_phone = ?, updated_at = ? WHERE user_id = ? AND contact_phone = ?").run(phone, now(), user.id, user.phone);
    return json(res, 200, { user: fields(db.prepare("SELECT id,name,phone,created_at AS createdAt FROM users WHERE id = ?").get(user.id)) });
  }
  if (req.method === "GET" && pathname === "/api/properties") {
    return json(res, 200, { items: db.prepare("SELECT * FROM properties WHERE user_id = ? ORDER BY updated_at DESC").all(user.id).map(publicProperty) });
  }
  if (req.method === "POST" && pathname === "/api/properties") {
    const body = await readBody(req);
    const input = propertyInput(body, user);
    const id = crypto.randomUUID();
    const stamp = now();
    db.prepare("INSERT INTO properties(id,user_id,title,category,intent,city,locality,price,area,status,facing,bedrooms,lat,lng,description,contact_phone,image,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(id,user.id,input.title,input.category,input.intent,input.city,input.locality,input.price,input.area,input.status,input.facing,input.bedrooms,input.lat,input.lng,input.description,input.contactPhone,input.image,stamp,stamp);
    return json(res, 201, { item: publicProperty(db.prepare("SELECT * FROM properties WHERE id = ?").get(id)) });
  }
  const propertyMatch = pathname.match(/^\/api\/properties\/([0-9a-f-]+)$/i);
  if (propertyMatch && req.method === "PUT") {
    const existing = db.prepare("SELECT * FROM properties WHERE id = ? AND user_id = ?").get(propertyMatch[1], user.id);
    if (!existing) return json(res, 404, { error: "Property not found." });
    const body = await readBody(req);
    const input = propertyInput(body, user);
    const image = input.image || existing.image;
    db.prepare("UPDATE properties SET title=?,category=?,intent=?,city=?,locality=?,price=?,area=?,status=?,facing=?,bedrooms=?,lat=?,lng=?,description=?,contact_phone=?,image=?,updated_at=? WHERE id=? AND user_id=?")
      .run(input.title,input.category,input.intent,input.city,input.locality,input.price,input.area,input.status,input.facing,input.bedrooms,input.lat,input.lng,input.description,input.contactPhone,image,now(),existing.id,user.id);
    return json(res, 200, { item: publicProperty(db.prepare("SELECT * FROM properties WHERE id = ?").get(existing.id)) });
  }
  if (propertyMatch && req.method === "DELETE") {
    const result = db.prepare("DELETE FROM properties WHERE id = ? AND user_id = ?").run(propertyMatch[1], user.id);
    if (!result.changes) return json(res, 404, { error: "Property not found." });
    return json(res, 200, { ok: true });
  }
  if (req.method === "GET" && pathname === "/api/leads") {
    return json(res, 200, { items: db.prepare("SELECT * FROM leads WHERE user_id = ? ORDER BY created_at DESC").all(user.id) });
  }
  if (req.method === "POST" && pathname === "/api/leads") {
    const body = await readBody(req);
    const input = leadInput(body);
    const propertyId = body.propertyId ? String(body.propertyId) : null;
    if (propertyId && !db.prepare("SELECT id FROM properties WHERE id = ? AND user_id = ?").get(propertyId, user.id)) return json(res, 404, { error: "Choose a property from your workspace." });
    const id = crypto.randomUUID();
    const stamp = now();
    db.prepare("INSERT INTO leads(id,user_id,property_id,name,phone,intent,status,source,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)").run(id,user.id,propertyId,input.name,input.phone,input.intent,"New",String(body.source || "Workspace").slice(0, 60),stamp,stamp);
    return json(res, 201, { item: db.prepare("SELECT * FROM leads WHERE id = ?").get(id) });
  }
  const leadMatch = pathname.match(/^\/api\/leads\/([0-9a-f-]+)$/i);
  if (leadMatch && req.method === "PATCH") {
    const body = await readBody(req);
    const statuses = ["New", "Contacted", "Visit scheduled", "Closed"];
    if (!statuses.includes(body.status)) return json(res, 400, { error: "Choose a valid enquiry status." });
    const result = db.prepare("UPDATE leads SET status = ?, updated_at = ? WHERE id = ? AND user_id = ?").run(body.status,now(),leadMatch[1],user.id);
    if (!result.changes) return json(res, 404, { error: "Enquiry not found." });
    return json(res, 200, { item: db.prepare("SELECT * FROM leads WHERE id = ?").get(leadMatch[1]) });
  }
  return json(res, 404, { error: "Not found." });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    const requested = decodeURIComponent(url.pathname);
    if (requested.split("/").includes("data")) { res.writeHead(404); return res.end("Not found"); }
    const candidate = path.resolve(root, "." + (requested === "/" ? "/index.html" : requested));
    if (!candidate.startsWith(root + path.sep)) { res.writeHead(403); return res.end("Forbidden"); }
    fs.readFile(candidate, (error, data) => {
      if (error) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("Not found"); }
      res.writeHead(200, {
        "Content-Type": MIME[path.extname(candidate)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Content-Security-Policy": "default-src 'self'; script-src 'self' https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://tile.openstreetmap.org; connect-src 'self'; frame-ancestors 'none'",
      });
      res.end(data);
    });
  } catch (error) { if (!res.headersSent) sendError(res, error); else res.destroy(); }
});
server.listen(PORT, "127.0.0.1", () => console.log("Terra Property Desk available at http://127.0.0.1:" + PORT));
