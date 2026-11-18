#!/bin/bash
# sync.sh — copia las banderas (4x3/ + LICENSE + ORIGEN.md) a los repos que las usan. Mismo mecanismo que field-rules.
#   ./sync.sh          escribe las copias (con COPIA.txt «no editar aquí»)
#   ./sync.sh --check  compara; sale con error si alguna copia falta o difiere
# FR_DEV: raíz alterna (p. ej. para escribir en un worktree antes de publicar).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
DEV="${FR_DEV:-$(cd "$HERE/../../.." && pwd)}"
MODE="${1:-write}"
# destino (carpeta, relativa a la raíz de dev). Cada repo agrega aquí el suyo.
TARGETS=(
  "base/base-desktop/vendor/flag-icons"
  "cima/cima-desktop/app/vendor/flag-icons"
)
sumdir() { (cd "$1" 2>/dev/null && find 4x3 LICENSE ORIGEN.md -type f 2>/dev/null | LC_ALL=C sort | xargs md5 -q 2>/dev/null | md5 -q); }
bad=0
for dest in "${TARGETS[@]}"; do
  full="$DEV/$dest"
  if [ "$MODE" = "--check" ]; then
    if [ ! -d "$full/4x3" ]; then echo "FALTA   $dest"; bad=1
    elif [ "$(sumdir "$HERE")" != "$(sumdir "$full")" ]; then echo "DIFIERE $dest"; bad=1
    else echo "OK      $dest"; fi
  else
    mkdir -p "$full"
    rm -rf "$full/4x3"
    cp -R "$HERE/4x3" "$HERE/LICENSE" "$HERE/ORIGEN.md" "$full/"
    printf 'COPIA de tools/flag-icons — no editar aquí. Edita la fuente y corre tools/flag-icons/sync.sh\n' > "$full/COPIA.txt"
    rm -f "$full/README.txt"
    echo "copiado $dest ($(ls "$full/4x3" | wc -l | tr -d ' ') banderas)"
  fi
done
[ "$MODE" = "--check" ] && { [ $bad = 0 ] && echo "TODAS LAS COPIAS COINCIDEN" || { echo "HAY COPIAS DISTINTAS"; exit 1; }; }
exit 0
