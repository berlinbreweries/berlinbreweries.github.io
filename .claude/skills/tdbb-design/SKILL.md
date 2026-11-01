---
name: tdbb-design
description: Change or redesign the TDBB results page (index.html), including layout, style, new views and loader code. Never edits data files; use tdbb-ingest for ratings.
---

# TDBB design

Edits `index.html`, the single-file, mobile-first results page. Data lives in `data/` and is handled by the
`tdbb-ingest` skill. Keep the two apart: a redesign never touches ratings, and rating updates never touch the page.

## How the page is built

One file, no libraries, no build step. Inside the `<script>`:

1. **Loading** (`loadData`, `showFatal`). If `<script type="application/json" id="tdbb-data">` has content, that
   embedded data is used and a "Test data" banner shows. Otherwise it fetches `data/manifest.json`, `people.json`,
   `breweries.json` and each `data/seasons/<id>.json`, with a cache-busting query and `cache: 'no-store'`.
   A season that fails to load or parse becomes a banner; the rest keeps working. Missing manifest, people or
   breweries shows a plain error. Opening the file straight from disk explains that fetching is blocked.
2. **Model** (`buildModel`, `entries`, `pickAgenda`). Turns the files into `STAGES`, `PEOPLE`, `BREWERIES`
   (each with a `ratings` list of `{p, v:[beer,service,gl], st, sid}`), `PROFILES`, `AGENDA` and `SCOPE`.
   One season selected: breweries are that season's stops. **All**: breweries are pooled, "stages" become seasons.
   Bad rows (unknown id, score not an integer 0 to 5) are skipped with a warning banner.
   `PROFILES[id]` carries `qual` (`brewsOnSite` is not `false`) and `elig` (`qual` and `status` open). `buildHistory`
   fills `HISTORY[id]`: each brewery's overall score per season it was rated, **whatever season is selected**, so
   trends work in every view.
