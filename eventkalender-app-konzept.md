# EventKalender – ODAS App Konzept

**App-Name:** EventKalender  
**Version:** 1.0  
**Zielgruppe:** Institutionen, Städte und Kommunen  
**Technologie:** Vanilla JS, Bootstrap 5.3, Leaflet.js, Chart.js  

---

## 1. Zielsetzung

Die App „EventKalender" zeigt öffentliche Veranstaltungsdaten aus einem CKAN Datastore (CSV) als interaktiven Kalender an. Kommunen und Institutionen können damit Events wie Stadtratssitzungen, Bürgermeetings, Stadtfeste oder Kulturveranstaltungen strukturiert publizieren.

Die App unterstützt **mehrere Eingabeformate** und bietet einen **iCal-Export**, sodass Bürger und Mitarbeiter Events direkt in Outlook, Google Calendar oder Apple Calendar abonnieren können.

---

## 2. Datenbasis

### 2.1 CKAN Konfiguration

```json
{
  "apiurl": "https://open-data-musterstadt.ckan.de/dataset/33a51ed9-c76e-441f-b6e6-6c1bb55d4e8f/resource/36aa580e-0c46-4f76-bc95-fbba9a5c5fa3/download/events.csv",
  "resourceId": "36aa580e-0c46-4f76-bc95-fbba9a5c5fa3",
  "titel": "EventKalender",
  "maxRecords": 1000
}
```

