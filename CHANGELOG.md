# Changelog


## 1.24.0 - 2026-08-12
- FIX: `app/index.html` auf den Template-Stand (F-47): Datei byte-gleich aus `oda-generic` übernommen — gültiges HTML, deutsche ARIA-Labels, Footer im Body; Titel und Fußzeile bleiben Platzhalter und werden zur Laufzeit aus der Instanz-Config überschrieben

## 1.23.0 - 2026-08-12
- FIX: Widersprüchlichen Datenschutzsatz „Alle Abfragen erfolgen anonym über den Server." aus Datenschutz-Default und lokalem Mirror entfernt — die offene Offenlegung der an Drittanbieter übertragenen Daten bleibt stehen (F-53)

## 1.22.0 - 2026-08-11
- FIX: Laufzeitressourcen beim Seitenwechsel freigeben (F-43): neuer Top-Level-Hook `onPageLeave(page)`, der je Instanz die Leaflet-Karte entfernt und die beiden Chart.js-Instanzen (Balken/Donut) zerstört; das `disposed`-Flag macht späte Async-Renders (nach `loadLeaflet`/`loadChartJS`/Datenabruf) wirkungslos; zusätzlich wird die Karte beim Re-Render des Karte-Tabs vor dem `innerHTML`-Austausch entfernt (bisher blieb die Leaflet-Instanz mit Listenern und Tile-Requests aktiv)

## 1.21.0 - 2026-08-11
- FIX: Laufzeitzustand pro App-Instanz isoliert (F-42): `rootId` aus `Date.now()` durch den monotonen Instanzzähler ersetzt — `const rootId = "eventkalender-" + ekInstanzZaehler;` teilt sich mit `ekUid = "i" + ++ekInstanzZaehler` denselben Zählerstand N; alle `document.getElementById`-Zugriffe auf `${rootId}-…`-IDs bleiben damit je Instanz eindeutig und kollidieren bei mehreren gleichzeitig gemounteten Instanzen nicht mehr

## 1.20.0 - 2026-08-11
- FIX: XSS- und URL-Vertrag geschlossen (F-35): neuer Top-Level-Helfer `safeHttpUrl`; `event_id` wird an allen dynamischen ID-/`data-id`-Stellen (Agenda-Liste, Karten-Button, Attributionslink) escapt; Event-URL nur noch als Link gerendert, wenn sie ein gültiges http(s)-Schema hat (ICS-Export unverändert)

## 1.19.0 - 2026-08-07
- CHG: Bootstrap-Ziele instanzeindeutig (F-32): KPI-Kontext-Ziele auf Portfolio-Stil umgestellt (`#kpi-kontext-<n>` → `#ek-kpi-kontext-<n>-<ekUid>`) und Methodik- sowie Attribut-Accordion-Ziele (`#event-methodik-body`, `att-coll-*`) um eine Instanzkennung ergänzt — mehrere Instanzen derselben App auf einer Seite klappen ihre Panels unabhängig auf; die CSS-Klassen `kpi-info-toggle`/`kpi-info-icon`/`kpi-kontext` bleiben unverändert

## 1.18.0 - 2026-08-06
- CHG: DOM-Zugriffe auf den App-Container gescopt (F-25, Tranche 3): die unpräfixierte ID `map-btn-show-${ev.event_id}` (Button im Leaflet-Popup) wird mit dem rootId-Präfix versehen (`${rootId}-map-btn-show-${ev.event_id}`, rootId ist an beiden Stellen im Scope); der Klassen-Zugriff `.agenda-list` wird über den App-Container gescopt (kein Rename, Ziel ist die Ablaufplan-Liste, nicht die Attendee-Liste)

## 1.17.0 - 2026-08-06
- FIX: Datenschutzangabe beschreibt den tatsaechlichen Stand nach dem Vendoring (Welle G)

## 1.16.0 - 2026-08-06
- FIX: Drittanbietersektion nennt keine Beim-Aufruf-Behauptung mehr (Welle G)

## 1.15.0 - 2026-08-06
- FIX: Drittanbieterliste "Beim Aufruf kontaktierte Drittanbieter" an das Vendoring angepasst — jetzt lokal ausgelieferte Bibliotheken (Leaflet MarkerCluster) sind aus der Liste entfernt, weiterhin extern geladene Dienste (Kartenkacheln) bleiben genannt

## 1.14.0 - 2026-08-06
- FIX: Leaflet MarkerCluster vendored in `app/vendor/` statt von CDN geladen (Vendoring Teil 3) — Standalone-Betrieb laedt die Zusatzbibliotheken nicht mehr extern

## 1.13.0 - 2026-08-06
- FIX: Base auf Template oda-generic 1.6.0 vereinheitlicht (Hook renderPageOverride)

## 1.12.0 - 2026-08-04
- FIX: Datenschutzhinweis "Beim Aufruf kontaktierte Drittanbieter" an das Vendoring angepasst — jetzt lokal ausgelieferte Bibliotheken (Bootstrap/Leaflet/Chart.js) sind aus der Liste entfernt, weiterhin extern geladene Dienste (Kartenkacheln, Zusatzbibliotheken) bleiben genannt

## 1.11.0 - 2026-08-04
- FIX: Bootstrap, Leaflet, Chart.js vendored in `app/vendor/` statt von CDN geladen (F-07 Teil 2) — Standalone-Betrieb laedt diese Bibliotheken nicht mehr extern

## 1.10.0 - 2026-08-04
- FIX: Chart.js-Version vereinheitlicht auf 4.4.9 (vorher uneinheitlich gepinnt oder ganz ungepinnt, laedt bei jedem Aufruf die neueste Version) — Voraussetzung fuer das geplante Vendoring (F-07 Teil 2)

## 1.9.0 - 2026-08-04
- FIX: Drittanbieter (CDN, Kartendienste) in `datenschutz`-Default und README dokumentiert (F-07 Teil 1)
- FIX: Bootstrap CSS/JS auf einheitlich 5.3.8 gezogen (vorher gemischt 5.3.0/5.3.1 bzw. 5.3.0/5.3.0) (F-31)

## 1.8.0 - 2026-07-31
- FIX: Gebündelten Mock-Fallback entfernt; die konfigurierte Datenquelle ist jetzt maßgeblich
- FIX: Leere, fehlerhafte oder nicht erkennbare Datenquellen werden sichtbar gemeldet
- FIX: CKAN-Parameter werden nur an `datastore_search`-Endpunkte angehängt
- ENH: Fiktiver Referenzdatensatz als CSV und ICS für lokale Tests und Portal-Upload ergänzt
- CHG: Produktive Defaults auf den CKAN-Datensatz `kalender_demo` und die Ressource `events.csv` gesetzt
- DOC: README und Konzept auf die Quellen- und Fehlersemantik aktualisiert

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
