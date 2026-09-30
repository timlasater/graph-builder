# Phase 9 validation record

Automated validation and an independent numerical comparison are complete. The user reports that keyboard and Windows Narrator checks pass, with the focus, Escape, and number-entry issues addressed in code. A manual retest of those fixes and a representative visual graph comparison remain before Phase 9 is complete; see the [manual review instructions](phase-9-manual-checks.md).

## Automated checks

- `npm test`: unit, edge-case, schema, statistics, recovery, performance, and workflow tests.
- `npm run test:workflow`: in-process data workflow covering import → edit → build → filter → save → reopen → plotted-data export.
- `npm run test:e2e`: browser-driven Chrome tests cover import → edit → build → filter → save → reopen → export; every graph element, point selection, zoom, and PNG/SVG downloads; 5,000-row / 50,000-cell import and graph rendering; WCAG A/AA automated scans of the workspace in light, dark, and print themes, plus the Projects dialog, data table, and filter dialog; dialog focus behavior; and recovery of older browser-saved graphs as templates. The runner starts and stops its own local server.
- `npm run lint` and `npm run build`: required source and production checks.
- Clean-checkout check on 2026-09-29: a fresh local clone completed `npm ci`, `npm test`, `npm run lint`, `npm run build`, and `npm run test:e2e`. The browser suite passed when rerun without the resource load of the parallel unit/build commands.
- `npm audit --audit-level=moderate`: 0 reported advisories for the updated lockfile on 2026-09-29. A future audit may differ.
- The user ran the optional real-data check on 2026-09-29: all 126 tests passed, including the 511-row, 13-column nebulizer CSV check. The source file is read only and never copied into the repository. Repeat with `GB_NEBULIZER_CSV` set to its local path and `npm test -- src/nebulizer.test.ts` if needed.

## Free independent statistics comparison

SciPy 1.18.1 and NumPy 2.3.5 were used as independent, free reference implementations on 2026-09-29. The reproducible [reference script](../scripts/scipy_reference.py) does not import Graph Builder code. Its results are recorded in [automated comparison tests](../src/scipyReference.test.ts), which pass without requiring SciPy to be installed for ordinary project tests.

The comparison covered three groups with unequal sample sizes, one missing response, and a one-observation group; mean, sample SD, standard error, linear-interpolation quartiles, and the half-width of a 95% two-sided Student's t interval; ordinary and fixed-intercept linear fits with slope, intercept, and R²; a centered moving average after repeated X values are combined; frequency-expanded observations; histogram counts; and box-plot whiskers and outliers. All compared numeric values matched within the tests' floating-point tolerance.

This verifies representative calculations independently of Graph Builder's implementation. It does not establish that every graph's labels, category order, colors, or appearance match JMP or another graphing program, and it does not compare the user's full nebulizer dataset. No JMP license is needed for the numerical check. A free tool such as [R](https://www.r-project.org/) can be used for the remaining visual comparison.

## R graph comparison on public practice data

On 2026-09-29, R 4.6.1 ran the [base-R reference script](../scripts/r_visual_reference.R) against the [16-row practice CSV](../test-data/r-visual-reference.csv). It generated point, line, mean-bar, box, histogram, linear-fit, and smooth-trend PNGs plus numeric result CSVs under the ignored `test-results/r-visual/` directory. The [browser comparison test](../e2e/r-visual-reference.spec.ts) imported the same file into Graph Builder and checked its downloaded plotted-data CSV against R's results. All seven browser tests passed, including this comparison.

The comparison found matching valid point counts and positions; group means and 95% confidence-interval widths; line groups; linear-interpolation quartiles; five histogram counts; fitted line values; and the five smoothed values. I inspected the two programs' images for all seven graph types: the plotted positions, group order, error-bar extents, outlier, histogram bins, and line shapes agreed. R's default box edges use hinges, while Graph Builder's exported quartiles use linear interpolation; that is an expected method difference. To regenerate the screenshots in PowerShell, run `$env:GB_CAPTURE_R_REFERENCE = '1'; npm run test:e2e` first, then `& 'C:\Program Files\R\R-4.6.1\bin\Rscript.exe' scripts/r_visual_reference.R` from the project folder. The browser runner clears `test-results` when it starts, so run R last.

This checks graph presentation on a small public dataset. The user's full nebulizer CSV was not available in this session, so a comparison on that dataset remains open.

## Performance sample

On this development computer, a deterministic 10-column fixture most recently took:

| Size | Import | Statistics plus filter | Embedded-project serialization |
| --- | ---: | ---: | ---: |
| 500 rows / 5,000 cells | 11.9 ms | 5.3 ms | 3.6 ms |
| 5,000 rows / 50,000 cells | 132.4 ms | 9.7 ms | 46.7 ms |

The browser test imported and rendered the 5,000-row fixture in about 0.8–1.0 seconds on this computer, then opened the data table and kept the controls usable. These are single-run measurements, not a guarantee for other computers. Repeat with `npm run test:perf` and `npm run test:e2e` to see local results.

## Production size and accessibility

The cartesian Plotly swap reduced production JavaScript from 5.98 MB minified / 1.81 MB compressed to 3.35 MB / 1.04 MB compressed on 2026-09-29. CSS remains about 321 KB / 55 KB compressed. Vite still reports a large-chunk warning; loading the data table and Excel reader on demand remains a possible follow-up. These are build artifact sizes, not measured startup times.

Keyboard users can tab to variables, select one, and assign it through Properties without drag-and-drop. Contrast and nested-control issues found by the automated audit were fixed, and dialog focus now enters the dialog, cycles inside it, and returns to its opener. The automated WCAG A/AA scans pass for the main workspace and primary dialogs. The user reports that the keyboard and Windows Narrator workflow passes; the three subsequent fixes still need a brief manual retest.

## Remaining manual checks

- Manually retest the three reported keyboard and input fixes in the [review notes](phase-9-manual-checks.md#review-notes--september-29-2026).
- If a broader visual check is needed, repeat the [R walkthrough](r-visual-comparison.md) on a de-identified subset of the user's nebulizer dataset. The public practice dataset and representative calculations have already been compared.
