---
description: Add a new dated entry to CHANGELOG.md summarizing recent work
argument-hint: [optional summary of what to log — otherwise inferred from this session]
---

Add a new entry to `CHANGELOG.md` in this project.

1. Read the current `CHANGELOG.md` first — match its existing format exactly (dated headers, newest at top, `### Added` / `### Changed` / `### Fixed` / `### Deployed` / `### Planning` subsections, only include the ones that actually apply).
2. Figure out what actually changed. If `$ARGUMENTS` was given, use that as the summary. Otherwise, work it out from this session — what was built, fixed, decided, or deployed since the conversation started (or since the last changelog entry, whichever gives a fuller picture).
3. Be specific: file names, what actually changed and why it mattered, not vague summaries like "made improvements." Match the level of detail already in the file.
4. If today's date already has an entry, add to it — don't create a second header for the same date.
5. After writing it, show the user the new section so they can sanity-check it before moving on.

Don't touch `TODO.md` as part of this — that's a separate, forward-looking file. This command is only for recording what already happened.
