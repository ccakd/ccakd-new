# Gallery Image Pipeline — GitHub Action Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the planned Azure Function with a GitHub Actions workflow that downloads photos from Google Drive, converts them to optimized WebP (full + thumbnail), uploads to Cloudflare R2, and commits the photo manifest back to the gallery YAML.

**Architecture:** A single GitHub Actions workflow triggered both manually (`workflow_dispatch` with gallery slug + GDrive folder ID) and automatically (push to `content/galleries/**`). Uses rclone for Google Drive download and R2 upload, cwebp for WebP conversion, and ImageMagick for dimension extraction. Parallel image processing via GNU `parallel`. Bot commits the manifest back, guarded against infinite loops.

**Tech Stack:** GitHub Actions, rclone, cwebp (libwebp), ImageMagick, GNU parallel, yq

**Spec:** `docs/superpowers/specs/2026-03-12-ccakd-website-redesign-design.md` (Section 4: Gallery Image Pipeline)

**Frontend data contract:** `src/components/GalleryLightbox.astro` expects `Photo[]`:
```typescript
interface Photo {
  filename: string;   // e.g. "IMG_0001.webp"
  width: number;      // full-size width in px
  height: number;     // full-size height in px
  fullUrl: string;    // https://{r2-domain}/galleries/{slug}/full/IMG_0001.webp
  thumbUrl: string;   // https://{r2-domain}/galleries/{slug}/thumb/IMG_0001.webp
}
```

**Gallery YAML fields set by pipeline:**
- `r2_folder`: `galleries/{slug}` — path prefix in R2
- `photo_manifest`: JSON string of `Photo[]`

---

## File Structure

```
ccakd-new/
├── .github/
│   └── workflows/
│       └── gallery-pipeline.yml        # The workflow (this plan's deliverable)
└── content/
    └── galleries/
        └── *.yaml                      # Gallery entries (modified by the pipeline)
```

Only one file is created. Gallery YAML files are modified in-place by the workflow.

---

## Prerequisites (documented, not automated)

Before running this workflow, the following must be set up manually:

### 1. Google Cloud Service Account

1. Create a GCP project (or use existing).
2. Enable the **Google Drive API**.
3. Create a service account (e.g., `ccakd-gallery@ccakd-project.iam.gserviceaccount.com`).
4. Download the JSON key file.
5. Share each Google Drive folder with the service account email (Viewer access is sufficient).

### 2. Cloudflare R2 Bucket

1. Create an R2 bucket (e.g., `ccakd-media`).
2. Enable **public access** on the bucket (Settings → Public access → Enable). Note the public URL: `https://pub-{hash}.r2.dev`.
3. Create an **R2 API token** (R2 → Manage R2 API Tokens → Create API Token) with Object Read & Write permission scoped to the bucket.
4. Note: `endpoint`, `access_key_id`, and `secret_access_key` from the token.

### 3. GitHub Repository Secrets

Set these in the repo's Settings → Secrets → Actions:

| Secret | Value |
|--------|-------|
| `RCLONE_CONFIG` | Base64-encoded rclone config (see below) |
| `R2_PUBLIC_URL` | R2 public bucket URL, e.g. `https://pub-abc123.r2.dev` |

**rclone config template** (encode this as base64 for `RCLONE_CONFIG`):

```ini
[gdrive]
type = drive
scope = drive.readonly
service_account_file_contents = {"type":"service_account","project_id":"...","private_key":"...","client_email":"...","...":"..."}

[r2]
type = s3
provider = Cloudflare
endpoint = https://{account_id}.r2.cloudflarestorage.com
access_key_id = {r2_access_key_id}
secret_access_key = {r2_secret_access_key}
no_check_bucket = true
```

> **Note:** The `service_account_file_contents` field embeds the entire JSON key inline — no separate file needed. This is a native rclone feature for service accounts.

---

## Chunk 1: Core Workflow

