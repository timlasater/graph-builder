# Phase 9 human review

These checks need a person because automated tests cannot judge spoken feedback, ease of keyboard use, or visual agreement with another graphing program. Use a downloaded embedded project as a backup before testing with important data. Record the browser, Windows version, dataset, and any step that does not behave as expected.

## Keyboard and screen-reader review

1. In PowerShell in the project folder, run `npm run dev` and open the local address printed in the terminal in Chrome. Start with the built-in example. Put the mouse aside. Use **Tab** and **Shift+Tab** to move between controls, **Enter** or **Space** to activate them, and arrow keys inside menus and select boxes. Every focused control should have a visible outline and a meaningful name.
2. Select a variable in **Variables**. Under **Properties → Selected column**, assign it to X or Y. Add a graph layer, change its type, open a filter, and inspect the data table. You should be able to reach and use each control without dragging. Check the graph's zoom and selection buttons separately; report any chart interaction that cannot be completed from the keyboard.
3. Open **Projects & export**, then the data table and a filter dialog. Focus should move into each dialog. **Tab** should stay inside it, **Shift+Tab** should wrap backward, and closing it should return focus to the button that opened it. Try **Escape** where a close action is offered. No action should silently discard the current graph or data.
4. Turn on Windows Narrator with **Windows+Ctrl+Enter** ([Microsoft's instructions](https://support.microsoft.com/en-us/accessibility/windows/narrator/chapter-1-introducing-narrator)); press the same keys to stop it. Repeat the import, assignment, filtering, table, project, and export steps. The reader should announce each control's name, type, current value or state, dialog title, and import/error status. A second pass with [NVDA](https://www.nvaccess.org/download/) is useful if available.
5. In Chrome, set zoom to 200%. Check that text and controls remain readable and usable, focus stays visible, and required controls are reachable. Check the light, dark, and print graph themes. Record any clipped text or color pairing that is hard to read.

For a failure, note the exact control, keystrokes, what was spoken or displayed, and what you expected. A screenshot helps with visual issues; avoid including private data in screenshots shared publicly.

## Comparison with another graphing program

Use free [R](https://www.r-project.org/) or JMP if available, with the same dataset. If R is new to you, follow the [step-by-step R practice comparison](r-visual-comparison.md) first. The independent [SciPy comparison](phase-9-validation.md#free-independent-statistics-comparison) already verifies representative calculations; this manual check focuses on the remaining graph presentation and exported plotted values. An additional local import check on a private CSV confirmed its dimensions and one mean; it did not compare graphs.

1. Open the same local dataset in the reference program and Graph Builder. Record which rows are filtered or excluded, the X and Y columns, grouping/color column, units, category order, and any missing values. Use identical rows in both programs.
2. Make representative point, line, bar, histogram, and box graphs. Compare category labels and order, plotted positions, group colors, axis limits, and missing-value behavior. Export Graph Builder's plotted-data CSV to compare underlying numbers, not only the picture.
3. Compare a mean graph with sample SD, standard error, and a 95% two-sided Student's t confidence interval. Match the statistical definitions and confidence level in the reference program before comparing. Check groups with different sample sizes and a group with a missing response. Graph Builder's raw sample SD divides by `n − 1`; its quartiles use linear interpolation, so another quartile setting can yield a legitimate difference.
4. Compare a linear fit's slope, intercept, sample size, and R². Try a fixed intercept only if the reference graph uses the same constraint. Compare one smoothed trend only after matching its documented centered moving-average window and handling of repeated X values.
5. Note each result as **match**, **expected method difference**, or **unexplained difference**. For an unexplained difference, save the graph settings, the affected values or a de-identified subset, and the reference program's calculation settings so it can be reproduced without sharing private data.

Phase 9's human acceptance checks are complete only after both reviews are recorded and any unexplained differences or accessibility blockers are resolved.

## Review notes — September 29, 2026

- User reports that the keyboard and Windows Narrator checks passed, except that dropdowns had no visible Tab focus outline and Escape did not close the data table. Both were fixed and later passed manual retest.
- User found that clearing the moving-average window immediately reset it to 1, making a custom number difficult to enter. The field now permits an empty draft while editing and sets it to 1 only when focus leaves the empty field; the fix later passed manual retest.
- At 200% Chrome zoom, all panels are difficult to fit on screen, but the graph can be reached by scrolling. This is recorded as usable with scrolling, not a full simultaneous-panel view.
- JMP comparisons were not run because the user does not have access to JMP. A free SciPy/NumPy numerical comparison passes.
- R 4.6.1 was subsequently used for a public 16-row practice-data comparison. All seven browser tests passed, including comparison of Graph Builder's graph exports with R's results. Graph shapes and plotted values agreed on inspection; R's default box hinges are an expected method difference. The private CSV was not used for this additional comparison.

## Sign-off — September 29, 2026

The user confirms that visual comparisons with R pass and that the corrected dropdown focus outline, Escape closing the data table, and moving-average number entry all pass manual retest. The earlier keyboard and Windows Narrator review passed. The 200% zoom layout remains usable by scrolling. There are no unexplained statistical differences or accessibility blockers reported, so the required Phase 9 human reviews are complete. Comparing the private CSV with R would be optional additional coverage.
