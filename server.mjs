import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)));
const publicDirectory = join(root, "dist");
const port = Number(process.env.PORT) || 3000;
const mimeTypes = {
  ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml",
  ".webp": "image/webp"
};
const attempts = new Map();

function sendJson(response, status, data) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(data));
}

function parseEnv(source) {
  return Object.fromEntries(source.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#")).map((line) => {
    const separator = line.indexOf("=");
    return separator === -1 ? [line, ""] : [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
  }));
}

async function loadTelegramSettings() {
  try {
    const localEnv = parseEnv(await readFile(join(root, ".env.telegram.local"), "utf8"));
    return { token: localEnv.TELEGRAM_BOT_TOKEN, chatId: localEnv.TELEGRAM_CHAT_ID };
  } catch {
    return { token: undefined, chatId: undefined };
  }
}

function clean(value, maxLength) {
  return String(value ?? "").trim().replace(/[<>]/g, "").slice(0, maxLength);
}

function isAllowedAttempt(request) {
  const ip = request.socket.remoteAddress || "unknown";
  const now = Date.now();
  const recent = (attempts.get(ip) || []).filter((time) => now - time < 10 * 60 * 1000);
  if (recent.length >= 5) return false;
  recent.push(now);
  attempts.set(ip, recent);
  return true;
}

function readJson(request) {
  return new Promise((resolveBody, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 16_384) reject(new Error("Request body is too large"));
    });
    request.on("end", () => {
      try { resolveBody(JSON.parse(body || "{}")); } catch { reject(new Error("Invalid JSON")); }
    });
    request.on("error", reject);
  });
}

async function handleReservation(request, response) {
  if (!isAllowedAttempt(request)) return sendJson(response, 429, { ok: false, error: "too_many_requests" });
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (origin && host && new URL(origin).host !== host) return sendJson(response, 403, { ok: false, error: "forbidden" });

  let body;
  try { body = await readJson(request); } catch { return sendJson(response, 400, { ok: false, error: "invalid_request" }); }
  const reservation = {
    name: clean(body.name, 80), phone: clean(body.phone, 40), date: clean(body.date, 20),
    time: clean(body.time, 10), guests: clean(body.guests, 10)
  };
  const validPhone = /^[+\d][\d\s()\-]{6,}$/.test(reservation.phone);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(reservation.date);
  const validTime = /^\d{2}:\d{2}$/.test(reservation.time);
  if (!reservation.name || !validPhone || !validDate || !validTime || !reservation.guests) {
    return sendJson(response, 400, { ok: false, error: "validation_error" });
  }

  const { token, chatId } = await loadTelegramSettings();
  if (!token || !chatId) return sendJson(response, 503, { ok: false, error: "not_configured" });
  const message = [
    "Новая заявка · Rosso Rubino", "", `Имя: ${reservation.name}`,
    `Телефон: ${reservation.phone}`, `Дата: ${reservation.date}`, `Время: ${reservation.time}`,
    `Гостей: ${reservation.guests}`
  ].join("\n");

  try {
    const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message })
    });
    if (!telegramResponse.ok) throw new Error("Telegram rejected the request");
    return sendJson(response, 200, { ok: true });
  } catch {
    return sendJson(response, 502, { ok: false, error: "delivery_failed" });
  }
}

async function serveStatic(url, response) {
  const requestedPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = resolve(publicDirectory, `.${requestedPath}`);
  if (!filePath.startsWith(`${publicDirectory}${sep}`) && filePath !== join(publicDirectory, "index.html")) {
    response.writeHead(404); return response.end();
  }
  try {
    const file = await readFile(filePath);
    response.writeHead(200, { "Content-Type": mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream" });
    response.end(file);
  } catch {
    response.writeHead(404); response.end();
  }
}

createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  if (request.method === "POST" && url.pathname === "/api/reservations") return handleReservation(request, response);
  if (request.method === "GET" || request.method === "HEAD") return serveStatic(url, response);
  response.writeHead(405, { Allow: "GET, HEAD, POST" }); response.end();
}).listen(port, () => console.log(`Rosso Rubino is running at http://localhost:${port}`));
