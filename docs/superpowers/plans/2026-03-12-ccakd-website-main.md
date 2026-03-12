# CCAKD Main Website Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the CCAKD main website as a trilingual Astro static site with Keystatic CMS, deployed to Cloudflare Workers.

**Architecture:** Astro in hybrid mode (SSG default) on Cloudflare Workers. Keystatic CMS in GitHub mode for content management. Trilingual i18n (EN/简体/繁體) with path-based routing. Translation API on a Worker route proxying to Azure AI Foundry.

**Tech Stack:** Astro, @astrojs/cloudflare, @keystatic/astro, @astrojs/react, Tailwind CSS, PhotoSwipe, @astrojs/sitemap

**Spec:** `docs/superpowers/specs/2026-03-12-ccakd-website-redesign-design.md`

**Reference codebase:** The members portal at `~/personal-projects/ccakd-members` uses the same i18n pattern — reference `src/i18n/utils.ts` and `astro.config.mjs` for exact patterns.

**Scope:** This plan covers the main website only. The Azure Function (gallery image processing) and GitHub Actions CI/CD are separate follow-up plans.

---

## File Structure

```
ccakd-new/
├── astro.config.mjs                    # Astro config: hybrid mode, CF adapter, i18n, integrations
├── keystatic.config.ts                 # Keystatic CMS schemas (collections + singletons)
├── wrangler.json                       # Cloudflare Workers deployment config
├── tailwind.config.mjs                 # Tailwind config with CJK font stack
├── tsconfig.json
├── package.json
├── public/
│   ├── robots.txt
│   └── images/                         # Content images (committed to repo)
├── content/
│   ├── announcements/                  # Keystatic announcement entries (.mdoc)
│   ├── programs/                       # Keystatic program entries (.mdoc)
│   ├── galleries/                      # Keystatic gallery entries (.yaml)
│   ├── homepage.yaml                   # Homepage singleton
│   ├── about.yaml                      # About singleton
│   └── terms.yaml                      # Terms & Conditions singleton
├── src/
│   ├── i18n/
│   │   ├── en.json                     # English UI strings
│   │   ├── zh.json                     # Simplified Chinese UI strings
│   │   ├── zh-tw.json                  # Traditional Chinese UI strings
│   │   └── utils.ts                    # getLangFromUrl(), t(), localePath(), Locale type
│   ├── lib/
│   │   ├── hievents.ts                 # hi.events API client with fallback
│   │   └── content.ts                  # Content helper: get localized fields from Keystatic entries
│   ├── components/
│   │   ├── Layout.astro                # Base HTML layout (lang attr, meta, fonts)
│   │   ├── Nav.astro                   # Navigation + language switcher + auth links
│   │   ├── Footer.astro                # Footer with links, social, copyright
│   │   ├── Hero.astro                  # Homepage hero carousel
│   │   ├── AnnouncementCard.astro      # Announcement preview card
│   │   ├── EventCard.astro             # Event teaser card (from hi.events data)
│   │   ├── ProgramCard.astro           # Program preview card
│   │   ├── GalleryAlbumCard.astro      # Gallery album thumbnail card
│   │   ├── GalleryLightbox.astro       # PhotoSwipe gallery viewer
│   │   ├── ExecutiveCard.astro         # Executive profile card
│   │   ├── NewsletterSignup.astro      # Listmonk form + ALTCHA
│   │   ├── SocialLinks.astro           # Social media links section
│   │   └── SEOHead.astro              # OG, Twitter Card, JSON-LD, hreflang meta
│   ├── pages/
│   │   ├── index.astro                 # Root redirect → /en/
│   │   ├── api/
│   │   │   └── translate.ts            # Translation API endpoint (SSR)
│   │   ├── keystatic/
│   │   │   └── [...params].astro       # Keystatic admin UI handler (SSR)
│   │   ├── en/
│   │   │   ├── index.astro             # Homepage
│   │   │   ├── events.astro            # Events (hi.events embed)
│   │   │   ├── programs.astro          # Programs listing
│   │   │   ├── about.astro             # About page
│   │   │   ├── gallery/
│   │   │   │   ├── index.astro         # Gallery album listing
│   │   │   │   └── [slug].astro        # Single gallery with PhotoSwipe
│   │   │   └── announcements/
│   │   │       ├── index.astro         # Announcements listing
│   │   │       └── [slug].astro        # Single announcement
│   │   ├── zh/
│   │   │   └── (same as en/)
│   │   └── zh-tw/
│   │       └── (same as en/)
│   └── styles/
│       └── global.css                  # Tailwind directives + global styles
```

---

## Chunk 1: Project Foundation

### Task 1: Initialize Astro Project

**Files:**
- Create: `package.json`
- Create: `astro.config.mjs`
- Create: `tsconfig.json`
- Create: `wrangler.json`
- Create: `tailwind.config.mjs`
- Create: `src/styles/global.css`
- Create: `public/robots.txt`

- [ ] **Step 1: Initialize Astro project with dependencies**

```bash
cd /Users/wanpeng.yang/personal-projects/ccakd-new
npm create astro@latest . -- --template minimal --no-git --no-install --typescript strict
```

- [ ] **Step 2: Install all dependencies**

```bash
npm install @astrojs/cloudflare @astrojs/react @astrojs/tailwind @astrojs/sitemap @keystatic/core @keystatic/astro react react-dom tailwindcss photoswipe
npm install -D @types/react @types/react-dom wrangler
```

- [ ] **Step 3: Configure astro.config.mjs**

```javascript
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import cloudflare from '@astrojs/cloudflare';
import keystatic from '@keystatic/astro';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://ccakd.ca',
  output: 'hybrid',
  adapter: cloudflare(),
  integrations: [react(), tailwind(), keystatic(), sitemap()],
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh', 'zh-tw'],
    routing: 'manual',
  },
});
```

- [ ] **Step 4: Configure wrangler.json**

```json
{
  "name": "ccakd-website",
  "compatibility_date": "2025-01-01",
  "main": "./dist/_worker.js",
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS"
  }
}
```

