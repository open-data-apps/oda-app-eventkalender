# Changelog

## 1.7.0 - 2026-07-31
- CHG: toter Konfigurationsschlüssel lizenz entfernt (F-17)
- CHG: brandingCSS und brandingCSSFile als Base-Abhängigkeiten deklariert und lokal gespiegelt (F-17)
- CHG: Groß-/Kleinschreibung der Config-Schlüssel vereinheitlicht, Fallback-Ketten entfernt (F-17)
- CHG: urlDaten deklariert; der Schlüssel war bisher nur lokal vorhanden (F-17)
- CHG: dropdown-Default auf Feldebene verschoben statt in format (F-18)
- CHG: assets/schema.json auf ein flaches Frictionless Table Schema gebracht (F-20)

## 1.6.0 - 2026-07-30

- **FIX:** Laufzeitfehler nach dem Laden der Konfiguration werden jetzt sichtbar gemeldet; `handleRouting()` wird `await`et und besitzt einen Fehlerpfad. Bisher blieb die Seite bei einem Fehler im Seitenaufbau stumm leer
- **FIX:** `getConfigUrl()` schneidet bei einer URL ohne abschliessenden Schraegstrich nicht mehr das letzte Verzeichnis ab; die Konfiguration wird auch unter `.../app` gefunden
- **FIX:** Klick auf einen Hash-Link, der bereits die aktive Seite bezeichnet, rendert die Seite neu (`setupSamePageLinks()`) - das Logo fuehrt damit aus Unteransichten zurueck zur Startseite
- **ENH:** `app/app-base.js` ist wieder byte-identisch zum Template `oda-generic` 1.4.0; app-spezifisches Aufraeumen laeuft ueber den neuen Hook `onPageLeave(page)` in `app/app.js`
- **FIX:** Der Pfad zur Branding-CSS wird jetzt relativ zum App-Verzeichnis aufgeloest (`../assets/branding.css`); bisher wurde die Datei beim lokalen Test unterhalb von `app/` gesucht und deshalb nicht gefunden
- **FIX:** Ein Klick auf einen Eintrag in der Liste zeigt die Details jetzt auch bei CSV- und ICS-Quellen an. Der Lookup verglich die ID der angeklickten Zeile (immer ein String) strikt mit `event_id` aus den Daten; CSV und ICS liefern dort einen String, JSON eine Zahl, sodass `"1" === 1` fehlschlug und stumm der Leerzustand „Keine Veranstaltung ausgewaehlt“ stehen blieb. `event_id` wird jetzt bei der Normalisierung einheitlich als String gefuehrt

## 1.5.0 - 2026-07-24

- **FIX:** Laufzeit-Fehlermeldung wird vor der Anzeige HTML-maskiert (`escapeHtmlForBase`); ein Fehlertext kann kein Markup mehr in die Seite einschleusen (XSS)
- **FIX:** Startseiten-Renderer wird nun `await`et; bei asynchronen Apps erscheint kein kurzzeitiges `[object Promise]` in `#main-content`

## 1.4.0 - 2026-07-23

- **ENH:** Datenabruf auf den Schalter `proxyAktiv` umgestellt; direkte Abrufe sind der Standard, der ODAS-Proxy wird nur noch bei `ja` verwendet
- **ENH:** Einfachen Standalone-Betrieb hinter Traefik mit derselben `odas-config/config.json` wie in der Entwicklung ergänzt
- **ENH:** Traefik-Anbindung auf das externe Netzwerk `proxynet`, den EntryPoint `websecure` und den Zertifikatsresolver `letsencrypt` festgelegt
- **FIX:** Proxy-Basispfad funktioniert jetzt auch bei URLs mit `index.html`; der Ziel-Pfad wird URL-kodiert
- **FIX:** Inline-PROXY_AKTIV-Logik samt localhost-Sonderfall durch die kanonischen Helper ersetzt
- **DOC:** Start über `STANDALONE=true make up` dokumentiert

## 16.06.2026 (Version 1.3.0)

- ENH: Datenquellen-Hinweis mit klickbaren Links zum Open Data Portal ergänzt.
- ENH: Weiterführende Links durch datenquellen-relevante Links ersetzt.
- ENH: Beschreibung mit Datenquellen-Links angereichert.
- ENH: Design der Methodikbox und Weitere-Infos-Sektion an App-Designsprache angepasst (Cards, Typografie).
- ENH: KPI-Erklärtexte nur nach Klick auf Info-Icon (ⓘ) ausklappbar.

## 16.06.2026 (Version 1.2.0)

- ENH: Methodikbox (ausklappbar) mit Datenquelle-Hinweis und Datenstand ergänzt (`datenquelleHinweis`, `datenStand`).
- ENH: KPI-Erklärungstexte unter den Kennzahlen ergänzt (`kpiKontext1`–`kpiKontext5`).

## 16.06.2026 (Version 1.1.0)

- ENH: Schale-4-Verständlichkeit ergänzt – „Für wen ist diese App?"-Block in Beschreibung und README.
- ENH: Konfigurierbarer Abschnitt „Weitere Informationen" mit weiterführenden Links (neues Feld `weiterfuehrendeLinks`, leer = ausgeblendet).

## 22.05.2026 (Version 1.0.0)

- Initial release of the EventKalender ODAS App.
- Implemented responsive agenda view (Ablaufplan) with local date formatting and "Heute" separator.
- Added Leaflet.js-based map view with custom category-colored marker pins and marker clustering.
- Added grouped participant view with toggleable collapsible details.
- Added statistics view powered by Chart.js (monthly breakdown stacked bar chart and category doughnut chart).
- Built RFC 5545-compliant iCal export (.ics) for single events and filtered event listings.
- Integrated ODAS proxy mapping and v1 JSON package specifications.
