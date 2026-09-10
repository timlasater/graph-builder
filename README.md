# Graph Builder

An offline-first, Windows-focused scientific graph builder inspired by JMP Graph Builder's variable-to-role workflow.

## Current milestone

- Three-panel desktop-style interface
- Typed example engineering dataset
- Drag variables onto X, Y, Color, Group X, Group Y, Wrap, Overlay, and Size roles
- Grouped panels and wrapped facet grids
- Overlay traces and numeric marker-size mapping
- Move assigned variables directly between roles or drag them back to the Variables panel
- Automatic replacement of incompatible Wrap and Group X/Y assignments (version 1 limitation)
- Local CSV, TSV, XLSX, and XLS import
- Excel worksheet selection
- Automatic numeric, text, Boolean, and date/time inference
- Editable, sortable, filterable, paginated data table with row exclusion
- Column renaming and manual data/modeling-type controls
- Interactive points, lines, and bar charts
- Hover tooltips and Plotly zoom controls
- Editable title, subtitle, grid lines, and marker size
- Undo and redo for graph changes

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

The next milestone adds more graph elements, summary statistics, and error bars.

See [roadmap.md](roadmap.md) for the phased development plan and agent handoff guidance.
