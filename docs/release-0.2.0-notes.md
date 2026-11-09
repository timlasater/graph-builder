# Graph Builder 0.2.0 release notes

## New features

- Paired plots connect observations for the same subject. Welch and paired t tests compare two groups and report the difference, confidence interval, and p value.
- Curve fits support four-parameter dose–response and exponential decay models, with optional equation, sample size, R², parameter intervals, and residual plots.
- Figure layouts combine up to four saved graphs, with graph-name visibility, ordering, PNG resolution, and SVG export.
- Multiple layers share a single legend entry and consistent colors per group by default. Switch this off under **Properties → Marks and colors** for separate layer entries.

See the [feature guide](v0.2.0-feature-guide.md) and [user guide](user-guide.md) for instructions and statistical limits. Comparisons cover one pair at a time; they do not correct for multiple testing. Curve fits require suitable data and can fail or have unavailable parameter intervals.

## Fixes and interface improvements

- Desktop legend dragging supports moving a group onto another entry or to the empty space at either end.
- When X and Color use the same categorical variable, legend renames also update X-axis labels without merging groups.
- PNG and SVG exports reserve space between the X-axis title and bottom legend, including angled labels and legends with multiple rows.
- Example-only autosaves reopen quietly and preserve customized graphs. Recovery copies containing imported or edited data still offer a restore choice.
- Successful desktop project-save banners fade after four seconds; errors remain visible.
- Projects & export sections put project and graph controls before exports, layout, templates, and desktop updates.
- Properties groups marker size under Marks and colors, grid lines under Axes and categories, and Figure size and theme at the bottom. The shared-legend checkbox has its text beside it.

## Saving, exports, and compatibility

The project format remains version 1. New graph and figure settings are stored in projects and templates; older projects open with shared layer legends enabled unless explicitly disabled. Use embedded projects to preserve source rows and data edits. Linked projects reconnect their original source file. Existing per-layer legend styles remain available when shared legends are disabled; when sharing is enabled, the first layer supplies any existing custom name or color.

Shared legends and export spacing apply to PNG, SVG, clipboard images, and figure-layout exports. At small output dimensions, labels and legends reduce the available plot area; increase the figure size when necessary.

## Release checks

- Local validation on November 9, 2026 passed: 195 source tests, all 33 browser tests, production and Pages builds, lint, and the Pages smoke check. All six application version entries match 0.2.0.
- The desktop release workflow builds the Windows installer, signs the update package, and creates a draft GitHub release with the installer, its signature, and latest.json.
- Inspect draft assets and updater metadata before publication. The download links lead to the latest published release, so they keep working while this release is a draft.
- Windows installed-app validation is separate from automated browser checks. Before publication, install the candidate, open an embedded project, test desktop legend dragging and edge drops, export a labeled box plot, save/reopen the project, and verify that the controls and data persist.
- After publication, test the update from 0.1.4, a clean installation, file associations, offline use, and uninstall. Prior 0.1.4 checks do not establish that the 0.2.0 installer works.

The existing Tauri update verification key is unchanged. Installer signing for Windows SmartScreen is separate and is not configured. macOS and Linux installers are not included.
