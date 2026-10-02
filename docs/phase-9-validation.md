# Phase 9 validation record

Phase 9 is complete as of 2026-09-29. Automated checks, independent statistical comparisons, and the human keyboard, Windows Narrator, focus, Escape, number-entry, and R visual reviews pass. The [manual review record](phase-9-manual-checks.md) contains the reported findings and sign-off.

## Automated checks

- `npm test`: unit, edge-case, schema, statistics, recovery, performance, and workflow tests.
- `npm run test:workflow`: in-process data workflow covering import → edit → build → filter → save → reopen → plotted-data export.
- `npm run test:e2e`: browser-driven Chrome tests cover import → edit → build → filter → save → reopen → export; every graph element, point selection, zoom, and PNG/SVG downloads; 5,000-row / 50,000-cell import and graph rendering; WCAG A/AA automated scans of the workspace in light, dark, and print themes, plus the Projects dialog, data table, and filter dialog; dialog focus behavior; and recovery of older browser-saved graphs as templates. The runner starts and stops its own local server.
- `npm run lint` and `npm run build`: required source and production checks.
- Clean-checkout check on 2026-09-29: a fresh local clone completed `npm ci`, `npm test`, `npm run lint`, `npm run build`, and `npm run test:e2e`. The browser suite passed when rerun without the resource load of the parallel unit/build commands.
- `npm audit --audit-level=moderate`: 0 reported advisories for the updated lockfile on 2026-09-29. A future audit may differ.
- An additional local import check on a private 511-row, 13-column CSV passed on 2026-09-29. The source file was read locally and never copied into the repository. The public automated suite uses synthetic fixtures.
- Final Phase 9 sign-off run on 2026-09-29: 131 unit tests passed, all 7 browser tests passed, and lint and production build passed.

## Free independent statistics comparison

SciPy 1.18.1 and NumPy 2.3.5 were used as independent, free reference implementations on 2026-09-29. The reproducible [reference script](../scripts/scipy_reference.py) does not import Graph Builder code. Its results are recorded in [automated comparison tests](../src/scipyReference.test.ts), which pass without requiring SciPy to be installed for ordinary project tests.

The comparison covered three groups with unequal sample sizes, one missing response, and a one-observation group; mean, sample SD, standard error, linear-interpolation quartiles, and the half-width of a 95% two-sided Student's t interval; ordinary and fixed-intercept linear fits with slope, intercept, and R²; a centered moving average after repeated X values are combined; frequency-expanded observations; histogram counts; and box-plot whiskers and outliers. All compared numeric values matched within the tests' floating-point tolerance.

This verifies representative calculations independently of Graph Builder's implementation. SciPy alone does not establish graph appearance; the R comparison below addresses representative visual graphs without a JMP license.

## R graph comparison on public practice data

On 2026-09-29, R 4.6.1 ran the [base-R reference script](../scripts/r_visual_reference.R) against the [16-row practice CSV](../test-data/r-visual-reference.csv). It generated point, line, mean-bar, box, histogram, linear-fit, and smooth-trend PNGs plus numeric result CSVs under the ignored `test-results/r-visual/` directory. The [browser comparison test](../e2e/r-visual-reference.spec.ts) imported the same file into Graph Builder and checked its downloaded plotted-data CSV against R's results. All seven browser tests passed, including this comparison.

The comparison found matching valid point counts and positions; group means and 95% confidence-interval widths; line groups; linear-interpolation quartiles; five histogram counts; fitted line values; and the five smoothed values. I inspected the two programs' images for all seven graph types: the plotted positions, group order, error-bar extents, outlier, histogram bins, and line shapes agreed. R's default box edges use hinges, while Graph Builder's exported quartiles use linear interpolation; that is an expected method difference. To regenerate the screenshots in PowerShell, run `$env:GB_CAPTURE_R_REFERENCE = '1'; npm run test:e2e` first, then `& 'C:\Program Files\R\R-4.6.1\bin\Rscript.exe' scripts/r_visual_reference.R` from the project folder. The browser runner clears `test-results` when it starts, so run R last.

This checks graph presentation on a small public dataset. The user subsequently confirmed that the visual comparisons with R pass. A separate comparison of the private CSV was not part of Phase 9 sign-off.

## Performance sample

On this development computer, a deterministic 10-column fixture most recently took:

| Size | Import | Statistics plus filter | Embedded-project serialization |
| --- | ---: | ---: | ---: |
| 500 rows / 5,000 cells | 11.9 ms | 5.3 ms | 3.6 ms |
| 5,000 rows / 50,000 cells | 132.4 ms | 9.7 ms | 46.7 ms |

The browser test imported and rendered the 5,000-row fixture in about 0.8–1.0 seconds on this computer, then opened the data table and kept the controls usable. These are single-run measurements, not a guarantee for other computers. Repeat with `npm run test:perf` and `npm run test:e2e` to see local results.

## Production size and accessibility

The cartesian Plotly swap reduced production JavaScript from 5.98 MB minified / 1.81 MB compressed to 3.35 MB / 1.04 MB compressed on 2026-09-29. CSS remains about 321 KB / 55 KB compressed. Vite still reports a large-chunk warning; loading the data table and Excel reader on demand remains a possible follow-up. These are build artifact sizes, not measured startup times.

Keyboard users can tab to variables, select one, and assign it through Properties without drag-and-drop. Contrast and nested-control issues found by the automated audit were fixed, and dialog focus now enters the dialog, cycles inside it, and returns to its opener. The automated WCAG A/AA scans pass for the main workspace and primary dialogs. The user reports that the keyboard and Windows Narrator workflow passes and has now also confirmed the three subsequent fixes pass on manual retest.

## Sign-off

No required Phase 9 checks remain. The user confirmed the R visual comparison and the dropdown focus outline, data-table Escape behavior, and moving-average number-entry fixes. At 200% zoom, the graph remains reachable by scrolling; simultaneous display of every panel is limited. The R box-edge hinge difference is documented as an expected method difference, with matching exported quartiles.
