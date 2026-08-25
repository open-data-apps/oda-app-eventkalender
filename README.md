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

Die Formaterkennung und Normalisierung erfolgt vollautomatisch. Die App lädt ausschließlich
die konfigurierte Quelle. Bei einem Abruf- oder Formatfehler erscheint eine sichtbare
Fehlermeldung; es werden keine lokalen Ersatzdaten geladen.

### Mitgelieferter Referenzdatensatz

`assets/events.csv` enthält 20 frei erfundene Termine als maßgebliche Referenz zum
[Datensatz „Eventkalender“](https://open-data-musterstadt.ckan.de/dataset/kalender_demo).
Die öffentlich erreichbare Ressource ist die
[events.csv](https://open-data-musterstadt.ckan.de/dataset/33a51ed9-c76e-441f-b6e6-6c1bb55d4e8f/resource/36aa580e-0c46-4f76-bc95-fbba9a5c5fa3/download/events.csv).
`assets/events.ics` enthält dieselben Termine als iCalendar-Fassung. Veranstalter,
Kontaktadressen und Veranstaltungslinks verwenden ausschließlich `example.org`; die
Koordinaten dienen nur der Kartenansicht.

Die Referenzdateien sind kein Produktions-Fallback. Die CSV ist als Ressource im CKAN-
Datensatz veröffentlicht; die ICS-Datei bleibt als parallele Referenz- und Exportressource
im App-Paket enthalten.

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
1. Die Projektwurzel mit **Live Server** öffnen (Standardport 5500).
2. Die lokale `odas-config/config.json` lädt direkt die öffentliche
   [CKAN-Ressource](https://open-data-musterstadt.ckan.de/dataset/33a51ed9-c76e-441f-b6e6-6c1bb55d4e8f/resource/36aa580e-0c46-4f76-bc95-fbba9a5c5fa3/download/events.csv) (`proxyAktiv: "nein"`).
3. Die App unter `http://127.0.0.1:5500/app/` öffnen. Die aktuelle Generic-Base lädt die
   lokale Konfiguration unter localhost automatisch.

### Wichtige Dateien
| Pfad | Beschreibung |
| :--- | :--- |
| `app/app.js` | Kernanwendungslogik (Filterung, Normalisierung, Tabs, iCal-Generierung) |
| `app/app.css` | CSS-Designsystem (Responsive Grid, farbige Pins, Agenda-Elemente) |
| `app/app-base.js` | ODAS-Wrapper zum Laden der Konfiguration und Navigation |
| `app-package.json` | Anwendungsmetadaten und UI-Parameter-Definitionen für ODAS |
| `assets/schema.json` | Frictionless Data Schema der Event-Tabelle |
| `assets/events.csv` | Referenzdatensatz mit 20 fiktiven Terminen |
| `assets/events.ics` | Dieselben Termine als iCalendar-Ressource |
| `assets/odas-app-icon.svg` | Modern gestaltetes App-Icon (SVG) |

---

## Konfiguration (Instanz)
Folgende Parameter werden bei der Instanziierung der App im Open Data App Store eingestellt:

- `apiurls`: Array benannter Datenressourcen. Eintrag `events`: die URL zum JSON-, CSV- oder ICS-Endpunkt. In der ausgelieferten Konfiguration
  ist dies die öffentliche [events.csv-Ressource](https://open-data-musterstadt.ckan.de/dataset/33a51ed9-c76e-441f-b6e6-6c1bb55d4e8f/resource/36aa580e-0c46-4f76-bc95-fbba9a5c5fa3/download/events.csv).
- Die `apiurls.events`-URL ist vollständig und enthält bei Datastore-Abfragen bereits `resource_id` und `limit` (Standard „Eine Quelle = eine vollständige URL“).
- `standardKategorie`: Standard-Kategorievorwahl (z.B. `"alle"`).
- `karteZentrum`: Geokoordinaten für den Mittelpunkt der Karte (z.B. `"48.7396, 9.3097"`).
- `karteZoom`: Zoom-Stufe der Karte (z.B. `"12"`).
- `proxyAktiv`: Steuert, ob der integrierte CORS-Proxy genutzt wird (`"ja"` oder `"nein"`).
- `sprache`: Sprache der Oberfläche (`"de"`).
- `titel` / `seitentitel`: Angezeigter App-Titel und HTML-Title-Tag.

Die Paket-Defaults für `apiurls.events` und `urlDaten` zeigen auf den [Datensatz
„Eventkalender“](https://open-data-musterstadt.ckan.de/dataset/kalender_demo) und seine
[events.csv-Ressource](https://open-data-musterstadt.ckan.de/dataset/33a51ed9-c76e-441f-b6e6-6c1bb55d4e8f/resource/36aa580e-0c46-4f76-bc95-fbba9a5c5fa3/download/events.csv).
Die Referenzdateien im Paket bleiben für Offline-Tests und die Byte-Identitätsprüfung
erhalten, sind aber kein automatischer Fallback.

---

## Betriebsarten

Die App kann lokal, eigenstaendig hinter einem Traefik-Reverse-Proxy oder ueber den ODAS
betrieben werden.

### Datenabruf: `proxyAktiv`

| Wert   | Bedeutung                                                                   |
| ------ | --------------------------------------------------------------------------- |
| `nein` | Direkter Abruf der Daten-URL. Standard fuer Entwicklung und Standalone.      |
| `ja`   | Abruf ueber den ODAS-Proxy `…/odp-data`. Nur im ODAS-Live-System verfuegbar. |

Bei `nein` muss die Datenquelle CORS freigeben.

### Standalone-Betrieb

Voraussetzung: ein laufender Traefik mit dem externen Docker-Netzwerk `proxynet`,
dem EntryPoint `websecure` und dem Zertifikatsresolver `letsencrypt`.

1. In `docker-compose.standalone.yml` den Platzhalter `app1.example.com` durch den
   echten FQDN ersetzen.
2. In `odas-config/config.json` `proxyAktiv` auf `nein` belassen und `apiurls.events` auf eine
   CORS-fähige produktive Quelle setzen.
3. Starten:

```bash
STANDALONE=true make up
STANDALONE=true make logs
STANDALONE=true make down
```

Im Standalone-Betrieb entfaellt die lokale Portfreigabe; Traefik terminiert TLS und
leitet auf den internen Nginx-Port 80 weiter. Die Konfiguration wird aus derselben
`odas-config/config.json` gelesen wie in der Entwicklung und von Nginx unter `/config`
ausgeliefert.

### Beim Aufruf kontaktierte Drittanbieter

Beim Aufruf dieser App werden folgende externe Server kontaktiert:

- `tile.openstreetmap.org` — Kartenkacheln (OpenStreetMap)

Diese Anbieter bleiben auch im Standalone-Betrieb extern; ein vollständig autarker Betrieb ohne Internetzugang ist derzeit nicht möglich. Alle Programmbibliotheken werden lokal aus `app/vendor/` ausgeliefert und nicht mehr extern geladen.

### Auslieferung an den ODAS

`make zip` erzeugt das Liefer-ZIP mit `app/`, `assets/`, `app-package.json` und
`CHANGELOG.md`. Die Infrastrukturdateien (`Dockerfile`, `docker-compose*.yml`,
`nginx.conf`, `Makefile`) sind nicht Teil der Auslieferung. Das ZIP ist ein Bauartefakt und wird nicht mitversioniert, sondern bei Bedarf mit `make zip` erzeugt.

## Autor
© 2026, Ondics GmbH
