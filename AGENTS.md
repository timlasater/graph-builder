# Project agent policy

- Work on a side branch by default, including roadmap phases. Start new work from an up-to-date `main` unless continuing an existing feature branch. Keep `main` unchanged until the branch is reviewed and merged.
- Before handing off completed code work, run the relevant tests and build checks, commit the changes, and push the side branch to `origin`.
- Update the project documentation and the user guide for every new feature. Describe how to use it, its important limits, and any changed save or export behavior.
- Keep unrelated user changes out of commits. If the working tree contains unrelated changes, preserve them and call them out before committing.
- When delivering a major new feature, include a short, plain-language set of steps the user can follow to test it in the app, with the expected result.
- The user is not a software developer. Explain technical terms in plain language when they are used, and briefly define unfamiliar concepts instead of assuming engineering background.
- Keep instructional and explanatory helper text in the interface visually compact. Use the shared small helper-text styling (typically 9px with a readable line height) rather than letting guidance compete with controls or graph content.
