# Project agent policy

- Build all new features, including roadmap phases, directly on the shared next-version branch. Check local branches and `origin` for an existing next-version branch and continue work there. If none exists, start from an up-to-date `main` and create one by incrementing the last number of the latest released version, for example `v0.2.0` to `codex/v0.2.1`. Use one branch for all features in that release. Keep `main` unchanged until the branch is reviewed and merged.
- Before handing off completed code work, run the relevant tests and build checks, commit the changes, and push the side branch to `origin`.
- Update the project documentation and the user guide for every new feature. Describe how to use it, its important limits, and any changed save or export behavior.
- Keep unrelated user changes out of commits. If the working tree contains unrelated changes, preserve them and call them out before committing.
- When delivering a major new feature, include a short, plain-language set of steps the user can follow to test it in the app, with the expected result.
- The user is not a software developer. Explain technical terms in plain language when they are used, and briefly define unfamiliar concepts instead of assuming engineering background.
- Keep instructional and explanatory helper text in the interface visually compact. Use the shared small helper-text styling (typically 9px with a readable line height) rather than letting guidance compete with controls or graph content.
