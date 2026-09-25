# Graph Builder Development Roadmap

This document is the working handoff for future coding agents. Continue the existing application; do not replace it with a new scaffold.

## Product goal

Build an offline-first, Windows-focused scientific graph builder inspired by JMP Graph Builder. The primary user is an engineer rather than a software developer, so changes should be explained in plain language and demonstrated through visible workflows.

The application must comfortably handle typical files with 100–500 rows and 1,000–10,000 cells, and a practical maximum of approximately 5,000 rows and 50,000 populated cells. Dataset contents must remain local. The browser version is the development target until it is stable; Windows desktop packaging comes last.

This is an independent product inspired by a workflow. Do not copy JMP branding, proprietary assets, or source code.

## Current implementation

The project currently uses React, TypeScript, Vite, Zustand, dnd-kit, Plotly.js Basic, AG Grid Community, Papa Parse, and SheetJS.

Already working:

- Three-panel Graph Builder interface with a built-in engineering dataset
- CSV, TSV, TXT, XLSX, and XLS import, including Excel worksheet selection
- Numeric, text, Boolean, and date/time inference
- Editable, sortable, filterable, paginated data table
- Column renaming, units, data types, and modeling types
- Row inclusion and exclusion
- X, Y, Color, Group X, Group Y, Wrap, Overlay, and Size roles
- Moving assignments between roles or back to the Variables panel
- Compatibility handling between Wrap and Group X/Group Y
- Points, lines, and basic bars
- Color grouping, overlays, marker-size mapping, grouped panels, and wrapped facets
- Titles, subtitles, marker size, grid visibility, hover details, zoom, and legend interaction
- Undo and redo for graph-specification changes

Before starting work, run:

```powershell
npm install
npm test
npm run lint
npm run build
```

Keep these checks passing. Add focused tests with each behavioral change. Do not weaken types or tests to make a change pass.

## Implementation principles

1. Keep the dataset model and renderer-independent graph specification separate from Plotly configuration. Plotly is an output adapter, not the saved project format.
2. Keep all data processing local. Do not add analytics, cloud storage, remote APIs, or a server dependency.
3. Prefer small, testable pure functions for statistics, filtering, grouping, and graph transformations.
4. Never evaluate arbitrary JavaScript entered as a formula. Formula support must use a restricted parser and an explicit function allowlist.
5. Every statistical choice must be documented and tested against independently verified reference values. Sample standard deviation uses `n - 1`; confidence intervals use an appropriate Student's t critical value for small samples.
6. Preserve existing drag/drop behavior, assignments, import support, and history unless a change explicitly improves them.
7. Keep controls understandable to a non-programmer. Use engineering language, useful defaults, inline validation, and actionable error messages.
8. Test with missing values, unequal group sizes, one-observation groups, mixed column types, and excluded rows—not only ideal datasets.
9. Optimize only after measuring, but do not introduce designs that require loading copies of the entire dataset for every mouse movement.
10. Complete and verify one coherent vertical slice at a time.

## Phase 2 completion — Data quality and formulas

Status: complete (September 2026). Import diagnostics, missingness summaries, Excel paste, stable-ID calculated columns, value labels, persistent filters, dataset undo/redo, and representative fixtures are implemented and tested.

Finish the remaining data-table capabilities before expanding the plot engine.

Deliverables:

- Paste rectangular tabular data copied from Excel
- Import warnings for duplicate headings, empty headings, mixed types, invalid dates, and lossy coercions
- A visible missing-value summary per column
- Basic calculated columns using a restricted expression engine
- Formula references by stable column ID while displaying friendly column names
- Clear formula errors with no partial dataset mutation
- Optional value labels such as `1 = Prototype A`
- Explicit row filtering stored in application state rather than only AG Grid's transient UI state
- Representative fixtures for raw replicates, precomputed summaries, missing observations, and unequal sample sizes

Minimum formula functions: arithmetic, parentheses, `abs`, `sqrt`, `log`, `exp`, `min`, `max`, and a conditional function. Division by zero and invalid-domain results must become missing values with warnings rather than crash the app.

Acceptance criteria:

