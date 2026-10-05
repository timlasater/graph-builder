# Graph Builder desktop v0.1.4

Graph Builder 0.1.4 makes project and data workflows safer and adds more ways to work with graphs in the Windows app.

## Highlights

- Open `.graphbuilder` projects from File Explorer, a file picker, or the recent-project list. If the current project has unsaved changes, Graph Builder asks whether to save, discard, or cancel before replacing it. Invalid project files leave the current work intact.
- Use Windows keyboard shortcuts to create a graph, open data or a project, open the data table, save a project, and open **Projects & export**. Press `?` in either app to see the shortcuts available there.
- Work with a clearer linked-project reconnect flow and improved import feedback. Embedded projects continue to include the data and graph settings in one portable file.
- Make more graph and appearance adjustments, including custom panels and a second Y axis where compatible. Updated default colors help distinguish series.
- Continue working offline after installing the Windows app. An update check is optional and asks before installing a signed update.

## Download and compatibility

Download [Graph Builder 0.1.4 for Windows](https://github.com/timlasater/graph-builder/releases/download/desktop-v0.1.4/Graph.Builder_0.1.4_x64-setup.exe). The browser app is available at [timothylasater.com/graph-builder/app/](https://timothylasater.com/graph-builder/app/). macOS and Linux installers have not been tested or released.

The Windows setup file may need to download WebView2 during installation if the computer does not already have it. The Tauri signature verifies in-app updates; the installer itself does not have a Windows code-signing certificate and may show a SmartScreen prompt.
