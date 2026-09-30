#!/bin/bash
# Upload webp images to GHL media library and attach to products

PIT="pit-94c2fa45-c71d-4965-a118-0324290907e6"
LOC="9Xlh2V4MI9gfWXNitjME"
BASE="https://services.leadconnectorhq.com"
WEBP_DIR="/Users/Ever/Documents/Websites/FJ_Solar/images/webp"

# Product IDs from product-ids.json
declare -A PRODUCTS=(
  ["auto-gen-start-onboard"]="6ab165ec791299e19f54c8e8"
  ["multiplus-fan-kit"]="6ab165f5c21f7bc9a548c123"
  ["auto-gen-start-portable"]="6ab165fd791299e19f54cb32"
  ["ve-direct-cable"]="6ab165ff2bfb4e37de1ae17e"
  ["victron-cerbo-gx-mk2"]="6ab16601a66feb9159747e73"
  ["victron-smartshunt-500a"]="6ab166031277448b610380ea"
  ["victron-gx-touch"]="6ab16605ee6899ed6263898e"
  ["victron-bmv-712"]="6ab16607ee6899ed626389cb"
)

# Upload a single image, return JSON with fileId and url
upload_image() {
  local filepath="$1"
  local filename=$(basename "$filepath")

  curl -s -X POST "${BASE}/medias/upload-file" \
    -H "Authorization: Bearer ${PIT}" \
    -H "Version: 2021-07-28" \
    -H "Accept: application/json" \
    -F "file=@${filepath};type=image/webp" \
    -F "locationId=${LOC}" \
    -F "name=${filename}"
}

# Group images by product prefix and upload
echo "=== Uploading WebP images to GHL ==="
echo ""

# Track uploads per product: product_key -> "id1:url1|id2:url2|..."
declare -A PRODUCT_MEDIA

for webp in "${WEBP_DIR}"/*.webp; do
  filename=$(basename "$webp" .webp)

  # Extract product key (everything before the last -N number, or the full name)
  if [[ "$filename" =~ ^(.+)-[0-9]+$ ]]; then
    product_key="${BASH_REMATCH[1]}"
  else
    product_key="$filename"
  fi

  echo "Uploading: ${filename}.webp → product: ${product_key}"

  result=$(upload_image "$webp")
  file_id=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('fileId',''))" 2>/dev/null)
  file_url=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('url',''))" 2>/dev/null)

  if [ -n "$file_id" ] && [ -n "$file_url" ]; then
    echo "  ✓ ${file_id}"
    if [ -n "${PRODUCT_MEDIA[$product_key]}" ]; then
      PRODUCT_MEDIA[$product_key]="${PRODUCT_MEDIA[$product_key]}|${file_id}:${file_url}"
    else
      PRODUCT_MEDIA[$product_key]="${file_id}:${file_url}"
    fi
  else
    echo "  ✗ Upload failed: $result"
  fi

  sleep 0.5
done

echo ""
echo "=== Attaching images to products ==="
echo ""

for product_key in "${!PRODUCTS[@]}"; do
  product_id="${PRODUCTS[$product_key]}"
  media_str="${PRODUCT_MEDIA[$product_key]}"

  if [ -z "$media_str" ]; then
    echo "✗ ${product_key} — no images uploaded"
    continue
  fi

  # Build medias JSON array
  medias="["
  first_url=""
  first=true
  IFS='|' read -ra PAIRS <<< "$media_str"
  for pair in "${PAIRS[@]}"; do
    IFS=':' read -r mid murl <<< "$pair"
    if [ "$first" = true ]; then
      first_url="$murl"
      medias="${medias}{\"id\":\"${mid}\",\"type\":\"image\",\"url\":\"${murl}\",\"isFeatured\":true}"
      first=false
    else
      medias="${medias},{\"id\":\"${mid}\",\"type\":\"image\",\"url\":\"${murl}\",\"isFeatured\":false}"
    fi
  done
  medias="${medias}]"

  # Update product with medias
  update_result=$(curl -s -X PUT "${BASE}/products/${product_id}" \
    -H "Authorization: Bearer ${PIT}" \
    -H "Content-Type: application/json" \
    -H "Version: 2021-07-28" \
    -H "Accept: application/json" \
    -d "{\"locationId\":\"${LOC}\",\"productType\":\"PHYSICAL\",\"image\":\"${first_url}\",\"medias\":${medias}}")

  update_status=$(echo "$update_result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('_id','FAILED'))" 2>/dev/null)

  if [ "$update_status" != "FAILED" ]; then
    echo "✓ ${product_key} → ${#PAIRS[@]} image(s) attached"
  else
    echo "✗ ${product_key} — update failed: $update_result"
  fi

  sleep 0.3
done

echo ""
echo "=== Done ==="
