# Phase 9 human review

These checks need a person because automated tests cannot judge spoken feedback, ease of keyboard use, or visual agreement with JMP. Use a downloaded embedded project as a backup before testing with important data. Record the browser, Windows version, dataset, and any step that does not behave as expected.

## Keyboard and screen-reader review

1. In PowerShell in the project folder, run `npm run dev` and open the local address printed in the terminal in Chrome. Start with the built-in example. Put the mouse aside. Use **Tab** and **Shift+Tab** to move between controls, **Enter** or **Space** to activate them, and arrow keys inside menus and select boxes. Every focused control should have a visible outline and a meaningful name.
2. Select a variable in **Variables**. Under **Properties → Selected column**, assign it to X or Y. Add a graph layer, change its type, open a filter, and inspect the data table. You should be able to reach and use each control without dragging. Check the graph's zoom and selection buttons separately; report any chart interaction that cannot be completed from the keyboard.
3. Open **Projects & export**, then the data table and a filter dialog. Focus should move into each dialog. **Tab** should stay inside it, **Shift+Tab** should wrap backward, and closing it should return focus to the button that opened it. Try **Escape** where a close action is offered. No action should silently discard the current graph or data.
4. Turn on Windows Narrator with **Windows+Ctrl+Enter** ([Microsoft's instructions](https://support.microsoft.com/en-us/accessibility/windows/narrator/chapter-1-introducing-narrator)); press the same keys to stop it. Repeat the import, assignment, filtering, table, project, and export steps. The reader should announce each control's name, type, current value or state, dialog title, and import/error status. A second pass with [NVDA](https://www.nvaccess.org/download/) is useful if available.
5. In Chrome, set zoom to 200%. Check that text and controls remain readable and usable, focus stays visible, and required controls are reachable. Check the light, dark, and print graph themes. Record any clipped text or color pairing that is hard to read.

For a failure, note the exact control, keystrokes, what was spoken or displayed, and what you expected. A screenshot helps with visual issues; avoid including private data in screenshots shared publicly.

## Comparison with JMP

This check requires JMP or trusted JMP exports of the same dataset. The optional 511-row nebulizer CSV import test confirms row count, column count, and one mean; it does not compare graphs.

1. Open the same local dataset in JMP and Graph Builder. Record which rows are filtered or excluded, the X and Y columns, grouping/color column, units, category order, and any missing values. Use identical rows in both programs.
2. Make representative point, line, bar, histogram, and box graphs. Compare category labels and order, plotted positions, group colors, axis limits, and missing-value behavior. Export Graph Builder's plotted-data CSV to compare underlying numbers, not only the picture.
3. Compare a mean graph with sample SD, standard error, and a 95% two-sided Student's t confidence interval. Match the statistical definitions and confidence level in JMP before comparing. Check groups with different sample sizes and a group with a missing response. Graph Builder's raw sample SD divides by `n − 1`; its quartiles use linear interpolation, so a different JMP quartile setting can yield a legitimate difference.
4. Compare a linear fit's slope, intercept, sample size, and R². Try a fixed intercept only if the JMP graph uses the same constraint. Compare one smoothed trend only after matching its documented centered moving-average window and handling of repeated X values.
5. Note each result as **match**, **expected method difference**, or **unexplained difference**. For an unexplained difference, save the graph settings, the affected values or a de-identified subset, and JMP's calculation settings so it can be reproduced without sharing private data.

Phase 9's human acceptance checks are complete only after both reviews are recorded and any unexplained differences or accessibility blockers are resolved.
