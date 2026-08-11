/*
 * ODAS EventKalender - app.js
 * (C) Ondics GmbH, 2026
 */

let ekInstanzZaehler = 0;

// F-43: Registrierte Instanzen (Container -> Runtime), damit der Top-Level-Hook
// onPageLeave() alle gemounteten Instanzen aufraeumen kann. Die Base ruft den
// Hook global ohne Container-Parameter auf; eine iterierbare Map ist daher das
// zur App passende Muster (schulwegsicherheit-Portfoliomuster). Die Runtime
// haelt eine dispose()-Funktion, die auf die Closure-Variablen der Instanz
// (leafletMap, chartInstanceBar, chartInstanceDoughnut) zugreifen kann.
const eventKalenderInstances = new Map();

function isOdasProxyEnabled(configdata = {}) {
  return String(configdata.proxyAktiv || "").trim().toLowerCase() === "ja";
}

function extractPathFromUrl(url) {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.pathname + parsedUrl.search;
  } catch (_error) {
    return String(url || "");
  }
}

function getOdasAppBasePath(pathname) {
  let appPath =
    pathname === undefined
      ? typeof window !== "undefined"
        ? window.location.pathname
        : "/"
      : String(pathname || "/");

  if (!appPath.endsWith("/")) {
    const lastSlashIndex = appPath.lastIndexOf("/");
    const lastSegment = appPath.substring(lastSlashIndex + 1);
    if (lastSegment.includes(".")) {
      appPath = appPath.substring(0, lastSlashIndex + 1);
    }
  }

  return appPath.replace(/\/+$/, "");
}

function getOdasProxyEndpoint(targetUrl, pathname) {
  const appPath = getOdasAppBasePath(pathname);
  return `${appPath}/odp-data?path=${encodeURIComponent(
    extractPathFromUrl(targetUrl),
  )}`;
}

async function fetchViaOdasProxy(targetUrl) {
  const response = await fetch(getOdasProxyEndpoint(targetUrl), {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`ODAS-Proxy-Fehler: HTTP ${response.status}`);
  }

  const proxyData = await response.json();
  if (!proxyData || typeof proxyData.content !== "string") {
    throw new Error("ODAS-Proxy-Antwort enthält keinen content-String.");
  }

  return proxyData.content;
}

