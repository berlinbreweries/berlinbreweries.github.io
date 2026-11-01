# TDBB: Tour de Berlin Breweries results

A small static site for the Tour de Berlin Breweries (TDBB), the Berlin edition of Tour de Pivovar (TDP, started in
Prague in 2012). A group visits Berlin breweries in stages and scores each for beer, service and genius loci.
The site shows winners, brewery profiles, tour ratings and people stats. It is published on GitHub Pages.

## Repo map

```
index.html                       the whole page (HTML, CSS, JS). Reads data/ when it loads
data/manifest.json               seasons list and score weights
data/people.json                 people (ids and names)
data/breweries.json              breweries (name, address, district, highlight, status, brewsOnSite)
data/seasons/<year>.json         one file per season, named by END year. All the ratings
img/<breweryid>.jpg              optional own photos, about 400 px square (none yet)
robots.txt, sitemap.xml          search engine files (canonical URL: https://berlinbreweries.github.io/)
404.html                         shown by GitHub Pages for unknown addresses (noindex, link home, no redirect)
og-image.png, apple-touch-icon.png   social share card (1200x630) and iPhone home-screen icon (180x180)
.claude/skills/tdbb-ingest/      skill: add or correct ratings (data only), with validate.py and summary.py
.claude/skills/tdbb-design/      skill: change the page (index.html only), with embed.py
```

## Two separate jobs

- **Adding ratings, people, breweries, seasons** → use the `tdbb-ingest` skill. It edits `data/` only.
- **Changing how the page looks or works** → use the `tdbb-design` skill. It edits `index.html` only.

## Rules that always apply

- Scores are whole numbers 0 to 5, stored as `{"beer": 4, "service": 3, "gl": 3}`. Halves are rounded up before saving.
- IDs are lowercase ASCII letters, one word. People have one name and no aliases.
- Store raw ratings only. Averages, ranks and totals are calculated by the page.
- A season id is its end year (`2026` = 2025/2026). `manifest.json` lists seasons oldest first.
- "All" averages every rating ever given, not season averages.
- A brewery **qualifies** for the tour while it still brews on site (`brewsOnSite`, default true). Closed (`status`) is
  separate. The page leaves closed and non-qualifying breweries off the all-time podium. Highlights stay timeless: no
  scores, opening hours or closed/qualification wording.
- `index.html` must keep its `<script id="tdbb-data">` block **empty**. Embedded test data goes only into
  `index-test.html`, which is git-ignored.
- The site is public: first names and scores only, no reservation numbers, no private details.
- Always validate before committing: `python3 .claude/skills/tdbb-ingest/scripts/validate.py data`
- Run the tests before committing a change to `index.html` or to a script (see `tests/README.md`). Test data is built
  inside the tests; never put fake ratings in `data/`.
- Scores are shown rounded half up to two decimals (3.675 is 3.68), in the page and in `summary.py`.
- Never force push, rewrite history or push to a branch other than the current one. Undo with `git revert`.

## Quick commands

```
python3 .claude/skills/tdbb-ingest/scripts/validate.py data      # check all data (and that index.html has no test data)
python3 .claude/skills/tdbb-ingest/scripts/summary.py data       # ranking of the latest season
python3 .claude/skills/tdbb-design/scripts/embed.py              # writes index-test.html with data embedded
python3 .claude/skills/tdbb-design/scripts/embed.py --test-agenda  # same, plus an invented upcoming stage (test copy only)
python3 -m unittest discover -s tests/python                    # script tests, real data, Python/JS cross-check
node --test tests/js/*.test.mjs                                            # page tests
python3 -m http.server 8000                                      # preview the real loading path at localhost:8000
```
