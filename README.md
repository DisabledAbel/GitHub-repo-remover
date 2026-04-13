# GitHub Repo Remover

A static GitHub Pages app for loading, filtering, deleting, and restoring GitHub repositories from a browser UI using a Personal Access Token (PAT).

## Features

- Load repositories owned by the authenticated user
- Filter repos by name
- Filter repos by visibility: all, public, private
- Delete repositories directly from the UI
- Track deleted repositories in a browser-side restore queue
- Attempt restore through the GitHub API when available
- Fall back to GitHub’s deleted repositories page if API restore is unavailable

### Data flow

1. You paste a GitHub PAT into the token field.
2. The app calls the GitHub API to load repositories you own.
3. Repositories are rendered in a table with search and visibility filters.
4. When you delete a repo, the app sends a `DELETE` request to the GitHub API.
5. The deleted repository is added to a local restore queue in `localStorage`.
6. Restore actions are attempted through the GitHub API restore endpoint.
7. If restore fails, the app shows GitHub’s deleted repositories page as the fallback.

## API usage

The app uses these GitHub REST API endpoints:

- `GET /user/repos?per_page=100&type=owner&sort=updated&page=N`
- `DELETE /repos/{owner}/{repo}`
- `POST /repos/{owner}/{repo}/restore`

## Authentication

Use a GitHub PAT with permission to manage the repositories you want to delete or restore.

Notes:

- The token is only read from the browser input field.
- The app does not persist the token.
- Private repositories typically require `delete_repo` plus access to the repository.
- Public repositories still require administrative permission to delete.

## Restore queue

Deleted repositories are tracked locally in the browser.

- Stored in `localStorage`
- Includes repository name, owner, visibility, delete time, expiration time, and restore state
- Enforced restore window: 90 days
- A repository is marked as restored after a successful restore request

## Limitations

- Repo loading is capped at 10 pages of 100 repositories each, so very large accounts may not load beyond 1,000 repos.
- Restore history lives only in the current browser’s `localStorage`.
- If `localStorage` is cleared, the local restore queue is lost.
- Restore support may depend on the repository and account type.
- The app only lists repositories owned by the authenticated user.

## Project structure

- `index.html` — UI markup
- `styles.css` — styling
- `app.js` — repository loading, filtering, deletion, and restore logic
- `scripts/check-restore-days.js` — checks GitHub docs for restore-window changes and updates project constants
- `LICENSE` — project license

## Automation

- GitHub Actions workflow: `.github/workflows/check-restore-window.yml`
- Runs every 24 hours plus manual dispatch
- Reads GitHub’s “Restoring a deleted repository” docs page
- If restore-window days changed, updates `app.js` and this README, then commits the change

## Security notes

* Treat your PAT like a password.
* Use the least-privileged token that can do the job.
* Do not share the token with anyone.
* The app stores restore metadata locally, not the token.

## License

GPL-3.0
