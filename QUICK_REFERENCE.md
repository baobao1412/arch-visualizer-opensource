# Quick Reference

A cheat sheet for working with arch-visualizer.

## Setup & Running

```bash
# Clone
git clone https://github.com/baobao1412/arch-visualizer-opensource.git
cd arch-visualizer

# Install
npm install

# Develop
npm run dev          # http://localhost:5173

# Build
npm run build        # Creates dist/
npm run preview      # Preview dist locally
```

---

## File Structure Quick Guide

| File | Purpose |
|------|---------|
| `src/App.tsx` | Root layout (header + sidebar + diagram) |
| `src/data/flows.ts` | All nodes, edges, and flow definitions |
| `src/components/ArchDiagram.tsx` | React Flow diagram renderer |
| `src/components/ArchNode.tsx` | Individual node styling + highlights |
| `src/components/FlowSidebar.tsx` | Left sidebar with flow buttons |
| `src/components/FlowDetail.tsx` | Bottom-right description card |
| `src/index.css` | Global styles + Tailwind + ReactFlow overrides |
| `vite.config.ts` | Build configuration |

---

## Adding a New Flow (Step-by-Step)

**1. Add nodes to `BASE_NODES`:**
```typescript
{ 
  id: 'new-node',
  type: 'archNode',
  position: { x: 100, y: 200 },
  data: {
    label: 'New Node',
    column: 'api',
    desc: 'Description here'
  }
}
```

**2. Create edges in `BASE_EDGES`:**
```typescript
{ id: 'e-node-a-node-b', source: 'node-a', target: 'node-b', animated: false }
```

**3. Define flow in `FLOWS` array:**
```typescript
{
  id: 'my-flow-id',
  label: 'My Flow Title',
  description: 'What this flow does...',
  steps: ['node-1', 'node-2', 'node-3'],
  edgeIds: ['e-1-2', 'e-2-3'],
  color: '#38bdf8',  // hex color
}
```

**4. Test in browser**
- Save file (HMR reloads)
- Click your flow in sidebar to test

---

## Customization Snippets

### Change Flow Color

```typescript
// In FLOWS array, update color:
color: '#ff0000',  // red
color: '#00ff00',  // green
color: '#facc15',  // yellow
```

### Change Node Position

```typescript
// In BASE_NODES, update position:
position: { x: 300, y: 150 }
```

### Change Highlight Color

```typescript
// In src/components/ArchNode.tsx
const borderColor = d.highlighted ? '#your-color' : '#1e293b';
```

### Change Theme Colors

```css
/* In src/index.css */
:root {
  --bg-dark: #0a0a0f;
  --border: #1e293b;
  --text: #e2e8f0;
}
```

---

## Deployment One-Liners

```bash
# Vercel
npm install -g vercel && vercel

# Netlify
npm install -g netlify-cli && netlify deploy --prod

# GitHub Pages
npm install --save-dev gh-pages && npm run build && npx gh-pages -d dist

# Generic (build only)
npm run build  # Then upload dist/ to your host
```

---

## Common Terminal Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run preview          # Preview production build
npm run lint             # Check code quality

# Utilities
npm list                 # Show installed packages
npm update               # Update all packages
npm outdated             # Check for updates
npm cache clean --force  # Clear npm cache

# Git
git status               # See what changed
git diff                 # See exact changes
git add .                # Stage all changes
git commit -m "msg"      # Commit changes
git push                 # Push to GitHub
git pull                 # Pull from GitHub
git log --oneline        # See commit history
```

---

## Debugging

### Nothing showing?

```bash
# 1. Check console for errors (F12 → Console)
# 2. Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
# 3. Restart dev server: Stop (Ctrl+C) and run npm run dev again
```

### TypeScript errors?

```bash
# Check all errors
npx tsc --noEmit

# Fix common issues
npm install                    # Reinstall dependencies
rm -rf node_modules && npm i   # Nuclear option
```

### Port already in use?

```bash
npm run dev -- --port 3000
# or kill process on port 5173
lsof -i :5173
kill -9 <PID>
```

---

## VS Code Extensions (Recommended)

- **ES7+ React Snippets** — `dsznajder.es7-react-js-snippets`
- **Tailwind CSS IntelliSense** — `bradlc.vscode-tailwindcss`
- **TypeScript Vue Plugin** — `Vue.volar`
- **Prettier** — `esbenp.prettier-vscode`

---

## Color Palette (Pre-defined)

| Name | Hex | Usage |
|------|-----|-------|
| Cyan | `#38bdf8` | Flow highlight |
| Purple | `#a78bfa` | Flow highlight |
| Green | `#34d399` | Flow highlight |
| Orange | `#fb923c` | Flow highlight |
| Pink | `#f472b6` | Flow highlight |
| Yellow | `#facc15` | Flow highlight |
| Dark BG | `#0a0a0f` | Page background |
| Border | `#1e293b` | Node borders |
| Text | `#e2e8f0` | Primary text |

---

## React Flow Docs

- Official: [reactflow.dev](https://reactflow.dev)
- Tutorials: [reactflow.dev/learn](https://reactflow.dev/learn)
- API: [reactflow.dev/api](https://reactflow.dev/api)

---

## Useful Links

- Node.js: [nodejs.org](https://nodejs.org)
- React: [react.dev](https://react.dev)
- TypeScript: [typescriptlang.org](https://www.typescriptlang.org)
- Tailwind: [tailwindcss.com](https://tailwindcss.com)
- Vite: [vitejs.dev](https://vitejs.dev)
- Git: [git-scm.com](https://git-scm.com)
- GitHub: [github.com](https://github.com)

---

Print this page or bookmark for quick reference! 📌
