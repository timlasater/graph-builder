# Phase 9 validation record

Automated validation is complete. Human keyboard/screen-reader and JMP comparisons remain open; follow the [manual review instructions](phase-9-manual-checks.md) before marking Phase 9 complete.

## Automated checks

- `npm test`: unit, edge-case, schema, statistics, recovery, performance, and workflow tests.
- `npm run test:workflow`: in-process data workflow covering import → edit → build → filter → save → reopen → plotted-data export.
- `npm run test:e2e`: browser-driven Chrome tests cover import → edit → build → filter → save → reopen → export; every graph element, point selection, zoom, and PNG/SVG downloads; 5,000-row / 50,000-cell import and graph rendering; WCAG A/AA automated scans of the workspace in light, dark, and print themes, plus the Projects dialog, data table, and filter dialog; dialog focus behavior; and recovery of older browser-saved graphs as templates. The runner starts and stops its own local server.
- `npm run lint` and `npm run build`: required source and production checks.
- Clean-checkout check on 2026-09-29: a fresh local clone completed `npm ci`, `npm test`, `npm run lint`, `npm run build`, and `npm run test:e2e`. The browser suite passed when rerun without the resource load of the parallel unit/build commands.
- `npm audit --audit-level=moderate`: 0 reported advisories for the updated lockfile on 2026-09-29. A future audit may differ.
- The user ran the optional real-data check on 2026-09-29: all 126 tests passed, including the 511-row, 13-column nebulizer CSV check. The source file is read only and never copied into the repository. Repeat with `GB_NEBULIZER_CSV` set to its local path and `npm test -- src/nebulizer.test.ts` if needed.

## Performance sample

On this development computer, a deterministic 10-column fixture most recently took:

| Size | Import | Statistics plus filter | Embedded-project serialization |
| --- | ---: | ---: | ---: |
| 500 rows / 5,000 cells | 11.9 ms | 5.3 ms | 3.6 ms |
| 5,000 rows / 50,000 cells | 132.4 ms | 9.7 ms | 46.7 ms |

The browser test imported and rendered the 5,000-row fixture in about 0.8–1.0 seconds on this computer, then opened the data table and kept the controls usable. These are single-run measurements, not a guarantee for other computers. Repeat with `npm run test:perf` and `npm run test:e2e` to see local results.

## Production size and accessibility

The cartesian Plotly swap reduced production JavaScript from 5.98 MB minified / 1.81 MB compressed to 3.35 MB / 1.04 MB compressed on 2026-09-29. CSS remains about 321 KB / 55 KB compressed. Vite still reports a large-chunk warning; loading the data table and Excel reader on demand remains a possible follow-up. These are build artifact sizes, not measured startup times.

Keyboard users can tab to variables, select one, and assign it through Properties without drag-and-drop. Contrast and nested-control issues found by the automated audit were fixed, and dialog focus now enters the dialog, cycles inside it, and returns to its opener. The automated WCAG A/AA scans pass for the main workspace and primary dialogs. Plotly's chart controls and the full workflow still need a human screen-reader pass; automated tests cannot establish accessibility by themselves.

## Remaining manual checks

- Perform and record the [keyboard/screen-reader review](phase-9-manual-checks.md#keyboard-and-screen-reader-review).
- Compare representative graphs with JMP or trusted JMP exports using the [comparison procedure](phase-9-manual-checks.md#comparison-with-jmp). The user does not currently have JMP access; the real-data numeric import check does not replace this review.
