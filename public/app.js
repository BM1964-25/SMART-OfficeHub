const labels = {
  alle: "Alle",
  antwort: "Antworten",
  "prüfen": "Prüfen",
  termine: "Termine",
  info: "Info",
  werbung: "Werbung"
};

const bucketOrder = ["alle", "antwort", "prüfen", "termine", "info", "werbung"];
const workspaceLabels = {
  mails: "Mails",
  termine: "Termine",
  dokumente: "Dokumente"
};
const workspaceMeta = {
  mails: {
    title: "Mail Dashboard",
    subline: "E-Mail-Zentrale für Posteingang, Antworten und Entwürfe"
  },
  termine: {
    title: "Termin Dashboard",
    subline: "Arbeitsbereich für Terminabstimmungen, Rückrufe und Smart-Booking-Mails"
  },
  dokumente: {
    title: "Dokumenten Dashboard",
    subline: "Arbeitsbereich für Anhänge, Rechnungen, Angebote, Verträge und Prüfunterlagen"
  }
};
const workspaceOrder = ["mails", "termine", "dokumente"];
let emails = [];
let calendarEvents = [];
let activeWorkspace = "mails";
let activeBucket = "alle";
let activeId = null;
let inboxStats = {
  smartBookingCount14d: 0,
  windowStart: null,
  generatedAt: null
};
const draftStorageKey = "smartOfficeHubDraftCreatedIds";
const draftIdStorageKey = "smartOfficeHubDraftIds";
const documentStatusStorageKey = "smartOfficeHubDocumentStatus";
const draftCreatedIds = new Set(loadDraftCreatedIds());
const draftIdsByEmail = loadDraftIds();
const documentStatusByKey = loadDocumentStatus();
const documentAnalysisByKey = {};

const noticeEl = document.querySelector("#notice");
const dashboardTitleEl = document.querySelector("#dashboardTitle");
const dashboardSublineEl = document.querySelector("#dashboardSubline");
const summaryEl = document.querySelector("#summary");
const workspaceTabsEl = document.querySelector("#workspaceTabs");
const tabsEl = document.querySelector("#tabs");
const listEl = document.querySelector("#mailList");
const detailEl = document.querySelector("#detail");
const searchEl = document.querySelector("#searchInput");
const refreshButton = document.querySelector("#refreshButton");
const loginLink = document.querySelector("#loginLink");
const helpButton = document.querySelector("#helpButton");
const helpOverlay = document.querySelector("#helpOverlay");
const helpBackdrop = document.querySelector("#helpBackdrop");
const helpCloseButton = document.querySelector("#helpCloseButton");
const helpSearchInput = document.querySelector("#helpSearchInput");
const helpContent = document.querySelector("#helpContent");

function isFileMode() {
  return window.location.protocol === "file:";
}

function showNotice(text, type = "info") {
  noticeEl.textContent = text;
  noticeEl.className = `notice active ${type === "error" ? "error" : ""}`;
}

function hideNotice() {
  noticeEl.className = "notice";
  noticeEl.textContent = "";
}

function openHelp() {
  helpOverlay.classList.add("active");
  helpOverlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("helpOpen");
  helpSearchInput.focus();
}

function closeHelp() {
  helpOverlay.classList.remove("active");
  helpOverlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("helpOpen");
  helpButton.focus();
}

function filterHelp() {
  const query = helpSearchInput.value.trim().toLowerCase();
  helpContent.querySelectorAll(".helpSection").forEach((section) => {
    const text = section.textContent.toLowerCase();
    section.hidden = Boolean(query) && !text.includes(query);
  });
}

function loadDraftCreatedIds() {
  try {
    const stored = sessionStorage.getItem(draftStorageKey);
    const values = stored ? JSON.parse(stored) : [];
    return Array.isArray(values) ? values : [];
  } catch {
    return [];
  }
}

function loadDraftIds() {
  try {
    const stored = sessionStorage.getItem(draftIdStorageKey);
    const values = stored ? JSON.parse(stored) : {};
    return values && typeof values === "object" && !Array.isArray(values) ? values : {};
  } catch {
    return {};
  }
}

function loadDocumentStatus() {
  try {
    const stored = sessionStorage.getItem(documentStatusStorageKey);
    const values = stored ? JSON.parse(stored) : {};
    return values && typeof values === "object" && !Array.isArray(values) ? values : {};
  } catch {
    return {};
  }
}

function saveDraftCreatedIds() {
  sessionStorage.setItem(draftStorageKey, JSON.stringify([...draftCreatedIds]));
}

function saveDraftIds() {
  sessionStorage.setItem(draftIdStorageKey, JSON.stringify(draftIdsByEmail));
}

function saveDocumentStatus() {
  sessionStorage.setItem(documentStatusStorageKey, JSON.stringify(documentStatusByKey));
}

function hasCreatedDraft(email) {
  return draftCreatedIds.has(email.id) || Boolean(email.hasGmailDraft);
}

function draftIdForEmail(email) {
  return email.gmailDraftId || draftIdsByEmail[email.id] || "";
}

function markDraftCreated(email, draftId = "") {
  draftCreatedIds.add(email.id);
  if (draftId) {
    draftIdsByEmail[email.id] = draftId;
    email.gmailDraftId = draftId;
    saveDraftIds();
  }
  saveDraftCreatedIds();
}

function formatDate(value, timestamp) {
  const date = value ? new Date(value) : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Datum unbekannt";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatBytes(value = 0) {
  const bytes = Number(value || 0);
  if (!bytes) return "Größe unbekannt";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Aktion fehlgeschlagen.");
  return data;
}

