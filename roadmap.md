# Graph Builder roadmap

This document records completed milestones and remaining release work. For current setup, architecture, and verification commands, see [README.md](README.md). For feature instructions, see the [user guide](docs/user-guide.md). Historical validation records remain under `docs/`.

## Product direction

Graph Builder is a local-first scientific graphing tool for people who work with tabular measurements. It should make common graphing and statistical workflows approachable without hiding the underlying data. The Windows app should work offline after installation; the browser version needs a connection to load but processes imported rows locally. The project uses its own interface and assets.

The primary supported workload is about 100–500 rows and 1,000–10,000 populated cells. Validation has also covered a 5,000-row, 50,000-cell browser workflow. Larger or more complex graphs should be assessed on the target machine rather than assumed to perform identically.

## Milestones

| Milestone | Status | Record |
| --- | --- | --- |
| Data import, quality checks, editing, formulas | Complete | CSV/TSV/TXT/Excel import, data table, derived columns |
| Graph building and layers | Complete | Variable roles, multiple layers, plot suggestions, grouping, facets |
| Statistical summaries | Complete | Raw and supplied summaries, error bars, fits, moving averages |
| Filtering and linked exploration | Complete | Graph/table filters and row selection |
| Appearance and export | Complete | Axes, themes, legends, annotations, PNG/SVG/CSV export |
| Projects and templates | Complete | Embedded/linked projects, multiple graphs, recovery, templates |
| Browser validation | Complete | [Phase 9 validation](docs/phase-9-validation.md) and [manual checks](docs/phase-9-manual-checks.md) |
| Windows packaging | 0.1.4 release published; candidate and post-publication Windows checks reported complete | [0.1.4 release test plan](docs/release-0.1.4-test-plan.md), [release notes](docs/release-0.1.4-notes.md) |
| Public landing page and downloads | Browser app and Windows installer links live and checked | `site/index.html`, Pages and desktop release workflows |

## Completed 0.1.4 release follow-up

The user reports completing these checks after publication; detailed machine and test records were not supplied:

1. Checked the live installer links and browser shortcut help. The browser app is available from [the Graph Builder page](https://timothylasater.com/graph-builder/) and directly at [the app](https://timothylasater.com/graph-builder/app/).
2. Declined an available 0.1.4 update, then installed it after saving work.
3. Checked a clean 0.1.4 installation, file association, offline use, and uninstall on Windows.

## Near-term work

1. Improve the desktop linked-project save flow: when a source path is missing, clearly explain that the file picker is asking for the original data file, not where to save the project. Make the picker purpose clear before it opens and in its title where supported.
2. Consider macOS and Linux packages after each platform can be built and checked on physical machines.

## Future features

- Import multiple data files at once and concatenate their rows into one dataset, with checks for matching columns. Import currently opens one data file at a time.
- Map numeric values to a continuous color gradient. Current palettes and series colors assign discrete colors.
- Add freely positioned, editable text annotations on a graph. Current labels belong to titles, reference lines, acceptance regions, or generated plot elements.
- Draw and edit arrows, free-positioned lines, rectangles, and highlights on a graph. Current reference lines and shaded acceptance regions are tied to an X or Y value or interval.
- Save and reuse a visual theme independently of a graph's data, variables, and filters. Current built-in themes and reusable graph templates do not provide a dedicated appearance-only preset.

## Release and maintenance notes

The Pages build produces a landing page at `/graph-builder/` and a separate application entry point at `/graph-builder/app/` so direct visits and refreshes work. The normal build remains suitable for Tauri. The Pages workflow publishes `main`; the desktop workflow is a manual, signed release process. The signing private key belongs outside Git and in release secrets; the public verification key is bundled with the app. A Windows installer certificate is separate from the free Tauri update signature.

Keep the dataset and saved graph specification independent from Plotly's rendering objects. Keep core graphing local and functional without a network service. Evaluate new statistical behavior with small unit tests and representative files. Before handing off code work, run the relevant tests and builds, commit the requested changes, and push `main`, following [AGENTS.md](AGENTS.md). Keep user-facing guidance in the app concise and update the full guide when controls change.
