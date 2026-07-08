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
  dokumente: "Dokumente",
  aufgaben: "Aufgaben",
  ki: "KI Übersicht"
};
const workspaceIcons = {
  mails: "mail",
  termine: "calendar",
  dokumente: "file",
  aufgaben: "tasks",
  ki: "sparkles"
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
  },
  aufgaben: {
    title: "Aufgaben Dashboard",
    subline: "Status- und Wiedervorlage-Zentrale für Mails, Termine und Dokumente"
  },
  ki: {
    title: "KI Dashboard",
    subline: "Assistenz für Priorisierung, Zusammenfassung, Antworttexte, Termine, Dokumente und Tagesplanung"
  }
};
const workspaceGuides = {
  mails: {
    label: "Mail-Arbeitsbereich",
    text: "Hier werden E-Mails übersichtlich sortiert: Welche Nachricht braucht eine Antwort, welche muss geprüft werden, welche enthält Termine oder reine Informationen?",
    action: "Listen zeigen nur das Wichtigste. Alle Angaben stehen im Detailbereich: Zusammenfassung, Originalmail, Entwurf und Aktionen."
  },
  termine: {
    label: "Termin-Arbeitsbereich",
    text: "Hier stehen echte Kalendereinträge aus verbundenen Kalendern sowie terminrelevante Arbeitsinformationen im Fokus.",
    action: "Listen und Wochenansicht zeigen nur terminrelevante Angaben. Details, Teilnehmer, Beschreibung und Aktionen stehen rechts."
  },
  dokumente: {
    label: "Dokumenten-Arbeitsbereich",
    text: "Hier werden Anhänge und Unterlagen als eigene Arbeitsliste sichtbar, damit Rechnungen, Angebote, Verträge und Prüfunterlagen nicht in Mails untergehen.",
    action: "Listen zeigen Datei, Typ und Status. Alle Angaben zur Quellmail, Analyse und Bewertung stehen im Detailbereich."
  },
  aufgaben: {
    label: "Aufgaben-Arbeitsbereich",
    text: "Hier laufen Mails, Termine und Dokumente zusammen, sobald ein Arbeitsstatus, eine Wiedervorlage oder ein klarer Prüfbedarf besteht.",
    action: "Nächster Schritt: Nach Status filtern, fällige Wiedervorlagen bearbeiten und erledigte Aufgaben abschließen."
  },
  ki: {
    label: "KI Übersicht",
    text: "Hier bündelt SMART OfficeHub wichtige Hinweise aus Mails, Terminen und Dokumenten zu einer Prioritätenliste.",
    action: "Nächster Schritt: wichtigste Hinweise zuerst prüfen und danach in den jeweiligen Arbeitsbereich wechseln."
  }
};
const workspaceOrder = ["mails", "termine", "dokumente", "aufgaben", "ki"];
const taskFilterLabels = {
  alle: "Alle",
  offen: "Offen",
  "in-bearbeitung": "In Bearbeitung",
  warten: "Warten",
  wiedervorlage: "Wiedervorlage",
  faellig: "Fällig",
  erledigt: "Erledigt"
};
const taskFilterOrder = ["alle", "offen", "in-bearbeitung", "warten", "wiedervorlage", "faellig", "erledigt"];
let emails = [];
let calendarEvents = [];
let calendars = [];
let activeWorkspace = "mails";
let activeBucket = "alle";
let activeTaskFilter = "alle";
let activeId = null;
let calendarWeekOffset = 0;
let inboxStats = {
  smartBookingCount14d: 0,
  windowStart: null,
  generatedAt: null
};
const draftStorageKey = "smartOfficeHubDraftCreatedIds";
const draftIdStorageKey = "smartOfficeHubDraftIds";
const documentStatusStorageKey = "smartOfficeHubDocumentStatus";
const workStatusStorageKey = "smartOfficeHubWorkStatus";
const followUpStorageKey = "smartOfficeHubFollowUps";
const anthropicApiKeyStorageKey = "smartOfficeHubAnthropicApiKey";
const sidebarCollapsedStorageKey = "smartOfficeHubSidebarCollapsed";
const hiddenCalendarsStorageKey = "smartOfficeHubHiddenCalendars";
const draftCreatedIds = new Set(loadDraftCreatedIds());
const draftIdsByEmail = loadDraftIds();
const documentStatusByKey = loadDocumentStatus();
const workStatusByKey = loadStoredObject(workStatusStorageKey);
const followUpByKey = loadStoredObject(followUpStorageKey);
const hiddenCalendarIds = new Set(loadHiddenCalendarIds());
const documentAnalysisByKey = {};
const autoKiDraftsByEmail = new Map();
let anthropicApiKey = loadAnthropicApiKey();
let anthropicKeyVisible = false;
let anthropicConnected = false;
let anthropicBusy = "";
let sidebarCollapsed = localStorage.getItem(sidebarCollapsedStorageKey) === "true";

const noticeEl = document.querySelector("#notice");
const dashboardTitleEl = document.querySelector("#dashboardTitle");
const dashboardSublineEl = document.querySelector("#dashboardSubline");
const todayFocusEl = document.querySelector("#todayFocus");
const summaryEl = document.querySelector("#summary");
const workspaceTabsEl = document.querySelector("#workspaceTabs");
const workspaceGuideEl = document.querySelector("#workspaceGuide");
const sidebarCollapseButton = document.querySelector("#sidebarCollapseButton");
const sidebarCollapseIcon = document.querySelector(".sidebarCollapseIcon");
const backupButton = document.querySelector("#backupButton");
const restoreButton = document.querySelector("#restoreButton");
const restoreInput = document.querySelector("#restoreInput");
const tabsEl = document.querySelector("#tabs");
const listEl = document.querySelector("#mailList");
const detailEl = document.querySelector("#detail");
const searchEl = document.querySelector("#searchInput");
const refreshButton = document.querySelector("#refreshButton");
const loginLink = document.querySelector("#loginLink");
const apiKeyButton = document.querySelector("#apiKeyButton");
const apiKeyOverlay = document.querySelector("#apiKeyOverlay");
const apiKeyBackdrop = document.querySelector("#apiKeyBackdrop");
const apiKeyCloseButton = document.querySelector("#apiKeyCloseButton");
const anthropicApiKeyInput = document.querySelector("#anthropicApiKeyInput");
const toggleApiKeyButton = document.querySelector("#toggleApiKeyButton");
const deleteApiKeyButton = document.querySelector("#deleteApiKeyButton");
const saveApiKeyButton = document.querySelector("#saveApiKeyButton");
const connectApiKeyButton = document.querySelector("#connectApiKeyButton");
const verifyApiKeyButton = document.querySelector("#verifyApiKeyButton");
const disconnectApiKeyButton = document.querySelector("#disconnectApiKeyButton");
const apiKeyStatus = document.querySelector("#apiKeyStatus");
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

function showRuntimeError(error) {
  const message = error?.message || String(error || "Unbekannter Fehler");
  showNotice(`OfficeHub konnte eine Aktion nicht ausführen: ${message}`, "error");
}

function hideNotice() {
  noticeEl.className = "notice";
  noticeEl.textContent = "";
}

function iconSvg(name) {
  const icons = {
    mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v12H4z"></path><path d="m4 7 8 6 8-6"></path></svg>',
    calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v15H5z"></path><path d="M8 3v4"></path><path d="M16 3v4"></path><path d="M5 10h14"></path></svg>',
    file: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z"></path><path d="M14 3v5h5"></path><path d="M9 13h6"></path><path d="M9 17h6"></path></svg>',
    tasks: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11"></path><path d="M9 12h11"></path><path d="M9 18h11"></path><path d="m4 6 1 1 2-2"></path><path d="m4 12 1 1 2-2"></path><path d="m4 18 1 1 2-2"></path></svg>',
    sparkles: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"></path><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z"></path></svg>',
    panelLeftClose: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4z"></path><path d="M9 5v14"></path><path d="m16 10-2 2 2 2"></path></svg>',
    panelLeftOpen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4z"></path><path d="M9 5v14"></path><path d="m14 10 2 2-2 2"></path></svg>',
    save: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h12l2 2v14H5z"></path><path d="M8 4v6h8V4"></path><path d="M8 16h8"></path></svg>',
    restore: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 3-6"></path><path d="M4 4v6h6"></path><path d="M12 8v5l3 2"></path></svg>',
    help: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M9.8 9a2.4 2.4 0 0 1 4.6 1.1c0 1.8-2.4 2-2.4 4"></path><path d="M12 18h.01"></path></svg>'
  };
  return icons[name] || "";
}

function renderSidebarState() {
  document.body.classList.toggle("sidebarCollapsed", sidebarCollapsed);
  localStorage.setItem(sidebarCollapsedStorageKey, String(sidebarCollapsed));
  sidebarCollapseButton.setAttribute("aria-label", sidebarCollapsed ? "Sidebar ausklappen" : "Sidebar einklappen");
  sidebarCollapseButton.title = sidebarCollapsed ? "Sidebar ausklappen" : "";
  sidebarCollapseIcon.innerHTML = iconSvg(sidebarCollapsed ? "panelLeftOpen" : "panelLeftClose");
  sidebarCollapseButton.querySelector(".sidebarCollapseText").textContent = sidebarCollapsed ? "" : "Einklappen";
}

function openHelp() {
  if (!helpOverlay || !helpSearchInput) return;
  helpOverlay.classList.add("active");
  helpOverlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("helpOpen");
  helpSearchInput.focus();
}

function closeHelp() {
  if (!helpOverlay) return;
  helpOverlay.classList.remove("active");
  helpOverlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("helpOpen");
  document.querySelector("#helpButton")?.focus();
}

function filterHelp() {
  if (!helpSearchInput || !helpContent) return;
  const query = helpSearchInput.value.trim().toLowerCase();
  helpContent.querySelectorAll(".helpSection").forEach((section) => {
    const text = section.textContent.toLowerCase();
    section.hidden = Boolean(query) && !text.includes(query);
  });
}

function setApiKeyStatus(message, type = "info") {
  if (!apiKeyStatus) return;
  apiKeyStatus.textContent = message;
  apiKeyStatus.className = `apiKeyStatus ${type}`;
}

function setAnthropicBusy(action = "") {
  anthropicBusy = action;
  [saveApiKeyButton, connectApiKeyButton, verifyApiKeyButton, disconnectApiKeyButton, deleteApiKeyButton, toggleApiKeyButton]
    .filter(Boolean)
    .forEach((button) => {
      button.disabled = Boolean(action);
    });
  renderApiKeyPanel();
}

