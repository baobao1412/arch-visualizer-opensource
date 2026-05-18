# arch-visualizer

An interactive web-based architecture diagram visualizer for system design flows. Click on any flow to highlight the path through your system and view detailed descriptions.

**Demo**: Smart Home IoT Platform with 6 pre-configured flows showing data paths from devices → gateway → cloud → storage → external services.

## Features

- 🎨 **Interactive Flow Highlighting** — Click flows to highlight nodes and edges, dim everything else
- 🎯 **Column-Based Layout** — Organize system components into logical tiers (Device, Gateway, API, Data, External)
- 📊 **Dark Theme** — Professional dark mode with glowing highlights (cyan, purple, green, orange, pink, yellow)
- 🚀 **Fast & Lightweight** — Built with React, TypeScript, React Flow, and Tailwind CSS
- 🎮 **Zoom & Pan** — Native ReactFlow controls for navigation
- 📱 **Responsive** — Works on desktop and mobile

## Prerequisites

- **Node.js** 18+ (check with `node --version`)
- **npm** 9+ or **yarn**/pnpm (check with `npm --version`)

## Installation

### Clone or Download

```bash
# If you have the source locally
cd /path/to/arch-visualizer

# Or clone from GitHub
git clone https://github.com/baobao1412/arch-visualizer-opensource.git
cd arch-visualizer
```

### Install Dependencies

```bash
npm install
```

## Usage

### Development Server

Start the dev server at `http://localhost:5173/`:

```bash
npm run dev
```

Then open http://localhost:5173/ in your browser.

### Build for Production

Generate optimized static files in the `dist/` folder:

```bash
npm run build
```

### Preview Production Build Locally

```bash
npm run preview
```

## Project Structure

```
arch-visualizer/
├── src/
│   ├── components/
│   │   ├── ArchNode.tsx           # Node component with highlight styling
│   │   ├── ArchDiagram.tsx        # Main diagram renderer (ReactFlow)
│   │   ├── FlowSidebar.tsx        # Left sidebar with flow list
│   │   └── FlowDetail.tsx         # Bottom-right flow description card
│   ├── data/
│   │   └── flows.ts              # Node, edge, and flow definitions
│   ├── App.tsx                    # Root component
│   ├── index.css                  # Tailwind + ReactFlow styling
│   └── main.tsx                   # Entry point
├── index.html                     # HTML template
├── vite.config.ts                 # Vite configuration with Tailwind
├── tsconfig.json                  # TypeScript config
├── package.json                   # Dependencies & scripts
└── README.md                       # This file
```

## How to Customize

### Adding a New Flow

Edit `src/data/flows.ts`:

```typescript
export const FLOWS: FlowDef[] = [
  {
    id: 'my-flow',
    label: 'My Custom Flow',
    description: 'Description of what this flow does',
    steps: ['node-id-1', 'node-id-2', 'node-id-3'],
    edgeIds: ['e-id1-id2', 'e-id2-id3'],
    color: '#ff0000', // hex color
  },
  // ... other flows
];
```

### Adding a New Node

Edit `src/data/flows.ts` and add to `BASE_NODES`:

```typescript
{ 
  id: 'my-node',
  type: 'archNode',
  position: { x: 100, y: 200 },
  data: {
    label: 'My Node',
    column: 'api',
    desc: 'Short description',
  }
}
```

Then create an edge connecting to it:

```typescript
{ id: 'e-prev-node-my-node', source: 'prev-node', target: 'my-node', animated: false }
```

### Changing Colors

- Flow colors: `src/data/flows.ts` → `FLOWS[].color`
- Theme colors (background, text): `src/index.css` and `src/components/*`
- Update Tailwind colors in `tailwind.config.ts` (create if needed)

## Deployment

### Deploy to Vercel (Recommended)

```bash
npm install -g vercel
vercel
```

### Deploy to GitHub Pages

```bash
npm install --save-dev gh-pages
# Add to package.json: "deploy": "npm run build && gh-pages -d dist"
npm run deploy
```

### Deploy to Any Static Host

```bash
npm run build
# Upload dist/ folder to AWS S3, Netlify, Firebase, etc.
```

## Troubleshooting

### Port 5173 already in use?

```bash
npm run dev -- --port 3000
```

### Build fails?

```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Changes not showing?

Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows/Linux)

## Tech Stack

| Purpose | Package | Version |
|---------|---------|---------|
| UI Framework | React | ^18.3 |
| Language | TypeScript | ^5.0 |
| Build Tool | Vite | ^8.0 |
| Styling | Tailwind CSS | ^4.0 |
| Diagrams | @xyflow/react | ^12.0+ |

## Contributing

1. Fork the repo or clone locally
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes and test: `npm run dev`
4. Build to verify: `npm run build`
5. Commit: `git commit -m "feat: add xyz flow"`
6. Push and create a Pull Request

## License

MIT License

---

**Built with ❤️ for system architects and engineers** 🎨
