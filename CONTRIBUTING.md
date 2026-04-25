# Contributing to Mondrian Framework

Thank you for considering contributing to Mondrian Framework — community contributions are what make Mondrian a serious framework rather than a personal project. This document explains how the monorepo is organized and how to ship a change.

If anything below is unclear or out of date, please open a PR against this file.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md). By participating you agree to uphold it.

## Ways to contribute

- **Report bugs** — search [existing issues](https://github.com/mondrian-framework/mondrian-framework/issues) first. If nothing matches, [open a new issue](https://github.com/mondrian-framework/mondrian-framework/issues/new/choose) using the bug template — include a minimal reproduction.
- **Propose enhancements** — open a feature-request issue describing the use case before writing code, especially for cross-package or breaking changes.
- **Ask a question** — please use [GitHub Discussions](https://github.com/mondrian-framework/mondrian-framework/discussions) rather than the issue tracker.
- **Improve documentation** — typos, missing examples, and unclear explanations are great first contributions; the docs live under `packages/docs/`.
- **Write code** — pick up a [`good first issue`](https://github.com/mondrian-framework/mondrian-framework/labels/good%20first%20issue) or open a draft PR early to discuss approach.

## Reporting security issues

Please do **not** report security vulnerabilities through public GitHub issues. See [SECURITY.md](./SECURITY.md) for the responsible disclosure process.

## Development setup

Prerequisites:

- Node.js ≥ 20.9 (matches `package.json#engines`)
- npm 10+ (npm workspaces)

```bash
git clone https://github.com/mondrian-framework/mondrian-framework.git
cd mondrian-framework
npm ci
npm run build           # tsc across workspaces (uses TS project references)
npm test                # vitest across all workspaces
```

To run the example app end-to-end:

```bash
npm run spinup          # ci + build all + start example on :4000
# then open
#   http://localhost:4000/openapi
#   http://localhost:4000/graphql
#   http://localhost:4000/mondrian
```

The example uses Prisma. `npm run build` invokes `prisma generate` for the example package automatically — if you only want to regenerate the Prisma client run `npm run generate --workspace=@mondrian-framework/example`.

### Working on a single package

```bash
# run tests for one package only
npm test --workspace=@mondrian-framework/model

# build one package
npm run build --workspace=@mondrian-framework/rest

# clear all build artifacts and rebuild from scratch
npm run clear && npm run build
```

## Repository layout

The monorepo uses npm workspaces and TypeScript [project references](https://www.typescriptlang.org/docs/handbook/project-references.html) for incremental builds. Internal packages reference each other with `*` versions in their `package.json#dependencies`, and the root `tsconfig.json` aliases each package as `@mondrian-framework/<pkg>`.

Top-level structure:

```
packages/
  utils/                 low-level TS helpers
  model/                 type system (model, decoding, encoding, validation, arbitrary)
  module/                functions, modules, providers, guards, security, retrieve
  provider/rate-limiter/ rate limiter provider + guard
  rest/                  framework-agnostic REST + OpenAPI 3.1 generator
  rest-fastify/          Fastify adapter for rest
  graphql/               GraphQL schema/resolver generator
  graphql-yoga/          Yoga adapter for graphql
  direct/                native RPC runtime
  aws-sqs/               SQS consumer
  aws-lambda-{rest,sqs}/ Lambda handlers
  cron/                  scheduled runtime
  cli-commander/         CLI runtime
  cli/                   ready-built CLI for schema diffing
  ci-tools/              CI helpers (build OAS / GraphQL reports, schema diff)
  docs/                  Docusaurus site (canonical docs)
  example/               reference app (REST + GraphQL + Direct on Fastify)
```

When in doubt, look at how `packages/example/` uses the package you are modifying — every public API has at least one usage there.

## Submitting a change

1. **Fork** the repository and create a branch from `develop` (the default base branch).
2. **Make your changes**, keeping commits focused. Follow the [conventional commits](https://www.conventionalcommits.org/) format if possible (`fix:`, `feat:`, `docs:`, `refactor:`, `chore:`).
3. **Add tests** — every behavioral change should have at least one vitest test. Bug fixes ideally include a regression test that fails before the fix.
4. **Run the full suite** locally:
   ```bash
   npm run pretty   # prettier --write
   npm run build    # tsc across workspaces
   npm test         # vitest across workspaces
   ```
5. **Add a changeset** if your change affects a published package:
   ```bash
   npx changeset
   ```
   Pick the appropriate semver bump (`patch` / `minor` / `major`) and write a short user-facing summary. Documentation-only and example-only changes do not need a changeset (those packages are listed in `.changeset/config.json#ignore`).
6. **Open a pull request** against `develop`. Fill in the PR template — the reviewer will read it. Link any related issues.

## Coding style

- **TypeScript strict mode** — the monorepo uses `"strict": true`, NodeNext modules, and project references. Keep them.
- **Functional style** — application errors return `result.fail(...)`, not `throw`. Models are immutable by default.
- **No code generation** — leverage TypeScript's type system; do not introduce a build step that emits `.ts` files.
- **Prettier** is the formatter — `npm run pretty` rewrites every `.ts` file. Pre-commit cleanly.
- **Test framework**: [vitest](https://vitest.dev) + [@fast-check/vitest](https://fast-check.dev/) (property-based testing for `model.arbitrary`). Test timeout is 10s globally.

Tests live under `packages/<pkg>/tests/*.test.ts`.

## Releases

Releases are managed via [changesets](https://github.com/changesets/changesets):

```bash
npm run release       # changeset add && changeset version (bumps versions, writes CHANGELOGs)
npm run publish       # changeset publish (publishes to npm)
```

Maintainers handle the actual `publish` step — contributors only need to add a changeset (step 5 above).

## Getting help

- 💬 [GitHub Discussions](https://github.com/mondrian-framework/mondrian-framework/discussions) for questions and design discussions.
- 🐛 [Issues](https://github.com/mondrian-framework/mondrian-framework/issues) for bug reports and feature requests.
- 📖 [Documentation](https://mondrianframework.com/) for the full reference.

Thank you for contributing!