function renderApiKeyPanel() {
  if (!anthropicApiKeyInput) return;
  const hasKey = Boolean(anthropicApiKey);
  const inputIsMasked = hasKey && !anthropicKeyVisible && document.activeElement !== anthropicApiKeyInput;
  anthropicApiKeyInput.type = anthropicKeyVisible ? "text" : "password";
  anthropicApiKeyInput.value = inputIsMasked ? maskedAnthropicKey() : anthropicApiKeyInput.value || (anthropicKeyVisible ? anthropicApiKey : "");
  if (inputIsMasked) anthropicApiKeyInput.type = "text";
  anthropicApiKeyInput.readOnly = inputIsMasked;

  toggleApiKeyButton?.setAttribute("aria-label", anthropicKeyVisible ? "API-Schlüssel verbergen" : "API-Schlüssel anzeigen");
  connectApiKeyButton.textContent = anthropicConnected ? "Verbindung OK" : anthropicBusy === "connect" ? "Verbindung ..." : "Verbindung";
  connectApiKeyButton.classList.toggle("success", anthropicConnected);
  verifyApiKeyButton.textContent = anthropicBusy === "verify" ? "Prüfe ..." : "Verbindung überprüfen";
  saveApiKeyButton.textContent = anthropicBusy === "save" ? "Speichere ..." : "Speichern";

  const statusClass = apiKeyStatus?.className || "";
  const hasFinalFeedback = statusClass.includes("success") || statusClass.includes("error");
  if (!hasKey && !anthropicBusy && !hasFinalFeedback) setApiKeyStatus("Noch kein API-Schlüssel gespeichert.", "info");
  if (hasKey && !anthropicConnected && !anthropicBusy && !hasFinalFeedback) {
    setApiKeyStatus(`Gespeichert: ${maskedAnthropicKey()}. Verbindung noch nicht aktiv.`, "info");
  }
}

function openApiKeyPanel() {
  if (!apiKeyOverlay || !anthropicApiKeyInput) return;
  apiKeyOverlay.classList.add("active");
  apiKeyOverlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("modalOpen");
  anthropicKeyVisible = false;
  anthropicApiKeyInput.value = "";
  renderApiKeyPanel();
  anthropicApiKeyInput.focus();
}

function closeApiKeyPanel() {
  if (!apiKeyOverlay) return;
  apiKeyOverlay.classList.remove("active");
  apiKeyOverlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modalOpen");
  apiKeyButton?.focus();
}

function currentApiKeyInputValue() {
  const raw = anthropicApiKeyInput?.value.trim() || "";
  return raw.includes("•") ? anthropicApiKey : raw;
}

async function verifyAnthropicConnection(mode = "verify") {
  const key = currentApiKeyInputValue();
  if (!key) {
    anthropicConnected = false;
    setApiKeyStatus("Bitte zuerst einen Anthropic API-Schlüssel eingeben.", "error");
    renderApiKeyPanel();
    return false;
  }

  setAnthropicBusy(mode);
  setApiKeyStatus(mode === "save" ? "Schlüssel gespeichert, Verbindung wird geprüft ..." : "Verbindung zur Anthropic API wird geprüft ...", "loading");
  try {
    const data = await api("/api/anthropic/test", {
      method: "POST",
      body: JSON.stringify({ apiKey: key })
    });
    anthropicConnected = true;
    setApiKeyStatus(`Verbindung OK. Anthropic API erreichbar${data.result?.model ? `, erstes verfügbares Modell: ${data.result.model}` : ""}.`, "success");
    return true;
  } catch (error) {
    anthropicConnected = false;
    setApiKeyStatus(`Fehler: ${error.message}`, "error");
    return false;
  } finally {
    setAnthropicBusy("");
  }
}

async function saveAnthropicKeyFromInput() {
  const key = currentApiKeyInputValue();
  if (!key) {
    setApiKeyStatus("Bitte zuerst einen API-Schlüssel eingeben.", "error");
    return;
  }
  saveAnthropicApiKey(key);
  anthropicApiKeyInput.value = "";
  anthropicKeyVisible = false;
  renderApiKeyPanel();
  await verifyAnthropicConnection("save");
}

async function connectAnthropic() {
  if (!anthropicApiKey && currentApiKeyInputValue()) saveAnthropicApiKey(currentApiKeyInputValue());
  await verifyAnthropicConnection("connect");
}

async function generateKiReply(email, tone, currentText) {
  if (!anthropicApiKey) {
    openApiKeyPanel();
    throw new Error("Bitte zuerst den Anthropic API-Schlüssel speichern und die Verbindung prüfen.");
  }

  const result = await api("/api/anthropic/reply", {
    method: "POST",
    body: JSON.stringify({
      apiKey: anthropicApiKey,
      tone,
      currentText,
      email: {
        from: email.from,
        subject: email.subject,
        snippet: email.snippet,
        bodyText: email.bodyText,
        nextAction: email.nextAction,
        bucket: email.bucket,
        priority: email.priority,
        labels: email.labels
      }
    })
  });

  return result.result;
}

function setDraftSourceLabel(source = "Startentwurf", state = "fallback") {
  const label = detailEl.querySelector("#draftSourceLabel");
  if (!label) return;
  label.textContent = source;
  label.className = `draftSourceLabel ${state}`;
}

async function runKiDraft(email, { automatic = false } = {}) {
  const textarea = detailEl.querySelector("#draftText");
  const button = detailEl.querySelector("#improveDraftButton");
  if (!textarea || email.isSmartBooking) return;

  const tone = detailEl.querySelector("#draftTone")?.value || "professionell";
  const previousButtonLabel = button?.textContent || "Mit KI neu formulieren";
  if (button) {
    button.disabled = true;
    button.textContent = automatic ? "KI erstellt ..." : "KI formuliert ...";
  }
  textarea.dataset.kiBusy = "true";
  setDraftSourceLabel("KI-Entwurf wird erstellt ...", "loading");
  if (!automatic) showNotice("Die KI erstellt einen individuellen Antwortentwurf ...");

  try {
    const result = await generateKiReply(email, tone, textarea.value);
    textarea.value = result.reply;
    fitDraftTextarea(textarea);
    textarea.dataset.kiBusy = "";
    autoKiDraftsByEmail.set(email.id, result.reply);
    setDraftSourceLabel("KI-Entwurf", "success");
    showNotice(`KI-Entwurf wurde erstellt${result.model ? ` (${result.model})` : ""}. Gmail wird erst beim Erstellen oder Aktualisieren geändert.`);
  } catch (error) {
    textarea.dataset.kiBusy = "";
    setDraftSourceLabel("Startentwurf", "fallback");
    showNotice(
      automatic
        ? "KI-Entwurf konnte nicht automatisch erstellt werden. Der Startentwurf bleibt als Fallback sichtbar."
        : error.message || "Die KI konnte keinen Entwurf erstellen.",
      "error"
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = previousButtonLabel;
    }
  }
}

function disconnectAnthropic() {
  anthropicConnected = false;
  setApiKeyStatus(anthropicApiKey ? "Verbindung getrennt. Der gespeicherte Schlüssel bleibt erhalten." : "Verbindung getrennt.", "info");
  renderApiKeyPanel();
}