- A user can import a real engineering workbook, see all import warnings, correct types, add a calculated column, filter/exclude rows, and graph the result without editing the source file.
- Undo restores the entire dataset after a column edit, formula creation, or bulk exclusion.
- Import and formula tests cover blank cells, duplicate headings, mixed types, and invalid formulas.

## Phase 3 completion — Full Graph Builder interaction

Status: complete (September 2026). Ordered multi-variable axes, layered marks/summaries/fits, per-layer overrides, Shape/Frequency/Page roles, suggestions, compatibility feedback, and atomic interaction history are implemented and tested.

Extend the existing role system instead of creating graph-specific configuration dialogs.

Deliverables:

- Multiple variables on X and Y
- Reordering multiple assignments within a role
- A layer model allowing points, lines, bars, summaries, and fits on the same graph
- Per-layer variable and formatting settings
- Swap X/Y action
- Shape role and Frequency role for nonnegative whole-number observation counts
- Page role for stepping through subsets
- Type-aware graph suggestions that remain user-overridable
- Clear drag previews and compatibility messages
- Atomic undo/redo for every drag, reorder, replacement, and layer operation

Define compatibility rules in one tested module. Avoid scattering special cases across components.

Acceptance criteria:

- A user can build a grouped engineering graph with multiple responses and two layers entirely by dragging.
- Invalid drops either replace the conflicting assignment predictably or show a concise explanation.
- Assignments survive element changes without silently losing information.

## Phase 4 — Plot types and layer engine

Status: complete (September 2026). Histogram, box-plot, aggregated grouped/stacked bar, area/stacked-area, multi-layer, and reference-line/region paths are implemented with transformation tests and stacking validation.

Implement plotting paths in this order:

1. Histograms
2. Box plots
3. Grouped and stacked bars
4. Area and stacked-area plots
5. Multiple overlaid layers
6. Reference lines and shaded specification/acceptance regions

Refactor `GraphCanvas` as the layer count grows. Use separate transformation functions and renderer adapters rather than one increasingly large component.

Key behavior:

- Histograms need configurable bin count or width.
- Box plots must identify outliers consistently and optionally display raw observations.
- Bar modes must distinguish raw records from aggregated summaries.
- Stacking is valid only for compatible values; warn instead of producing misleading output.
- Layers share role assignments by default but may override them deliberately.

Acceptance criteria:

- All plot types respect exclusions, filters, grouping, facets, units, and missing values consistently.
- Switching plot types does not mutate source data.
- Each plot type has transformation tests and at least one interaction test.

## Phase 5 — Statistical transformation engine

Status: in progress. Mean layers now support tested SD, SE, selectable two-sided Student's t confidence intervals, range error bars, and optional source-observation overlays; the remaining deliverables below are not yet complete.

This is the highest-risk phase. Build statistics as a standalone tested module before wiring controls into the UI.

Deliverables:

- Count/sample size, sum, mean, median, min, max, quantiles, sample SD, and SE
- SD, SE, confidence-interval, and range error bars
- User-selectable confidence level
- Individual observations over summary layers
- Precomputed mean/error input mode without fabricating raw replicates
- Unequal sample-size support
- Warnings for missing uncertainty values and groups with fewer than two observations
- Percentage-of-total and normalization-to-control transformations
- Linear regression with equation, sample size, and R-squared
- Smoothed trend line with clearly documented method and parameters

Statistical rules:

- Excluded and filtered rows never enter calculations.
- Missing response values are omitted and the effective `n` is reported.
- Do not silently substitute zero for missing measurements or errors.
- Confidence intervals must state the definition used.
- Precomputed and raw-data modes must remain distinguishable in the data model and UI.

Acceptance criteria:

- Results match JMP or another independently verified reference dataset within documented floating-point tolerance.
- Tests include hand-calculable samples, missing values, `n = 1`, unequal groups, and precomputed summaries.
- A user can create mean ± SD and mean ± 95% CI graphs and optionally overlay replicates.

## Phase 6 — Filtering and linked exploration

Deliverables:

- Persistent categorical, numeric-range, date, and missing-value filters
- Filter panel with searchable categorical levels
- Immediate recomputation of every layer and statistic
- Click a point/bar/box to identify source rows
- Linked selection between graph and data table
- Box/lasso selection and bulk include/exclude actions
- Highlight a group without filtering other groups
- Page-role controls for stepping through subsets
- Shared or independent facet scales

