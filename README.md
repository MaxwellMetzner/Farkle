# Farkle Lab

Static Farkle web app with:
- Playable human vs CPU game
- Exact EV strategy engine
- Game State Advisor for custom scenarios

## Local Run

Open `index.html` directly in your browser, or use a static server.

## Deploy to GitHub Pages

This repository includes a ready-to-use workflow at `.github/workflows/deploy-pages.yml`.

### 1. Push the project to GitHub

From the repo root:

```bash
git add .
git commit -m "Prepare Farkle Lab for GitHub Pages"
git push origin main
```

### 2. Enable GitHub Pages in repository settings

1. Go to your repository on GitHub.
2. Open **Settings**.
3. Open **Pages**.
4. Under **Build and deployment**:
5. Set **Source** to **GitHub Actions**.

### 3. Trigger deployment

- A deployment runs automatically on every push to `main`.
- You can also run it manually from **Actions** -> **Deploy Static Site to GitHub Pages** -> **Run workflow**.

### 4. Find your live URL

After a successful workflow run:
- Go to **Actions** and open the latest deploy run, or
- Go to **Settings** -> **Pages**.

Your site URL will be:

`https://maxwellmetzner.github.io/Farkle/`

## Notes

- `site.webmanifest`, `robots.txt`, `sitemap.xml`, `404.html`, and `.nojekyll` are included.
- If your repo name changes, update URL references in:
  - `robots.txt`
  - `sitemap.xml`
