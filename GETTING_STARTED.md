# Getting Started with arch-visualizer

## 5-Minute Quick Start

### 1️⃣ Install Node.js (if you haven't already)

Visit [nodejs.org](https://nodejs.org) and download Node.js 18+

Verify installation:
```bash
node --version  # Should be v18 or higher
npm --version   # Should be 9 or higher
```

### 2️⃣ Get the Code

**Option A: Clone from GitHub**
```bash
git clone https://github.com/baobao1412/arch-visualizer-opensource.git
cd arch-visualizer
```

**Option B: Download ZIP**
- Go to GitHub repo → Code → Download ZIP
- Extract and open terminal in the folder

### 3️⃣ Install Dependencies

```bash
npm install
```

This downloads all required packages (React, Vite, Tailwind, etc.) into `node_modules/`

### 4️⃣ Start Development Server

```bash
npm run dev
```

Output:
```
VITE v8.0.13  ready in 450 ms

  Local:   http://localhost:5173/
```

### 5️⃣ Open in Browser

Click the link or manually visit: **http://localhost:5173/**

🎉 **You're running arch-visualizer!**

---

## What You Can Do Now

### Interact with the Demo

1. **See the diagram** — 15 nodes representing a Smart Home IoT system
2. **Click a flow** — Try "Sensor -> telemetry storage" on the left
3. **Watch the magic** — Nodes highlight, edges glow, description appears
4. **Try other flows** — Each one shows a different data path
5. **Zoom & Pan** — Use scroll to zoom, click-drag to move around

### Make Your First Edit

Edit the description of a flow:

1. Open `src/data/flows.ts` in VS Code
2. Find the flow labeled "sensor-telemetry"
3. Change the `description` text
4. Save the file → Browser auto-refreshes (HMR)

Try it! Edit this line:

```typescript
description: 'Sensor node publishes telemetry over MQTT. The broker forwards to the REST API which writes to InfluxDB. WebSocket server pushes live readings to the dashboard.',
```

Change it to anything and watch the app update instantly.

---

## Next Steps

### 📖 Read the Full Documentation

- **[README.md](README.md)** — Features, deployment, tech stack
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — How to contribute
- **[src/data/flows.ts](src/data/flows.ts)** — Understand the data structure

### 🎨 Customize Your Architecture

Add your own nodes and flows:

1. Define nodes in `src/data/flows.ts` → `BASE_NODES`
2. Create edges: `BASE_EDGES`
3. Define flows: `FLOWS`
4. Customize colors in flow definitions

### 🚀 Deploy to the Web

Choose one platform:

**Vercel** (Easiest)
```bash
npm install -g vercel
vercel
```

**GitHub Pages**
```bash
npm run build
# Upload dist/ folder to GitHub Pages
```

**Any Static Host** (Netlify, Firebase, AWS S3, etc.)
```bash
npm run build
# Upload the dist/ folder
```

### 💡 Learn React Flow

The diagram uses [React Flow](https://reactflow.dev/). Check their docs to:
- Add draggable nodes
- Create interactive connections
- Build advanced layouts

---

## Common Commands

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start dev server (http://localhost:5173) |
| `npm run build` | Create optimized production build |
| `npm run preview` | Test production build locally |
| `npm run dev -- --port 3000` | Run on port 3000 instead of 5173 |

---

## Stuck? Here's Help

### "Port 5173 is already in use"

```bash
npm run dev -- --port 3000
```

### "npm install fails"

```bash
rm -rf node_modules package-lock.json
npm install
```

### "My changes don't show up"

- Hard refresh browser: `Cmd+Shift+R` (Mac) / `Ctrl+Shift+R` (Windows)
- Stop dev server and restart: `npm run dev`

### "TypeScript errors?"

They're safe to ignore during development, but fix them before building for production:

```bash
npx tsc --noEmit  # Check for errors
npm run build     # Fails if errors exist
```

---

## Pro Tips

✨ **Use VS Code Extensions:**
- [ES7+ React/Redux/React-Native snippets](https://marketplace.visualstudio.com/items?itemName=dsznajder.es7-react-js-snippets)
- [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)

✨ **Keyboard Shortcuts in Dev:**
- `Ctrl+C` — Stop dev server
- `q` — Quit dev server
- `r` — Restart dev server
- `o` — Open browser

✨ **Git Workflow:**
```bash
git status          # See what changed
git diff            # See exact changes
git log --oneline   # See commit history
```

---

## You're Ready!

You now have a working development environment. Start building and customizing! 🚀

Questions? Check the [README](README.md) or open an issue on GitHub.

Happy coding! 🎨
