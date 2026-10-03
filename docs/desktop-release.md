# Signed Windows desktop releases

Graph Builder uses Tauri's update signature to verify downloaded updates. The public verification key is in `src-tauri/tauri.conf.json`. The matching private key is stored outside this repository at `%USERPROFILE%\.tauri\graph-builder.key` on the original release machine. Never commit or share it. Keep an encrypted backup: losing the key prevents existing installations from verifying future updates.

The GitHub Actions secret `TAURI_SIGNING_PRIVATE_KEY` was configured for the published 0.1.2 and 0.1.3 releases. The [desktop release workflow](../.github/workflows/desktop-release.yml) uses that secret to sign releases built on GitHub. A second computer can start the workflow without copying the private key to that computer, provided its GitHub account has permission to run the workflow. If the secret is rotated or missing, restore it from the secure backup before building another update.

## Build an installer locally

`npm run build` builds the web files and does not use the signing key. `npm run desktop:build` creates the Windows installer and signs its update package. In PowerShell, set the path to the existing key before building:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = "$env:USERPROFILE\.tauri\graph-builder.key"
npm run desktop:build
```

If Tauri asks for a password to decrypt the private key and the key was created without one, press **Enter** at the prompt. An empty response is the correct password in that case. The wording of the prompt does not mean the file is encrypted with a nonempty password. Do not generate a replacement key: installed copies of Graph Builder trust the original key's public half.

## Prepare a release

1. Set the same new version in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`.
2. Complete the current [0.1.4 release test plan](release-0.1.4-test-plan.md) on a Windows machine with the desktop prerequisites. Record any failing checks and fix them. Commit and push the tested source on `main`.
3. Run **Desktop Release** from the repository's GitHub Actions page. The workflow runs checks and creates a **draft** GitHub Release with a Windows NSIS installer, a Tauri update signature, and `latest.json`.
4. Inspect the draft version, installer, signature, and `latest.json`. Publish the draft only after the assets and test results are correct. Publishing makes the new version available to installed apps through the configured GitHub Releases endpoint.
5. On a machine with the preceding release installed, test **Projects & export → Check for updates**. Save current work, accept the update, and confirm that the app restarts and the saved project reopens. Also verify the installer and file association on a clean Windows machine.

The Tauri signature authenticates updates downloaded by the app. It does not sign the Windows installer for SmartScreen; that requires a separate Windows code-signing certificate, which is not configured here.

## Historical validation

The signed 0.1.2 → 0.1.3 update through GitHub Releases was verified on October 1, 2026. Version 0.1.1 lacked the updater and required one manual install of 0.1.2. The detailed earlier checklist is archived in [Phase 10 Windows checks](phase-10-manual-checks.md). Repeat the current acceptance plan for each new release; the prior result does not establish that a later installer works.
