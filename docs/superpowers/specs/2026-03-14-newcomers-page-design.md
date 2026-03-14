# Newcomers Page — Design Spec

## Overview

A newcomers resource page for ccakd.ca that provides a welcoming introduction and curated links to settlement services, government resources, education, and business support in Kingston. Content is CMS-editable via a Keystatic singleton.

## Content Model

### Keystatic Singleton: `newcomers`

Path: `content/newcomers/`

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `welcome_en` | document | Welcome message (English) |
| `welcome_zh` | document | Welcome message (简体中文) |
| `welcome_zhtw` | document | Welcome message (繁體中文) |
| `resources` | array of objects | Repeating list of resource links |

**Each resource object:**

| Field | Type | Description |
|-------|------|-------------|
| `category` | select | One of: `immigrant_services`, `government`, `education`, `business` |
| `icon` | select | Lucide icon name from curated set (see Icon Set below) |
| `title_en` | text | Link title (English) |
| `title_zh` | text | Link title (简体中文) |
| `title_zhtw` | text | Link title (繁體中文) |
| `description_en` | text | Short description (English) |
| `description_zh` | text | Short description (简体中文) |
| `description_zhtw` | text | Short description (繁體中文) |
| `url` | url | External link URL (required) |

**Validation:** `title_en` and `url` are required fields. The array uses `itemLabel` showing the English title for CMS usability.

### Category Labels (trilingual)

| Key | EN | ZH | ZH-TW |
|-----|----|----|-------|
| `immigrant_services` | Immigrant Services | 移民服务 | 移民服務 |
| `government` | Government Services | 政府服务 | 政府服務 |
| `education` | Education | 教育 | 教育 |
| `business` | Business Support | 商业支持 | 商業支持 |

### Icon Set (Lucide)

Curated set of ~18 icons for the select field:

`home`, `hospital`, `heart`, `school`, `graduation-cap`, `briefcase`, `building-2`, `landmark`, `file-text`, `id-card`, `shield-check`, `users`, `globe`, `phone`, `map-pin`, `book-open`, `handshake`, `rocket`

### Icon Dependency

Install `lucide-astro` package. The `src/lib/lucide-icons.ts` utility imports the 18 curated icons from `lucide-astro` and exports a lookup map `{ [iconName: string]: AstroComponent }`. The `NewcomerResourceCard` component uses this map to render the selected icon.

### i18n Strings

Add to each locale's JSON file:

```json
{
  "newcomers": {
    "title": "Newcomers",           // EN: "Newcomers" / ZH: "新移民资源" / ZH-TW: "新移民資源"
    "subtitle": "Resources for New Arrivals",  // EN / ZH: "新移民实用资源" / ZH-TW: "新移民實用資源"
    "categories": {
      "immigrant_services": "Immigrant Services",  // ZH: "移民服务" / ZH-TW: "移民服務"
      "government": "Government Services",          // ZH: "政府服务" / ZH-TW: "政府服務"
      "education": "Education",                     // ZH: "教育"
      "business": "Business Support"                // ZH: "商业支持" / ZH-TW: "商業支持"
    },
    "externalLink": "Opens in new tab",  // ZH: "在新标签页中打开" / ZH-TW: "在新分頁中開啟"
    "noResources": "No resources available yet." // ZH: "暂无资源。" / ZH-TW: "暫無資源。"
  }
}
```

## Page Layout

### Structure

```
┌─────────────────────────────────────┐
│  PageHeader (title + subtitle)      │
├─────────────────────────────────────┤
│  Welcome Message (DocumentRenderer) │
│  Prose-styled rich text block       │
├─────────────────────────────────────┤
│  Category: Immigrant Services       │
│  ┌──────┐ ┌──────┐ ┌──────┐       │
│  │ icon │ │ icon │ │ icon │       │
│  │title │ │title │ │title │       │
│  │desc  │ │desc  │ │desc  │       │
│  └──────┘ └──────┘ └──────┘       │
├─────────────────────────────────────┤
│  Category: Government Services      │
│  ┌──────┐ ┌──────┐                 │
│  │ icon │ │ icon │                 │
│  │title │ │title │                 │
│  │desc  │ │desc  │                 │
│  └──────┘ └──────┘                 │
├─────────────────────────────────────┤
│  Category: Education                │
│  ┌──────┐ ┌──────┐ ┌──────┐       │
│  │      │ │      │ │      │       │
│  └──────┘ └──────┘ └──────┘       │
├─────────────────────────────────────┤
│  Category: Business Support         │
│  ┌──────┐ ┌──────┐                 │
│  │      │ │      │                 │
│  └──────┘ └──────┘                 │
└─────────────────────────────────────┘
```