async function checkStatus() {
  const status = await api("/api/status");
  if (!status.configured) {
    showNotice(`Google OAuth ist noch nicht eingerichtet. Lege config.local.json an. Redirect URI: ${status.redirectUri}`, "error");
    loginLink.classList.add("disabled");
    return false;
  }
  if (!status.authenticated) {
    showNotice(status.smartBookingDetected ? "SMART Booking wurde erkannt. Bitte trotzdem einmal „Mit Google verbinden“ klicken, damit Google die zusätzlichen Gmail-Berechtigungen freigibt." : "Noch nicht mit Google verbunden. Klicke oben auf „Mit Google verbinden“.");
    return false;
  }
  if (!status.hasRequiredScopes) {
    showNotice("Google ist verbunden, aber noch ohne alle benötigten OfficeHub-Berechtigungen für Gmail und Kalender. Bitte oben auf „Mit Google verbinden“ klicken und die neuen Scopes freigeben.");
    return false;
  }
  return true;
}

async function loadEmails() {
  showNotice("OfficeHub-Daten werden geladen …");
  const [result, calendarResult] = await Promise.all([
    api("/api/emails"),
    api("/api/calendar/events")
  ]);
  emails = result.emails;
  calendarEvents = calendarResult.events || [];
  inboxStats = {
    smartBookingCount14d: result.smartBookingCount14d || 0,
    windowStart: result.windowStart || null,
    generatedAt: result.generatedAt || null
  };
  activeId = filteredItems()[0]?.key || null;
  hideNotice();
  render();
}

function bucketCount(bucket) {
  if (bucket === "alle") return emails.length;
  return emails.filter((email) => email.bucket === bucket).length;
}

function textIncludes(text, words) {
  return words.some((word) => text.includes(word));
}

function emailSearchText(email) {
  return [email.from, email.subject, email.snippet, email.bodyText, email.nextAction].join(" ").toLowerCase();
}

function isAppointmentEmail(email) {
  const text = emailSearchText(email);
  return email.bucket === "termine" || email.isSmartBooking || textIncludes(text, [
    "termin",
    "kalender",
    "meeting",
    "besprechung",
    "rückruf",
    "telefonat",
    "call",
    "zeitfenster",
    "einladung"
  ]);
}

function isDocumentEmail(email) {
  return email.hasAttachment && emailDocumentCount(email) > 0;
}

function emailDocumentCount(email) {
  return Array.isArray(email.attachments) ? email.attachments.length : email.hasAttachment ? 1 : 0;
}

function workspaceEmails(workspace = activeWorkspace) {
  if (workspace === "dokumente") return emails.filter(isDocumentEmail);
  if (workspace === "termine") return [];
  return emails;
}

function workspaceCount(workspace) {
  if (workspace === "termine") return calendarEvents.length;
  if (workspace === "dokumente") return documentItems().length;
  return workspaceEmails(workspace).length;
}

function itemKey(item) {
  return item.kind === "event" ? `event:${item.event.id}` : `mail:${item.email.id}`;
}

function itemSearchText(item) {
  if (item.kind === "event") {
    const event = item.event;
    return [event.title, event.description, event.location, event.organizer, event.attendees?.map((attendee) => attendee.email).join(" ")].join(" ").toLowerCase();
  }
  if (item.kind === "document") {
    const attachment = item.attachment;
    const email = item.email;
    return [attachment.filename, attachment.mimeType, email.from, email.subject, email.snippet, email.bodyText].join(" ").toLowerCase();
  }
  return emailSearchText(item.email);
}

function documentItems() {
  return emails.flatMap((email) =>
    (email.attachments || []).map((attachment, index) => {
      const key = `document:${email.id}:${attachment.attachmentId || index}`;
      return {
        kind: "document",
        key,
        email,
        attachment,
        documentType: detectDocumentType(email, attachment),
        status: documentStatusByKey[key] || "neu",
        assessment: assessDocument(email, attachment)
      };
    })
  );
}

function detectDocumentType(email, attachment) {
  const text = [attachment.filename, attachment.mimeType, email.subject, email.snippet, email.bodyText].join(" ").toLowerCase();
  if (textIncludes(text, ["rechnung", "invoice", "mahnung", "zahlung", "beleg", "gutschrift"])) return "Rechnung";
  if (textIncludes(text, ["angebot", "offer", "kostenvoranschlag", "preis"])) return "Angebot";
  if (textIncludes(text, ["vertrag", "contract", "vereinbarung", "agb"])) return "Vertrag";
  if (textIncludes(text, ["protokoll", "minutes", "notiz", "besprechung"])) return "Protokoll";
  if (textIncludes(text, ["leistungsverzeichnis", "lv", "ausschreibung", "positionen"])) return "Leistungsverzeichnis";
  if ((attachment.mimeType || "").startsWith("image/")) return "Bild/Scan";
  if ((attachment.mimeType || "").includes("spreadsheet") || /\.(xls|xlsx|csv)$/i.test(attachment.filename || "")) return "Tabelle";
  if ((attachment.mimeType || "").includes("pdf") || /\.pdf$/i.test(attachment.filename || "")) return "PDF";
  return "Sonstiges";
}

function assessDocument(email, attachment) {
  const text = [attachment.filename, attachment.mimeType, email.subject, email.snippet, email.bodyText].join(" ").toLowerCase();
  const type = detectDocumentType(email, attachment);
  const flags = [];
  if (textIncludes(text, ["frist", "bis zum", "deadline", "ablauf", "fällig", "zahlbar"])) flags.push("Frist prüfen");
  if (textIncludes(text, ["€", "eur", "betrag", "kosten", "preis", "honorar", "summe", "zahlung"])) flags.push("Betrag/Kosten prüfen");
  if (textIncludes(text, ["bitte", "frage", "rückfrage", "freigabe", "bestätigung", "antwort"])) flags.push("Antwortbedarf prüfen");
  if (textIncludes(text, ["projekt", "bau", "baurevision", "auftrag", "kunde"])) flags.push("Projektbezug prüfen");
  if (!flags.length && ["Rechnung", "Angebot", "Vertrag", "Leistungsverzeichnis"].includes(type)) flags.push("Inhalt fachlich prüfen");
  if (!flags.length) flags.push("Zur Ablage geeignet");

  let nextAction = "Dokument sichten und passend ablegen.";
  if (flags.includes("Antwortbedarf prüfen")) nextAction = "Rückfrage oder Eingangsbestätigung vorbereiten.";
  else if (flags.includes("Frist prüfen")) nextAction = "Frist prüfen und Wiedervorlage setzen.";
  else if (flags.includes("Betrag/Kosten prüfen")) nextAction = "Betrag, Zahlungsziel und Projektbezug prüfen.";
  else if (type === "Vertrag") nextAction = "Vertragliche Punkte und Risiken prüfen.";
  else if (type === "Angebot") nextAction = "Angebot inhaltlich und preislich bewerten.";

  return { flags, nextAction };
}

