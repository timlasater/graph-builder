# Phase 10 Windows checks

Use the newest `Graph Builder_…_x64-setup.exe` in `src-tauri/target/release/bundle/nsis/`. The installer is currently unsigned and may show a Windows SmartScreen prompt.

1. Close Graph Builder and run the installer. Launch the installed app from the Start menu.
2. Check that the window title shows the project and open graph name. Open **User guide** and confirm its text and screenshots appear with Wi-Fi turned off. Close it with Escape.
3. Choose **Report a problem** with Wi-Fi on. The GitHub Issues page should open in your normal browser.
4. Import a CSV or workbook, save and reopen an embedded project, and export a PNG. These actions should use Windows file dialogs. With Wi-Fi off, repeat the import, reopen, and export steps.
5. Close Graph Builder. Open **Settings → Apps → Installed apps**, find **Graph Builder**, choose **Uninstall**, and follow the prompts. Confirm it disappears from Installed apps and the Start menu. Your separately saved project and PNG files should remain where you saved them.

The browser version should show the project and graph name immediately after **Save PNG**, and its two website links immediately before **Variables** in a one-row header. It should also open the bundled **User guide**.
