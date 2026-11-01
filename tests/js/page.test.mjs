import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ratingsRows, renderPage, textOf } from './harness.mjs';
import { TWIN_SCORES, categoryTwinsBundle, mainBundle, regularsBundle, twinsBundle, twoSeasonPairBundle, withStage } from './fixtures.mjs';

const page = (hash, search = '?year=all', extra = {}) => renderPage({ bundle: mainBundle(), hash, search, ...extra });
const section = (html, from, to) => {
  const a = html.indexOf(from);
  assert.ok(a >= 0, 'section "' + from + '" is missing');
  const b = to ? html.indexOf(to, a + 1) : -1;
  return html.slice(a, b < 0 ? undefined : b);
};
const names = html => [...html.matchAll(/<span class="pname">([^<]*)<\/span>/g)].map(m => m[1]);

// ---------------------------------------------------------------- scores and ranks
test('Tour > Ratings shows scores rounded half up, with shared places', async () => {
  const { html } = await page('#tour-ratings', '?year=2026');
  const rows = Object.fromEntries(ratingsRows(html).map(r => [r.id, r]));
  assert.deepEqual([rows.beta.rank, rows.gamma.rank, rows.alpha.rank, rows.eps.rank, rows.delta.rank], ['1', '1', '3', '4', '5']);
  assert.equal(rows.alpha.overall, '4.17');           // 4.1667
  assert.equal(rows.eps.overall, '3.88');             // exactly 3.875, rounds up
  assert.deepEqual([rows.eps.beer, rows.eps.service, rows.eps.gl], ['4.00', '3.75', '3.75']);
});

test('a score of exactly x.xx5 rounds up (3.675 shows as 3.68)', async () => {
  const b = mainBundle();
  // 10 ratings: beer 38, service 34, gl 37 -> overall exactly 3.675
  const rows = [[4, 4, 4], [5, 4, 5], [4, 4, 4], [5, 3, 4], [3, 4, 5], [4, 4, 4], [3, 4, 2], [4, 2, 4], [3, 3, 3], [3, 2, 2]];
  const id = i => 'p' + 'abcdefghij'[i];
  b.people.people = Object.fromEntries(rows.map((_, i) => [id(i), { name: 'P' + i }]));
  b.seasons['2026'].stages = [{ date: '2026-04-10', stops: [{ brewery: 'alpha', ratings: Object.fromEntries(rows.map((s, i) => [id(i), { beer: s[0], service: s[1], gl: s[2] }])) }] }];
  b.seasons['2025'].stages = [{ date: '2025-05-10', stops: [] }];
  const { html } = await renderPage({ bundle: b, hash: '#tour-ratings', search: '?year=2026' });
  assert.equal(ratingsRows(html)[0].overall, '3.68');
});

test('All pools every rating, and 4.125 rounds up', async () => {
  const { html } = await page('#tour-ratings');
  const rows = Object.fromEntries(ratingsRows(html).map(r => [r.id, r]));
  assert.equal(rows.delta.overall, '4.13');           // exactly 4.125
  assert.equal(rows.alpha.overall, '3.58');
  assert.equal(rows.gamma.overall, '5.00');
});

// ---------------------------------------------------------------- winners
test('the all-time podium leaves out closed breweries and ones that do not brew on site', async () => {
  const { html } = await page('#winners');
  const podium = section(html, 'Breweries of all time', 'Biggest movers');
  assert.deepEqual(names(podium).sort(), ['Alpha', 'Delta', 'Eps']);    // Gamma (closed, 5.00) and Beta (does not qualify) are out
});

test('a single season podium keeps every brewery', async () => {
  const { html } = await page('#winners', '?year=2026');
  const podium = names(section(html, 'Breweries of the year', 'Biggest movers'));
  assert.ok(podium.includes('Beta') && podium.includes('Gamma'), 'Beta and Gamma tie for first in 2026: ' + podium);
});