Die ausgelieferte App verwendet keinen Mock-Fallback. `apiurl` bezeichnet immer die
maßgebliche konfigurierte Quelle und zeigt auf die [events.csv-Ressource](https://open-data-musterstadt.ckan.de/dataset/33a51ed9-c76e-441f-b6e6-6c1bb55d4e8f/resource/36aa580e-0c46-4f76-bc95-fbba9a5c5fa3/download/events.csv) im [Datensatz „Eventkalender“](https://open-data-musterstadt.ckan.de/dataset/kalender_demo) des [Open Data Portals Musterstadt](https://open-data-musterstadt.ckan.de). `resourceId` bleibt für CKAN-Kompatibilität erhalten; bei direkten CSV-, ICS- oder JSON-URLs wird sie nicht an die URL angehängt. Eine leere, fehlerhafte oder nicht erkennbare
Antwort wird als sichtbarer Fehlerzustand angezeigt.

### 2.2 Unterstützte Eingabeformate

| Format | Standard | Dateiendung | Verwendung |
|--------|----------|-------------|------------|
| **CSV (primär)** | ISO 8601 Datum, WGS84 Koordinaten | `.csv` | CKAN Datastore, filterbar per API |
| **iCalendar** | RFC 5545 | `.ics` | Import aus Outlook/Google Cal via Datei-Upload |
| **JSON/jCal** | RFC 7265 | `.json` | Maschinenlesbar, API-Feeds |

> **Strategie:** CSV ist das primäre Format im CKAN Datastore (direkt filterbar über `datastore_search`). iCal (.ics) wird als **Export-Format** generiert, sodass Nutzer Events als Abo-Feed in ihren Kalender importieren können. Ein optionaler `.ics`-Datei-Upload ermöglicht das direkte Einlesen externer Kalender.

### 2.3 CSV-Feldschema (CKAN Datastore)

Das Schema ist so gewählt, dass jedes Feld direkt auf eine iCalendar-Property (RFC 5545) gemappt werden kann:

| CSV-Feld | iCal-Property | Typ | Pflicht | Beispiel |
|----------|--------------|-----|---------|---------|
| `event_id` | `UID` | Integer | ✅ | `42` |
| `titel` | `SUMMARY` | Text | ✅ | `Stadtratssitzung` |
| `beschreibung` | `DESCRIPTION` | Text | – | `Öffentliche Sitzung des Stadtrats` |
| `datum_start` | `DTSTART` | `YYYY-MM-DDTHH:MM:SS` | ✅ | `2024-06-15T10:00:00` |
| `datum_ende` | `DTEND` | `YYYY-MM-DDTHH:MM:SS` | ✅ | `2024-06-15T12:00:00` |
| `zeitzone` | `TZID` | IANA Timezone | – | `Europe/Berlin` |
| `ort_name` | `LOCATION` (Teil 1) | Text | – | `Rathaus Saal A` |
| `ort_adresse` | `LOCATION` (Teil 2) | Text | – | `Marktplatz 1, 73728 Esslingen` |
| `ort_lat` | `GEO` (lat) | Dezimal WGS84 | – | `48.7396` |
| `ort_lon` | `GEO` (lon) | Dezimal WGS84 | – | `9.3097` |
| `kategorie` | `CATEGORIES` | Text | – | `Politik` |
| `teilnehmer` | `ATTENDEE` (`;`-getrennt) | Text | – | `Stadtrat;Bürgermeister;Presse` |
| `veranstalter` | `ORGANIZER` | Text | – | `Stadt Esslingen` |
| `kontakt_email` | `ORGANIZER` (mailto) | E-Mail | – | `events@esslingen.de` |
| `url` | `URL` | URL | – | `https://esslingen.de/events/1` |
| `status` | `STATUS` | Text-Enum | – | `geplant` / `abgesagt` / `abgeschlossen` |
| `wiederholung` | `RRULE` | iCal RRULE-String | – | `FREQ=WEEKLY;BYDAY=MO` |

---

## 3. App-Konzept

### 3.1 Layout-Struktur

```
┌─────────────────────────────────────────────────────┐
│  HEADER: Titel + iCal-Export-Button + Filter-Toggle │
├──────────┬──────────┬──────────┬────────┬───────────┤
│ KPI:     │ KPI:     │ KPI:     │ KPI:   │ KPI:      │
│ Heute    │ Nächstes │ Diese    │ Kateg. │ Veranst.  │
│ Events   │ Event    │ Woche    │ Anzahl │ Anzahl    │
├──────────┴──────────┴──────────┴────────┴───────────┤
│  FILTER-LEISTE: Zeitraum | Kategorie | Veranstalter │
│                 Freitext-Suche | Status             │
├────────────────────────┬────────────────────────────┤
│                        │                            │
│  TABS:                 │                            │
│  [Ablaufplan] [Karte]  │   DETAILANSICHT            │
│  [Teilnehmer] [Chart]  │   (bei Klick auf Event)    │
│                        │                            │
│  [Aktiver Tab-Inhalt]  │                            │
│                        │                            │
└────────────────────────┴────────────────────────────┘
```

### 3.2 KPI-Kacheln (oben, 5 Stück)

1. **Events heute** – Anzahl der Veranstaltungen am aktuellen Tag
2. **Nächstes Event** – Titel + Countdown in Stunden/Tagen
3. **Events diese Woche** – Anzahl der Events in den nächsten 7 Tagen
4. **Kategorien** – Anzahl verschiedener Kategorien im Datensatz
5. **Veranstalter** – Anzahl verschiedener Veranstalter

### 3.3 Filter-Leiste

| Filter | Typ | Feld | CKAN-API-Parameter |
|--------|-----|------|-------------------|
| Von-Datum | Date-Input | `datum_start` | `filters` + Range-Query |
| Bis-Datum | Date-Input | `datum_ende` | `filters` + Range-Query |
| Kategorie | Dropdown (dynamisch) | `kategorie` | `filters={"kategorie":"..."}` |
| Veranstalter | Dropdown (dynamisch) | `veranstalter` | `filters={"veranstalter":"..."}` |
| Status | Dropdown | `status` | `filters={"status":"..."}` |
| Freitext | Text-Input | `titel`, `beschreibung` | `q=...` |

### 3.4 Tab 1: Ablaufplan („Was kommt als nächstes")

- Chronologisch sortierte Listenansicht **ab heute** (`datum_start >= heute`)
- Jede Zeile zeigt: **Datum/Uhrzeit | Kategorie-Badge (farbig) | Titel | Ort | Veranstalter**
- Wiederholende Events (`wiederholung`-Feld nicht leer) werden mit einem 🔄-Icon markiert
- Abgesagte Events (`status = abgesagt`) werden durchgestrichen in grau dargestellt
- Klick auf einen Eintrag öffnet die Detailansicht rechts
- **Heute-Trennlinie**: Roter horizontaler Divider trennt vergangene von zukünftigen Events
- Paginierung: 20 Einträge pro Seite, Vor/Zurück-Buttons

### 3.5 Tab 2: Kartenansicht (Leaflet.js)

- OpenStreetMap als Basiskarte
- **Marker-Pins** an `ort_lat` / `ort_lon`, nur wenn beide Felder vorhanden
- **Farb-Kodierung der Pins nach Kategorie** (Legende unten rechts)
- **Popup bei Klick** auf Pin:
  ```
  [Kategorie-Badge]
  Titel des Events
  📅 15.06.2024, 10:00–12:00 Uhr
  📍 Rathaus Saal A, Marktplatz 1
  👥 Stadtrat; Bürgermeister
  [Details anzeigen →]
  ```
- **Cluster-Marker** bei vielen Events an ähnlichem Ort (Leaflet.markercluster)
- Filter der Filter-Leiste wirken auf die Karte: nur gefilterte Events werden angezeigt
- Leaflet wird **dynamisch per Script-Tag** geladen (nicht über `addToHead`)

**Leaflet-Ladelogik:**
```javascript
function loadLeaflet(callback) {
  if (window.L) { callback(); return; }
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  script.onload = callback;
  document.head.appendChild(script);
}
```

### 3.6 Tab 3: Teilnehmer-Ansicht

- Tabelle: **Teilnehmer | Event-Titel | Datum | Uhrzeit | Ort**
- Erzeugt durch Entfalten des `teilnehmer`-Feldes (Split nach `;`)
- Filterbar: Freitext-Suche nach Teilnehmername
- Sortierbar: nach Datum oder Name (Klick auf Spalten-Header)
- Zeigt: Pro Teilnehmer alle zugehörigen Events in einer gruppierten Ansicht

### 3.7 Tab 4: Chart (Events pro Kategorie/Monat)

- **Balkendiagramm** (Chart.js): Events pro Monat, aufgeteilt nach Kategorie (gestapelt)
- **Doughnut-Chart**: Verteilung der Events nach Kategorie (Überblick)
- Chart.js wird dynamisch geladen

---

## 4. iCal-Export (Kernfeature)

### 4.1 Gesamter Export

- Button im Header: **„📅 Als .ics exportieren"**
- Generiert einen RFC-5545-konformen iCalendar-String aus allen gefilterten Events
- Download als Blob: `veranstaltungen.ics`

### 4.2 Einzel-Event-Export

- In der Detailansicht: **„📅 In Kalender speichern"**
- Erzeugt eine einzelne `.ics`-Datei für dieses Event
- Funktioniert in Outlook, Google Calendar und Apple Calendar

### 4.3 iCal-Mapping CSV → .ics

```
event_id       → UID:[event_id]@events.example.org
titel          → SUMMARY:[titel]
beschreibung   → DESCRIPTION:[beschreibung]
datum_start    → DTSTART;TZID=[zeitzone]:[datum_start formatted]
datum_ende     → DTEND;TZID=[zeitzone]:[datum_ende formatted]
ort_name +     → LOCATION:[ort_name]\, [ort_adresse]
ort_adresse
ort_lat/lon    → GEO:[ort_lat];[ort_lon]
kategorie      → CATEGORIES:[kategorie]
teilnehmer     → ATTENDEE (je Teilnehmer eine Zeile)
veranstalter   → ORGANIZER;CN=[veranstalter]:mailto:[kontakt_email]
url            → URL:[url]
status         → STATUS:CONFIRMED / CANCELLED / COMPLETED
wiederholung   → RRULE:[wiederholung]
```

### 4.4 iCal-Generator Pseudocode

```javascript
function generateICS(events) {
  let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//EventKalender ODAS//DE\r\n';
  events.forEach(ev => {
    ics += 'BEGIN:VEVENT\r\n';
    ics += `UID:${ev.event_id}@odas-eventkalender.de\r\n`;
    ics += `SUMMARY:${ev.titel}\r\n`;
    ics += `DTSTART;TZID=${ev.zeitzone || 'Europe/Berlin'}:${formatICSDate(ev.datum_start)}\r\n`;
    ics += `DTEND;TZID=${ev.zeitzone || 'Europe/Berlin'}:${formatICSDate(ev.datum_ende)}\r\n`;
    if (ev.beschreibung) ics += `DESCRIPTION:${ev.beschreibung}\r\n`;
    if (ev.ort_name)     ics += `LOCATION:${ev.ort_name}, ${ev.ort_adresse}\r\n`;
    if (ev.ort_lat && ev.ort_lon) ics += `GEO:${ev.ort_lat};${ev.ort_lon}\r\n`;
    if (ev.kategorie)    ics += `CATEGORIES:${ev.kategorie}\r\n`;
    if (ev.url)          ics += `URL:${ev.url}\r\n`;
    if (ev.wiederholung) ics += `RRULE:${ev.wiederholung}\r\n`;
    if (ev.status === 'abgesagt') ics += 'STATUS:CANCELLED\r\n';
    ics += 'END:VEVENT\r\n';
  });
  ics += 'END:VCALENDAR';
  return ics;
}
```

---

## 5. CKAN API Logik

### 5.1 Basis-Abfrage

```
GET {apiurl}?resource_id={resourceId}&limit=100&offset=0
```

### 5.2 Gefilterte Abfrage

```
GET {apiurl}?resource_id={resourceId}&filters={"kategorie":"Politik"}&limit=100
```

### 5.3 Freitext-Suche

```
GET {apiurl}?resource_id={resourceId}&q=Stadtrat&limit=100
```

### 5.4 Paginierung

- `result.total` → Gesamtanzahl
- `result.records` → Aktuelle Seite
- Offset: `(aktuelleSeite - 1) * limit`

---

## 6. app.js Struktur

```javascript
// ═══════════════════════════════════════════
// ODAS EventKalender - app.js
// ═══════════════════════════════════════════

function app(configdata, enclosingHtmlDivElement) {

  // 1. KONFIGURATION
  const API_URL     = configdata.apiurl;
  const RESOURCE_ID = configdata.resourceId;
  const LIMIT       = 100;

  // 2. STATE
  let allEvents     = [];
  let filteredEvents = [];
  let currentPage   = 1;
  let activeTab     = 'ablaufplan';
  let leafletMap    = null;
  let chartInstance = null;
  let filters = { von: '', bis: '', kategorie: '', veranstalter: '', status: '', q: '' };

  // 3. INIT
  renderSkeleton();
  loadAllData();

  // 4. DATEN LADEN (mit Paginierung)
  async function loadAllData() { ... }

  // 5. RENDER FUNKTIONEN
  function renderKPIs()        { ... }
  function renderFilterBar()   { ... }
  function renderAblaufplan()  { ... }
  function renderKarte()       { ... } // ruft loadLeaflet() auf
  function renderTeilnehmer()  { ... }
  function renderChart()       { ... }
  function renderDetail(event) { ... }

  // 6. HILFSFUNKTIONEN
  function loadLeaflet(callback) { ... }
  function loadChartJS(callback) { ... }
  function applyFilters()        { ... }
  function formatDate(isoStr)    { ... }
  function formatICSDate(isoStr) { ... }
  function getCategoryColor(kat) { ... }

  // 7. ICAL EXPORT
  function generateICS(events)   { ... }
  function downloadICS(content, filename) { ... }

  return null;
}

// ═══════════════════════════════════════════
// AUSSERHALB von app() – Pflichtposition!
// ═══════════════════════════════════════════
function addToHead() {
  return;
}
```

---

## 7. Kategorie-Farbschema

| Kategorie | Bootstrap-Klasse | Hex-Farbe |
|-----------|-----------------|-----------|
| Politik | `badge bg-primary` | `#0d6efd` |
| Kultur | `badge bg-success` | `#198754` |
| Sport | `badge bg-warning text-dark` | `#ffc107` |
| Bildung | `badge bg-info text-dark` | `#0dcaf0` |
| Soziales | `badge bg-danger` | `#dc3545` |
| Sonstiges | `badge bg-secondary` | `#6c757d` |

---

## 8. Detailansicht (Sidepanel)

Beim Klick auf ein Event (Ablaufplan oder Kartenpin) öffnet rechts ein Sidepanel:

```
┌─────────────────────────────────────┐
│ [Kategorie-Badge]   [✕ Schließen]  │
│                                     │
│ # Titel des Events                  │
│                                     │
│ 📅 Datum: 15.06.2024               │
│ ⏰ Uhrzeit: 10:00 – 12:00 Uhr      │
│ 📍 Rathaus Saal A                   │
│    Marktplatz 1, 73728 Esslingen    │
│ 🏢 Veranstalter: Stadt Esslingen    │
│ 👥 Teilnehmer:                      │
│    • Stadtrat                       │
│    • Bürgermeister                  │
│    • Presse                         │
│                                     │
│ ℹ️ Beschreibung:                    │
│ Lorem ipsum...                      │
│                                     │
│ 🔗 Mehr erfahren →                  │
│                                     │
│ [📅 In Kalender speichern (.ics)]   │
└─────────────────────────────────────┘
```

---

## 9. Fehlerzustände

| Zustand | Anzeige |
|---------|---------|
| Keine Events gefunden | Leere-Zustand-Karte mit Hinweis „Keine Veranstaltungen für diesen Filter" |
| API nicht erreichbar | Fehlermeldung mit `alert-danger` Bootstrap-Komponente |
| Kein `ort_lat`/`ort_lon` | Event wird in Ablaufplan und Tabelle gezeigt, aber nicht auf der Karte |
| `datum_start` fehlt | Event wird übersprungen, Konsolen-Warning |
| `teilnehmer` leer | Teilnehmer-Tab zeigt „Keine Teilnehmer angegeben" |

---

## 10. config.json Beispiel

```json
{
  "apiurl": "https://open-data-musterstadt.ckan.de/dataset/33a51ed9-c76e-441f-b6e6-6c1bb55d4e8f/resource/36aa580e-0c46-4f76-bc95-fbba9a5c5fa3/download/events.csv",
  "resourceId": "36aa580e-0c46-4f76-bc95-fbba9a5c5fa3",
  "titel": "Veranstaltungskalender Esslingen",
  "maxRecords": 1000,
  "standardKategorie": "alle",
  "karteZentrum": [48.7396, 9.3097],
  "karteZoom": 12
}
```

---

## 11. Checkliste vor Upload (ODAS)

- [ ] `addToHead()` ist **außerhalb** von `app()` definiert (ganz unten in der Datei)
- [ ] Leaflet wird **dynamisch** geladen (über `loadLeaflet()`-Funktion, nicht `addToHead`)
- [ ] Chart.js wird **dynamisch** geladen (über `loadChartJS()`-Funktion)
- [ ] CKAN API WHERE-Strings mit **einfachen Anführungszeichen**: `where=feld='wert'`
- [ ] iCal-Zeilenenden sind `\r\n` (CRLF, RFC 5545 Pflicht)
- [ ] Alle `datum_start`-Werte werden auf ISO 8601 geprüft vor Verarbeitung
- [ ] `branding.css` 404 lokal → ignorieren, im ODAS-Betrieb vorhanden
- [ ] `integrity`-Hash bei dynamisch geladenem Leaflet **weglassen**
- [ ] App unter `http://127.0.0.1:5500/app/` lokal getestet
