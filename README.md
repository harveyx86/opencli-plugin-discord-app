# Discord Desktop plugin for OpenCLI

Restore the `discord-app` adapter removed in OpenCLI 2.0 as an independently
maintained plugin. Eleven commands cover connection status, servers, channels,
messages, search, members, navigation, threads, sending and deletion.

This is an unofficial community plugin, not affiliated with Discord or OpenCLI.

## Install

Requires **OpenCLI >=2.0.3 <3**, **Node >=22.4** and a logged-in Discord Desktop
with a local Chrome DevTools Protocol (CDP) port. No browser extension, bot token,
Discord client patch or additional runtime dependency is required.

```bash
opencli plugin install github:harveyx86/opencli-plugin-discord-app
opencli discord-app status
```

On macOS, completely quit Discord, then start it with debugging enabled:

```bash
open -a Discord --args --remote-debugging-port=9232
```

On Linux, quit Discord and launch `discord --remote-debugging-port=9232`.
On Windows, launch your installed `Discord.exe` with `--remote-debugging-port=9232`.
The plugin is portable; live testing so far has only covered macOS.

For a clickable macOS launcher, export this AppleScript as an Application in
Script Editor and place it in the Dock:

```applescript
do shell script "/usr/bin/open -a Discord --args --remote-debugging-port=9232"
```

Starting the launcher while Discord is already running does not add startup flags.

The default endpoint is `http://127.0.0.1:9232`. To override it:

```bash
export OPENCLI_CDP_ENDPOINT="http://127.0.0.1:9232"
curl --fail http://127.0.0.1:9232/json/version
```

Only local HTTP endpoints and Discord HTTPS page targets are accepted. Keep one
Discord page on the selected port. Do not expose the port to a network. Setting
`OPENCLI_CDP_ENDPOINT` globally also affects other OpenCLI workflows.

## Commands

| Command | Arguments | Scope |
| --- | --- | --- |
| `status` | none | CDP connection, page URL and title; not an authentication check |
| `servers` | none | Servers represented in the rendered sidebar |
| `channels` | none | Rendered channel or private-conversation links |
| `members` | none | Up to 50 rendered member entries |
| `read` | `--count`, `--guild`, `--channel`, `--url` | Last N rendered messages, optionally after navigation |
| `search` | `<query>` | Current server/channel search UI and rendered results |
| `goto` | `--guild`, `--channel`, `--url`, `--timeout` | Navigate the existing Discord window |
| `threads` | `--limit`, `--guild`, `--channel`, `--url` | Rendered forum/thread cards |
| `thread-read` | `--thread`, `--count`, `--guild`, `--channel`, `--url` | Messages from the specified thread |
| `send` | `<text>` | **Write:** send to the active channel |
| `delete` | `<message_id>` | **Write:** delete a visible message using Discord's UI permissions |

```bash
opencli discord-app servers -f table
opencli discord-app channels
opencli discord-app read --count 20
opencli discord-app read --url 'https://discord.com/channels/GUILD_ID/CHANNEL_ID' --count 20
opencli discord-app goto --guild GUILD_ID --channel CHANNEL_ID
opencli discord-app search 'earnings'
opencli discord-app threads --limit 30
opencli discord-app thread-read --thread THREAD_ID --guild GUILD_ID --channel CHANNEL_ID --count 20

# These two commands change Discord data. Check the active channel first.
opencli discord-app send 'Hello from OpenCLI'
opencli discord-app delete MESSAGE_ID
```

Replace uppercase placeholders with actual IDs. `--count` is an option, not a
positional argument. `opencli discord-app <command> --help` describes the exact
schema. Standard OpenCLI JSON envelopes and `-f table/json/yaml/md/csv` work normally.

## Compatibility and limits

