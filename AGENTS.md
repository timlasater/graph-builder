# Project agent policy

- Work on `main` by default, including roadmap phases. Use a side branch only when there is a good reason, such as isolating risky work or coordinating concurrent changes; explain that reason when you create one. Merge completed branch work back into `main` when practical.
- Before handing off completed code work, run the relevant tests and build checks, commit the changes, and push `main` to `origin` (or push the side branch when it cannot yet be merged).
- Keep unrelated user changes out of commits. If the working tree contains unrelated changes, preserve them and call them out before committing.
- When delivering a major new feature, include a short, plain-language set of steps the user can follow to test it in the app, with the expected result.
- The user is not a software developer. Explain technical terms in plain language when they are used, and briefly define unfamiliar concepts instead of assuming engineering background.
- Keep instructional and explanatory helper text in the interface visually compact. Use the shared small helper-text styling (typically 9px with a readable line height) rather than letting guidance compete with controls or graph content.
