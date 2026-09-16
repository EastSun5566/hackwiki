# Hackwiki

> A CLI and agent skill for maintaining a persistent wiki in HackMD.

## Install

```sh
npx skills add EastSun5566/hackwiki --skill hackwiki
```

Skills are installed in the current project by default. Add `-g` to use
Hackwiki across projects.

Then ask your agent to use Hackwiki. The installed skill handles authentication,
workspace selection, initialization, search, updates, and validation. A HackMD
API token is required; the skill will guide you if one is missing.

## CLI

```sh
npx @hackwiki/cli --help
```

See the [CLI](packages/cli/README.md) and [SDK](packages/sdk/README.md)
documentation for direct usage.

## Development

```sh
pnpm install
pnpm build
pnpm lint
pnpm test
```

To release: run `pnpm exec changeset version`, commit/push, wait for CI, then
run `pnpm release` and push the package tags. The tag workflow publishes to npm
and creates GitHub Releases. Configure npm Trusted Publisher on both packages
for `EastSun5566/hackwiki` / `release.yml`, allowing `npm publish`.
