# CI/CD Workflows Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate site deployment so content changes in Keystatic (and gallery manifest updates) trigger an Astro build + Cloudflare Workers deploy. Add a scheduled rebuild to keep hi.events data fresh.

**Architecture:** Two GitHub Actions workflows. Content Deploy handles all pushes to `main` and rebuilds/deploys the site. Scheduled Rebuild runs every 6 hours for fresh event data. The gallery pipeline's manifest commit must also trigger a deploy — solved by having the gallery pipeline call Content Deploy directly via `workflow_call` instead of relying on `GITHUB_TOKEN` push events (which don't trigger other workflows).

**Tech Stack:** GitHub Actions, Node.js 22, Astro, wrangler CLI

---

## Key Design Decision: Gallery → Deploy Trigger

**Problem:** The gallery pipeline commits the manifest using `GITHUB_TOKEN`. GitHub's security model prevents `GITHUB_TOKEN` pushes from triggering other workflows — so Content Deploy won't auto-fire after a gallery manifest commit.

**Options:**
1. **PAT (Personal Access Token)** — use a PAT instead of `GITHUB_TOKEN` in the gallery pipeline's push. PAT-triggered pushes DO trigger other workflows. Downside: PATs are tied to a personal account and expire.
2. **GitHub App token** — generate an installation token from a GitHub App. Same trigger behavior as PAT but not tied to a person. Downside: requires creating and managing a GitHub App.
3. **`workflow_call`** — the gallery pipeline directly calls Content Deploy as a reusable workflow after committing. No extra tokens needed. Downside: slightly couples the two workflows.
4. **`workflow_dispatch` API call** — gallery pipeline triggers Content Deploy via GitHub API. Requires a PAT or App token for the API call.

**Chosen: Option 3 (`workflow_call`)** — simplest, no extra secrets, no token management. The gallery pipeline already knows it needs a deploy after committing, so calling it directly is natural.

---

## File Structure

```
.github/
└── workflows/
    ├── gallery-pipeline.yml     # Existing — will be modified to call deploy
    ├── deploy.yml               # NEW — Content Deploy (push + workflow_call + cron)
```

---

## GitHub Secrets Required

| Secret | Purpose | How to get it |
|--------|---------|---------------|
| `CLOUDFLARE_API_TOKEN` | `wrangler deploy` authentication | Cloudflare dashboard → My Profile → API Tokens → Create Token → "Edit Cloudflare Workers" template |
| `CLOUDFLARE_ACCOUNT_ID` | Identifies your Cloudflare account | Cloudflare dashboard → any domain → Overview → right sidebar → Account ID |

**Note:** The Cloudflare API Token needs these permissions:
- Account: Cloudflare Workers Scripts — Edit
- Zone: (optional, only if using custom domain routing)

---

## Chunk 1: Content Deploy Workflow

### Task 1: Create the deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create the deploy workflow**

```yaml
name: Deploy

on:
  # Trigger on push to main (content or code changes)
  push:
    branches: [main]
    paths:
      - 'content/**'
      - 'src/**'
      - 'public/**'
      - 'astro.config.mjs'
      - 'keystatic.config.ts'
      - 'package.json'
      - 'wrangler.json'

  # Allow gallery pipeline to call this workflow after committing manifest
  workflow_call:

  # Scheduled rebuild every 6 hours for fresh hi.events data
  schedule:
    - cron: '0 */6 * * *'

  # Manual trigger
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build Astro site
        env:
          AZURE_AI_ENDPOINT: ${{ secrets.AZURE_AI_ENDPOINT }}
          AZURE_AI_API_KEY: ${{ secrets.AZURE_AI_API_KEY }}
          HIEVENTS_API_URL: ${{ secrets.HIEVENTS_API_URL }}
        run: npm run build

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

      - name: Job summary
        run: |
          echo "## Deploy Results" >> "$GITHUB_STEP_SUMMARY"
          echo "" >> "$GITHUB_STEP_SUMMARY"
          echo "| Field | Value |" >> "$GITHUB_STEP_SUMMARY"
          echo "|-------|-------|" >> "$GITHUB_STEP_SUMMARY"
          echo "| Trigger | ${{ github.event_name }} |" >> "$GITHUB_STEP_SUMMARY"
          echo "| Commit | \`$(git rev-parse --short HEAD)\` |" >> "$GITHUB_STEP_SUMMARY"
          echo "| Site | https://ccakd.ca |" >> "$GITHUB_STEP_SUMMARY"
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat: add deploy workflow (push, schedule, workflow_call)"
```

---

### Task 2: Update gallery pipeline to call deploy after manifest commit

**Files:**
- Modify: `.github/workflows/gallery-pipeline.yml`

- [ ] **Step 1: Add a deploy job that runs after process-gallery**

Add a second job at the end of gallery-pipeline.yml that calls the deploy workflow:

```yaml
  deploy:
    needs: process-gallery
    if: needs.process-gallery.result == 'success'
    uses: ./.github/workflows/deploy.yml
    secrets: inherit
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/gallery-pipeline.yml
git commit -m "feat: trigger deploy after gallery pipeline completes"
```

---

## Chunk 2: Validation

### Task 3: Validate both workflows

- [ ] **Step 1: Validate YAML syntax for both files**

- [ ] **Step 2: Test Content Deploy manually**

Go to Actions → Deploy → Run workflow. Verify:
- [ ] Astro build succeeds
- [ ] `wrangler deploy` succeeds
- [ ] Site is updated at ccakd.ca

- [ ] **Step 3: Test gallery → deploy chain**

Run the gallery pipeline. Verify:
- [ ] Gallery pipeline completes
- [ ] Deploy job triggers automatically after gallery pipeline
- [ ] Site is updated with new gallery data

- [ ] **Step 4: Test Keystatic content change**

Edit an announcement in Keystatic → save → verify:
- [ ] Push triggers Content Deploy
- [ ] Site reflects the change

---

## Decisions Log

| Decision | Rationale |
|----------|-----------|
| `workflow_call` for gallery → deploy | No extra tokens/secrets needed, `GITHUB_TOKEN` pushes don't trigger other workflows |
| `cloudflare/wrangler-action@v3` | Official Cloudflare action, handles wrangler install and auth |
| 6-hour cron schedule | Keeps hi.events data reasonably fresh without excessive builds |
| `paths` filter on push trigger | Avoids unnecessary deploys for non-content changes (e.g., docs, CI config) |
| Build-time env vars for API keys | Astro SSG fetches data at build time, not runtime (except Keystatic API routes which use CF Worker secrets) |