function workspaceItems() {
  if (activeWorkspace === "termine") {
    return calendarEvents.map((event) => ({ kind: "event", key: `event:${event.id}`, event }));
  }
  if (activeWorkspace === "dokumente") {
    return documentItems();
  }
  return workspaceEmails(activeWorkspace).map((email) => ({ kind: "email", key: `mail:${email.id}`, email }));
}

function renderDashboardHeading() {
  const meta = workspaceMeta[activeWorkspace] || workspaceMeta.mails;
  dashboardTitleEl.textContent = meta.title;
  dashboardSublineEl.textContent = meta.subline;
  document.body.dataset.workspace = activeWorkspace;
}

function renderSummary() {
  const draftCount = emails.filter(hasCreatedDraft).length;
  const metrics = [
    ["Gesamt", emails.length, "mail"],
    ["Antworten", bucketCount("antwort"), "mail"],
    ["Zu prüfen", bucketCount("prüfen"), "mail"],
    ["Termine", workspaceCount("termine"), "appointment"],
    ["Dokumente", workspaceCount("dokumente"), "document"],
    ["Entwürfe erstellt", draftCount, "mail"]
  ];
  summaryEl.innerHTML = metrics
    .map(([label, value, group]) => `<article class="metric ${group}Metric"><strong>${value}</strong><span>${label}</span></article>`)
    .join("");
}

function renderWorkspaceTabs() {
  workspaceTabsEl.innerHTML = workspaceOrder
    .map((workspace) => {
      const pressed = workspace === activeWorkspace ? "true" : "false";
      return `<button class="workspaceTab" type="button" data-workspace="${workspace}" aria-pressed="${pressed}">${workspaceLabels[workspace]} <span>${workspaceCount(workspace)}</span></button>`;
    })
    .join("");

  workspaceTabsEl.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      activeWorkspace = button.dataset.workspace;
      activeBucket = "alle";
      activeId = filteredItems()[0]?.key || null;
      render();
    });
  });
}

function renderTabs() {
  tabsEl.hidden = activeWorkspace !== "mails";
  if (activeWorkspace !== "mails") {
    tabsEl.innerHTML = "";
    return;
  }

  tabsEl.innerHTML = bucketOrder
    .map((bucket) => {
      const pressed = bucket === activeBucket ? "true" : "false";
      return `<button class="tab" type="button" data-bucket="${bucket}" aria-pressed="${pressed}">${labels[bucket]} (${bucketCount(bucket)})</button>`;
    })
    .join("");

  tabsEl.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      activeBucket = button.dataset.bucket;
      activeId = filteredItems()[0]?.key || null;
      render();
    });
  });
}

function filteredItems() {
  const query = searchEl.value.trim().toLowerCase();
  return workspaceItems().filter((item) => {
    const inBucket = item.kind === "event" || activeBucket === "alle" || item.email.bucket === activeBucket;
    const haystack = itemSearchText(item);
    return inBucket && (!query || haystack.includes(query));
  });
}

function renderList() {
  const list = filteredItems();
  if (!list.length) {
    const emptyText = activeWorkspace === "termine"
      ? "Keine kommenden Google-Calendar-Termine gefunden."
      : activeWorkspace === "dokumente"
        ? "Keine Gmail-Anhänge im geladenen Posteingang gefunden."
        : "Keine passenden E-Mails gefunden.";
    listEl.innerHTML = `<div class="empty">${emptyText}</div>`;
    detailEl.innerHTML = '<div class="empty">Aktualisiere den Posteingang oder passe die Suche an.</div>';
    return;
  }

  if (!list.some((item) => item.key === activeId)) activeId = list[0].key;

  listEl.innerHTML = list
    .map((item) => {
      if (item.kind === "event") return renderCalendarListItem(item.event, item.key);
      if (item.kind === "document") return renderDocumentListItem(item);
      const email = item.email;
      const current = item.key === activeId ? "true" : "false";
      const draftClass = hasCreatedDraft(email) ? "draftCreated" : "";
      const replyClass = email.bucket === "antwort" ? "replyCandidate" : "";
      const workspaceBadges = [
        isAppointmentEmail(email) ? '<span class="badge appointmentBadge">Termin</span>' : "",
        isDocumentEmail(email) ? '<span class="badge documentBadge">Dokument</span>' : ""
      ].join("");
      const draftStatus = hasCreatedDraft(email)
        ? '<span class="draftStatusLine"><span class="draftDot" aria-hidden="true"></span>Entwurf vorhanden</span>'
        : "";
      return `
        <button class="mailItem ${replyClass} ${draftClass}" type="button" data-id="${item.key}" aria-current="${current}">
          <span class="mailHead">
            <span class="sender">${escapeHtml(email.from)}</span>
            <span class="date">${formatDate(email.date, email.timestamp)}</span>
          </span>
          <span class="subject">${escapeHtml(email.subject)}</span>
          ${draftStatus}
          <span class="snippet">${escapeHtml(email.snippet)}</span>
          <span class="badges">
            <span class="badge ${email.priority}">${email.priority}</span>
            <span class="badge bucket">${labels[email.bucket] || email.bucket}</span>
            ${workspaceBadges}
            ${hasCreatedDraft(email) ? '<span class="badge draftBadge">Entwurf erstellt</span>' : ""}
          </span>
        </button>
      `;
    })
    .join("");

  listEl.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      activeId = button.dataset.id;
      render();
    });
  });
}

