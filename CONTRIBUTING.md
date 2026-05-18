# Contributing to arch-visualizer

Thanks for your interest in contributing! We love contributions from the community.

## Getting Started

### 1. Fork & Clone

```bash
# Fork the repo on GitHub, then clone your fork
git clone https://github.com/baobao1412/arch-visualizer.git
cd arch-visualizer
```

### 2. Install & Run

```bash
npm install
npm run dev
```

Then open http://localhost:5173 and make your changes.

### 3. Make Your Changes

- **Add a new flow?** Edit `src/data/flows.ts`
- **Update styling?** Modify `src/index.css` or component styles
- **Fix a bug?** Update relevant component in `src/components/`
- **Improve docs?** Update `README.md` or this file

### 4. Test Before Submitting

```bash
# Test development server
npm run dev

# Build to check for errors
npm run build

# Check TypeScript
npx tsc --noEmit
```

### 5. Commit & Push

```bash
git add .
git commit -m "feat: add xyz feature" # or "fix: resolve xyz bug"
git push origin feature/my-feature
```

### 6. Create a Pull Request

Go to GitHub and open a PR with:
- Clear title: "feat: add camera flow" or "fix: highlight not working"
- Description of changes
- Screenshots (if UI changes)

## Commit Message Convention

Use clear, descriptive commit messages:

```
feat:  Add new feature
fix:   Fix a bug
docs:  Update documentation
style: Format/refactor code (no logic change)
test:  Add or update tests
```

Example:
```
feat: add push notification flow to smart home demo
fix: highlight edges not showing on dark backgrounds
docs: add deployment guide to README
```

## Code Style

- **TypeScript**: Use strict types, avoid `any`
- **Formatting**: Indents = 2 spaces
- **Naming**: Use camelCase for variables/functions, PascalCase for components/types
- **Comments**: Add JSDoc comments for complex functions

## What We're Looking For

✅ **Good contributions:**
- Bug fixes with clear explanation
- New flows/nodes with realistic examples
- Performance improvements
- Documentation improvements
- UI/UX enhancements

❌ **We may decline:**
- Large refactors without discussion
- Major breaking changes
- External library integrations (suggest as feature request first)

## Need Help?

- **Questions?** Open a GitHub Discussion
- **Bug report?** Create an Issue with reproduction steps
- **Feature idea?** Open an Issue with [FEATURE] in title

## Running Tests

```bash
# Build check (TypeScript)
npm run build

# Lint (if configured)
npm run lint
```

## Code Review Process

1. A maintainer will review your PR
2. Feedback may be requested
3. Once approved, your PR will be merged
4. Your name will be added to CONTRIBUTORS (coming soon!)

Thanks for contributing! 🎉
