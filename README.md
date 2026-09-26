# Graph Builder

An offline-first, Windows-focused scientific graph builder inspired by JMP Graph Builder's variable-to-role workflow.

## Current milestone

- Three-panel desktop-style interface
- Typed example engineering dataset
- Drag variables onto X, Y, Color, Group X, Group Y, Wrap, Overlay, and Size roles
- Multiple ordered assignments on X and Y, with drag reordering and Swap X/Y
- Shape, Frequency, and Page roles with subset stepping
- Layered points, lines, histograms, box plots, grouped/stacked bars, area/stacked-area plots, replicate-mean lines, and linear fits
- Per-layer variable overrides, colors, marker sizes, and line widths
- Type-aware graph suggestions and centralized compatibility feedback
- Mean-line error bars for sample SD, standard error, selectable two-sided Student's t confidence intervals, and range
- Optional source-observation overlays on mean layers
- Grouped panels and wrapped facet grids
- Overlay traces and numeric marker-size mapping
- Move assigned variables directly between roles or drag them back to the Variables panel
- Automatic replacement of incompatible Wrap and Group X/Y assignments (version 1 limitation)
- Local CSV, TSV, XLSX, and XLS import
- Excel worksheet selection
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
- Reference lines and shaded specification/acceptance regions across facets
- Draggable legend ordering with matching categorical bar order, per-series colors, and click-to-hide visibility
- Searchable categorical filters, numeric and date ranges, and missing/non-missing filters shared by the graph and table
- Linked graph/table row selection, including box/lasso selection and bulk include/exclude actions
- Group highlighting, Page-role subset stepping, and shared or independent facet scales
- Locally saved plot setups that can reopen the latest contents of a browser-approved source file and restore roles, layers, formatting, legend choices, and filters
- Resizable graph canvas, independently scrolling sidebars, draggable sidebar splitters, and Variables/Properties show-hide controls
- Undo and redo for graph and complete dataset changes

## Run locally

Open PowerShell in this directory and run:

```powershell
npm run dev
```

Open the local address printed in the terminal, normally `http://localhost:5173`. The application does not upload dataset contents or require a server.

## Quality checks

```powershell
npm test
npm run build
```

Phases 2, 3, and 4 are complete. Phases 5 and 6 are in progress: Phase 5 still has statistical features outstanding, and Phase 6's linked filtering and exploration features are implemented but still need responsiveness validation at the roadmap's 5,000-row / 50,000-cell target.

See [roadmap.md](roadmap.md) for the phased development plan and agent handoff guidance.