3. **Calculations** (`computeBrews`, `computePeople`). All averages, ranks, deviations and favourites are worked out
   here from the ratings. Weights come from `manifest.json`. Nothing derived is ever stored in the data.
   Trends are derived too: `sparkline` (last season against the one before it) and `movers`
   (biggest improvements of the selected season, or the latest on All, against each brewery's previous rated season).
4. **Views.** `renderWinners` (a **Next stage** banner when the latest season has a stage today or later, linking to the Agenda;
   podium of the three best breweries, **Biggest movers** (each with its current place, e.g. "#13 of 18 this season", or
   "all-time" on All, from the same rank as the ratings table, because a big jump can still be a low place), top five regulars),
   `renderProfiles` (Breweries: sort Top rated or A to Z; district shown before the address; a sparkline per brewery rated in
   two or more seasons, **only when Season = All**;
   badges Closed and Doesn't qualify), `renderTour` → `renderBreweries` (Ratings) and
   `renderAgenda` (placeholders when nothing is planned), `renderPeople` → Attendance, Scores, Favourites, Consistency, **Twins**.
5. **Shell.** `render()`, hash routing (`#winners`, `#breweries`, `#tour-ratings`, `#tour-agenda` (the old `#tour-today` still works),
   `#people-<tab>`), one delegated click handler, the year selector in the header. The selected season is kept in the
   query string (`?year=2025` or `?year=all`, set with `history.replaceState`) so a refresh keeps it; the view stays in the hash.

Header: logo, rated count, season selector. The logo is inline SVG text in Bungee (loaded for those four letters only; the font has one weight, so never set
font-weight on it): dark faces with a thin muted-gold outline and inline, and a solid gold extrusion falling down-left,
built from layered `<use>` copies and a clip path. It follows the TDP logo screenshot.
The Winners page has no trophy icon, to save space.

Bottom menu: Winners, Breweries, Tour, People.

## SEO and sharing

The site is one client-rendered page, so the basics live in `<head>` and are checked by `tests/python/test_seo.py`:
- **Title** `Tour de Berlin Breweries – Brewery Rankings & Results` (at most 65 characters) and a **description** of 70 to 160
  characters, repeated in `og:description` and the JSON-LD `WebSite` block. The script's `BASE_TITLE` must equal `<title>`
  (a test checks it); `render()` sets a title per view (Winners, Breweries, Tour, People) so tabs and history read well.
- **Canonical URL** `https://berlinbreweries.github.io/` is used in the canonical link, `og:url`, the JSON-LD, `sitemap.xml`
  and `robots.txt`. **If the address ever changes, change all five** (the test fails if they disagree).
- **Social card** `og-image.png` (exactly 1200x630) and `apple-touch-icon.png` (180x180). Regenerate them from the logo
  and the mug favicon if the look changes; the test checks the sizes.
- `404.html` is shown by GitHub Pages for any unknown address. It stays a real 404 (no redirect, `noindex`) and uses only
  absolute or root links, because it is served at any path.
- A `<noscript>` message gives non-JavaScript crawlers the description. Hash routes are not separate pages, so the sitemap
  lists only the root.
- **Layout shift:** `start()` waits (at most 1 s) for the Barlow fonts before the first render; without it the centred title
  re-laid out when the font swapped in (CLS 0.28, now 0.02). Keep it when changing start-up code.
- Check with the Lighthouse audit (mobile): all four categories should stay at 100. Muted text on the raised card needs
  `#b4afa5` or lighter to pass 4.5:1 contrast (plain `--muted` gives 4.34).

## Voting twins (People > Twins)

`computeTwins` finds the three groups of people whose scores are closest. Nothing is stored; it is derived from the
ratings and follows the season selector.
- A **visit** is a brewery in one season (so on All a repeat visit counts twice). Two people are compared on the visits both
  rated. Their **gap** is the average number of points apart per score, pooled over all those scores.
  A pair needs at least `TWIN_MIN` (3) shared visits.
- **Kinds** (`TWIN_KINDS`, chips under the tabs): Overall compares all three scores; Beer, Service and GL compare one score
  each. One score matches by chance more easily, so those need `TWIN_MIN_ONE` (4) shared visits (with 3, "All" showed three
  Jule pairs at a perfect 0.00 on three breweries each). The kind is part of the link: `#people-twins`, `#people-twins-beer`,
  `#people-twins-service`, `#people-twins-gl`; an unknown suffix falls back to Overall.
- Groups are built greedily: the closest remaining pair seeds a group, and anyone within `TWIN_SLACK` (0.10 points) of the
  seed's gap to **every** member joins (so a trio like Filip & Matouš & Zbynďa forms when all three are nearly as close as
  the leading pair). **Each person is in one group at most**, so the three rows are different people. `TWIN_PLACES` is 3.
- Each row shows the gap, the share of identical scores, and the fewest shared breweries between members.
- The five People tabs fit at 360 px with 12 px labels (`.seg.five`). A sixth tab would not: reconsider the layout first.

## Qualification

A brewery **qualifies** for the tour while it still brews on site (`brewsOnSite` is not `false`). Being closed is a
separate thing: a closed brewery that brewed on site still qualifies and only gets the Closed badge. The all-time Winners
podium (on All) and Biggest movers leave out breweries that are closed or do not qualify (`elig`); every season
ranking keeps them. The rule lives in the page; the data only holds the two facts. The Winners intro explains it, with
"brewing on site" highlighted.

## The data contract

The loader and model read exactly the format in `../tdbb-ingest/references/format.md`. Do not change what a field means
or rename one as part of a design task. If the format must change, treat it as its own task: update the validator,
`format.md`, the ingest skill, the loader and migrate every data file together, then run all checks.

## Guardrails

- **Never commit embedded data in `index.html`.** The live page keeps its `tdbb-data` block empty so it always reads
  the real files. Test builds go to `index-test.html` (git-ignored).
- Never edit anything under `data/`. Never put sample or fake ratings in the repo; test data is built inside the tests
  (`tests/js/fixtures.mjs`), never stored as files.
- Keep working: empty states (no ratings, no seasons), one season and many seasons, All and a single season,
  long brewery names, people with few ratings, a closed brewery, a stage without times, no upcoming stage (Agenda
  placeholders, no banner), a planned stage with a date but no stops (empty stages are not listed under Ratings).
- Do not hardcode brewery names, ids, seasons or scores in the page, and keep state words (closed, no longer qualifies)
  out of data text: the page shows badges from the fields.
- The favicon is an inline SVG data URI in `<head>` (gold beer mug on charcoal), so it needs no extra file.
- Keep the page one file, with no remote images and no remote scripts. Fonts: Barlow from Google Fonts with a system
  fallback. Photos are `img/<breweryid>.jpg`, shown as a circle over an initials fallback. Use only the group's own photos
  (or with permission); never copy from Google Maps. There are none for now, so every brewery shows initials.
- Mobile first: check at 360 and 390 px wide, no sideways scrolling, tap targets at least 38 px, text at least 12 px.
- External links open in a new window (already handled by the click handler for `a[target="_blank"]`).
- Typographic punctuation in visible text: ’ for apostrophes, real minus sign, en dash in time ranges.

## Visual language

Dark charcoal `#353433` background, raised `#403f3d`, lines `#504e4b`, text `#F5EFE4`, muted `#ABA69C`, gold `#E7C566`
(highlights, best values), lilac `#BBA9FF` (lowest values), purple `#7456E0` (rank circles, stop numbers), cream `#FBEBD3`
(active chips, primary buttons, dark ink `#2B2A29` on it). The TDBB wordmark has dark faces with thin muted-gold lines and a solid gold extrusion down-left, after the TDP logo.
The Next stage banner is a gold-outlined card on a faint gold tint; placeholder stops use dashed circles and muted text.
Rank circles echo the Tour screen from the original TDP app design. Keep tables simple and sortable, one screenful per section.

## Testing a change

0. Run the tests: `node --test tests/js/*.test.mjs` (page) and `python3 -m unittest discover -s tests/python` (scripts and the
   Python/JS cross-check). A change that alters a number, a rank or a rule should come with a test. The page tests use
   `tests/js/harness.mjs`, which runs the real script against a browser stand-in; if the page starts using a new browser
   feature, add it to the stand-in or the page will quietly fall back (that is how `URLSearchParams` was once missed).
1. Check the data first: `python3 .claude/skills/tdbb-ingest/scripts/validate.py data`.
2. Real loading path: serve the repo root (`python3 -m http.server 8000`) and open `http://localhost:8000/`.
3. Embedded path (also works in previews that cannot fetch):
   `python3 .claude/skills/tdbb-design/scripts/embed.py` writes `index-test.html` and refuses to overwrite `index.html`.
4. Compare numbers before and after a redesign: rankings, people tables and the Winners podium must not change
   unless the change was meant to alter them.
5. For the front-page banner and an Agenda with a plan, use `embed.py --test-agenda`: it adds an invented stage 14 days
   ahead to the embedded copy only (never to `data/`).
6. Look at it in a real browser at 390 px wide, not only through scripts: that is how a faked bold font and clogged
   letters in the logo were caught. Zoom in on details such as the logo.
7. Before handing over, confirm `index.html` still has an empty `tdbb-data` block (the validator checks this).
