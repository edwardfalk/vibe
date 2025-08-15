import express from 'express';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = process.cwd();

const app = express();
const port = Number(process.env.PORT || 5500);

app.disable('x-powered-by');
app.use(compression());

// Serve static files from repo root
app.use(
  express.static(rootDir, {
    index: false,
    extensions: ['html'],
    fallthrough: true,
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-store');
      } else if (filePath.endsWith('.js')) {
        res.setHeader('Cache-Control', 'public, max-age=60');
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      }
    },
  })
);

// Explicit root route to index.html
app.get('/', (_req, res) => {
  const indexPath = path.join(rootDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(indexPath);
  } else {
    res.status(404).send('index.html not found');
  }
});

// Basic health endpoint
app.get('/__health', (_req, res) => {
  res.json({ ok: true });
});

// 404 handler
app.use((req, res) => {
  res.status(404).send(`Not Found: ${req.path}`);
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Dev server listening on http://localhost:${port}`);
});
