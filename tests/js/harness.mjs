// Black-box harness: runs the real index.html script against a tiny stand-in for the browser, with data
// embedded (the same path as index-test.html), and returns the HTML the page rendered. No dependencies.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const scriptOf = html => [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');

export const decode = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
export const textOf = html => decode(html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

/**
 * Render one page.
 *  bundle  {manifest, people, breweries, seasons}  the data, as embed.py would embed it
 *  hash    '#winners', '#breweries', '#tour-agenda', '#people-scores' ...
 *  search  '?year=2026' or '?year=all'
 *  today   'YYYY-MM-DD' used as the current date
 */
export async function renderPage({ bundle, hash = '', search = '', today = '2026-11-01', html = HTML }) {
  const els = {};
  const el = id => els[id] || (els[id] = {
    id, innerHTML: '', textContent: '', value: '', style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {}, removeAttribute() {}, getAttribute() { return null; }, appendChild() {}, addEventListener() {},
  });
  const embedded = JSON.stringify({ builtAt: 'test', ...bundle });
  const document = {
    getElementById: id => (id === 'tdbb-data' ? { textContent: embedded } : el(id)),
    querySelector: sel => el(sel), querySelectorAll: () => [], addEventListener() {},
    createElement: () => el('created'), head: { appendChild() {} },
  };
  const RealDate = Date;
  const fixed = new RealDate(today + 'T12:00:00');
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(fixed.getTime()); }
    static now() { return fixed.getTime(); }
  }
  const failures = [];
  const ctx = vm.createContext({
    document, Date: FakeDate, console: { log() {}, warn() {}, error: (...a) => failures.push(a.join(' ')) },
    window: { addEventListener() {}, scrollTo() {}, open() {} },
    location: { hash, search, href: 'http://localhost/' + search + hash, protocol: 'http:' },
    history: { replaceState() {} },
    setInterval: () => 0, setTimeout, clearTimeout, URL, URLSearchParams,
    fetch: () => { throw new Error('the harness embeds the data and never fetches'); },
  });
  try {
    vm.runInContext(scriptOf(html), ctx, { filename: 'index.html' });
  } catch (e) { throw new Error('the page script crashed: ' + e.message); }
  const ready = () => els.app.innerHTML && !/^Loading/.test(textOf(els.app.innerHTML));   // the page shows "Loading…" first
  for (let i = 0; i < 500 && !ready(); i++) await new Promise(r => setImmediate(r));
  if (!ready()) throw new Error('the page did not finish rendering' + (failures.length ? ': ' + failures.join('; ') : ''));
  const app = els.app.innerHTML;
  return { html: app, text: textOf(app), els, title: document.title };
}

/** The rows of the Tour > Ratings table: [{id, rank, name, overall, beer, service, gl}]. */
export function ratingsRows(html) {
  const rows = [];
  for (const m of html.matchAll(/<tr class="row[^"]*" data-brew="([^"]+)">([\s\S]*?)<\/tr>/g)) {
    const rank = (m[2].match(/<span class="rk[^"]*">([^<]*)<\/span>/) || [])[1];
    const name = decode((m[2].match(/<button[^>]*class="nmb"[^>]*>([^<]*)<\/button>/) || [])[1] || '');
    const nums = [...m[2].matchAll(/<td class="num[^"]*">([^<]*)<\/td>/g)].map(x => x[1]);
    rows.push({ id: m[1], rank, name, overall: nums[0], beer: nums[1], service: nums[2], gl: nums[3] });
  }
  return rows;
}

/** Read data/ into the bundle shape the page expects. */
export function loadBundle(dataDir) {
  const read = p => JSON.parse(fs.readFileSync(path.join(dataDir, p), 'utf8'));
  const manifest = read('manifest.json');
  return {
    manifest, people: read('people.json'), breweries: read('breweries.json'),
    seasons: Object.fromEntries(manifest.seasons.map(id => [id, read('seasons/' + id + '.json')])),
  };
}