function deleteAnthropicKey() {
  clearAnthropicApiKey();
  anthropicApiKeyInput.value = "";
  anthropicKeyVisible = false;
  setApiKeyStatus("API-Schlüssel wurde gelöscht und die Verbindung getrennt.", "success");
  renderApiKeyPanel();
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

function loadStoredObject(key) {
  try {
    const stored = localStorage.getItem(key);
    const values = stored ? JSON.parse(stored) : {};
    return values && typeof values === "object" && !Array.isArray(values) ? values : {};
  } catch {
    return {};
  }
}

function loadHiddenCalendarIds() {
  try {
    const stored = localStorage.getItem(hiddenCalendarsStorageKey);
    const values = stored ? JSON.parse(stored) : [];
    return Array.isArray(values) ? values : [];
  } catch {
    return [];
  }
}

function loadAnthropicApiKey() {
  try {
    return localStorage.getItem(anthropicApiKeyStorageKey) || "";
  } catch {
    return "";
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

function saveStoredObject(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    showNotice("Der Arbeitsstatus konnte nicht dauerhaft gespeichert werden.", "error");
  }
}

function saveHiddenCalendarIds() {
  try {
    localStorage.setItem(hiddenCalendarsStorageKey, JSON.stringify([...hiddenCalendarIds]));
  } catch {
    showNotice("Die ausgeblendeten Kalender konnten nicht dauerhaft gespeichert werden.", "error");
  }
}

function saveAnthropicApiKey(value) {
  anthropicApiKey = value.trim();
  try {
    localStorage.setItem(anthropicApiKeyStorageKey, anthropicApiKey);
  } catch {
    setApiKeyStatus("Der Browser konnte den API-Schlüssel nicht lokal speichern.", "error");
  }
}

function exportOfficeHubBackup() {
  const backup = {
    app: "SMART OfficeHub",
    version: 1,
    exportedAt: new Date().toISOString(),
    session: {
      [draftStorageKey]: [...draftCreatedIds],
      [draftIdStorageKey]: draftIdsByEmail,
      [documentStatusStorageKey]: documentStatusByKey
    },
    local: {
      [sidebarCollapsedStorageKey]: sidebarCollapsed,
      [hiddenCalendarsStorageKey]: [...hiddenCalendarIds],
      [workStatusStorageKey]: workStatusByKey,
      [followUpStorageKey]: followUpByKey
    }
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `smart-officehub-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  showNotice("Datensicherung wurde als JSON erstellt.");
}

async function importOfficeHubBackup(file) {
  if (!file) return;
  try {
    const backup = JSON.parse(await file.text());
    const session = backup?.session || {};
    if (Array.isArray(session[draftStorageKey])) {
      sessionStorage.setItem(draftStorageKey, JSON.stringify(session[draftStorageKey]));
    }
    if (session[draftIdStorageKey] && typeof session[draftIdStorageKey] === "object") {
      sessionStorage.setItem(draftIdStorageKey, JSON.stringify(session[draftIdStorageKey]));
    }
    if (session[documentStatusStorageKey] && typeof session[documentStatusStorageKey] === "object") {
      sessionStorage.setItem(documentStatusStorageKey, JSON.stringify(session[documentStatusStorageKey]));
    }
    if (Array.isArray(backup?.local?.[hiddenCalendarsStorageKey])) {
      localStorage.setItem(hiddenCalendarsStorageKey, JSON.stringify(backup.local[hiddenCalendarsStorageKey]));
    }
    if (backup?.local?.[workStatusStorageKey] && typeof backup.local[workStatusStorageKey] === "object") {
      localStorage.setItem(workStatusStorageKey, JSON.stringify(backup.local[workStatusStorageKey]));
    }
    if (backup?.local?.[followUpStorageKey] && typeof backup.local[followUpStorageKey] === "object") {
      localStorage.setItem(followUpStorageKey, JSON.stringify(backup.local[followUpStorageKey]));
    }
    showNotice("Datensicherung wurde wiederhergestellt. Die Ansicht wird neu geladen.");
    setTimeout(() => window.location.reload(), 650);
  } catch {
    showNotice("Die Datensicherung konnte nicht gelesen werden.", "error");
  }
}

function clearAnthropicApiKey() {
  anthropicApiKey = "";
  anthropicConnected = false;
  try {
    localStorage.removeItem(anthropicApiKeyStorageKey);
  } catch {
    // If localStorage is unavailable, clearing in memory is still useful for this session.
  }
}

function maskedAnthropicKey() {
  if (!anthropicApiKey) return "";
  const visiblePrefix = anthropicApiKey.startsWith("sk-ant-")
    ? anthropicApiKey.slice(0, Math.min(10, anthropicApiKey.length))
    : anthropicApiKey.slice(0, Math.min(6, anthropicApiKey.length));
  return `${visiblePrefix}${"•".repeat(10)}`;
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

function workStatusLabel(value = "offen") {
  const labelsByStatus = {
    offen: "Offen",
    "in-bearbeitung": "In Bearbeitung",
    warten: "Warten auf Rückmeldung",
    erledigt: "Erledigt",
    wiedervorlage: "Wiedervorlage"
  };
  return labelsByStatus[value] || labelsByStatus.offen;
}

function workStatusFor(key) {
  return workStatusByKey[key] || "offen";
}

function followUpFor(key) {
  return followUpByKey[key] || "";
}

function isFollowUpDue(key) {
  const value = followUpFor(key);
  const date = value ? new Date(`${value}T00:00:00`) : null;
  return Boolean(date && !Number.isNaN(date.getTime()) && date <= new Date(new Date().setHours(23, 59, 59, 999)));
}

function setWorkStatus(key, value) {
  if (!value || value === "offen") delete workStatusByKey[key];
  else workStatusByKey[key] = value;
  saveStoredObject(workStatusStorageKey, workStatusByKey);
  render();
}

function setFollowUp(key, value) {
  if (!value) delete followUpByKey[key];
  else {
    followUpByKey[key] = value;
    if (!workStatusByKey[key] || workStatusByKey[key] === "offen") {
      workStatusByKey[key] = "wiedervorlage";
      saveStoredObject(workStatusStorageKey, workStatusByKey);
    }
  }
  saveStoredObject(followUpStorageKey, followUpByKey);
  render();
}

function tomorrowDateValue() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function applyTaskQuickAction(key, action) {
  if (action === "done") {
    workStatusByKey[key] = "erledigt";
    delete followUpByKey[key];
    showNotice("Aufgabe wurde als erledigt markiert.");
  }
  if (action === "waiting") {
    workStatusByKey[key] = "warten";
    showNotice("Aufgabe wurde auf „Warten“ gesetzt.");
  }
  if (action === "tomorrow") {
    workStatusByKey[key] = "wiedervorlage";
    followUpByKey[key] = tomorrowDateValue();
    showNotice("Aufgabe wurde auf morgen wiedervorgelegt.");
  }
  saveStoredObject(workStatusStorageKey, workStatusByKey);
  saveStoredObject(followUpStorageKey, followUpByKey);
  render();
}

function attachTaskQuickActions(scope = document) {
  scope.querySelectorAll("[data-task-action]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      applyTaskQuickAction(button.dataset.taskKey, button.dataset.taskAction);
    });
  });
}

function renderWorkControl(key, label = "Arbeitsstatus") {
  const status = workStatusFor(key);
  const followUp = followUpFor(key);
  return `
    <section class="workControlBox">
      <div class="summaryHead">
        <span>${escapeHtml(label)}</span>
        <small>${escapeHtml(workStatusLabel(status))}${followUp ? ` · Wiedervorlage ${escapeHtml(formatFollowUpDate(followUp))}` : ""}</small>
      </div>
      <div class="workControlGrid">
        <label class="statusControl">
          <span>Status</span>
          <select class="workStatusSelect" data-work-key="${escapeHtml(key)}">
            <option value="offen" ${status === "offen" ? "selected" : ""}>Offen</option>
            <option value="in-bearbeitung" ${status === "in-bearbeitung" ? "selected" : ""}>In Bearbeitung</option>
            <option value="warten" ${status === "warten" ? "selected" : ""}>Warten auf Rückmeldung</option>
            <option value="wiedervorlage" ${status === "wiedervorlage" ? "selected" : ""}>Wiedervorlage</option>
            <option value="erledigt" ${status === "erledigt" ? "selected" : ""}>Erledigt</option>
          </select>
        </label>
        <label class="statusControl">
          <span>Wiedervorlage</span>
          <input class="followUpInput" type="date" data-work-key="${escapeHtml(key)}" value="${escapeHtml(followUp)}">
        </label>
      </div>
    </section>
  `;
}

function attachWorkControlHandlers() {
  detailEl.querySelectorAll(".workStatusSelect").forEach((select) => {
    select.addEventListener("change", () => setWorkStatus(select.dataset.workKey, select.value));
  });
  detailEl.querySelectorAll(".followUpInput").forEach((input) => {
    input.addEventListener("change", () => setFollowUp(input.dataset.workKey, input.value));
  });
}

function formatFollowUpDate(value = "") {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
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

function formatMailAddress(value = "") {
  const match = String(value || "").match(/^"?([^"<@]+)"?\s*<([^>]+)>/);
  if (!match) return value || "unbekannt";
  const name = match[1].replace(/\s+/g, " ").trim();
  const address = match[2].trim();
  return name ? `${name} · ${address}` : address;
}

function readableMailStatus(labels = []) {
  const labelSet = new Set(labels || []);
  const statuses = [];
  if (labelSet.has("UNREAD")) statuses.push("Ungelesen");
  if (labelSet.has("IMPORTANT")) statuses.push("Wichtig");
  if (labelSet.has("INBOX")) statuses.push("Posteingang");
  if (labelSet.has("SENT")) statuses.push("Gesendet");
  if (labelSet.has("DRAFT")) statuses.push("Entwurf");
  if (labelSet.has("STARRED")) statuses.push("Markiert");
  if (labelSet.has("TRASH")) statuses.push("Papierkorb");
  if (labelSet.has("SPAM")) statuses.push("Spam");
  return statuses.length ? statuses.join(" · ") : "Kein besonderer Status";
}

function readableMailCategory(labels = []) {
  const labelSet = new Set(labels || []);
  if (labelSet.has("CATEGORY_PERSONAL")) return "Persönlich";
  if (labelSet.has("CATEGORY_UPDATES")) return "Updates";
  if (labelSet.has("CATEGORY_PROMOTIONS")) return "Werbung";
  if (labelSet.has("CATEGORY_SOCIAL")) return "Soziale Netzwerke";
  if (labelSet.has("CATEGORY_FORUMS")) return "Foren";
  return labels?.length ? "Sonstige" : "Keine Kategorie";
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fitDraftTextarea(textarea) {
  if (!textarea) return;
  textarea.style.height = "auto";
  textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 280), 720)}px`;
}

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
  } catch (error) {
    await new Promise((resolve) => setTimeout(resolve, 450));
    try {
      response = await fetch(path, {
        ...options,
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {})
        }
      });
    } catch {
      throw new Error("Lokaler OfficeHub-Server nicht erreichbar. Bitte http://localhost:8791 neu laden oder den Server mit npm start neu starten.");
    }
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Der lokale Server hat keine lesbare Antwort zurückgegeben.");
  }
  if (!response.ok) throw new Error(data.error || "Aktion fehlgeschlagen.");
  return data;
}

async function checkStatus() {
  const status = await api("/api/status");
  if (!status.configured) {
    showNotice(`Google OAuth ist noch nicht eingerichtet. Lokal config.local.json anlegen; auf Vercel GOOGLE_CLIENT_ID und GOOGLE_CLIENT_SECRET setzen. Redirect URI: ${status.redirectUri}`, "error");
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
    api("/api/calendar/events?days=90&maxResults=120")
  ]);
  emails = result.emails;
  calendars = calendarResult.calendars || [];
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

function visibleCalendarEvents() {
  return calendarEvents.filter((event) => !hiddenCalendarIds.has(event.calendarId));
}

function visibleCalendarCount() {
  return calendars.filter((calendar) => !hiddenCalendarIds.has(calendar.id)).length;
}

function calendarEventKey(event) {
  return `event:${event.calendarId || "calendar"}:${event.id}`;
}

function sourceStatusFor(key) {
  return workStatusFor(key);
}

function isActionableTask(task) {
  return task.status !== "offen" || task.followUp || task.defaultActionable === true;
}

function taskItems() {
  const mailTasks = emails.map((email) => {
    const key = `mail:${email.id}`;
    const assessment = aiEmailAssessment(email);
    return {
      kind: "task",
      key: `task:${key}`,
      sourceKey: key,
      targetWorkspace: "mails",
      sourceType: "Mail",
      title: email.subject || "E-Mail ohne Betreff",
      meta: email.from || "Absender unbekannt",
      status: sourceStatusFor(key),
      followUp: followUpFor(key),
      defaultActionable: email.bucket === "antwort" || email.bucket === "prüfen" || assessment.replyNeeded || isDocumentEmail(email),
      action: assessment.nextAction || email.nextAction || "E-Mail prüfen.",
      score: assessment.score + (email.bucket === "antwort" ? 3 : 0)
    };
  });

  const eventTasks = visibleCalendarEvents().map((event) => {
    const key = calendarEventKey(event);
    const assessment = aiEventAssessment(event);
    const date = event.start ? new Date(event.start) : null;
    const today = date && !Number.isNaN(date.getTime()) && isSameDay(date, new Date());
    return {
      kind: "task",
      key: `task:${key}`,
      sourceKey: key,
      targetWorkspace: "termine",
      sourceType: "Termin",
      title: event.title || "Termin ohne Titel",
      meta: `${formatEventListDate(event)} · ${formatEventListTime(event)}`,
      status: sourceStatusFor(key),
      followUp: followUpFor(key),
      defaultActionable: today || assessment.priority !== "niedrig",
      action: assessment.nextAction || "Termin prüfen.",
      score: assessment.score + (today ? 4 : 0)
    };
  });

  const documentTasks = documentItems().map((item) => {
    const assessment = aiDocumentAssessment(item);
    return {
      kind: "task",
      key: `task:${item.key}`,
      sourceKey: item.key,
      targetWorkspace: "dokumente",
      sourceType: "Dokument",
      title: item.attachment.filename || "Dokument ohne Dateiname",
      meta: `${item.documentType} · ${documentStatusLabel(item.status)}`,
      status: sourceStatusFor(item.key),
      followUp: followUpFor(item.key),
      defaultActionable: item.status === "neu" || item.status === "prüfen" || ["Rechnung", "Angebot", "Vertrag"].includes(item.documentType),
      action: assessment.nextAction || item.assessment.nextAction || "Dokument prüfen.",
      score: assessment.score + (item.status === "prüfen" ? 3 : 0)
    };
  });

  return [...mailTasks, ...eventTasks, ...documentTasks]
    .filter(isActionableTask)
    .sort((a, b) => {
      if (isFollowUpDue(a.sourceKey) !== isFollowUpDue(b.sourceKey)) return isFollowUpDue(a.sourceKey) ? -1 : 1;
      return b.score - a.score;
    });
}

function filteredTaskItems(filter = activeTaskFilter) {
  return taskItems().filter((task) => {
    if (filter === "alle") return task.status !== "erledigt";
    if (filter === "faellig") return isFollowUpDue(task.sourceKey);
    return task.status === filter;
  });
}

function workspaceCount(workspace) {
  if (workspace === "termine") return visibleCalendarEvents().length;
  if (workspace === "dokumente") return documentItems().length;
  if (workspace === "aufgaben") return filteredTaskItems("alle").length;
  if (workspace === "ki") return aiDailyItems().length;
  return workspaceEmails(workspace).length;
}

