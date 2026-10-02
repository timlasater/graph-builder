# Phase 10 Windows checks

This is the historical Phase 10 checklist for the 0.1.2–0.1.3 validation period. Use the [0.1.4 release test plan](release-0.1.4-test-plan.md) for the current acceptance pass.

Use the newest `Graph Builder_…_x64-setup.exe` in `src-tauri/target/release/bundle/nsis/`. The installer is currently unsigned and may show a Windows SmartScreen prompt.

1. Close Graph Builder and run the installer. Launch the installed app from the Start menu.
2. Check that the window title shows the project and open graph name. Open **User guide** and confirm its text and screenshots appear with Wi-Fi turned off. Close it with Escape.
3. Choose **Report a problem** with Wi-Fi on. The GitHub Issues page should open in your normal browser.
4. Import a CSV or workbook, save and reopen an embedded project, and export a PNG. These actions should use Windows file dialogs. With Wi-Fi off, repeat the import, reopen, and export steps.
5. Close Graph Builder. Open **Settings → Apps → Installed apps**, find **Graph Builder**, choose **Uninstall**, and follow the prompts. Confirm it disappears from Installed apps and the Start menu. Your separately saved project and PNG files should remain where you saved them.

### File association and update checks

1. Install version 0.1.2, save an embedded project, and confirm its filename ends in `.graphbuilder`. Double-click it in File Explorer while Graph Builder is closed. The app should open and ask before replacing the current project. Cancel once; the current project should remain. Double-click again while Graph Builder is already open; the same running window should come forward and ask to open the file.
2. Use **Open project…** on an older `.graphbuilder.json` file. It should still open. Double-clicking an unrelated `.json` file should continue using its previous Windows app.
3. With Wi-Fi off, open **Projects & export**. The project and graph should remain usable even if the update check cannot connect.
4. After version 0.1.3 is published with a valid signature, open version 0.1.2 and choose **Projects & export → Check for updates**. The panel should offer version 0.1.3. Choose **Save project and install**, save the embedded copy, and let the installer finish. Graph Builder should restart with the favicon square replacing the desktop **GB** mark. Reopen the saved project and confirm its data and graphs remain intact. **Verified with the published 0.1.3 release on October 1, 2026.**

The installed signed-update check requires two published releases. The 0.1.2 → 0.1.3 update through GitHub is now verified; repeat the file-association and offline checks below for the final installer when those cases have not yet been exercised on a clean Windows machine.

The browser version should show the project and graph name immediately after **Save PNG**, and its two website links immediately before **Variables** in a one-row header. It should also open the bundled **User guide**.

Uninstall was confirmed working by the user on October 1, 2026. Repeat this check for the final release installer.