function renderDocumentListItem(item) {
  const { email, attachment, key } = item;
  const current = key === activeId ? "true" : "false";
  return `
    <button class="mailItem documentItem" type="button" data-id="${key}" aria-current="${current}">
      <span class="mailHead">
        <span class="sender">${escapeHtml(email.from)}</span>
        <span class="date">${formatDate(email.date, email.timestamp)}</span>
      </span>
      <span class="subject">${escapeHtml(attachment.filename || "Unbenannte Datei")}</span>
      <span class="snippet">Aus Mail: ${escapeHtml(email.subject)} · ${escapeHtml(attachment.mimeType || "Dateityp unbekannt")} · ${formatBytes(attachment.size)}</span>
      <span class="badges">
        <span class="badge documentBadge">Dokument</span>
        <span class="badge typeBadge">${escapeHtml(item.documentType)}</span>
        <span class="badge statusBadge ${escapeHtml(item.status)}">${documentStatusLabel(item.status)}</span>
        <span class="badge bucket">${escapeHtml(attachment.mimeType || "Datei")}</span>
      </span>
    </button>
  `;
}

function documentStatusLabel(status) {
  const labelsByStatus = {
    neu: "Neu",
    prüfen: "Prüfen",
    erledigt: "Erledigt",
    archivieren: "Archivieren"
  };
  return labelsByStatus[status] || "Neu";
}

function setDocumentStatus(key, status) {
  documentStatusByKey[key] = status;
  saveDocumentStatus();
  render();
}

function renderDocumentAnalysis(key) {
  const analysis = documentAnalysisByKey[key];
  if (!analysis) {
    return `
      <section class="documentAnalysisBox mutedBox">
        <div class="summaryHead">
          <span>Inhaltsanalyse</span>
          <small>noch nicht geladen</small>
        </div>
        <p>Der Anhang wird erst geladen und ausgewertet, wenn du die Analyse startest.</p>
      </section>
    `;
  }

  if (analysis.loading) {
    return `
      <section class="documentAnalysisBox">
        <div class="summaryHead">
          <span>Inhaltsanalyse</span>
          <small>wird geladen</small>
        </div>
        <p>Dokumentinhalt wird aus Gmail geladen und geprüft ...</p>
      </section>
    `;
  }

  if (analysis.error) {
    return `
      <section class="documentAnalysisBox errorBox">
        <div class="summaryHead">
          <span>Inhaltsanalyse</span>
          <small>Fehler</small>
        </div>
        <p>${escapeHtml(analysis.error)}</p>
      </section>
    `;
  }

  const signals = (analysis.signals || [])
    .map((signal) => `<li>${escapeHtml(signal)}</li>`)
    .join("");

  return `
    <section class="documentAnalysisBox">
      <div class="summaryHead">
        <span>Inhaltsanalyse</span>
        <small>${analysis.extractedCharacters || 0} Zeichen</small>
      </div>
      <ul>
        <li><strong>Kurzinhalt:</strong> ${escapeHtml(analysis.summary || "Keine Zusammenfassung verfügbar.")}</li>
        <li><strong>Prüfsignale:</strong><ul>${signals}</ul></li>
      </ul>
      <details class="analysisPreview">
        <summary>Textauszug anzeigen</summary>
        <pre>${escapeHtml(analysis.preview || "Kein Textauszug verfügbar.")}</pre>
      </details>
    </section>
  `;
}

async function analyzeDocument(item) {
  const { key, email, attachment } = item;
  documentAnalysisByKey[key] = { loading: true };
  render();
  try {
    const params = new URLSearchParams({
      filename: attachment.filename || "Anhang",
      mimeType: attachment.mimeType || "application/octet-stream"
    });
    const result = await api(`/api/messages/${email.id}/attachments/${encodeURIComponent(attachment.attachmentId)}/analyze?${params}`);
    documentAnalysisByKey[key] = result.result;
  } catch (error) {
    documentAnalysisByKey[key] = { error: error.message || "Dokumentanalyse fehlgeschlagen." };
  }
  render();
}

function formatEventRange(event) {
  const start = event.start ? new Date(event.start) : null;
  const end = event.end ? new Date(event.end) : null;
  if (!start || Number.isNaN(start.getTime())) return "Terminzeit unbekannt";
  if (event.isAllDay) {
    return new Intl.DateTimeFormat("de-DE", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(start);
  }
  const dateText = new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(start);
  const startTime = new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(start);
  const endTime = end && !Number.isNaN(end.getTime())
    ? new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(end)
    : "";
  return `${dateText}, ${startTime}${endTime ? ` - ${endTime}` : ""}`;
}

function renderCalendarListItem(event, key) {
  const current = key === activeId ? "true" : "false";
  const snippet = event.location || event.description || event.organizer || "Kalendereintrag aus Google Calendar";
  return `
    <button class="mailItem calendarItem" type="button" data-id="${key}" aria-current="${current}">
      <span class="mailHead">
        <span class="sender">${escapeHtml(event.calendarName || "Google Calendar")}</span>
        <span class="date">${escapeHtml(formatEventRange(event))}</span>
      </span>
      <span class="subject">${escapeHtml(event.title)}</span>
      <span class="snippet">${escapeHtml(compactText(snippet).slice(0, 180))}</span>
      <span class="badges">
        <span class="badge appointmentBadge">Kalender-Termin</span>
        <span class="badge bucket">${escapeHtml(event.calendarName || "Kalender")}</span>
        ${event.isAllDay ? '<span class="badge bucket">Ganztägig</span>' : ""}
      </span>
    </button>
  `;
}

function senderDisplayName(from = "") {
  const match = from.match(/^"?([^"<@]+)"?\s*</);
  const rawName = (match ? match[1] : from.split("@")[0]).trim();
  const normalized = rawName.includes(",")
    ? rawName.split(",").map((part) => part.trim()).reverse().join(" ")
    : rawName;
  const cleaned = normalized
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b(info|kontakt|office|mail|service|team|support|noreply|no reply)\b/gi, "")
    .trim();

  if (!cleaned || cleaned.length < 2) return "";
  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function nameFromMailText(text = "") {
  const introMatch = text.match(/mein name ist\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß.-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß.-]+){1,3})/i);
  if (introMatch) return introMatch[1].trim();

  const signatureMatch = text.match(/(?:mit freundlichen grüßen|freundliche grüße|beste grüße|viele grüße)\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß.-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß.-]+){1,3})/i);
  if (signatureMatch) return signatureMatch[1].trim();

  return "";
}