async function fetchOdasResource(targetUrl, configdata = {}) {
  if (isOdasProxyEnabled(configdata)) {
    return fetchViaOdasProxy(targetUrl);
  }

  try {
    const response = await fetch(targetUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.text();
  } catch (error) {
    throw new Error(
      `Direkter Datenabruf fehlgeschlagen (${error.message}). Bitte prüfen Sie die Daten-URL und die CORS-Freigabe der Datenquelle.`,
    );
  }
}

async function fetchOdasJson(targetUrl, configdata = {}) {
  return JSON.parse(await fetchOdasResource(targetUrl, configdata));
}

/*
 * Template-Hook (oda-generic 1.4.0). Die Base ruft ihn vor dem Rendern der neuen
 * Seite auf. Diese App haelt eine Leaflet-Karte und zwei Chart.js-Instanzen in
 * der Instanz-Closure; der Hook raeumt alle gemounteten Instanzen ueber die
 * registrierte dispose()-Funktion ab und macht späte Async-Renders (nach
 * loadLeaflet()/loadChartJS()/fetchOdasResource) durch das disposed-Flag
 * wirkungslos.
 */
function onPageLeave(page) {
  eventKalenderInstances.forEach((runtime, container) => {
    runtime.dispose();
    eventKalenderInstances.delete(container);
  });
}

function app(configdata = {}, enclosingHtmlDivElement) {
  const ekUid = "i" + ++ekInstanzZaehler;
  // 1. CONFIGURATION
  const API_URL = configdata.apiurl || "";
  const RESOURCE_ID = configdata.resourceId || "";
  const MAX_RECORDS = Number(configdata.maxRecords || 1000);
  const STANDARD_KATEGORIE = configdata.standardKategorie || "alle";

  let mapCenter = [48.7396, 9.3097]; // Esslingen default
  const configKarteZentrum = configdata.karteZentrum;
  if (configKarteZentrum && typeof configKarteZentrum === "string") {
    const coords = configKarteZentrum.split(",").map(Number);
    if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
      mapCenter = coords;
    }
  }
  const mapZoom = Number(configdata.karteZoom || 12);

  // 2. STATE
  let allEvents = [];
  let filteredEvents = [];
  let currentPage = 1;
  const itemsPerPage = 20;
  let activeTab = "ablaufplan";
  let selectedEvent = null;
  let leafletMap = null;
  let markerLayer = null;
  let chartInstanceBar = null;
  let chartInstanceDoughnut = null;
  let isMobileFiltersCollapsed = true;

  let filters = {
    von: "",
    bis: "",
    kategorie: STANDARD_KATEGORIE === "alle" ? "" : STANDARD_KATEGORIE,
    veranstalter: "",
    status: "",
    q: ""
  };

  // Instanzkennung: ekUid ("i" + N) und rootId ("eventkalender-" + N)
  // teilen sich denselben Zählerstand N aus ++ekInstanzZaehler — damit sind
  // beide IDs je Instanz monoton eindeutig und bleiben über Renders stabil.
  const rootId = "eventkalender-" + ekInstanzZaehler;

  let disposed = false;

  const runtime = {
    dispose() {
      disposed = true;
      if (leafletMap) {
        try {
          leafletMap.remove();
        } catch (error) {
          console.warn("Fehler beim Entfernen der Leaflet-Karte:", error);
        }
        leafletMap = null;
        markerLayer = null;
      }
      if (chartInstanceBar) {
        try {
          chartInstanceBar.destroy();
        } catch (error) {
          console.warn("Fehler beim Zerstören des Balkendiagramms:", error);
        }
        chartInstanceBar = null;
      }
      if (chartInstanceDoughnut) {
        try {
          chartInstanceDoughnut.destroy();
        } catch (error) {
          console.warn("Fehler beim Zerstören des Kreisdiagramms:", error);
        }
        chartInstanceDoughnut = null;
      }
    },
  };
  eventKalenderInstances.set(enclosingHtmlDivElement, runtime);

  // Helper: Escape HTML to prevent XSS
  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Helper: optionaler Abschnitt mit weiterführenden Links (HTML-Passthrough)
  function renderWeitereInfos(cfg = {}) {
    const links = String(cfg.weiterfuehrendeLinks || "").trim();
    if (!links) return "";
    return (
      '<section class="event-weitere-infos">' +
      '<h2 class="event-weitere-infos-title">Weitere Informationen</h2>' +
      '<div class="event-weitere-infos-body">' +
      links +
      "</div>" +
      "</section>"
    );
  }

  // Helper: ausklappbare Methodikbox (HTML-Passthrough)
  function renderMethodikbox(cfg = {}) {
    const hinweis = String(cfg.datenquelleHinweis || "").trim();
    const stand = String(cfg.datenStand || "").trim();
    if (!hinweis && !stand) return "";
    const standHtml = stand
      ? `<p class="text-muted small mb-2">${escapeHtml(stand)}</p>`
      : "";
    return (
      '<section class="event-methodik">' +
      '<button class="event-methodik-toggle collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#event-methodik-body-' + ekUid + '" aria-expanded="false" aria-controls="event-methodik-body-' + ekUid + '">' +
      '<h2 class="event-methodik-title">Methodik &amp; Datenquelle</h2>' +
      '<span class="event-methodik-chevron" aria-hidden="true">&#9662;</span>' +
      "</button>" +
      '<div id="event-methodik-body-' + ekUid + '" class="collapse">' +
      '<div class="event-methodik-body-inner">' +
      standHtml +
      hinweis +
      "</div></div>" +
      "</section>"
    );
  }

  // 3. RENDER SKELETON
  renderSkeleton();
  initEvents();
  loadAllData();

  function renderSkeleton() {
    enclosingHtmlDivElement.innerHTML = `
      <div class="event-app-container filters-collapsed" id="${rootId}">
        
        <!-- Header Actions -->
        <div class="event-header d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
          <div class="event-header-copy">
            <h3 class="mb-0 text-primary fw-bold">Veranstaltungsübersicht</h3>
            <p class="text-muted small mb-0">Aktuelle Termine, Karten, Teilnehmer und Auswertungen</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-event d-flex align-items-center gap-2" id="${rootId}-btn-export-all">
              <span>📅</span> Alle exportieren (.ics)
            </button>
            <button class="btn btn-outline-event d-flex align-items-center gap-2" id="${rootId}-btn-refresh">
              <span>🔄</span> Aktualisieren
            </button>
          </div>
        </div>

        <!-- KPI Cards Row -->
        <div class="kpi-row" id="${rootId}-kpis">
          <div class="kpi-card kpi-heute"><div class="kpi-label">Heute</div><div class="kpi-value">-</div><div class="kpi-sub">Veranstaltungen</div></div>
          <div class="kpi-card kpi-next"><div class="kpi-label">Nächstes Event</div><div class="kpi-value">-</div><div class="kpi-sub">Countdown</div></div>
          <div class="kpi-card kpi-woche"><div class="kpi-label">Diese Woche</div><div class="kpi-value">-</div><div class="kpi-sub">Kommende Events</div></div>
          <div class="kpi-card kpi-kat"><div class="kpi-label">Kategorien</div><div class="kpi-value">-</div><div class="kpi-sub">Kategorien im System</div></div>
          <div class="kpi-card kpi-org"><div class="kpi-label">Veranstalter</div><div class="kpi-value">-</div><div class="kpi-sub">Organisationen</div></div>
        </div>

        <!-- Filter Card -->
        <div class="filter-card">
          <div class="filter-card-header">
            <div>
              <h4 class="filter-card-title mb-1">Filter & Suche</h4>
              <p class="filter-card-subtitle mb-0 text-muted small">Zeitraum, Kategorien und Veranstalter eingrenzen</p>
            </div>
            <button
              type="button"
              class="btn btn-sm btn-outline-event filter-toggle-button"
              id="${rootId}-filter-toggle"
              aria-expanded="false"
              aria-controls="${rootId}-filter-body"
            >
              <span aria-hidden="true">⚙️</span>
              <span>Filter anzeigen</span>
            </button>
          </div>
          <div class="filter-body" id="${rootId}-filter-body">
          <div class="filter-grid">
            <div>
              <label class="form-label small fw-bold">Zeitraum Von</label>
              <input type="date" class="form-control form-control-sm" id="${rootId}-filter-von">
            </div>
            <div>
              <label class="form-label small fw-bold">Zeitraum Bis</label>
              <input type="date" class="form-control form-control-sm" id="${rootId}-filter-bis">
            </div>
            <div>
              <label class="form-label small fw-bold">Kategorie</label>
              <select class="form-select form-select-sm" id="${rootId}-filter-kategorie">
                <option value="">Alle Kategorien</option>
              </select>
            </div>
            <div>
              <label class="form-label small fw-bold">Veranstalter</label>
              <select class="form-select form-select-sm" id="${rootId}-filter-veranstalter">
                <option value="">Alle Veranstalter</option>
              </select>
            </div>
            <div>
              <label class="form-label small fw-bold">Status</label>
              <select class="form-select form-select-sm" id="${rootId}-filter-status">
                <option value="">Alle Status</option>
                <option value="geplant">Geplant</option>
                <option value="abgesagt">Abgesagt</option>
                <option value="abgeschlossen">Abgeschlossen</option>
              </select>
            </div>
            <div>
              <label class="form-label small fw-bold">Suche</label>
              <input type="text" class="form-control form-control-sm" placeholder="Titel, Beschreibung..." id="${rootId}-filter-q">
            </div>
          </div>
          </div>
        </div>

        <!-- Main Layout (Tab Views + Side Detail Panel) -->
        <div class="app-content-grid" id="${rootId}-main-layout">
          
          <!-- Left Column: Navigation Tabs & Tab Content -->
          <div class="main-content-column d-flex flex-column gap-3">
            <nav class="nav custom-tabs-nav" role="tablist">
              <button class="nav-link active" id="${rootId}-tab-plan" data-tab="ablaufplan" type="button">🗓️ Ablaufplan</button>
              <button class="nav-link" id="${rootId}-tab-map" data-tab="karte" type="button">🗺️ Karte</button>
              <button class="nav-link" id="${rootId}-tab-users" data-tab="teilnehmer" type="button">👥 Teilnehmer</button>
              <button class="nav-link" id="${rootId}-tab-charts" data-tab="chart" type="button">📊 Statistiken</button>
            </nav>

            <div class="tab-pane-container" id="${rootId}-tab-content">
              <!-- Loading Spinner initially -->
              <div class="empty-state">
                <div class="spinner-border text-primary mb-3" role="status"></div>
                <div>Lade Veranstaltungsdaten...</div>
              </div>
            </div>
          </div>

          <!-- Right Column: Event Detail Side Panel -->
          <div class="detail-panel" id="${rootId}-detail-panel">
            <div class="empty-state">
              <div class="empty-icon">ℹ️</div>
              <h5>Kein Event ausgewählt</h5>
              <p class="small text-muted">Klicken Sie auf ein Event in den Listen oder auf der Karte, um detaillierte Informationen anzuzeigen.</p>
            </div>
          </div>

        </div>

        ${renderMethodikbox(configdata)}
        ${renderWeitereInfos(configdata)}

      </div>
    `;
  }

  // 4. BIND UI ACTIONS
  function initEvents() {
    const root = document.getElementById(rootId);
    if (!root) return;
    const filterToggle = root.querySelector(`#${rootId}-filter-toggle`);

    // Tab buttons
    root.querySelectorAll(".custom-tabs-nav button").forEach(btn => {
      btn.addEventListener("click", (e) => {
        root.querySelectorAll(".custom-tabs-nav button").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeTab = btn.getAttribute("data-tab");
        renderActiveTab();
      });
    });

    if (filterToggle) {
      filterToggle.addEventListener("click", () => {
        isMobileFiltersCollapsed = !isMobileFiltersCollapsed;
        syncFilterCollapseState();
      });
      syncFilterCollapseState();
    }

    // Inputs for filter
    const vonInput = root.querySelector(`#${rootId}-filter-von`);
    const bisInput = root.querySelector(`#${rootId}-filter-bis`);
    const katSelect = root.querySelector(`#${rootId}-filter-kategorie`);
    const verSelect = root.querySelector(`#${rootId}-filter-veranstalter`);
    const statSelect = root.querySelector(`#${rootId}-filter-status`);
    const qInput = root.querySelector(`#${rootId}-filter-q`);

    // Set initial filter value if any
    if (filters.kategorie) katSelect.value = filters.kategorie;

    const onFilterChange = () => {
      filters.von = vonInput.value;
      filters.bis = bisInput.value;
      filters.kategorie = katSelect.value;
      filters.veranstalter = verSelect.value;
      filters.status = statSelect.value;
      filters.q = qInput.value;

      currentPage = 1;
      applyFilters();
    };

    [vonInput, bisInput, katSelect, verSelect, statSelect].forEach(elem => {
      if (elem) elem.addEventListener("change", onFilterChange);
    });
    if (qInput) {
      qInput.addEventListener("input", onFilterChange);
    }

    // Refresh and export buttons
    const btnRefresh = root.querySelector(`#${rootId}-btn-refresh`);
    if (btnRefresh) {
      btnRefresh.addEventListener("click", () => loadAllData());
    }

    const btnExportAll = root.querySelector(`#${rootId}-btn-export-all`);
    if (btnExportAll) {
      btnExportAll.addEventListener("click", () => {
        if (filteredEvents.length === 0) {
          alert("Keine Events zum Exportieren vorhanden.");
          return;
        }
        const icsString = generateICS(filteredEvents);
        downloadICS(icsString, "veranstaltungen.ics");
      });
    }
  }

  function syncFilterCollapseState() {
    const root = document.getElementById(rootId);
    if (!root) return;

    const filterToggle = root.querySelector(`#${rootId}-filter-toggle`);
    root.classList.toggle("filters-collapsed", isMobileFiltersCollapsed);

    if (filterToggle) {
      filterToggle.setAttribute("aria-expanded", String(!isMobileFiltersCollapsed));
      filterToggle.innerHTML = isMobileFiltersCollapsed
        ? '<span aria-hidden="true">⚙️</span><span>Filter anzeigen</span>'
        : '<span aria-hidden="true">✕</span><span>Filter ausblenden</span>';
    }
  }

  // 5. DATENABRUF: direkt oder ueber den ODAS-Proxy (proxyAktiv)

  function buildDataFetchUrl() {
    const configuredApiUrl = String(API_URL || "").trim();
    if (!configuredApiUrl) return "";

    // Direct CSV/ICS/JSON downloads already identify their resource. Only a
    // CKAN datastore_search endpoint needs resource_id and limit parameters.
    if (!/\/datastore_search(?:$|\?)/i.test(configuredApiUrl) || !RESOURCE_ID) {
      return configuredApiUrl;
    }

    const separator = configuredApiUrl.includes("?") ? "&" : "?";
    return `${configuredApiUrl}${separator}resource_id=${encodeURIComponent(
      RESOURCE_ID,
    )}&limit=${encodeURIComponent(MAX_RECORDS)}`;
  }

  async function loadAllData() {
    showLoading();
    const fetchUrl = buildDataFetchUrl();

    if (!fetchUrl) {
      const error = new Error("Keine Datenquelle konfiguriert.");
      console.error("Fehler beim Laden der Veranstaltungsdaten:", error);
      showError("Die Veranstaltungsdatenquelle ist nicht konfiguriert.");
      return;
    }

    try {
      // Relative Pfade liegen im eigenen Origin und brauchen nie den Proxy.
      const istRelativ = fetchUrl.startsWith("../") || fetchUrl.startsWith("./");
      const rawContent = await fetchOdasResource(
        fetchUrl,
        istRelativ ? {} : configdata,
      );
      if (disposed) return;
      parseAndNormalize(rawContent);
    } catch (err) {
      if (disposed) return;
      console.error("Fehler beim Laden der Veranstaltungsdaten:", err);
      allEvents = [];
      filteredEvents = [];
      showError("Die Veranstaltungsdaten konnten nicht geladen werden. Bitte prüfen Sie die Datenquelle.");
    }
  }

  // Parses CSV, JSON or ICS/iCal and normalizes the format
  function parseAndNormalize(content) {
    let parsedData = [];

    if (content && typeof content === "string" && content.includes("BEGIN:VCALENDAR")) {
      console.log("iCalendar-Format (ICS) erkannt, parse...");
      parsedData = parseICS(content);
    } else {
      let parsedJson = false;
      try {
        const json = JSON.parse(content);
        if (json.success && json.result && Array.isArray(json.result.records)) {
          parsedData = json.result.records;
          parsedJson = true;
        } else if (Array.isArray(json)) {
          parsedData = json;
          parsedJson = true;
        } else if (json.records && Array.isArray(json.records)) {
          parsedData = json.records;
          parsedJson = true;
        } else if (json.data && Array.isArray(json.data)) {
          parsedData = json.data;
          parsedJson = true;
        }
      } catch (err) {
        // JSON failed, try CSV parser
        console.log("JSON parsing fehlgeschlagen, versuche CSV...");
      }

      if (!parsedJson) {
        parsedData = parseCSV(content);
      }
    }

    // Normalize records to match concept keys
    allEvents = parsedData.map((ev, index) => {
      // Extract coordinates
      let lat = null;
      let lon = null;
      if (ev.ort_lat !== undefined && ev.ort_lat !== null) lat = Number(ev.ort_lat);
      if (ev.ort_lon !== undefined && ev.ort_lon !== null) lon = Number(ev.ort_lon);

      return {
        // Bewusst als String vereinheitlicht: Die drei Quellformate liefern
        // unterschiedliche Typen (CSV -> "1", CKAN/JSON -> 1, ICS -> "1"). Ohne diese
        // Normalisierung schlaegt der Lookup in der Agenda fehl, weil dort ueber
        // data-id (immer String) gesucht wird.
        event_id: String(ev.event_id || ev.id || index + 1),
        titel: ev.titel || ev.titel_de || ev.summary || ev.title || "Unbenannte Veranstaltung",
        beschreibung: ev.beschreibung || ev.description || "",
        datum_start: ev.datum_start || ev.dtstart || ev.start || "",
        datum_ende: ev.datum_ende || ev.dtend || ev.end || ev.datum_start || "",
        zeitzone: ev.zeitzone || ev.tzid || "Europe/Berlin",
        ort_name: ev.ort_name || ev.location || ev.ort || "",
        ort_adresse: ev.ort_adresse || ev.adresse || "",
        ort_lat: lat,
        ort_lon: lon,
        kategorie: ev.kategorie || ev.categories || ev.category || "Sonstiges",
        teilnehmer: ev.teilnehmer || ev.attendee || "",
        veranstalter: ev.veranstalter || ev.organizer || "Stadtverwaltung",
        kontakt_email: ev.kontakt_email || ev.organizer_email || "",
        url: ev.url || ev.link || "",
        status: ev.status || "geplant",
        wiederholung: ev.wiederholung || ev.rrule || ""
      };
    }).filter(ev => ev.datum_start); // Skip events missing start date

    // Populate filter selectors dynamically
    populateFiltersDynamicOptions();

    // Set initial active filters selection
    applyFilters();
  }

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return [];
    
    // Detect delimiter
    const header = lines[0];
    let delimiter = ",";
    if (header.includes(";")) delimiter = ";";
    else if (header.includes("\t")) delimiter = "\t";

    // Split headers
    const headers = splitCSVLine(header, delimiter).map(h => h.trim().toLowerCase());
    const hasStartField = ["datum_start", "start", "dtstart"].some(field =>
      headers.includes(field),
    );
    if (!hasStartField) {
      throw new Error("CSV enthält kein erwartetes Startdatumsfeld.");
    }

    const result = [];
    for (let i = 1; i < lines.length; i++) {
      const values = splitCSVLine(lines[i], delimiter);
      if (values.length < headers.length) continue;
      
      const obj = {};
      headers.forEach((headerName, index) => {
        obj[headerName] = values[index];
      });
      result.push(obj);
    }
    return result;
  }

  function splitCSVLine(line, delimiter) {
    const result = [];
    let insideQuote = false;
    let entry = "";
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === delimiter && !insideQuote) {
        result.push(entry.trim());
        entry = "";
      } else {
        entry += char;
      }
    }
    result.push(entry.trim());
    return result;
  }

  function parseICS(text) {
    const events = [];
    // Unfold lines (RFC 5545: folded lines start with a space or tab)
    const unfolded = text.replace(/\r?\n[ \t]/g, "");
    const lines = unfolded.split(/\r?\n/);
    
    let currentEvent = null;
    
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      
      if (line.toUpperCase() === "BEGIN:VEVENT") {
        currentEvent = {};
        continue;
      }
      
      if (line.toUpperCase() === "END:VEVENT") {
        if (currentEvent) {
          events.push(currentEvent);
          currentEvent = null;
        }
        continue;
      }
      
      if (currentEvent) {
        const colonIndex = line.indexOf(":");
        if (colonIndex === -1) continue;
        
        const keyPart = line.substring(0, colonIndex);
        const value = line.substring(colonIndex + 1);
        
        const parts = keyPart.split(";");
        const key = parts[0].toUpperCase();
        const params = {};
        for (let i = 1; i < parts.length; i++) {
          const eqIndex = parts[i].indexOf("=");
          if (eqIndex !== -1) {
            const pKey = parts[i].substring(0, eqIndex).toUpperCase();
            const pVal = parts[i].substring(eqIndex + 1);
            params[pKey] = pVal;
          }
        }
        
        const decodeICSValue = (str) => {
          return str
            .replace(/\\(.)/g, "$1")
            .replace(/\\n/gi, "\n")
            .replace(/\\r/gi, "\r");
        };

        const decodedValue = decodeICSValue(value);

        if (key === "SUMMARY") {
          currentEvent.titel = decodedValue;
        } else if (key === "DESCRIPTION") {
          currentEvent.beschreibung = decodedValue;
        } else if (key === "DTSTART") {
          currentEvent.datum_start = parseICSDate(value, params.TZID);
          if (params.TZID) currentEvent.zeitzone = params.TZID;
        } else if (key === "DTEND") {
          currentEvent.datum_ende = parseICSDate(value, params.TZID);
        } else if (key === "LOCATION") {
          currentEvent.ort_name = decodedValue;
        } else if (key === "GEO") {
          const geoParts = value.split(";");
          if (geoParts.length === 2) {
            currentEvent.ort_lat = Number(geoParts[0]);
            currentEvent.ort_lon = Number(geoParts[1]);
          }
        } else if (key === "CATEGORIES") {
          currentEvent.kategorie = decodedValue;
        } else if (key === "URL") {
          currentEvent.url = decodedValue;
        } else if (key === "RRULE") {
          currentEvent.wiederholung = value;
        } else if (key === "ORGANIZER") {
          let veranstalter = params.CN ? decodeICSValue(params.CN) : value;
          if (veranstalter.toLowerCase().startsWith("mailto:")) {
            veranstalter = veranstalter.substring(7);
          }
          currentEvent.veranstalter = veranstalter;
          if (value.toLowerCase().startsWith("mailto:")) {
            currentEvent.kontakt_email = value.substring(7);
          }
        } else if (key === "STATUS") {
          if (value.toUpperCase() === "CANCELLED") {
            currentEvent.status = "abgesagt";
          } else {
            currentEvent.status = "geplant";
          }
        } else if (key === "ATTENDEE") {
          let attendeeName = params.CN ? decodeICSValue(params.CN) : value;
          if (attendeeName.toLowerCase().startsWith("mailto:")) {
            attendeeName = attendeeName.substring(7);
          }
          if (currentEvent.teilnehmer) {
            currentEvent.teilnehmer += ", " + attendeeName;
          } else {
            currentEvent.teilnehmer = attendeeName;
          }
        } else if (key === "UID") {
          currentEvent.event_id = decodedValue.split("@")[0];
        }
      }
    }
    
    return events;
  }

  function parseICSDate(icsDateStr, tzid) {
    const cleanDate = icsDateStr.replace(/[^0-9T]/g, "");
    if (cleanDate.length === 8) {
      return `${cleanDate.substring(0, 4)}-${cleanDate.substring(4, 6)}-${cleanDate.substring(6, 8)}`;
    } else if (cleanDate.length >= 15) {
      const y = cleanDate.substring(0, 4);
      const m = cleanDate.substring(4, 6);
      const d = cleanDate.substring(6, 8);
      const hh = cleanDate.substring(9, 11);
      const mm = cleanDate.substring(11, 13);
      const ss = cleanDate.substring(13, 15);
      
      if (icsDateStr.endsWith("Z")) {
        return `${y}-${m}-${d}T${hh}:${mm}:${ss}Z`;
      }
      return `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
    }
    return icsDateStr;
  }

  function populateFiltersDynamicOptions() {
    const root = document.getElementById(rootId);
    if (!root) return;

    const katSelect = root.querySelector(`#${rootId}-filter-kategorie`);
    const verSelect = root.querySelector(`#${rootId}-filter-veranstalter`);

    const categories = [...new Set(allEvents.map(e => e.kategorie))].filter(Boolean).sort();
    const veranstalter = [...new Set(allEvents.map(e => e.veranstalter))].filter(Boolean).sort();

    // Categories
    const currentKatValue = katSelect.value;
    katSelect.innerHTML = '<option value="">Alle Kategorien</option>' +
      categories.map(k => `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`).join("");
    katSelect.value = categories.includes(currentKatValue) ? currentKatValue : "";

    // Organizers
    const currentVerValue = verSelect.value;
    verSelect.innerHTML = '<option value="">Alle Veranstalter</option>' +
      veranstalter.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
    verSelect.value = veranstalter.includes(currentVerValue) ? currentVerValue : "";
  }

  // 6. FILTERING
  function applyFilters() {
    filteredEvents = allEvents.filter(ev => {
      // Date start/end boundaries
      if (filters.von) {
        const evStart = ev.datum_start.substring(0, 10);
        if (evStart < filters.von) return false;
      }
      if (filters.bis) {
        const evStart = ev.datum_start.substring(0, 10);
        if (evStart > filters.bis) return false;
      }

      // Category
      if (filters.kategorie && ev.kategorie !== filters.kategorie) return false;

      // Organizer
      if (filters.veranstalter && ev.veranstalter !== filters.veranstalter) return false;

      // Status
      if (filters.status && ev.status !== filters.status) return false;

      // Query (freitext)
      if (filters.q) {
        const query = filters.q.toLowerCase();
        const inTitle = ev.titel.toLowerCase().includes(query);
        const inDesc = ev.beschreibung.toLowerCase().includes(query);
        const inOrt = ev.ort_name.toLowerCase().includes(query) || ev.ort_adresse.toLowerCase().includes(query);
        if (!inTitle && !inDesc && !inOrt) return false;
      }

      return true;
    });

    // Update KPI panels
    updateKPIs();

    // Render active View
    renderActiveTab();
  }

  // 7. COUNT KPIs
  function updateKPIs() {
    const root = document.getElementById(rootId);
    if (!root) return;

    const now = new Date();
    const todayStr = now.toISOString().substring(0, 10);

    // 1. Events today
    const eventsToday = allEvents.filter(e => {
      const startStr = e.datum_start.substring(0, 10);
      const endeStr = e.datum_ende.substring(0, 10);
      return startStr === todayStr || (startStr <= todayStr && endeStr >= todayStr);
    });

    // 2. Next Event (chronological >= now)
    const futureEventsSorted = allEvents
      .filter(e => new Date(e.datum_start) >= now && e.status !== "abgesagt")
      .sort((a, b) => new Date(a.datum_start) - new Date(b.datum_start));

    let nextEventTitle = "Keines";
    let countdownStr = "In nächster Zeit";

    if (futureEventsSorted.length > 0) {
      const nextEv = futureEventsSorted[0];
      nextEventTitle = nextEv.titel;
      
      const diffMs = new Date(nextEv.datum_start) - now;
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHrs / 24);

      if (diffHrs < 1) {
        countdownStr = "In weniger als einer Std.";
      } else if (diffHrs < 24) {
        countdownStr = `In ${diffHrs} Std.`;
      } else {
        countdownStr = `In ${diffDays} Tag${diffDays > 1 ? "en" : ""}`;
      }
    }

    // 3. Events this week (next 7 days)
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const eventsThisWeek = allEvents.filter(e => {
      const d = new Date(e.datum_start);
      return d >= now && d <= sevenDaysLater;
    });

    // 4. Unique Categories count
    const uniqueKats = [...new Set(allEvents.map(e => e.kategorie))].filter(Boolean).length;

    // 5. Unique Organizers count
    const uniqueOrgs = [...new Set(allEvents.map(e => e.veranstalter))].filter(Boolean).length;

    // Render into DOM
    const kk = (n) => {
      const t = String(configdata["kpiKontext" + n] || "").trim();
      if (!t) return "";
      return (
        '<button class="kpi-info-toggle collapsed" type="button" ' +
        'data-bs-toggle="collapse" data-bs-target="#ek-kpi-kontext-' + n + '-' + ekUid + '" ' +
        'aria-expanded="false" aria-controls="ek-kpi-kontext-' + n + '-' + ekUid + '" ' +
        'aria-label="Erklärung zu diesem Wert">' +
        '<span class="kpi-info-icon" aria-hidden="true">ⓘ</span>' +
        '</button>' +
        '<div id="ek-kpi-kontext-' + n + '-' + ekUid + '" class="collapse">' +
        '<div class="kpi-kontext">' + escapeHtml(t) + '</div>' +
        '</div>'
      );
    };
    root.querySelector(`#${rootId}-kpis`).innerHTML = `
      <div class="kpi-card kpi-heute">
        <div class="kpi-label">Heute</div>
        <div class="kpi-value" title="${eventsToday.length}">${eventsToday.length}</div>
        <div class="kpi-sub">Veranstaltungen</div>
        ${kk(1)}
      </div>
      <div class="kpi-card kpi-next">
        <div class="kpi-label">Nächstes Event</div>
        <div class="kpi-value" title="${escapeHtml(nextEventTitle)}">${escapeHtml(nextEventTitle)}</div>
        <div class="kpi-sub">${escapeHtml(countdownStr)}</div>
        ${kk(2)}
      </div>
      <div class="kpi-card kpi-woche">
        <div class="kpi-label">Diese Woche</div>
        <div class="kpi-value" title="${eventsThisWeek.length}">${eventsThisWeek.length}</div>
        <div class="kpi-sub">In den nächsten 7 Tagen</div>
        ${kk(3)}
      </div>
      <div class="kpi-card kpi-kat">
        <div class="kpi-label">Kategorien</div>
        <div class="kpi-value" title="${uniqueKats}">${uniqueKats}</div>
        <div class="kpi-sub">Sparten im Programm</div>
        ${kk(4)}
      </div>
      <div class="kpi-card kpi-org">
        <div class="kpi-label">Veranstalter</div>
        <div class="kpi-value" title="${uniqueOrgs}">${uniqueOrgs}</div>
        <div class="kpi-sub">Aktive Organisationen</div>
        ${kk(5)}
      </div>
    `;
  }

  // 8. RENDER ACTIVE TAB VIEW
  function renderActiveTab() {
    const container = document.getElementById(`${rootId}-tab-content`);
    if (!container) return;

    // Destroy Leaflet map on tab switch to avoid multiple instantiations
    if (activeTab !== "karte" && leafletMap) {
      leafletMap.remove();
      leafletMap = null;
      markerLayer = null;
    }

    if (filteredEvents.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📅</div>
          <h5>Keine Veranstaltungen gefunden</h5>
          <p class="small text-muted">Für Ihre aktiven Filtereinstellungen wurden keine Einträge gefunden. Versuchen Sie, die Suche oder Filter zurückzusetzen.</p>
        </div>
      `;
      return;
    }

    switch (activeTab) {
      case "ablaufplan":
        renderAblaufplan(container);
        break;
      case "karte":
        renderKarte(container);
        break;
      case "teilnehmer":
        renderTeilnehmer(container);
        break;
      case "chart":
        renderChart(container);
        break;
    }
  }

  // 9. TAB 1: ABLAUFPLAN
  function renderAblaufplan(container) {
    // Sort events chronologically
    const sorted = [...filteredEvents].sort((a, b) => new Date(a.datum_start) - new Date(b.datum_start));
    
    // Separate past and future events
    const now = new Date();
    const pastEvents = sorted.filter(e => new Date(e.datum_start) < now);
    const futureEvents = sorted.filter(e => new Date(e.datum_start) >= now);

    // We do pagination on the combined list but we keep a "Heute" divider
    const totalItems = sorted.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (currentPage > totalPages) currentPage = Math.max(1, totalPages);

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedEvents = sorted.slice(startIndex, endIndex);

    let html = `<div class="agenda-list">`;
    let placedDivider = false;

    // Helper: does today's divider fall inside this page?
    // If we have past and future events, check if we need to put it
    paginatedEvents.forEach((ev) => {
      const evDate = new Date(ev.datum_start);
      
      // Place "Heute" line if transitioning from past to future
      if (!placedDivider && evDate >= now && pastEvents.length > 0) {
        html += `
          <div class="today-divider">
            <span>Heute (${formatLocalDateString(now)})</span>
          </div>
        `;
        placedDivider = true;
      }

      const isSelected = selectedEvent && selectedEvent.event_id === ev.event_id;
    const isCancelled = ev.status === "abgesagt";
      const isRecurring = ev.wiederholung ? "🔄" : "";
      
      const categoryClass = getCategoryBadgeClass(ev.kategorie);
      const timeStr = formatEventTimeRange(ev.datum_start, ev.datum_ende);

      html += `
        <div class="agenda-item ${isSelected ? "active" : ""}" data-id="${escapeHtml(ev.event_id)}">
          <div class="agenda-left">
            <div class="agenda-meta">
              <span class="badge-kat bg-kat-${categoryClass}">${escapeHtml(ev.kategorie)}</span>
              <span>${timeStr}</span>
              ${isRecurring ? `<span title="Wiederkehrender Termin" style="cursor:help;">${isRecurring}</span>` : ""}
            </div>
            <div class="agenda-title ${isCancelled ? "event-cancelled" : ""}">
              ${escapeHtml(ev.titel)}
            </div>
            <div class="agenda-location text-muted">
              📍 ${escapeHtml(ev.ort_name || "Ohne Ortsangabe")}
            </div>
          </div>
          <div class="agenda-right">
            <span class="badge ${isCancelled ? "badge-status-cancelled" : "bg-light text-dark"} small">
              ${isCancelled ? "Abgesagt" : escapeHtml(ev.status)}
            </span>
            <span class="small text-muted text-truncate" style="max-width:140px;" title="${escapeHtml(ev.veranstalter)}">
              🏢 ${escapeHtml(ev.veranstalter)}
            </span>
          </div>
        </div>
      `;
    });

    html += `</div>`;

    // Pagination Controls
    if (totalPages > 1) {
      html += `
        <div class="pagination-controls">
          <button class="btn btn-sm btn-outline-secondary" id="${rootId}-btn-page-prev" ${currentPage === 1 ? "disabled" : ""}>◀ Zurück</button>
          <span class="small text-muted">Seite <strong>${currentPage}</strong> von <strong>${totalPages}</strong></span>
          <button class="btn btn-sm btn-outline-secondary" id="${rootId}-btn-page-next" ${currentPage === totalPages ? "disabled" : ""}>Weiter ▶</button>
        </div>
      `;
    }

    container.innerHTML = html;

    // Bind event handlers
    const listDiv = container.querySelector(".agenda-list");
    listDiv.querySelectorAll(".agenda-item").forEach(item => {
      item.addEventListener("click", () => {
        const id = item.getAttribute("data-id");
        const ev = filteredEvents.find(e => String(e.event_id) === id);
        selectEvent(ev);
        listDiv.querySelectorAll(".agenda-item").forEach(i => i.classList.remove("active"));
        item.classList.add("active");
      });
    });

    // Pagination events
    if (totalPages > 1) {
      container.querySelector(`#${rootId}-btn-page-prev`).addEventListener("click", () => {
        if (currentPage > 1) {
          currentPage--;
          renderAblaufplan(container);
        }
      });
      container.querySelector(`#${rootId}-btn-page-next`).addEventListener("click", () => {
        if (currentPage < totalPages) {
          currentPage++;
          renderAblaufplan(container);
        }
      });
    }
  }

  // 10. TAB 2: KARTENANSICHT
  function renderKarte(container) {
    // F-43: Beim Re-Render des Karte-Tabs ersetzt `container.innerHTML` das
    // bisherige Map-Element. Die alte Leaflet-Instanz muss vorher entfernt
    // werden, sonst bleibt sie mit Event-Listenern und Tile-Requests aktiv
    // (Ressourcen-Leak; Leaflet-Maps haengen nicht am DOM-Node).
    if (leafletMap) {
      leafletMap.remove();
      leafletMap = null;
      markerLayer = null;
    }

    container.innerHTML = `
      <div id="${rootId}-map-canvas" class="event-map-container"></div>
      <div class="d-flex justify-content-end gap-3 mt-2 flex-wrap text-muted small fw-bold">
        <span>Legende:</span>
        <span><span class="badge bg-primary">&nbsp;</span> Politik</span>
        <span><span class="badge bg-success">&nbsp;</span> Kultur</span>
        <span><span class="badge bg-warning text-dark">&nbsp;</span> Sport</span>
        <span><span class="badge bg-info text-dark">&nbsp;</span> Bildung</span>
        <span><span class="badge bg-danger">&nbsp;</span> Soziales</span>
        <span><span class="badge bg-secondary">&nbsp;</span> Sonstiges</span>
      </div>
    `;

    loadLeaflet(() => {
      if (disposed) return;
      const mapDiv = document.getElementById(`${rootId}-map-canvas`);
      if (!mapDiv || !window.L) return;

      // Set up Map
      leafletMap = window.L.map(mapDiv).setView(mapCenter, mapZoom);

      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(leafletMap);

      // Cluster support
      if (window.L.markerClusterGroup) {
        markerLayer = window.L.markerClusterGroup({
          showCoverageOnHover: false,
          maxClusterRadius: 40
        });
      } else {
        markerLayer = window.L.layerGroup();
      }
      markerLayer.addTo(leafletMap);

      const bounds = [];

      filteredEvents.forEach(ev => {
        if (ev.ort_lat && ev.ort_lon) {
          const categoryClass = getCategoryBadgeClass(ev.kategorie);
          const icon = window.L.divIcon({
            html: `<div class="marker-pin pin-${categoryClass}"></div>`,
            className: 'custom-div-icon',
            iconSize: [30, 42],
            iconAnchor: [15, 42]
          });

          const timeStr = formatEventTimeRange(ev.datum_start, ev.datum_ende);

          const popupHtml = `
            <div style="font-family:sans-serif; width: 220px;">
              <span class="badge-kat bg-kat-${categoryClass}" style="font-size:0.7rem; display:inline-block; margin-bottom:5px;">
                ${escapeHtml(ev.kategorie)}
              </span>
              <strong style="display:block; font-size:0.9rem; margin-bottom:4px;">${escapeHtml(ev.titel)}</strong>
              <div class="small text-muted" style="margin-bottom:2px;">📅 ${timeStr}</div>
              <div class="small text-muted" style="margin-bottom:5px;">📍 ${escapeHtml(ev.ort_name)}</div>
              ${ev.teilnehmer ? `<div class="small text-truncate" style="margin-bottom:6px;">👥 ${escapeHtml(ev.teilnehmer)}</div>` : ""}
              <button class="btn btn-xs btn-outline-event w-100 py-1 text-center" style="font-size:0.75rem; border-radius:4px;" id="${rootId}-map-btn-show-${escapeHtml(ev.event_id)}">
                Details anzeigen
              </button>
            </div>
          `;

          const marker = window.L.marker([ev.ort_lat, ev.ort_lon], { icon })
            .bindPopup(popupHtml);

          marker.on("popupopen", () => {
            const btn = document.getElementById(`${rootId}-map-btn-show-${escapeHtml(ev.event_id)}`);
            if (btn) {
              btn.addEventListener("click", () => {
                selectEvent(ev);
              });
            }
          });

          markerLayer.addLayer(marker);
          bounds.push([ev.ort_lat, ev.ort_lon]);
        }
      });

      // Fit map to markers bounds
      if (bounds.length > 0) {
        leafletMap.fitBounds(window.L.latLngBounds(bounds), {
          padding: [30, 30],
          maxZoom: 15
        });
      }
    });
  }

  // 11. TAB 3: TEILNEHMER-ANSICHT
  function renderTeilnehmer(container) {
    // Unroll teilnehmer split by ';'
    const participantMap = new Map();

    filteredEvents.forEach(ev => {
      if (ev.teilnehmer) {
        const attendees = ev.teilnehmer.split(";").map(t => t.trim()).filter(Boolean);
        attendees.forEach(att => {
          if (!participantMap.has(att)) {
            participantMap.set(att, []);
          }
          participantMap.get(att).push(ev);
        });
      }
    });

    const participantsList = Array.from(participantMap.keys()).sort((a, b) => a.localeCompare(b, "de"));

    container.innerHTML = `
      <div class="mb-3">
        <input type="text" class="form-control form-control-sm" placeholder="Teilnehmer filtern..." id="${rootId}-search-attendee">
      </div>
      <div id="${rootId}-attendee-results" class="agenda-list" style="max-height: 520px;">
      </div>
    `;

    const resultDiv = container.querySelector(`#${rootId}-attendee-results`);
    const searchInput = container.querySelector(`#${rootId}-search-attendee`);

    const drawAttendees = (query = "") => {
      const q = query.toLowerCase();
      const filteredList = participantsList.filter(name => name.toLowerCase().includes(q));

      if (filteredList.length === 0) {
        resultDiv.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">👥</div>
            <div>Keine Teilnehmer passend zur Suche gefunden</div>
          </div>
        `;
        return;
      }

      resultDiv.innerHTML = filteredList.map(name => {
        const events = participantMap.get(name);
        // Sort events chronologically
        events.sort((a, b) => new Date(a.datum_start) - new Date(b.datum_start));

        const collapsibleId = `att-coll-${name.replace(/[^a-zA-Z0-9]/g, "")}-${ekUid}`;

        return `
          <div class="border rounded p-2 mb-2 bg-light">
            <div class="d-flex justify-content-between align-items-center cursor-pointer" 
                 data-bs-toggle="collapse" 
                 data-bs-target="#${collapsibleId}" 
                 style="cursor:pointer;">
              <span class="fw-bold text-dark">👤 ${escapeHtml(name)}</span>
              <span class="badge bg-secondary">${events.length} Event${events.length > 1 ? "s" : ""}</span>
            </div>
            <div class="collapse mt-2" id="${collapsibleId}">
              <div class="list-group list-group-flush border-top pt-2">
                ${events.map(ev => {
                  const categoryClass = getCategoryBadgeClass(ev.kategorie);
                  const dateStr = formatEventTimeRange(ev.datum_start, ev.datum_ende);
                  return `
                    <div class="list-group-item list-group-item-action d-flex justify-content-between align-items-center border-0 py-2 px-1 rounded" 
                         style="cursor:pointer; font-size:0.85rem;" 
                         id="att-ev-link-${escapeHtml(ev.event_id)}">
                      <div>
                        <span class="badge-kat bg-kat-${categoryClass} me-2" style="font-size:0.65rem;">
                          ${escapeHtml(ev.kategorie)}
                        </span>
                        <span class="${ev.status === "abgesagt" ? "event-cancelled" : ""} fw-semibold">${escapeHtml(ev.titel)}</span>
                      </div>
                      <div class="text-muted small text-end">
                        ${dateStr} <br>
                        📍 ${escapeHtml(ev.ort_name)}
                      </div>
                    </div>
                  `;
                }).join("")}
              </div>
            </div>
          </div>
        `;
      }).join("");

      // Bind click triggers
      filteredList.forEach(name => {
        const events = participantMap.get(name);
        events.forEach(ev => {
          const item = resultDiv.querySelector(`#att-ev-link-${escapeHtml(ev.event_id)}`);
          if (item) {
            item.addEventListener("click", (e) => {
              e.stopPropagation();
              selectEvent(ev);
            });
          }
        });
      });
    };

    drawAttendees();

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        drawAttendees(searchInput.value);
      });
    }
  }

  // 12. TAB 4: CHARTS (Events per Category & Month)
  function renderChart(container) {
    container.innerHTML = `
      <div class="charts-grid">
        <div class="border rounded p-3">
          <h6 class="fw-bold mb-2">Entwicklung nach Monaten &amp; Kategorien</h6>
          <div class="chart-wrapper">
            <canvas id="${rootId}-chart-bar"></canvas>
          </div>
        </div>
        <div class="border rounded p-3">
          <h6 class="fw-bold mb-2">Verteilung nach Kategorien</h6>
          <div class="chart-wrapper">
            <canvas id="${rootId}-chart-doughnut"></canvas>
          </div>
        </div>
      </div>
    `;

    loadChartJS(() => {
      if (disposed) return;
      const barCanvas = document.getElementById(`${rootId}-chart-bar`);
      const doughnutCanvas = document.getElementById(`${rootId}-chart-doughnut`);
      if (!barCanvas || !doughnutCanvas || !window.Chart) return;

      // Group data
      const categories = [...new Set(filteredEvents.map(e => e.kategorie))].filter(Boolean);
      const months = [];
      const monthMap = new Map(); // "YYYY-MM" -> Map(category -> count)

      // Sort and gather months
      filteredEvents.forEach(ev => {
        const date = new Date(ev.datum_start);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const monthKey = `${yyyy}-${mm}`;
        
        if (!months.includes(monthKey)) {
          months.push(monthKey);
        }
        if (!monthMap.has(monthKey)) {
          monthMap.set(monthKey, new Map());
        }
        const catMap = monthMap.get(monthKey);
        catMap.set(ev.kategorie, (catMap.get(ev.kategorie) || 0) + 1);
      });

      months.sort();

      // Datasets for Bar Chart
      const categoryColorMap = {
        Politik: "#0d6efd",
        Kultur: "#198754",
        Sport: "#ffc107",
        Bildung: "#0dcaf0",
        Soziales: "#dc3545",
        Sonstiges: "#6c757d"
      };

      const barDatasets = categories.map(cat => {
        const data = months.map(m => monthMap.get(m).get(cat) || 0);
        return {
          label: cat,
          data: data,
          backgroundColor: categoryColorMap[cat] || "#6c757d",
          borderColor: "#ffffff",
          borderWidth: 1
        };
      });

      // Categories overall breakdown for Doughnut Chart
      const catOverallCounts = categories.map(cat => {
        return filteredEvents.filter(e => e.kategorie === cat).length;
      });

      // Format month names for display
      const monthLabels = months.map(m => {
        const [year, month] = m.split("-");
        const date = new Date(Number(year), Number(month) - 1, 1);
        return date.toLocaleDateString("de-DE", { month: "short", year: "2-digit" });
      });

      // Destroy old instances
      if (chartInstanceBar) chartInstanceBar.destroy();
      if (chartInstanceDoughnut) chartInstanceDoughnut.destroy();

      // Render Bar
      chartInstanceBar = new window.Chart(barCanvas, {
        type: "bar",
        data: {
          labels: monthLabels,
          datasets: barDatasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { stacked: true },
            y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }
          },
          plugins: {
            legend: { position: "bottom", labels: { boxWidth: 12 } }
          }
        }
      });

      // Render Doughnut
      chartInstanceDoughnut = new window.Chart(doughnutCanvas, {
        type: "doughnut",
        data: {
          labels: categories,
          datasets: [{
            data: catOverallCounts,
            backgroundColor: categories.map(c => categoryColorMap[c] || "#6c757d"),
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom", labels: { boxWidth: 12 } }
          }
        }
      });
    });
  }

  // 13. SIDE DETAIL PANEL
  function selectEvent(ev) {
    selectedEvent = ev;
    const panel = document.getElementById(`${rootId}-detail-panel`);
    if (!panel) return;

    if (!ev) {
      panel.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">ℹ️</div>
          <h5>Kein Event ausgewählt</h5>
          <p class="small text-muted">Klicken Sie auf ein Event in den Listen oder auf der Karte, um detaillierte Informationen anzuzeigen.</p>
        </div>
      `;
      return;
    }

    const categoryClass = getCategoryBadgeClass(ev.kategorie);
    const dateStr = formatLocalDateString(new Date(ev.datum_start));
    const timeRangeStr = formatEventTimeRange(ev.datum_start, ev.datum_ende);
    const attendees = ev.teilnehmer ? ev.teilnehmer.split(";").map(t => t.trim()).filter(Boolean) : [];
    const isCancelled = ev.status === "abgesagt";
    const u = safeHttpUrl(ev.url);

    panel.innerHTML = `
      <div class="detail-header">
        <span class="badge-kat bg-kat-${categoryClass}">${escapeHtml(ev.kategorie)}</span>
        <button type="button" class="btn-close" aria-label="Schließen" id="${rootId}-detail-close"></button>
      </div>
      
      <div class="detail-content">
        <h4 class="fw-bold mb-3 ${isCancelled ? "event-cancelled" : ""}">${escapeHtml(ev.titel)}</h4>
        
        ${isCancelled ? `
          <div class="alert alert-danger py-2 px-3 mb-3 d-flex align-items-center gap-2 small" role="alert">
            <span>⚠️</span> <strong>Diese Veranstaltung wurde abgesagt.</strong>
          </div>
        ` : ""}

        <div class="detail-row">
          <span class="detail-icon">📅</span>
          <span class="detail-label">Datum:</span>
          <span class="detail-value">${dateStr}</span>
        </div>

        <div class="detail-row">
          <span class="detail-icon">⏰</span>
          <span class="detail-label">Uhrzeit:</span>
          <span class="detail-value">${timeRangeStr} ${ev.zeitzone !== "Europe/Berlin" ? `(${escapeHtml(ev.zeitzone)})` : ""}</span>
        </div>

        <div class="detail-row">
          <span class="detail-icon">📍</span>
          <span class="detail-label">Ort:</span>
          <div class="detail-value">
            <strong>${escapeHtml(ev.ort_name || "Ohne Ortsangabe")}</strong>
            ${ev.ort_adresse ? `<div class="text-muted small mt-1">${escapeHtml(ev.ort_adresse)}</div>` : ""}
          </div>
        </div>

        <div class="detail-row">
          <span class="detail-icon">🏢</span>
          <span class="detail-label">Veranstalter:</span>
          <div class="detail-value">
            ${escapeHtml(ev.veranstalter)}
            ${ev.kontakt_email ? `<div class="mt-1 small">✉️ ${escapeHtml(ev.kontakt_email)}</div>` : ""}
          </div>
        </div>

        ${ev.beschreibung ? `
          <div class="detail-row flex-column mt-3">
            <span class="fw-bold mb-1" style="font-size:0.9rem;">📝 Beschreibung:</span>
            <div class="detail-value text-muted" style="white-space: pre-wrap; font-size:0.85rem; line-height:1.5;">${escapeHtml(ev.beschreibung)}</div>
          </div>
        ` : ""}

        ${attendees.length > 0 ? `
          <div class="detail-row flex-column mt-3">
            <span class="fw-bold mb-1" style="font-size:0.9rem;">👥 Teilnehmer:</span>
            <div class="detail-value">
              <ul class="list-unstyled d-flex flex-wrap gap-1 mb-0">
                ${attendees.map(att => `<li class="badge bg-light text-dark border px-2 py-1" style="font-weight:normal; font-size:0.75rem;">👤 ${escapeHtml(att)}</li>`).join("")}
              </ul>
            </div>
          </div>
        ` : ""}

        ${ev.wiederholung ? `
          <div class="detail-row flex-column mt-3">
            <span class="fw-bold mb-1" style="font-size:0.9rem;">🔄 Wiederholung:</span>
            <div class="detail-value text-muted small">
              <code>${escapeHtml(ev.wiederholung)}</code>
            </div>
          </div>
        ` : ""}

        ${u ? `
          <div class="mt-3">
            <a href="${escapeHtml(u)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline-event w-100">
              🔗 Mehr erfahren &rarr;
            </a>
          </div>
        ` : ""}

        <div class="mt-2">
          <button class="btn btn-sm btn-event w-100 d-flex align-items-center justify-content-center gap-2" id="${rootId}-btn-export-single">
            <span>📅</span> In Kalender speichern (.ics)
          </button>
        </div>
      </div>
    `;

    // Bind close and export actions
    panel.querySelector(`#${rootId}-detail-close`).addEventListener("click", () => {
      selectEvent(null);
      // Remove active classes in Agenda List
      const root = document.getElementById(rootId);
      const listDiv = root ? root.querySelector(".agenda-list") : null;
      if (listDiv) {
        listDiv.querySelectorAll(".agenda-item").forEach(i => i.classList.remove("active"));
      }
    });

    panel.querySelector(`#${rootId}-btn-export-single`).addEventListener("click", () => {
      const icsString = generateICS([ev]);
      downloadICS(icsString, `${slugify(ev.titel)}.ics`);
    });
  }

  // 14. ICAL GENERATOR (RFC 5545)
  function generateICS(events) {
    let ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//EventKalender ODAS//DE\r\nCALSCALE:GREGORIAN\r\n";
    
    events.forEach(ev => {
      const startFormatted = formatICSDate(ev.datum_start);
      const endFormatted = formatICSDate(ev.datum_ende);
      const nowFormatted = formatICSDate(new Date().toISOString());

      ics += "BEGIN:VEVENT\r\n";
      ics += `UID:${ev.event_id}@odas-eventkalender.de\r\n`;
      ics += `DTSTAMP:${nowFormatted}\r\n`;
      
      const tzid = ev.zeitzone || "Europe/Berlin";
      ics += `DTSTART;TZID=${tzid}:${startFormatted}\r\n`;
      ics += `DTEND;TZID=${tzid}:${endFormatted}\r\n`;

      ics += `SUMMARY:${escapeICSString(ev.titel)}\r\n`;
      
      if (ev.beschreibung) {
        ics += `DESCRIPTION:${escapeICSString(ev.beschreibung)}\r\n`;
      }
      
      if (ev.ort_name) {
        const addressPart = ev.ort_adresse ? `, ${ev.ort_adresse}` : "";
        ics += `LOCATION:${escapeICSString(ev.ort_name + addressPart)}\r\n`;
      }
      
      if (ev.ort_lat && ev.ort_lon) {
        ics += `GEO:${ev.ort_lat};${ev.ort_lon}\r\n`;
      }
      
      if (ev.kategorie) {
        ics += `CATEGORIES:${escapeICSString(ev.kategorie)}\r\n`;
      }
      
      if (ev.url) {
        ics += `URL:${escapeICSString(ev.url)}\r\n`;
      }

      if (ev.wiederholung) {
        ics += `RRULE:${ev.wiederholung}\r\n`;
      }

      if (ev.veranstalter) {
        const mailto = ev.kontakt_email ? `:mailto:${ev.kontakt_email}` : "";
        ics += `ORGANIZER;CN=${escapeICSString(ev.veranstalter)}${mailto}\r\n`;
      }

      if (ev.status === "abgesagt") {
        ics += "STATUS:CANCELLED\r\n";
      } else {
        ics += "STATUS:CONFIRMED\r\n";
      }

      // Add attendees lines
      if (ev.teilnehmer) {
        const attendees = ev.teilnehmer.split(";").map(t => t.trim()).filter(Boolean);
        attendees.forEach(att => {
          ics += `ATTENDEE;CN=${escapeICSString(att)};ROLE=REQ-PARTICIPANT:mailto:noreply@odas-eventkalender.de\r\n`;
        });
      }

      ics += "END:VEVENT\r\n";
    });

    ics += "END:VCALENDAR";
    return ics;
  }

  function downloadICS(content, filename) {
    const blob = new Blob([content], { type: "text/calendar;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Helper functions
  function formatICSDate(dateStr) {
    // Converts e.g. "2026-05-22T18:30:00" or ISO format to "20260522T183000"
    if (!dateStr) return "";
    const clean = dateStr.replace(/[-:]/g, "");
    // Remove millisecond decimals and suffix Z if any, returning YYYYMMDDTHHMMSS
    const indexDot = clean.indexOf(".");
    if (indexDot !== -1) {
      return clean.substring(0, indexDot);
    }
    return clean.replace("Z", "");
  }

  function escapeICSString(str) {
    if (!str) return "";
    return str
      .replace(/\\/g, "\\\\")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "");
  }

  function getCategoryBadgeClass(kat) {
    const k = String(kat || "").trim().toLowerCase();
    if (k === "politik") return "politik";
    if (k === "kultur") return "kultur";
    if (k === "sport") return "sport";
    if (k === "bildung") return "bildung";
    if (k === "soziales") return "soziales";
    return "sonstiges";
  }

  function formatLocalDateString(date) {
    return date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }

  function formatEventTimeRange(startIso, endIso) {
    if (!startIso) return "";
    const startDate = new Date(startIso);
    const dateStr = formatLocalDateString(startDate);
    const startHrs = String(startDate.getHours()).padStart(2, "0");
    const startMins = String(startDate.getMinutes()).padStart(2, "0");
    
    if (!endIso || startIso === endIso) {
      return `${dateStr}, ${startHrs}:${startMins} Uhr`;
    }

    const endDate = new Date(endIso);
    const endHrs = String(endDate.getHours()).padStart(2, "0");
    const endMins = String(endDate.getMinutes()).padStart(2, "0");

    // Check if same day
    if (startIso.substring(0, 10) === endIso.substring(0, 10)) {
      return `${dateStr}, ${startHrs}:${startMins} – ${endHrs}:${endMins} Uhr`;
    }

    const endDateStr = formatLocalDateString(endDate);
    return `${dateStr}, ${startHrs}:${startMins} Uhr – ${endDateStr}, ${endHrs}:${endMins} Uhr`;
  }

  function slugify(text) {
    return String(text)
      .toLowerCase()
      .trim()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // Load status display helpers
  function showLoading() {
    const container = document.getElementById(`${rootId}-tab-content`);
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="spinner-border text-primary mb-3" role="status"></div>
          <div>Lade Veranstaltungsdaten...</div>
        </div>
      `;
    }
  }

  function showError(msg) {
    const container = document.getElementById(`${rootId}-tab-content`);
    if (container) {
      container.innerHTML = `
        <div class="alert alert-danger m-3" role="alert">
          <h5 class="alert-heading fw-bold">Fehler beim Laden</h5>
          <p class="mb-0">${escapeHtml(msg)}</p>
        </div>
      `;
    }
  }

  // 15. DYNAMIC SCRIPTS LOADING
  function loadLeaflet(callback) {
    if (window.L) {
      callback();
      return;
    }
    const link = document.createElement("link");
    link.id = "leaflet-css";
    link.rel = "stylesheet";
    link.href = "vendor/leaflet/leaflet.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.id = "leaflet-js";
    script.src = "vendor/leaflet/leaflet.js";
    script.async = true;
    script.onload = () => {
      // Load Leaflet marker cluster after core Leaflet
      const clusterLink = document.createElement("link");
      clusterLink.id = "leaflet-markercluster-css";
      clusterLink.rel = "stylesheet";
      clusterLink.href = "vendor/markercluster/MarkerCluster.css";
      document.head.appendChild(clusterLink);

      const clusterDefaultLink = document.createElement("link");
      clusterDefaultLink.id = "leaflet-markercluster-default-css";
      clusterDefaultLink.rel = "stylesheet";
      clusterDefaultLink.href = "vendor/markercluster/MarkerCluster.Default.css";
      document.head.appendChild(clusterDefaultLink);

      const clusterScript = document.createElement("script");
      clusterScript.id = "leaflet-markercluster-js";
      clusterScript.src = "vendor/markercluster/leaflet.markercluster.js";
      clusterScript.async = true;
      clusterScript.onload = callback;
      document.head.appendChild(clusterScript);
    };
    document.head.appendChild(script);
  }

  function loadChartJS(callback) {
    if (window.Chart) {
      callback();
      return;
    }
    const script = document.createElement("script");
    script.id = "chart-js";
    script.src = "vendor/chartjs/chart.umd.min.js";
    script.async = true;
    script.onload = callback;
    document.head.appendChild(script);
  }

  return null;
}

// ═══════════════════════════════════════════
// REQUIRED FUNCTION OUTSIDE app()
// ═══════════════════════════════════════════
function addToHead() {
  return;
}

function safeHttpUrl(value) {
  const s = String(value || "").trim();
  return /^https?:\/\//i.test(s) ? s : "";
}
