# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-10

First documented release. Content corrections and additions to the German
logbook companion app.

### Added
- **Planet record sheet "ISS Vanguard"** — added to the Planeten feature
  (`app/static/forms/planets.json`). Reachable at `/planet/iss-vanguard`, uses
  the shared record-sheet template, with per-savegame field persistence.

### Fixed
- **P188 instruction image** — the second part of the printed instructions was
  cut off at the page break and is now included ("Ersetze die Karte in diesem
  Sektor durch Karte P230." plus the Gegnervorteil hint).
- **Crop pipeline — opposite-column continuations** — a left/right crop override
  was applied to every region of a protocol, inverting the crop band on a
  continuation region in the opposite column and silently dropping its text.
  Overrides are now column-aware (`left` applies only to right-column regions,
  `right` only to left-column regions). This also restored dropped continuation
  text in P211, P421, P441, P496, P633, P723, and P727.
- **P454 Fortschritt labels** — the three option labels each bled into the next
  option's text; they now show one option each (Protokoll 605 / 619 / 731).
- **P608 Fortschritt checkbox** — the printed checkbox was missing from the
  progress panel and is now shown.
- **P999 star map** — added the missing connection between LCS-17 and Kepler 831
  (cost 3) to the map image.

[1.0.0]: https://github.com/mackay2k4/iss-vanguard-audio-logbook-de/releases/tag/v1.0.0
