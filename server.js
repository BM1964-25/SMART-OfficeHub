import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_URL);
const localDir = isVercel ? path.join("/tmp", "smart-officehub") : path.join(__dirname, ".local");
const tokenPath = path.join(localDir, "tokens.json");
const configPath = path.join(__dirname, "config.local.json");
const publicDir = path.join(__dirname, "public");
const requestStore = new AsyncLocalStorage();
const tokenCookieName = "smart_officehub_google";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events"
];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

async function loadConfig() {
  let fileConfig = {};
  try {
    const raw = await fs.readFile(configPath, "utf8");
    fileConfig = JSON.parse(raw);
  } catch {
    fileConfig = {};
  }

  const useSmartBooking = fileConfig.useSmartBooking === true || process.env.USE_SMART_BOOKING_GOOGLE === "true";
  const smartBooking = useSmartBooking ? await loadSmartBookingConfig(fileConfig.smartBookingProjectPath || process.env.SMART_BOOKING_PROJECT_PATH) : null;
  const smartGoogle = smartBooking?.settings || {};
  const vercelRedirectUri = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "")}/oauth2callback` : "";

  return {
    ...fileConfig,
    clientId: fileConfig.clientId || process.env.GOOGLE_CLIENT_ID || smartGoogle.google_client_id || smartBooking?.env.GOOGLE_CLIENT_ID,
    clientSecret: fileConfig.clientSecret || process.env.GOOGLE_CLIENT_SECRET || smartGoogle.google_client_secret || smartBooking?.env.GOOGLE_CLIENT_SECRET,
    redirectUri: fileConfig.redirectUri || process.env.GOOGLE_REDIRECT_URI || vercelRedirectUri || "http://localhost:8791/oauth2callback",
    loginHint: fileConfig.loginHint || process.env.GOOGLE_LOGIN_HINT || "",
    port: Number(fileConfig.port || process.env.PORT || 8791),
    smartBooking
  };
}

const config = await loadConfig();
const port = Number(config.port || 8791);

async function loadSmartBookingConfig(projectPath) {
  if (!projectPath) return null;

  const env = {
    ...(await readEnvFile(path.join(projectPath, ".env"))),
    ...(await readEnvFile(path.join(projectPath, ".env.local")))
  };

  if (!env.SUPABASE_URL && !env.NEXT_PUBLIC_SUPABASE_URL) return { projectPath, env, settings: null, connection: null };
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return { projectPath, env, settings: null, connection: null };

  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const [settings, connection] = await Promise.all([
    supabaseSelectOne(supabaseUrl, env.SUPABASE_SERVICE_ROLE_KEY, "app_settings", "id=eq.true&select=google_client_id,google_client_secret"),
    supabaseSelectOne(
      supabaseUrl,
      env.SUPABASE_SERVICE_ROLE_KEY,
      "calendar_oauth_connections",
      "provider=eq.google&is_active=eq.true&select=access_token,refresh_token,expires_at,scope,account_email"
    )
  ]);

  return { projectPath, env, settings, connection };
}

async function readEnvFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return Object.fromEntries(
      raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const index = line.indexOf("=");
          const key = line.slice(0, index).trim();
          const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
          return [key, value];
        })
    );
  } catch {
    return {};
  }
}

async function supabaseSelectOne(supabaseUrl, serviceRoleKey, table, query) {
  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/${table}?${query}`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: "application/vnd.pgrst.object+json"
      }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type });
  res.end(text);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index === -1) return [part, ""];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function tokenCookieKey() {
  return crypto
    .createHash("sha256")
    .update(config.clientSecret || "smart-officehub-local-cookie-key")
    .digest();
}

function encryptTokenCookie(tokens) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", tokenCookieKey(), iv);
  const payload = JSON.stringify({
    access_token: tokens.access_token || "",
    refresh_token: tokens.refresh_token || "",
    scope: tokens.scope || "",
    token_type: tokens.token_type || "",
    expires_at: tokens.expires_at || 0
  });
  const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

function decryptTokenCookie(value = "") {
  try {
    const buffer = Buffer.from(value, "base64url");
    const iv = buffer.subarray(0, 12);
    const tag = buffer.subarray(12, 28);
    const encrypted = buffer.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", tokenCookieKey(), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    return { ...JSON.parse(decrypted), source: "cookie" };
  } catch {
    return null;
  }
}