function salutation(email) {
  const name = nameFromMailText(email.bodyText || email.snippet || "") || senderDisplayName(email.from);
  return name ? `Guten Tag ${name},` : "Guten Tag,";
}

function compactText(value = "") {
  return value
    .replace(/\s+/g, " ")
    .replace(/\[[^\]]+\]/g, "")
    .trim();
}

function firstSentence(text = "") {
  const cleaned = compactText(text);
  if (!cleaned) return "";
  const sentence = cleaned.match(/^.{24,220}?[.!?](?:\s|$)/);
  return sentence ? sentence[0].trim() : `${cleaned.slice(0, 180).trim()}${cleaned.length > 180 ? " ..." : ""}`;
}

function detectedContext(email) {
  const text = [email.subject, email.snippet, email.bodyText, email.nextAction].join(" ").toLowerCase();
  const contexts = [];
  if (textIncludes(text, ["frist", "bis zum", "deadline", "ablauf", "fällig"])) contexts.push("Frist");
  if (textIncludes(text, ["termin", "kalender", "meeting", "besprechung", "rückruf", "telefonat", "call"])) contexts.push("Termin");
  if (textIncludes(text, ["angebot", "preis", "kosten", "auftrag", "projekt", "beratung"])) contexts.push("Angebot/Projekt");
  if (textIncludes(text, ["rechnung", "zahlung", "mahnung", "beleg", "gutschrift"])) contexts.push("Rechnung/Zahlung");
  if (textIncludes(text, ["frage", "rückfrage", "bitte", "antwort", "rückmeldung"])) contexts.push("Rückfrage");
  return contexts.length ? contexts.join(", ") : "Kein spezieller Kontext erkannt";
}

function mailSummary(email) {
  const source = email.bodyText || email.snippet || "";
  const core = firstSentence(source) || email.subject || "Keine Kernaussage erkannt.";
  const action = email.nextAction || "Keine konkrete Aktion erkannt.";
  return [
    ["Kernaussage", core],
    ["Handlungsbedarf", action],
    ["Kontext", detectedContext(email)]
  ];
}

function attachmentSection(email) {
  const attachments = Array.isArray(email.attachments) ? email.attachments : [];
  if (!attachments.length && activeWorkspace !== "dokumente") return "";
  const rows = attachments.length
    ? attachments
        .map((attachment) => `
          <li>
            <strong>${escapeHtml(attachment.filename || "Unbenannte Datei")}</strong>
            <span>${escapeHtml(attachment.mimeType || "Dateityp unbekannt")} · ${formatBytes(attachment.size)}</span>
          </li>
        `)
        .join("")
    : "<li><strong>Kein Gmail-Anhang erkannt</strong><span>Diese Mail wurde wegen dokumenttypischer Begriffe eingeordnet.</span></li>";
  return `
    <section class="attachmentBox">
      <div class="summaryHead">
        <span>Dokumente / Anhänge</span>
        <small>${attachments.length} Datei${attachments.length === 1 ? "" : "en"}</small>
      </div>
      <ul>${rows}</ul>
    </section>
  `;
}

function workspaceNotice(email) {
  if (activeWorkspace === "termine") {
    return `<div class="systemNotice">Termin-Arbeitsbereich: Diese Mail wurde als Termin, Rückruf, Besprechung oder Smart-Booking-Nachricht erkannt. Prüfe bei Bedarf freie Zeitfenster und erstelle daraus einen Antwortentwurf.</div>`;
  }
  if (activeWorkspace === "dokumente") {
    return `<div class="systemNotice">Dokumenten-Arbeitsbereich: Diese Mail enthält einen Anhang oder dokumenttypische Inhalte. Prüfe Dokumentart, Fristen, Beträge und ob eine Rückfrage nötig ist.</div>`;
  }
  return "";
}

