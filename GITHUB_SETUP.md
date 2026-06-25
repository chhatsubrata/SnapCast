# Uploading SnapCast to GitHub — Step by Step

A beginner-friendly guide to put this project on GitHub. Follow it top to bottom.
Commands are run in a terminal **inside the project folder** (the folder that
contains `package.json`).

---

## 0. One-time setup (do this only once per computer)

1. **Install Git**
   - Linux (Debian/Ubuntu): `sudo apt install git`
   - macOS: `xcode-select --install`
   - Windows: download from <https://git-scm.com/download/win>

   Check it works:
   ```bash
   git --version
   ```

2. **Tell Git who you are** (shows up as the author of your uploads):
   ```bash
   git config --global user.name  "Your Name"
   git config --global user.email "you@example.com"
   ```

3. **Create a free GitHub account**: <https://github.com/signup>

---

## 1. Open a terminal in the project folder

```bash
cd "/home/empiric/subs_files/projects/extras/Shot Capture"
```

---

## 2. Double-check nothing secret will be uploaded

This project ships a `.gitignore` that already excludes `node_modules/`,
`release/`, build output, logs, and `.env` secrets. Preview exactly what *would*
be uploaded:

```bash
git init                 # turn this folder into a git repo (safe, local only)
git add .                # stage all non-ignored files
git status               # review the list — make sure no secrets appear
```

> If you see a file that should **not** be public (passwords, keys, large
> binaries), add its name to `.gitignore`, then run `git rm --cached <file>`
> and `git add .` again.

---

## 3. Make your first commit (a saved snapshot)

```bash
git commit -m "Initial commit: SnapCast"
```

---

## 4. Create an empty repository on GitHub

You can do this with the website **or** the GitHub CLI. Pick one.

### Option A — Website (easiest)

1. Go to <https://github.com/new>.
2. **Repository name:** `snapcast`
3. Visibility: **Public** or **Private** (your choice).
4. **Important:** leave "Add a README", "Add .gitignore", and "license"
   **unchecked** — this project already has them.
5. Click **Create repository**.
6. Copy the repo URL shown, e.g.
   `https://github.com/YOUR-USERNAME/snapcast.git`

### Option B — GitHub CLI (one command)

```bash
# install once: https://cli.github.com  — then:
gh auth login
gh repo create snapcast --source=. --public --push
```
If you use Option B, **skip steps 5 and 6** — it already created and pushed.

---

## 5. Connect your folder to the GitHub repo

Replace the URL with the one you copied in step 4.

```bash
git remote add origin https://github.com/YOUR-USERNAME/snapcast.git
git branch -M main
```

---

## 6. Push (upload) your code

```bash
git push -u origin main
```

- If asked for a password, GitHub no longer accepts your account password —
  use a **Personal Access Token** instead:
  <https://github.com/settings/tokens> → *Generate new token (classic)* →
  tick the **`repo`** scope → copy it → paste it as the password.
- The `-u` flag only needs to be used the first time. After that just
  `git push`.

Refresh your repo page on GitHub — your files are now online. 🎉

---

## 7. Everyday workflow (after the first upload)

Whenever you change code and want to upload the changes:

```bash
git add .
git commit -m "Describe what you changed"
git push
```

---

## 8. (Optional) Publish installable downloads as a Release

Your built installers live in `release/<version>/` and are **intentionally not**
committed (they're large). To let people download them, attach them to a GitHub
Release instead:

```bash
pnpm build:linux        # or build:win / build:mac — produces files in release/1.0.0/
gh release create v1.0.0 release/1.0.0/*.AppImage release/1.0.0/*.deb \
  --title "SnapCast 1.0.0" --notes "First release"
```

Users can then download the `.AppImage` / `.deb` / `.exe` / `.dmg` straight from
the repo's **Releases** tab (see the install table in the README).

---

## 9. Before you publish — tidy the placeholders

These still contain template values; update them so the repo looks finished:

- `package.json` → `author`, `homepage` (`your-org` → your username)
- `electron-builder.yml` → `linux.maintainer` (`your-email@example.com`)

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `fatal: not a git repository` | Run `git init` first (step 2). |
| `remote origin already exists` | `git remote set-url origin <your-url>` |
| Push rejected / auth failed | Use a Personal Access Token as the password (step 6). |
| Accidentally committed `node_modules` | `git rm -r --cached node_modules && git commit -m "drop node_modules"` |
| Wrong remote URL | `git remote -v` to view, `git remote set-url origin <url>` to fix. |