function setTokenCookie(res, tokens) {
  const value = encryptTokenCookie(tokens);
  const secure = isVercel ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${tokenCookieName}=${encodeURIComponent(value)}; HttpOnly; Path=/; Max-Age=2592000; SameSite=Lax${secure}`
  );
}

async function readTokens() {
  const req = requestStore.getStore()?.req;
  if (req) {
    const tokens = decryptTokenCookie(parseCookies(req)[tokenCookieName]);
    if (tokens?.refresh_token || tokens?.access_token) return tokens;
  }

  try {
    return JSON.parse(await fs.readFile(tokenPath, "utf8"));
  } catch {
    const connection = config.smartBooking?.connection;
    if (!connection?.refresh_token) return null;
    return {
      access_token: connection.access_token,
      refresh_token: connection.refresh_token,
      scope: connection.scope,
      source: "smart-booking",
      expires_at: connection.expires_at ? new Date(connection.expires_at).getTime() : 0
    };
  }
}

async function writeTokens(tokens) {
  const res = requestStore.getStore()?.res;
  if (res) setTokenCookie(res, tokens);
  await fs.mkdir(localDir, { recursive: true });
  await fs.writeFile(tokenPath, JSON.stringify(tokens, null, 2));
}

function requireConfig() {
  if (!config.clientId || !config.clientSecret) {
    const error = new Error("Google OAuth ist noch nicht konfiguriert. Lokal bitte config.local.json anlegen; auf Vercel GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET und optional GOOGLE_REDIRECT_URI setzen.");
    error.status = 503;
    throw error;
  }
}

function authUrl() {
  requireConfig();
  const state = crypto.randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent select_account",
    state
  });
  if (config.loginHint) params.set("login_hint", config.loginHint);
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function exchangeCode(code) {
  requireConfig();
  const params = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code"
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || data.error || "Token-Austausch fehlgeschlagen.");
  await writeTokens({
    ...data,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000
  });
}

async function refreshTokens(tokens) {
  requireConfig();
  if (!tokens?.refresh_token) {
    const error = new Error("Kein Refresh Token vorhanden. Bitte erneut anmelden.");
    error.status = 401;
    throw error;
  }

  const params = new URLSearchParams({
    refresh_token: tokens.refresh_token,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token"
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || data.error || "Token-Aktualisierung fehlgeschlagen.");

  const merged = {
    ...tokens,
    ...data,
    refresh_token: data.refresh_token || tokens.refresh_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000
  };
  await writeTokens(merged);
  return merged;
}

async function accessToken() {
  let tokens = await readTokens();
  if (!tokens) {
    const error = new Error("Nicht angemeldet.");
    error.status = 401;
    throw error;
  }
  if (!tokens.expires_at || Date.now() > tokens.expires_at - 60_000) {
    tokens = await refreshTokens(tokens);
  }
  return tokens.access_token;
}

async function gmail(pathname, options = {}) {
  const token = await accessToken();
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    const message = data?.error?.message || data?.error || "Gmail API Fehler";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function googleCalendar(pathname, options = {}) {
  const token = await accessToken();
  const response = await fetch(`https://www.googleapis.com/calendar/v3${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    const message = data?.error?.message || data?.error || "Google Calendar API Fehler";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

function headerValue(message, name) {
  const headers = message.payload?.headers || [];
  return headers.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value || "";
}

function decodeMessageText(data = "") {
  if (!data) return "";
  try {
    return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  } catch {
    return "";
  }
}

function decodeBase64UrlBuffer(data = "") {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function textIncludes(text, words) {
  return words.some((word) => text.includes(word));
}

function collectTextParts(part, target = []) {
  if (!part) return target;
  const mimeType = part.mimeType || "";
  if (mimeType === "text/plain" && part.body?.data) {
    target.push(decodeMessageText(part.body.data));
  }
  for (const child of part.parts || []) collectTextParts(child, target);
  return target;
}

function collectHtmlParts(part, target = []) {
  if (!part) return target;
  const mimeType = part.mimeType || "";
  if (mimeType === "text/html" && part.body?.data) {
    target.push(decodeMessageText(part.body.data));
  }
  for (const child of part.parts || []) collectHtmlParts(child, target);
  return target;
}

function htmlToText(html = "") {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function messageBodyText(message) {
  const plainParts = collectTextParts(message.payload);
  if (plainParts.length) return plainParts.join("\n\n").replace(/\s+\n/g, "\n").trim();
  const htmlParts = collectHtmlParts(message.payload);
  if (htmlParts.length) return htmlParts.map(htmlToText).join("\n\n").trim();
  if (message.payload?.body?.data) {
    const decoded = decodeMessageText(message.payload.body.data).trim();
    return message.payload.mimeType === "text/html" ? htmlToText(decoded) : decoded;
  }
  return "";
}

function collectAttachments(part, target = []) {
  if (!part) return target;
  if (part.filename && part.body?.attachmentId) {
    target.push({
      filename: part.filename,
      mimeType: part.mimeType || "application/octet-stream",
      size: part.body.size || 0,
      attachmentId: part.body.attachmentId
    });
  }
  for (const child of part.parts || []) collectAttachments(child, target);
  return target;
}

function isSmartBookingMessage(message) {
  const from = headerValue(message, "From").toLowerCase();
  const subject = headerValue(message, "Subject").toLowerCase();
  const text = `${from} ${subject} ${message.snippet || ""}`.toLowerCase();
  return from.includes("termine@builtsmart-ai.app") || from.includes("smart booking") || text.includes("smart booking");
}

function classify(message) {
  const labels = message.labelIds || [];
  const from = headerValue(message, "From");
  const subject = headerValue(message, "Subject");
  const text = `${from} ${subject} ${message.snippet || ""} ${messageBodyText(message)}`.toLowerCase();

  if (isSmartBookingMessage(message)) {
    return { bucket: "termine", priority: "niedrig", nextAction: "Terminbestätigung oder Terminänderung, keine Antwort nötig." };
  }
  if (labels.includes("CATEGORY_PROMOTIONS") || text.includes("newsletter") || text.includes("paypal")) {
    return { bucket: "werbung", priority: "niedrig", nextAction: "Nur bei Interesse lesen oder archivieren." };
  }
  if (text.includes("search console") || text.includes("shopping")) {
    return { bucket: "prüfen", priority: "mittel", nextAction: "Bei Relevanz später prüfen." };
  }
  if (text.includes("anfrage") || text.includes("rückmeldung") || text.includes("termin") || text.includes("angebot")) {
    return { bucket: "antwort", priority: "hoch", nextAction: "Prüfen und bei Bedarf antworten." };
  }
  return { bucket: "info", priority: labels.includes("IMPORTANT") ? "mittel" : "niedrig", nextAction: "Zur Kenntnis nehmen." };
}

function toEmail(message, draftInfoByThread = new Map()) {
  const classification = classify(message);
  const bodyText = messageBodyText(message);
  const attachments = collectAttachments(message.payload);
  const draftInfo = draftInfoByThread.get(message.threadId);
  const gmailAccount = config.loginHint || "0";
  return {
    id: message.id,
    threadId: message.threadId,
    from: headerValue(message, "From"),
    to: headerValue(message, "To"),
    subject: headerValue(message, "Subject") || "(ohne Betreff)",
    date: headerValue(message, "Date"),
    timestamp: Number(message.internalDate || 0),
    snippet: message.snippet || "",
    bodyText,
    labels: message.labelIds || [],
    attachments,
    hasAttachment: attachments.length > 0,
    hasGmailDraft: Boolean(draftInfo),
    gmailDraftId: draftInfo?.draftId || null,
    isSmartBooking: isSmartBookingMessage(message),
    gmailUrl: `https://mail.google.com/mail/?authuser=${encodeURIComponent(gmailAccount)}#all/${message.id}`,
    gmailDraftsUrl: `https://mail.google.com/mail/?authuser=${encodeURIComponent(gmailAccount)}#drafts`,
    ...classification
  };
}

async function listDraftInfoByThread() {
  const result = await gmail("/drafts?maxResults=100");
  const draftInfoByThread = new Map();
  for (const draft of result.drafts || []) {
    const threadId = draft.message?.threadId;
    if (threadId && !draftInfoByThread.has(threadId)) {
      draftInfoByThread.set(threadId, {
        draftId: draft.id,
        messageId: draft.message?.id || null
      });
    }
  }
  return draftInfoByThread;
}

async function listAllMessageRefs(query) {
  const messages = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({ maxResults: "100", q: query });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await gmail(`/messages?${params}`);
    messages.push(...(page.messages || []));
    pageToken = page.nextPageToken || "";
  } while (pageToken);
  return messages;
}

async function countSmartBookingSince(windowStart) {
  const refs = await listAllMessageRefs("in:inbox from:termine@builtsmart-ai.app newer_than:15d -in:spam -in:trash");
  if (!refs.length) return 0;

  const details = await Promise.all(
    refs.map((message) => {
      const params = new URLSearchParams({ format: "metadata" });
      return gmail(`/messages/${message.id}?${params}`);
    })
  );

  return details.filter((message) => Number(message.internalDate || 0) >= windowStart).length;
}

async function listInbox(reqUrl) {
  const maxResults = reqUrl.searchParams.get("maxResults") || "25";
  const windowStart = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const query = reqUrl.searchParams.get("q") || "in:inbox newer_than:15d -in:spam -in:trash";
  const list = await gmail(`/messages?${new URLSearchParams({ maxResults, q: query })}`);
  const messages = list.messages || [];
  const details = await Promise.all(
    messages.map((message) => {
      const params = new URLSearchParams({
        format: "full"
      });
      return gmail(`/messages/${message.id}?${params}`);
    })
  );
  const draftInfoByThread = await listDraftInfoByThread();
  const smartBookingCount14d = await countSmartBookingSince(windowStart);
  const visibleEmails = details
    .filter((message) => Number(message.internalDate || 0) >= windowStart)
    .map((message) => toEmail(message, draftInfoByThread))
    .sort((a, b) => b.timestamp - a.timestamp);

  return {
    generatedAt: new Date().toISOString(),
    windowStart: new Date(windowStart).toISOString(),
    smartBookingCount14d,
    query,
    emails: visibleEmails
  };
}

function toCalendarEvent(event, calendar) {
  const startValue = event.start?.dateTime || event.start?.date || "";
  const endValue = event.end?.dateTime || event.end?.date || "";
  const startDate = startValue ? new Date(startValue) : null;
  const endDate = endValue ? new Date(endValue) : null;
  return {
    id: event.id,
    calendarId: calendar.id,
    calendarName: calendar.summary || calendar.id,
    calendarPrimary: Boolean(calendar.primary),
    title: event.summary || "(ohne Titel)",
    description: event.description || "",
    location: event.location || "",
    start: startValue,
    end: endValue,
    timestamp: startDate && !Number.isNaN(startDate.getTime()) ? startDate.getTime() : 0,
    endTimestamp: endDate && !Number.isNaN(endDate.getTime()) ? endDate.getTime() : 0,
    status: event.status || "",
    htmlLink: event.htmlLink || "",
    organizer: event.organizer?.email || event.creator?.email || "",
    attendees: (event.attendees || []).map((attendee) => ({
      email: attendee.email || "",
      displayName: attendee.displayName || "",
      responseStatus: attendee.responseStatus || ""
    })),
    isAllDay: Boolean(event.start?.date)
  };
}

async function listCalendarEvents(reqUrl) {
  const now = new Date();
  const days = Number(reqUrl.searchParams.get("days") || 30);
  const timeMax = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const maxResults = reqUrl.searchParams.get("maxResults") || "40";
  const calendarsResult = await googleCalendar("/users/me/calendarList?minAccessRole=reader");
  const calendars = (calendarsResult.items || [])
    .filter((calendar) => !calendar.deleted && !calendar.hidden)
    .map((calendar) => ({
      id: calendar.id,
      summary: calendar.summary || calendar.id,
      primary: Boolean(calendar.primary)
    }));

  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults
  });

  const eventGroups = await Promise.all(
    calendars.map(async (calendar) => {
      const result = await googleCalendar(`/calendars/${encodeURIComponent(calendar.id)}/events?${params}`);
      return (result.items || []).map((event) => toCalendarEvent(event, calendar));
    })
  );
  const events = eventGroups.flat().sort((a, b) => a.timestamp - b.timestamp);

  return {
    generatedAt: new Date().toISOString(),
    timeMin: now.toISOString(),
    timeMax: timeMax.toISOString(),
    calendars,
    events
  };
}