function defaultReply(email) {
  const combined = [email.from, email.subject, email.snippet, email.bodyText, email.nextAction].join(" ").toLowerCase();
  const greeting = salutation(email);

  if (textIncludes(combined, ["happ", "baurevision", "festool", "tts", "bauprojekt", "baubegleitung"])) {
    return `${greeting}\n\nvielen Dank für Ihre Anfrage und Ihr Interesse an meiner Baurevision.\n\nGerne tausche ich mich mit Ihnen zu Ihrem Bauprojekt aus und bespreche, welche Punkte aus Revisionssicht sinnvoll geprüft werden sollten. Senden Sie mir dafür gerne zwei bis drei Terminvorschläge für ein kurzes Erstgespräch oder vorab ein paar Eckdaten zum Projekt, damit ich mich gezielt vorbereiten kann.\n\nMit freundlichen Grüßen\nBernhard Metzger`;
  }

  if (textIncludes(combined, ["termin", "kalender", "meeting", "besprechung", "rückruf", "telefonat", "call"])) {
    return `${greeting}\n\nvielen Dank für Ihre Nachricht.\n\nGerne stimme ich einen passenden Termin mit Ihnen ab. Bitte senden Sie mir zwei bis drei Zeitfenster, die für Sie gut passen. Falls es bereits Unterlagen oder konkrete Punkte für das Gespräch gibt, können Sie mir diese gerne vorab mitschicken.\n\nMit freundlichen Grüßen\nBernhard Metzger`;
  }

  if (textIncludes(combined, ["angebot", "anfrage", "projekt", "beratung", "auftrag", "kosten", "preis"])) {
    return `${greeting}\n\nvielen Dank für Ihre Anfrage.\n\nIch sehe mir die Punkte gerne genauer an. Damit ich Ihnen fundiert antworten kann, senden Sie mir bitte noch die wichtigsten Eckdaten, den gewünschten Zeitraum und gegebenenfalls vorhandene Unterlagen. Danach melde ich mich mit einer konkreten Einschätzung zurück.\n\nMit freundlichen Grüßen\nBernhard Metzger`;
  }

  if (textIncludes(combined, ["rechnung", "zahlung", "mahnung", "beleg", "gutschrift"])) {
    return `${greeting}\n\nvielen Dank für Ihre Nachricht.\n\nIch prüfe den Vorgang und melde mich mit einer kurzen Rückmeldung, sobald ich die Angaben abgeglichen habe. Falls eine Rechnungsnummer oder ein Beleg dazugehört, senden Sie mir diese Information bitte noch mit.\n\nMit freundlichen Grüßen\nBernhard Metzger`;
  }

  if (email.bucket === "info" || email.bucket === "werbung") {
    return `${greeting}\n\nvielen Dank für die Information.\n\nIch habe Ihre Nachricht erhalten und nehme sie zur Kenntnis. Sollte sich daraus ein konkreter nächster Schritt ergeben, melde ich mich separat bei Ihnen.\n\nMit freundlichen Grüßen\nBernhard Metzger`;
  }

  if (email.bucket === "prüfen") {
    return `${greeting}\n\nvielen Dank für Ihre Nachricht.\n\nIch prüfe den Inhalt und die offenen Punkte sorgfältig. Falls noch Unterlagen, Fristen oder konkrete Erwartungen dazugehören, senden Sie mir diese bitte kurz mit, damit ich die Antwort vollständig vorbereiten kann.\n\nMit freundlichen Grüßen\nBernhard Metzger`;
  }

  return `${greeting}\n\nvielen Dank für Ihre Nachricht.\n\nIch habe Ihr Anliegen aufgenommen und melde mich mit einer konkreten Rückmeldung dazu. Falls es eine Frist oder zusätzliche Informationen gibt, senden Sie mir diese bitte noch kurz mit.\n\nMit freundlichen Grüßen\nBernhard Metzger`;
}

async function archiveEmail(email) {
  if (!confirm(`E-Mail archivieren?\n\n${email.subject}`)) return;
  await api(`/api/messages/${email.id}/archive`, { method: "POST" });
  showNotice("E-Mail wurde archiviert.");
  await loadEmails();
}

async function trashEmail(email) {
  if (!confirm(`E-Mail in den Papierkorb verschieben?\n\n${email.subject}`)) return;
  await api(`/api/messages/${email.id}/trash`, { method: "POST" });
  showNotice("E-Mail wurde in den Papierkorb verschoben.");
  await loadEmails();
}

async function createDraft(email) {
  if (email.isSmartBooking) {
    showNotice("Für Smart-Booking-Terminmails werden keine Antwortentwürfe erstellt.");
    return;
  }
  const text = detailEl.querySelector("#draftText").value;
  const subject = email.subject.toLowerCase().startsWith("re:") ? email.subject : `Re: ${email.subject}`;
  const existingDraftId = draftIdForEmail(email);
  if (hasCreatedDraft(email) && !existingDraftId && !confirm("Für diese Mail wurde bereits ein Entwurf erkannt, aber keine Draft-ID ist verfügbar. Einen neuen Entwurf erstellen?")) {
    return;
  }

  const result = await api(existingDraftId ? `/api/drafts/${existingDraftId}` : "/api/drafts", {
    method: existingDraftId ? "PUT" : "POST",
    body: JSON.stringify({
      to: email.from,
      subject,
      text,
      threadId: email.threadId
    })
  });
  markDraftCreated(email, result.result?.id || existingDraftId);
  email.hasGmailDraft = true;
  showNotice(existingDraftId ? "Antwortentwurf wurde in Gmail aktualisiert." : "Antwortentwurf wurde in Gmail erstellt.");
  render();
}