### Grid Responsive Behavior

- Mobile (< 640px): 1 column
- Tablet (640-1024px): 2 columns
- Desktop (> 1024px): 3 columns

### Card Design

Each resource card is a clickable link (`<a>` tag) to the external URL with `target="_blank"`:

- Lucide SVG icon in a soft red circular background (`bg-red-50`, icon in `text-red-600`)
- Title in semibold, link-colored text
- Short description in muted gray below
- Subtle border, rounded corners, hover elevation/shadow transition
- External link indicator (small arrow icon) with `sr-only` text "Opens in new tab" for accessibility

### Category Headings

- Bold heading text with a red left border accent (consistent with site's red theme)
- Displayed in the current locale's language
- Categories rendered in the fixed order: immigrant_services → government → education → business

## Pre-Populated Content

### Welcome Message

**English:**
> Welcome to Kingston! Whether you've just arrived or are planning your move, we're here to help. Below you'll find essential resources for settling into life in Kingston — from immigration services and government paperwork to schools and business support. If you have questions, don't hesitate to reach out to us at info@ccakd.ca.

**简体中文:**
> 欢迎来到金斯顿！无论您是刚刚抵达还是正在计划搬迁，我们都在这里为您提供帮助。以下是一些帮助您在金斯顿安家的重要资源——包括移民服务、政府手续办理、学校信息和商业支持。如果您有任何问题，请随时通过 info@ccakd.ca 与我们联系。

**繁體中文:**
> 歡迎來到金斯頓！無論您是剛剛抵達還是正在計劃搬遷，我們都在這裡為您提供幫助。以下是一些幫助您在金斯頓安家的重要資源——包括移民服務、政府手續辦理、學校資訊和商業支持。如果您有任何問題，請隨時透過 info@ccakd.ca 與我們聯繫。

### Resource Links

| # | Category | Icon | Title (EN) | Title (ZH) | Title (ZH-TW) | Description (EN) | Description (ZH) | Description (ZH-TW) | URL |
|---|----------|------|-----------|------------|---------------|------------------|------------------|---------------------|-----|
| 1 | immigrant_services | landmark | City of Kingston Immigration & Settlement | 金斯顿市移民与安置信息 | 金斯頓市移民與安置資訊 | Official city resources for newcomers including settlement support and community connections | 金斯顿市官方新移民资源，包括安置支持和社区联系 | 金斯頓市官方新移民資源，包括安置支持和社區聯繫 | https://www.cityofkingston.ca/residents/immigration-settlement |
| 2 | immigrant_services | hospital | KCHC Immigrant Services | 金斯顿社区健康中心移民服务 | 金斯頓社區健康中心移民服務 | Health and community programs for immigrants and refugees | 为移民和难民提供的健康和社区项目 | 為移民和難民提供的健康和社區計畫 | https://www.kchc.ca/immigrant-services/ |
| 3 | immigrant_services | users | KCHC on Facebook | 金斯顿社区健康中心 Facebook | 金斯頓社區健康中心 Facebook | Community updates and events from KCHC immigrant services | 金斯顿社区健康中心移民服务的社区动态和活动 | 金斯頓社區健康中心移民服務的社區動態和活動 | https://www.facebook.com/KCHCImmigrantServices/ |
| 4 | immigrant_services | handshake | Kingston Immigration Partnership | 金斯顿移民伙伴关系 | 金斯頓移民夥伴關係 | Collaborative initiative to make Kingston welcoming for newcomers | 致力于让金斯顿成为新移民友好城市的合作倡议 | 致力於讓金斯頓成為新移民友善城市的合作倡議 | https://www.kingstonimmigration.ca/ |
| 5 | government | id-card | Apply for Social Insurance Number (SIN) | 申请社会保险号码 (SIN) | 申請社會保險號碼 (SIN) | Required for working in Canada — apply at Service Canada | 在加拿大工作的必备证件——在Service Canada申请 | 在加拿大工作的必備證件——在Service Canada申請 | https://www.canada.ca/en/employment-social-development/services/sin/apply.html |
| 6 | government | shield-check | Apply for Ontario Health Card (OHIP) | 申请安大略省健康卡 (OHIP) | 申請安大略省健康卡 (OHIP) | Ontario's public health insurance — covers doctor visits and hospital care | 安大略省公共医疗保险——涵盖看诊和住院费用 | 安大略省公共醫療保險——涵蓋看診和住院費用 | https://www.ontario.ca/page/apply-ohip-and-get-health-card |
| 7 | education | school | Limestone District School Board | 石灰岩学区教育局 | 石灰岩學區教育局 | Public English-language schools in the Kingston area | 金斯顿地区公立英语学校 | 金斯頓地區公立英語學校 | https://www.limestone.on.ca/ |
| 8 | education | school | Algonquin & Lakeshore Catholic District School Board | 阿尔冈昆与湖滨天主教学区教育局 | 阿爾岡昆與湖濱天主教學區教育局 | Catholic schools serving the Kingston and surrounding region | 服务金斯顿及周边地区的天主教学校 | 服務金斯頓及周邊地區的天主教學校 | https://www.alcdsb.on.ca/ |
| 9 | education | graduation-cap | Fraser Institute School Rankings | 菲沙研究所学校排名 | 菲沙研究所學校排名 | Compare school performance ratings across Ontario | 比较安大略省各学校的表现评级 | 比較安大略省各學校的表現評級 | https://www.compareschoolrankings.org/ |
| 10 | business | briefcase | Start a Business (KEDCO) | 创业支持 (KEDCO) | 創業支持 (KEDCO) | Kingston Economic Development — resources for starting your own business | 金斯顿经济发展中心——创业资源和支持 | 金斯頓經濟發展中心——創業資源和支持 | https://www.kingstonecdev.com/ |
| 11 | business | building-2 | Greater Kingston Chamber of Commerce | 大金斯顿商会 | 大金斯頓商會 | Networking, advocacy, and support for local businesses | 本地企业的网络、倡导和支持 | 本地企業的網絡、倡導和支持 | https://www.kingstonchamber.ca/ |

## New Files

| File | Purpose |
|------|---------|
| `src/pages/en/newcomers.astro` | English newcomers page |
| `src/pages/zh/newcomers.astro` | Simplified Chinese newcomers page |
| `src/pages/zh-tw/newcomers.astro` | Traditional Chinese newcomers page |
| `src/components/NewcomerResourceCard.astro` | Resource card component |
| `src/lib/lucide-icons.ts` | Icon name → SVG mapping utility |

## Modified Files

| File | Change |
|------|--------|
| `keystatic.config.ts` | Add `newcomers` singleton |
| `src/i18n/en.json` | Add `newcomers` strings (title, subtitle, categories, etc.) |
| `src/i18n/zh.json` | Add `newcomers` strings (Chinese) |
| `src/i18n/zh-tw.json` | Add `newcomers` strings (Traditional Chinese) |
| `src/components/Nav.astro` | Add "Newcomers" nav link |
| `content/newcomers/` | Pre-populated content directory (created by Keystatic) |
| `package.json` | Add `lucide-astro` dependency |

## Implementation Notes

- **Nav link:** The Nav component does NOT currently have a Newcomers link — it must be added between "Gallery" and "About" in all locale sections.
- **Reference page:** Use `src/pages/en/events.astro` as the template for the page structure (it uses `PageHeader` and follows the standard singleton pattern).
- **Document fields are async:** Welcome message fields use `fields.document()` which requires the async resolution pattern: `const body = data ? await (data as any).welcome_en?.() : null;`
- **Category display order** is fixed (not alphabetical): immigrant_services → government → education → business. This mirrors the logical flow a newcomer would follow.
- **External links** open in a new tab with `target="_blank"` and `rel="noopener noreferrer"`.
- **Fallback:** The `localized()` helper from `src/lib/content.ts` handles field name resolution and English fallback.
- **Empty state:** If no resources exist for a category, skip the category heading entirely. If the entire resources array is empty, show a "no resources" message.
- **Translation workflow:** Future CMS edits only require English fields — the `translate.yml` workflow auto-fills ZH/ZH-TW.
