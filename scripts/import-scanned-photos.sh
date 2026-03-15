#!/bin/bash
# Import Scanned Photos from Google Drive
# Downloads 37 folders of scanned CCAKD photos from a shared Google Drive folder,
# converts to WebP, uploads to R2, and creates Keystatic gallery entries.
#
# Folder name format: YYYY_Month/Season_Event_Name
# e.g. 1978_Summer_Canada_Week_Parade → slug: 1978-summer-canada-week-parade, date: 1978-06-01
#
# Prerequisites: rclone (configured with gdrive remote), cwebp, identify, mogrify, wrangler
# Usage: ./scripts/import-scanned-photos.sh [--dry-run] [--folder NAME] [--skip-upload]

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────────
GDRIVE_FOLDER_ID="1eoXDBR_fpIWsNsh1-yYUE1wH_BHmgf1f"
RCLONE_REMOTE="gdrive"  # rclone remote name for Google Drive
R2_REMOTE="r2-ccakd:ccakd-media"
R2_PUBLIC_URL="https://media.ccakd.ca"
WORK_DIR="/tmp/scanned-photos-import"
CONTENT_DIR="$(cd "$(dirname "$0")/.." && pwd)/content/galleries"
PARALLEL_JOBS=20  # M1 MacBook Pro with 16GB — 20 concurrent jobs

# ── Flags ──────────────────────────────────────────────────────────────────────
DRY_RUN=false
SINGLE_FOLDER=""
SKIP_UPLOAD=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)   DRY_RUN=true; shift ;;
    --folder)    SINGLE_FOLDER="$2"; shift 2 ;;
    --skip-upload) SKIP_UPLOAD=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Helpers ────────────────────────────────────────────────────────────────────

# Map month name (case-insensitive) to MM
month_to_num() {
  case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
    january)   echo "01" ;; february)  echo "02" ;; march)     echo "03" ;;
    april)     echo "04" ;; may)       echo "05" ;; june)      echo "06" ;;
    july)      echo "07" ;; august)    echo "08" ;; september) echo "09" ;;
    october)   echo "10" ;; november)  echo "11" ;; december)  echo "12" ;;
    *) echo "" ;;
  esac
}

# Map season name to MM
season_to_num() {
  case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
    spring) echo "03" ;; summer) echo "06" ;;
    fall|autumn) echo "09" ;; winter) echo "12" ;;
    *) echo "" ;;
  esac
}

# Extract date from folder name like YYYY_Month_... or YYYY_Season_...
extract_date() {
  local name="$1"
  local year="" month=""

  # Extract 4-digit year (1900-2099)
  year=$(echo "$name" | grep -oE '(19|20)[0-9]{2}' | head -1)
  if [[ -z "$year" ]]; then
    echo "2000-01-01"
    return
  fi

  # Second part of the folder name (after year_)
  local second_part
  second_part=$(echo "$name" | sed -E "s/^${year}_//" | cut -d'_' -f1)

  # Try month first, then season
  month=$(month_to_num "$second_part")
  if [[ -z "$month" ]]; then
    month=$(season_to_num "$second_part")
  fi
  if [[ -z "$month" ]]; then
    month="01"
  fi

  echo "${year}-${month}-01"
}

# Convert folder name to slug: lowercase, underscores/spaces to hyphens
make_slug() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | sed 's/[_ ]/-/g' | sed 's/--*/-/g' | sed 's/-$//'
}

# Convert folder name to title: underscores to spaces
make_title() {
  echo "$1" | sed 's/_/ /g'
}

# ── Preflight checks ──────────────────────────────────────────────────────────
for cmd in rclone cwebp identify mogrify; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "ERROR: $cmd not found. Install with:"
    case "$cmd" in
      rclone)  echo "  brew install rclone" ;;
      cwebp)   echo "  brew install webp" ;;
      identify|mogrify) echo "  brew install imagemagick" ;;
    esac
    exit 1
  fi
done

if [[ "$SKIP_UPLOAD" == "false" ]]; then
  rclone lsd "${R2_REMOTE%%/*}/" &>/dev/null || {
    echo "ERROR: rclone remote '${R2_REMOTE%%:*}' not configured. Run: rclone config"
    exit 1
  }