function renderCalendarDetail(event) {
  const attendees = event.attendees?.length
    ? event.attendees
        .map((attendee) => `<li>${escapeHtml(attendee.displayName || attendee.email)}${attendee.responseStatus ? ` <span>${escapeHtml(attendee.responseStatus)}</span>` : ""}</li>`)
        .join("")
    : "<li>Keine Teilnehmer in den Kalenderdaten.</li>";
  const description = event.description || "Keine Beschreibung im Kalendereintrag.";

  detailEl.innerHTML = `
    <p class="panelLabel">Kalender-Termin</p>
    <div class="badges">
      <span class="badge appointmentBadge">Google Calendar</span>
      <span class="badge bucket">${escapeHtml(event.calendarName || "Kalender")}</span>
      ${event.isAllDay ? '<span class="badge bucket">Ganztägig</span>' : ""}
    </div>
    <h2>${escapeHtml(event.title)}</h2>
    <section class="mailSummaryBox appointmentSummary" aria-label="Termin-Zusammenfassung">
      <div class="summaryHead">
        <span>Termin-Zusammenfassung</span>
        <small>Kalendereintrag</small>
      </div>
      <ul>
        <li><strong>Zeit:</strong> ${escapeHtml(formatEventRange(event))}</li>
        <li><strong>Kalender:</strong> ${escapeHtml(event.calendarName || "Google Calendar")}</li>
        <li><strong>Ort:</strong> ${escapeHtml(event.location || "Kein Ort hinterlegt")}</li>
        <li><strong>Vorbereitung:</strong> Unterlagen, offene Rückfragen und Bezugsmails prüfen.</li>
      </ul>
    </section>
    <div class="detailGrid">
      <div class="fact"><span>Organisator</span>${escapeHtml(event.organizer || "unbekannt")}</div>
      <div class="fact"><span>Kalender</span>${escapeHtml(event.calendarName || "Google Calendar")}</div>
      <div class="fact"><span>Status</span>${escapeHtml(event.status || "unbekannt")}</div>
      <div class="fact"><span>Beginn</span>${escapeHtml(formatEventRange(event))}</div>
      <div class="fact"><span>Teilnehmer</span>${event.attendees?.length || 0}</div>
    </div>
    <div class="actions">
      ${event.htmlLink ? `<a class="button primary" href="${event.htmlLink}" target="_blank" rel="noreferrer">In Google Calendar öffnen</a>` : ""}
    </div>
    <div class="systemNotice">Dieser Eintrag kommt direkt aus Google Calendar. SMART OfficeHub liest alle sichtbaren Google-Kalender, darunter auch eingebundene Kalender wie „privat“, sofern Google sie über die Calendar API bereitstellt.</div>
    <section class="attachmentBox">
      <div class="summaryHead">
        <span>Teilnehmer</span>
        <small>${event.attendees?.length || 0}</small>
      </div>
      <ul>${attendees}</ul>
    </section>
    <details class="mailBodyBox">
      <summary>
        <span>Beschreibung anzeigen</span>
        <small>${description.length.toLocaleString("de-DE")} Zeichen</small>
      </summary>
      <pre>${escapeHtml(description)}</pre>
    </details>
  `;
}

function renderDocumentDetail(item) {
  const { email, attachment, assessment, documentType, status, key } = item;
  const originalText = email.bodyText || email.snippet || "Kein Mailtext verfügbar.";
  const assessmentRows = assessment.flags
    .map((flag) => `<li>${escapeHtml(flag)}</li>`)
    .join("");

  detailEl.innerHTML = `
    <p class="panelLabel">Dokument</p>
    <div class="badges">
      <span class="badge documentBadge">Gmail-Anhang</span>
      <span class="badge typeBadge">${escapeHtml(documentType)}</span>
      <span class="badge statusBadge ${escapeHtml(status)}">${documentStatusLabel(status)}</span>
      <span class="badge bucket">${escapeHtml(attachment.mimeType || "Datei")}</span>
    </div>
    <h2>${escapeHtml(attachment.filename || "Unbenannte Datei")}</h2>
    <section class="mailSummaryBox documentSummary" aria-label="Dokument-Zusammenfassung">
      <div class="summaryHead">
        <span>Dokument-Zusammenfassung</span>
        <small>Anhang aus Gmail</small>
      </div>
      <ul>
        <li><strong>Dokumenttyp:</strong> ${escapeHtml(documentType)}</li>
        <li><strong>Dateityp:</strong> ${escapeHtml(attachment.mimeType || "unbekannt")}</li>
        <li><strong>Größe:</strong> ${formatBytes(attachment.size)}</li>
        <li><strong>Nächster Schritt:</strong> ${escapeHtml(assessment.nextAction)}</li>
      </ul>
    </section>
    <section class="documentWorkBox">
      <div class="summaryHead">
        <span>Prüfstatus</span>
        <small>Arbeitsliste</small>
      </div>
      <label class="statusControl">
        <span>Status</span>
        <select id="documentStatusSelect">
          <option value="neu" ${status === "neu" ? "selected" : ""}>Neu</option>
          <option value="prüfen" ${status === "prüfen" ? "selected" : ""}>Prüfen</option>
          <option value="erledigt" ${status === "erledigt" ? "selected" : ""}>Erledigt</option>
          <option value="archivieren" ${status === "archivieren" ? "selected" : ""}>Archivieren</option>
        </select>
      </label>
      <div class="assessmentList">
        <strong>Bewertung</strong>
        <ul>${assessmentRows}</ul>
      </div>
    </section>
    <div class="detailGrid">
      <div class="fact"><span>Absender</span>${escapeHtml(email.from)}</div>
      <div class="fact"><span>Datum</span>${formatDate(email.date, email.timestamp)}</div>
      <div class="fact"><span>Quellmail</span>${escapeHtml(email.subject)}</div>
      <div class="fact"><span>Status</span>${documentStatusLabel(status)}</div>
    </div>
    <div class="actions">
      <a class="button primary" href="${email.gmailUrl}" target="_blank" rel="noreferrer">Quellmail in Gmail öffnen</a>
      <button class="button secondary" type="button" id="analyzeDocumentButton">Dokumentinhalt analysieren</button>
    </div>
    <div class="systemNotice">Dieses Dokument ist ein echter Gmail-Anhang. Über „Dokumentinhalt analysieren“ wird der Anhang aus Gmail geladen und soweit möglich textlich ausgewertet. Text, CSV, HTML und einfache PDF-Texte funktionieren direkt; Word/Excel benötigen später einen Spezialparser.</div>
    ${renderDocumentAnalysis(key)}
    <details class="mailBodyBox">
      <summary>
        <span>Quellmail anzeigen</span>
        <small>${originalText.length.toLocaleString("de-DE")} Zeichen</small>
      </summary>
      <pre>${escapeHtml(originalText)}</pre>
    </details>
  `;

  detailEl.querySelector("#documentStatusSelect")?.addEventListener("change", (event) => {
    setDocumentStatus(key, event.target.value);
  });
  detailEl.querySelector("#analyzeDocumentButton")?.addEventListener("click", () => analyzeDocument(item));
}

