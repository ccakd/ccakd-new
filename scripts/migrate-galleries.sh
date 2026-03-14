#!/bin/bash
# Gallery Migration Script
# Parses WordPress fooGallery DB exports and:
# 1. Downloads images from old WordPress site
# 2. Converts to WebP (full + thumb)
# 3. Uploads to R2 via rclone
# 4. Generates photo manifests
# 5. Creates Keystatic gallery entries
#
# Prerequisites: cwebp, identify (imagemagick), wrangler (authenticated with Cloudflare)
# Usage: ./scripts/migrate-galleries.sh

set -euo pipefail

GALLERIES_CSV="$HOME/Downloads/galleries.csv"
ATTACHMENTS_CSV="$HOME/Downloads/attachments.csv"
WP_BASE_URL="https://www.ccakd.ca/wp-content/uploads"
AZURE_BASE_URL="https://ccakdwordpressmedia.blob.core.windows.net/clouduploads"
R2_REMOTE="r2-ccakd:ccakd-media"
WORK_DIR="/tmp/gallery-migration"
CONTENT_DIR="$(cd "$(dirname "$0")/.." && pwd)/content/galleries"

mkdir -p "$WORK_DIR"

# Build attachment lookup: id -> file_path (file-based, works with macOS bash 3.2)
ATTACH_LOOKUP="$WORK_DIR/.attach_lookup"
> "$ATTACH_LOOKUP"
echo "Building attachment lookup..."
attach_count=0
while IFS=, read -r aid title fpath; do
  fpath="${fpath//$'\r'/}"
  [[ "$aid" == "attachment_id" ]] && continue
  echo "$aid $fpath" >> "$ATTACH_LOOKUP"
  attach_count=$((attach_count + 1))
done < "$ATTACHMENTS_CSV"
echo "Loaded $attach_count attachments"

# Lookup function
get_attach_path() {
  awk -v id="$1" '$1 == id { print $2; exit }' "$ATTACH_LOOKUP"
}

# Parse PHP serialized array to extract IDs
parse_ids() {
  echo "$1" | grep -oE '"[0-9]+"' | tr -d '"'
}

