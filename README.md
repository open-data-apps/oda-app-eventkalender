# EventKalender App

Die App **EventKalender** bietet eine interaktive Visualisierung von kommunalen Terminen und öffentlichen Veranstaltungen.

Die App ist für die Verwendung im [Open Data App Store](https://open-data-app-store.de/) gemacht und entspricht der [Open Data App Spezifikation](https://open-data-apps.github.io/open-data-app-docs/open-data-app-spezifikation/).

Mehr zu Open Data Apps unter https://github.com/open-data-apps

---

## Funktionen
Die App ist eine Single Page Application (SPA) mit:

- **Logo-Anzeige** (flexibel einstellbar via Instanz-Konfiguration)
- **Burger-Menü** mit Seiten für *Impressum*, *Datenschutz*, *Über diese App*, *Kontakt* und die *Startseite* (Hauptinhalt)
- **Premium CSS Branding** mit moderner Typografie und ansprechenden Interaktionen
- **Inhaltsbereich (Event-Dashboard)**
- **Fußzeile**

Die App lädt Konfigurationsdaten dynamisch und bietet folgende Kernfunktionen:

- **Dashboard & Kennzahlen**:
  - **Heute**: Anzahl der heute aktiven Veranstaltungen.
  - **Nächstes Event**: Titel und Countdown (z.B. "In 3 Tagen" oder "In 5 Std.") bis zum nächsten anstehenden Termin.
  - **Diese Woche**: Anzahl kommender Termine in den nächsten 7 Tagen.
  - **Kategorien**: Gesamtzahl der verschiedenen Sparten im Programm.
  - **Veranstalter**: Anzahl der aktiven Organisationen.
- **Filter-Steuerung**:
  - Zeitraum-Begrenzung (Von/Bis).
  - Kategorie-Auswahl (Dropdown, befüllt sich dynamisch aus den geladenen Daten).
  - Veranstalter-Auswahl (Dropdown, befüllt sich dynamisch aus den geladenen Daten).
  - Status-Filter (Geplant, Abgesagt, Abgeschlossen).
  - Freitextsuche über Titel, Beschreibung und Ort.
- **Ansichten (4 Tabs)**:
  - 🗓️ **Ablaufplan**: Chronologische Agenda-Liste mit einer roten **Heute-Trennlinie**, die vergangene von zukünftigen Terminen trennt. Zeigt Symbole für wiederkehrende Events und streicht abgesagte Veranstaltungen durch. Mit seitenweiser Blätterfunktion (Pagination, 20 Einträge pro Seite).
  - 🗺️ **Kartenansicht**: Interaktive Leaflet.js Karte mit OpenStreetMap-Hintergrund. Die Pins sind nach Kategorie farblich markiert (z.B. Blau für Politik, Grün für Kultur, Gelb für Sport, etc.) und werden bei hoher Dichte automatisch zusammengefasst (Marker Clustering). Ein Klick öffnet ein Popup mit Details und einem Schnellzugriff.
  - 👥 **Teilnehmer**: Gruppiert alle Veranstaltungen nach den teilnehmenden Personen. Die Liste ist alphabetisch sortiert. Per Klick lässt sich ein Bereich ausklappen, der alle zugehörigen Events des Teilnehmers chronologisch auflistet.
  - 📊 **Statistiken**: Grafische Auswertungen über Chart.js:
    - Stacked Bar Chart der monatlichen Event-Entwicklung gruppiert nach Kategorien.
    - Doughnut Chart der prozentualen Verteilung der Veranstaltungskategorien.
- **Detail-Panel (Rechte Spalte)**:
  - Zeigt alle Detail-Informationen eines angeklickten Events (Titel, Status mit Warnhinweis bei Absage, Datum, Uhrzeit inkl. Zeitzonen, Veranstaltungsort mit Adresse, Kontakt-E-Mail und Beschreibung).
  - **iCal-Export (.ics)** für die Übernahme des Einzeltermins in Outlook, Google Calendar, Apple Calendar o.ä.
- **Massen-Export**:
  - Button "Alle exportieren (.ics)" im Header, um alle aktuell gefilterten Events gesammelt als eine `.ics`-Datei herunterzuladen (RFC 5545-konform).

---

## Für wen ist diese App?

Diese App richtet sich an Bürgerinnen und Bürger in Esslingen sowie an die Stadtverwaltung. Voraussetzung ist kein spezielles Datenwissen – wer wissen möchte, welche Veranstaltungen anstehen, kann die App direkt nutzen.

---

## Datenformat
Die App unterstützt sowohl **JSON** als auch **CSV** als Datenquelle:

- **JSON**: API-Endpunkt, der eine CKAN-Datastore-Struktur (`result.records`) oder ein direktes Array von Objekten liefert.
- **CSV**: Komma- oder Semikolon-separierte CSV-Daten.

Die Formaterkennung und Normalisierung erfolgt vollautomatisch.

---

## Kompatible Datensätze
Die App arbeitet standardmäßig mit den folgenden Tabellenspalten (im Datastore bzw. in der CSV):

| Feldname | Typ | Beschreibung | Dortmund-Beispiel |
| :--- | :--- | :--- | :--- |
| `event_id` | `integer` | Eindeutige ID der Veranstaltung | `id` |
| `titel` | `string` | Titel/Zusammenfassung | `summary` / `title` |
| `beschreibung` | `string` | Ausführliche Beschreibung | `description` |
| `datum_start` | `string` (date-time) | Startzeitpunkt nach ISO 8601 | `dtstart` / `start` |
| `datum_ende` | `string` (date-time) | Endzeitpunkt nach ISO 8601 | `dtend` / `end` |
| `zeitzone` | `string` | IANA Zeitzonen-Name | `tzid` |
| `ort_name` | `string` | Name des Veranstaltungsortes | `location` / `ort` |
| `ort_adresse` | `string` | Physische Adresse | `adresse` |
| `ort_lat` | `number` | Breitengrad (Latitude) für Karte | `latitude` / `ort_lat` |
| `ort_lon` | `number` | Längengrad (Longitude) für Karte | `longitude` / `ort_lon` |
| `kategorie` | `string` | Einordnung (Politik, Kultur, Sport, Bildung, Soziales, Sonstiges) | `categories` |
| `teilnehmer` | `string` | Semikolon-separierte Teilnehmerliste | `attendee` |
| `veranstalter` | `string` | Name der Organisation | `organizer` |
| `kontakt_email` | `string` | E-Mail-Adresse für Rückfragen | `organizer_email` |
| `url` | `string` | Link zur Veranstaltungs-Webseite | `link` |
| `status` | `string` | Status: `geplant`, `abgesagt`, `abgeschlossen` | `status` |
| `wiederholung` | `string` | iCalendar RRULE-Wiederholungsregel | `rrule` |

---

## Entwicklung und lokales Testen

### Systemvoraussetzungen
- Docker / Docker Compose (optional)
- Node.js (v18+) oder Python (v3+) zum Hosten des Servers (z.B. VS Code Live Server)
- Make (für ZIP-Export)

### Lokales Starten via Live Server (Standard)
1. Die App wird direkt aus dem `app/`-Verzeichnis heraus gestartet (z.B. mittels des VS Code Add-ons **Live Server** auf Port 5501).
2. Die Datei `config.json` unter `/odas-config/config.json` stellt die lokale Konfiguration bereit, die auf die Mock-Datenbank zeigt.
3. Zum lokalen Testen muss in der Funktion `getConfigUrl()` in `app/app-base.js` das Umschalten auf die lokale Konfigurationsdatei einkommentiert sein:
   ```javascript
   if (["127.0.0.1", "localhost"].includes(url.hostname)) {
     configUrl = "../odas-config/config.json";
   }
   ```
4. Der Server stellt die Anwendung unter `http://127.0.0.1:5501/app/` bereit.

### Wichtige Dateien
| Pfad | Beschreibung |
| :--- | :--- |
| `app/app.js` | Kernanwendungslogik (Filterung, Normalisierung, Tabs, iCal-Generierung) |
| `app/app.css` | CSS-Designsystem (Responsive Grid, farbige Pins, Agenda-Elemente) |
| `app/app-base.js` | ODAS-Wrapper zum Laden der Konfiguration und Navigation |
| `app-package.json` | Anwendungsmetadaten und UI-Parameter-Definitionen für ODAS |
| `assets/schema.json` | Frictionless Data Schema der Event-Tabelle |
| `assets/events-mock.json` | Repräsentativer Testdatensatz mit 15 Demoterminen |
| `assets/odas-app-icon.svg` | Modern gestaltetes App-Icon (SVG) |

---

## Konfiguration (Instanz)
Folgende Parameter werden bei der Instanziierung der App im Open Data App Store eingestellt:

- `apiurl`: Die URL zum JSON- bzw. CSV-Endpunkt (für lokale Tests `../assets/events-mock.json`).
- `resourceId`: Die Ressourcen-ID für Datastore-Abfragen.
- `maxRecords`: Die Begrenzung der maximal geladenen Datensätze (z.B. `"1000"`).
- `standardKategorie`: Standard-Kategorievorwahl (z.B. `"alle"`).
- `karteZentrum`: Geokoordinaten für den Mittelpunkt der Karte (z.B. `"48.7396, 9.3097"`).
- `karteZoom`: Zoom-Stufe der Karte (z.B. `"12"`).
- `proxyAktiv`: Steuert, ob der integrierte CORS-Proxy genutzt wird (`"ja"` oder `"nein"`).
- `sprache`: Sprache der Oberfläche (`"de"`).
- `titel` / `seitentitel`: Angezeigter App-Titel und HTML-Title-Tag.

---

## Autor
© 2026, Ondics GmbH
