# anti-slop provenance

- Source: https://github.com/dmmulroy/anti-slop
- Commit: `13909c9e07590f5a85d93c62712259fe14a883f7` (copied from `skills/install-anti-slop/assets/anti-slop/`)
- Verified: all 38 files match the upstream blob SHAs of that commit.
- Installed with: `npx skills add https://github.com/dmmulroy/anti-slop --skill install-anti-slop`, then the skill's `scripts/install.mjs`.
- Entry point: `tools/oxlint/anti-slop/index.ts`, registered in `.oxlintrc.json` as `jsPlugins` → `anti-slop`.
- Effect plugin (`effect/`): copied but not enabled, since the project does not depend on `effect`.
- Dependency: `@oxlint/plugins` pinned to the same version as `oxlint` (1.90.0).

## Local deviations

- `anti-slop/no-runtime-typeof` is off for `src/encode.ts` only. That module implements PHP
  `serialize()`, form encoding and response unwrapping, where branching on the JavaScript
  representation of a JSON value is the contract itself.
