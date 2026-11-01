# Copilot instructions: TDBB ratings

This repo is a small static site with the Tour de Berlin Breweries results. Almost every request is "add ratings for a
brewery" (often with a photo of the paper score sheet). Everything lives in JSON under `data/`; the page (`index.html`)
reads it. Full rules: `AGENTS.md`, `.claude/skills/tdbb-ingest/SKILL.md` and `.claude/skills/tdbb-ingest/references/format.md`.

## What you may change

- Only files under `data/`. Normally just the latest season file (`data/seasons/<year>.json`, the last season in
  `data/manifest.json`). Never edit `index.html`, `tests/`, `.github/` or `.claude/`.
- Change nothing you were not asked to change. Keep the formatting: 1-space indent, one rating per line, people in the
  order they already have in that stop, file ends with a newline.

## Ratings

- Each person gives three whole numbers 0 to 5: beer, service, genius loci (`gl`). Message `ines 433` or `ines 4 3 3`
  means beer 4, service 3, gl 3. Stored as `"ines": {"beer": 4, "service": 3, "gl": 3}`.
- A half is rounded **up** (4.5 becomes 5, 0.5 becomes 1). Say so when you do it.
- Store raw ratings only. Never store averages, ranks or totals.
- Anything outside 0 to 5, two or four numbers for one person, or a digit you cannot read on the photo (1/7, 3/8, 4/9,
  scribbled over): **ask, never guess**. Blank cells mean no rating.

## Names and ids

- People and brewery ids are lowercase ASCII letters, one word. Match the name against `data/people.json` and
  `data/breweries.json` ignoring case and accents. There are no aliases: if it does not match exactly, ask who or which
  is meant. Never invent a person or brewery.
- New person or brewery only when the user says so. A new brewery needs an address, a district and a one-sentence
  highlight the user approves (no scores, opening hours or closed wording). Never store reservation numbers or private
  details; the site is public (first names and scores only).

## Where ratings go

- Into the stage whose date is today, otherwise the most recent stage that is not in the future. Never into a planned
  future stage. If the date is unclear, ask.
- Brewery already in that stage: add the ratings to its stop. Otherwise append a stop at the end of the stage.
- If a person already rated that stop it is a correction: show old and new values and get an OK first.

## Workflow

1. Read the photo or message, then show a short table (person, beer, service, gl) per brewery, and list every change
   (rounded halves, new people, corrections).
2. Ask "OK to save?" and wait for a yes before editing any file.
3. Edit the season file on a **branch** (never directly on `master`). Commit message like `2026: add Lemke ratings (7)`.
4. Open a pull request to the main repo (`berlinbreweries/berlinbreweries.github.io`, branch `master`) with the same
   title and a one-line description of what was added. CI runs `validate.py` and the tests; the owner merges when
   green. A merge goes live on GitHub Pages within about a minute.

If you cannot run `python3 .claude/skills/tdbb-ingest/scripts/validate.py data`, say that you did not validate; CI
will. Never claim the data is valid without checking.