fi

mkdir -p "$WORK_DIR"

# ── List folders ───────────────────────────────────────────────────────────────
echo "Listing folders in Scanned Photos..."
FOLDERS=$(rclone lsd "${RCLONE_REMOTE},root_folder_id=${GDRIVE_FOLDER_ID}:" 2>/dev/null | awk '{print $NF}')

if [[ -z "$FOLDERS" ]]; then
  echo "ERROR: No folders found. Check rclone config and folder ID."
  exit 1
fi

TOTAL=$(echo "$FOLDERS" | wc -l | tr -d ' ')
echo "Found $TOTAL folders"
echo ""

# ── Process each folder ───────────────────────────────────────────────────────
current=0
while IFS= read -r folder_name; do
  [[ -z "$folder_name" ]] && continue
  current=$((current + 1))

  # Filter to single folder if specified
  if [[ -n "$SINGLE_FOLDER" && "$folder_name" != "$SINGLE_FOLDER" ]]; then
    continue
  fi

  slug=$(make_slug "$folder_name")
  title=$(make_title "$folder_name")
  date=$(extract_date "$folder_name")

  echo "[$current/$TOTAL] $folder_name"
  echo "  Slug:  $slug"
  echo "  Title: $title"
  echo "  Date:  $date"

  # Skip if gallery YAML already exists with a manifest
  yaml_file="$CONTENT_DIR/${slug}.yaml"
  if [[ -f "$yaml_file" ]]; then
    existing_manifest=$(grep -c 'photo_manifest' "$yaml_file" 2>/dev/null || true)
    if [[ "$existing_manifest" -gt 0 ]]; then
      echo "  SKIP: gallery already exists with manifest"
      echo ""
      continue
    fi
  fi

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "  [dry-run] Would process this gallery"
    echo ""
    continue
  fi

  # Create work directories
  dl_dir="$WORK_DIR/$slug/originals"
  full_dir="$WORK_DIR/$slug/full"
  thumb_dir="$WORK_DIR/$slug/thumb"
  mkdir -p "$dl_dir" "$full_dir" "$thumb_dir"

  # ── Download ──────────────────────────────────────────────────────────
  echo "  Downloading from Google Drive..."
  rclone copy "${RCLONE_REMOTE},root_folder_id=${GDRIVE_FOLDER_ID}:${folder_name}" "$dl_dir" \
    --include "*.{jpg,jpeg,png,heic,tif,tiff,JPG,JPEG,PNG,HEIC,TIF,TIFF}" \
    --transfers "$PARALLEL_JOBS" --progress 2>&1 | tail -1

  dl_count=$(find "$dl_dir" -type f | wc -l | tr -d ' ')
  echo "  Downloaded $dl_count images"

  if [[ "$dl_count" -eq 0 ]]; then
    echo "  SKIP: no images found in folder"
    echo ""
    continue
  fi

  # ── Pre-convert HEIC to PNG ───────────────────────────────────────────
  heic_count=0
  while IFS= read -r -d '' heic; do
    name="${heic%.*}"
    if heif-convert "$heic" "${name}.png" 2>/dev/null; then
      rm -f "$heic"
      heic_count=$((heic_count + 1))
    fi
  done < <(find "$dl_dir" -type f -iname '*.heic' -print0)
  [[ $heic_count -gt 0 ]] && echo "  Converted $heic_count HEIC files"

  # ── Convert to WebP (parallel) ────────────────────────────────────────
  echo "  Converting to WebP ($PARALLEL_JOBS parallel)..."

  # Build file list
  find "$dl_dir" -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.tif' -o -iname '*.tiff' \) > /tmp/import_image_list.txt

  # Run conversions in parallel using background jobs
  job_count=0
  while IFS= read -r img; do
    [[ -z "$img" ]] && continue
    (
      filename=$(basename "$img")
      name="${filename%.*}"
      mogrify -auto-orient "$img" 2>/dev/null
      cwebp -q 80 -resize 2000 0 -metadata none "$img" -o "${full_dir}/${name}.webp" 2>/dev/null
      cwebp -q 80 -resize 400 0 -metadata none "$img" -o "${thumb_dir}/${name}.webp" 2>/dev/null
    ) &
    job_count=$((job_count + 1))
    # Throttle: wait when we hit the parallel limit
    if [[ $((job_count % PARALLEL_JOBS)) -eq 0 ]]; then
      wait
    fi
  done < /tmp/import_image_list.txt
  wait

  conv_count=$(ls "$full_dir"/*.webp 2>/dev/null | wc -l | tr -d ' ')
  echo "  Converted $conv_count images"

  # ── Upload to R2 ─────────────────────────────────────────────────────
  if [[ "$SKIP_UPLOAD" == "false" ]]; then
    echo "  Uploading to R2..."
    rclone copy "$full_dir"  "${R2_REMOTE}/galleries/${slug}/full/"  --transfers "$PARALLEL_JOBS" --progress 2>&1 | tail -1
    rclone copy "$thumb_dir" "${R2_REMOTE}/galleries/${slug}/thumb/" --transfers "$PARALLEL_JOBS" --progress 2>&1 | tail -1
    echo "  Upload complete"
  else
    echo "  [skip-upload] Skipping R2 upload"
  fi

  # ── Generate manifest ────────────────────────────────────────────────
  echo "  Generating manifest..."
  manifest="["
  first=true
  for webp in "$full_dir"/*.webp; do
    [[ -f "$webp" ]] || continue
    fname=$(basename "$webp")
    dims=$(identify -format '%wx%h' "$webp" 2>/dev/null || echo "0x0")
    w=$(echo "$dims" | cut -dx -f1)
    h=$(echo "$dims" | cut -dx -f2)
    full_url="${R2_PUBLIC_URL}/galleries/${slug}/full/${fname}"
    thumb_url="${R2_PUBLIC_URL}/galleries/${slug}/thumb/${fname}"

    if [[ "$first" == "true" ]]; then
      first=false
    else
      manifest+=","
    fi
    manifest+="{\"filename\":\"$fname\",\"width\":$w,\"height\":$h,\"fullUrl\":\"$full_url\",\"thumbUrl\":\"$thumb_url\"}"
  done
  manifest+="]"

  photo_count=$(echo "$manifest" | python3 -c "import sys,json; print(len(json.loads(sys.stdin.read())))" 2>/dev/null || echo "0")

  # ── Pick cover image (first alphabetically) ──────────────────────────
  cover_file=$(ls "$full_dir"/*.webp 2>/dev/null | sort | head -1)
  cover_url=""
  if [[ -n "$cover_file" ]]; then
    cover_fname=$(basename "$cover_file")
    cover_url="${R2_PUBLIC_URL}/galleries/${slug}/full/${cover_fname}"
  fi

  # ── Write gallery YAML ───────────────────────────────────────────────
  echo "  Writing $yaml_file"

  # Escape single quotes for YAML (double them: ' → '')
  yaml_title="${title//\'/\'\'}"
  yaml_cover="${cover_url//\'/\'\'}"
  yaml_manifest=$(echo "$manifest" | python3 -c "import sys,json; m=json.dumps(json.loads(sys.stdin.read()),separators=(',',':')); print(m.replace(\"'\",\"''\"))" 2>/dev/null || echo "$manifest")

  cat > "$yaml_file" <<YAML
title_en: '${yaml_title}'
title_zh: ''
title_zhtw: ''
date: '${date}'
cover_image: '${yaml_cover}'
r2_folder: galleries/${slug}
photo_manifest: '${yaml_manifest}'
YAML

  echo "  Done: $photo_count photos"
  echo ""

  # Clean up originals to save disk space (keep WebP for re-runs)
  rm -rf "$dl_dir"

done <<< "$FOLDERS"

echo "=== Import complete! ==="
echo ""
echo "Next steps:"
echo "1. Review content/galleries/*.yaml files"
echo "2. Commit and push — the translate workflow will fill in Chinese titles"
echo "3. The deploy workflow will publish the galleries"