### Task 1: Create the workflow file with triggers and inputs

**Files:**
- Create: `.github/workflows/gallery-pipeline.yml`

- [x] **Step 1: Create the workflow file with both triggers**

```yaml
name: Gallery Image Pipeline

on:
  workflow_dispatch:
    inputs:
      gallery_slug:
        description: 'Gallery slug (matches content/galleries/{slug}.yaml)'
        required: true
        type: string
      gdrive_folder_id:
        description: 'Google Drive folder ID'
        required: true
        type: string
      force:
        description: 'Force re-process even if manifest exists'
        required: false
        type: boolean
        default: false

  push:
    branches: [main]
    paths:
      - 'content/galleries/**'

permissions:
  contents: write

jobs:
  process-gallery:
    runs-on: ubuntu-latest
    # Prevent infinite loop: skip if the push was from the bot committing a manifest
    if: github.actor != 'github-actions[bot]'

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
```

- [x] **Step 2: Commit**

```bash
git add .github/workflows/gallery-pipeline.yml
git commit -m "feat: add gallery pipeline workflow scaffold with triggers"
```

---

### Task 2: Add input resolution step (manual vs auto-trigger)

**Files:**
- Modify: `.github/workflows/gallery-pipeline.yml`

- [x] **Step 1: Add the resolve-inputs step after checkout**

For `workflow_dispatch`, inputs come directly. For `push`, we need to detect which gallery YAML changed, read its `gdrive_link`, and extract the folder ID from the URL.

```yaml
      - name: Install yq
        uses: mikefarah/yq@master

      - name: Resolve inputs
        id: inputs
        run: |
          if [ "${{ github.event_name }}" = "workflow_dispatch" ]; then
            echo "slug=${{ inputs.gallery_slug }}" >> "$GITHUB_OUTPUT"
            echo "folder_id=${{ inputs.gdrive_folder_id }}" >> "$GITHUB_OUTPUT"
            echo "force=${{ inputs.force }}" >> "$GITHUB_OUTPUT"
          else
            # Find which gallery YAML files changed in this push
            CHANGED=$(git diff --name-only HEAD~1 HEAD -- 'content/galleries/*.yaml' | head -1)
            if [ -z "$CHANGED" ]; then
              echo "No gallery YAML changed. Skipping."
              echo "skip=true" >> "$GITHUB_OUTPUT"
              exit 0
            fi

            # Extract slug from filename (content/galleries/{slug}.yaml)
            SLUG=$(basename "$CHANGED" .yaml)
            echo "slug=$SLUG" >> "$GITHUB_OUTPUT"

            # Read gdrive_link from the YAML and extract folder ID
            GDRIVE_LINK=$(yq '.gdrive_link // ""' "$CHANGED")
            if [ -z "$GDRIVE_LINK" ] || [ "$GDRIVE_LINK" = "null" ]; then
              echo "No gdrive_link set in $CHANGED. Skipping."
              echo "skip=true" >> "$GITHUB_OUTPUT"
              exit 0
            fi

            # Extract folder ID from Google Drive URL
            # Supports: https://drive.google.com/drive/folders/{ID}?...
            FOLDER_ID=$(echo "$GDRIVE_LINK" | grep -oP 'folders/\K[A-Za-z0-9_-]+')
            if [ -z "$FOLDER_ID" ]; then
              echo "::error::Could not extract folder ID from gdrive_link: $GDRIVE_LINK"
              exit 1
            fi
            echo "folder_id=$FOLDER_ID" >> "$GITHUB_OUTPUT"

            # Check if manifest already exists
            MANIFEST=$(yq '.photo_manifest // ""' "$CHANGED")
            if [ -n "$MANIFEST" ] && [ "$MANIFEST" != "null" ] && [ "$MANIFEST" != "''" ] && [ "$MANIFEST" != "" ]; then
              echo "Manifest already populated. Skipping (use workflow_dispatch with force=true to re-process)."
              echo "skip=true" >> "$GITHUB_OUTPUT"
              exit 0
            fi

            echo "force=false" >> "$GITHUB_OUTPUT"
          fi
          echo "skip=false" >> "$GITHUB_OUTPUT"

      - name: Check skip
        if: steps.inputs.outputs.skip == 'true'
        run: |
          echo "::notice::Skipping pipeline — no work to do."
          exit 0
```