The reference is upstream commit
[`2413694`](https://github.com/jackwener/OpenCLI/tree/24136945847afbfad266c6c46a8cd335377f9112/clis/discord-app),
immediately before Electron automation was removed by
[`f3e221f`](https://github.com/jackwener/OpenCLI/commit/f3e221f151336394452fc15f13922f82779dc404).
Its adapter source matches the OpenCLI 1.8.8 package. A checked-in fixture tests
all **11 command names, access modes, argument schemas and output columns**.

The plugin replaces the removed Electron launcher with its own local CDP
transport. It does not auto-launch Discord. The inherited UI-based behavior is
retained, with these deliberate corrections:

- Messages are not truncated to 300 characters; search text is not truncated to 200.
- Private conversations are marked `DirectMessage`, not `Text`.
- Unknown member presence is `Unknown`; an empty member panel raises `EMPTY_RESULT`.
- Counts and navigation URLs are validated.
- Sending refuses existing text/attachment drafts and checks for a new matching rendered message.
- Deletion scopes controls to the target message/menu/dialog and checks removal.
- Uncertain writes raise an error and are **never retried automatically**. Inspect
  Discord before retrying; an error after submission does not prove nothing happened.
- Delete retains upstream `{status, message}` rows for confirmed success or a
  pre-submission failure. Inspect `status`; a `failed` row is not a successful deletion.

Extraction covers currently rendered DOM, not complete history or pagination.
Attachments, rich formatting and hidden content are not fully exported. Names
resolve from visible sidebar items; IDs and URLs are more reliable. `channels`
on Friends returns private conversations. Show the member panel for `members`.
The inherited search selectors/wait and four-component thread URL model still
need validation against current Discord variants and languages.

Commands operate on the existing window. Navigation/search may change read/unread
state. Do not operate Discord or run another command concurrently with a write.
Sending can leave a draft when aborted before submission. Delete confirmation
labels currently support English and Simplified Chinese. If selectors drift,
commands may fail; inspect Discord rather than blindly retrying writes.

## Verification status

**Experimental.** Live macOS checks on Discord 0.0.421 / OpenCLI 2.0.3 passed for
connection, server listing, private-conversation classification, invalid arguments,
unreachable endpoints and empty-panel errors. Actual channel reads/search/thread
operations and real message sends/deletes remain **unverified**. No real messages
were sent or deleted during development.

Automated tests use synthetic DOM and mock CDP only. They cover interface parity,
message extraction, target checks, connection cleanup, send/draft/channel-change
behavior, delete control scoping and uncertain outcomes. They do not establish
live selector compatibility or server-side delivery guarantees.

## Develop

The repository root is a single OpenCLI plugin, following the
[OpenCLI plugin layout](https://opencli.info/docs/guide/plugins.html):

```text
opencli-plugin.json        # name, version, supported OpenCLI range
package.json              # ESM, peer dependency and test tooling
*.js                      # one command per root file
lib/connection.js         # local CDP transport and registration bridge
lib/utils.js              # upstream DOM extractors and route helpers
tests/                    # synthetic tests and upstream interface fixture
.github/workflows/test.yml # tests and plugin registration checks
LICENSE / NOTICE          # Apache-2.0 and upstream attribution
```

```bash
git clone https://github.com/harveyx86/opencli-plugin-discord-app.git
cd opencli-plugin-discord-app
npm ci --ignore-scripts
npm test
opencli plugin install "$PWD"
opencli adapter check discord-app
```

Local installation creates a link; changes take effect on the next invocation.
Keep the checkout in place. Plugin installation omits dev dependencies; run
`npm ci --ignore-scripts` again when returning to test development. Dependencies
are only development tooling; runtime registration uses the host OpenCLI package.
No TypeScript/build step or npm publication is required.

Strategy: DOM/UI extraction over local CDP. Authentication stays in the logged-in
Discord page; the plugin does not extract tokens or replay private HTTP APIs.
Maintain the narrow command/extractor when Discord changes, add synthetic
regression tests, and verify on a permitted test channel. Never commit real
messages, account data, browser captures or local settings. Preserve LICENSE and
NOTICE when redistributing. See [CONTRIBUTING.md](CONTRIBUTING.md) for changes and
[CHANGELOG.md](CHANGELOG.md) for releases.

## Update / uninstall

```bash
opencli plugin update discord-app
opencli plugin uninstall discord-app
```

A local development installation follows your checkout; use Git to manage source.
Uninstalling a local plugin removes its link, not the checkout.

## License

[Apache-2.0](LICENSE). Command implementations derive from OpenCLI contributors;
see [NOTICE](NOTICE). This plugin adds a standalone transport, tests and fixes.
