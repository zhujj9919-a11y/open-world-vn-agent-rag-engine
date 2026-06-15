# Asset Directory

This public repository intentionally does not include the local runtime image library.

The engine supports scene backdrops, character portraits, sprite variants, UI icons, and source-derived illustration registries, but those files are deployment assets rather than source code. Keep local/private asset packs outside Git history unless you have the rights to redistribute them.

Expected local layout:

```text
assets/
  generated/
  official/
  official-cutouts/
  source-novel/
  user/
```

Run the project checks after installing or restoring an asset pack:

```bash
npm run re0:check
```