async function deleteCalendarEvent(calendarId, eventId) {
  return googleCalendar(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE"
  });
}

function base64Url(input) {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textToDraftHtml(text = "", bookingCalendarUrl = "") {
  const escaped = escapeHtml(text);
  let html = escaped
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\r?\n/g, "<br>");

  if (/^https?:\/\//i.test(bookingCalendarUrl)) {
    const safeUrl = escapeHtml(bookingCalendarUrl);
    if (!html.includes(safeUrl)) {
      html = html.replace(
        /(Buchungskalender|Booking-Kalender|Buchungskreis)/,
        `<a href="${safeUrl}">$1</a>`
      );
    }
  }

  return html;
}

function draftMessage(body) {
  const html = textToDraftHtml(body.text || "", body.bookingCalendarUrl || "");
  const message = [
    `To: ${body.to}`,
    `Subject: ${body.subject}`,
    "Content-Type: text/html; charset=utf-8",
    "MIME-Version: 1.0",
    "",
    html
  ].join("\r\n");

  return {
    threadId: body.threadId,
    raw: base64Url(message)
  };
}

async function createDraft(body) {
  return gmail("/drafts", {
    method: "POST",
    body: JSON.stringify({
      message: draftMessage(body)
    })
  });
}

async function updateDraft(draftId, body) {
  return gmail(`/drafts/${draftId}`, {
    method: "PUT",
    body: JSON.stringify({
      id: draftId,
      message: draftMessage(body)
    })
  });
}