- [ ] **Step 5: Configure tailwind.config.mjs**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Noto Sans SC', 'Noto Sans TC', 'system-ui', 'sans-serif'],
        serif: ['Noto Serif SC', 'Noto Serif TC', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 6: Create global.css with Tailwind directives**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 7: Create robots.txt**

```
User-agent: *
Allow: /

Sitemap: https://ccakd.ca/sitemap-index.xml
```

- [ ] **Step 8: Create .gitignore**

```
node_modules/
dist/
.astro/
.wrangler/
.dev.vars
.env
```

- [ ] **Step 9: Create .dev.vars for local environment variables**

```
AZURE_AI_ENDPOINT=https://your-endpoint.openai.azure.com
AZURE_AI_API_KEY=your-key-here
HIEVENTS_API_URL=https://events.ccakd.ca/api
KEYSTATIC_GITHUB_CLIENT_ID=
KEYSTATIC_GITHUB_CLIENT_SECRET=
KEYSTATIC_SECRET=
```

- [ ] **Step 10: Create placeholder favicon**

Create `public/favicon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><text y="28" font-size="28">🏮</text></svg>
```

- [ ] **Step 11: Verify build**

```bash
npm run build
```
Expected: Build succeeds (may warn about no pages yet, that's fine)

Note: `npm create astro` may prompt about existing files — use `--yes` flag if needed, or run in a clean state.

- [ ] **Step 12: Commit**

```bash
git init
git add -A
git commit -m "chore: initialize Astro project with CF Workers, Tailwind, Keystatic"
```

---

### Task 2: Set Up i18n System

**Files:**
- Create: `src/i18n/en.json`
- Create: `src/i18n/zh.json`
- Create: `src/i18n/zh-tw.json`
- Create: `src/i18n/utils.ts`

- [x] **Step 1: Create English UI strings**

Create `src/i18n/en.json`:
```json
{
  "site": {
    "title": "Chinese Canadian Association of Kingston and District",
    "titleShort": "CCAKD"
  },
  "nav": {
    "home": "Home",
    "events": "Events",
    "programs": "Programs",
    "gallery": "Gallery",
    "about": "About",
    "membership": "Membership",
    "login": "Login",
    "signup": "Sign Up"
  },
  "home": {
    "announcements": "Announcements",
    "upcomingEvents": "Upcoming Events",
    "programs": "Programs",
    "seeAllEvents": "See All Events",
    "seeAllPrograms": "See All Programs",
    "newsletter": "Subscribe To Our Newsletter",
    "newsletterDesc": "Get monthly updates on all our events and programs directly to your inbox.",
    "subscribe": "Subscribe",
    "emailPlaceholder": "Your Email",
    "socialLinks": "Connect With Us"
  },
  "events": {
    "title": "Events",
    "fallback": "Visit events.ccakd.ca for upcoming events"
  },
  "programs": {
    "title": "Programs",
    "moreInfo": "More Info"
  },
  "gallery": {
    "title": "Gallery",
    "photos": "photos"
  },
  "about": {
    "title": "About",
    "purpose": "Our Purpose",
    "history": "Our History",
    "executives": "Our Executives",
    "constitution": "Constitution"
  },
  "announcements": {
    "title": "Announcements",
    "readMore": "Read More",
    "postedOn": "Posted"
  },
  "footer": {
    "copyright": "Chinese Canadian Association Of Kingston And District",
    "terms": "Terms and Conditions",
    "email": "Email"
  }
}
```

- [x] **Step 2: Create Simplified Chinese UI strings**

Create `src/i18n/zh.json`:
```json
{
  "site": {
    "title": "金士顿及地区华人协会",
    "titleShort": "CCAKD"
  },
  "nav": {
    "home": "首页",
    "events": "活动",
    "programs": "项目",
    "gallery": "相册",
    "about": "关于",
    "membership": "会员",
    "login": "登录",
    "signup": "注册"
  },
  "home": {
    "announcements": "公告",
    "upcomingEvents": "近期活动",
    "programs": "项目",
    "seeAllEvents": "查看所有活动",
    "seeAllPrograms": "查看所有项目",
    "newsletter": "订阅我们的通讯",
    "newsletterDesc": "每月直接将活动和项目信息发送到您的邮箱。",
    "subscribe": "订阅",
    "emailPlaceholder": "您的邮箱",
    "socialLinks": "关注我们"
  },
  "events": {
    "title": "活动",
    "fallback": "请访问 events.ccakd.ca 了解近期活动"
  },
  "programs": {
    "title": "项目",
    "moreInfo": "了解更多"
  },
  "gallery": {
    "title": "相册",
    "photos": "张照片"
  },
  "about": {
    "title": "关于",
    "purpose": "我们的宗旨",
    "history": "我们的历史",
    "executives": "理事会成员",
    "constitution": "章程"
  },
  "announcements": {
    "title": "公告",
    "readMore": "阅读更多",
    "postedOn": "发布于"
  },
  "footer": {
    "copyright": "金士顿及地区华人协会",
    "terms": "条款和条件",
    "email": "邮箱"
  }
}
```

- [x] **Step 3: Create Traditional Chinese UI strings**

Create `src/i18n/zh-tw.json`:
```json
{
  "site": {
    "title": "金士頓及地區華人協會",
    "titleShort": "CCAKD"
  },
  "nav": {
    "home": "首頁",
    "events": "活動",
    "programs": "項目",
    "gallery": "相冊",
    "about": "關於",
    "membership": "會員",
    "login": "登入",
    "signup": "註冊"
  },
  "home": {
    "announcements": "公告",
    "upcomingEvents": "近期活動",
    "programs": "項目",
    "seeAllEvents": "查看所有活動",
    "seeAllPrograms": "查看所有項目",
    "newsletter": "訂閱我們的通訊",
    "newsletterDesc": "每月直接將活動和項目資訊發送到您的信箱。",
    "subscribe": "訂閱",
    "emailPlaceholder": "您的信箱",
    "socialLinks": "關注我們"
  },
  "events": {
    "title": "活動",
    "fallback": "請訪問 events.ccakd.ca 了解近期活動"
  },
  "programs": {
    "title": "項目",
    "moreInfo": "了解更多"
  },
  "gallery": {
    "title": "相冊",
    "photos": "張照片"
  },
  "about": {
    "title": "關於",
    "purpose": "我們的宗旨",
    "history": "我們的歷史",
    "executives": "理事會成員",
    "constitution": "章程"
  },
  "announcements": {
    "title": "公告",
    "readMore": "閱讀更多",
    "postedOn": "發佈於"
  },
  "footer": {
    "copyright": "金士頓及地區華人協會",
    "terms": "條款和條件",
    "email": "信箱"
  }
}
```

- [x] **Step 4: Create i18n utility functions**

Create `src/i18n/utils.ts` — copy exact pattern from `~/personal-projects/ccakd-members/src/i18n/utils.ts`:

```typescript
import en from './en.json';
import zh from './zh.json';
import zhTw from './zh-tw.json';

const translations = { en, zh, 'zh-tw': zhTw } as const;

export type Locale = keyof typeof translations;

export function getLangFromUrl(url: URL): Locale {
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length >= 1 && `${segments[0]}` in translations) {
    return segments[0] as Locale;
  }
  return 'en';
}

export function t(locale: Locale) {
  return translations[locale];
}

export function localePath(locale: Locale, path: string) {
  return `/${locale}${path}`;
}
```

- [x] **Step 5: Commit**

```bash
git add src/i18n/
git commit -m "feat: add trilingual i18n system (EN/ZH/ZH-TW)"
```

---

### Task 3: Configure Keystatic CMS Schemas

**Files:**
- Create: `keystatic.config.ts`
- Create: `src/pages/keystatic/[...params].astro`
- Create: `content/` directory structure with sample content

- [x] **Step 1: Create keystatic.config.ts**

```typescript
import { config, collection, singleton, fields } from '@keystatic/core';

export default config({
  storage: import.meta.env.DEV
    ? { kind: 'local' }
    : {
        kind: 'github',
        repo: { owner: 'ccakd', name: 'ccakd-new' },
      },
  ui: {
    brand: { name: 'CCAKD CMS' },
  },
  collections: {
    announcements: collection({
      label: 'Announcements',
      slugField: 'slug',
      path: 'content/announcements/*',
      schema: {
        slug: fields.slug({
          name: { label: 'Slug', description: 'URL-friendly identifier (auto-generated from English title)' },
        }),
        title_en: fields.text({ label: 'Title (English)', validation: { isRequired: true } }),
        title_zh: fields.text({ label: 'Title (简体中文)' }),
        title_zhtw: fields.text({ label: 'Title (繁體中文)' }),
        body_en: fields.document({
          label: 'Content (English)',
          formatting: true,
          dividers: true,
          links: true,
          images: { directory: 'public/images/announcements', publicPath: '/images/announcements/' },
        }),
        body_zh: fields.document({
          label: 'Content (简体中文)',
          formatting: true,
          dividers: true,
          links: true,
          images: { directory: 'public/images/announcements', publicPath: '/images/announcements/' },
        }),
        body_zhtw: fields.document({
          label: 'Content (繁體中文)',
          formatting: true,
          dividers: true,
          links: true,
          images: { directory: 'public/images/announcements', publicPath: '/images/announcements/' },
        }),
        feature_image: fields.image({
          label: 'Feature Image',
          directory: 'public/images/announcements',
          publicPath: '/images/announcements/',
        }),
        date: fields.date({ label: 'Publish Date', validation: { isRequired: true } }),
        pinned: fields.checkbox({ label: 'Pin to Homepage', defaultValue: false }),
      },
    }),
    programs: collection({
      label: 'Programs',
      slugField: 'slug',
      path: 'content/programs/*',
      schema: {
        slug: fields.slug({
          name: { label: 'Slug' },
        }),
        title_en: fields.text({ label: 'Title (English)', validation: { isRequired: true } }),
        title_zh: fields.text({ label: 'Title (简体中文)' }),
        title_zhtw: fields.text({ label: 'Title (繁體中文)' }),
        description_en: fields.document({
          label: 'Description (English)',
          formatting: true,
          links: true,
          images: { directory: 'public/images/programs', publicPath: '/images/programs/' },
        }),
        description_zh: fields.document({
          label: 'Description (简体中文)',
          formatting: true,
          links: true,
          images: { directory: 'public/images/programs', publicPath: '/images/programs/' },
        }),
        description_zhtw: fields.document({
          label: 'Description (繁體中文)',
          formatting: true,
          links: true,
          images: { directory: 'public/images/programs', publicPath: '/images/programs/' },
        }),
        feature_image: fields.image({
          label: 'Feature Image',
          directory: 'public/images/programs',
          publicPath: '/images/programs/',
        }),
        schedule_en: fields.text({ label: 'Schedule (English)' }),
        schedule_zh: fields.text({ label: 'Schedule (简体中文)' }),
        schedule_zhtw: fields.text({ label: 'Schedule (繁體中文)' }),
        location_en: fields.text({ label: 'Location (English)' }),
        location_zh: fields.text({ label: 'Location (简体中文)' }),
        location_zhtw: fields.text({ label: 'Location (繁體中文)' }),
        active: fields.checkbox({ label: 'Active', defaultValue: true }),
      },
    }),
    galleries: collection({
      label: 'Galleries',
      slugField: 'slug',
      path: 'content/galleries/*',
      schema: {
        slug: fields.slug({
          name: { label: 'Slug' },
        }),
        title_en: fields.text({ label: 'Title (English)', validation: { isRequired: true } }),
        title_zh: fields.text({ label: 'Title (简体中文)' }),
        title_zhtw: fields.text({ label: 'Title (繁體中文)' }),
        gdrive_link: fields.url({
          label: 'Google Drive Folder Link',
          description: 'Paste the shared Google Drive folder URL. The folder must be shared with the CCAKD service account.',
        }),
        date: fields.date({ label: 'Event Date', validation: { isRequired: true } }),
        cover_image: fields.image({
          label: 'Cover Image',
          directory: 'public/images/galleries',
          publicPath: '/images/galleries/',
        }),
        r2_folder: fields.text({
          label: 'R2 Folder (auto-populated)',
          description: 'DO NOT EDIT — set automatically by the gallery pipeline.',
        }),
        photo_manifest: fields.text({
          label: 'Photo Manifest (auto-populated)',
          description: 'DO NOT EDIT — JSON manifest set automatically by the gallery pipeline.',
          multiline: true,
        }),
      },
    }),
  },
  singletons: {
    homepage: singleton({
      label: 'Homepage',
      path: 'content/homepage',
      schema: {
        hero_images: fields.array(
          fields.image({
            label: 'Hero Image',
            directory: 'public/images/hero',
            publicPath: '/images/hero/',
          }),
          { label: 'Hero Carousel Images' }
        ),
        hero_heading_en: fields.text({ label: 'Hero Heading (English)' }),
        hero_heading_zh: fields.text({ label: 'Hero Heading (简体中文)' }),
        hero_heading_zhtw: fields.text({ label: 'Hero Heading (繁體中文)' }),
        hero_cta_link: fields.url({ label: 'Hero CTA Link' }),
        membership_promo_en: fields.document({ label: 'Membership Promo (English)', formatting: true, links: true }),
        membership_promo_zh: fields.document({ label: 'Membership Promo (简体中文)', formatting: true, links: true }),
        membership_promo_zhtw: fields.document({ label: 'Membership Promo (繁體中文)', formatting: true, links: true }),
      },
    }),
    about: singleton({
      label: 'About',
      path: 'content/about',
      schema: {
        purpose_en: fields.document({ label: 'Our Purpose (English)', formatting: true, links: true }),
        purpose_zh: fields.document({ label: 'Our Purpose (简体中文)', formatting: true, links: true }),
        purpose_zhtw: fields.document({ label: 'Our Purpose (繁體中文)', formatting: true, links: true }),
        history_en: fields.document({ label: 'Our History (English)', formatting: true, links: true }),
        history_zh: fields.document({ label: 'Our History (简体中文)', formatting: true, links: true }),
        history_zhtw: fields.document({ label: 'Our History (繁體中文)', formatting: true, links: true }),
        constitution_en_pdf: fields.file({
          label: 'Constitution (English PDF)',
          directory: 'public/files',
          publicPath: '/files/',
        }),
        constitution_zh_pdf: fields.file({
          label: 'Constitution (Chinese PDF)',
          directory: 'public/files',
          publicPath: '/files/',
        }),
        executives: fields.array(
          fields.object({
            name: fields.text({ label: 'Name', validation: { isRequired: true } }),
            title_en: fields.text({ label: 'Title (English)' }),
            title_zh: fields.text({ label: 'Title (简体中文)' }),
            title_zhtw: fields.text({ label: 'Title (繁體中文)' }),
            email: fields.text({ label: 'Email' }),
            photo: fields.image({
              label: 'Photo',
              directory: 'public/images/executives',
              publicPath: '/images/executives/',
            }),
          }),
          {
            label: 'Executives',
            itemLabel: (props) => props.fields.name.value || 'New Executive',
          }
        ),
      },
    }),
    terms: singleton({
      label: 'Terms & Conditions',
      path: 'content/terms',
      schema: {
        body_en: fields.document({ label: 'Terms (English)', formatting: true, links: true }),
        body_zh: fields.document({ label: 'Terms (简体中文)', formatting: true, links: true }),
        body_zhtw: fields.document({ label: 'Terms (繁體中文)', formatting: true, links: true }),
      },
    }),
  },
});
```

- [x] **Step 2: Create Keystatic admin route**

Create `src/pages/keystatic/[...params].astro`:
```astro
---
export const prerender = false;

import { makeHandler } from '@keystatic/astro/api';
import keystaticConfig from '../../../keystatic.config';

export const ALL = makeHandler({
  config: keystaticConfig,
  clientId: import.meta.env.KEYSTATIC_GITHUB_CLIENT_ID,
  clientSecret: import.meta.env.KEYSTATIC_GITHUB_CLIENT_SECRET,
  secret: import.meta.env.KEYSTATIC_SECRET,
});
---
```

- [x] **Step 3: Create sample content directories**

```bash
mkdir -p content/announcements content/programs content/galleries
mkdir -p public/images/announcements public/images/programs public/images/galleries public/images/hero public/images/executives public/files
```

- [x] **Step 4: Verify Keystatic loads in dev mode**

```bash
npm run dev
```
Open `http://localhost:4321/keystatic` — verify the CMS dashboard shows Announcements, Programs, Galleries collections and Homepage, About, Terms singletons.

- [ ] **Step 5: Commit**

```bash
git add keystatic.config.ts src/pages/keystatic/ content/ public/images/ public/files/
git commit -m "feat: configure Keystatic CMS with trilingual content schemas"
```

---

### Task 4: Content Helper Utilities

**Files:**
- Create: `src/lib/content.ts`
- Create: `src/lib/hievents.ts`

- [ ] **Step 1: Create content localization helper**

Create `src/lib/content.ts`:
```typescript
import type { Locale } from '../i18n/utils';

/**
 * Get a localized field value from a Keystatic entry.
 * Looks up field_{locale} with fallback to field_en.
 * For locale 'zh-tw', looks up field_zhtw.
 */
export function localized<T>(entry: Record<string, T>, field: string, locale: Locale): T {
  const suffix = locale === 'zh-tw' ? 'zhtw' : locale;
  const key = `${field}_${suffix}`;
  const fallbackKey = `${field}_en`;
  return (entry[key] ?? entry[fallbackKey]) as T;
}
```

- [ ] **Step 2: Create hi.events API client**

Create `src/lib/hievents.ts`:
```typescript
export interface HiEvent {
  id: number;
  title: string;
  start_date: string;
  end_date: string;
  description: string;
  slug: string;
  images: { url: string }[];
}

const HIEVENTS_API = import.meta.env.HIEVENTS_API_URL || 'https://events.ccakd.ca/api';

export async function getUpcomingEvents(limit = 3): Promise<HiEvent[]> {
  try {
    const res = await fetch(`${HIEVENTS_API}/events?status=upcoming&limit=${limit}`);
    if (!res.ok) throw new Error(`hi.events API returned ${res.status}`);
    const data = await res.json();
    return data.data ?? [];
  } catch (error) {
    console.error('Failed to fetch hi.events:', error);
    return []; // Fallback: empty array, homepage shows fallback message
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/
git commit -m "feat: add content localization helper and hi.events API client"
```

---

## Chunk 2: Layout & Core Components

### Task 5: Base Layout Component

**Files:**
- Create: `src/components/Layout.astro`
- Create: `src/components/SEOHead.astro`

- [ ] **Step 1: Create SEOHead component**

Create `src/components/SEOHead.astro`:
```astro
---
import type { Locale } from '../i18n/utils';
import { localePath, t } from '../i18n/utils';

interface Props {
  locale: Locale;
  title?: string;
  description?: string;
  image?: string;
  path: string; // Current path without locale prefix, e.g., '/about'
  type?: 'website' | 'article';
}

const { locale, title, description, image, path, type = 'website' } = Astro.props;
const strings = t(locale);
const siteTitle = strings.site.title;
const pageTitle = title ? `${title} | ${siteTitle}` : siteTitle;
const pageDescription = description || siteTitle;
const canonicalUrl = new URL(localePath(locale, path), Astro.site);
const ogImage = image || '/images/og-default.jpg';

const locales: Locale[] = ['en', 'zh', 'zh-tw'];
const langMap: Record<Locale, string> = { en: 'en', zh: 'zh-Hans', 'zh-tw': 'zh-Hant' };
---

<title>{pageTitle}</title>
<meta name="description" content={pageDescription} />
<link rel="canonical" href={canonicalUrl.href} />

{/* hreflang alternate links */}
{locales.map((l) => (
  <link rel="alternate" hreflang={langMap[l]} href={new URL(localePath(l, path), Astro.site).href} />
))}
<link rel="alternate" hreflang="x-default" href={new URL(localePath('en', path), Astro.site).href} />

{/* Open Graph */}
<meta property="og:title" content={pageTitle} />
<meta property="og:description" content={pageDescription} />
<meta property="og:url" content={canonicalUrl.href} />
<meta property="og:type" content={type} />
<meta property="og:image" content={new URL(ogImage, Astro.site).href} />
<meta property="og:locale" content={langMap[locale]} />

{/* Twitter Card */}
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content={pageTitle} />
<meta name="twitter:description" content={pageDescription} />
<meta name="twitter:image" content={new URL(ogImage, Astro.site).href} />
```

- [ ] **Step 2: Create base Layout component**

Create `src/components/Layout.astro`:
```astro
---
import type { Locale } from '../i18n/utils';
import SEOHead from './SEOHead.astro';
import Nav from './Nav.astro';
import Footer from './Footer.astro';
import '../styles/global.css';

interface Props {
  locale: Locale;
  title?: string;
  description?: string;
  image?: string;
  path: string;
  type?: 'website' | 'article';
}

const { locale, title, description, image, path, type } = Astro.props;
const langMap: Record<Locale, string> = { en: 'en', zh: 'zh-Hans', 'zh-tw': 'zh-Hant' };
---

<!doctype html>
<html lang={langMap[locale]}>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <SEOHead locale={locale} title={title} description={description} image={image} path={path} type={type} />
  </head>
  <body class="min-h-screen flex flex-col">
    <Nav locale={locale} currentPath={path} />
    <main class="flex-1">
      <slot />
    </main>
    <Footer locale={locale} />
  </body>
</html>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Layout.astro src/components/SEOHead.astro
git commit -m "feat: add base Layout with SEO head and trilingual hreflang"
```

---

### Task 6: Navigation Component

**Files:**
- Create: `src/components/Nav.astro`

- [ ] **Step 1: Create Nav component**

Create `src/components/Nav.astro`:
```astro
---
import type { Locale } from '../i18n/utils';
import { t, localePath } from '../i18n/utils';

interface Props {
  locale: Locale;
  currentPath: string; // Path without locale prefix, e.g., '/about'
}

const { locale, currentPath } = Astro.props;
const strings = t(locale);

const navItems = [
  { label: strings.nav.home, path: '/' },
  { label: strings.nav.events, path: '/events' },
  { label: strings.nav.programs, path: '/programs' },
  { label: strings.nav.gallery, path: '/gallery' },
  { label: strings.nav.about, path: '/about' },
];

const localeLabels: { code: Locale; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'zh', label: '简体' },
  { code: 'zh-tw', label: '繁體' },
];
---

<header class="sticky top-0 z-50 bg-white shadow-sm">
  {/* Top bar: auth links + language switcher */}
  <div class="border-b border-gray-100">
    <div class="max-w-7xl mx-auto px-4 flex justify-end items-center gap-4 py-1 text-sm">
      <a href="https://members.ccakd.ca/en/login" class="text-gray-600 hover:text-gray-900">{strings.nav.login}</a>
      <a href="https://members.ccakd.ca/en/register" class="text-gray-600 hover:text-gray-900">{strings.nav.signup}</a>
      <div class="flex gap-1 border-l pl-4 ml-2">
        {localeLabels.map(({ code, label }) => (
          <a
            href={localePath(code, currentPath)}
            class:list={[
              'px-2 py-0.5 rounded text-xs font-medium',
              code === locale ? 'bg-amber-500 text-white' : 'text-gray-600 hover:bg-gray-100',
            ]}
          >
            {label}
          </a>
        ))}
      </div>
    </div>
  </div>

  {/* Main nav */}
  <nav class="max-w-7xl mx-auto px-4 flex items-center justify-between py-3">
    <a href={localePath(locale, '/')} class="flex items-center gap-2">
      <span class="text-lg font-bold">{strings.site.titleShort}</span>
    </a>

    {/* Desktop nav */}
    <div class="hidden md:flex items-center gap-6">
      {navItems.map(({ label, path }) => (
        <a
          href={localePath(locale, path)}
          class:list={[
            'text-sm font-medium transition-colors',
            currentPath === path ? 'text-amber-600' : 'text-gray-700 hover:text-amber-600',
          ]}
        >
          {label}
        </a>
      ))}
      <a
        href="https://members.ccakd.ca/en/"
        class="text-sm font-medium text-gray-700 hover:text-amber-600"
        target="_blank"
      >
        {strings.nav.membership}
      </a>
    </div>

    {/* Mobile hamburger - implemented via CSS checkbox trick, no JS needed */}
    <input type="checkbox" id="mobile-menu-toggle" class="hidden peer" />
    <label for="mobile-menu-toggle" class="md:hidden cursor-pointer p-2">
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </label>

    {/* Mobile menu dropdown */}
    <div class="hidden peer-checked:flex absolute top-full left-0 right-0 bg-white shadow-lg flex-col md:hidden border-t">
      {navItems.map(({ label, path }) => (
        <a href={localePath(locale, path)} class="px-6 py-3 text-sm hover:bg-gray-50 border-b border-gray-100">
          {label}
        </a>
      ))}
      <a href="https://members.ccakd.ca/en/" class="px-6 py-3 text-sm hover:bg-gray-50" target="_blank">
        {strings.nav.membership}
      </a>
    </div>
  </nav>
</header>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Nav.astro
git commit -m "feat: add Nav component with language switcher and mobile menu"
```

---

### Task 7: Footer Component

**Files:**
- Create: `src/components/Footer.astro`
- Create: `src/components/SocialLinks.astro`

- [ ] **Step 1: Create SocialLinks component**

Create `src/components/SocialLinks.astro`:
```astro
---
import type { Locale } from '../i18n/utils';
import { t } from '../i18n/utils';

interface Props {
  locale: Locale;
}

const { locale } = Astro.props;
const strings = t(locale);
---

<section class="py-12 bg-gray-50">
  <div class="max-w-7xl mx-auto px-4 text-center">
    <h2 class="text-2xl font-bold mb-6">{strings.home.socialLinks}</h2>
    <div class="flex justify-center gap-6">
      <a href="https://www.facebook.com/CCAKD/" target="_blank" rel="noopener" class="text-gray-600 hover:text-blue-600 transition-colors">
        <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"/></svg>
      </a>
      {/* WeChat: link to a QR code image or WeChat page */}
      <a href="#wechat" class="text-gray-600 hover:text-green-600 transition-colors">
        <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.045c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.49.49 0 0 1 .176-.553C23.1 18.153 24 16.487 24 14.642c0-3.32-3.06-5.783-7.062-5.783zm-2.07 2.834c.535 0 .969.44.969.983a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.983.97-.983zm4.14 0c.535 0 .969.44.969.983a.976.976 0 0 1-.97.983.976.976 0 0 1-.968-.983c0-.542.434-.983.969-.983z"/></svg>
      </a>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Create Footer component**

Create `src/components/Footer.astro`:
```astro
---
import type { Locale } from '../i18n/utils';
import { t, localePath } from '../i18n/utils';

interface Props {
  locale: Locale;
}

const { locale } = Astro.props;
const strings = t(locale);
const year = new Date().getFullYear();
---

<footer class="bg-gray-900 text-gray-300 py-8">
  <div class="max-w-7xl mx-auto px-4">
    <div class="flex flex-col md:flex-row justify-between items-center gap-4">
      <p class="text-sm">
        &copy; {year} {strings.footer.copyright}
      </p>
      <div class="flex items-center gap-4 text-sm">
        <a href={localePath(locale, '/terms')} class="hover:text-white transition-colors">
          {strings.footer.terms}
        </a>
        <span class="text-gray-600">|</span>
        <span>{strings.footer.email}: <a href="mailto:info@ccakd.ca" class="hover:text-white">info@ccakd.ca</a></span>
      </div>
    </div>
  </div>
</footer>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Footer.astro src/components/SocialLinks.astro
git commit -m "feat: add Footer and SocialLinks components"
```

---

### Task 8: Root Redirect + Skeleton Pages

**Files:**
- Create: `src/pages/index.astro`
- Create: `src/pages/en/index.astro` (and zh/, zh-tw/ copies)
- Create: `src/pages/en/about.astro` (and zh/, zh-tw/ copies)
- Create: `src/pages/en/events.astro` (and zh/, zh-tw/ copies)
- Create: `src/pages/en/programs.astro` (and zh/, zh-tw/ copies)

- [ ] **Step 1: Create root redirect**

Create `src/pages/index.astro`:
```astro
---
return Astro.redirect('/en/', 302);
---
```

- [ ] **Step 2: Create English homepage skeleton**

Create `src/pages/en/index.astro`:
```astro
---
import Layout from '../../components/Layout.astro';
import type { Locale } from '../../i18n/utils';
import { t } from '../../i18n/utils';

const locale: Locale = 'en';
const strings = t(locale);
---

<Layout locale={locale} path="/" >
  <section class="py-20 text-center">
    <h1 class="text-4xl font-bold">{strings.site.title}</h1>
    <p class="mt-4 text-gray-600">Homepage — content coming soon</p>
  </section>
</Layout>
```

- [ ] **Step 3: Create zh/ and zh-tw/ copies**

Copy `src/pages/en/index.astro` to `src/pages/zh/index.astro` and `src/pages/zh-tw/index.astro`, changing only `const locale: Locale = 'zh'` and `'zh-tw'` respectively.

Repeat for all page files: `about.astro`, `events.astro`, `programs.astro`.

Create skeleton versions of each that use `<Layout>` with the correct locale and display the page title.

- [ ] **Step 4: Create skeleton gallery and announcement routes**

```
src/pages/en/gallery/index.astro
src/pages/en/gallery/[slug].astro
src/pages/en/announcements/index.astro
src/pages/en/announcements/[slug].astro
```
(And their zh/ and zh-tw/ duplicates)

Each should be a minimal page using `<Layout>` with correct locale — content will be filled in subsequent tasks.

- [ ] **Step 5: Verify all routes work**

```bash
npm run dev
```

Test:
- `http://localhost:4321/` → redirects to `/en/`
- `http://localhost:4321/en/` → shows homepage
- `http://localhost:4321/zh/` → shows Chinese homepage
- `http://localhost:4321/zh-tw/` → shows Traditional Chinese homepage
- `http://localhost:4321/en/about` → shows about skeleton
- Language switcher links navigate between locales correctly

- [ ] **Step 6: Commit**

```bash
git add src/pages/
git commit -m "feat: add root redirect and skeleton pages for all routes and locales"
```

- [ ] **Step 7: First Cloudflare deployment**

This is the first point where the site is meaningfully navigable. Deploy and verify:

```bash
npx wrangler deploy
```

Before deploying, ensure the following environment variables are set in the Cloudflare dashboard (Workers → ccakd-website → Settings → Variables):
- `KEYSTATIC_GITHUB_CLIENT_ID`
- `KEYSTATIC_GITHUB_CLIENT_SECRET`
- `KEYSTATIC_SECRET`
- `HIEVENTS_API_URL`
- `AZURE_AI_ENDPOINT` (can be set later)
- `AZURE_AI_API_KEY` (can be set later)

Verify:
- `https://ccakd.ca/` → redirects to `/en/`
- `/en/`, `/zh/`, `/zh-tw/` → show homepage skeletons
- `/en/about`, `/en/events`, `/en/programs` → show skeleton pages
- Language switcher works across locales
- `/keystatic` → loads CMS admin UI

> **NOTE:** From this task onward, every task should end with `npx wrangler deploy` and a quick verify on the live site.

---

## Chunk 3: Frontend Design

### Task 9: Design Three Theme Options

**This task uses the `frontend-design` skill.**

- [ ] **Step 1: Invoke frontend-design skill to create 3 theme options**

Requirements to pass to the frontend-design skill:
- Community non-profit website for Chinese Canadian Association of Kingston
- Warm, welcoming, beautiful, modern
- Must support trilingual content (English + Simplified Chinese + Traditional Chinese) — CJK typography matters
- Inspired by current site (https://ccakd.ca) but not copying it
- Responsive, mobile-first
- Sections: hero carousel, announcements, events cards, programs cards, newsletter signup, social links, gallery grid
- Not locked to current palette (#C42D14) or fonts — open to new directions
- Present 3 distinct theme options for user to choose from

- [ ] **Step 2: User selects a theme**

- [ ] **Step 3: Apply selected theme to tailwind.config.mjs and global.css**

Update color palette, typography, spacing, and any custom utility classes based on the chosen theme.

- [ ] **Step 4: Update Layout.astro with font imports**

Add Google Fonts `<link>` tags for the selected fonts in the `<head>`.

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.mjs src/styles/global.css src/components/Layout.astro
git commit -m "feat: apply selected theme — colors, typography, and global styles"
```

---

## Chunk 4: Page Implementation

### Task 10: Homepage

**Files:**
- Modify: `src/pages/en/index.astro` (and zh/, zh-tw/)
- Create: `src/components/Hero.astro`
- Create: `src/components/AnnouncementCard.astro`
- Create: `src/components/EventCard.astro`
- Create: `src/components/ProgramCard.astro`
- Create: `src/components/NewsletterSignup.astro`

- [ ] **Step 1: Create Hero carousel component**

Create `src/components/Hero.astro`:
```astro
---
import type { Locale } from '../i18n/utils';
import { localized } from '../lib/content';

interface Props {
  locale: Locale;
  heading: string;
  ctaLink: string;
  images: string[];
  ctaLabel: string;
}

const { locale, heading, ctaLink, images, ctaLabel } = Astro.props;
---

<section class="relative overflow-hidden">
  <div class="flex snap-x snap-mandatory overflow-x-auto scrollbar-hide" id="hero-carousel">
    {images.map((src, i) => (
      <div class="snap-center shrink-0 w-full h-[400px] md:h-[500px] relative">
        <img src={src} alt="" class="w-full h-full object-cover" loading={i === 0 ? 'eager' : 'lazy'} />
        <div class="absolute inset-0 bg-black/40" />
      </div>
    ))}
  </div>
  <div class="absolute inset-0 flex items-center justify-center text-center pointer-events-none">
    <div class="pointer-events-auto">
      <h1 class="text-3xl md:text-5xl font-bold text-white mb-6 drop-shadow-lg">{heading}</h1>
      <a href={ctaLink} class="inline-block px-8 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium text-lg">
        {ctaLabel}
      </a>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Create AnnouncementCard component**

Create `src/components/AnnouncementCard.astro`:
```astro
---
import type { Locale } from '../i18n/utils';
import { localized } from '../lib/content';
import { localePath, t } from '../i18n/utils';

interface Props {
  locale: Locale;
  slug: string;
  entry: Record<string, any>;
}

const { locale, slug, entry } = Astro.props;
const strings = t(locale);
const title = localized(entry, 'title', locale);
const date = new Date(entry.date).toLocaleDateString(locale === 'en' ? 'en-CA' : 'zh-CN', {
  year: 'numeric', month: 'long', day: 'numeric',
});
---

<article class="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
  {entry.feature_image && (
    <img src={entry.feature_image} alt={title} class="w-full h-48 object-cover" loading="lazy" />
  )}
  <div class="p-5">
    <time class="text-sm text-gray-500">{strings.announcements.postedOn} {date}</time>
    <h3 class="text-lg font-semibold mt-1 mb-2">{title}</h3>
    <a href={localePath(locale, `/announcements/${slug}`)} class="text-amber-600 hover:text-amber-700 text-sm font-medium">
      {strings.announcements.readMore} →
    </a>
  </div>
</article>
```

- [ ] **Step 3: Create EventCard component**

Create `src/components/EventCard.astro`:
```astro
---
import type { HiEvent } from '../lib/hievents';

interface Props {
  event: HiEvent;
}

const { event } = Astro.props;
const date = new Date(event.start_date).toLocaleDateString('en-CA', {
  year: 'numeric', month: 'long', day: 'numeric',
});
const imageUrl = event.images?.[0]?.url;
---

<article class="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
  {imageUrl && (
    <img src={imageUrl} alt={event.title} class="w-full h-48 object-cover" loading="lazy" />
  )}
  <div class="p-5">
    <time class="text-sm text-gray-500">{date}</time>
    <h3 class="text-lg font-semibold mt-1 mb-2">{event.title}</h3>
    <a href={`https://events.ccakd.ca/event/${event.id}/${event.slug}`} target="_blank" class="text-amber-600 hover:text-amber-700 text-sm font-medium">
      Get Tickets →
    </a>
  </div>
</article>
```

- [ ] **Step 4: Create ProgramCard component**

Create `src/components/ProgramCard.astro`:
```astro
---
import type { Locale } from '../i18n/utils';
import { localized } from '../lib/content';
import { t } from '../i18n/utils';

interface Props {
  locale: Locale;
  entry: Record<string, any>;
}

const { locale, entry } = Astro.props;
const strings = t(locale);
const title = localized(entry, 'title', locale);
const schedule = localized(entry, 'schedule', locale);
const location = localized(entry, 'location', locale);
---

<article class="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
  {entry.feature_image && (
    <img src={entry.feature_image} alt={title} class="w-full h-48 object-cover" loading="lazy" />
  )}
  <div class="p-5">
    <h3 class="text-lg font-semibold mb-2">{title}</h3>
    {schedule && <p class="text-sm text-gray-600">{schedule}</p>}
    {location && <p class="text-sm text-gray-500">{location}</p>}
  </div>
</article>
```

- [ ] **Step 5: Create NewsletterSignup component**

Create `src/components/NewsletterSignup.astro` — Listmonk subscription form with email input, ALTCHA widget, and subscribe button. Form POSTs to `lists.ccakd.ca/subscription/form`.

```astro
---
import type { Locale } from '../i18n/utils';
import { t } from '../i18n/utils';

interface Props {
  locale: Locale;
}

const { locale } = Astro.props;
const strings = t(locale);
---

<section class="py-12 bg-white">
  <div class="max-w-xl mx-auto px-4 text-center">
    <h2 class="text-2xl font-bold mb-2">{strings.home.newsletter}</h2>
    <p class="text-gray-600 mb-6">{strings.home.newsletterDesc}</p>
    <form method="post" action="https://lists.ccakd.ca/subscription/form" class="flex flex-col sm:flex-row gap-3">
      <input type="hidden" name="nonce" />
      <input
        type="email"
        name="email"
        placeholder={strings.home.emailPlaceholder}
        required
        class="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
      />
      <input type="hidden" name="l" value="LISTMONK_LIST_UUID_HERE" />
      {/* ALTCHA widget loads here */}
      <div class="altcha" data-altcha-api-url="https://lists.ccakd.ca"></div>
      <button type="submit" class="px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium">
        {strings.home.subscribe}
      </button>
    </form>
  </div>
</section>

<script src="https://lists.ccakd.ca/public/static/script.js" defer></script>
```

- [ ] **Step 6: Assemble homepage**

Update `src/pages/en/index.astro`:
```astro
---
import { createReader } from '@keystatic/core/reader';
import keystaticConfig from '../../../keystatic.config';
import Layout from '../../components/Layout.astro';
import Hero from '../../components/Hero.astro';
import AnnouncementCard from '../../components/AnnouncementCard.astro';
import EventCard from '../../components/EventCard.astro';
import ProgramCard from '../../components/ProgramCard.astro';
import NewsletterSignup from '../../components/NewsletterSignup.astro';
import SocialLinks from '../../components/SocialLinks.astro';
import type { Locale } from '../../i18n/utils';
import { t } from '../../i18n/utils';
import { localized } from '../../lib/content';
import { getUpcomingEvents } from '../../lib/hievents';

const locale: Locale = 'en';
const strings = t(locale);

const reader = createReader(process.cwd(), keystaticConfig);

// Fetch homepage singleton
const homepage = await reader.singletons.homepage.read();

// Fetch pinned announcements
const allAnnouncements = await reader.collections.announcements.all();
const pinned = allAnnouncements
  .filter((a) => a.entry.pinned)
  .sort((a, b) => new Date(b.entry.date).getTime() - new Date(a.entry.date).getTime())
  .slice(0, 4);

// Fetch upcoming events from hi.events
const events = await getUpcomingEvents(3);

// Fetch active programs
const allPrograms = await reader.collections.programs.all();
const activePrograms = allPrograms.filter((p) => p.entry.active).slice(0, 3);
---

<Layout locale={locale} path="/">
  {/* Hero */}
  {homepage && (
    <Hero
      locale={locale}
      heading={localized(homepage, 'hero_heading', locale) || strings.site.title}
      ctaLink={homepage.hero_cta_link || 'https://members.ccakd.ca/en/register'}
      ctaLabel={strings.nav.signup}
      images={homepage.hero_images || []}
    />
  )}

  {/* Announcements */}
  <section class="max-w-7xl mx-auto px-4 py-12">
    <h2 class="text-2xl font-bold mb-6">{strings.home.announcements}</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      {pinned.map(({ slug, entry }) => (
        <AnnouncementCard locale={locale} slug={slug} entry={entry} />
      ))}
    </div>
  </section>

  {/* Events */}
  <section class="max-w-7xl mx-auto px-4 py-12 bg-gray-50">
    <h2 class="text-2xl font-bold mb-6">{strings.home.upcomingEvents}</h2>
    {events.length > 0 ? (
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        {events.map((event) => <EventCard event={event} />)}
      </div>
    ) : (
      <p class="text-gray-600">{strings.events.fallback}</p>
    )}
    <div class="mt-6 text-center">
      <a href="https://events.ccakd.ca" class="text-amber-600 hover:text-amber-700 font-medium">
        {strings.home.seeAllEvents} →
      </a>
    </div>
  </section>

  {/* Programs */}
  <section class="max-w-7xl mx-auto px-4 py-12">
    <h2 class="text-2xl font-bold mb-6">{strings.home.programs}</h2>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      {activePrograms.map(({ entry }) => (
        <ProgramCard locale={locale} entry={entry} />
      ))}
    </div>
  </section>

  {/* Newsletter */}
  <NewsletterSignup locale={locale} />

  {/* Social Links */}
  <SocialLinks locale={locale} />
</Layout>
```

- [ ] **Step 7: Copy locale variants**

Create `src/pages/zh/index.astro` and `src/pages/zh-tw/index.astro` — identical to `en/index.astro` except change `const locale: Locale = 'zh'` and `'zh-tw'` respectively. Exact files:
- `src/pages/zh/index.astro`
- `src/pages/zh-tw/index.astro`

- [ ] **Step 8: Verify homepage**

```bash
npm run dev
```
Verify all sections render with sample/empty content. Test all 3 locales.

- [ ] **Step 9: Commit**

```bash
git add src/components/Hero.astro src/components/AnnouncementCard.astro src/components/EventCard.astro src/components/ProgramCard.astro src/components/NewsletterSignup.astro src/pages/
git commit -m "feat: implement homepage with all sections"
```

---

### Task 11: Programs Page

**Files:**
- Modify: `src/pages/en/programs.astro` (and zh/, zh-tw/)

- [ ] **Step 1: Implement programs listing page**

Create `src/pages/en/programs.astro` — follows the same `createReader()` pattern as the announcements index (Task 12 Step 1). Differences:
- Uses `reader.collections.programs.all()`
- Filters by `entry.active === true`
- Renders a grid of `ProgramCard` components
- Programs are listing-only (no detail pages — the current site doesn't have them either)

```astro
---
import { createReader } from '@keystatic/core/reader';
import keystaticConfig from '../../../keystatic.config';
import Layout from '../../components/Layout.astro';
import ProgramCard from '../../components/ProgramCard.astro';
import type { Locale } from '../../i18n/utils';
import { t } from '../../i18n/utils';

const locale: Locale = 'en';
const strings = t(locale);

const reader = createReader(process.cwd(), keystaticConfig);
const allPrograms = await reader.collections.programs.all();
const active = allPrograms.filter((p) => p.entry.active);
---

<Layout locale={locale} path="/programs" title={strings.programs.title}>
  <section class="max-w-7xl mx-auto px-4 py-12">
    <h1 class="text-3xl font-bold mb-8">{strings.programs.title}</h1>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {active.map(({ entry }) => (
        <ProgramCard locale={locale} entry={entry} />
      ))}
    </div>
  </section>
</Layout>
```

- [ ] **Step 2: Copy locale variants**

Create `src/pages/zh/programs.astro` and `src/pages/zh-tw/programs.astro` — change locale only.

- [ ] **Step 3: Commit**

```bash
git add src/pages/en/programs.astro src/pages/zh/programs.astro src/pages/zh-tw/programs.astro
git commit -m "feat: implement programs listing page"
```

---

### Task 12: Announcements Pages

**Files:**
- Modify: `src/pages/en/announcements/index.astro` (and zh/, zh-tw/)
- Modify: `src/pages/en/announcements/[slug].astro` (and zh/, zh-tw/)

- [ ] **Step 1: Implement announcements index page**

Create `src/pages/en/announcements/index.astro`:
```astro
---
import { createReader } from '@keystatic/core/reader';
import keystaticConfig from '../../../../keystatic.config';
import Layout from '../../../components/Layout.astro';
import AnnouncementCard from '../../../components/AnnouncementCard.astro';
import type { Locale } from '../../../i18n/utils';
import { t } from '../../../i18n/utils';

const locale: Locale = 'en';
const strings = t(locale);

const reader = createReader(process.cwd(), keystaticConfig);
const allAnnouncements = await reader.collections.announcements.all();
const sorted = allAnnouncements.sort(
  (a, b) => new Date(b.entry.date).getTime() - new Date(a.entry.date).getTime()
);
---

<Layout locale={locale} path="/announcements" title={strings.announcements.title}>
  <section class="max-w-7xl mx-auto px-4 py-12">
    <h1 class="text-3xl font-bold mb-8">{strings.announcements.title}</h1>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {sorted.map(({ slug, entry }) => (
        <AnnouncementCard locale={locale} slug={slug} entry={entry} />
      ))}
    </div>
  </section>
</Layout>
```

- [ ] **Step 2: Implement single announcement page**

Create `src/pages/en/announcements/[slug].astro`:
```astro
---
import { createReader } from '@keystatic/core/reader';
import keystaticConfig from '../../../../keystatic.config';
import { DocumentRenderer } from '@keystatic/core/renderer';
import Layout from '../../../components/Layout.astro';
import type { Locale } from '../../../i18n/utils';
import { t } from '../../../i18n/utils';
import { localized } from '../../../lib/content';

export async function getStaticPaths() {
  const reader = createReader(process.cwd(), keystaticConfig);
  const slugs = await reader.collections.announcements.list();
  return slugs.map((slug) => ({ params: { slug } }));
}

const locale: Locale = 'en';
const strings = t(locale);
const { slug } = Astro.params;

const reader = createReader(process.cwd(), keystaticConfig);
const entry = await reader.collections.announcements.read(slug!);
if (!entry) return Astro.redirect('/en/announcements');

const title = localized(entry, 'title', locale);
const bodyKey = locale === 'zh-tw' ? 'body_zhtw' : `body_${locale}`;
const body = await (entry as any)[bodyKey]?.();
const date = new Date(entry.date).toLocaleDateString('en-CA', {
  year: 'numeric', month: 'long', day: 'numeric',
});
---

<Layout locale={locale} path={`/announcements/${slug}`} title={title} type="article">
  <article class="max-w-3xl mx-auto px-4 py-12">
    {entry.feature_image && (
      <img src={entry.feature_image} alt={title} class="w-full rounded-xl mb-8" />
    )}
    <time class="text-sm text-gray-500">{strings.announcements.postedOn} {date}</time>
    <h1 class="text-3xl font-bold mt-2 mb-8">{title}</h1>
    <div class="prose prose-lg max-w-none">
      {body && <DocumentRenderer document={body} />}
    </div>
  </article>
</Layout>
```

Note: The `DocumentRenderer` usage depends on how Keystatic returns document fields. Check `@keystatic/core/renderer` docs — the exact API may involve `await entry.body_en()` to get the document AST, then rendering it. All other page implementations (programs, about, terms) follow this same pattern.

- [ ] **Step 3: Copy locale variants**

Create these files, each identical except for `const locale: Locale`:
- `src/pages/zh/announcements/index.astro` (locale = 'zh')
- `src/pages/zh/announcements/[slug].astro` (locale = 'zh')
- `src/pages/zh-tw/announcements/index.astro` (locale = 'zh-tw')
- `src/pages/zh-tw/announcements/[slug].astro` (locale = 'zh-tw')

- [ ] **Step 4: Commit**

```bash
git add src/pages/*/announcements/
git commit -m "feat: implement announcements index and detail pages"
```

---

### Task 13: Gallery Pages

**Files:**
- Modify: `src/pages/en/gallery/index.astro` (and zh/, zh-tw/)
- Modify: `src/pages/en/gallery/[slug].astro` (and zh/, zh-tw/)
- Create: `src/components/GalleryAlbumCard.astro`
- Create: `src/components/GalleryLightbox.astro`

- [ ] **Step 1: Create GalleryAlbumCard component**

Create `src/components/GalleryAlbumCard.astro`:
```astro
---
import type { Locale } from '../i18n/utils';
import { localized } from '../lib/content';
import { localePath, t } from '../i18n/utils';

interface Props {
  locale: Locale;
  slug: string;
  entry: Record<string, any>;
}

const { locale, slug, entry } = Astro.props;
const strings = t(locale);
const title = localized(entry, 'title', locale);
const manifest = entry.photo_manifest ? JSON.parse(entry.photo_manifest) : [];
const date = new Date(entry.date).toLocaleDateString(locale === 'en' ? 'en-CA' : 'zh-CN');
---

<a href={localePath(locale, `/gallery/${slug}`)} class="group block bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
  {entry.cover_image && (
    <img src={entry.cover_image} alt={title} class="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
  )}
  <div class="p-5">
    <h3 class="text-lg font-semibold">{title}</h3>
    <p class="text-sm text-gray-500 mt-1">{date} · {manifest.length} {strings.gallery.photos}</p>
  </div>
</a>
```

- [ ] **Step 2: Implement gallery index page**

Create `src/pages/en/gallery/index.astro` — same `createReader()` pattern as announcements. Fetches all galleries sorted by date, renders `GalleryAlbumCard` grid.

- [ ] **Step 3: Create GalleryLightbox component**

A component that:
- Renders a responsive thumbnail grid from the `photo_manifest` JSON
- Loads thumbnails from R2 `thumb/` URLs
- Initializes PhotoSwipe on click for full-size lightbox viewing from R2 `full/` URLs

```astro
---
import type { Locale } from '../i18n/utils';

interface Photo {
  filename: string;
  width: number;
  height: number;
  fullUrl: string;
  thumbUrl: string;
}

interface Props {
  photos: Photo[];
  locale: Locale;
}

const { photos } = Astro.props;
---

<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2" id="gallery">
  {photos.map((photo) => (
    <a
      href={photo.fullUrl}
      data-pswp-width={photo.width}
      data-pswp-height={photo.height}
      target="_blank"
    >
      <img
        src={photo.thumbUrl}
        alt={photo.filename}
        loading="lazy"
        class="w-full aspect-square object-cover rounded-lg hover:opacity-90 transition-opacity"
      />
    </a>
  ))}
</div>

<script>
  import 'photoswipe/dist/photoswipe.css';
  import PhotoSwipeLightbox from 'photoswipe/lightbox';
  const lightbox = new PhotoSwipeLightbox({
    gallery: '#gallery',
    children: 'a',
    pswpModule: () => import('photoswipe'),
  });
  lightbox.init();
</script>
```

- [ ] **Step 4: Implement gallery detail page**

Use `getStaticPaths()` for each gallery slug. Parse the `photo_manifest` JSON field. If manifest is empty/null (gallery not yet processed), show a "Photos coming soon" message. Otherwise render `GalleryLightbox`.

- [ ] **Step 5: Copy locale variants and verify**

- [ ] **Step 6: Commit**

```bash
git add src/components/GalleryAlbumCard.astro src/components/GalleryLightbox.astro src/pages/*/gallery/
git commit -m "feat: implement gallery index and detail pages with PhotoSwipe lightbox"
```

---

### Task 14: About Page

**Files:**
- Modify: `src/pages/en/about.astro` (and zh/, zh-tw/)
- Create: `src/components/ExecutiveCard.astro`

- [ ] **Step 1: Create ExecutiveCard component**

Create `src/components/ExecutiveCard.astro`:
```astro
---
import type { Locale } from '../i18n/utils';
import { localized } from '../lib/content';

interface Props {
  locale: Locale;
  executive: Record<string, any>;
}

const { locale, executive } = Astro.props;
const title = localized(executive, 'title', locale);
---

<div class="flex items-center gap-4 p-4 bg-white rounded-lg shadow-sm">
  {executive.photo ? (
    <img src={executive.photo} alt={executive.name} class="w-16 h-16 rounded-full object-cover" />
  ) : (
    <div class="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-xl font-bold">
      {executive.name?.charAt(0)}
    </div>
  )}
  <div>
    <p class="font-semibold">{executive.name}</p>
    {title && <p class="text-sm text-gray-600">{title}</p>}
    {executive.email && (
      <a href={`mailto:${executive.email}`} class="text-sm text-amber-600 hover:text-amber-700">{executive.email}</a>
    )}
  </div>
</div>
```

- [ ] **Step 2: Implement about page**

Create `src/pages/en/about.astro` — fetches `reader.singletons.about.read()`, renders purpose/history as `DocumentRenderer`, executives as `ExecutiveCard` grid, and constitution PDF download links. Same pattern as homepage for `createReader()` and `DocumentRenderer`.

- [ ] **Step 3: Copy locale variants and verify**

- [ ] **Step 4: Commit**

```bash
git add src/components/ExecutiveCard.astro src/pages/*/about.astro
git commit -m "feat: implement about page with executives listing"
```

---

### Task 15: Events Page

**Files:**
- Modify: `src/pages/en/events.astro` (and zh/, zh-tw/)

- [ ] **Step 1: Implement events page with hi.events embed**

The events page embeds the hi.events widget:

```astro
---
import Layout from '../../components/Layout.astro';
import type { Locale } from '../../i18n/utils';
import { t } from '../../i18n/utils';

const locale: Locale = 'en';
const strings = t(locale);
---

<Layout locale={locale} path="/events" title={strings.events.title}>
  <section class="max-w-7xl mx-auto px-4 py-12">
    <h1 class="text-3xl font-bold mb-8">{strings.events.title}</h1>
    <div id="hievents-widget">
      {/* hi.events embed widget loads here */}
      <iframe
        src="https://events.ccakd.ca/e/ccakd"
        width="100%"
        style="min-height: 600px; border: none;"
        title="CCAKD Events"
      ></iframe>
    </div>
  </section>
</Layout>
```

Note: The exact embed method depends on hi.events' widget API — this may be an iframe or a JS widget. Adjust based on what hi.events provides.

- [ ] **Step 2: Copy locale variants and verify**

- [ ] **Step 3: Commit**

```bash
git add src/pages/*/events.astro
git commit -m "feat: implement events page with hi.events embed"
```

---

### Task 16: Terms & Conditions Page

**Files:**
- Create: `src/pages/en/terms.astro` (and zh/, zh-tw/)

- [ ] **Step 1: Implement terms page**

Fetch the `terms` singleton. Render the localized body content.

- [ ] **Step 2: Copy locale variants and verify**

- [ ] **Step 3: Commit**

```bash
git add src/pages/*/terms.astro
git commit -m "feat: implement terms and conditions page"
```

---

## Chunk 5: Translation API & JSON-LD

### Task 17: Translation API Endpoint

**Files:**
- Create: `src/pages/api/translate.ts`

- [ ] **Step 1: Implement translation endpoint**

Create `src/pages/api/translate.ts`:

```typescript
export const prerender = false;

import type { APIRoute } from 'astro';

interface TranslateRequest {
  text: string;
  sourceLocale: 'en' | 'zh' | 'zh-tw';
  format: 'plain' | 'rich';
}

interface TranslateResponse {
  translations: {
    en?: string;
    zh?: string;
    'zh-tw'?: string;
  };
}

// Simple in-memory rate limiter (resets on worker restart, which is fine for this use case)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20; // max requests per hour
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour in ms

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export const POST: APIRoute = async ({ request }) => {
  // Authentication: check for Keystatic session cookie.
  // Keystatic sets a session cookie after GitHub OAuth login.
  // Only authenticated CMS users should access this endpoint.
  const cookie = request.headers.get('Cookie') || '';
  const hasKeystatic = cookie.includes('keystatic-gh-access-token');
  if (!hasKeystatic) {
    return new Response(JSON.stringify({ error: 'Unauthorized — Keystatic login required' }), { status: 401 });
  }

  // Rate limiting by IP
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded — max 20 translations per hour' }), { status: 429 });
  }

  let body: TranslateRequest;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }
  const { text, sourceLocale, format } = body;

  if (!text || !sourceLocale) {
    return new Response(JSON.stringify({ error: 'Missing text or sourceLocale' }), { status: 400 });
  }

  if (!['en', 'zh', 'zh-tw'].includes(sourceLocale)) {
    return new Response(JSON.stringify({ error: 'Invalid sourceLocale' }), { status: 400 });
  }

  const targetLocales = (['en', 'zh', 'zh-tw'] as const).filter((l) => l !== sourceLocale);

  const localeNames: Record<string, string> = {
    en: 'English',
    zh: 'Simplified Chinese',
    'zh-tw': 'Traditional Chinese',
  };

  const prompt = `Translate the following ${format === 'rich' ? 'rich text content' : 'text'} from ${localeNames[sourceLocale]} to ${targetLocales.map((l) => localeNames[l]).join(' and ')}.

This is content for a Chinese Canadian community association website. Keep the tone warm, welcoming, and appropriate for a community non-profit.

${format === 'rich' ? 'Preserve all formatting (bold, italic, headings, links, lists).' : ''}

Return ONLY a JSON object with keys "${targetLocales.join('", "')}" containing the translations. No other text.

Text to translate:
${text}`;

  try {
    const endpoint = import.meta.env.AZURE_AI_ENDPOINT;
    const apiKey = import.meta.env.AZURE_AI_API_KEY;

    const res = await fetch(`${endpoint}/chat/completions?api-version=2024-02-01`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!res.ok) throw new Error(`Azure AI returned ${res.status}`);
    const data = await res.json();
    const content = data.choices[0].message.content;
    const translations = JSON.parse(content);

    return new Response(JSON.stringify({ translations } satisfies TranslateResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Translation error:', error);
    return new Response(JSON.stringify({ error: 'Translation failed' }), { status: 500 });
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/api/translate.ts
git commit -m "feat: add translation API endpoint proxying to Azure AI Foundry"
```

---

### Task 18: JSON-LD Schema on Homepage

**Files:**
- Modify: `src/components/SEOHead.astro`

- [ ] **Step 1: Add JSON-LD Organization schema**

Add JSON-LD to SEOHead.astro, conditionally rendered when `path === '/'`:

```astro
{path === '/' && (
  <script type="application/ld+json" set:html={JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'NGO',
    name: 'Chinese Canadian Association of Kingston and District',
    alternateName: 'CCAKD',
    url: 'https://ccakd.ca',
    email: 'info@ccakd.ca',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Kingston',
      addressRegion: 'ON',
      addressCountry: 'CA',
    },
    sameAs: ['https://www.facebook.com/CCAKD/'],
  })} />
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SEOHead.astro
git commit -m "feat: add JSON-LD Organization schema to homepage"
```

---

## Chunk 6: Final Verification & Sample Content

### Task 19: Add Sample Content

**Files:**
- Create: sample content in `content/` directories

- [ ] **Step 1: Create a sample announcement**

Use Keystatic local mode (`npm run dev` → `/keystatic`) to create one sample announcement with trilingual content, a feature image, and pinned=true.

- [ ] **Step 2: Create a sample program**

Use Keystatic to create one sample program (e.g., "Tai-Chi Practice") with schedule, location, and feature image.

- [ ] **Step 3: Create homepage singleton content**

Use Keystatic to populate the homepage singleton with hero heading, CTA link, and membership promo text.

- [ ] **Step 4: Create about singleton content**

Use Keystatic to populate the about singleton with purpose, history, and at least 2 sample executives.

- [ ] **Step 5: Create a sample gallery entry**

Use Keystatic to create a gallery entry with title and date. Leave `photo_manifest` empty (will be populated by Azure Function pipeline later).

- [ ] **Step 6: Commit sample content**

```bash
git add content/
git commit -m "feat: add sample content for all collections and singletons"
```

---

### Task 20: Full Build Verification

- [ ] **Step 1: Run full build**

```bash
npm run build
```
Expected: Build succeeds, generates static pages for all 3 locales.

- [ ] **Step 2: Preview built site**

```bash
npx wrangler dev
```

Test all routes:
- `/` → redirects to `/en/`
- `/en/` → homepage with all sections
- `/zh/` → Chinese homepage
- `/zh-tw/` → Traditional Chinese homepage
- `/en/programs` → programs listing
- `/en/announcements` → announcements listing
- `/en/announcements/{slug}` → single announcement
- `/en/gallery` → gallery listing
- `/en/about` → about page with executives
- `/en/events` → hi.events embed
- `/en/terms` → terms page
- `/keystatic` → CMS dashboard
- Language switcher works on all pages
- Mobile responsive layout works

- [ ] **Step 3: Commit any fixes**

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: full build verification — all pages rendering correctly"
```

---

## Follow-Up Plans (separate documents)

The following are out of scope for this plan and will be implemented separately:

1. **Azure Function — Gallery Image Processing** (`2026-03-12-ccakd-azure-gallery-function.md`)
   - Azure Function project setup (Node.js + sharp)
   - Google Drive API integration
   - Image streaming and compression
   - R2 upload logic
   - Idempotency and error handling

2. **GitHub Actions CI/CD** (`2026-03-12-ccakd-github-actions.md`)
   - Content Deploy workflow
   - Gallery Pipeline workflow
   - Scheduled Rebuild workflow (cron)
   - Environment secrets configuration

3. **Content Migration** (future)
   - WordPress export → Keystatic content format
   - Media asset migration
   - URL redirect mapping
