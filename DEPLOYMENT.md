# Deployment Guide

This guide covers how to deploy **arch-visualizer** to various hosting platforms.

## Pre-Deployment Checklist

Before deploying, ensure:

```bash
# 1. Test development build
npm run dev

# 2. Verify production build works
npm run build
npm run preview

# 3. Check for TypeScript errors
npx tsc --noEmit

# 4. Lint code (if configured)
npm run lint
```

---

## 🚀 Quick Deploy Options

### 1. Vercel (Recommended - Easiest)

Vercel is the maker of Next.js and Vite, perfect for React projects.

**Step 1: Install Vercel CLI**
```bash
npm install -g vercel
```

**Step 2: Deploy**
```bash
cd /path/to/arch-visualizer
vercel
```

You'll be prompted to:
- Link to GitHub account (optional but recommended)
- Choose project directory (press Enter for current)
- Choose build command: Use default
- Choose output directory: `dist`

**Done!** Your site is live at `your-project.vercel.app`

**Features:**
- ✅ Free tier available
- ✅ Automatic deploys on git push
- ✅ Custom domain support
- ✅ SSL included
- ✅ Preview URLs for PRs

---

### 2. Netlify (Fast & Simple)

**Via Web UI (No CLI needed)**

1. Push your code to GitHub
2. Go to [netlify.com](https://netlify.com)
3. Click "New site from Git"
4. Select your repo
5. Configure:
   - Build command: `npm run build`
   - Publish directory: `dist`
6. Click "Deploy site"

**Via CLI**
```bash
npm install -g netlify-cli
netlify deploy --prod
```

---

### 3. GitHub Pages (Free, GitHub-Hosted)

**Step 1: Install gh-pages**
```bash
npm install --save-dev gh-pages
```

**Step 2: Update package.json**
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "deploy": "npm run build && gh-pages -d dist"
  },
  "homepage": "https://baobao1412.github.io/arch-visualizer-opensource"
}
```

**Step 3: Deploy**
```bash
npm run deploy
```

Your site will be live at: `https://baobao1412.github.io/arch-visualizer-opensource`

**Note:** Every push to `main` triggers a new deploy automatically if you configure GitHub Actions.

---

## 🌥️ Traditional Cloud Platforms

### AWS S3 + CloudFront

**Step 1: Build**
```bash
npm run build
```

**Step 2: Create S3 bucket**
```bash
aws s3 mb s3://arch-visualizer --region us-east-1
```

**Step 3: Upload**
```bash
aws s3 sync dist/ s3://arch-visualizer --delete
```

**Step 4: Setup CloudFront (for HTTPS + caching)**
- Create CloudFront distribution pointing to S3
- Set default root object to `index.html`
- Enable custom domain (optional)

**Cost:** ~$1-5/month for low traffic

---

### Google Firebase Hosting

**Step 1: Install Firebase CLI**
```bash
npm install -g firebase-tools
firebase login
```

**Step 2: Initialize**
```bash
firebase init hosting
# Choose: Use existing project or create new
# Public directory: dist
# Configure as single-page app: Yes
# Set up automatic builds: No
```

**Step 3: Build & Deploy**
```bash
npm run build
firebase deploy
```

**Cost:** Free tier includes 10GB/month storage

---

### Azure Static Web Apps

```bash
# Via Azure CLI
az login
az staticwebapp create --name arch-visualizer --resource-group mygroup --source . --location westus --build-details-app-build-command "npm run build" --build-details-app-location "dist"
```

---

## 🔧 Environment Configuration

### Production Environment Variables

Create `.env.production`:
```
VITE_API_URL=https://api.example.com
VITE_ENV=production
```

Use in code:
```typescript
const apiUrl = import.meta.env.VITE_API_URL;
```

---

## 📊 Analytics & Monitoring

### Add Google Analytics

Edit `index.html`:
```html
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_ID');
</script>
```

### Add Sentry Error Tracking

```bash
npm install @sentry/react @sentry/tracing
```

In `src/main.tsx`:
```typescript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "your-sentry-dsn",
  environment: "production",
});
```

---

## 🔄 Continuous Deployment (CI/CD)

### GitHub Actions (Auto-deploy on push)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build
      - uses: vercel/action@master
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-args: '--prod'
```

**Setup:**
1. Generate [Vercel token](https://vercel.com/account/tokens)
2. Add as GitHub secret: `VERCEL_TOKEN`
3. Push to trigger auto-deploy

---

## 🚨 Common Issues

### "Cannot find module" on deployment

```bash
# Ensure all dependencies in package.json
npm install [missing-package]
npm run build
```

### Build output is empty

Check that `dist/` folder has files after build:
```bash
npm run build
ls -la dist/
```

### 404 errors on refresh

Configure server to serve `index.html` for all routes (React Router):

**Vercel:** Auto-configured  
**Netlify:** Auto-configured  
**GitHub Pages:** Add `_redirects` file:
```
/* /index.html 200
```

### Site slow?

Enable gzip compression and caching:
- Add headers to your hosting platform
- Enable CDN (CloudFront, Cloudflare)
- Optimize images

---

## 📈 Performance Tips

```bash
# Check build size
npm run build

# Analyze bundle
npm install -D rollup-plugin-visualizer
# Add to vite.config.ts and run build
```

---

## Rollback

### Vercel
```bash
vercel rollback
```

### Netlify
Deploy menu → Previous deploys → Publish

### GitHub Pages
```bash
git revert [commit-hash]
git push
```

---

## Domain Setup

1. Purchase domain (GoDaddy, Namecheap, etc.)
2. Update DNS:
   - Vercel: See Vercel dashboard for nameservers
   - Netlify: See Netlify dashboard for DNS records
   - GitHub Pages: `A` record pointing to GitHub IPs
3. Wait 24h for DNS propagation
4. Enable HTTPS/SSL (usually auto)

---

## Support

- **Vercel**: [vercel.com/support](https://vercel.com/support)
- **Netlify**: [netlify.com/support](https://netlify.com/support)
- **Firebase**: [firebase.google.com/support](https://firebase.google.com/support)
- **AWS**: [aws.amazon.com/support](https://aws.amazon.com/support)

Happy deploying! 🎉
