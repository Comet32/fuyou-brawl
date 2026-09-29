#!/bin/sh
# Record the origin of every shipped raster (sourced assets, none are generated).
# Re-run after `npm run import` or the "Fetch Dota assets" workflow refreshes images.
# Usage: sh tools/embed-provenance.sh [path-to-impeccable-launcher]
set -eu
IMP="${1:-impeccable}"
CDN="https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react"
WORKSHOP="https://steamcommunity.com/sharedfiles/filedetails/?id=2841152696"

for f in public/img/blessings/*.webp; do
  id=$(basename "$f" .webp)
  "$IMP" embed-prompt "$f" --prompt "Sourced asset, not generated. Origin: 福佑大乱斗 workshop VPK ($WORKSHOP), resource/flash3/images/spellicons/buff/bless/$id.png, converted to 96px WebP by scripts/import-vpk.ts. Rights belong to the custom game's authors." >/dev/null
done
for f in public/img/heroes/*.webp; do
  id=$(basename "$f" .webp)
  "$IMP" embed-prompt "$f" --prompt "Sourced asset, not generated. Origin: Valve Dota 2 CDN $CDN/heroes/$id.png, converted to WebP by scripts/fetch-dota-assets.ts. © Valve Corporation." >/dev/null
done
for f in public/img/heroes/thumb/*.webp; do
  id=$(basename "$f" .webp)
  "$IMP" embed-prompt "$f" --prompt "Sourced asset, not generated. Origin: Valve Dota 2 CDN $CDN/heroes/$id.png, 128px grid thumbnail made by tools/hero-thumbs.ts (from public/img/heroes/$id.webp) or scripts/fetch-dota-assets.ts (from the PNG). © Valve Corporation." >/dev/null
done
for f in public/img/items/*.webp; do
  id=$(basename "$f" .webp)
  "$IMP" embed-prompt "$f" --prompt "Sourced asset, not generated. Origin: Valve Dota 2 CDN $CDN/items/$id.png, converted to WebP by scripts/fetch-dota-assets.ts. © Valve Corporation." >/dev/null
done
"$IMP" embed-prompt --scan public/img/blessings public/img/heroes public/img/heroes/thumb public/img/items | tail -1
