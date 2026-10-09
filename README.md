# Graph Builder

Graph Builder is a local-first scientific graphing application for Windows and modern desktop browsers. It lets users import tabular data, map columns to graph roles, combine plot layers, inspect and filter observations, and export figures or reusable projects. The bundled dataset is synthetic demonstration data; it is not research data.

- [Try the browser app](https://timothylasater.com/graph-builder/app/)
- [Download the Windows installer (0.1.4)](https://github.com/timlasater/graph-builder/releases/download/desktop-v0.1.4/Graph.Builder_0.1.4_x64-setup.exe)
- [Read the complete user guide](docs/user-guide.md)
- [Preview the v0.2.0 feature workflows](docs/v0.2.0-feature-guide.md)
- [Read the 0.1.4 release notes](docs/release-0.1.4-notes.md)
- [0.1.4 Windows release test plan](docs/release-0.1.4-test-plan.md)
- [Report an issue](https://github.com/timlasater/graph-builder/issues)

![Graph Builder workspace with synthetic example measurements and a scatter graph](docs/screenshots/workspace.png)

*The workspace with the built-in synthetic example data.*

## In development on the v0.2.0 branch

The branch adds paired plots, two-group comparisons, nonlinear dose–response and exponential decay fits, and a page layout for combining saved graphs. These features are not yet in the 0.1.4 installer or public browser app. See the [v0.2.0 feature guide](docs/v0.2.0-feature-guide.md) for sample data, steps, and current limits.

## Architecture

The UI is React and TypeScript, built with Vite and packaged for Windows with Tauri 2. Zustand stores the dataset, graph specification, filters, project state, and undo history. Plotly renders graphs from a renderer-independent specification. AG Grid provides the editable data table. Papa Parse and SheetJS handle text and spreadsheet imports; dnd-kit handles variable and layer dragging.

The app processes datasets in the browser or desktop WebView. It does not send imported rows to a service. The browser app itself must be downloaded from the website before it can run. The desktop app bundles its assets and can graph data offline after installation. Update checks are optional and do not block startup.

Key source locations:

| Path | Responsibility |
| --- | --- |
| `src/store.ts`, `src/types.ts` | Dataset and graph state; undo and redo |
| `src/importData.ts`, `src/importAnnotations.ts` | CSV/TSV/Excel parsing and annotations |
| `src/plotTransforms.ts`, `src/statistics.ts`, `src/statisticalSeries.ts`, `src/comparisons.ts`, `src/nonlinearFit.ts` | Plot preparation, comparisons, and curve fitting |
| `src/components/GraphCanvas.tsx` | Interactive graph and legend |
| `src/components/DataTableModal.tsx` | Data inspection and editing |
| `src/projects.ts`, `src/graphTemplates.ts`, `src/graphExport.ts`, `src/figureLayout.ts` | Persistence, templates, and exports |
| `src/desktopFiles.ts`, `src-tauri/` | Desktop file dialogs, shell, and updater |
| `docs/user-guide.md` | User-facing instructions bundled into the app |
| `site/index.html`, `scripts/prepare-pages.mjs` | Public landing page and Pages output |

Graph specifications are saved separately from Plotly's layout objects so saved projects remain independent of the renderer. Project files are JSON. An embedded `.graphbuilder` project contains the dataset and graph settings; a linked project stores a source-file reference and needs that file when reopened. See the guide for the difference.

## Develop locally

Prerequisites: Node.js compatible with Vite 8, npm, and a desktop browser for end-to-end tests. Windows desktop development also needs the Rust MSVC toolchain, Microsoft C++ Build Tools, and WebView2. The [desktop release guide](docs/desktop-release.md) describes signing and packaging.

```powershell
npm ci
npm run dev
```

Open the local address printed by Vite to test the interface in a browser.

To test the current code as a Windows app without building an installer, run this from the project folder after `npm ci`:

```powershell
npm run desktop:dev
```

The app opens automatically. Leave the PowerShell window open while testing, then press **Ctrl+C** in that window to stop it. This command does not need the release signing key. Use it for Windows file dialogs, File Explorer drag and drop, and saved source-path checks. For browser-only checks, use `npm run dev` above. To create an installer instead, run `npm run desktop:build` after installing the Windows prerequisites and configuring the existing release signing key as described in the [desktop release guide](docs/desktop-release.md). If your existing key has no password, press **Enter** when the installer build asks for one; `npm run build` alone does not ask for a key.

## Verify changes

```powershell
npm test
npm run lint
npm run build
npm run test:e2e
npm run build:pages
npm run test:pages
```

`npm test` runs the source unit and workflow tests. `test:e2e` exercises browser workflows with Playwright; install its browser if prompted. `build` checks TypeScript and creates desktop-ready web assets. `build:pages` creates the landing page and the browser app under `/graph-builder/app/`; `test:pages` checks both entry points and asset paths. The Pages workflow publishes from `main`. The desktop release workflow builds a signed Windows release when run manually. See [phase 9 validation](docs/phase-9-validation.md) and [phase 10 checks](docs/phase-10-manual-checks.md) for historical validation details.

To preview the public landing page and browser app together before publishing, run `npm run build:pages` and then `npm run preview:pages`. Open the two local addresses it prints. Stop the preview with **Ctrl+C**.

## Data formats and limits

Imports accept CSV, TSV, TXT, XLSX, and XLS, with a worksheet selector when needed. Dates, numbers, text, and Boolean columns are inferred, then can be corrected in the UI. Typical workbooks have 100–500 rows and 1,000–10,000 populated cells; validation also covered a 5,000-row, 50,000-cell browser workflow. Performance depends on the machine and graph complexity.

Annotations can be supplied as tagged rows in a data table or in a `Graph Annotations` Excel worksheet. The exact columns and examples are documented in the [user guide](docs/user-guide.md#annotations-in-imported-files). Example files are in `examples/` and `test-data/`.

## Project status

Browser graphing and the Windows desktop application are implemented. The signed 0.1.2 → 0.1.3 desktop update was verified; that result is recorded in the [Windows validation history](docs/phase-10-manual-checks.md). The [0.1.4 Windows release](https://github.com/timlasater/graph-builder/releases/tag/desktop-v0.1.4) is published with its installer, update signature, and updater manifest. The user reports completing the 0.1.4 candidate tests, live download and browser checks, installed update choices, and clean-install and uninstall checks. See the [0.1.4 release notes](docs/release-0.1.4-notes.md) and [test plan](docs/release-0.1.4-test-plan.md). macOS and Linux releases await testing on those platforms.

## Contributing

Open an issue with steps to reproduce, an expected result, and the observed result. Keep private datasets out of issues; a small synthetic file is best. Before a change is merged, run the relevant commands above and update the project documentation and user guide for every new feature. Development is committed and pushed on side branches; see [AGENTS.md](AGENTS.md) for repository handoff policy.
