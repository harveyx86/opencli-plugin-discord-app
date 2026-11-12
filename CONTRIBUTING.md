# Contributing

Use Node 22.4+ and OpenCLI 2.x. Run `npm ci --ignore-scripts`, `npm test`, then
`opencli adapter check discord-app` after installing this checkout as a local
plugin. CI runs synthetic tests without Discord credentials.

Keep root-level files as discoverable commands and helpers under `lib/`.
Keep names, arguments and columns compatible with the pre-removal fixture unless
a change is explicitly documented. Changes to the fixture require a justified
public interface change, not merely a failing test.

For selector bugs, include the command, OpenCLI/Node/Discord versions, operating
system, UI language and a redacted error. Do not attach private messages, tokens,
raw app data or CDP URLs containing session identifiers. Use synthetic DOM in tests.

Write-command changes must test target identity, no unintended control clicks,
existing drafts, and uncertain outcomes. Do not automatically repeat sends or
deletions. Live write tests need an explicitly authorized disposable channel and
message; synthetic CI does not substitute for live compatibility validation.

Before a release, update package.json, opencli-plugin.json and CHANGELOG.md,
refresh the lockfile, run tests, check a clean GitHub install, and document which
commands were actually live-tested. Keep Apache-2.0 attribution in LICENSE/NOTICE.
