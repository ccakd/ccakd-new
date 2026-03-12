# CCAKD Website Redesign — Design Specification

## Overview

Rebuild the CCAKD (Chinese Canadian Association of Kingston and District) website from a monolithic WordPress setup to a decoupled, static-first architecture using Astro on Cloudflare Workers. The new site must support trilingual content (English, Simplified Chinese, Traditional Chinese), provide a WYSIWYG editing experience for volunteers via Keystatic CMS, and automate the gallery photo processing pipeline.

**Live site:** https://ccakd.ca
**Current theme repo:** github.com/ccakd/wp-content
**Members portal repo:** github.com/ccakd/ccakd-members

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Cloudflare Edge                        │
│                                                          │
│  ┌──────────────────────┐    ┌────────────────────────┐  │
│  │  Workers Static      │    │  R2 Bucket             │  │
│  │  Assets (Astro SSG)  │    │  (Gallery Photos)      │  │
│  │  ccakd.ca/*          │    │                        │  │
│  └──────────────────────┘    └────────────────────────┘  │
│                                                          │
│  ┌──────────────────────┐                                │
│  │  Worker API Routes   │                                │
│  │  /api/translate      │                                │
│  └──────────────────────┘                                │
└─────────────────────────────────────────────────────────┘
          │                          ▲
          │ GitHub Action            │ Upload processed
          │ triggers build           │ WebP images
          ▼                          │
┌──────────────────┐      ┌──────────────────────┐
│  GitHub Repo     │      │  Azure Function       │
│  Keystatic CMS   │      │  (sharp/Node.js)      │
│  content as .mdoc│      │  Download from GDrive  │
│  + Astro source  │      │  Resize/compress       │
└──────────────────┘      │  Upload to R2          │
                          └──────────────────────┘
                                    ▲
                          ┌──────────────────────┐
                          │  Google Drive         │
                          │  (Volunteer uploads   │
                          │   original photos)    │
                          └──────────────────────┘
```

### Rendering Strategy

Astro in **hybrid mode** with static rendering as the default:
- All content pages are pre-rendered at build time (SSG)
- Server-rendered routes limited to: Keystatic admin UI (`/keystatic/*`) and `/api/translate`
- hi.events data fetched at build time for homepage event teasers; a scheduled rebuild every 6 hours keeps it fresh

### External Sub-Systems (separate infrastructure)

| Service | URL | Purpose |
|---------|-----|---------|
| hi.events | events.ccakd.ca | Event ticketing and management |
| Members Portal | members.ccakd.ca | Membership registration, login, payments (Astro SSR + D1) |
| Listmonk | lists.ccakd.ca | Email newsletters |

---

## 2. Trilingual Content Model

### Locale Codes and Routing

Following the pattern established by the members portal:

| Locale | Code | URL prefix | Label |
|--------|------|------------|-------|
| English | `en` | `/en/` | EN |
| Simplified Chinese | `zh` | `/zh/` | 简体 |
| Traditional Chinese | `zh-tw` | `/zh-tw/` | 繁體 |

Root `/` redirects to `/en/` via a 302 redirect (not 301, to allow default language changes in the future). Language switcher in navigation links to the same page in other locales.

### UI Strings

JSON translation files, same approach as the members portal:

```
src/i18n/
  en.json        # English UI strings
  zh.json        # Simplified Chinese UI strings
  zh-tw.json     # Traditional Chinese UI strings
  utils.ts       # getLangFromUrl(), t(), localePath(), Locale type
```

### CMS Content

All volunteer-authored content uses **side-by-side trilingual fields** in a single Keystatic entry:

```
title_en:   "2026 Lunar New Year Potluck Party"
title_zh:   "2026年农历新年聚餐派对"
title_zhtw: "2026年農曆新年聚餐派對"
body_en:    (rich text)
body_zh:    (rich text)
body_zhtw:  (rich text)
```

### AI-Assisted Translation

Volunteers write content in any one language, then click a "Translate" button to auto-generate the other two via AI:

1. Keystatic UI calls `POST /api/translate` with source text and source locale
2. Cloudflare Worker proxies to Azure AI Foundry (hosted LLM)
3. Returns translations for the other two languages
4. Fields are populated — volunteer can review and edit before saving

**Security:** The `/api/translate` endpoint is protected by the Keystatic session — only authenticated CMS users (logged in via Keystatic's GitHub OAuth) can call it. Unauthenticated requests return 401. Additionally, rate limiting is applied: max 20 translation requests per user per hour to prevent cost overrun on Azure AI Foundry.

### Page Structure

Duplicated per locale (same pattern as members portal):

```
src/pages/
  en/
    index.astro
    about.astro
    events.astro
    programs.astro
    gallery/index.astro
    gallery/[slug].astro
    announcements/index.astro
    announcements/[slug].astro
  zh/
    (same structure)
  zh-tw/
    (same structure)
```

Shared components receive `locale` as a prop.

---

## 3. Keystatic Content Schemas

### Collections

**Announcements** (`content/announcements/*`)
| Field | Type | Notes |
|-------|------|-------|
| slug | slug | Auto-generated from `title_en` (English title always used for URL slugs) |
| title_en, title_zh, title_zhtw | text | Trilingual titles |
| body_en, body_zh, body_zhtw | document (WYSIWYG) | Rich text with inline images |
| feature_image | image | Optional, stored in repo |
| date | date | Publish date |
| pinned | checkbox | Featured on homepage |

**Programs** (`content/programs/*`)
| Field | Type | Notes |
|-------|------|-------|
| slug | slug | Auto-generated from title |
| title_en, title_zh, title_zhtw | text | Trilingual titles |
| description_en, description_zh, description_zhtw | document (WYSIWYG) | Rich text with inline images |
| feature_image | image | Stored in repo |
| schedule_en, schedule_zh, schedule_zhtw | text | Trilingual schedule text, e.g., "Every Monday 7:00 PM" / "每周一 晚7:00" |
| location_en, location_zh, location_zhtw | text | Trilingual venue address |
| active | checkbox | Controls visibility |

**Galleries** (`content/galleries/*`)
| Field | Type | Notes |
|-------|------|-------|
| slug | slug | Auto-generated from title |
| title_en, title_zh, title_zhtw | text | Trilingual titles |
| gdrive_link | url | Shared Google Drive folder |
| date | date | Event/gallery date |
| cover_image | image | For gallery index page, stored in repo |
| r2_folder | text | Auto-populated after Azure processing. Hidden from Keystatic UI — set only by GitHub Action. |
| photo_manifest | text (JSON) | Auto-populated list of processed images. Hidden from Keystatic UI — set only by GitHub Action. Structure: `[{ filename, width, height, fullUrl, thumbUrl }]` |

### Singletons

**Homepage** (`content/homepage`)
| Field | Type | Notes |
|-------|------|-------|
| hero_images | array of images | Carousel images |
| hero_heading_en, _zh, _zhtw | text | Hero section heading |
| hero_cta_link | url | Call-to-action link |
| membership_promo_en, _zh, _zhtw | document | Membership promotion text |

**About** (`content/about`)
| Field | Type | Notes |
|-------|------|-------|
| purpose_en, _zh, _zhtw | document | Our Purpose section |
| history_en, _zh, _zhtw | document | Our History section |
| constitution_en_pdf | file | English constitution PDF |
| constitution_zh_pdf | file | Chinese constitution PDF |
| executives | array of objects | Repeatable group (see below) |

Each executive entry:
| Field | Type |
|-------|------|
| name | text |
| title_en, title_zh, title_zhtw | text |
| email | text |
| photo | image (optional) |

**Terms & Conditions** (`content/terms`)
| Field | Type |
|-------|------|
| body_en, body_zh, body_zhtw | document |

### Content Images

Feature images and inline images in WYSIWYG fields are stored in the GitHub repo under `public/images/` and optimized by Astro's `<Image>` component at build time. This is separate from the gallery pipeline.

---

## 4. Gallery Image Pipeline

For bulk gallery photos (100+ images at 20-40MB each from Google Drive).

### Processing Flow

1. Volunteer uploads original photos to a shared Google Drive folder
2. Volunteer creates a Gallery entry in Keystatic, pastes the GDrive folder link, saves
3. Keystatic commits the content file to GitHub
4. GitHub Action detects a new/updated gallery entry
5. GitHub Action calls Azure Function via HTTP with the GDrive link and gallery slug
6. Azure Function:
   - Authenticates with Google Drive API via service account
   - Lists all images in the shared folder
   - Streams each image through sharp: resize to max 2000px width, convert to WebP, quality 80
   - Generates a thumbnail variant (400px width)
   - Uploads both sizes to Cloudflare R2
   - Returns a JSON manifest: `[{ filename, width, height, fullUrl, thumbUrl }]`
7. GitHub Action writes the manifest back to the gallery content file and commits
8. Astro build picks up the manifest and renders the gallery with PhotoSwipe

### R2 Bucket Structure

```
galleries/
  {slug}/
    full/
      IMG_0001.webp
      IMG_0002.webp
    thumb/
      IMG_0001.webp
      IMG_0002.webp
```

### Azure Function Specification

- **Plan:** Azure Functions Premium (EP1) — required for large image processing. Covered by existing $40/mo Azure credit.
- **Memory:** 3.5 GB (EP1 default) — sufficient for streaming 40MB images through sharp
- **Timeout:** 30 minutes max execution time (Premium plan allows up to 60 min)
- **Processing:** Images are processed **sequentially** (one at a time) to keep memory usage predictable. Sharp streams each image rather than loading fully into memory.
- **Concurrency:** One gallery processing job at a time. If a second gallery commit arrives while one is processing, the GitHub Action queues it (sequential workflow runs).

### Error Handling & Resilience

**Azure Function failures:**
- The function is **idempotent** — it can be re-run safely. It checks R2 for existing processed images and skips them (keyed by original filename hash).
- If it fails mid-batch (e.g., after processing 50 of 100 images), re-triggering picks up where it left off.
- If the GDrive link is invalid or the folder is empty, the function returns an error response with a descriptive message. The GitHub Action logs the error and does NOT commit a manifest — the gallery entry remains without photos until fixed.
- If the GDrive service account lacks permissions, same behavior — error logged, no manifest committed.

**GitHub Action timeout:**
- The Gallery Pipeline workflow sets a `timeout-minutes: 45` on the Azure Function call step.
- The call is **synchronous** — the GitHub Action sends an HTTP POST and waits for the response. The Azure Function returns the manifest JSON on completion.
- If it times out, the Action fails. The gallery can be re-processed by pushing an empty commit or re-saving the gallery entry in Keystatic.

**Manifest commit safety:**
- The manifest commit is made by a GitHub App or bot account. The Gallery Pipeline workflow trigger uses `paths: content/galleries/**` combined with `if: github.actor != 'github-actions[bot]'` to distinguish volunteer commits from Action commits at the trigger level — no commit message parsing needed.
- The Content Deploy workflow is triggered after the manifest commit, building the site with the new gallery data.

### Google Drive Sharing Requirement

**Important operational note for volunteers:** The shared Google Drive folder must be shared with the Google service account email (e.g., `ccakd-gallery@ccakd-project.iam.gserviceaccount.com`). This should be documented in Keystatic's Gallery collection description and in a volunteer onboarding guide. Alternatively, folders in a Google Shared Drive that the service account is a member of will work automatically.

### Why This Architecture

- Azure Functions (Premium): handles memory-intensive image processing (sharp streaming), covered by existing $40/mo Azure credit
- Cloudflare R2: zero egress fees, same edge network as the site, generous free tier (10GB storage, 10M reads/month)
- Google Drive: volunteers already know it, no new tools to learn

---

## 5. Events Integration

Events are managed exclusively in hi.events at `events.ccakd.ca`. No event content is duplicated in Keystatic.

### Homepage Teasers

At build time, Astro fetches the latest upcoming events from the hi.events REST API and renders them as cards on the homepage. A scheduled GitHub Action rebuild every 6 hours keeps this data reasonably fresh.

**Fallback if API unavailable:** If the hi.events API is down at build time, the build does NOT fail. Instead, the events section renders with a "Visit events.ccakd.ca for upcoming events" message linking to the events subdomain. The hi.events API is public (no API key required).

### Events Page

The `/events` page embeds the hi.events widget for seamless browsing and ticket purchase without leaving the site.

### Announcements

Non-event community news (program updates, general notices) lives in the Keystatic Announcements collection. This is the only content type volunteers create in the CMS for news — events go in hi.events.

---

## 6. Navigation Structure

```
Home | Events | Programs | Gallery | About | Membership (external)
```

- **Home:** Hero carousel, pinned announcements, latest events (from hi.events), programs preview, newsletter signup, social links
- **Events:** hi.events embed widget
- **Programs:** Card grid of active programs
- **Gallery:** Grid of gallery albums, click through to PhotoSwipe lightbox
- **About:** Purpose, history, executives listing, constitution PDFs
- **Membership:** External link to members.ccakd.ca

Top bar: Login | Sign Up (links to members.ccakd.ca) | EN | 简体 | 繁體

Footer: Copyright, Terms & Conditions link, email contact, social media links (Facebook, WeChat, etc.)

---

## 7. Build & Deployment Pipeline

### GitHub Actions Workflows

**Content Deploy** — triggered on push to `main` (non-gallery changes)
1. Filter: changes in `content/` or `src/` (excluding `content/galleries/`)
2. Astro build: fetch hi.events API, generate static pages for all 3 locales
3. Deploy to Cloudflare Workers via `wrangler deploy`

**Gallery Pipeline** — triggered on push to `main` (gallery changes)
1. Filter: changes in `content/galleries/`
2. Call Azure Function with GDrive link
3. Wait for processing completion
4. Commit returned manifest to repo
5. Triggers Content Deploy workflow

**Scheduled Rebuild** — cron every 6 hours
1. Astro build (fetches fresh hi.events data)
2. Deploy to Cloudflare Workers

### Environment Secrets

| Secret | Purpose |
|--------|---------|
| CLOUDFLARE_API_TOKEN | wrangler deploy |
| CLOUDFLARE_ACCOUNT_ID | Cloudflare account |
| R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY | Azure Function uploads to R2 |
| AZURE_FUNCTION_URL | Gallery processing endpoint |
| AZURE_AI_ENDPOINT, AZURE_AI_API_KEY | Translation via Azure AI Foundry |
| HIEVENTS_API_URL | hi.events REST API base URL |
| KEYSTATIC_GITHUB_CLIENT_ID | Keystatic GitHub OAuth |
| KEYSTATIC_GITHUB_CLIENT_SECRET | Keystatic GitHub OAuth |
| KEYSTATIC_SECRET | Keystatic session secret |
| GOOGLE_SERVICE_ACCOUNT_KEY | GDrive API access — configured as an Azure Function application setting, NOT passed per-request |

### Local Development

```bash
npm install
npm run dev    # Astro dev server + Keystatic in local mode
```

Keystatic runs in `local` mode during development — reads/writes directly to the filesystem, no GitHub auth needed.

---

## 8. Frontend Stack

### Core Dependencies

- **Astro** (hybrid mode, SSG default) with `@astrojs/cloudflare` adapter
- **@keystatic/astro** + **@keystatic/core** — CMS
- **@astrojs/react** — required by Keystatic, also used for interactive islands
- **Tailwind CSS** — styling
- **PhotoSwipe** — gallery lightbox with touch/swipe support

### Visual Design

Three theme options will be designed during implementation using the frontend-design skill. Requirements:
- Inspired by the current site but modernized
- Warm, welcoming, beautiful aesthetic appropriate for a community non-profit
- Not locked to current fonts (#C42D14 red, Noto Serif SC, Roboto) — open to new palette and typography
- Must support trilingual content gracefully (CJK characters)
- Responsive, mobile-first

### Newsletter Signup

Listmonk subscription form embedded on the homepage. Uses:
- Listmonk's public subscription API endpoint at `lists.ccakd.ca`
- ALTCHA widget for bot protection (loaded via Listmonk's JavaScript SDK)
- Email input field + subscribe button
- The form POSTs to `lists.ccakd.ca/subscription/form` with the list UUID

### Social Links Section

Replaces the Facebook embed. A clean section with links to Facebook, WeChat, and other platforms CCAKD uses.

### SEO

- Auto-generated `sitemap.xml` via `@astrojs/sitemap` with `hreflang` annotations for all three locales
- `robots.txt` allowing all crawlers
- Open Graph and Twitter Card meta tags on all pages
- JSON-LD Organization schema on homepage (carried over from current site)
- Proper `<html lang="">` attribute per locale (`en`, `zh-Hans`, `zh-Hant`)

### R2 Public Access

Gallery images in R2 are served via a custom domain (e.g., `media.ccakd.ca`) configured as an R2 custom domain in Cloudflare. This provides clean URLs and automatic edge caching.

---

## 9. Scope Exclusions

The following are explicitly out of scope for this project:

- **Newcomers page** — dropped, can be added later
- **Sponsors section** — dropped, can be added later
- **Facebook embed** — replaced with social links section
- **Membership system** — already rebuilt at members.ccakd.ca (separate repo)
- **Payment processing** — handled by members portal and hi.events
- **Email system** — handled by Listmonk at lists.ccakd.ca
- **Content migration** — existing WordPress content will need a separate migration effort

---

## 10. Data Migration Notes

Not in scope for this design, but the following data exists in the current WordPress site and will need migration planning:

- Announcements/events posts (years of content)
- Program descriptions
- Gallery photos (currently on Azure Blob Storage via WordPress plugin)
- Executive profiles
- Constitution PDFs
- Feature images and media assets
- Bilingual content (currently via Polylang, EN + Simplified Chinese only)

The current WordPress theme also has hardcoded credentials and SQL injection vulnerabilities in the membership system — these are already addressed by the separate members portal rebuild.