# Process each gallery
tail -n +2 "$GALLERIES_CSV" | tr -d '\r' | while IFS= read -r line; do
  # Parse CSV (handle commas in serialized data)
  gallery_id=$(echo "$line" | cut -d, -f1)
  gallery_title=$(echo "$line" | cut -d, -f2)
  gallery_slug=$(echo "$line" | cut -d, -f3)
  gallery_date=$(echo "$line" | cut -d, -f4 | cut -d' ' -f1)
  serialized=$(echo "$line" | cut -d, -f5-)

  echo ""

  # Skip galleries already on the new site
  if [[ "$gallery_slug" == "2026-new-year-celebration-gallery" || "$gallery_slug" == "2025-new-year-celebration" ]]; then
    echo "=== SKIPPING (already migrated): $gallery_title ==="
    continue
  fi

  echo "=== Processing: $gallery_title (slug: $gallery_slug, date: $gallery_date) ==="

  # Parse attachment IDs from serialized PHP array
  ids=($(parse_ids "$serialized"))
  echo "  Found ${#ids[@]} images"

  # Create work directories
  dl_dir="$WORK_DIR/$gallery_slug/originals"
  full_dir="$WORK_DIR/$gallery_slug/full"
  thumb_dir="$WORK_DIR/$gallery_slug/thumb"
  mkdir -p "$dl_dir" "$full_dir" "$thumb_dir"

  # Download images
  echo "  Downloading..."
  dl_count=0
  for id in "${ids[@]}"; do
    fpath="$(get_attach_path "$id")"
    if [[ -z "$fpath" ]]; then
      echo "    WARNING: No file path for attachment $id, skipping"
      continue
    fi
    filename=$(basename "$fpath")
    outfile="$dl_dir/$filename"
    if [[ -f "$outfile" ]]; then
      dl_count=$((dl_count + 1))
      continue
    fi
    # Try WordPress first, then Azure (cutover happened around 2025/09)
    wp_url="$WP_BASE_URL/$fpath"
    azure_url="$AZURE_BASE_URL/$fpath"
    if curl -sfL "$wp_url" -o "$outfile" 2>/dev/null; then
      dl_count=$((dl_count + 1))
    elif curl -sfL "$azure_url" -o "$outfile" 2>/dev/null; then
      dl_count=$((dl_count + 1))
    else
      echo "    FAILED both URLs for: $fpath"
    fi
  done
  echo "  Downloaded $dl_count/${#ids[@]} images"

  # Convert to WebP
  echo "  Converting to WebP..."
  conv_count=0
  for img in "$dl_dir"/*; do
    [[ -f "$img" ]] || continue
    base=$(basename "$img")
    name="${base%.*}"
    webp_full="$full_dir/${name}.webp"
    webp_thumb="$thumb_dir/${name}.webp"

    if [[ ! -f "$webp_full" ]]; then
      cwebp -q 80 -resize 2000 0 -metadata none "$img" -o "$webp_full" 2>/dev/null && conv_count=$((conv_count + 1)) || echo "    FAILED convert: $base"
    else
      conv_count=$((conv_count + 1))
    fi

    if [[ ! -f "$webp_thumb" ]]; then
      cwebp -q 80 -resize 400 0 -metadata none "$img" -o "$webp_thumb" 2>/dev/null || true
    fi
  done
  echo "  Converted $conv_count images"

  # Upload to R2 via wrangler (parallel)
  echo "  Uploading to R2..."
  upload_full() {
    local webp="$1" slug="$2"
    local fname=$(basename "$webp")
    npx wrangler r2 object put "ccakd-media/galleries/$slug/full/$fname" --file "$webp" --content-type "image/webp" --remote 2>/dev/null
  }
  upload_thumb() {
    local webp="$1" slug="$2"
    local fname=$(basename "$webp")
    npx wrangler r2 object put "ccakd-media/galleries/$slug/thumb/$fname" --file "$webp" --content-type "image/webp" --remote 2>/dev/null
  }
  export -f upload_full upload_thumb

  # Run up to 8 uploads in parallel using xargs
  ls "$full_dir"/*.webp 2>/dev/null | xargs -P 20 -I {} bash -c 'upload_full "$1" "$2"' _ {} "$gallery_slug"
  ls "$thumb_dir"/*.webp 2>/dev/null | xargs -P 20 -I {} bash -c 'upload_thumb "$1" "$2"' _ {} "$gallery_slug"
  echo "  Upload complete"

  # Generate manifest
  echo "  Generating manifest..."
  manifest="["
  first=true
  for webp in "$full_dir"/*.webp; do
    [[ -f "$webp" ]] || continue
    fname=$(basename "$webp")
    dims=$(identify -format '%wx%h' "$webp" 2>/dev/null || echo "0x0")
    w=$(echo "$dims" | cut -dx -f1)
    h=$(echo "$dims" | cut -dx -f2)
    full_url="https://media.ccakd.ca/galleries/$gallery_slug/full/$fname"
    thumb_url="https://media.ccakd.ca/galleries/$gallery_slug/thumb/$fname"

    if [[ "$first" == "true" ]]; then
      first=false
    else
      manifest+=","
    fi
    manifest+="{\"filename\":\"$fname\",\"width\":$w,\"height\":$h,\"fullUrl\":\"$full_url\",\"thumbUrl\":\"$thumb_url\"}"
  done
  manifest+="]"

  # Pick cover image (first image)
  cover_file=$(ls "$full_dir"/*.webp 2>/dev/null | head -1)
  cover_fname=""
  if [[ -n "$cover_file" ]]; then
    cover_fname=$(basename "$cover_file")
  fi

  # Create Keystatic YAML
  echo "  Creating Keystatic entry..."

  # Remove existing entry if present
  rm -f "$CONTENT_DIR/$gallery_slug.yaml"

  cat > "$CONTENT_DIR/$gallery_slug.yaml" <<YAML
title_en: $gallery_slug
title_zh: ''
title_zhtw: ''
date: '$gallery_date'
cover_image: /images/galleries/${cover_fname}
r2_folder: galleries/$gallery_slug
photo_manifest: |
  $(echo "$manifest" | python3 -c "import sys,json; print(json.dumps(json.loads(sys.stdin.read()), indent=2))" 2>/dev/null || echo "$manifest")
YAML

  # Download cover image locally for the gallery card
  if [[ -n "$cover_fname" ]]; then
    mkdir -p "$(cd "$(dirname "$0")/.." && pwd)/public/images/galleries"
    cp "$full_dir/$cover_fname" "$(cd "$(dirname "$0")/.." && pwd)/public/images/galleries/$cover_fname" 2>/dev/null || true
  fi

  echo "  Done: $gallery_title (${#ids[@]} photos)"
done

echo ""
echo "=== Migration complete! ==="
echo "Next steps:"
echo "1. Review content/galleries/*.yaml files"
echo "2. Add Chinese translations for gallery titles"
echo "3. Run 'npm run build' to test"
echo "4. Commit and push"
