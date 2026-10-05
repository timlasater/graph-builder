# Graph Builder 0.1.4 release test plan

Use this checklist on the Windows laptop with Node.js, Rust, Visual Studio C++ Build Tools, WebView2, Chrome, and the existing Graph Builder installation. It was written for the October 2, 2026 acceptance pass. Use the synthetic files in `test-data/` and `examples/`, never private research data. Mark each item **Pass**, **Fail**, or **Not run**, and record the app version, Windows version, and a short note or screenshot for any failure. A failed item in the **Before publishing** sections should be fixed and retested before the release is published.

**Status, October 5, 2026:** The user reports completing all v0.1.4 candidate tests. The desktop release workflow ran, and the release is published with `Graph.Builder_0.1.4_x64-setup.exe`, its update signature, and `latest.json`. The item boxes and sign-off table remain available for detailed results; the user has not supplied those records here. Recheck the new landing-page links and browser shortcut help after the Pages deployment, then complete the after-publication update and clean-install checks.

## Prepare the candidate

- [ ] In PowerShell, open the Graph Builder project folder and run `git pull origin main`, then `git status --short --branch`. Expect `main` to match `origin/main` with no local changes. Do not discard local changes if the result differs.
- [x] Confirm that `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml` all say `0.1.4` before building the installer.
- [ ] Run `npm ci`, `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e`, `npm run build:pages`, and `npm run test:pages`, one after another. Each must finish successfully. The browser suite starts its own local server. If Chrome is missing for Playwright, install its browser as prompted, then rerun the suite.
- [ ] Run `npm run desktop:build` after the version update. Expect a Windows setup file under `src-tauri/target/release/bundle/nsis/`. Record the exact filename and version. A local build proves packaging works; the GitHub release workflow is responsible for the signed update assets.

## Before publishing: installed Windows app

Use a 0.1.4 candidate installer for the checks below. Keep a separate backup of any real work. If replacing the installed 0.1.3 app, record its version first and plan to reinstall 0.1.3 for the update test after publication.

### Install, launch, and normal work

- [ ] Close Graph Builder, run the candidate installer, and launch from the Start menu. Expect one window with the Graph Builder icon and no blank or error screen.
- [ ] Confirm the title bar shows the project and open graph name. Open the built-in example; it should clearly be synthetic data.
- [ ] Import `test-data/import-example.csv` with **Import data**. Confirm the preview and table show the imported columns and rows. Import an XLSX workbook if one is available; choose a worksheet and verify its data appears. Cancel a replacement prompt once and verify the current project remains.
- [ ] Import `examples/annotated-study.csv`. Check that reference annotations appear and are not counted as measurements. Open **View data table** and verify row count, data quality messages, editing, exclusion, and filters.
- [ ] Assign variables to X, Y, color, and another role. Drag an already assigned variable by its label; the variable should move rather than select text. Add a second plot layer and change graph title, axes, theme, legend, and one statistical setting. The graph should update without an error.
- [ ] Use **Undo** and **Redo**, then Ctrl+Z and Ctrl+Y, on a graph change. Each should reverse and restore exactly one change. In a text field, Ctrl+Z should edit that field rather than change the whole project.
- [ ] Try points, line, bars, histogram, box plot, area, mean line, fit, and smooth trend with compatible columns. Each should render without a blank chart or error. Check color groups, category order, and a multi-panel layout.
- [ ] Import `test-data/missing-observations.csv` and apply a filter. Missing values should be handled without turning into zeroes. Add a calculated column, edit a source value, and confirm the formula recalculates. Undo should restore the prior value.
- [ ] Use `test-data/unequal-sample-sizes.csv` and `test-data/precomputed-summaries.csv` for a spot check of means, error bars, and sample counts. If R is installed, follow [the R practice comparison](r-visual-comparison.md) with `test-data/r-visual-reference.csv`; record any unexplained numerical or visual difference.
- [ ] Save an embedded project, a PNG, an SVG, and plotted-data CSV. Reopen the files or inspect them in File Explorer. The image should show the expected graph; the CSV should have plotted values; the `.graphbuilder` file should reopen with the data and graph settings.
- [ ] Press Ctrl+S with a project already saved to a file; it should update that file without asking for a location. Press Ctrl+Shift+S; it should ask for a new location. With a fresh project, Ctrl+S should ask for a location. Canceling Save As should leave the current file association intact.
- [ ] Press Ctrl+O and choose a CSV or Excel file. Expect the usual import and worksheet steps. Press Ctrl+O again and choose a `.graphbuilder` project; expect the save-or-cancel project prompt. Cancel once and confirm the current work remains.
- [ ] Press Ctrl+E; **Projects & export** should open. Press `?`; a compact shortcut list should open, show Ctrl+O/Ctrl+S/Ctrl+E and Undo/Redo, and close with Escape. While typing `?` in **Search variables**, it should enter the character rather than open the list. Opening help must leave the current project unchanged.

### Project opening and recovery

