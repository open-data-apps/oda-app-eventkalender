const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../app/app.js'), 'utf8');
const app = vm.createContext({});
// Reale closure-interne Parserfunktionen ausführen; UI-Verdrahtung separat im Browser.
for (const name of ['parseCSV', 'splitCSVLine', 'splitCSVRecords']) {
  const start = new RegExp('^([ \\t]*)function ' + name + '\\(', 'm').exec(source);
  if (!start) continue;
  const end = source.indexOf('\n' + start[1] + '}', start.index);
  vm.runInContext(source.slice(start.index, end + start[1].length + 2), app);
}
for (const newline of ['\n', '\r\n']) {
  test('F-135 Quotes, Trennzeichen und eingebettete Zeilenumbrüche ' + JSON.stringify(newline), () => {
    const result = app.parseCSV('titel;datum_start;beschreibung' + newline +
      '"Name ""Quoted""; Alpha";2026-09-22T12:00:00Z;"Zeile eins' + newline + 'Zeile zwei"' + newline +
      'Beta;2026-09-23T12:00:00Z;Ende' + newline);
    assert.equal(result.rows.length, 2);
    assert.equal(result.verworfen ?? result.skipped, 0);
    assert.equal(result.rows[0].titel, 'Name "Quoted"; Alpha');
    assert.equal(result.rows[0].beschreibung, 'Zeile eins' + newline + 'Zeile zwei');
    assert.equal(result.rows[1].titel, 'Beta');
  });
}
test('F-135 wirklich unvollständige CSV-Zeile wird weiter gezählt', () => {
  const result = app.parseCSV('titel,datum_start,beschreibung\nDefekt\nAlpha,2026-09-22T12:00:00Z,gültig');
  assert.equal(result.rows.length, 1);
  assert.equal(result.verworfen ?? result.skipped, 1);
});
test('F-135 offene Quotes erzeugen keinen scheinbar gültigen Termin', () => {
  assert.throws(() => app.parseCSV('titel;datum_start\n"Offen;2026-09-22T12:00:00Z'), /CSV|Anführungszeichen/);
});