function itemKey(item) {
  return item.kind === "event" ? calendarEventKey(item.event) : `mail:${item.email.id}`;
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
  if (item.kind === "ai") {
    if (item.aiType === "mail") return [item.email.from, item.email.subject, item.email.bodyText, item.assessment.highlights.join(" "), item.assessment.nextAction].join(" ").toLowerCase();
    if (item.aiType === "termin") return [item.event.title, item.event.description, item.event.location, item.assessment.prep.join(" ")].join(" ").toLowerCase();
    if (item.aiType === "dokument") return [item.document.attachment.filename, item.document.email.subject, item.assessment.risks.join(" "), item.assessment.nextAction].join(" ").toLowerCase();
  }
  if (item.kind === "task") {
    return [item.sourceType, item.title, item.meta, item.action, workStatusLabel(item.status), item.followUp].join(" ").toLowerCase();
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

function urgencyScoreFromText(text = "") {
  const lower = text.toLowerCase();
  let score = 0;
  if (textIncludes(lower, ["dringend", "eilt", "sofort", "heute", "asap", "frist", "deadline", "fällig"])) score += 3;
  if (textIncludes(lower, ["morgen", "zeitnah", "rückmeldung", "antwort", "bitte", "freigabe", "bestätigung"])) score += 2;
  if (textIncludes(lower, ["rechnung", "zahlung", "mahnung", "angebot", "auftrag", "termin", "meeting", "rückruf"])) score += 2;
  if (textIncludes(lower, ["newsletter", "werbung", "angebot des monats", "online ansehen"])) score -= 2;
  return score;
}

function priorityFromScore(score) {
  if (score >= 5) return "hoch";
  if (score >= 2) return "mittel";
  return "niedrig";
}

function aiEmailAssessment(email) {
  const text = [email.from, email.subject, email.snippet, email.bodyText, email.nextAction].join(" ");
  const lower = text.toLowerCase();
  const contexts = detectedContext(email).split(", ").filter((context) => context && context !== "Kein spezieller Kontext erkannt");
  const isAutomatedInfo = email.bucket === "werbung" || textIncludes(lower, [
    "newsletter",
    "online ansehen",
    "abmelden",
    "unsubscribe",
    "noreply",
    "no-reply",
    "google search console",
    "paypal open"
  ]);
  const strongReplySignal = textIncludes(lower, ["rückfrage", "rückmeldung", "können wir", "bitte senden", "bitte teilen", "termin vereinbaren", "angebot", "beratung", "auftrag"]) || /\?/.test(text);
  const replyNeeded = !email.isSmartBooking && !isAutomatedInfo && (email.bucket === "antwort" || strongReplySignal);
  const score = urgencyScoreFromText(text)
    + (email.priority === "hoch" ? 2 : email.priority === "mittel" ? 1 : 0)
    + (replyNeeded ? 2 : 0)
    - (isAutomatedInfo ? 4 : 0);
  const suggestedBucket = isAppointmentEmail(email)
    ? "termine"
    : isDocumentEmail(email)
      ? "prüfen"
      : replyNeeded
        ? "antwort"
        : isAutomatedInfo
          ? email.bucket === "werbung" ? "werbung" : "info"
          : "info";
  const highlights = [];
  if (replyNeeded) highlights.push("Antwortbedarf erkannt");
  if (contexts.includes("Termin")) highlights.push("Terminbezug");
  if (contexts.includes("Frist")) highlights.push("Frist prüfen");
  if (contexts.includes("Rechnung/Zahlung")) highlights.push("Zahlung oder Rechnung");
  if (isDocumentEmail(email)) highlights.push(`${emailDocumentCount(email)} Anhang${emailDocumentCount(email) === 1 ? "" : "e"}`);
  if (!highlights.length) highlights.push("Zur Kenntnisnahme");

  return {
    score,
    priority: priorityFromScore(score),
    suggestedBucket,
    replyNeeded,
    highlights,
    summary: mailSummary(email),
    nextAction: email.isSmartBooking
      ? "Terminstatus im Kalender prüfen; kein Antwortentwurf nötig."
      : replyNeeded
        ? "Antwortentwurf prüfen oder mit KI verbessern."
        : email.nextAction
  };
}

function aiEventAssessment(event) {
  const text = [event.title, event.description, event.location, event.organizer, event.calendarName].join(" ");
  const lower = text.toLowerCase();
  const starts = event.start ? new Date(event.start) : null;
  const hoursUntil = starts && !Number.isNaN(starts.getTime()) ? (starts.getTime() - Date.now()) / 36e5 : 999;
  const score = urgencyScoreFromText(text) + (hoursUntil <= 24 ? 3 : hoursUntil <= 72 ? 2 : 0) + (!event.location ? 1 : 0);
  const prep = [];
  if (hoursUntil <= 24) prep.push("Termin innerhalb der nächsten 24 Stunden prüfen");
  if (!event.location) prep.push("Ort oder Einwahllink fehlt");
  if (!event.description) prep.push("Agenda oder Beschreibung fehlt");
  if (textIncludes(lower, ["beratung", "projekt", "angebot", "erstgespräch", "meeting"])) prep.push("Unterlagen und Gesprächsziel vorbereiten");
  if (!prep.length) prep.push("Termin beobachten, aktuell kein kritischer Vorbereitungsbedarf");

  return {
    score,
    priority: priorityFromScore(score),
    prep,
    nextAction: prep[0]
  };
}

function aiDocumentAssessment(item) {
  const { email, attachment, assessment, documentType, key } = item;
  const analysis = documentAnalysisByKey[key];
  const text = [attachment.filename, attachment.mimeType, email.subject, email.bodyText, analysis?.summary, analysis?.preview].join(" ");
  const score = urgencyScoreFromText(text) + (["Rechnung", "Angebot", "Vertrag", "Leistungsverzeichnis"].includes(documentType) ? 2 : 0);
  const risks = [...assessment.flags];
  if (analysis?.signals?.length) risks.push(...analysis.signals.filter((signal) => !risks.includes(signal)));
  if (!analysis) risks.push("Inhaltsanalyse noch nicht gestartet");

  return {
    score,
    priority: priorityFromScore(score),
    risks: risks.length ? risks : ["Kein klares Risiko erkannt"],
    nextAction: analysis ? assessment.nextAction : "Dokumentinhalt analysieren und Prüfsignale bestätigen."
  };
}

function aiDailyItems() {
  const emailItems = emails
    .map((email) => ({ kind: "ai", aiType: "mail", key: `ai:mail:${email.id}`, email, assessment: aiEmailAssessment(email) }))
    .filter((item) => item.assessment.priority !== "niedrig" || item.assessment.replyNeeded || isDocumentEmail(item.email));
  const eventItems = visibleCalendarEvents()
    .map((event) => ({ kind: "ai", aiType: "termin", key: `ai:event:${event.id}`, event, assessment: aiEventAssessment(event) }))
    .filter((item) => item.assessment.priority !== "niedrig");
  const docItems = documentItems()
    .map((document) => ({ kind: "ai", aiType: "dokument", key: `ai:document:${document.key}`, document, assessment: aiDocumentAssessment(document) }))
    .filter((item) => item.assessment.priority !== "niedrig" || item.document.status === "prüfen");

  return [...emailItems, ...eventItems, ...docItems]
    .sort((a, b) => b.assessment.score - a.assessment.score)
    .slice(0, 12);
}

function workspaceItems() {
  if (activeWorkspace === "termine") {
    return visibleCalendarEvents().map((event) => ({ kind: "event", key: calendarEventKey(event), event }));
  }
  if (activeWorkspace === "dokumente") {
    return documentItems();
  }
  if (activeWorkspace === "aufgaben") {
    return filteredTaskItems();
  }
  if (activeWorkspace === "ki") {
    return aiDailyItems();
  }
  return workspaceEmails(activeWorkspace).map((email) => ({ kind: "email", key: `mail:${email.id}`, email }));
}

function renderDashboardHeading() {
  const meta = workspaceMeta[activeWorkspace] || workspaceMeta.mails;
  dashboardTitleEl.textContent = meta.title;
  dashboardSublineEl.textContent = meta.subline;
  document.body.dataset.workspace = activeWorkspace;
}

function selectedWeekEventCount() {
  const weekDays = calendarWeekDays();
  const weekEnd = new Date(weekDays[6]);
  weekEnd.setHours(23, 59, 59, 999);
  return visibleCalendarEvents().filter((event) => {
    const date = new Date(event.timestamp || event.start || 0);
    return !Number.isNaN(date.getTime()) && date >= weekDays[0] && date <= weekEnd;
  }).length;
}

function todayEventCount() {
  const today = new Date();
  return visibleCalendarEvents().filter((event) => {
    const date = new Date(event.timestamp || event.start || 0);
    return !Number.isNaN(date.getTime()) && isSameDay(date, today);
  }).length;
}

function documentTypeCount(types) {
  const typeSet = new Set(types);
  return documentItems().filter((item) => typeSet.has(item.documentType)).length;
}

function workStatusCount(status, prefix = "") {
  return Object.entries(workStatusByKey)
    .filter(([key, value]) => value === status && (!prefix || key.startsWith(prefix)))
    .length;
}

function dueFollowUpCount(prefix = "") {
  const endOfToday = new Date(new Date().setHours(23, 59, 59, 999));
  return Object.entries(followUpByKey)
    .filter(([key, value]) => {
      const date = value ? new Date(`${value}T00:00:00`) : null;
      return (!prefix || key.startsWith(prefix)) && date && !Number.isNaN(date.getTime()) && date <= endOfToday;
    })
    .length;
}

function todayFocusItems() {
  const followUpTodayItems = Object.entries(followUpByKey)
    .filter(([, value]) => {
      const date = value ? new Date(`${value}T00:00:00`) : null;
      return date && !Number.isNaN(date.getTime()) && date <= new Date(new Date().setHours(23, 59, 59, 999));
    })
    .map(([key, value]) => ({
      type: key.startsWith("event:") ? "termin" : key.startsWith("document:") ? "dokument" : "mail",
      key,
      workspace: key.startsWith("event:") ? "termine" : key.startsWith("document:") ? "dokumente" : "mails",
      title: "Wiedervorlage fällig",
      meta: formatFollowUpDate(value),
      action: "Arbeitsstatus prüfen und nächsten Schritt festlegen.",
      score: 9
    }));
  const mailItems = emails
    .filter((email) => workStatusFor(`mail:${email.id}`) !== "erledigt" && (email.bucket === "antwort" || email.bucket === "prüfen" || isDocumentEmail(email)))
    .map((email) => {
      const assessment = aiEmailAssessment(email);
      return {
        type: "mail",
        key: `mail:${email.id}`,
        workspace: "mails",
        title: email.subject || "E-Mail ohne Betreff",
        meta: email.from || "Absender unbekannt",
        action: assessment.nextAction || email.nextAction || "E-Mail prüfen.",
        score: assessment.score + (email.bucket === "antwort" ? 3 : 0)
      };
    });

  const eventItems = visibleCalendarEvents()
    .filter((event) => {
      const date = new Date(event.timestamp || event.start || 0);
      return workStatusFor(calendarEventKey(event)) !== "erledigt" && !Number.isNaN(date.getTime()) && isSameDay(date, new Date());
    })
    .map((event) => {
      const assessment = aiEventAssessment(event);
      return {
        type: "termin",
        key: calendarEventKey(event),
        workspace: "termine",
        title: event.title || "Termin ohne Titel",
        meta: formatEventListTime(event),
        action: assessment.nextAction || "Termin vorbereiten.",
        score: assessment.score + 4
      };
    });

  const documentFocusItems = documentItems()
    .filter((item) => workStatusFor(item.key) !== "erledigt" && (item.status === "prüfen" || item.status === "neu" || ["Rechnung", "Angebot", "Vertrag"].includes(item.documentType)))
    .map((item) => {
      const assessment = aiDocumentAssessment(item);
      return {
        type: "dokument",
        key: item.key,
        workspace: "dokumente",
        title: item.attachment.filename || "Dokument ohne Dateiname",
        meta: `${item.documentType} · ${documentStatusLabel(item.status)}`,
        action: assessment.nextAction || item.assessment.nextAction || "Dokument prüfen.",
        score: assessment.score + (item.status === "prüfen" ? 3 : 0)
      };
    });

  const uniqueItems = [];
  const seenKeys = new Set();
  [...followUpTodayItems, ...mailItems, ...eventItems, ...documentFocusItems]
    .sort((a, b) => b.score - a.score)
    .forEach((item) => {
      if (seenKeys.has(item.key)) return;
      seenKeys.add(item.key);
      uniqueItems.push(item);
    });

  return uniqueItems
    .slice(0, 6);
}

function renderTodayFocus() {
  const items = todayFocusItems();
  const replyCount = emails.filter((email) => email.bucket === "antwort").length;
  const checkCount = emails.filter((email) => email.bucket === "prüfen").length + documentItems().filter((item) => item.status === "prüfen").length;
  const eventCount = todayEventCount();
  const intro = items.length
    ? `${replyCount} Antworten offen · ${eventCount} Termine heute · ${checkCount} Prüffälle`
    : "Aktuell keine priorisierten Aufgaben aus den geladenen Daten.";

  todayFocusEl.innerHTML = `
    <div class="todayFocusHead">
      <div>
        <p class="eyebrow">Heute wichtig</p>
        <h3>Arbeitsübersicht</h3>
        <span>${escapeHtml(intro)}</span>
      </div>
      <button class="button secondary" type="button" id="openKiOverviewButton">KI Übersicht öffnen</button>
    </div>
    <div class="todayFocusGrid">
      ${items.length
        ? items.map((item) => `
          <button class="todayFocusItem ${escapeHtml(item.type)}Focus" type="button" data-workspace="${escapeHtml(item.workspace)}" data-id="${escapeHtml(item.key)}">
            <span>${escapeHtml(item.type === "mail" ? "Mail" : item.type === "termin" ? "Termin" : "Dokument")}</span>
            <strong>${escapeHtml(item.title)}</strong>
            <small>${escapeHtml(item.meta)}</small>
            <em>${escapeHtml(item.action)}</em>
          </button>
        `).join("")
        : '<div class="todayFocusEmpty">Aktualisieren oder einen Arbeitsbereich öffnen, um neue Hinweise zu sehen.</div>'}
    </div>
  `;

  todayFocusEl.querySelector("#openKiOverviewButton")?.addEventListener("click", () => {
    searchEl.value = "";
    activeWorkspace = "ki";
    activeBucket = "alle";
    activeId = filteredItems()[0]?.key || null;
    render();
  });
  todayFocusEl.querySelectorAll(".todayFocusItem").forEach((button) => {
    button.addEventListener("click", () => {
      searchEl.value = "";
      activeWorkspace = button.dataset.workspace;
      activeBucket = "alle";
      activeId = button.dataset.id;
      render();
    });
  });
}

function renderSummary() {
  const draftCount = emails.filter(hasCreatedDraft).length;
  const documents = documentItems();
  const aiItems = aiDailyItems();
  const hiddenCalendarCount = calendars.filter((calendar) => hiddenCalendarIds.has(calendar.id)).length;
  const metricsByWorkspace = {
    mails: [
      ["Mails gesamt", emails.length, "mail"],
      ["Antworten", bucketCount("antwort"), "mail"],
      ["Zu prüfen", bucketCount("prüfen"), "mail"],
      ["Info", bucketCount("info"), "mail"],
      ["Terminmails", emails.filter(isAppointmentEmail).length, "appointment"],
      ["Mit Anlagen", emails.filter(isDocumentEmail).length, "document"],
      ["Entwürfe", draftCount, "mail"],
      ["Warten", workStatusCount("warten", "mail:"), "mail"]
    ],
    termine: [
      ["Termine kommend", visibleCalendarEvents().length, "appointment"],
      ["Gewählte Woche", selectedWeekEventCount(), "appointment"],
      ["Heute", todayEventCount(), "appointment"],
      ["Kalender sichtbar", visibleCalendarCount(), "appointment"],
      ["Kalender ausgeblendet", hiddenCalendarCount, "appointment"],
      ["Ganztägig", visibleCalendarEvents().filter((event) => event.isAllDay).length, "appointment"],
      ["Wiedervorlage", dueFollowUpCount("event:"), "appointment"]
    ],
    dokumente: [
      ["Dokumente gesamt", documents.length, "document"],
      ["Neu", documents.filter((item) => item.status === "neu").length, "document"],
      ["Zu prüfen", documents.filter((item) => item.status === "prüfen").length, "document"],
      ["Erledigt", documents.filter((item) => item.status === "erledigt").length, "document"],
      ["Archivieren", documents.filter((item) => item.status === "archivieren").length, "document"],
      ["Rechnungen", documentTypeCount(["Rechnung"]), "document"],
      ["Angebote/Verträge", documentTypeCount(["Angebot", "Vertrag"]), "document"],
      ["Warten", workStatusCount("warten", "document:"), "document"]
    ],
    ki: [
      ["KI Hinweise", aiItems.length, "ai"],
      ["Mail-Hinweise", aiItems.filter((item) => item.aiType === "mail").length, "mail"],
      ["Termin-Hinweise", aiItems.filter((item) => item.aiType === "termin").length, "appointment"],
      ["Dokument-Hinweise", aiItems.filter((item) => item.aiType === "dokument").length, "document"],
      ["Hohe Priorität", aiItems.filter((item) => item.assessment.priority === "hoch").length, "ai"],
      ["Mittlere Priorität", aiItems.filter((item) => item.assessment.priority === "mittel").length, "ai"]
    ],
    aufgaben: [
      ["Aufgaben offen", filteredTaskItems("alle").length, "ai"],
      ["Fällig", filteredTaskItems("faellig").length, "ai"],
      ["In Bearbeitung", filteredTaskItems("in-bearbeitung").length, "ai"],
      ["Warten", filteredTaskItems("warten").length, "ai"],
      ["Wiedervorlage", filteredTaskItems("wiedervorlage").length, "ai"],
      ["Erledigt", filteredTaskItems("erledigt").length, "ai"]
    ]
  };
  const metrics = metricsByWorkspace[activeWorkspace] || metricsByWorkspace.mails;
  summaryEl.innerHTML = metrics
    .map(([label, value, group]) => `<article class="metric ${group}Metric"><strong>${value}</strong><span>${label}</span></article>`)
    .join("");
}

function renderWorkspaceTabs() {
  workspaceTabsEl.innerHTML = workspaceOrder
    .map((workspace) => {
      const pressed = workspace === activeWorkspace ? "true" : "false";
      const label = workspaceLabels[workspace];
      return `<button class="workspaceTab" type="button" data-workspace="${workspace}" aria-pressed="${pressed}" title="${escapeHtml(label)}">
        <span class="workspaceIcon">${iconSvg(workspaceIcons[workspace])}</span>
        <span class="workspaceText">${escapeHtml(label)}</span>
        <span class="workspaceCount">${workspaceCount(workspace)}</span>
      </button>`;
    })
    .join("") + `<button class="workspaceTab sidebarHelpTab" type="button" id="helpButton" title="Hilfe" aria-label="Hilfe öffnen">
      <span class="workspaceIcon">${iconSvg("help")}</span>
      <span class="workspaceText">Hilfe</span>
      <span class="workspaceCount">?</span>
    </button>`;

  workspaceTabsEl.querySelectorAll("button").forEach((button) => {
    if (button.id === "helpButton") {
      button.addEventListener("click", openHelp);
      return;
    }
    button.addEventListener("click", () => {
      activeWorkspace = button.dataset.workspace;
      activeBucket = "alle";
      activeTaskFilter = "alle";
      activeId = filteredItems()[0]?.key || null;
      render();
    });
  });
}

function renderWorkspaceGuide() {
  const guide = workspaceGuides[activeWorkspace] || workspaceGuides.mails;
  workspaceGuideEl.innerHTML = `
    <div>
      <strong>${escapeHtml(guide.label)}</strong>
      <p>${escapeHtml(guide.text)}</p>
    </div>
    <span>${escapeHtml(guide.action)}</span>
  `;
}

function renderTabs() {
  tabsEl.hidden = activeWorkspace !== "mails" && activeWorkspace !== "aufgaben";
  if (activeWorkspace === "aufgaben") {
    tabsEl.innerHTML = taskFilterOrder
      .map((filter) => {
        const pressed = filter === activeTaskFilter ? "true" : "false";
        return `<button class="tab" type="button" data-task-filter="${filter}" aria-pressed="${pressed}">${taskFilterLabels[filter]} (${filteredTaskItems(filter).length})</button>`;
      })
      .join("");

    tabsEl.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        activeTaskFilter = button.dataset.taskFilter;
        activeId = filteredItems()[0]?.key || null;
        render();
      });
    });
    return;
  }
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
    const inBucket = item.kind === "event" || item.kind === "document" || item.kind === "ai" || item.kind === "task" || activeBucket === "alle" || item.email.bucket === activeBucket;
    const haystack = itemSearchText(item);
    return inBucket && (!query || haystack.includes(query));
  });
}

