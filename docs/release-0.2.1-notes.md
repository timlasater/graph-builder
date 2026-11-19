# Graph Builder 0.2.1

- Refresh a linked data source across all graphs in a project. Use **Refresh linked source** in **Projects & export**, or press **Ctrl+Shift+R** in Windows. Undo restores the previous data.
- The Page dropdown, arrow buttons, and Left and Right Arrow keys skip filtered values. The arrows wrap between the first and last available pages.
- Press **Ctrl+Alt+P** to export the open graph as a PNG using the same 2× settings as **Save PNG**.
- Hover over a box plot to see how many measurements it summarizes. Click the box to select the group, an outlier to select its row, or a median or quartile line to select the matching row or the two measurements that bracket it. Open **View data table** to see the selected rows.
- Filter checklists show how many rows match each option after filters on other columns are applied.
- The recovery prompt is clearer when opening a selected project.

## Release checks

- Release branch validation passed: 205 source tests, 38 browser tests, lint, production and Pages builds, and the Pages smoke check. All six application version entries match 0.2.1.
- After merging to main, run the signed Windows workflow to generate a draft. Inspect the installer, update signature, and latest.json before publishing.
- Install the candidate on Windows. Open and save a v0.2.0 project, refresh a linked source, and verify that Ctrl+Alt+P opens the PNG save dialog. Check that opening a project from File Explorer works.
- After publication, verify the in-app update from v0.2.0 and reopen a saved project after the restart.
