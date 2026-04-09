# GitHub Repo Remover (GitHub Pages)

A static web app you can host on GitHub Pages to:

- Load your repositories with a Personal Access Token (PAT)
- Filter repos by **name**, **public**, or **private**
- Delete repositories directly from the UI
- Track deleted repos in a local **60-day restore queue**
- Attempt restore via GitHub API restore endpoint when available

## Deploy to GitHub Pages

1. Push these files to your repository default branch.
2. In GitHub: **Settings → Pages**.
3. Under **Build and deployment**, choose:
   - **Source**: Deploy from a branch
   - Branch: `main` (or your default), folder `/ (root)`
4. Save and wait for Pages to publish.

## PAT permissions

Use a PAT that can administer repos you want to delete/restore.

- Private repositories typically require `delete_repo` and repo access.
- Public repositories still require administrative permission for delete.

## Important notes

- PAT is only read from the input field in your browser. This app does not persist it.
- The restore queue is stored in browser `localStorage`.
- GitHub may allow restores up to 90 days in some contexts, but this app intentionally enforces a 60-day restore window.
- If API restore is unavailable for your account type, use GitHub's deleted repositories UI.
