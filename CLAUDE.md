# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the main website for the Chinese Canadian Association of Kingston and District (CCAKD) at `ccakd.ca`. It is being rebuilt from a monolithic WordPress setup into a decoupled, serverless architecture.

## Design Documents

- **Spec:** `docs/superpowers/specs/2026-03-12-ccakd-website-redesign-design.md`
- **Plan:** `docs/superpowers/plans/2026-03-12-ccakd-website-main.md`
- Follow-up plans (Azure Function, GitHub Actions, content migration) to be created after main plan execution.

## Architecture

- **Frontend:** Astro (hybrid mode, SSG default) deployed to Cloudflare Workers (via Workers Static Assets)
- **CMS:** Keystatic (`@keystatic/astro`) — saves content as Markdown/MDX files committed to GitHub
- **Media Pipeline:** Google Drive (volunteer uploads) → Azure Functions (Node.js + `sharp`) → Cloudflare R2 (optimized WebP)
- **Gallery Frontend:** PhotoSwipe library for lightbox gallery rendering

### External Sub-Systems (separate repos/services)

- **Events/Ticketing:** Self-hosted hi.events at `events.ccakd.ca` — REST API (public, no auth) for homepage teasers, embed widget for `/events` page
- **Memberships:** Custom Astro SSR + React + Tailwind portal at `members.ccakd.ca` (repo: `ccakd/ccakd-members`, Cloudflare Workers + D1)
- **Newsletters:** Self-hosted Listmonk at `lists.ccakd.ca`

## Build & Deploy

```bash
# Development (Keystatic runs in local mode)
npm run dev

# Build
npm run build

# Deploy to Cloudflare Workers
npx wrangler deploy
```

Deployment is automated via GitHub Actions: content changes in Keystatic trigger a commit → GitHub Action → `wrangler deploy`. Gallery changes additionally trigger the Azure Function image pipeline before building.

## Key Configuration Files

- `astro.config.mjs` — Astro config: hybrid mode, CF adapter, i18n, integrations
- `keystatic.config.ts` — CMS content schemas (collections + singletons)
- `wrangler.json` — Cloudflare Workers deployment config
- `.github/workflows/` — CI/CD pipelines for content deployment and image processing

## Content Model (Keystatic)

- **Collections:** Announcements, Programs, Galleries
- **Singletons:** Homepage, About (with executives list), Terms & Conditions
- All content fields are trilingual (EN/ZH/ZH-TW)

Content is stored as `.mdoc` files in the repo, committed via Keystatic's GitHub integration.

## Trilingual i18n

Three locales: `en` (English), `zh` (Simplified Chinese), `zh-tw` (Traditional Chinese)
- Path-based routing: `/en/`, `/zh/`, `/zh-tw/`
- UI strings: `src/i18n/{en,zh,zh-tw}.json` + `src/i18n/utils.ts`
- CMS content: side-by-side trilingual fields per entry (e.g., `title_en`, `title_zh`, `title_zhtw`)
- Pattern reference: `~/personal-projects/ccakd-members/src/i18n/` (members portal uses identical i18n approach)

## Environment Variables

Local dev uses `.dev.vars` (gitignored). Required vars: `AZURE_AI_ENDPOINT`, `AZURE_AI_API_KEY`, `HIEVENTS_API_URL`, `KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET`, `KEYSTATIC_SECRET`
