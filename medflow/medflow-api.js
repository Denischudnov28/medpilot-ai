const crypto = require("node:crypto");
const express = require("express");
const { Pool } = require("pg");

const TOKEN_TTL_SECONDS = 43200;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function b64url(value) { return Buffer.from(value).toString("base64url"); }
function signToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const input = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" })) + "." +
    b64url(JSON.stringify({ sub: user.id, email: user.email, iat: now, exp: now + TOKEN_TTL_SECONDS }));
  return input + "." + crypto.createHmac("sha256", process.env.MEDFLOW_TOKEN_SECRET).update(input).digest("base64url");
}
function verifyToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  const input = parts[0] + "." + parts[1];
  const expected = crypto.createHmac("sha256", process.env.MEDFLOW_TOKEN_SECRET).update(input).digest();
  let actual;
  try { actual = Buffer.from(parts[2], "base64url"); } catch { return null; }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return payload.sub && UUID_RE.test(payload.sub) && payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
  } catch { return null; }
}
async function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const key = await new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (e, k) => e ? reject(e) : resolve(k)));
  return { salt, hash: key.toString("hex") };
}
async function verifyPassword(password, salt, hash) {
  const actual = Buffer.from((await hashPassword(password, salt)).hash, "hex");
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
function cleanText(value, max, required = false) {
  if (typeof value !== "string") return required ? null : "";
  const result = value.trim();
  return required && !result ? null : result.slice(0, max);
}

function mountMedflowApi(app) {
  if (!process.env.DATABASE_URL || !process.env.MEDFLOW_TOKEN_SECRET) {
    app.get("/api/medflow/status", (_req, res) => res.status(503).json({
      ready: false, message: "Нужно настроить DATABASE_URL и MEDFLOW_TOKEN_SECRET."
    }));
    return;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
    max: 5, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000
  });
  const schema = [
    "CREATE TABLE IF NOT EXISTS medflow_users (id uuid PRIMARY KEY, email text NOT NULL UNIQUE, password_hash text NOT NULL, password_salt text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())",
    "CREATE TABLE IF NOT EXISTS medflow_patients (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES medflow_users(id) ON DELETE CASCADE, display_code varchar(40) NOT NULL, unit varchar(80) NOT NULL DEFAULT '', handoff_note varchar(1000) NOT NULL DEFAULT '', status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','discharged')), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())",
    "CREATE INDEX IF NOT EXISTS medflow_patients_user_updated_idx ON medflow_patients(user_id, updated_at DESC)",
    "CREATE TABLE IF NOT EXISTS medflow_notes (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES medflow_users(id) ON DELETE CASCADE, body varchar(2000) NOT NULL, created_at timestamptz NOT NULL DEFAULT now())",
    "CREATE INDEX IF NOT EXISTS medflow_notes_user_created_idx ON medflow_notes(user_id, created_at DESC)"
  ].join(";");

  let schemaReady = false;
  const ready = pool.query(schema).then(() => { schemaReady = true; })
    .catch(error => console.error("MEDFLOW database initialization failed:", error.message));

  const requireAuth = (req, res, next) => {
    const match = (req.headers.authorization || "").match(/^Bearer\s+(.+)$/i);
    const payload = match && verifyToken(match[1]);
    if (!payload) return res.status(401).json({ error: "Сессия истекла. Войдите снова." });
    req.medflowUser = payload;
    next();
  };

  app.get("/api/medflow/status", async (_req, res) => {
    try { await ready; if (!schemaReady) return res.status(503).json({ ready: false }); await pool.query("SELECT 1"); res.json({ ready: true, authentication: true, sync: true }); }
    catch { res.status(503).json({ ready: false }); }
  });

  const auth = express.Router();
  auth.post("/register", async (req, res) => {
    try {
      const email = cleanText(req.body?.email, 254, true)?.toLowerCase();
      const password = req.body?.password;
      if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: "Укажите корректный email." });
      if (typeof password !== "string" || password.length < 10 || password.length > 200) return res.status(400).json({ error: "Пароль должен содержать от 10 до 200 символов." });
      await ready;
      if (!schemaReady) return res.status(503).json({ error: "База данных временно недоступна." });
      const credentials = await hashPassword(password);
      const result = await pool.query(
        "INSERT INTO medflow_users(id,email,password_hash,password_salt) VALUES($1,$2,$3,$4) RETURNING id,email",
        [crypto.randomUUID(), email, credentials.hash, credentials.salt]
      );
      const user = result.rows[0];
      res.status(201).json({ token: signToken(user), user });
    } catch (error) {
      if (error.code === "23505") return res.status(409).json({ error: "Аккаунт с таким email уже существует." });
      console.error("MEDFLOW registration failed:", error.message);
      res.status(500).json({ error: "Не удалось создать аккаунт." });
    }
  });
  auth.post("/login", async (req, res) => {
    try {
      const email = cleanText(req.body?.email, 254, true)?.toLowerCase();
      const password = req.body?.password;
      if (!email || typeof password !== "string" || password.length > 200) return res.status(400).json({ error: "Проверьте email и пароль." });
      await ready;
      if (!schemaReady) return res.status(503).json({ error: "База данных временно недоступна." });
      const result = await pool.query("SELECT id,email,password_hash,password_salt FROM medflow_users WHERE email=$1", [email]);
      const user = result.rows[0];
      if (!user || !(await verifyPassword(password, user.password_salt, user.password_hash))) return res.status(401).json({ error: "Неверный email или пароль." });
      res.json({ token: signToken(user), user: { id: user.id, email: user.email } });
    } catch (error) {
      console.error("MEDFLOW login failed:", error.message);
      res.status(500).json({ error: "Не удалось выполнить вход." });
    }
  });
  const authLimiter = require("express-rate-limit")({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
  app.use("/api/medflow/auth", authLimiter, auth);

  app.get("/api/medflow/me", requireAuth, (req, res) => res.json({ user: { id: req.medflowUser.sub, email: req.medflowUser.email } }));

  app.get("/api/medflow/patients", requireAuth, async (req, res) => {
    try {
      const result = await pool.query("SELECT id,display_code AS code,unit,handoff_note AS note,status,created_at,updated_at FROM medflow_patients WHERE user_id=$1 ORDER BY updated_at DESC", [req.medflowUser.sub]);
      res.json({ patients: result.rows });
    } catch (error) { console.error("MEDFLOW patient list failed:", error.message); res.status(500).json({ error: "Не удалось загрузить список." }); }
  });
  app.post("/api/medflow/patients", requireAuth, async (req, res) => {
    const code = cleanText(req.body?.code, 40, true), unit = cleanText(req.body?.unit, 80), note = cleanText(req.body?.note, 1000);
    if (!code) return res.status(400).json({ error: "Укажите код или номер койки." });
    try {
      const result = await pool.query("INSERT INTO medflow_patients(id,user_id,display_code,unit,handoff_note) VALUES($1,$2,$3,$4,$5) RETURNING id,display_code AS code,unit,handoff_note AS note,status,created_at,updated_at", [crypto.randomUUID(), req.medflowUser.sub, code, unit, note]);
      res.status(201).json({ patient: result.rows[0] });
    } catch (error) { console.error("MEDFLOW patient create failed:", error.message); res.status(500).json({ error: "Не удалось сохранить запись." }); }
  });
  app.patch("/api/medflow/patients/:id", requireAuth, async (req, res) => {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: "Некорректный идентификатор." });
    const code = cleanText(req.body?.code, 40, true), unit = cleanText(req.body?.unit, 80), note = cleanText(req.body?.note, 1000);
    const status = req.body?.status === "discharged" ? "discharged" : "active";
    if (!code) return res.status(400).json({ error: "Укажите код или номер койки." });
    try {
      const result = await pool.query("UPDATE medflow_patients SET display_code=$1,unit=$2,handoff_note=$3,status=$4,updated_at=now() WHERE id=$5 AND user_id=$6 RETURNING id,display_code AS code,unit,handoff_note AS note,status,created_at,updated_at", [code, unit, note, status, req.params.id, req.medflowUser.sub]);
      if (!result.rowCount) return res.status(404).json({ error: "Запись не найдена." });
      res.json({ patient: result.rows[0] });
    } catch (error) { console.error("MEDFLOW patient update failed:", error.message); res.status(500).json({ error: "Не удалось обновить запись." }); }
  });
  app.delete("/api/medflow/patients/:id", requireAuth, async (req, res) => {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: "Некорректный идентификатор." });
    try {
      const result = await pool.query("DELETE FROM medflow_patients WHERE id=$1 AND user_id=$2", [req.params.id, req.medflowUser.sub]);
      if (!result.rowCount) return res.status(404).json({ error: "Запись не найдена." });
      res.status(204).end();
    } catch (error) { console.error("MEDFLOW patient delete failed:", error.message); res.status(500).json({ error: "Не удалось удалить запись." }); }
  });

  app.get("/api/medflow/notes", requireAuth, async (req, res) => {
    try {
      const result = await pool.query("SELECT id,body,created_at FROM medflow_notes WHERE user_id=$1 ORDER BY created_at DESC LIMIT 200", [req.medflowUser.sub]);
      res.json({ notes: result.rows });
    } catch (error) { console.error("MEDFLOW note list failed:", error.message); res.status(500).json({ error: "Не удалось загрузить заметки." }); }
  });
  app.post("/api/medflow/notes", requireAuth, async (req, res) => {
    const body = cleanText(req.body?.body, 2000, true);
    if (!body) return res.status(400).json({ error: "Заметка не может быть пустой." });
    try {
      const result = await pool.query("INSERT INTO medflow_notes(id,user_id,body) VALUES($1,$2,$3) RETURNING id,body,created_at", [crypto.randomUUID(), req.medflowUser.sub, body]);
      res.status(201).json({ note: result.rows[0] });
    } catch (error) { console.error("MEDFLOW note create failed:", error.message); res.status(500).json({ error: "Не удалось сохранить заметку." }); }
  });
  app.delete("/api/medflow/notes/:id", requireAuth, async (req, res) => {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: "Некорректный идентификатор." });
    try {
      const result = await pool.query("DELETE FROM medflow_notes WHERE id=$1 AND user_id=$2", [req.params.id, req.medflowUser.sub]);
      if (!result.rowCount) return res.status(404).json({ error: "Заметка не найдена." });
      res.status(204).end();
    } catch (error) { console.error("MEDFLOW note delete failed:", error.message); res.status(500).json({ error: "Не удалось удалить заметку." }); }
  });
}

module.exports = { mountMedflowApi, hashPassword, verifyPassword, signToken, verifyToken, cleanText, UUID_RE };