- [ ] Make two visibly different synthetic projects and save each to a different `.graphbuilder` file. Open the second from **Projects & export → Open project…**. Choose **Cancel opening**; the first project should remain. Repeat, save the first project when prompted, and open the second. Ctrl+Z should restore the first project; Ctrl+Y should reopen the second.
- [ ] Double-click a `.graphbuilder` file in File Explorer while Graph Builder is closed. If a recovery prompt appears first, resolve it. The project-opening prompt should then ask to save current work or cancel. Cancel and confirm the current work remains. Repeat and save; verify the selected file opens.
- [ ] Double-click a different `.graphbuilder` file while Graph Builder is open. The existing window should come forward, show the prompt, and leave the current project untouched until a choice is made. After opening, Ctrl+Z should restore the earlier project.
- [ ] Create an invalid test file after the automated tests: `New-Item -ItemType Directory -Force test-results | Out-Null; Set-Content -LiteralPath test-results/broken.graphbuilder -Value '{not valid JSON'`. Open it by double-clicking and through Ctrl+O. Expect a large **Could not open project** dialog and no change to the current project. Dismiss it with **Keep current project** and with Escape on a second attempt.
- [ ] Open the same project repeatedly using File Explorer, Ctrl+O, and **Open project…**. In **Recent projects**, each file path should appear only once; two different paths with the same filename may both appear.
- [ ] Save and reopen a linked project based on a source file. Confirm it reconnects when the source is present, and asks for the source if it was moved. Cancel the reconnect flow once; current work should remain. An embedded backup should retain individual cell edits.
- [ ] Make a visible change, wait for the autosave status, close the app, and reopen it. If recovery is offered, restore it and check data and graphs. Repeat, choose the example instead, and confirm the saved project file remains available separately.

### Offline, accessibility, and links

- [ ] Turn off Wi-Fi. Launch the installed app and repeat a CSV import, graph edit, embedded save/reopen, PNG export, and opening the bundled **User guide**. Core work should function. Turn Wi-Fi back on afterward.
- [ ] Use only the keyboard to select a variable, assign it through **Properties**, edit a graph, open and close the data table, save a project, and use Ctrl+O/Ctrl+S/Ctrl+Z/Ctrl+Y. Focus should stay visible; Tab should remain inside an open dialog; Escape should cancel where offered.
- [ ] Use Ctrl+E and `?` without a mouse. Focus should enter each dialog, stay inside it while tabbing, and return to the original control after Escape.
- [ ] Turn on Windows Narrator with Windows+Ctrl+Enter. Check that it announces the project save prompt, invalid-file error, main controls, and focused buttons clearly. Turn Narrator off with the same shortcut.
- [ ] Check the desktop footer's GitHub icon and **Report a problem** link. Each should open the correct page in the normal browser. With Wi-Fi off, the browser may show its offline page; the Graph Builder project should remain unaffected.
- [ ] With Wi-Fi on, open **Projects & export → Check for updates** while the candidate is current. Expect a clear no-update result. If an update is offered unexpectedly, decline it and confirm the app remains usable.

## Before publishing: browser and public page

- [ ] Open `https://timothylasater.com/graph-builder/` at desktop and phone widths. Confirm the capability and engineering summaries are readable, the navigation matches the other site pages, and **Launch Graph Builder**, the user guide, repository, and problem-report links work. After 0.1.4 is published, verify the new Windows installer button downloads the 0.1.4 setup file.
- [ ] Open `https://timothylasater.com/graph-builder/app/` and refresh it directly. Import a synthetic CSV, edit a graph, download an embedded project and PNG, reopen the project, and verify its data. The browser page should have the bottom-center GitHub icon, **Download Windows app**, **Report a problem**, and **timothylasater.com** links. Check that browser shortcut help omits Ctrl+N and Ctrl+D while the Windows app still lists them.
- [ ] At 200% browser zoom, confirm key controls remain reachable by scrolling. Check the light, dark, and paper graph themes for readable text and visible focus.

## Draft release review, then publishing

- [ ] Confirm `0.1.4` is committed and pushed on `main`, and the browser Pages workflow is green. Run the manually triggered **Build signed Windows desktop release** workflow from `main`. It should produce a **draft** release, not publish automatically.
- [ ] Inspect the draft release before publishing: correct `0.1.4` name/tag, Windows setup file, Tauri updater signature, and `latest.json`. The workflow must report success. Do not paste the private signing key into an issue, chat, or commit.
- [ ] Publish only after the pre-publication checks pass. Keep the old 0.1.3 installer available for the update check below.

## After publishing: update and clean install

- [ ] Install or restore 0.1.3 and open a synthetic project with a visible edit. With Wi-Fi on, choose **Projects & export → Check for updates**. Expect 0.1.4. Cancel or decline once and confirm 0.1.3 and the current project remain usable.
- [ ] Check again, choose the update, and save the full embedded project copy when asked. The signed update should install and restart Graph Builder as 0.1.4. Reopen the backup and verify data and graphs. If the update fails, keep the backup and record the message and workflow run.
- [ ] On a clean Windows account or machine, download the published setup file, install, launch, open a `.graphbuilder` file by double-clicking, and repeat one offline import/save/export cycle. This catches file-association and installation problems that a development build may miss.
- [ ] Uninstall Graph Builder through Windows **Installed apps**. Confirm it disappears from Installed apps and Start; separately saved `.graphbuilder`, PNG, SVG, and CSV files should remain. Reinstall if continued use is planned.

## Sign-off record

| Item | Record |
| --- | --- |
| Date, Windows version, app version | |
| Automated checks | |
| Installed-app checks | |
| Browser and landing-page checks | |
| Draft release assets | |
| Published update from 0.1.3 | |
| Clean install and uninstall | |
| Failures, issue links, and retest results | |

Treat any data loss, wrong-file overwrite, failed save, invalid-file replacement, failed signed update, or crash in the core workflow as a release blocker. Keep screenshots and diagnostic notes free of private data.
