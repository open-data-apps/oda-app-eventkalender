import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appJsPath = new URL("../app/app.js", import.meta.url);
const appCssPath = new URL("../app/app.css", import.meta.url);

test("app.js exposes compact mobile filter controls", async () => {
  const source = await readFile(appJsPath, "utf8");

  assert.match(source, /filter-toggle/i, "expected a mobile filter toggle id/class");
  assert.match(source, /aria-expanded=/i, "expected filter toggle accessibility state");
  assert.match(source, /filters-collapsed/i, "expected a mobile filter collapsed state hook");
});

test("app.css defines dedicated mobile responsive hooks", async () => {
  const source = await readFile(appCssPath, "utf8");

  assert.match(source, /filter-toggle-button/i, "expected styles for the mobile filter toggle");
  assert.match(source, /filters-collapsed/i, "expected styles for the collapsed filter state");
  assert.match(source, /@media\s*\(max-width:\s*767px\)/i, "expected a small-screen breakpoint");
  assert.match(source, /custom-tabs-nav[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/i, "expected a 2x2 mobile tab layout");
});
