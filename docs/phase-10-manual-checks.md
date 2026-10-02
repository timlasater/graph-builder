# Phase 10 Windows validation history

This page records the 0.1.2–0.1.3 release period. It is historical; use the [0.1.4 release test plan](release-0.1.4-test-plan.md) for the current acceptance pass.

## Verified in October 2026

- The signed 0.1.2 → 0.1.3 update was installed through Graph Builder's update control using the published GitHub release. The app restarted and the saved project reopened. The updated desktop header mark was visible.
- Uninstalling Graph Builder from Windows **Installed apps** worked. Files saved separately by the user remained in place.

## Checks carried forward

The earlier release did not establish clean-machine file association, offline use, and every update choice for 0.1.4. The current plan covers these cases, as well as project replacement prompts, invalid-file alerts, undo, keyboard shortcuts, import, graphing, export, and a clean uninstall. A signed Tauri update is separate from Windows installer code signing, so a downloaded installer can still show a SmartScreen prompt.
