# Graph Builder: a quick guide

Graph Builder runs in your browser and keeps data on your computer. The built-in example is safe to explore: use **Reset example** to return to it. If you have work you want to keep, download an embedded project before resetting.

![Graph Builder workspace using only the built-in example data](screenshots/workspace.png)

## Start with data

Click **Import data** (or drag-and-drop over the graph area), choose a CSV, TSV, or Excel file, and select a worksheet if prompted. You can also drop a file anywhere on the app. Confirm before the new data replaces the current project. The **Variables** panel shows the imported columns; **View data table** shows the actual rows and any import warnings. Fix malformed CSV quoting or separators in the source file if an import error appears. An import can be undone with **Undo** before the session is closed.

The import check keeps annotation rows out of the measurements. See [annotation instructions](../README.md#add-graph-annotations-to-imported-data) for reference lines and acceptance regions.

## Build and refine a graph

Drag a column from **Variables** onto **X** or **Y**. To work entirely with the keyboard, select a variable, then in **Properties → Selected column** choose **Assign selected column to** and press **Assign**. Add another visual form using the **Add layer** toolbar. Click a layer in **Properties → Layers** to change its settings.

Drag a column onto **Filter**, or select it and click **Filter selected column**, to limit the rows shown in the graph and table. A filter does not delete rows. Use **View data table** to edit a cell or exclude a row. For replicate means, choose **Mean line**; its uncertainty choices include sample standard deviation, standard error, confidence interval, and range. **Bars** has the same choices when its Bar summary is **Mean**. Error bars are unavailable for sums, counts, and stacked bars. A Y-only box plot needs no X column.

If you put more than one variable on X or Y, use **Properties → Graph → X variables / Y variables** to show them together or in subplots. Choose horizontal or vertical panels, or set the panels per row. With a categorical X and Bars, **Collate bars by category** places the Y measures side by side for each category, such as Emitted Dose and Captured Dose for each Device.

Use **Properties → Graph → + Panel** to compare different X or Y variables side by side. Each panel has its own variable and axis-title controls. Double-click a displayed graph title, subtitle, panel title, or axis title to edit it in place. Press Enter to save or Escape to cancel.

## Save and reopen

Open **Projects & export**. A project can hold several graphs sharing one dataset. Choose **Embedded — include data** and **Download project** for a reliable local backup containing edits, formulas, filters, and graph appearance. **Linked — reconnect source** saves a smaller file but requires selecting the source again and does not preserve individual cell edits or excluded rows. The app makes a browser-local recovery copy, but browser storage can be cleared; keep a downloaded embedded project for important work.

![Projects and export dialog using only the built-in example data](screenshots/projects.png)

To reopen, choose **Open project…**. The app checks the file before replacing the current project and asks for confirmation. Invalid files leave the current project untouched. The **Delete** button beside a graph asks for confirmation; **Undo** can restore it before closing the project.

## Export results

Click **Save PNG** at the top for a quick image. In **Projects & export**, choose dimensions and download PNG or SVG; SVG stays sharp when enlarged. **Export plotted data CSV** downloads the values currently represented in the graph, not the whole source table.

## If something goes wrong

An import error means the file was not substituted for the current dataset. A display failure shows a **Reload Graph Builder** button and guidance for reopening your last downloaded project. If an operation seems to have replaced data unexpectedly, try **Undo** immediately. For persistent problems, keep the original source file and your last embedded project file, and report the action that caused the error.

Both screenshots show only the built-in example; no private study data is pictured.