function renderEmailDetail(email) {
  const hasDraft = hasCreatedDraft(email);
  const existingDraftId = draftIdForEmail(email);
  const originalText = email.bodyText || email.snippet || "Kein Mailtext verfügbar.";
  const draftText = defaultReply(email);
  const summaryLines = mailSummary(email)
    .map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`)
    .join("");
  const smartBookingNotice = email.isSmartBooking
    ? '<div class="systemNotice">Smart-Booking-Mail: Terminbestätigung oder Terminänderung. Dafür wird kein Antwortentwurf erstellt.</div>'
    : "";
  const draftSection = email.isSmartBooking
    ? ""
    : `<div class="draftBox">
      <label for="draftText"><strong>Antwortentwurf</strong></label>
      <textarea id="draftText">${escapeHtml(draftText)}</textarea>
      <div class="actions">
        <button class="button secondary" type="button" id="draftButton">${existingDraftId ? "Entwurf in Gmail aktualisieren" : "Entwurf in Gmail erstellen"}</button>
      </div>
    </div>`;

  detailEl.innerHTML = `
    <p class="panelLabel">Detailbereich</p>
    <div class="badges">
      <span class="badge ${email.priority}">${email.priority}</span>
      <span class="badge bucket">${labels[email.bucket] || email.bucket}</span>
      ${isAppointmentEmail(email) ? '<span class="badge appointmentBadge">Termin</span>' : ""}
      ${isDocumentEmail(email) ? '<span class="badge documentBadge">Dokument</span>' : ""}
      ${hasDraft ? '<span class="badge draftBadge">Entwurf erstellt</span>' : ""}
    </div>
    <h2>${escapeHtml(email.subject)}</h2>
    <section class="mailSummaryBox" aria-label="Mail-Zusammenfassung">
      <div class="summaryHead">
        <span>Mail-Zusammenfassung</span>
        <small>Arbeitsübersicht</small>
      </div>
      <ul>${summaryLines}</ul>
    </section>
    <div class="detailGrid">
      <div class="fact"><span>Absender</span>${escapeHtml(email.from)}</div>
      <div class="fact"><span>Datum</span>${formatDate(email.date, email.timestamp)}</div>
      <div class="fact"><span>Label</span>${escapeHtml(email.labels.join(", ") || "keine")}</div>
      <div class="fact"><span>Nächster Schritt</span>${escapeHtml(email.nextAction)}</div>
    </div>
    <div class="actions">
      <a class="button primary" href="${email.gmailUrl}" target="_blank" rel="noreferrer">In Gmail öffnen</a>
      <button class="button secondary" type="button" id="archiveButton">Archivieren</button>
      <button class="button danger" type="button" id="trashButton">In Papierkorb</button>
    </div>
    ${hasDraft ? `<div class="draftNotice">${existingDraftId ? "Für diese Mail gibt es einen Gmail-Entwurf. Änderungen im Textfeld werden erst mit „Entwurf in Gmail aktualisieren“ in Gmail übernommen." : "Für diese Mail wurde bereits ein Gmail-Entwurf erkannt. Ohne Draft-ID kann nur ein neuer Entwurf erstellt werden."}</div>` : ""}
    ${workspaceNotice(email)}
    ${smartBookingNotice}
    ${attachmentSection(email)}
    <details class="mailBodyBox">
      <summary>
        <span>Vollständige Eingangs-Mail</span>
        <small>${originalText.length.toLocaleString("de-DE")} Zeichen · zur Kontrolle öffnen</small>
      </summary>
      <pre>${escapeHtml(originalText)}</pre>
    </details>
    ${draftSection}
  `;

  detailEl.querySelector("#archiveButton").addEventListener("click", () => archiveEmail(email));
  detailEl.querySelector("#trashButton").addEventListener("click", () => trashEmail(email));
  detailEl.querySelector("#draftButton")?.addEventListener("click", () => createDraft(email));
}

function renderDetail() {
  const item = filteredItems().find((entry) => entry.key === activeId);
  if (!item) return;
  if (item.kind === "event") {
    renderCalendarDetail(item.event);
    return;
  }
  if (item.kind === "document") {
    renderDocumentDetail(item);
    return;
  }
  renderEmailDetail(item.email);
}

function render() {
  renderDashboardHeading();
  renderSummary();
  renderWorkspaceTabs();
  renderTabs();
  renderList();
  renderDetail();
}

searchEl.addEventListener("input", () => {
  activeId = filteredItems()[0]?.key || null;
  render();
});

refreshButton.addEventListener("click", async () => {
  if (isFileMode()) {
    window.location.href = "http://localhost:8791/";
    return;
  }

  try {
    await loadEmails();
  } catch (error) {
    showNotice(error.message, "error");
  }
});

helpButton.addEventListener("click", openHelp);
helpCloseButton.addEventListener("click", closeHelp);
helpBackdrop.addEventListener("click", closeHelp);
helpSearchInput.addEventListener("input", filterHelp);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && helpOverlay.classList.contains("active")) {
    closeHelp();
  }
});

async function init() {
  render();
  if (isFileMode()) {
    loginLink.href = "http://localhost:8791/auth/start";
    showNotice("SMART OfficeHub wurde als Datei geöffnet. Google Login funktioniert nur über den lokalen Server. Öffne http://localhost:8791/ oder klicke auf „Mit Google verbinden“.", "error");
    return;
  }

  const pageError = new URLSearchParams(window.location.search).get("error");
  if (pageError) {
    showNotice(pageError, "error");
    window.history.replaceState({}, "", "/");
    return;
  }
  try {
    if (await checkStatus()) await loadEmails();
  } catch (error) {
    showNotice(error.message, "error");
  }
}

init();
