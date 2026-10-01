# Signed Windows desktop releases

The app uses Tauri's updater signature to verify each downloaded update. Its public key is in `src-tauri/tauri.conf.json`. The matching private key is stored outside this repository at `%USERPROFILE%\.tauri\graph-builder.key`; never commit it or paste it into a chat. Back it up securely. Losing it prevents existing installations from verifying future updates.

Before the first release, add the entire private key file content as the GitHub repository Actions secret named `TAURI_SIGNING_PRIVATE_KEY` under **Settings → Secrets and variables → Actions**. The release workflow needs no separate password for this key. This secret is required only to build releases; it is never included in the app.

The workflow in `.github/workflows/desktop-release.yml` runs manually from `main`. It tests the app and builds a Windows NSIS installer, its Tauri update signature, and `latest.json` into a **draft** GitHub Release. Inspect the draft's version and assets before publishing it. Publishing makes that version available to installed apps at the configured GitHub Releases endpoint. Do not publish a newer version before the earlier baseline has been installed for the update test.

For the first update test:

1. Release and install version 0.1.2, which still has the desktop **GB** header mark. Earlier 0.1.1 installations need this one manual install because they have no updater.
2. Release version 0.1.3, whose desktop header uses the favicon square.
3. In 0.1.2, open **Projects & export**, check for updates, choose **Save project and install**, and save the embedded project copy. The signed installer should download, install, and restart the app. Verify the favicon appears and the saved project reopens.

Tauri update signatures do not remove Windows SmartScreen warnings on an installer downloaded from the web. That requires a separate Windows code-signing certificate, which is not configured here.
