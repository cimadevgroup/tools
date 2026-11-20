#!/usr/bin/env bash
# Publica un proyecto de Cloudflare Pages desde su repo, sin subir basura.
#
# Sube SOLO lo que git rastrea (git archive), asi que node_modules, native/ios,
# native/android y cualquier archivo local sin commitear quedan fuera por
# construccion, no por una lista de exclusiones que hay que mantener.
#
#   ./pages-deploy.sh cima-movil            publica
#   ./pages-deploy.sh cima-movil --dry-run  arma el paquete y lo describe, no publica
set -euo pipefail

DEV="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROJECT="${1:-}"
DRY="${2:-}"

# proyecto de Pages -> repo local. Los que no estan aqui no se publican con esto.
case "$PROJECT" in
  cima-movil)   REPO="cima/cima-mobile"   ; DOMAIN="m.appcima.com"       ;;
  cima-lite)    REPO="archivo/cima-lite"    ; DOMAIN="lite.appcima.com"    ;;
  cima-patient) REPO="cima/cima-patient" ; DOMAIN="patient.appcima.com" ;;
  cima-viewer)  REPO="cima/cima-viewer"  ; DOMAIN="viewer.appcima.com"  ;;
  cima-verify)  REPO="cima/cima-verify"  ; DOMAIN="verify.appcima.com"  ;;
  cima-ventas)  REPO="cima/cima-crm"     ; DOMAIN="ventas.appcima.com"  ;;
  cima|sima-cima)
    echo "ERROR: '$PROJECT' tiene Git conectado en Pages y se despliega solo con git push." >&2
    echo "       Publicarlo a mano crearia un deployment que el proximo push pisa." >&2
    exit 1 ;;
  pawstravel|tina-viaje|dominadas|neuralove)
    echo "ERROR: '$PROJECT' no es del ecosistema CIMA. No se toca desde aqui." >&2
    exit 1 ;;
  *)
    echo "uso: pages-deploy.sh <cima-movil|cima-lite|cima-patient|cima-viewer|cima-verify|cima-ventas> [--dry-run]" >&2
    exit 1 ;;
esac

SRC="$DEV/$REPO"
[ -d "$SRC/.git" ] || { echo "ERROR: $SRC no es un repo git." >&2; exit 1; }

# Candado de CAMPOS (plan-estandar-campos): las copias de FieldRules/FieldFormat del repo deben coincidir con la fuente.
"$(dirname "${BASH_SOURCE[0]}")/field-rules/check-campos.sh" "$(basename "$REPO")" || exit 1

# Avisa si hay trabajo sin commitear: git archive NO lo subiria y el deploy
# saldria distinto de lo que el autor ve en su carpeta.
DIRTY="$(git -C "$SRC" status --porcelain | wc -l | tr -d ' ')"
if [ "$DIRTY" != "0" ]; then
  echo "AVISO: $REPO tiene $DIRTY archivo(s) sin commitear. NO van a publicarse:"
  git -C "$SRC" status --porcelain | sed 's/^/       /'
  echo
fi

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
git -C "$SRC" archive HEAD | tar -x -C "$STAGE"

# native/ tiene 5 archivos commiteados (capacitor, package.json del wrapper).
# No son peligrosos pero no pintan nada servidos en el dominio publico.
rm -rf "$STAGE/native"

FILES="$(find "$STAGE" -type f | wc -l | tr -d ' ')"
echo "$PROJECT <- $REPO @ $(git -C "$SRC" rev-parse --short HEAD)"
echo "  $FILES archivos, $(du -sh "$STAGE" | cut -f1)"

if [ "$DRY" = "--dry-run" ]; then
  echo "  --dry-run: no se publica. Raiz del paquete:"
  ls -1 "$STAGE" | sed 's/^/    /'
  exit 0
fi

npx --yes wrangler pages deploy "$STAGE" --project-name "$PROJECT" --branch main --commit-dirty=true

echo
echo "Verificacion en vivo de $DOMAIN (cache-buster para no leer una copia vieja):"
sleep 6
curl -s -o /dev/null -w "  index: HTTP %{http_code}, %{size_download} bytes\n" "https://$DOMAIN/?nc=$RANDOM"
echo "  assets versionados que sirve ahora:"
curl -s "https://$DOMAIN/?nc=$RANDOM" | grep -oE '[a-z_]+\.js\?v=[0-9a-z]+' | sort -u | sed 's/^/    /'
echo
echo "Un 200 en una ruta inexistente puede ser el catch-all del SPA, no el archivo."
echo "Para probar que algo NO subio, mira el CUERPO, no el codigo."
