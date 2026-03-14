# Improvements Plan — Homepage, Translation, Gallery Cover

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix homepage announcement display, replace the fragile client-side translation hack with a robust GitHub Action, and auto-select gallery cover images.

**Tech Stack:** Astro, GitHub Actions, Azure OpenAI (gpt-5.4), rclone, yq, jq

---

## Improvement 1: Homepage Announcements Fallback

### Problem

The homepage only shows announcements with `pinned: true`. If a volunteer creates an announcement without checking that box, it appears on `/announcements` but not the homepage. The section vanishes entirely when no pinned announcements exist.

### Solution (Option B)

Show pinned announcements first, fill remaining slots (up to 3) with the most recent non-pinned ones.

### Files

- Modify: `src/pages/en/index.astro` (lines 23-27)
- Modify: `src/pages/zh/index.astro` (same logic)
- Modify: `src/pages/zh-tw/index.astro` (same logic)

### Tasks

- [ ] **Step 1: Update homepage announcement logic in all 3 locale pages**

Replace the current filtering logic:

```javascript
// Before
const pinned = allAnnouncements
  .filter((a) => a.entry.pinned)
  .sort((a, b) => new Date(b.entry.date).getTime() - new Date(a.entry.date).getTime())
  .slice(0, 3);
```

With:

```javascript
// After: pinned first, fill remaining with recent
const sorted = allAnnouncements
  .sort((a, b) => new Date(b.entry.date).getTime() - new Date(a.entry.date).getTime());
const pinnedItems = sorted.filter((a) => a.entry.pinned);
const recentItems = sorted.filter((a) => !a.entry.pinned);
const featured = [...pinnedItems, ...recentItems].slice(0, 3);
```

Update the template to use `featured` instead of `pinned`:
- Change `{pinned.length > 0 && (` → `{featured.length > 0 && (`
- Change the `.map()` reference from `pinned` → `featured`

- [ ] **Step 2: Commit**

```bash
git add src/pages/en/index.astro src/pages/zh/index.astro src/pages/zh-tw/index.astro
git commit -m "fix: show recent announcements on homepage when none are pinned"
```

---

## Improvement 2: Translation via GitHub Action

### Problem

The current client-side translation button:
- Reads rich text via `.textContent` — strips all images, links, formatting
- Writes back via `execCommand('insertText')` — destroys document structure
- Uses `gpt-5-nano` synchronously — user waits, lower quality
- Fragile DOM scraping via `MutationObserver` — breaks if Keystatic UI changes

### Solution

A GitHub Action triggered on content changes that:
1. Detects which fields have content and which are empty
2. For `.mdoc` (Markdoc) files: preserves image tags and formatting, only translates text
3. For YAML text fields: translates the string values
4. Uses `gpt-5.4` via the existing Azure OpenAI endpoint for high-quality translation
5. Commits translations back to the repo

### Content structure reference

**Keystatic stores content as:**
- YAML files: plain text fields (`title_en`, `title_zh`, `title_zhtw`, etc.)
- `.mdoc` files: rich text fields (`body_en.mdoc`, `body_zh.mdoc`, etc.) in Markdoc format

**Trilingual field naming convention:** `{field}_en`, `{field}_zh`, `{field}_zhtw`

**Collections with translatable fields:**

| Collection | YAML text fields | .mdoc document fields |
|------------|-----------------|----------------------|
| `announcements` | `title_en/zh/zhtw` | `body_en/zh/zhtw` |
| `programs` | `title_en/zh/zhtw`, `schedule_en/zh/zhtw`, `location_en/zh/zhtw` | `description_en/zh/zhtw` |
| `galleries` | `title_en/zh/zhtw` | (none) |

**Singletons with translatable fields:**

| Singleton | YAML text fields | .mdoc document fields |
|-----------|-----------------|----------------------|
| `homepage` | `hero_heading_en/zh/zhtw` | `membership_promo_en/zh/zhtw` |
| `about` | executives[].`title_en/zh/zhtw` | `purpose_en/zh/zhtw`, `history_en/zh/zhtw` |
| `terms` | (none) | `body_en/zh/zhtw` |

### Design decisions

**Markdoc translation strategy:** Send the entire `.mdoc` content to the model with instructions to preserve all Markdoc tags, image references, link URLs, and formatting — only translate the human-readable text. Markdoc is close enough to Markdown that GPT handles it well.

