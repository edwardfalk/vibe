# Removing Committed Secrets & Rewriting Git History

> **TL;DR** – Run the commands below, push with `--force-with-lease`, rotate your token, and verify CI passes.

## 1. Disable / Rotate Vulnerable Tokens

1. Go to <https://github.com/settings/tokens> → delete the exposed PAT.
2. Generate a new token with the same scopes (repo → contents, pull-requests). Save it in your local `.env` **only**.
3. Add the new token to **GitHub → Settings → Secrets → Actions → `GITHUB_TOKEN`**.

## 2. Purge `.env` and Token From History

We use `git filter-repo` (faster successor to BFG). Install once:

```cmd
pip install git-filter-repo
```

Then, from repo root:

```cmd
REM Remove every `.env` file and the specific token string
set TOKEN=ghp_EXAMPLE_TOKEN

REM Purge files named .env
git filter-repo --invert-paths --path ".env" --force

REM Purge string matches (surgical)
git filter-repo --replace-text <(echo "$TOKEN==TOKEN_REMOVED") --force

REM Re-check repo size & log
bun run scan:secrets --all
```

## 3. Force Push & Reset Remotes

```cmd
git push origin --force-with-lease
```

Any collaborators must run:

```cmd
git fetch origin
git reset --hard origin/<branch>
```

## 4. CI Verification

1. Ensure GitHub Actions w orkflows pass (`scan:secrets --all` step).
2. Confirm website deploy still succeeds.

## 5. Prevent Future Leaks

Pre-commit hook now runs a fast secret scanner. If it blocks you:

- You probably have a real secret in code – move it to `.env`.
- If it’s a false positive, refine the regex in `scripts/scan/secret-scan.js`.

---

_Last updated: 2025-08-17_
