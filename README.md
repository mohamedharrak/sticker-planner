# 🖥️ Sticker Placement Planner

A full-stack interactive web app for planning sticker layouts on your laptop lid.
Upload photos (auto background removal via remove.bg), arrange stickers freely, and export a high-res PNG.
Layouts persist in MongoDB and fall back to `localStorage` when offline.

---

## 📸 Screenshots

### Main canvas
```
┌─────────────────────────────────────────────────────────────┐
│  Sidebar                │         Stage                     │
│  ┌──────────────────┐   │   ┌─────────────────────────┐    │
│  │ Uploads          │   │   │                         │    │
│  │ [Add Photos] [PNG]│   │   │    ╔══════════════╗    │    │
│  ├──────────────────┤   │   │    ║     ASUS      ║    │    │
│  │ Sticker Tray     │   │   │    ║  🐱  🔥  ⭐  ║    │    │
│  │  🐱  🔥  ⭐      │   │   │    ║               ║    │    │
│  ├──────────────────┤   │   │    ╚══════════════╝    │    │
│  │ Sticker Packs    │   │   │                         │    │
│  ├──────────────────┤   │   └─────────────────────────┘    │
│  │ Actions          │   │                                   │
│  │ [↩ Undo][↪ Redo] │   │                                   │
│  │ [▲ Fwd][▼ Back]  │   │                                   │
│  │ [↔ Flip H][↕ V]  │   │                                   │
│  │ [⊞ Snap][🔗 Share]│   │                                   │
│  │ [⬇ Export PNG]   │   │                                   │
│  ├──────────────────┤   │                                   │
│  │ Swap Device      │   │                                   │
│  ├──────────────────┤   │                                   │
│  │ Sticker Tint     │   │                                   │
│  │ Hue ━━━━━━━ 0°   │   │                                   │
│  │ Sat ━━━━━━━ 100% │   │                                   │
│  │ Bri ━━━━━━━ 100% │   │                                   │
│  └──────────────────┘   │                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## ✨ Features

### Phase 1 — Polish
| Feature | How |
|---|---|
| **Undo / Redo** | `Ctrl+Z` / `Ctrl+Y` — up to 60 steps |
| **Layer controls** | ▲ Forward / ▼ Backward buttons |
| **Save layout** | Auto-saves to MongoDB + `localStorage` on every change |
| **Flip sticker** | ↔ Flip H and ↕ Flip V toggles |

### Phase 2 — Features
| Feature | How |
|---|---|
| **Sticker tinting** | Hue / Saturation / Brightness sliders per sticker |
| **Swap device** | Upload any PNG/JPG to replace the laptop canvas |
| **Multi-select** | Shift+click individual stickers, or drag a selection box |
| **Snap to grid** | ⊞ toggle snaps to 24px grid while dragging |

### Phase 3 — Big features
| Feature | How |
|---|---|
| **Share link** | Encodes layout to a base64 URL hash — no backend needed |
| **Sticker packs** | Add raw GitHub PNG URLs to `PACK_URLS` in `app.js` |
| **High-DPI export** | 3× resolution PNG with drop shadows and reflections |

---

## 🗂️ Project Structure

```
sticker-planner/
├── stickers.html          # App shell — links CSS + JS
├── css/
│   └── style.css          # All styles (dark theme, layout, features)
├── js/
│   └── app.js             # All frontend logic + API sync
├── app/
│   ├── main.py            # FastAPI routes (CRUD + health)
│   └── db.py              # MongoDB connection via pymongo
├── requirements.txt       # Python dependencies
├── .env                   # Environment variables (not committed)
└── .venv/                 # Python virtual environment (not committed)
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS, HTML5 Canvas, CSS custom properties |
| Backend | Python 3.11+, FastAPI, Uvicorn |
| Database | MongoDB (local or Atlas) |
| BG Removal | [remove.bg API](https://www.remove.bg/api) |

---

## 🚀 Setup

### Prerequisites

- Python 3.11+
- MongoDB running locally (`mongodb://localhost:27017`) or a MongoDB Atlas URI
- A [remove.bg API key](https://www.remove.bg/api) (free — 50 credits/month)
- Any modern browser (Chrome, Edge, Firefox)

---

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/sticker-planner.git
cd sticker-planner
```

---

### 2. Create and activate virtual environment

```powershell
# Windows (PowerShell)
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

```bash
# macOS / Linux
python -m venv .venv
source .venv/bin/activate
```

---

### 3. Install Python dependencies

```bash
pip install -r requirements.txt
```

---

### 4. Configure environment variables

Create a `.env` file in the project root:

```env
MONGO_URL=mongodb://localhost:27017
MONGO_DB=stickers_db
```

For MongoDB Atlas, replace `MONGO_URL` with your connection string:

```env
MONGO_URL=mongodb+srv://user:password@cluster.mongodb.net/?retryWrites=true&w=majority
MONGO_DB=stickers_db
```

---

### 5. Start the backend

```bash
uvicorn app.main:app --reload
```

Expected output:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

Verify it's healthy:
```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
# → status: ok, database: connected
```

---

### 6. Open the frontend

Serve the frontend with Python's built-in server to avoid CORS issues with `file://`:

```powershell
# In a second terminal
python -m http.server 5500
```

Then open: **http://localhost:5500/stickers.html**

> ⚠️ Do not open `stickers.html` as a `file:///` path — browser CORS policy will block API calls to `localhost:8000`.

---

### 7. Enter your remove.bg API key

On first load, a modal appears asking for your remove.bg API key.
Paste it in and click **Verify**. The key is saved to `localStorage` and won't be asked again.

---

## 📡 API Reference

Base URL: `http://127.0.0.1:8000`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Health check message |
| `GET` | `/health` | Backend + DB status |
| `GET` | `/stickers` | List all stickers |
| `POST` | `/stickers` | Create a sticker |
| `PUT` | `/stickers/{id}` | Update sticker (position, tint, flip) |
| `DELETE` | `/stickers/{id}` | Delete one sticker |
| `DELETE` | `/stickers` | Clear all stickers |
| `POST` | `/seed` | Insert sample data |

Interactive docs (Swagger UI): **http://127.0.0.1:8000/docs**

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|---|---|
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Delete` / `Backspace` | Delete selected sticker |
| `Escape` | Deselect |
| `Shift+Click` | Add/remove from multi-selection |

---

## 🎨 Sticker Packs

To add your own sticker pack, edit `PACK_URLS` in `js/app.js`:

```javascript
const PACK_URLS = [
  'https://raw.githubusercontent.com/YOUR_USER/YOUR_REPO/main/pack/sticker1.png',
  'https://raw.githubusercontent.com/YOUR_USER/YOUR_REPO/main/pack/sticker2.png',
];
```

Images must be publicly accessible raw URLs (PNG with transparent background recommended).

---

## 🔗 Share Link

Click **🔗 Share Link** to copy a URL that encodes the current layout into a base64 hash.
Anyone opening that URL will see the same sticker positions.

> Note: Stickers uploaded from your local machine use blob URLs and cannot be shared.
> Only stickers from remote URLs (sticker packs) are included in share links.

---

## 📦 Cold Start Verification

```powershell
# 1. Activate venv
.\.venv\Scripts\Activate.ps1

# 2. Start backend
uvicorn app.main:app --reload

# 3. Check health (new terminal)
Invoke-RestMethod http://127.0.0.1:8000/health

# 4. Check empty stickers collection
Invoke-RestMethod http://127.0.0.1:8000/stickers

# 5. Serve frontend
python -m http.server 5500

# 6. Open browser → http://localhost:5500/stickers.html
#    You should see "Backend connected ✓" toast
```

---

## 🐛 Troubleshooting

**"Backend offline — using localStorage"**
→ Make sure `uvicorn app.main:app --reload` is running in a terminal.

**"Invalid key — check and try again"**
→ Make sure you're copying the key exactly (no spaces). Get one at [remove.bg/api](https://www.remove.bg/api).

**Stickers not persisting after reload**
→ Check that MongoDB is running: `mongod --version`. If using Atlas, verify `MONGO_URL` in `.env`.

**CORS errors in browser console**
→ Don't open `stickers.html` directly. Use `python -m http.server 5500` and visit `http://localhost:5500/stickers.html`.

---

## 📄 License

MIT