function startOfWeek(date = new Date()) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  const day = value.getDay() || 7;
  value.setDate(value.getDate() - day + 1);
  return value;
}

function selectedCalendarWeekStart() {
  const start = startOfWeek(new Date());
  start.setDate(start.getDate() + calendarWeekOffset * 7);
  return start;
}

function calendarWeekDays() {
  const start = selectedCalendarWeekStart();
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatWeekday(date) {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit"
  }).format(date);
}

function formatWeekRange(days) {
  const first = days[0];
  const last = days[days.length - 1];
  const year = new Intl.DateTimeFormat("de-DE", { year: "numeric" }).format(last);
  const start = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" }).format(first);
  const end = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" }).format(last);
  return `${start} - ${end}.${year}`;
}

function formatEventTime(event) {
  if (event.isAllDay) return "Ganztägig";
  const start = event.start ? new Date(event.start) : null;
  if (!start || Number.isNaN(start.getTime())) return "Zeit offen";
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(start);
}

function renderCalendarWorkspaceHeader(list) {
  const hiddenCount = calendars.filter((calendar) => hiddenCalendarIds.has(calendar.id)).length;
  const weekDays = calendarWeekDays();
  const weekEnd = new Date(weekDays[6]);
  weekEnd.setHours(23, 59, 59, 999);
  const weekEvents = list
    .filter((item) => {
      const date = new Date(item.event.timestamp || item.event.start || 0);
      return !Number.isNaN(date.getTime()) && date >= weekDays[0] && date <= weekEnd;
    })
    .map((item) => item.event);
  const calendarControls = calendars.length
    ? calendars
        .map((calendar) => {
          const checked = hiddenCalendarIds.has(calendar.id) ? "" : "checked";
          const count = calendarEvents.filter((event) => event.calendarId === calendar.id).length;
          return `
            <label class="calendarToggle">
              <input type="checkbox" data-calendar-id="${escapeHtml(calendar.id)}" ${checked}>
              <span>
                <strong>${escapeHtml(calendar.summary || "Kalender")}</strong>
                <small>${count} Termin${count === 1 ? "" : "e"}</small>
              </span>
            </label>
          `;
        })
        .join("")
    : '<p class="calendarMuted">Keine Kalenderdaten geladen.</p>';

  const weekGrid = weekDays
    .map((day) => {
      const eventsForDay = weekEvents.filter((event) => {
        const date = new Date(event.timestamp || event.start || 0);
        return !Number.isNaN(date.getTime()) && isSameDay(date, day);
      });
      const dayEvents = eventsForDay.length
        ? eventsForDay
            .map((event) => `
              <button class="weekEvent" type="button" data-id="${escapeHtml(calendarEventKey(event))}">
                <span>${escapeHtml(formatEventTime(event))}</span>
                <strong>${escapeHtml(event.title)}</strong>
              </button>
            `)
            .join("")
        : '<span class="weekEmpty">frei</span>';
      return `
        <div class="weekDay ${isSameDay(day, new Date()) ? "today" : ""}">
          <div class="weekDayHead">${escapeHtml(formatWeekday(day))}</div>
          <div class="weekDayEvents">${dayEvents}</div>
        </div>
      `;
    })
    .join("");

  return `
    <section class="calendarOverview" aria-label="Kalenderübersicht">
      <div class="calendarOverviewHead">
        <div>
          <strong>Wochenübersicht</strong>
          <span>${escapeHtml(formatWeekRange(weekDays))} · ${weekEvents.length} Termin${weekEvents.length === 1 ? "" : "e"} in dieser Woche · ${visibleCalendarCount()} Kalender sichtbar${hiddenCount ? ` · ${hiddenCount} ausgeblendet` : ""}</span>
        </div>
        <div class="calendarWeekControls" aria-label="Woche wechseln">
          <button type="button" class="weekNavButton" data-week-action="previous" aria-label="Vorherige Woche">‹</button>
          <button type="button" class="weekTodayButton" data-week-action="today" ${calendarWeekOffset === 0 ? "disabled" : ""}>Heute</button>
          <button type="button" class="weekNavButton" data-week-action="next" aria-label="Nächste Woche">›</button>
        </div>
      </div>
      <div class="weekGrid">${weekGrid}</div>
      <details class="calendarFilter" ${hiddenCount ? "open" : ""}>
        <summary>Kalender anzeigen oder ausblenden</summary>
        <div class="calendarToggleGrid">${calendarControls}</div>
        <p>Ausblenden ändert nur die Anzeige in SMART OfficeHub. Der Kalender bleibt in Google unverändert.</p>
      </details>
    </section>
  `;
}

