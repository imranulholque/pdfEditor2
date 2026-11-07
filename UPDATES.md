# Live updates from GitHub (no rebuild)

The installed app = a small **shell** (`main.js`, `preload.js`, `lib/`) + the **editor** (`index.html`, `js/*.js`, `knowledge/*.json`).

* Edit the editor files in your GitHub repo and commit. On the next launch (or ⚙ → *Check for updates now*) the app downloads
  only the changed files, verifies each one against GitHub's own SHA-1, and shows **“Update downloaded – Reload now”**.
* You only need a new `.exe` when you change `main.js`, `preload.js`, `package.json` or `lib/` (the Action builds it only then).

## One-time setup
1. Push this project to your GitHub repo.
2. In the app: **⚙ Update & AI** → type `yourname/pdfEditor2` (and a token only if the repo is private) → Save.

## Safety
* Only `index.html`, `js/*.js`, `knowledge/*.json` are ever synced. Nothing else can be replaced.
* A broken download is rejected (checksum), and an update that crashes on start is **rolled back automatically** to the bundled version.

## Learning
* **Local:** fonts that worked, downloaded fonts, and your word corrections are saved in the app's data folder.
* **✍ Teach:** right-click a line → type the correct text → saved per PDF font and applied to every PDF that has the same broken word.
* **🤖 Read with AI (optional):** add a Claude API key in ⚙. Only the picture of the line you click is sent. The answer goes into the box for you to check, then ✍ Teach saves it.
* **Share what was learned:** ⚙ → *Copy learned fixes* → merge into `knowledge/fixes.json` → commit. All installs get it on their next update.
