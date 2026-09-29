# Phase 9 validation record

## Automated checks

- `npm test`: unit, edge-case, schema, statistics, recovery, performance, and workflow tests.
- `npm run test:workflow`: in-process data workflow covering import → edit → build → filter → save → reopen → plotted-data export.
- `npm run test:e2e`: browser-driven Chrome tests that import a CSV fixture, edit and filter rows, reopen an embedded project, and export plotted data; they also render every graph element with the cartesian Plotly bundle, select graph points, zoom, and verify downloaded PNG and SVG files. The test runner starts and stops its own local server. The same suite also passed against `vite preview` serving the production build on 2026-09-29.
- `npm run lint` and `npm run build`: required source and production checks.
- `npm audit --audit-level=moderate`: 0 reported advisories for the updated lockfile on 2026-09-29. A future audit may differ.
- Optional real-data check: set `GB_NEBULIZER_CSV` to the user's local CSV path, then run `npm test -- src/nebulizer.test.ts`. The source file is read only and never copied into the repository. It checks 511 rows, 13 columns, numeric Drug (mg), and the imported mean against an independent calculation.

## Performance sample

On this development computer, a deterministic 10-column fixture took:

| Size | Import | Statistics plus filter | Embedded-project serialization |
| --- | ---: | ---: | ---: |
| 500 rows / 5,000 cells | 9.2 ms | 5.2 ms | 2.4 ms |
| 5,000 rows / 50,000 cells | 47.1 ms | 4.1 ms | 19.3 ms |

These are single-run measurements of data processing, not a guarantee for other computers or browser chart rendering. Repeat with `npm run test:perf` to see local results.

## Production size and accessibility

The cartesian Plotly swap reduced production JavaScript from 5.98 MB minified / 1.81 MB compressed to 3.35 MB / 1.04 MB compressed on 2026-09-29. CSS remains about 321 KB / 55 KB compressed. Vite still reports a large-chunk warning; loading the data table and Excel reader on demand remains a possible follow-up. These are build artifact sizes, not measured startup times.

Keyboard users can tab to variables, select one, and assign it through Properties without drag-and-drop. Focus outlines, descriptive graph text, import status, button labels, and a readable error recovery view were added. The chart's Plotly controls and the full workflow still need a human screen-reader pass; automated tests cannot establish accessibility by themselves.

## Remaining manual checks

- The user does not have JMP access, so a representative visual comparison with JMP cannot be completed from the supplied CSV alone. The real-data numeric import check is not a substitute for that comparison.
- Run a full keyboard/screen-reader review before declaring the roadmap's accessibility acceptance criteria complete.