- [x] **Step 2: Commit**

```bash
git add .github/workflows/gallery-pipeline.yml
git commit -m "feat: add input resolution for manual and auto-trigger modes"
```

---

### Task 3: Add rclone setup and image download

**Files:**
- Modify: `.github/workflows/gallery-pipeline.yml`

- [x] **Step 1: Add rclone setup and download steps**

All remaining steps should have `if: steps.inputs.outputs.skip != 'true'` to respect the skip flag.

```yaml
      - name: Setup rclone
        if: steps.inputs.outputs.skip != 'true'
        uses: AnimMouse/setup-rclone@v1
        with:
          rclone_config: ${{ secrets.RCLONE_CONFIG }}

      - name: Download images from Google Drive
        if: steps.inputs.outputs.skip != 'true'
        run: |
          FOLDER_ID="${{ steps.inputs.outputs.folder_id }}"
          mkdir -p raw_images

          echo "Downloading images from GDrive folder: $FOLDER_ID"
          rclone copy "gdrive,root_folder_id=$FOLDER_ID:" ./raw_images \
            --include "*.{jpg,jpeg,png,heic,JPG,JPEG,PNG,HEIC}" \
            --progress

          COUNT=$(find ./raw_images -type f | wc -l)
          echo "Downloaded $COUNT images"

          if [ "$COUNT" -eq 0 ]; then
            echo "::error::No images found in Google Drive folder $FOLDER_ID"
            exit 1
          fi
```

> **Note:** `gdrive,root_folder_id=$FOLDER_ID:` is rclone's on-the-fly backend config syntax — it overrides the root folder to download only from the specified folder, without needing to know the full path. This is the key to using folder ID as input.

- [x] **Step 2: Commit**

```bash
git add .github/workflows/gallery-pipeline.yml
git commit -m "feat: add rclone GDrive download step"
```

---

### Task 4: Add image conversion (full + thumbnail)

**Files:**
- Modify: `.github/workflows/gallery-pipeline.yml`

- [x] **Step 1: Add WebP conversion steps with parallel processing**

```yaml
      - name: Install image tools
        if: steps.inputs.outputs.skip != 'true'
        run: sudo apt-get update && sudo apt-get install -y webp imagemagick parallel

      - name: Convert images to WebP
        if: steps.inputs.outputs.skip != 'true'
        run: |
          SLUG="${{ steps.inputs.outputs.slug }}"
          mkdir -p processed/full processed/thumb

          # Build a file list (flatten any nested structure, handle spaces in names)
          find ./raw_images -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.heic' \) > /tmp/image_list.txt

          echo "Processing $(wc -l < /tmp/image_list.txt) images..."

          # Convert function used by parallel
          convert_image() {
            local img="$1"
            local filename
            filename=$(basename "$img")
            local name="${filename%.*}"

            # Full size: max 2000px wide, WebP q80, strip metadata
            cwebp -q 80 -resize 2000 0 -metadata none "$img" -o "./processed/full/${name}.webp" 2>/dev/null

            # Thumbnail: max 400px wide, WebP q80, strip metadata
            cwebp -q 80 -resize 400 0 -metadata none "$img" -o "./processed/thumb/${name}.webp" 2>/dev/null

            echo "  ✓ ${name}"
          }
          export -f convert_image

          # Process in parallel (use available cores)
          parallel -j "$(nproc)" convert_image < /tmp/image_list.txt

          PROCESSED=$(ls ./processed/full/*.webp 2>/dev/null | wc -l)
          echo "Converted $PROCESSED images to WebP"
```

