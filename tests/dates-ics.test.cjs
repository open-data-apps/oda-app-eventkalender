process.env.TZ = 'Europe/Berlin';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../app/app.js'), 'utf8');
const app = vm.createContext({ tzFormatterCache: new Map() });
for (const name of ['zonedDateTimeToUtc', 'getTzFormatter', 'generateICS', 'formatICSDate', 'istBekannteZeitzone', 'escapeICSString', 'escapeICSParameter']) {
  const start = new RegExp('^([ \\t]*)function ' + name + '\\(', 'm').exec(source);
  if (!start) continue;
  const end = source.indexOf('\n' + start[1] + '}', start.index);
  vm.runInContext(source.slice(start.index, end + start[1].length + 2), app);
}
for (const [wall, utc] of [
  ['2026-03-29T01:30:00', '2026-03-29T00:30:00.000Z'],
  ['2026-03-29T03:30:00', '2026-03-29T01:30:00.000Z'],
  // RFC 5545 3.3.5: vor der Lücke geltender Offset, erste doppelte Uhrzeit.
  ['2026-03-29T02:30:00', '2026-03-29T01:30:00.000Z'],
  ['2026-10-25T02:30:00', '2026-10-25T00:30:00.000Z'],
  ['2026-10-25T03:30:00', '2026-10-25T02:30:00.000Z'],
  ['2026-09-22T12:00:00Z', '2026-09-22T12:00:00.000Z'],
  ['2026-09-22T14:00:00+02:00', '2026-09-22T12:00:00.000Z'],
]) {
  test('F-136 Europe/Berlin ' + wall, () => {
    assert.equal(app.zonedDateTimeToUtc(wall, 'Europe/Berlin')?.toISOString(), utc);
  });
}
const base = { event_id: 'alpha', titel: 'Alpha', veranstalter: 'Verein Alpha', zeitzone: 'Europe/Berlin' };
test('F-134 Wiederholung behält zonierte Ortszeit über den Sommerzeitwechsel', () => {
  const ics = app.generateICS([{ ...base, datum_start: '2026-10-24T07:00:00Z',
    datum_ende: '2026-10-24T08:00:00Z', wiederholung: 'FREQ=DAILY;COUNT=3' }]);
  assert.match(ics, /DTSTART;TZID=Europe\/Berlin:20261024T090000\r\n/);
  assert.match(ics, /DTEND;TZID=Europe\/Berlin:20261024T100000\r\n/);
  assert.match(ics, /RRULE:FREQ=DAILY;COUNT=3/);
});
for (const [input, serialized] of [
  ['2026-09-22T12:00:00Z', 'DTSTART:20260922T120000Z'],
  ['2026-09-22T14:00:00+02:00', 'DTSTART:20260922T120000Z'],
  ['2026-09-22T14:00:00', 'DTSTART:20260922T120000Z'],
  ['2026-09-22', 'DTSTART;VALUE=DATE:20260922'],
]) {
  test('F-134 Export erhält Zeitpunkt oder DATE: ' + input, () => {
    const ics = app.generateICS([{ ...base, datum_start: input }]);
    assert.ok(ics.split('\r\n').includes(serialized), ics);
    assert.match(ics, /DTSTAMP:\d{8}T\d{6}Z\r\n/);
    assert.doesNotMatch(ics, /DTSTART;TZID|DTEND[^\r\n]*:\r\n/);
    assert.doesNotMatch(ics, /ORGANIZER/); // ohne E-Mail keine ungültige Property
  });
}
test('F-134 DATE-Ende bleibt exklusiv und wird nicht zur Uhrzeit', () => {
  const ics = app.generateICS([{ ...base, datum_start: '2026-09-22', datum_ende: '2026-09-23' }]);
  assert.match(ics, /DTEND;VALUE=DATE:20260923\r\n/);
});
test('F-134 Veranstalterparameter mit Trennzeichen werden korrekt gequotet', () => {
  const ics = app.generateICS([{ ...base, datum_start: '2026-09-22T12:00:00Z',
    veranstalter: 'Verein; "Alpha"', kontakt_email: 'kontakt@example.org' }]);
  assert.ok(ics.includes(`ORGANIZER;CN="Verein; ^'Alpha^'":mailto:kontakt@example.org\r\n`), ics);
});
for (const wiederholung of ['', 'FREQ=WEEKLY;COUNT=2']) {
  test('F-134 unbekannte Zeitzone ' + (wiederholung ? 'mit' : 'ohne') + ' Wiederholung: Ortszeit mit TZID statt Absturz/Verschiebung', () => {
    const ics = app.generateICS([{ ...base, zeitzone: 'W. Europe Standard Time', datum_start: '2026-09-22T10:00:00',
      datum_ende: '2026-09-22T11:00:00', wiederholung }]);
    assert.match(ics, /DTSTART;TZID=W\. Europe Standard Time:20260922T100000\r\n/);
    assert.match(ics, /DTEND;TZID=W\. Europe Standard Time:20260922T110000\r\n/);
  });
}
test('F-134 eintägiger Ganztag ohne DTEND gleich DTSTART', () => {
  const ics = app.generateICS([{ ...base, datum_start: '2026-09-22', datum_ende: '2026-09-22' }]);
  assert.match(ics, /DTSTART;VALUE=DATE:20260922\r\n/);
  assert.doesNotMatch(ics, /DTEND/);
});
test('F-134 unlesbares Datum nennt den betroffenen Termin', () => {
  assert.throws(() => app.generateICS([{ ...base, datum_start: '22.09.2026 10:00' }]), /Alpha/);
});
