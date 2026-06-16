# Changelog

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