- [x] **Step 2: Commit**

```bash
git add .github/workflows/gallery-pipeline.yml
git commit -m "feat: add parallel WebP conversion for full and thumbnail sizes"
```

---

### Task 5: Add R2 upload with skip-existing logic

**Files:**
- Modify: `.github/workflows/gallery-pipeline.yml`

- [x] **Step 1: Add R2 upload step**

```yaml
      - name: Check existing files on R2
        if: steps.inputs.outputs.skip != 'true' && steps.inputs.outputs.force != 'true'
        id: r2check
        run: |
          SLUG="${{ steps.inputs.outputs.slug }}"
          # List existing files in R2 for this gallery
          EXISTING=$(rclone lsf "r2:ccakd-media/galleries/${SLUG}/full/" 2>/dev/null || true)

          if [ -n "$EXISTING" ]; then
            echo "Found existing files on R2. Removing already-uploaded from local processed set."
            while IFS= read -r existing_file; do
              if [ -f "./processed/full/$existing_file" ]; then
                rm -f "./processed/full/$existing_file"
                rm -f "./processed/thumb/$existing_file"
                echo "  Skipped: $existing_file (already on R2)"
              fi
            done <<< "$EXISTING"
          fi

          REMAINING=$(ls ./processed/full/*.webp 2>/dev/null | wc -l)
          echo "remaining=$REMAINING" >> "$GITHUB_OUTPUT"
          echo "$REMAINING new images to upload"

      - name: Upload to Cloudflare R2
        if: steps.inputs.outputs.skip != 'true'
        run: |
          SLUG="${{ steps.inputs.outputs.slug }}"

          echo "Uploading to R2: galleries/${SLUG}/"
          rclone copy ./processed/full/ "r2:ccakd-media/galleries/${SLUG}/full/" --progress
          rclone copy ./processed/thumb/ "r2:ccakd-media/galleries/${SLUG}/thumb/" --progress

          echo "Upload complete"
```

> **Note on skip-existing:** When `force` is false and triggered by push, we check R2 for existing filenames and skip them locally before upload. When `force` is true (manual re-process), we skip the check and re-upload everything. rclone's `copy` command also naturally skips identical files, providing a second layer of deduplication.

- [x] **Step 2: Commit**

```bash
git add .github/workflows/gallery-pipeline.yml
git commit -m "feat: add R2 upload with skip-existing logic"
```

---

### Task 6: Generate manifest JSON and commit back

**Files:**
- Modify: `.github/workflows/gallery-pipeline.yml`

- [x] **Step 1: Add manifest generation step**

This step reads dimensions from the uploaded WebP files and builds the `Photo[]` JSON array.

