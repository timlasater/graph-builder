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
| Windows packaging | 0.1.4 acceptance in progress; earlier signed releases published | [0.1.4 release test plan](docs/release-0.1.4-test-plan.md), [prior validation](docs/phase-10-manual-checks.md) |
| Public landing page and downloads | Browser app live; desktop download pending 0.1.4 acceptance | `site/index.html`, Pages and desktop release workflows |

## Near-term work

1. Complete the [0.1.4 release test plan](docs/release-0.1.4-test-plan.md) on a Windows machine with the desktop prerequisites. This includes double-click project opening, save/cancel prompts, undo, invalid-file alerts, keyboard shortcuts, and the full import-to-export workflow.
2. Verify offline use after installation: launch, import, graph, save, reopen, and export. Installing on a machine without WebView2 may require an initial download; ordinary use after installation must not.
3. Verify the installed app's update choices: no update available, declining an available update, and installing an update after saving work. The signed 0.1.2 → 0.1.3 install path was already tested.
4. Publish 0.1.4 after acceptance, then add a desktop download button and verified specifications to the public landing page. Check installer links from a clean device. The browser app is available from [the Graph Builder page](https://timothylasater.com/graph-builder/) and directly at [the app](https://timothylasater.com/graph-builder/app/).
5. Consider macOS and Linux packages after each platform can be built and checked on physical machines.

## Release and maintenance notes

The Pages build produces a landing page at `/graph-builder/` and a separate application entry point at `/graph-builder/app/` so direct visits and refreshes work. The normal build remains suitable for Tauri. The Pages workflow publishes `main`; the desktop workflow is a manual, signed release process. The signing private key belongs outside Git and in release secrets; the public verification key is bundled with the app. A Windows installer certificate is separate from the free Tauri update signature.

Keep the dataset and saved graph specification independent from Plotly's rendering objects. Keep core graphing local and functional without a network service. Evaluate new statistical behavior with small unit tests and representative files. Before handing off code work, run the relevant tests and builds, commit the requested changes, and push `main`, following [AGENTS.md](AGENTS.md). Keep user-facing guidance in the app concise and update the full guide when controls change.