function renderList() {
  const list = filteredItems();
  if (!list.length) {
    const emptyText = activeWorkspace === "termine"
      ? "Keine kommenden Kalendereinträge gefunden."
      : activeWorkspace === "dokumente"
        ? "Keine Anhänge im geladenen Posteingang gefunden."
        : activeWorkspace === "ki"
          ? "Keine KI-Hinweise mit Priorität gefunden."
          : activeWorkspace === "aufgaben"
            ? "Keine Aufgaben im gewählten Status gefunden."
            : "Keine passenden E-Mails gefunden.";
    listEl.innerHTML = `${activeWorkspace === "termine" ? renderCalendarWorkspaceHeader(list) : ""}<div class="empty">${emptyText}</div>`;
    detailEl.innerHTML = '<div class="empty">Aktualisiere den Posteingang oder passe die Suche an.</div>';
    attachCalendarListControls();
    return;
  }

  if (!list.some((item) => item.key === activeId)) activeId = list[0].key;

  const renderedItems = list
    .map((item) => {
      if (item.kind === "event") return renderCalendarListItem(item.event, item.key);
      if (item.kind === "document") return renderDocumentListItem(item);
      if (item.kind === "ai") return renderAiListItem(item);
      if (item.kind === "task") return renderTaskListItem(item);
      const email = item.email;
      const current = item.key === activeId ? "true" : "false";
      const draftClass = hasCreatedDraft(email) ? "draftCreated" : "";
      const replyClass = email.bucket === "antwort" ? "replyCandidate" : "";
      const workspaceBadges = [
        isAppointmentEmail(email) ? '<span class="badge appointmentBadge">Termin</span>' : "",
        isDocumentEmail(email) ? '<span class="badge documentBadge">Dokument</span>' : ""
      ].join("");
      const mailStatus = readableMailStatus(email.labels);
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
          <span class="listMetaLine">Status: ${escapeHtml(mailStatus)}</span>
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
  listEl.innerHTML = `${activeWorkspace === "termine" ? renderCalendarWorkspaceHeader(list) : ""}${renderedItems}`;

  attachCalendarListControls();
  listEl.querySelectorAll("button[data-id]").forEach((button) => {
    button.addEventListener("click", () => {
      activeId = button.dataset.id;
      render();
    });
  });
  attachTaskQuickActions(listEl);
}

function attachCalendarListControls() {
  if (activeWorkspace !== "termine") return;
  listEl.querySelectorAll("[data-week-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.weekAction;
      if (action === "previous") calendarWeekOffset -= 1;
      if (action === "next") calendarWeekOffset += 1;
      if (action === "today") calendarWeekOffset = 0;
      render();
    });
  });
  listEl.querySelectorAll(".calendarToggle input").forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) hiddenCalendarIds.delete(input.dataset.calendarId);
      else hiddenCalendarIds.add(input.dataset.calendarId);
      saveHiddenCalendarIds();
      activeId = filteredItems()[0]?.key || null;
      render();
    });
  });
}

function renderTaskListItem(item) {
  const current = item.key === activeId ? "true" : "false";
  const due = isFollowUpDue(item.sourceKey);
  return `
    <article class="mailItem taskItem ${due ? "taskDue" : ""}" aria-current="${current}">
      <button class="taskOpenButton" type="button" data-id="${item.key}" aria-current="${current}">
        <span class="mailHead">
          <span class="sender">${escapeHtml(item.sourceType)}</span>
          <span class="date">${escapeHtml(workStatusLabel(item.status))}</span>
        </span>
        <span class="subject">${escapeHtml(item.title)}</span>
        <span class="snippet">${escapeHtml(item.action)}</span>
        <span class="badges">
          <span class="badge aiBadge">${escapeHtml(workStatusLabel(item.status))}</span>
          ${item.followUp ? `<span class="badge bucket">Wiedervorlage ${escapeHtml(formatFollowUpDate(item.followUp))}</span>` : ""}
          <span class="badge ${due ? "hoch" : "mittel"}">${due ? "fällig" : "Aufgabe"}</span>
        </span>
      </button>
      <div class="taskQuickActions" aria-label="Schnellaktionen">
        <button type="button" data-task-action="done" data-task-key="${escapeHtml(item.sourceKey)}">Erledigt</button>
        <button type="button" data-task-action="waiting" data-task-key="${escapeHtml(item.sourceKey)}">Warten</button>
        <button type="button" data-task-action="tomorrow" data-task-key="${escapeHtml(item.sourceKey)}">Morgen</button>
      </div>
    </article>
  `;
}

function renderAiListItem(item) {
  const current = item.key === activeId ? "true" : "false";
  const title = item.aiType === "mail"
    ? item.email.subject
    : item.aiType === "termin"
      ? item.event.title
      : item.document.attachment.filename || "Unbenanntes Dokument";
  const source = item.aiType === "mail"
    ? item.email.from
    : item.aiType === "termin"
      ? item.event.calendarName || "Google Calendar"
      : item.document.email.from;
  const date = item.aiType === "termin"
    ? formatEventRange(item.event)
    : item.aiType === "dokument"
      ? formatDate(item.document.email.date, item.document.email.timestamp)
      : formatDate(item.email.date, item.email.timestamp);
  const snippet = item.assessment.nextAction || "KI-Hinweis prüfen.";
  const label = item.aiType === "mail" ? "Mail-KI" : item.aiType === "termin" ? "Termin-KI" : "Dokument-KI";

  return `
    <button class="mailItem aiItem" type="button" data-id="${item.key}" aria-current="${current}">
      <span class="mailHead">
        <span class="sender">${escapeHtml(source)}</span>
        <span class="date">${escapeHtml(date)}</span>
      </span>
      <span class="subject">${escapeHtml(title)}</span>
      <span class="snippet">${escapeHtml(snippet)}</span>
      <span class="badges">
        <span class="badge aiBadge">${label}</span>
        <span class="badge ${item.assessment.priority}">${item.assessment.priority}</span>
        <span class="badge bucket">Score ${item.assessment.score}</span>
      </span>
    </button>
  `;
}

function renderDocumentListItem(item) {
  const { attachment, key } = item;
  const current = key === activeId ? "true" : "false";
  return `
    <button class="mailItem documentItem" type="button" data-id="${key}" aria-current="${current}">
      <span class="mailHead">
        <span class="sender">${escapeHtml(item.documentType)}</span>
        <span class="date">${documentStatusLabel(item.status)}</span>
      </span>
      <span class="subject">${escapeHtml(attachment.filename || "Unbenannte Datei")}</span>
      <span class="snippet">Datei · ${formatBytes(attachment.size)}</span>
      <span class="badges">
        <span class="badge typeBadge">${escapeHtml(item.documentType)}</span>
        <span class="badge statusBadge ${escapeHtml(item.status)}">${documentStatusLabel(item.status)}</span>
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
        <p>Dokumentinhalt wird geladen und geprüft ...</p>
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

function formatEventListDate(event) {
  const start = event.start ? new Date(event.start) : null;
  if (!start || Number.isNaN(start.getTime())) return "Datum offen";
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit"
  }).format(start);
}

function formatEventListTime(event) {
  if (event.isAllDay) return "Ganztägig";
  const start = event.start ? new Date(event.start) : null;
  const end = event.end ? new Date(event.end) : null;
  if (!start || Number.isNaN(start.getTime())) return "Zeit offen";
  const startTime = new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(start);
  const endTime = end && !Number.isNaN(end.getTime())
    ? new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(end)
    : "";
  return `${startTime}${endTime ? ` - ${endTime}` : ""}`;
}

function readableEventStatus(status = "") {
  const labels = {
    confirmed: "Bestätigt",
    tentative: "Vorläufig",
    cancelled: "Abgesagt"
  };
  return labels[status] || "Kein Status angegeben";
}

function readableOrganizer(value = "") {
  if (!value) return "Nicht ausgewiesen";
  if (/^[a-z0-9]{16,}@import\.calendar\.google\.com$/i.test(value)) return "Importierter Kalender";
  return formatMailAddress(value);
}

function readableAttendeeCount(event) {
  const count = event.attendees?.length || 0;
  if (!count) return "Keine Teilnehmer hinterlegt";
  return `${count} Teilnehmer${count === 1 ? "" : ""}`;
}

function renderCalendarListItem(event, key) {
  const current = key === activeId ? "true" : "false";
  return `
    <button class="mailItem calendarItem" type="button" data-id="${key}" aria-current="${current}">
      <span class="mailHead">
        <span class="sender">${escapeHtml(formatEventListDate(event))}</span>
        <span class="date">${escapeHtml(formatEventListTime(event))}</span>
      </span>
      <span class="subject">${escapeHtml(event.title)}</span>
      <span class="snippet">Kalender: ${escapeHtml(event.calendarName || "Google Kalender")}</span>
      <span class="badges">
        <span class="badge bucket">${escapeHtml(event.calendarName || "Kalender")}</span>
        <span class="badge appointmentBadge">${escapeHtml(readableEventStatus(event.status))}</span>
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

  const signatureMatch = text.match(/(?:mit freundlichen grüßen|freundliche grüße|beste grüße|viele grüße)\s*\n+\s*([^\n\r]+)/i);
  if (signatureMatch) {
    const signatureLine = signatureMatch[1]
      .replace(/\b(Referentin|Geschäftsführung|Architektin|Philosophie|Dipl|Dr|Prof)\b.*$/i, "")
      .replace(/\s+/g, " ")
      .trim();
    const nameMatch = signatureLine.match(/^([A-ZÄÖÜ][A-Za-zÄÖÜäöüß.-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß.-]+){1,2})/);
    if (nameMatch) return nameMatch[1].trim();
  }

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