test('Biggest movers: improvements only, biggest first, from the previous visit', async () => {
  const { text } = await page('#winners', '?year=2026');
  const m = section(text, 'Biggest movers', 'The regulars');
  assert.match(m, /1 Beta #1 of 5 this season \+3\.00 2\.00 → 5\.00/);
  assert.match(m, /2 Alpha #3 of 5 this season \+1\.17 3\.00 → 4\.17/);
  assert.doesNotMatch(m, /Delta/);   // got worse
  assert.doesNotMatch(m, /Gamma/);   // no change
  assert.doesNotMatch(m, /Eps/);     // no previous visit
});

test('Biggest movers on All skips breweries that do not qualify', async () => {
  const { text } = await page('#winners');
  const m = section(text, 'Biggest movers', 'The regulars');
  assert.match(m, /1 Alpha #4 of 5 all-time \+1\.17/);   // the all-time rank, from every rating
  assert.doesNotMatch(m, /Beta/);
});

test('the oldest season has no Biggest movers', async () => {
  const { text } = await page('#winners', '?year=2025');
  assert.doesNotMatch(text, /Biggest movers/);
});

test('regulars: five places, ties share a row joined with &', async () => {
  const { html } = await renderPage({ bundle: regularsBundle(), hash: '#winners', search: '?year=all' });
  const rows = [...section(html, 'The regulars').matchAll(/<li><span class="rk[^"]*">(\d)<\/span><span class="rn">([^<]*)<\/span>/g)].map(m => [m[1], textOf(m[2])]);
  assert.deepEqual(rows, [['1', 'Ann'], ['2', 'Bob'], ['3', 'Cid'], ['4', 'Dee & Eve'], ['5', 'Fay']]);   // Gus would be sixth
});

test('regulars: tied people are listed together, and people with no ratings are left out', async () => {
  const { text } = await page('#winners');
  const reg = section(text, 'The regulars');
  assert.match(reg, /1 Ines/);
  assert.match(reg, /2 Milan & Tim/);
  assert.match(reg, /3 Ola/);
});

test('the Winners page has no trophy icon and says TDBB has run since 2024', async () => {
  const { html, text } = await page('#winners');
  assert.doesNotMatch(html, /class="trophy"/);
  assert.match(text, /TDBB has been running since 2024/);
  assert.match(html, /<b>brewing on site<\/b>/);
});

// ---------------------------------------------------------------- breweries page
test('Breweries: district before the address, left out when there is none', async () => {
  const { text } = await page('#breweries');
  assert.match(text, /Mitte · Alpha Street 1/);
  assert.match(text, /Friedrichshain · Delta Street 1/);
  assert.match(text, /Gamma Street 1, 10115 Berlin/);
  assert.doesNotMatch(text, /· Gamma Street/);
});

test('Breweries: badges. Closed alone, Doesn\'t qualify alone', async () => {
  const { html } = await page('#breweries');
  const card = id => html.split('<article class="card">').find(c => c.includes('<h2>' + id));
  assert.match(card('Gamma'), /Closed/);
  assert.doesNotMatch(card('Gamma'), /qualify/);       // closed, but it did brew on site
  assert.match(card('Beta'), /Doesn’t qualify/);
  assert.doesNotMatch(card('Beta'), /Closed/);
  assert.doesNotMatch(card('Alpha'), /Closed|qualify/);
});

test('Breweries: sort chips are Top rated and A to Z only', async () => {
  const { html } = await page('#breweries');
  const chips = [...html.matchAll(/<button type="button" class="chip" data-bord="\w+"[^>]*>([^<]*)<\/button>/g)].map(m => m[1]);
  assert.deepEqual(chips, ['Top rated', 'A to Z']);
});

test('Breweries: score history sparklines only when Season = All', async () => {
  const all = (await page('#breweries', '?year=all')).html;
  const one = (await page('#breweries', '?year=2026')).html;
  assert.equal((all.match(/class="trend /g) || []).length, 4);   // alpha, beta, gamma and delta were rated in both seasons; eps only once
  assert.equal((one.match(/class="trend /g) || []).length, 0);
  assert.match(all, /\+1\.17 since 2024\/2025/);
});

// ---------------------------------------------------------------- agenda
test('Agenda: placeholders when nothing is planned, and no banner on the front page', async () => {
  const agenda = await page('#tour-agenda', '?year=2026');
  assert.match(agenda.text, /The next stage has not been planned yet/);
  assert.equal((agenda.html.match(/class="stop ph"/g) || []).length, 3);
  assert.match(agenda.text, /Brewery to be announced/);
  assert.doesNotMatch((await page('#winners')).html, /class="nextstage"/);
});

test('the old #tour-today link opens the Agenda', async () => {
  const { html } = await page('#tour-today', '?year=2026');
  assert.match(html, /data-ttab="agenda" aria-selected="true"/);
});

test('Agenda and banner for an upcoming stage', async () => {
  const b = withStage(mainBundle(), { date: '2026-11-15', stops: [
    { brewery: 'alpha', start: '14:00', end: '15:00', travel: 10, note: 'Table booked', ratings: {} },
    { brewery: 'delta', start: '15:30', ratings: {} },
  ] });
  const agenda = await renderPage({ bundle: b, hash: '#tour-agenda', search: '?year=2026' });
  assert.match(agenda.text, /November 15\. Stage 3: 2 stops, starting at 14:00/);
  assert.match(agenda.text, /14:00–15:00/);
  assert.match(agenda.text, /10 min travel to Delta/);
  assert.match(agenda.text, /Table booked/);
  assert.equal((agenda.html.match(/class="stop ph"/g) || []).length, 0);
  const home = await renderPage({ bundle: b, hash: '#winners', search: '?year=all' });
  assert.match(home.text, /Next stage .*November 15 2 stops, starting at 14:00 See the agenda/);
});

test('a planned stage with a date but no stops shows the date with placeholders', async () => {
  const b = withStage(mainBundle(), { date: '2026-11-15', stops: [] });
  const agenda = await renderPage({ bundle: b, hash: '#tour-agenda', search: '?year=2026' });
  assert.match(agenda.text, /November 15\. Stage 3\. The agenda has not been planned yet/);
  assert.equal((agenda.html.match(/class="stop ph"/g) || []).length, 3);
  const home = await renderPage({ bundle: b, hash: '#winners' });
  assert.match(home.text, /Agenda to be announced/);
  const ratings = await renderPage({ bundle: b, hash: '#tour-ratings', search: '?year=2026' });
  assert.doesNotMatch(ratings.html, /Stage 3/, 'an empty stage is not a rating stage');
});

test('the banner says Today on the day of a stage, and is gone the day after', async () => {
  const b = withStage(mainBundle(), { date: '2026-11-15', stops: [{ brewery: 'alpha', ratings: {} }] });
  const same = await renderPage({ bundle: b, hash: '#winners', today: '2026-11-15' });
  assert.match(same.text, /Today .*November 15/);
  const after = await renderPage({ bundle: b, hash: '#winners', today: '2026-11-16' });
  assert.doesNotMatch(after.html, /class="nextstage"/);
});

test('an older season selected shows its last stage, not placeholders', async () => {
  const { text } = await page('#tour-agenda', '?year=2025');
  assert.doesNotMatch(text, /not been planned/);
  assert.match(text, /Stage 1: 4 stops/);
});

// ---------------------------------------------------------------- navigation and defaults
test('People tabs are ordered Attendance, Scores, Consistency, Favourites, Twins, and Attendance opens first', async () => {
  const { html } = await page('#people');
  const tabs = [...html.matchAll(/data-ptab="(\w+)"/g)].map(m => m[1]);
  assert.deepEqual(tabs, ['attendance', 'scores', 'consistency', 'favourites', 'twins']);
  assert.match(html, /data-ptab="attendance" aria-selected="true"/);
});

test('Tour tabs are Ratings and Agenda', async () => {
  const { html } = await page('#tour-ratings', '?year=2026');
  assert.deepEqual([...html.matchAll(/data-ttab="(\w+)"/g)].map(m => m[1]), ['ratings', 'agenda']);
});

test('the latest season in the manifest opens by default, and ?year= overrides it', async () => {
  const def = await renderPage({ bundle: mainBundle(), hash: '#winners', search: '' });
  assert.match(def.text, /Results for season 2025\/2026/);
  const old = await renderPage({ bundle: mainBundle(), hash: '#winners', search: '?year=2025' });
  assert.match(old.text, /Results for season 2024\/2025/);
  const all = await renderPage({ bundle: mainBundle(), hash: '#winners', search: '?year=all' });
  assert.match(all.text, /Results from all seasons/);
  const junk = await renderPage({ bundle: mainBundle(), hash: '#winners', search: '?year=1999' });
  assert.match(junk.text, /Results for season 2025\/2026/);
});

test('a season with no ratings says so instead of crashing', async () => {
  const b = mainBundle();
  b.seasons['2026'].stages = [{ date: '2026-04-10', stops: [{ brewery: 'alpha', ratings: {} }] }];
  const { text } = await renderPage({ bundle: b, hash: '#winners', search: '?year=2026' });
  assert.match(text, /No ratings yet/);
});

// ---------------------------------------------------------------- voting twins
const twins = async (bundle, search = '?year=2026', hash = '#people-twins') => {
  const { html, text } = await renderPage({ bundle, hash, search });
  const rows = [...html.matchAll(/<li><span class="rk[^"]*">(\d)<\/span><span class="rn">([^<]*)<\/span><span class="rs"><b>([^<]*)<\/b><small>([^<]*)<\/small>/g)]
    .map(m => ({ place: m[1], who: textOf(m[2]), gap: m[3], detail: textOf(m[4]) }));
  return { rows, html, text };
};

test('Twins: the three closest groups, a trio where everyone is nearly as close as the leading pair', async () => {
  const { rows } = await twins(twinsBundle());
  assert.deepEqual(rows.map(r => [r.place, r.who, r.gap]), [
    ['1', 'Ann & Ben & Cat', '0.04 apart'],
    ['2', 'Dan & Eve', '0.17 apart'],
    ['3', 'Fay & Gus', '0.28 apart'],
  ]);
  assert.equal(rows[0].detail, 'same score 96% · at least 6 shared breweries');
  assert.equal(rows[1].detail, 'same score 83% · 6 shared breweries');
});

test('Twins: nobody appears twice, and people who are far from everyone are not listed', async () => {
  const { rows } = await twins(twinsBundle());
  const everyone = rows.flatMap(r => r.who.split(' & '));
  assert.equal(new Set(everyone).size, everyone.length);
  assert.ok(!everyone.includes('Hal'));
});

test('Twins: a pair needs at least 3 breweries in common (Zed copies Ann but only shares 2)', async () => {
  const { rows } = await twins(twinsBundle());
  assert.ok(!rows.some(r => r.who.includes('Zed')));
});

test('Twins: someone who is too far from the leading pair does not join its group', async () => {
  const far = { ...TWIN_SCORES, Cat: ['333', '424', '543', '222', '445', '000'] };   // 6 points off Ann and Ben at one brewery
  const { rows } = await twins(twinsBundle(far));
  assert.equal(rows[0].who, 'Ann & Ben');
  assert.ok(!rows.some(r => r.who.includes('Cat')), 'Cat is close to nobody else either');
});

test('Twins: someone already in a group cannot also join a later one', async () => {
  // Dan and Eve are each 2 points from Ann and Ben (0.11 apart: too far to join their group, but within reach of the
  // Dan & Eve group's slack). Ann and Ben must stay in the first group only.
  const ann = TWIN_SCORES.Ann;
  const scores = {
    Ann: ann, Ben: ann,
    Dan: ann.map((s, i) => (i === 0 ? '433' : i === 1 ? '524' : s)),
    Eve: ann.map((s, i) => (i === 0 ? '233' : i === 2 ? '443' : s)),
  };
  const { rows } = await twins(twinsBundle(scores));
  assert.deepEqual(rows.map(r => [r.who, r.gap]), [['Ann & Ben', '0.00 apart'], ['Dan & Eve', '0.22 apart']]);
});

test('Twins: a visit is a brewery in one season, so All counts a repeat visit twice', async () => {
  const bundle = twoSeasonPairBundle();
  assert.equal((await twins(bundle, '?year=all')).rows[0].who, 'Xan & Yui');   // b1 (2025), b2 (2025), b1 (2026)
  assert.match((await twins(bundle, '?year=2026')).text, /Not enough shared ratings/);
  assert.match((await twins(bundle, '?year=2025')).text, /Not enough shared ratings/);
});

test('Twins: says so when nobody has enough breweries in common', async () => {
  const b = twinsBundle();
  b.seasons['2026'].stages[0].stops = b.seasons['2026'].stages[0].stops.slice(0, 2);
  const { text, rows } = await twins(b);
  assert.equal(rows.length, 0);
  assert.match(text, /Not enough shared ratings yet/);
});

test('Twins is the fifth People tab, and #people-twins opens it', async () => {
  const { html } = await renderPage({ bundle: twinsBundle(), hash: '#people-twins', search: '?year=2026' });
  assert.deepEqual([...html.matchAll(/data-ptab="(\w+)"/g)].map(m => m[1]), ['attendance', 'scores', 'consistency', 'favourites', 'twins']);
  assert.match(html, /data-ptab="twins" aria-selected="true"/);
});

// ---------------------------------------------------------------- twins per category
const first = async hash => (await twins(categoryTwinsBundle(), '?year=2026', hash)).rows[0];

test('Twins per category: each score has its own closest pair', async () => {
  const beer = await first('#people-twins-beer');
  assert.deepEqual([beer.who, beer.gap, beer.detail], ['Ann & Ben', '0.00 apart', 'same beer score 100% · 6 shared breweries']);
  const service = await first('#people-twins-service');
  assert.deepEqual([service.who, service.gap, service.detail], ['Cat & Dan', '0.00 apart', 'same service score 100% · 6 shared breweries']);
  const gl = await first('#people-twins-gl');
  assert.deepEqual([gl.who, gl.gap, gl.detail], ['Eve & Fay', '0.00 apart', 'same GL score 100% · 6 shared breweries']);
});

test('Twins per category: the overall view is not the same as any single category', async () => {
  const { rows } = await twins(categoryTwinsBundle());
  assert.deepEqual(rows.slice(1).map(r => [r.who, r.gap]), [['Eve & Fay', '1.11 apart'], ['Cat & Dan', '1.22 apart']]);
});

test('Twins per category: one score needs 4 shared breweries, the overall view only 3', async () => {
  const overall = await twins(categoryTwinsBundle());
  assert.equal(overall.rows[0].who, 'Xan & Yui');                       // 3 shared breweries
  assert.match(overall.text, /at least 3 breweries in common/);
  for (const kind of ['beer', 'service', 'gl']) {
    const { rows, text } = await twins(categoryTwinsBundle(), '?year=2026', '#people-twins-' + kind);
    assert.ok(!rows.some(r => r.who.includes('Xan')), kind + ': Xan & Yui share only 3 breweries');
    assert.match(text, /at least 4 breweries in common/);
  }
});

test('Twins per category: the chips, and the link decides which one is selected', async () => {
  const chips = html => [...html.matchAll(/data-twin="(\w+)" aria-pressed="(\w+)"/g)].map(m => m[1] + ':' + m[2]);
  const def = (await twins(categoryTwinsBundle())).html;
  assert.deepEqual(chips(def), ['all:true', 'beer:false', 'service:false', 'gl:false']);
  assert.deepEqual([...def.matchAll(/data-twin="\w+" aria-pressed="\w+">([^<]*)</g)].map(m => m[1]), ['Overall', 'Beer', 'Service', 'GL']);
  assert.deepEqual(chips((await twins(categoryTwinsBundle(), '?year=2026', '#people-twins-service')).html), ['all:false', 'beer:false', 'service:true', 'gl:false']);
  assert.deepEqual(chips((await twins(categoryTwinsBundle(), '?year=2026', '#people-twins-nonsense')).html), ['all:true', 'beer:false', 'service:false', 'gl:false']);
});

test('Twins per category: says so when a category has too few shared breweries', async () => {
  const b = categoryTwinsBundle();
  b.seasons['2026'].stages[0].stops = b.seasons['2026'].stages[0].stops.slice(0, 3);   // only 3 breweries: fine overall, not for one score
  const beer = await twins(b, '?year=2026', '#people-twins-beer');
  assert.equal(beer.rows.length, 0);
  assert.match(beer.text, /Not enough shared ratings yet\. Two people need 4 breweries/);
  assert.ok((await twins(b)).rows.length > 0);
});

// ---------------------------------------------------------------- browser titles
test('the browser tab title says what page you are on', async () => {
  const titles = {};
  for (const hash of ['#winners', '#breweries', '#tour-agenda', '#people-twins']) titles[hash] = (await page(hash)).title;
  assert.equal(titles['#winners'], 'Tour de Berlin Breweries – Brewery Rankings & Results');
  assert.equal(new Set(Object.values(titles)).size, 4, 'each view has its own title: ' + JSON.stringify(titles));
  for (const t of Object.values(titles)) assert.match(t, /Tour de Berlin Breweries/);
});

test('Biggest movers shows where a big mover stands: a big jump can still be a low place', async () => {
  // Delta improves by 3.00 (tied with Beta, which comes first alphabetically) yet is still last in 2026.
  const b = mainBundle();
  b.seasons['2025'].stages[0].stops.find(s => s.brewery === 'delta').ratings = { ines: { beer: 0, service: 0, gl: 0 } };
  const { text } = await renderPage({ bundle: b, hash: '#winners', search: '?year=2026' });
  assert.match(section(text, 'Biggest movers', 'The regulars'), /2 Delta #5 of 5 this season \+3\.00 0\.00 → 3\.00/);
});

// ---------------------------------------------------------------- scroll hint
test('the page has a scroll-down hint that is silent for screen readers and respects reduced motion', async () => {
  const html = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  assert.match(html, /<button[^>]*class="more"[^>]*tabindex="-1"/);
  assert.match(html, /@media \(prefers-reduced-motion:no-preference\)\{\s*\.more\.on svg\{animation/);
});