```yaml
      - name: Generate photo manifest
        if: steps.inputs.outputs.skip != 'true'
        id: manifest
        run: |
          SLUG="${{ steps.inputs.outputs.slug }}"
          R2_PUBLIC_URL="${{ secrets.R2_PUBLIC_URL }}"

          # List ALL full-size images on R2 for this gallery (includes previously uploaded)
          # This ensures the manifest is complete even when only new images were uploaded
          ALL_FILES=$(rclone lsf "r2:ccakd-media/galleries/${SLUG}/full/" 2>/dev/null | sort)

          if [ -z "$ALL_FILES" ]; then
            echo "::error::No files found on R2 after upload"
            exit 1
          fi

          # Download all full-size images to get dimensions (we need them for PhotoSwipe)
          # For newly processed images, they're already local; for old ones, we fetch from R2
          mkdir -p all_full
          rclone copy "r2:ccakd-media/galleries/${SLUG}/full/" ./all_full/ --progress

          # Build manifest JSON
          MANIFEST="["
          FIRST=true
          while IFS= read -r webp_file; do
            [ -z "$webp_file" ] && continue

            local_file="./all_full/${webp_file}"
            if [ ! -f "$local_file" ]; then
              echo "  Warning: $webp_file not found locally, skipping"
              continue
            fi

            # Get dimensions using ImageMagick identify
            DIMS=$(identify -format '%w %h' "$local_file" 2>/dev/null)
            WIDTH=$(echo "$DIMS" | awk '{print $1}')
            HEIGHT=$(echo "$DIMS" | awk '{print $2}')

            if [ -z "$WIDTH" ] || [ -z "$HEIGHT" ]; then
              echo "  Warning: Could not read dimensions for $webp_file, skipping"
              continue
            fi

            FULL_URL="${R2_PUBLIC_URL}/galleries/${SLUG}/full/${webp_file}"
            THUMB_URL="${R2_PUBLIC_URL}/galleries/${SLUG}/thumb/${webp_file}"

            if [ "$FIRST" = true ]; then
              FIRST=false
            else
              MANIFEST+=","
            fi

            MANIFEST+="{\"filename\":\"${webp_file}\",\"width\":${WIDTH},\"height\":${HEIGHT},\"fullUrl\":\"${FULL_URL}\",\"thumbUrl\":\"${THUMB_URL}\"}"
          done <<< "$ALL_FILES"

          MANIFEST+="]"

          # Pretty-print and save
          echo "$MANIFEST" | jq '.' > /tmp/manifest.json
          echo "Generated manifest with $(echo "$MANIFEST" | jq 'length') photos"
          cat /tmp/manifest.json

      - name: Update gallery YAML and commit
        if: steps.inputs.outputs.skip != 'true'
        run: |
          SLUG="${{ steps.inputs.outputs.slug }}"
          YAML_FILE="content/galleries/${SLUG}.yaml"

          if [ ! -f "$YAML_FILE" ]; then
            echo "::error::Gallery file not found: $YAML_FILE"
            exit 1
          fi

          # Read the manifest as a single-line JSON string for YAML embedding
          MANIFEST=$(cat /tmp/manifest.json | jq -c '.')

          # Update the YAML fields
          yq -i ".r2_folder = \"galleries/${SLUG}\"" "$YAML_FILE"
          yq -i ".photo_manifest = $(echo "$MANIFEST" | jq -Rs '.')" "$YAML_FILE"

          echo "Updated $YAML_FILE:"
          cat "$YAML_FILE"

          # Commit and push
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add "$YAML_FILE"

          if git diff --cached --quiet; then
            echo "::notice::No changes to commit (manifest unchanged)"
          else
            git commit -m "chore: update photo manifest for gallery '${SLUG}'"
            git push
          fi
```

- [x] **Step 2: Commit**

```bash
git add .github/workflows/gallery-pipeline.yml
git commit -m "feat: add manifest generation and commit-back step"
```

---

### Task 7: Add job summary and error handling

**Files:**
- Modify: `.github/workflows/gallery-pipeline.yml`

- [x] **Step 1: Add a summary step at the end of the job**

```yaml
      - name: Job summary
        if: steps.inputs.outputs.skip != 'true' && always()
        run: |
          SLUG="${{ steps.inputs.outputs.slug }}"
          PHOTO_COUNT=$(cat /tmp/manifest.json 2>/dev/null | jq 'length' 2>/dev/null || echo "0")

          echo "## Gallery Pipeline Results" >> "$GITHUB_STEP_SUMMARY"
          echo "" >> "$GITHUB_STEP_SUMMARY"
          echo "| Field | Value |" >> "$GITHUB_STEP_SUMMARY"
          echo "|-------|-------|" >> "$GITHUB_STEP_SUMMARY"
          echo "| Gallery | \`${SLUG}\` |" >> "$GITHUB_STEP_SUMMARY"
          echo "| Photos processed | ${PHOTO_COUNT} |" >> "$GITHUB_STEP_SUMMARY"
          echo "| R2 path | \`galleries/${SLUG}/\` |" >> "$GITHUB_STEP_SUMMARY"
          echo "| Trigger | ${{ github.event_name }} |" >> "$GITHUB_STEP_SUMMARY"
```