function requestedAppointmentDates(text = "") {
  const dates = new Set();
  const patterns = [
    /\b(?:montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag),?\s*(?:den\s*)?(\d{1,2}\.\s*\d{1,2}\.?(?:\s*\d{2,4})?)/gi,
    /\b(\d{1,2}\.\s*(?:oder|und)\s*\d{1,2}\.\s*(?:januar|februar|märz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember))/gi,
    /\b(\d{1,2}\.\s*(?:januar|februar|märz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember))/gi
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      dates.add(match[1].replace(/\s+/g, " ").trim());
    }
  }
  return [...dates];
}

function isRecruitingOrProjectOpportunity(text = "") {
  return textIncludes(text.toLowerCase(), [
    "profil",
    "position",
    "projektmanagement",
    "geschäftsführer",
    "verfügbar",
    "verfuegbar",
    "interesse an einer mitarbeit",
    "persönlichen gespräch",
    "persoenlichen gespraech"
  ]);
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
    : "<li><strong>Kein Anhang erkannt</strong><span>Diese Mail wurde wegen dokumenttypischer Begriffe eingeordnet.</span></li>";
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
  const sourceText = [email.subject, email.snippet, email.bodyText].join(" ");
  const greeting = salutation(email);
  const requestedDates = requestedAppointmentDates(sourceText);

  if (isRecruitingOrProjectOpportunity(sourceText)) {
    const dateLine = requestedDates.length
      ? `Für ein Gespräch mit Herrn Gerlich kann ich Ihnen gerne eine Rückmeldung zu den genannten Terminen (${requestedDates.join(", ")}) geben. Meine passenden Zeitfenster sind: [Zeitfenster eintragen].`
      : "Für ein Gespräch mit Herrn Gerlich kann ich Ihnen gerne kurzfristig passende Zeitfenster nennen.";
    return `${greeting}\n\nvielen Dank für Ihre Nachricht und das Interesse an meinem Profil.\n\nGrundsätzlich bin ich an einem Austausch zu einer möglichen Mitarbeit im Projektmanagement interessiert und offen für ein persönliches Gespräch.\n\n${dateLine}\n\nAlternativ können wir die Abstimmung auch telefonisch kurz klären.\n\nMit freundlichen Grüßen\nBernhard Metzger`;
  }

  if (textIncludes(combined, ["happ", "baurevision", "festool", "tts", "bauprojekt", "baubegleitung"])) {
    return `${greeting}\n\nvielen Dank für Ihre Anfrage und Ihr Interesse an meiner Baurevision.\n\nGerne tausche ich mich mit Ihnen zu Ihrem Bauprojekt aus und bespreche, welche Punkte aus Revisionssicht sinnvoll geprüft werden sollten. Senden Sie mir dafür gerne zwei bis drei Terminvorschläge für ein kurzes Erstgespräch oder vorab ein paar Eckdaten zum Projekt, damit ich mich gezielt vorbereiten kann.\n\nMit freundlichen Grüßen\nBernhard Metzger`;
  }

  if (textIncludes(combined, ["termin", "kalender", "meeting", "besprechung", "rückruf", "telefonat", "call"])) {
    if (requestedDates.length) {
      return `${greeting}\n\nvielen Dank für Ihre Nachricht.\n\nGerne stimme ich den Termin mit Ihnen ab. Zu den genannten Terminen (${requestedDates.join(", ")}) kann ich Ihnen folgende Zeitfenster anbieten: [Zeitfenster eintragen].\n\nBitte bestätigen Sie mir kurz, welcher Termin für Sie und die weiteren Teilnehmer am besten passt.\n\nMit freundlichen Grüßen\nBernhard Metzger`;
    }
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

function renderAiEmailBox(email) {
  const assessment = aiEmailAssessment(email);
  const summaryRows = assessment.summary
    .map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`)
    .join("");
  const highlights = assessment.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("");

  return `
    <section class="aiBox">
      <div class="summaryHead">
        <span>KI-Bewertung</span>
        <small>${assessment.priority} · Kategorie: ${labels[assessment.suggestedBucket] || assessment.suggestedBucket}</small>
      </div>
      <ul>
        ${summaryRows}
        <li><strong>Antwortbedarf:</strong> ${assessment.replyNeeded ? "Ja, Antwort prüfen oder erstellen." : "Kein direkter Antwortzwang erkannt."}</li>
        <li><strong>Hinweise:</strong><ul>${highlights}</ul></li>
        <li><strong>Nächster Schritt:</strong> ${escapeHtml(assessment.nextAction)}</li>
      </ul>
    </section>
  `;
}

function renderAiEventBox(event) {
  const assessment = aiEventAssessment(event);
  const prepRows = assessment.prep.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  return `
    <section class="aiBox appointmentAiBox">
      <div class="summaryHead">
        <span>KI-Terminbewertung</span>
        <small>${assessment.priority} · Score ${assessment.score}</small>
      </div>
      <ul>
        <li><strong>Vorbereitung:</strong><ul>${prepRows}</ul></li>
        <li><strong>Nächster Schritt:</strong> ${escapeHtml(assessment.nextAction)}</li>
      </ul>
    </section>
  `;
}

function renderAiDocumentBox(item) {
  const assessment = aiDocumentAssessment(item);
  const riskRows = assessment.risks.map((risk) => `<li>${escapeHtml(risk)}</li>`).join("");
  return `
    <section class="aiBox documentAiBox">
      <div class="summaryHead">
        <span>KI-Dokumentprüfung</span>
        <small>${assessment.priority} · Score ${assessment.score}</small>
      </div>
      <ul>
        <li><strong>Prüfpunkte:</strong><ul>${riskRows}</ul></li>
        <li><strong>Nächster Schritt:</strong> ${escapeHtml(assessment.nextAction)}</li>
      </ul>
    </section>
  `;
}

function renderAiDailyBrief() {
  const items = aiDailyItems();
  const high = items.filter((item) => item.assessment.priority === "hoch").length;
  const replies = items.filter((item) => item.aiType === "mail" && item.assessment.replyNeeded).length;
  const appointments = items.filter((item) => item.aiType === "termin").length;
  const documents = items.filter((item) => item.aiType === "dokument").length;
  const topActions = items.slice(0, 3).map((item) => {
    const title = item.aiType === "mail"
      ? item.email.subject
      : item.aiType === "termin"
        ? item.event.title
        : item.document.attachment.filename || "Dokument";
    return `<li><strong>${escapeHtml(title)}:</strong> ${escapeHtml(item.assessment.nextAction)}</li>`;
  }).join("");

  return `
    <section class="aiBox dailyAiBox">
      <div class="summaryHead">
        <span>Was ist heute wichtig?</span>
        <small>${items.length} KI-Hinweise</small>
      </div>
      <ul>
        <li><strong>Priorität:</strong> ${high} hohe Hinweise, ${replies} offene Antwortaufgabe${replies === 1 ? "" : "n"}.</li>
        <li><strong>Termine/Dokumente:</strong> ${appointments} Termin-Hinweis${appointments === 1 ? "" : "e"}, ${documents} Dokument-Hinweis${documents === 1 ? "" : "e"}.</li>
        <li><strong>Nächste Schritte:</strong><ul>${topActions || "<li>Aktuell keine kritischen Schritte erkannt.</li>"}</ul></li>
      </ul>
    </section>
  `;
}

function renderAiDetail(item) {
  if (item.aiType === "mail") {
    detailEl.innerHTML = `
      <p class="panelLabel">KI-Hinweis</p>
      <h2>${escapeHtml(item.email.subject)}</h2>
      ${renderAiDailyBrief()}
      ${renderAiEmailBox(item.email)}
      <div class="actions">
        <button class="button primary" type="button" id="openAiSource">Mail öffnen</button>
      </div>
    `;
    detailEl.querySelector("#openAiSource").addEventListener("click", () => {
      activeWorkspace = "mails";
      activeId = `mail:${item.email.id}`;
      render();
    });
    return;
  }

  if (item.aiType === "termin") {
    detailEl.innerHTML = `
      <p class="panelLabel">KI-Hinweis</p>
      <h2>${escapeHtml(item.event.title)}</h2>
      ${renderAiDailyBrief()}
      ${renderAiEventBox(item.event)}
      <div class="actions">
        <button class="button primary" type="button" id="openAiSource">Termin öffnen</button>
      </div>
    `;
    detailEl.querySelector("#openAiSource").addEventListener("click", () => {
      activeWorkspace = "termine";
      activeId = calendarEventKey(item.event);
      render();
    });
    return;
  }

  detailEl.innerHTML = `
    <p class="panelLabel">KI-Hinweis</p>
    <h2>${escapeHtml(item.document.attachment.filename || "Dokument")}</h2>
    ${renderAiDailyBrief()}
    ${renderAiDocumentBox(item.document)}
    <div class="actions">
      <button class="button primary" type="button" id="openAiSource">Dokument öffnen</button>
    </div>
  `;
  detailEl.querySelector("#openAiSource").addEventListener("click", () => {
    activeWorkspace = "dokumente";
    activeId = item.document.key;
    render();
  });
}

function renderTaskDetail(item) {
  detailEl.innerHTML = `
    <p class="panelLabel">Aufgabe</p>
    <div class="badges">
      <span class="badge aiBadge">${escapeHtml(item.sourceType)}</span>
      <span class="badge bucket">${escapeHtml(workStatusLabel(item.status))}</span>
      ${item.followUp ? `<span class="badge appointmentBadge">Wiedervorlage ${escapeHtml(formatFollowUpDate(item.followUp))}</span>` : ""}
    </div>
    <h2>${escapeHtml(item.title)}</h2>
    <section class="mailSummaryBox" aria-label="Aufgaben-Zusammenfassung">
      <div class="summaryHead">
        <span>Aufgaben-Zusammenfassung</span>
        <small>${isFollowUpDue(item.sourceKey) ? "fällig" : "Arbeitsliste"}</small>
      </div>
      <ul>
        <li><strong>Quelle:</strong> ${escapeHtml(item.sourceType)}</li>
        <li><strong>Status:</strong> ${escapeHtml(workStatusLabel(item.status))}</li>
        <li><strong>Wiedervorlage:</strong> ${item.followUp ? escapeHtml(formatFollowUpDate(item.followUp)) : "Keine Wiedervorlage gesetzt"}</li>
        <li><strong>Nächster Schritt:</strong> ${escapeHtml(item.action)}</li>
      </ul>
    </section>
    ${renderWorkControl(item.sourceKey, "Arbeitsstatus")}
    <div class="actions">
      <button class="button primary" type="button" id="openTaskSource">Ursprung öffnen</button>
      <button class="button secondary" type="button" data-task-action="done" data-task-key="${escapeHtml(item.sourceKey)}">Erledigt</button>
      <button class="button secondary" type="button" data-task-action="waiting" data-task-key="${escapeHtml(item.sourceKey)}">Warten</button>
      <button class="button secondary" type="button" data-task-action="tomorrow" data-task-key="${escapeHtml(item.sourceKey)}">Morgen wieder vorlegen</button>
    </div>
    <div class="systemNotice">Diese Aufgabe ist keine separate Kopie. Sie verweist auf die ursprüngliche Mail, den Termin oder das Dokument und nutzt denselben Arbeitsstatus.</div>
  `;

  detailEl.querySelector("#openTaskSource")?.addEventListener("click", () => {
    searchEl.value = "";
    activeWorkspace = item.targetWorkspace;
    activeBucket = "alle";
    activeId = item.sourceKey;
    render();
  });
  attachWorkControlHandlers();
  attachTaskQuickActions(detailEl);
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

async function deleteCalendarEvent(event) {
  if (!confirm(`Termin wirklich in Google Kalender löschen?\n\n${event.title}\n${formatEventRange(event)}\n\nDiese Aktion löscht nur diesen einzelnen Termin im verbundenen Google Kalender.`)) return;
  await api(`/api/calendar/events/${encodeURIComponent(event.calendarId)}/${encodeURIComponent(event.id)}`, { method: "DELETE" });
  showNotice("Termin wurde in Google Kalender gelöscht.");
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
  email.gmailDraftsUrl = email.gmailDraftsUrl || "https://mail.google.com/mail/#drafts";
  showNotice(existingDraftId ? "Antwortentwurf wurde in Gmail aktualisiert." : "Antwortentwurf wurde als Gmail-Entwurf übertragen.");
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
    ${renderWorkControl(calendarEventKey(event), "Terminstatus")}
    ${renderAiEventBox(event)}
    <div class="detailGrid">
      <div class="fact"><span>Quelle</span>${escapeHtml(readableOrganizer(event.organizer))}</div>
      <div class="fact"><span>Kalender</span>${escapeHtml(event.calendarName || "Google Calendar")}</div>
      <div class="fact"><span>Status</span>${escapeHtml(readableEventStatus(event.status))}</div>
      <div class="fact"><span>Zeit</span>${escapeHtml(formatEventRange(event))}</div>
      <div class="fact"><span>Teilnehmer</span>${escapeHtml(readableAttendeeCount(event))}</div>
    </div>
    <div class="actions">
      ${event.htmlLink ? `<a class="button primary" href="${event.htmlLink}" target="_blank" rel="noreferrer">In Google Kalender öffnen</a>` : ""}
      <button class="button danger" type="button" id="deleteCalendarEventButton">Termin löschen</button>
    </div>
    <div class="systemNotice">Dieser Eintrag kommt direkt aus Google Calendar. „Termin löschen“ löscht den Termin auch dort. Kalender ausblenden ändert dagegen nur die Anzeige in SMART OfficeHub.</div>
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

  detailEl.querySelector("#deleteCalendarEventButton")?.addEventListener("click", () => deleteCalendarEvent(event));
  attachWorkControlHandlers();
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
    ${renderAiDocumentBox(item)}
    ${renderWorkControl(key, "Arbeitsstatus")}
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
    <div class="systemNotice">Dieses Dokument ist ein echter Nachrichtenanhang. Über „Dokumentinhalt analysieren“ wird der Anhang geladen und soweit möglich textlich ausgewertet. Text, CSV, HTML und einfache PDF-Texte funktionieren direkt; Word/Excel benötigen später einen Spezialparser.</div>
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
  attachWorkControlHandlers();
}

function renderEmailDetail(email) {
  const hasDraft = hasCreatedDraft(email);
  const existingDraftId = draftIdForEmail(email);
  const originalText = email.bodyText || email.snippet || "Kein Mailtext verfügbar.";
  const cachedKiDraft = autoKiDraftsByEmail.get(email.id) || "";
  const draftText = cachedKiDraft || defaultReply(email);
  const draftSource = cachedKiDraft ? "KI-Entwurf" : "Startentwurf";
  const draftSourceState = cachedKiDraft ? "success" : "fallback";
  const gmailDraftsUrl = email.gmailDraftsUrl || "https://mail.google.com/mail/#drafts";
  const summaryLines = mailSummary(email)
    .map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`)
    .join("");
  const smartBookingNotice = email.isSmartBooking
    ? '<div class="systemNotice">Smart-Booking-Mail: Terminbestätigung oder Terminänderung. Dafür wird kein Antwortentwurf erstellt.</div>'
    : "";
  const draftSection = email.isSmartBooking
    ? ""
    : `<div class="draftBox">
      <div class="draftHeader">
        <label for="draftText"><strong>Antwortentwurf</strong></label>
        <span class="draftSourceLabel ${draftSourceState}" id="draftSourceLabel">${draftSource}</span>
      </div>
      <textarea id="draftText">${escapeHtml(draftText)}</textarea>
      <div class="draftTools">
        <label>
          <span>Tonalität</span>
          <select id="draftTone">
            <option value="professionell">professionell</option>
            <option value="freundlich">freundlich</option>
            <option value="kurz">kurz</option>
            <option value="verbindlich">verbindlich</option>
          </select>
        </label>
        <button class="button secondary" type="button" id="improveDraftButton">Mit KI neu formulieren</button>
        <span class="draftToneHint">${anthropicApiKey ? "KI-Entwurf wird automatisch erstellt; Tonalität wird angewendet." : "Ohne KI-Schlüssel wird der Startentwurf als Fallback angezeigt."}</span>
      </div>
      <div class="actions">
        <button class="button secondary" type="button" id="draftButton">${existingDraftId ? "Entwurf in Gmail aktualisieren" : "Als Entwurf in Gmail übertragen"}</button>
        ${hasDraft ? `<a class="button secondary" href="${escapeHtml(gmailDraftsUrl)}" target="_blank" rel="noreferrer">Gmail-Entwürfe öffnen</a>` : ""}
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
    ${renderWorkControl(`mail:${email.id}`, "Arbeitsstatus")}
    ${renderAiEmailBox(email)}
    <div class="detailGrid">
      <div class="fact"><span>Absender</span>${escapeHtml(formatMailAddress(email.from))}</div>
      <div class="fact"><span>Empfänger</span>${escapeHtml(formatMailAddress(email.to))}</div>
      <div class="fact"><span>Datum</span>${formatDate(email.date, email.timestamp)}</div>
      <div class="fact"><span>Status</span>${escapeHtml(readableMailStatus(email.labels))}</div>
      <div class="fact"><span>Kategorie</span>${escapeHtml(readableMailCategory(email.labels))}</div>
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
  attachWorkControlHandlers();
  detailEl.querySelector("#draftButton")?.addEventListener("click", () => createDraft(email));
  const draftTextarea = detailEl.querySelector("#draftText");
  fitDraftTextarea(draftTextarea);
  draftTextarea?.addEventListener("input", () => fitDraftTextarea(draftTextarea));
  detailEl.querySelector("#improveDraftButton")?.addEventListener("click", () => runKiDraft(email));
  if (!email.isSmartBooking && anthropicApiKey && !cachedKiDraft) {
    window.setTimeout(() => {
      if (activeId === `mail:${email.id}` && detailEl.querySelector("#draftText")?.dataset.kiBusy !== "true") {
        runKiDraft(email, { automatic: true });
      }
    }, 80);
  }
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
  if (item.kind === "ai") {
    renderAiDetail(item);
    return;
  }
  if (item.kind === "task") {
    renderTaskDetail(item);
    return;
  }
  renderEmailDetail(item.email);
}

function render() {
  renderDashboardHeading();
  renderTodayFocus();
  renderSummary();
  renderWorkspaceTabs();
  renderWorkspaceGuide();
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

apiKeyButton?.addEventListener("click", openApiKeyPanel);
apiKeyCloseButton?.addEventListener("click", closeApiKeyPanel);
apiKeyBackdrop?.addEventListener("click", closeApiKeyPanel);
toggleApiKeyButton?.addEventListener("click", () => {
  const currentValue = currentApiKeyInputValue();
  anthropicKeyVisible = !anthropicKeyVisible;
  anthropicApiKeyInput.readOnly = false;
  anthropicApiKeyInput.type = anthropicKeyVisible ? "text" : "password";
  anthropicApiKeyInput.value = anthropicKeyVisible ? currentValue : currentValue;
  renderApiKeyPanel();
  anthropicApiKeyInput.focus();
});
deleteApiKeyButton?.addEventListener("click", deleteAnthropicKey);
saveApiKeyButton?.addEventListener("click", saveAnthropicKeyFromInput);
connectApiKeyButton?.addEventListener("click", connectAnthropic);
verifyApiKeyButton?.addEventListener("click", () => verifyAnthropicConnection("verify"));
disconnectApiKeyButton?.addEventListener("click", disconnectAnthropic);
anthropicApiKeyInput?.addEventListener("input", () => {
  anthropicConnected = false;
  setApiKeyStatus("Änderung erkannt. Speichern prüft die Verbindung automatisch.", "info");
  connectApiKeyButton?.classList.remove("success");
  if (connectApiKeyButton) connectApiKeyButton.textContent = "Verbindung";
});

sidebarCollapseButton?.addEventListener("click", () => {
  sidebarCollapsed = !sidebarCollapsed;
  renderSidebarState();
});
backupButton?.addEventListener("click", exportOfficeHubBackup);
restoreButton?.addEventListener("click", () => restoreInput?.click());
restoreInput?.addEventListener("change", (event) => {
  importOfficeHubBackup(event.target.files?.[0]);
  event.target.value = "";
});

helpCloseButton?.addEventListener("click", closeHelp);
helpBackdrop?.addEventListener("click", closeHelp);
helpSearchInput?.addEventListener("input", filterHelp);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && helpOverlay?.classList.contains("active")) {
    closeHelp();
  }
  if (event.key === "Escape" && apiKeyOverlay?.classList.contains("active")) {
    closeApiKeyPanel();
  }
});

window.addEventListener("error", (event) => {
  showRuntimeError(event.error || event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  showRuntimeError(event.reason);
});

async function init() {
  renderSidebarState();
  const backupIcon = document.querySelector("#backupButton .sidebarActionIcon");
  const restoreIcon = document.querySelector("#restoreButton .sidebarActionIcon");
  if (backupIcon) backupIcon.innerHTML = iconSvg("save");
  if (restoreIcon) restoreIcon.innerHTML = iconSvg("restore");
  renderApiKeyPanel();
  render();
  if (isFileMode()) {
    loginLink.href = "http://localhost:8791/auth/start";
    showNotice("SMART OfficeHub wurde als Datei geöffnet. Google Login funktioniert nur über den lokalen Server. Öffne http://localhost:8791/ oder klicke auf „Mit Google verbinden“.", "error");
    return;
  }

  const pageError = (() => {
    try {
      return new URLSearchParams(window.location.search).get("error");
    } catch {
      return "";
    }
  })();
  if (pageError) {
    showNotice(pageError, "error");
    try {
      window.history.replaceState({}, "", window.location.pathname || "/");
    } catch {
      // Some embedded browsers are strict about history URLs; the notice is enough.
    }
    return;
  }
  try {
    if (await checkStatus()) await loadEmails();
  } catch (error) {
    showNotice(error.message, "error");
  }
}

init();
