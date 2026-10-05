# Example: Tidy

A complete, working help setup for Tidy, a small task manager (a sidebar, a list of tasks with a row menu, a "New task" dialog, projects, settings and a phone layout with a bottom bar). It produced the pictures in `assets/look/`.

- `help.config.mjs`: demo mode through `?demo=1`, the dialog and form-row selectors, the toast hidden, the theme key, tokens copied from the app's CSS, an English ElevenLabs voice and a macOS draft voice.
- `content.mjs`: four tutorials in three groups (one with two parts and extras A/B), a screen, the phone section, FAQ, glossary and quick tasks.
- `stills.spec.mjs` / `phone.spec.mjs`: one test per tutorial; full screen first, then crops; no layout options needed — the form rows, the stacked menu and the bottom bar are laid out automatically.
- `videos.spec.mjs`: two desktop videos and one phone video.
- `playwright.config.mjs`: the template with `webServer.command` set to the app's server.

These files go in `scripts/help/` next to the `lib/` folder that `scripts/scaffold.mjs` installs.
