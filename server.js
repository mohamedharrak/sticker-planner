import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "10mb" }));
app.use(express.static("public"));

const createInitialState = () => ({
  stickers: [],
  layouts: [],
  settings: {
    activeLayoutId: null
  }
});

const state = createInitialState();

const storage = {
  getState() {
    return state;
  },
  reset() {
    Object.assign(state, createInitialState());
    return state;
  }
};

const nowIso = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const isNum = (v) => Number.isFinite(v);
const toNum = (v, fallback) => (isNum(Number(v)) ? Number(v) : fallback);

function error(res, status, message) {
  return res.status(status).json({ error: message });
}

function sanitizeStickerPayload(payload = {}, { partial = false } = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { err: "Sticker payload must be an object." };
  }

  if (!partial && (typeof payload.src !== "string" || !payload.src.trim())) {
    return { err: "Sticker src is required." };
  }

  const out = {};

  if (payload.src !== undefined) {
    if (typeof payload.src !== "string" || !payload.src.trim()) {
      return { err: "Sticker src must be a non-empty string." };
    }
    out.src = payload.src;
  }

  if (payload.name !== undefined) {
    out.name = String(payload.name || "sticker").trim() || "sticker";
  }

  if (payload.category !== undefined) {
    out.category = String(payload.category || "custom").trim() || "custom";
  }

  const numericFields = ["x", "y", "w", "h", "rot", "hue", "sat", "br"];
  for (const key of numericFields) {
    if (payload[key] !== undefined) {
      const n = Number(payload[key]);
      if (!isNum(n)) {
        return { err: `Sticker field ${key} must be numeric.` };
      }
      out[key] = n;
    }
  }

  for (const key of ["flipH", "flipV"]) {
    if (payload[key] !== undefined) {
      if (typeof payload[key] !== "boolean") {
        return { err: `Sticker field ${key} must be boolean.` };
      }
      out[key] = payload[key];
    }
  }

  return { value: out };
}

function normalizeNewSticker(payload) {
  const ts = nowIso();
  return {
    id: makeId("sticker"),
    name: (payload.name || "sticker").trim() || "sticker",
    category: (payload.category || "custom").trim() || "custom",
    src: payload.src,
    x: toNum(payload.x, 100),
    y: toNum(payload.y, 100),
    w: Math.max(1, toNum(payload.w, 100)),
    h: Math.max(1, toNum(payload.h, 100)),
    rot: toNum(payload.rot, 0),
    flipH: Boolean(payload.flipH ?? false),
    flipV: Boolean(payload.flipV ?? false),
    hue: toNum(payload.hue, 0),
    sat: toNum(payload.sat, 100),
    br: toNum(payload.br, 100),
    createdAt: ts,
    updatedAt: null
  };
}

function normalizeLayout(payload) {
  const ts = nowIso();
  return {
    id: makeId("layout"),
    name: payload.name.trim(),
    deviceImage: typeof payload.deviceImage === "string" ? payload.deviceImage : "",
    stickers: [],
    createdAt: ts,
    updatedAt: null
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", storage: "in-memory" });
});

app.get("/api/state", (_req, res) => {
  res.json(storage.getState());
});

app.get("/api/stickers", (_req, res) => {
  res.json({ stickers: storage.getState().stickers });
});

app.post("/api/stickers", (req, res) => {
  const check = sanitizeStickerPayload(req.body, { partial: false });
  if (check.err) return error(res, 400, check.err);

  const sticker = normalizeNewSticker({ ...req.body, ...check.value });
  storage.getState().stickers.push(sticker);
  res.status(201).json(sticker);
});

