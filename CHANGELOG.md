# Changelog

## 0.2.0

- Restore all eleven pre-removal `discord-app` command interfaces, including send and delete.
- Package as a standalone OpenCLI 2.x plugin with local CDP transport.
- Add contract parity tests against upstream commit 24136945847afbfad266c6c46a8cd335377f9112.
- Preserve full extracted message text and identify direct-message sidebar entries.
- Protect drafts and scope deletion controls; never automatically retry uncertain writes.
- Add synthetic DOM tests, installation documentation and CI.
- Live channel/search/thread/write validation is still pending; this release is experimental.

## 0.1.0 (local prototype)

- Initial nine-command read-only extraction and local connection verification.