Acceptance criteria:

- Graph, table, statistics, and displayed sample sizes always reflect the same active-row set.
- Selections remain responsive at the maximum target dataset size.
- The UI distinguishes selection, filtering, hiding, and exclusion.

## Phase 7 — Axes and appearance

Status: not started as a milestone. Interactive legend reordering, matching categorical bar order, per-series recoloring, and item visibility were implemented early during Phase 5.

Deliverables:

- Automatic/manual axis bounds, linear/log scale, reversed axes, and force-zero option
- Configurable tick intervals and date/time axes
- Category ordering by data order, alphabetic order, summary statistic, or manual order
- Titles, units, fonts, graph dimensions, and aspect ratio
- Marker shape, size, transparency, and jitter
- Line color, width, and style
- Bar width/spacing and error-bar cap/style controls
- Custom and colorblind-accessible palettes
- Legend placement, ordering, renamed entries, and item visibility
- Multiple reference lines and shaded benchmark/specification regions
- Reusable visual themes

Acceptance criteria:

- A standard engineering figure can be prepared for a report without post-processing in PowerPoint.
- Log scales reject zero/negative values with a useful message.
- Visual settings serialize without Plotly-specific fields leaking into the saved format.

## Phase 8 — Projects and export

Status: not started as a milestone. Versioned local plot-setup presets that reapply graph specifications and filters to a compatible open dataset were implemented early; full projects still require dataset persistence, migrations, and export.

Deliverables:

- Versioned `.graphbuilder.json` project format
- Schema validation and migrations for older project versions
- Embedded-data and linked-file modes, with a clear offline explanation
- Local autosave and recovery
- Reopen, duplicate, and rename graphs
- Graph templates reusable with compatible datasets
- PNG and SVG export with selected dimensions and resolution
- Copy graph to Windows clipboard if practical in the browser; otherwise implement during desktop packaging
- Export summarized plot data

Acceptance criteria:

- Saving, closing, and reopening reproduces the dataset, formulas, filters, graph specification, and appearance.
- SVG remains sharp and usable in PowerPoint or Illustrator.
- Corrupt or incompatible projects show recovery guidance and never destroy the current session.

## Phase 9 — Validation and hardening

Deliverables:

- End-to-end tests for import → edit → build → filter → save → reopen → export
- Reference tests for every statistic
- Performance measurements at 500 rows and at the 5,000-row/50,000-cell maximum
- Import fuzz/edge-case tests and project-schema tests
- Keyboard navigation, focus states, labels, contrast, and screen-reader review
- Friendly error boundary and recovery paths
- Dependency audit and production build-size review
- Manual comparison with representative JMP graphs using the user's nebulizer datasets
- Plain-language user guide with screenshots

Acceptance criteria:

- No known data-loss paths or incorrect silent statistical results.
- Typical interactions feel immediate; long imports/calculations show progress without freezing the interface.
- `npm test`, `npm run lint`, `npm run build`, and the end-to-end suite all pass from a clean checkout.

## Phase 10 — Windows desktop packaging

Start only after the browser application and project format are stable.

Deliverables:

- Tauri wrapper using the existing frontend
- Native open/save dialogs
- Windows installer and uninstall flow
- File association for `.graphbuilder.json`
- Recent-project list
- Fully offline runtime and packaged assets
- Application signing and update strategy decided before distribution beyond the user

Do not introduce Electron. Tauri is preferred for a smaller Windows application, but validate all prerequisites and WebView behavior before committing to installer details.

Acceptance criteria:

- A clean Windows machine can install, run, import a workbook, save/reopen a project, and export a graph without Node.js, internet access, or a development server.

## Suggested next task

Continue Phase 5 with precomputed summary/error inputs, the remaining descriptive statistics, normalization transformations, and regression diagnostics.

## Definition of done for every task

- The requested workflow works visibly in the running app.
- Existing workflows still work.
- State changes are undoable when appropriate.
- New calculation or transformation logic has unit tests.
- User-facing failure modes have clear messages.
- `npm test`, `npm run lint`, and `npm run build` pass.
- README and this roadmap are updated when capabilities or sequencing change.
