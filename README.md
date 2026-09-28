# Graph Builder

An offline-first, Windows-focused scientific graph builder inspired by JMP Graph Builder's variable-to-role workflow.

## Current milestone

- Three-panel desktop-style interface
- Typed example engineering dataset
- Drag variables onto X, Y, Color, Group X, Group Y, Wrap, Overlay, and Size roles
- Multiple ordered assignments on X and Y, with drag reordering and Swap X/Y
- Shape, Frequency, and Page roles with subset stepping
- Layered points, lines, histograms, box plots, grouped/stacked bars, area/stacked-area plots, replicate-mean lines, and linear fits
- Fit lines can optionally show the equation and R², and can be constrained to a chosen y-intercept
- Per-layer variable overrides, colors, marker sizes, and line widths
- Type-aware graph suggestions and centralized compatibility feedback
- Mean-line error bars for sample SD, standard error, selectable two-sided Student's t confidence intervals, and range
- Optional source-observation overlays on mean layers
- Grouped panels, wrapped facet grids, and custom panels with different X/Y variables
- Box plots with a Y variable alone, without an X assignment
- Overlay traces and numeric marker-size mapping
- Move assigned variables directly between roles or drag them back to the Variables panel
- Automatic replacement of incompatible Wrap and Group X/Y assignments (version 1 limitation)
- Local CSV, TSV, XLSX, and XLS import
- Excel worksheet selection
- Reference lines and acceptance regions imported from tagged data rows or a Graph Annotations worksheet
- Automatic numeric, text, Boolean, and date/time inference
- Editable, sortable, filterable, paginated data table with row exclusion
- Column renaming and manual data/modeling-type controls
- Import-quality warnings and per-column missing-value summaries
- Rectangular tab-separated paste from Excel
- Drag-to-filter drop target with categorical checklists and numeric bounds, shared by the data table and graph
- Restricted calculated columns with atomic errors and domain warnings
- Optional value labels such as `1 = Prototype A`
- Interactive points, lines, and bar charts
- Hover tooltips and Plotly zoom controls
- Editable title, subtitle, grid lines, and marker size
- Manual/automatic axis bounds, linear or logarithmic numeric scales, reverse direction, zero inclusion, tick intervals, and date axes
- Category ordering by data order, name, response mean, or manual move controls
- Reusable light, dark, and print themes; font, figure dimensions, aspect ratio, marker, line, bar, and uncertainty styling
- Standard, colorblind-accessible, monochrome, and custom palettes; legend placement and double-click entry renaming
- Reference lines and shaded specification/acceptance regions across facets
- Draggable legend ordering with matching categorical bar order, per-series colors, and click-to-hide visibility
- Searchable categorical filters, numeric and date ranges, and missing/non-missing filters shared by the graph and table
- Linked graph/table row selection, including box/lasso selection and bulk include/exclude actions
- Group highlighting, Page-role subset stepping, and shared or independent facet scales
- Locally saved plot setups that can reopen the latest contents of a browser-approved source file and restore roles, layers, formatting, legend choices, and filters
- Resizable graph canvas, independently scrolling sidebars, draggable sidebar splitters, and Variables/Properties show-hide controls
- Collapsible Properties sections and an Opacity control with a clear solid-to-transparent scale
- Undo and redo for graph and complete dataset changes

## Run locally

Open PowerShell in this directory and run:

```powershell
npm run dev
```

Open the local address printed in the terminal, normally `http://localhost:5173`. The application does not upload dataset contents or require a server.

## Make custom panels or a Y-only box plot

To compare different variables side by side, open **Properties → Graph** and click **+ Panel** for each subplot. Choose the X and Y variable in each panel; panels with different variables use independent axes. Every graph layer appears in each panel when it has the needed variables. While custom panels are present, Group X, Group Y, Wrap, layer X/Y overrides, and the shared facet-scale setting are paused. Remove all custom panels to return to the usual shared-axis graph.

For a single box plot of all values in one variable, choose **Box plot** in the layer settings, put the numeric variable on Y, and clear X. The chart groups the values under **All observations**. In a custom panel, choose **None** for Panel X and a numeric Panel Y to do the same there.

## Add graph annotations to imported data

Annotations are reference lines (one target value) or acceptance regions (a shaded interval). Their coordinates must be numeric. Use `X` or `Y` for the axis. Annotation rows do not become measurements, so they cannot change averages, sample sizes, or plotted points. You can edit imported annotations afterward in Properties → Graph.

### Option 1: tagged rows in a CSV or data worksheet

Add reserved columns to your usual data table. `GB Type` and `GB Axis` are required when using this format; the other `GB` columns provide values and formatting. These reserved columns are removed from the imported Variables list.

| Pressure | Dose | GB Type | GB Axis | GB Value | GB Minimum | GB Maximum | GB Label | GB Color |
| ---: | ---: | --- | --- | ---: | ---: | ---: | --- | --- |
| 20 | 50 | | | | | | | |
| 30 | 55 | data | | | | | | |
| | | reference-line | Y | 52 | | | Target dose | #c2413b |
| | | acceptance-region | Y | | 48 | 60 | Acceptable range | #d9a441 |

Leave `GB Type` blank or write `data` for an ordinary measurement row. Use exactly `reference-line` or `acceptance-region` for an annotation row. A reference line needs `GB Value`; an acceptance region needs `GB Minimum` and `GB Maximum`, with minimum below maximum. `GB Label` and `GB Color` are optional. A color, when provided, must be a six-digit hex code such as `#c2413b`. Header names and the type/axis values are case-insensitive.

Try the ready-to-import [annotated-study.csv](examples/annotated-study.csv) example.

### Option 2: a separate Excel worksheet

Add a worksheet named `Graph Annotations` to an `.xlsx` or `.xls` workbook. It is not offered as a data sheet in the worksheet picker. Use these headers without the `GB` prefix:

| Type | Axis | Value | Minimum | Maximum | Label | Color | Target Sheet |
| --- | --- | ---: | ---: | ---: | --- | --- | --- |
| reference-line | Y | 52 | | | Target dose | #c2413b | Results |
| acceptance-region | Y | | 48 | 60 | Acceptable range | #d9a441 | Results |

`Target Sheet` is optional. Enter the exact name of a data worksheet to apply an annotation only there; leave it blank to apply the annotation to every data worksheet in the workbook. Matching ignores letter case. You can also combine this worksheet with tagged rows in a data sheet; both sets of annotations are imported.

Invalid annotation rows are skipped and shown as import warnings in the data table's quality summary. Rows tagged as annotations are never silently counted as data, even when their annotation is invalid. A target sheet name that does not exist also produces a warning. Saving a plot setup preserves the resulting lines and regions; reopening that setup restores its saved appearance. Import the workbook again to pick up changed annotation rows from the source file.

## Quality checks

```powershell
npm test
npm run build
```

Phases 2, 3, 4, 6, and 7 are complete. Phase 5 still has statistical features outstanding. Phase 6's linked filtering and exploration features have passed functional testing; responsiveness at the uncommon 5,000-row / 50,000-cell maximum is recorded as a future optimization.

See [roadmap.md](roadmap.md) for the phased development plan and agent handoff guidance.