- [x] **Step 2: Commit**

```bash
git add .github/workflows/gallery-pipeline.yml
git commit -m "feat: add job summary output for gallery pipeline"
```

---

## Chunk 2: Testing & Validation

### Task 8: Validate the complete workflow YAML

- [x] **Step 1: Validate YAML syntax**

Run: `yq '.' .github/workflows/gallery-pipeline.yml > /dev/null`
Expected: No errors

- [ ] **Step 2: Validate GitHub Actions syntax with actionlint (if available)**

Run: `npx actionlint .github/workflows/gallery-pipeline.yml` or review manually.

- [ ] **Step 3: Dry-run review checklist**

Verify manually:
- [ ] `workflow_dispatch` inputs: `gallery_slug`, `gdrive_folder_id`, `force`
- [ ] Push trigger scoped to `content/galleries/**` on `main`
- [ ] `if: github.actor != 'github-actions[bot]'` prevents infinite loops
- [ ] All steps after resolution have `if: steps.inputs.outputs.skip != 'true'`
- [ ] Secrets referenced: `RCLONE_CONFIG`, `R2_PUBLIC_URL`, `GITHUB_TOKEN`
- [ ] Manifest JSON matches `Photo` interface: `filename`, `width`, `height`, `fullUrl`, `thumbUrl`
- [ ] Bot commit uses standard `github-actions[bot]` identity
- [ ] `git push` only runs when there are actual changes

---

### Task 9: End-to-end test with a real gallery

- [ ] **Step 1: Prepare test data**

1. Create a Google Drive folder with 3-5 test images (mix of JPG and PNG).
2. Share the folder with the service account email.
3. Note the folder ID from the URL.

- [ ] **Step 2: Run the workflow manually**

In GitHub → Actions → Gallery Image Pipeline → Run workflow:
- `gallery_slug`: `chinese-new-year-2026`
- `gdrive_folder_id`: `{test-folder-id}`
- `force`: `true`

- [ ] **Step 3: Verify results**

- [ ] Workflow completes successfully (green check)
- [ ] R2 bucket has `galleries/chinese-new-year-2026/full/*.webp` and `galleries/chinese-new-year-2026/thumb/*.webp`
- [ ] Full images are ≤2000px wide
- [ ] Thumbnails are ≤400px wide
- [ ] `content/galleries/chinese-new-year-2026.yaml` has `r2_folder` and `photo_manifest` populated
- [ ] Manifest JSON parses correctly and has correct URLs
- [ ] Gallery page renders photos from R2

- [ ] **Step 4: Test idempotency**

Re-run the workflow with the same inputs and `force: false`.
Expected: Pipeline skips (manifest already exists).

Re-run with `force: true`.
Expected: Pipeline re-processes and produces identical manifest.

---

## Decisions Log

| Decision | Rationale |
|----------|-----------|
| GitHub Action instead of Azure Function | Simpler: no infra to maintain, full VM resources, rclone handles both ends |
| rclone (not Google Workspace CLI) | Mature, stable, handles both GDrive and R2, well-supported in CI |
| cwebp (not sharp) | No Node.js needed, simpler in shell scripts, battle-tested |
| Folder ID input (not URL) | Unambiguous, works directly with rclone's `root_folder_id` |
| GNU parallel for conversion | Uses all runner cores (~4), significant speedup for large galleries |
| Single workflow file | One logical pipeline, no benefit to splitting until there's a second consumer |
| Manifest built from R2 listing | Ensures completeness even on partial re-runs |
| Strip all EXIF/metadata | Privacy (GPS, camera info) — `cwebp -metadata none` is the default |
| R2 default public domain | `media.ccakd.ca` custom domain is TBD, easy to swap later via `R2_PUBLIC_URL` secret |