function sanitizeApiError(data, fallback = "Anthropic-Verbindung fehlgeschlagen.") {
  if (!data) return fallback;
  if (typeof data === "string") return data.slice(0, 240);
  return data.error?.message || data.message || fallback;
}

function requireAnthropicKey(apiKey = "") {
  const trimmedKey = String(apiKey || "").trim();
  if (!trimmedKey) {
    const error = new Error("Bitte zuerst einen Anthropic API-Schlüssel eingeben.");
    error.status = 400;
    throw error;
  }
  if (!trimmedKey.startsWith("sk-ant-")) {
    const error = new Error("Der Schlüssel sieht nicht wie ein Anthropic API-Schlüssel aus.");
    error.status = 400;
    throw error;
  }
  return trimmedKey;
}

async function anthropicFetch(pathname, apiKey, options = {}) {
  let response;
  try {
    response = await fetch(`https://api.anthropic.com${pathname}`, {
      ...options,
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        ...(options.headers || {})
      }
    });
  } catch (cause) {
    const detail = cause?.message ? ` (${cause.message})` : "";
    const error = new Error(`Anthropic ist aktuell nicht erreichbar. Bitte Internetverbindung prüfen.${detail}`);
    error.status = 502;
    throw error;
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error = new Error(sanitizeApiError(data));
    error.status = response.status || 502;
    throw error;
  }

  return data;
}

