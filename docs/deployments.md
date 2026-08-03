# Deployments

Cloudflare Workers Builds deploys `main` to the `habits` Worker. It also manages branch and commit preview deployments.

GitHub Actions runs CI and creates release notes. It does not deploy, avoiding duplicate deployment systems.

## Cloudflare setup

- Connect the repository in Workers Builds.
- Set the production branch to `main`.
- Use `pnpm install` as the install command.
- Use `pnpm build` as the build command.
- Deploy the `build` directory as the static asset output.

Preview URLs use Cloudflare's `workers.dev` aliases because custom domains are not supported for aliased Worker previews. Every successful `main` push also creates a GitHub release with automatically generated notes.

## Changelog releases

`.github/workflows/changelog.yml` runs on every push to `main`. It creates a GitHub release tagged `deploy-<commit-sha>` and passes `--generate-notes` to the GitHub CLI. GitHub compares the new tag with the previous release and generates notes containing merged pull requests, contributors, and a full changelog link. The release points at the exact commit deployed by Cloudflare Workers Builds.

The workflow uses the built-in `GITHUB_TOKEN` with `contents: write`; no additional secret is required. Re-running the same workflow is safe because it skips a release that already exists.

Official documentation:

- [GitHub: Automatically generated release notes](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes)
- [GitHub CLI: `gh release create`](https://cli.github.com/manual/gh_release_create)