app.put("/api/stickers/:id", (req, res) => {
  const { id } = req.params;
  const target = storage.getState().stickers.find((s) => s.id === id);
  if (!target) return error(res, 404, "Sticker not found.");

  const allowedKeys = new Set(["name", "category", "src", "x", "y", "w", "h", "rot", "flipH", "flipV", "hue", "sat", "br"]);
  const unknownKeys = Object.keys(req.body || {}).filter((k) => !allowedKeys.has(k));
  if (unknownKeys.length) {
    return error(res, 400, `Unknown sticker fields: ${unknownKeys.join(", ")}.`);
  }

  const check = sanitizeStickerPayload(req.body, { partial: true });
  if (check.err) return error(res, 400, check.err);

  const patch = check.value;
  if (patch.w !== undefined) patch.w = Math.max(1, patch.w);
  if (patch.h !== undefined) patch.h = Math.max(1, patch.h);
  if (patch.name !== undefined) patch.name = patch.name.trim() || "sticker";
  if (patch.category !== undefined) patch.category = patch.category.trim() || "custom";

  Object.assign(target, patch, { updatedAt: nowIso() });
  res.json(target);
});

app.delete("/api/stickers/:id", (req, res) => {
  const { id } = req.params;
  const list = storage.getState().stickers;
  const index = list.findIndex((s) => s.id === id);
  if (index === -1) return error(res, 404, "Sticker not found.");
  const [removed] = list.splice(index, 1);
  res.json({ message: "Sticker deleted.", sticker: removed });
});

app.delete("/api/stickers", (_req, res) => {
  storage.getState().stickers = [];
  res.json({ message: "All stickers cleared." });
});

app.get("/api/layouts", (_req, res) => {
  res.json({ layouts: storage.getState().layouts });
});

app.post("/api/layouts", (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) return error(res, 400, "Layout name is required.");

  const layout = normalizeLayout({ ...req.body, name });
  storage.getState().layouts.push(layout);
  if (!storage.getState().settings.activeLayoutId) {
    storage.getState().settings.activeLayoutId = layout.id;
  }
  res.status(201).json(layout);
});

app.get("/api/layouts/:id", (req, res) => {
  const layout = storage.getState().layouts.find((l) => l.id === req.params.id);
  if (!layout) return error(res, 404, "Layout not found.");
  res.json(layout);
});

app.put("/api/layouts/:id", (req, res) => {
  const layout = storage.getState().layouts.find((l) => l.id === req.params.id);
  if (!layout) return error(res, 404, "Layout not found.");

  const allowed = new Set(["name", "deviceImage", "stickers"]);
  const unknown = Object.keys(req.body || {}).filter((k) => !allowed.has(k));
  if (unknown.length) return error(res, 400, `Unknown layout fields: ${unknown.join(", ")}.`);

  const patch = {};
  if (req.body.name !== undefined) {
    if (typeof req.body.name !== "string" || !req.body.name.trim()) {
      return error(res, 400, "Layout name must be a non-empty string.");
    }
    patch.name = req.body.name.trim();
  }
  if (req.body.deviceImage !== undefined) {
    if (typeof req.body.deviceImage !== "string") {
      return error(res, 400, "deviceImage must be a string.");
    }
    patch.deviceImage = req.body.deviceImage;
  }
  if (req.body.stickers !== undefined) {
    if (!Array.isArray(req.body.stickers)) {
      return error(res, 400, "Layout stickers must be an array.");
    }
    patch.stickers = req.body.stickers;
  }

  Object.assign(layout, patch, { updatedAt: nowIso() });
  res.json(layout);
});

app.delete("/api/layouts/:id", (req, res) => {
  const list = storage.getState().layouts;
  const index = list.findIndex((l) => l.id === req.params.id);
  if (index === -1) return error(res, 404, "Layout not found.");

  const [removed] = list.splice(index, 1);
  if (storage.getState().settings.activeLayoutId === removed.id) {
    storage.getState().settings.activeLayoutId = list[0]?.id || null;
  }

  res.json({ message: "Layout deleted.", layout: removed });
});

app.post("/api/reset", (_req, res) => {
  storage.reset();
  res.json({ message: "State reset.", state: storage.getState() });
});

app.use("/api", (_req, res) => error(res, 404, "API route not found."));

app.use((err, _req, res, _next) => {
  const message = err?.message || "Internal server error.";
  return error(res, 500, message);
});

app.listen(port, () => {
  console.log(`Sticker Planner server running on http://localhost:${port}`);
});