async function listAnthropicModels(apiKey) {
  const data = await anthropicFetch("/v1/models", apiKey, { method: "GET" });
  return Array.isArray(data.data) ? data.data : [];
}

function chooseReplyModel(models = []) {
  const ids = models.map((model) => model.id).filter(Boolean);
  return ids.find((id) => /sonnet/i.test(id))
    || ids.find((id) => /opus/i.test(id))
    || ids.find((id) => /haiku/i.test(id))
    || ids[0]
    || "claude-sonnet-4-5";
}

async function testAnthropicConnection(apiKey = "") {
  const trimmedKey = requireAnthropicKey(apiKey);
  const models = await listAnthropicModels(trimmedKey);

  return {
    ok: true,
    model: models[0]?.id || "Anthropic API",
    availableModels: models.map((model) => model.id).slice(0, 8),
    checkedAt: new Date().toISOString()
  };
}

function compactForPrompt(value = "", maxLength = 6500) {
  const compact = String(value || "").replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength)} ...` : compact;
}

function extractAnthropicText(data) {
  const parts = Array.isArray(data.content) ? data.content : [];
  return parts
    .filter((part) => part.type === "text" && part.text)
    .map((part) => part.text.trim())
    .join("\n\n")
    .trim();
}

function toneInstruction(tone = "professionell") {
  const instructions = {
    professionell: [
      "Tonalität professionell:",
      "Sehr sachlich, klar, seriös und geschäftlich formulieren.",
      "Keine zusätzliche Herzlichkeit, keine emotionalen Formulierungen, keine Umgangssprache.",
      "Der Text soll kompakt, souverän und beratend wirken.",
      "Struktur: Dank, kurze fachliche Einordnung, nächster Schritt."
    ].join(" "),
    freundlich: [
      "Tonalität freundlich:",
      "Deutlich wärmer, persönlicher und zugewandter formulieren als bei professionell.",
      "Positives Interesse am Anliegen zeigen, ohne werblich zu klingen.",
      "Nutze verbindende Formulierungen wie „das klingt nach einem spannenden Ansatz“, „ich freue mich auf den Austausch“ oder „gerne schauen wir gemeinsam darauf“.",
      "Der Text darf einen zusätzlichen freundlichen Satz enthalten und soll weniger nüchtern wirken."
    ].join(" "),
    kurz: [
      "Tonalität kurz:",
      "Sehr kompakt formulieren.",
      "Maximal 90 bis 130 Wörter.",
      "Keine langen Erklärungen, keine ausführliche Analyse.",
      "Direkt zum nächsten Schritt kommen."
    ].join(" "),
    verbindlich: [
      "Tonalität verbindlich:",
      "Konkreter, entschlossener und handlungsorientierter formulieren.",
      "Klare Zusage, konkreter nächster Schritt und eindeutige Erwartung an Terminvorschläge oder Unterlagen.",
      "Keine vagen Formulierungen wie „ggf.“, „bei Bedarf“ oder „können Sie gerne“.",
      "Der Text soll entscheidungsstark wirken und den nächsten Schritt klar führen."
    ].join(" ")
  };
  return instructions[tone] || instructions.professionell;
}

async function generateAnthropicReply(body = {}) {
  const apiKey = requireAnthropicKey(body.apiKey);
  const email = body.email || {};
  const tone = body.tone || "professionell";
  const currentText = compactForPrompt(body.currentText || "", 2200);
  const replyInstructions = compactForPrompt(body.replyInstructions || "", 1600);
  const models = await listAnthropicModels(apiKey);
  const model = chooseReplyModel(models);
  const originalMail = compactForPrompt(email.bodyText || email.snippet || "", 8000);
  const context = [
    `Absender: ${email.from || "unbekannt"}`,
    `Betreff: ${email.subject || "ohne Betreff"}`,
    `Erkannte Kategorie: ${email.bucket || "unbekannt"}`,
    `Priorität: ${email.priority || "unbekannt"}`,
    `Gewünschte Tonalität: ${tone}`,
    `Besonderheiten für den Antwortentwurf: ${replyInstructions || "keine zusätzlichen Besonderheiten angegeben"}`,
    `Bisheriger Entwurf: ${currentText || "kein Entwurf vorhanden"}`,
    `Originalmail: ${originalMail || "kein Mailtext verfügbar"}`
  ].join("\n\n");

  const prompt = [
    "Erstelle einen hochwertigen deutschen Antwortentwurf für eine geschäftliche E-Mail.",
    "Schreibe nur den fertigen E-Mail-Text, ohne Analyse und ohne Betreffzeile. Verwende Markdown ausschließlich für ausdrücklich angegebene Buchungskalender-Links.",
    "Formatiere den Entwurf als gut lesbare E-Mail mit Absätzen und Leerzeilen: Anrede, kurzer Einstieg, Hauptteil, nächster Schritt, Grußformel.",
    "Vermeide lange Textblöcke. Jeder Absatz soll höchstens zwei Sätze enthalten.",
    "Nutze eine natürliche Sprache. Keine Floskeln wie „Ich beziehe mich auf:“.",
    "Wenn ein Buchungskalender-Link angegeben ist, verlinke nur das Wort „Buchungskalender“ als Markdown-Link und schreibe die URL nicht zusätzlich sichtbar aus.",
    toneInstruction(tone),
    "Die gewählte Tonalität muss im fertigen Text deutlich erkennbar sein.",
    "Formuliere nicht nur den bisherigen Entwurf um. Schreibe bewusst einen neuen Antworttext, der zur gewählten Tonalität passt.",
    "Wenn die Tonalität freundlich gewählt ist, muss der Text sichtbar wärmer sein als eine professionelle Standardantwort.",
    "Wenn die Tonalität professionell gewählt ist, muss der Text sichtbar nüchterner und geschäftlicher sein als eine freundliche Antwort.",
    "Vermeide identische Satzfolgen über verschiedene Tonalitäten hinweg.",
    "Berücksichtige die angegebenen Besonderheiten für den Antwortentwurf mit hoher Priorität, wenn sie zum Anliegen passen.",
    "Wenn Besonderheiten einen Booking-Link, Verfügbarkeiten, Tagessätze, Preise, Konditionen oder Ausschlüsse enthalten, baue sie sachlich und passend ein.",
    "Wenn keine Besonderheiten angegeben sind, erwähne keine Booking-Links, Preise, Tagessätze oder besonderen Konditionen.",
    "Gehe konkret auf Anliegen, Handlungsbedarf, Termine, Rückfragen oder Unterlagen ein.",
    "Wenn die Mail konkrete Termine oder Tage nennt, greife diese ausdrücklich auf und bitte nicht erneut allgemein um Terminvorschläge.",
    "Wenn konkrete Termine genannt sind, aber keine eigene Verfügbarkeit bekannt ist, setze klare Platzhalter wie „[Zeitfenster eintragen]“ statt Zeiten zu erfinden.",
    "Wenn es um eine Position, Verfügbarkeit, Projektmitarbeit oder ein persönliches Gespräch geht, bestätige zuerst grundsätzliches Interesse oder Verfügbarkeit, bevor du zur Terminabstimmung kommst.",
    "Wenn die Mail um einen Termin bittet, unterscheide: Wurden noch keine Termine genannt, schlage Terminabstimmung vor. Wurden Termine genannt, antworte auf diese Termine.",
    "Erfinde keine Uhrzeiten, Zusagen, Telefonnummern, Unterlagen oder Fakten, die nicht im Original oder bisherigen Entwurf stehen.",
    "Wenn Angaben fehlen, frage präzise und freundlich danach.",
    "Beende mit „Mit freundlichen Grüßen“ und „Bernhard Metzger“.",
    "",
    context
  ].join("\n");

  const data = await anthropicFetch("/v1/messages", apiKey, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      max_tokens: 900,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  const reply = extractAnthropicText(data);
  if (!reply) {
    const error = new Error("Claude hat keinen Antworttext zurückgegeben.");
    error.status = 502;
    throw error;
  }

  return {
    reply,
    model,
    responseId: data.id || null,
    usage: data.usage || null,
    generatedAt: new Date().toISOString()
  };
}

function readableTextFromBinary(buffer) {
  return buffer
    .toString("latin1")
    .replace(/[^\x09\x0A\x0D\x20-\x7EÄÖÜäöüß€]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAttachmentText(buffer, mimeType = "", filename = "") {
  const lowerMime = mimeType.toLowerCase();
  const lowerName = filename.toLowerCase();

  if (
    lowerMime.startsWith("text/") ||
    lowerMime.includes("json") ||
    lowerMime.includes("xml") ||
    /\.(txt|csv|json|xml|html|htm|md)$/i.test(lowerName)
  ) {
    const raw = buffer.toString("utf8");
    return lowerMime.includes("html") || /\.(html|htm)$/i.test(lowerName) ? htmlToText(raw) : raw.trim();
  }

  if (lowerMime.includes("pdf") || lowerName.endsWith(".pdf")) {
    const roughText = readableTextFromBinary(buffer);
    return roughText.length > 80 ? roughText : "";
  }

  return "";
}

function summarizeAttachmentText(text = "", filename = "", mimeType = "") {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const lower = `${filename} ${mimeType} ${cleaned}`.toLowerCase();
  const signals = [];
  if (textIncludes(lower, ["rechnung", "invoice", "zahlung", "mahnung", "gutschrift", "zahlbar"])) signals.push("Rechnung/Zahlung");
  if (textIncludes(lower, ["angebot", "kostenvoranschlag", "preis", "auftrag"])) signals.push("Angebot/Auftrag");
  if (textIncludes(lower, ["vertrag", "vereinbarung", "kündigung", "laufzeit"])) signals.push("Vertrag");
  if (textIncludes(lower, ["frist", "deadline", "bis zum", "fällig", "ablauf"])) signals.push("Frist");
  if (textIncludes(lower, ["€", "eur", "betrag", "summe", "kosten", "honorar"])) signals.push("Betrag/Kosten");
  if (textIncludes(lower, ["bitte", "freigabe", "rückfrage", "antwort", "bestätigung"])) signals.push("Antwortbedarf");

  const preview = cleaned.slice(0, 1800);
  const summary = cleaned
    ? `${cleaned.slice(0, 320)}${cleaned.length > 320 ? " ..." : ""}`
    : "Aus diesem Dateityp konnte ohne Spezialparser noch kein verlässlicher Text extrahiert werden.";

  return {
    summary,
    preview,
    signals: signals.length ? signals : ["Keine klaren Prüfsignale erkannt"],
    extractedCharacters: cleaned.length
  };
}

async function analyzeAttachment(messageId, attachmentId, reqUrl) {
  const filename = reqUrl.searchParams.get("filename") || "Anhang";
  const mimeType = reqUrl.searchParams.get("mimeType") || "application/octet-stream";
  const result = await gmail(`/messages/${messageId}/attachments/${attachmentId}`);
  const buffer = decodeBase64UrlBuffer(result.data || "");
  const extractedText = extractAttachmentText(buffer, mimeType, filename);
  const analysis = summarizeAttachmentText(extractedText, filename, mimeType);

  return {
    filename,
    mimeType,
    size: result.size || buffer.length,
    textAvailable: Boolean(extractedText),
    ...analysis
  };
}

async function serveStatic(req, res, reqUrl) {
  const requested = reqUrl.pathname === "/" ? "/index.html" : reqUrl.pathname;
  const resolved = path.normalize(path.join(publicDir, requested));
  if (!resolved.startsWith(publicDir)) return sendText(res, 403, "Nicht erlaubt.");
  const ext = path.extname(resolved);
  try {
    const content = await fs.readFile(resolved);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(content);
  } catch {
    sendText(res, 404, "Nicht gefunden.");
  }
}

async function handleRequest(req, res) {
  const reqUrl = new URL(req.url, `http://localhost:${port}`);

  try {
    if (reqUrl.pathname === "/auth/start") {
      res.writeHead(302, { Location: authUrl() });
      return res.end();
    }

    if (reqUrl.pathname === "/oauth2callback") {
      const code = reqUrl.searchParams.get("code");
      if (!code) {
        res.writeHead(302, { Location: "/?error=OAuth-Code%20fehlt.%20Bitte%20die%20Anmeldung%20%C3%BCber%20%E2%80%9EMit%20Google%20verbinden%E2%80%9C%20starten." });
        return res.end();
      }
      await exchangeCode(code);
      res.writeHead(302, { Location: "/" });
      return res.end();
    }

    if (reqUrl.pathname === "/api/status") {
      const tokens = await readTokens();
      const tokenScopes = tokens?.scope ? tokens.scope.split(/\s+/) : [];
      const hasRequiredScopes = SCOPES.every((scope) => tokenScopes.includes(scope));
      return sendJson(res, 200, {
        configured: Boolean(config.clientId && config.clientSecret),
        authenticated: Boolean(tokens?.refresh_token || tokens?.access_token),
        tokenSource: tokens?.source || "local",
        smartBookingDetected: Boolean(config.smartBooking),
        smartBookingAccount: config.smartBooking?.connection?.account_email || null,
        hasRequiredScopes,
        scopes: SCOPES,
        redirectUri: config.redirectUri
      });
    }

    if (reqUrl.pathname === "/api/emails") {
      return sendJson(res, 200, await listInbox(reqUrl));
    }

    if (reqUrl.pathname === "/api/calendar/events") {
      return sendJson(res, 200, await listCalendarEvents(reqUrl));
    }

    const calendarDeleteMatch = reqUrl.pathname.match(/^\/api\/calendar\/events\/([^/]+)\/([^/]+)$/);
    if (calendarDeleteMatch && req.method === "DELETE") {
      const calendarId = decodeURIComponent(calendarDeleteMatch[1]);
      const eventId = decodeURIComponent(calendarDeleteMatch[2]);
      await deleteCalendarEvent(calendarId, eventId);
      return sendJson(res, 200, { ok: true });
    }

    if (reqUrl.pathname === "/api/anthropic/test" && req.method === "POST") {
      const body = await readBody(req);
      const result = await testAnthropicConnection(body.apiKey);
      return sendJson(res, 200, { ok: true, result });
    }

    if (reqUrl.pathname === "/api/anthropic/reply" && req.method === "POST") {
      const body = await readBody(req);
      const result = await generateAnthropicReply(body);
      return sendJson(res, 200, { ok: true, result });
    }

    const archiveMatch = reqUrl.pathname.match(/^\/api\/messages\/([^/]+)\/archive$/);
    if (archiveMatch && req.method === "POST") {
      const result = await gmail(`/messages/${archiveMatch[1]}/modify`, {
        method: "POST",
        body: JSON.stringify({ removeLabelIds: ["INBOX"] })
      });
      return sendJson(res, 200, { ok: true, result });
    }

    const trashMatch = reqUrl.pathname.match(/^\/api\/messages\/([^/]+)\/trash$/);
    if (trashMatch && req.method === "POST") {
      const result = await gmail(`/messages/${trashMatch[1]}/trash`, { method: "POST" });
      return sendJson(res, 200, { ok: true, result });
    }

    const attachmentAnalysisMatch = reqUrl.pathname.match(/^\/api\/messages\/([^/]+)\/attachments\/([^/]+)\/analyze$/);
    if (attachmentAnalysisMatch && req.method === "GET") {
      const result = await analyzeAttachment(attachmentAnalysisMatch[1], attachmentAnalysisMatch[2], reqUrl);
      return sendJson(res, 200, { ok: true, result });
    }

    if (reqUrl.pathname === "/api/drafts" && req.method === "POST") {
      const body = await readBody(req);
      const result = await createDraft(body);
      return sendJson(res, 200, { ok: true, result });
    }

    const draftMatch = reqUrl.pathname.match(/^\/api\/drafts\/([^/]+)$/);
    if (draftMatch && req.method === "PUT") {
      const body = await readBody(req);
      const result = await updateDraft(draftMatch[1], body);
      return sendJson(res, 200, { ok: true, result });
    }

    return serveStatic(req, res, reqUrl);
  } catch (error) {
    sendJson(res, error.status || 500, { error: error.message || "Unbekannter Fehler" });
  }
}

async function router(req, res) {
  return requestStore.run({ req, res }, () => handleRequest(req, res));
}

const server = http.createServer(router);
server.listen(port, () => {
  console.log(`Gmail API Dashboard laeuft auf http://localhost:${port}`);
});
