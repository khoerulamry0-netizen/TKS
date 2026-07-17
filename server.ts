import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { requireAuth, AuthRequest } from "./src/middleware/auth.js";
import { getDbState, saveDbState } from "./src/db/sync.js";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "20mb" }));

// API Routes
app.use('/api', (req, res, next) => {
  console.log(`[API REQUEST] ${req.method} ${req.originalUrl}`);
  next();
});

app.get("/api/db", requireAuth, async (req: AuthRequest, res) => {
  console.log("[API] GET /api/db");
  try {
    const dbState = await getDbState();
    res.json(dbState);
  } catch (error: any) {
    console.error("Failed to load db state", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/db", requireAuth, async (req: AuthRequest, res) => {
  console.log("[API] POST /api/db");
  try {
    await saveDbState(req.body);
    const dbState = await getDbState();
    res.json({ success: true, db: dbState });
  } catch (error: any) {
    console.error("Failed to save db state", error); require("fs").writeFileSync("db-error.log", error.stack || error.message || String(error));
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/health", (req, res) => {
  console.log("[API] GET /api/health");
  res.json({ status: "ok" });
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