**Detection logic:** For each trilingual field group (`*_en`, `*_zh`, `*_zhtw`):
- If the `_en` version has content but `_zh` is empty → translate EN→ZH
- If the `_en` version has content but `_zhtw` is empty → translate EN→ZH-TW
- If `_zh` has content but `_en` is empty → translate ZH→EN (and ZH→ZH-TW)
- If all three are filled → skip (don't overwrite existing translations)
- A field is "empty" if: YAML value is `""`, `null`, or missing; `.mdoc` file doesn't exist or is empty

**Trigger:** On push to `main` for `content/**` changes. Skip bot commits. Only process changed files.

### Files

- Create: `.github/workflows/translate.yml`
- Optionally remove: `public/keystatic-translate.js`, the injection in `src/middleware.ts`, `src/pages/api/translate.ts` (after the action is working and verified)

### Tasks

#### Task 1: Create the translate workflow

- [ ] **Step 1: Create `.github/workflows/translate.yml`**

```yaml
name: Auto-Translate Content

on:
  push:
    branches: [main]
    paths:
      - 'content/**'

  workflow_dispatch:
    inputs:
      path:
        description: 'Specific content path to translate (e.g., content/announcements/my-post.yaml)'
        required: false
        type: string

permissions:
  contents: write

jobs:
  translate:
    runs-on: ubuntu-latest
    if: github.actor != 'github-actions[bot]'

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 2
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Install yq
        uses: mikefarah/yq@v4

      - name: Find changed content files
        id: changes
        run: |
          if [ -n "${{ inputs.path }}" ]; then
            # Manual trigger: use specified path
            echo "${{ inputs.path }}" > /tmp/changed_files.txt
          else
            # Auto trigger: find changed content files
            git diff --name-only HEAD~1 HEAD -- 'content/**' > /tmp/changed_files.txt
          fi

          # Extract unique content entry directories/files
          # For collections: content/{type}/{slug}.yaml or content/{type}/{slug}/
          # For singletons: content/{name}.yaml or content/{name}/
          cat /tmp/changed_files.txt
          echo "count=$(wc -l < /tmp/changed_files.txt | tr -d ' ')" >> "$GITHUB_OUTPUT"

      - name: Translate content
        if: steps.changes.outputs.count != '0'
        env:
          AZURE_OPENAI_ENDPOINT: ${{ secrets.AZURE_AI_ENDPOINT }}
          AZURE_OPENAI_API_KEY: ${{ secrets.AZURE_AI_API_KEY }}
        run: |
          # Map of language suffixes to full names for prompts
          declare -A LANG_NAMES=(
            ["en"]="English"
            ["zh"]="Simplified Chinese"
            ["zhtw"]="Traditional Chinese"
          )
          LANGS=("en" "zh" "zhtw")

          translate_text() {
            local text="$1"
            local source_lang="$2"
            local target_lang="$3"
            local is_markdoc="$4"

            local source_name="${LANG_NAMES[$source_lang]}"
            local target_name="${LANG_NAMES[$target_lang]}"

            local format_instruction=""
            if [ "$is_markdoc" = "true" ]; then
              format_instruction="The text is in Markdoc format. Preserve ALL Markdoc tags, image references (![alt](url)), link URLs, HTML elements, and formatting exactly as-is. Only translate the human-readable text content. Do not translate URLs, file paths, or tag names."
            fi

            local prompt="Translate the following ${source_name} text to ${target_name}. ${format_instruction} Return ONLY the translated text, no explanations or wrapping."

            local response
            response=$(curl -s -X POST \
              "${AZURE_OPENAI_ENDPOINT}/openai/deployments/gpt-5.4/chat/completions?api-version=2025-01-01-preview" \
              -H "Content-Type: application/json" \
              -H "api-key: ${AZURE_OPENAI_API_KEY}" \
              -d "$(jq -n \
                --arg prompt "$prompt" \
                --arg text "$text" \
                '{messages: [{role: "system", content: $prompt}, {role: "user", content: $text}], max_completion_tokens: 4096}')")

            echo "$response" | jq -r '.choices[0].message.content // empty'
          }

          # Process each changed content entry
          # Group changes by content entry (directory or YAML file)
          ENTRIES=()
          while IFS= read -r file; do
            [ -z "$file" ] && continue
            # Determine the content entry root
            # e.g., content/announcements/my-post.yaml → content/announcements/my-post
            # e.g., content/announcements/my-post/body_en.mdoc → content/announcements/my-post
            if [[ "$file" == *.yaml ]]; then
              entry="${file%.yaml}"
            else
              entry=$(dirname "$file")
            fi
            # Deduplicate
            if [[ ! " ${ENTRIES[*]} " =~ " ${entry} " ]]; then
              ENTRIES+=("$entry")
            fi
          done < /tmp/changed_files.txt

          for entry in "${ENTRIES[@]}"; do
            echo "=== Processing: $entry ==="
            yaml_file="${entry}.yaml"

            if [ ! -f "$yaml_file" ]; then
              echo "  No YAML file found at $yaml_file, skipping"
              continue
            fi

            # --- Translate YAML text fields ---
            # Find all trilingual field groups by looking for _en/_zh/_zhtw suffixes
            EN_FIELDS=$(yq 'keys | .[]' "$yaml_file" 2>/dev/null | grep '_en$' || true)

            for en_field in $EN_FIELDS; do
              base="${en_field%_en}"
              zh_field="${base}_zh"
              zhtw_field="${base}_zhtw"

              # Read values
              en_val=$(yq ".${en_field} // \"\"" "$yaml_file" 2>/dev/null)
              zh_val=$(yq ".${zh_field} // \"\"" "$yaml_file" 2>/dev/null)
              zhtw_val=$(yq ".${zhtw_field} // \"\"" "$yaml_file" 2>/dev/null)

              # Skip non-text fields (slug fields have a nested structure)
              if [ "$en_val" = "null" ] || [ -z "$en_val" ]; then
                continue
              fi

              # Translate EN→ZH if zh is empty
              if [ -z "$zh_val" ] || [ "$zh_val" = "null" ] || [ "$zh_val" = "''" ]; then
                echo "  Translating $en_field → $zh_field"
                translated=$(translate_text "$en_val" "en" "zh" "false")
                if [ -n "$translated" ]; then
                  yq -i ".${zh_field} = $(echo "$translated" | jq -Rs '.')" "$yaml_file"
                fi
              fi

              # Translate EN→ZH-TW if zhtw is empty
              if [ -z "$zhtw_val" ] || [ "$zhtw_val" = "null" ] || [ "$zhtw_val" = "''" ]; then
                echo "  Translating $en_field → $zhtw_field"
                translated=$(translate_text "$en_val" "en" "zhtw" "false")
                if [ -n "$translated" ]; then
                  yq -i ".${zhtw_field} = $(echo "$translated" | jq -Rs '.')" "$yaml_file"
                fi
              fi
            done

            # --- Translate .mdoc document fields ---
            # Look for _en.mdoc files in the entry directory
            if [ -d "$entry" ]; then
              for en_mdoc in "$entry"/*_en.mdoc; do
                [ -f "$en_mdoc" ] || continue
                base_name=$(basename "$en_mdoc" _en.mdoc)

                zh_mdoc="${entry}/${base_name}_zh.mdoc"
                zhtw_mdoc="${entry}/${base_name}_zhtw.mdoc"

                en_content=$(cat "$en_mdoc")
                [ -z "$en_content" ] && continue

                # Translate EN→ZH if zh mdoc is empty or missing
                if [ ! -f "$zh_mdoc" ] || [ ! -s "$zh_mdoc" ]; then
                  echo "  Translating ${base_name}_en.mdoc → ${base_name}_zh.mdoc"
                  translated=$(translate_text "$en_content" "en" "zh" "true")
                  if [ -n "$translated" ]; then
                    echo "$translated" > "$zh_mdoc"
                  fi
                fi

                # Translate EN→ZH-TW if zhtw mdoc is empty or missing
                if [ ! -f "$zhtw_mdoc" ] || [ ! -s "$zhtw_mdoc" ]; then
                  echo "  Translating ${base_name}_en.mdoc → ${base_name}_zhtw.mdoc"
                  translated=$(translate_text "$en_content" "en" "zhtw" "true")
                  if [ -n "$translated" ]; then
                    echo "$translated" > "$zhtw_mdoc"
                  fi
                fi
              done
            fi

            echo "  Done: $entry"
          done

      - name: Commit translations
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add content/

          if git diff --cached --quiet; then
            echo "::notice::No translations needed"
          else
            git commit -m "chore: auto-translate content"
            git push
          fi

      - name: Job summary
        if: always()
        run: |
          echo "## Translation Results" >> "$GITHUB_STEP_SUMMARY"
          echo "" >> "$GITHUB_STEP_SUMMARY"
          echo "Processed $(cat /tmp/changed_files.txt | wc -l) changed files" >> "$GITHUB_STEP_SUMMARY"
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/translate.yml
git commit -m "feat: add auto-translate workflow for content changes"
```

#### Task 2: Verify the translate workflow works

- [ ] **Step 1: Test with a new announcement**

Create a new announcement in Keystatic with only English fields filled. Push. Verify:
- [ ] Translate workflow triggers
- [ ] `title_zh` and `title_zhtw` are populated in the YAML
- [ ] `body_zh.mdoc` and `body_zhtw.mdoc` are created
- [ ] If the English body contained images, the image references are preserved in translated versions
- [ ] Deploy workflow triggers after the translation commit

- [ ] **Step 2: Test idempotency**

Push again with no changes. Verify the workflow skips (no empty fields to translate).

- [ ] **Step 3: Test with existing translations**

Edit a post that already has all 3 languages filled. Verify nothing is overwritten.

#### Task 3: Remove the old client-side translation hack (after verification)

- [ ] **Step 1: Remove the translate button script and middleware injection**

Files to clean up:
- Delete: `public/keystatic-translate.js`
- Modify: `src/middleware.ts` — remove the script injection logic
- Optionally delete: `src/pages/api/translate.ts` — the SSR endpoint is no longer needed

- [ ] **Step 2: Commit**

```bash
git rm public/keystatic-translate.js
git add src/middleware.ts
git rm src/pages/api/translate.ts
git commit -m "refactor: remove client-side translate hack (replaced by GitHub Action)"
```

---

## Improvement 3: Gallery Auto-Select Cover Image

### Problem

When the gallery pipeline processes photos, the `cover_image` field is left empty. Volunteers must manually upload a cover image. We can auto-select one.

### Solution

At the end of the gallery pipeline, after uploading to R2:
1. Check if `cover_image` is already set in the YAML → skip if yes
2. Look for a file matching `feature*` or `hero*` (case-insensitive) among the processed images
3. If not found, use the first image alphabetically
4. Download the thumbnail version from R2
5. Save it to `public/images/galleries/{slug}-cover.webp`
6. Set `cover_image` in the YAML

### Files

- Modify: `.github/workflows/gallery-pipeline.yml` — add a step before the manifest commit

### Tasks

- [ ] **Step 1: Add auto-cover-image step to gallery pipeline**

Add this step after "Generate photo manifest" and before "Update gallery YAML and commit":

```yaml
      - name: Auto-select cover image
        if: steps.inputs.outputs.skip != 'true'
        run: |
          SLUG="${{ steps.inputs.outputs.slug }}"
          YAML_FILE="content/galleries/${SLUG}.yaml"

          # Check if cover_image is already set
          EXISTING_COVER=$(yq '.cover_image // ""' "$YAML_FILE")
          if [ -n "$EXISTING_COVER" ] && [ "$EXISTING_COVER" != "null" ] && [ "$EXISTING_COVER" != "''" ]; then
            echo "Cover image already set, skipping"
            exit 0
          fi

          # Look for feature/hero image (case-insensitive)
          COVER_FILE=""
          for pattern in feature hero; do
            MATCH=$(ls ./processed/thumb/ | grep -i "^${pattern}" | head -1 || true)
            if [ -n "$MATCH" ]; then
              COVER_FILE="$MATCH"
              echo "Found cover image by name: $COVER_FILE"
              break
            fi
          done

          # Fallback: use first image alphabetically
          if [ -z "$COVER_FILE" ]; then
            COVER_FILE=$(ls ./processed/thumb/ | sort | head -1)
            echo "Using first image as cover: $COVER_FILE"
          fi

          if [ -z "$COVER_FILE" ]; then
            echo "::warning::No images available for cover"
            exit 0
          fi

          # Copy thumbnail to public/images/galleries/
          mkdir -p public/images/galleries
          COVER_DEST="public/images/galleries/${SLUG}-cover.webp"
          cp "./processed/thumb/${COVER_FILE}" "$COVER_DEST"

          # Set cover_image in YAML (Keystatic image field expects the filename only)
          yq -i ".cover_image = \"${SLUG}-cover.webp\"" "$YAML_FILE"

          echo "Set cover image: $COVER_DEST"
```

- [ ] **Step 2: Update the git add in the commit step to include the cover image**

In the "Update gallery YAML and commit" step, change:
```bash
git add "$YAML_FILE"
```
to:
```bash
git add "$YAML_FILE" public/images/galleries/
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/gallery-pipeline.yml
git commit -m "feat: auto-select cover image in gallery pipeline"
```

---

## Workflow Interaction Summary

After all three improvements, the full content workflow is:

```
Volunteer creates/edits content in Keystatic
  → Keystatic commits to GitHub
    → Auto-Translate workflow detects empty language fields, translates, commits
      → Deploy workflow builds and deploys the site
    → (If gallery) Gallery Pipeline downloads, converts, uploads, commits manifest + cover
      → Deploy workflow builds and deploys the site
```

**Loop prevention:** All bot workflows check `if: github.actor != 'github-actions[bot]'`.

---

## Decisions Log

| Decision | Rationale |
|----------|-----------|
| Homepage: pinned-first with recent fallback | More resilient than requiring volunteers to remember the checkbox |
| Translation: GitHub Action over client-side | Works with Markdoc natively, preserves formatting/images, async, better model |
| Translation: gpt-5.4 model | Higher quality than nano, async so latency doesn't matter, cost is negligible |
| Translation: only translate empty fields | Never overwrites manual translations, safe to re-run |
| Translation: preserve Markdoc formatting | System prompt instructs model to only translate text, keep tags/URLs/images |
| Gallery cover: thumb from R2 committed to repo | Matches existing Keystatic image field pattern, no frontend code changes |
| Gallery cover: feature/hero name priority | Common naming convention, with first-image fallback |
