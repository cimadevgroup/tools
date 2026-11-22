#!/bin/bash
# sync.sh — copia las fuentes de tools/i18n (i18n.js, format.js, glosario.md) a los repos que las usan.
#   ./sync.sh                         escribe TODAS las copias
#   ./sync.sh --repo NOMBRE           solo ese repo
#   ./sync.sh --check [--repo NOMBRE] compara sin escribir; sale con 1 si una copia FALTA, DIFIERE o hay una copia FUERA DE LISTA
#   ./sync.sh --check --repo N --dir RUTA  compara/escribe contra RUTA (worktree o carpeta de deploy), no contra el checkout principal
#   ./sync.sh --list                  repos y destinos
# Cada app conserva SU en.js y SU verificador tools/i18n-check.mjs: aquí solo viven el motor, el formateo y el glosario.
# Configuración por app (sin bifurcar): window.CIMA_I18N = { defaultLang: 'es', keyPrefix: 'vc_' } definida ANTES de cargar i18n.js.
# Cabecera: «COPIA … VERSION x sha256:… no editar» (comentario /* */ en .js y <!-- --> en .md).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
DEV="${FR_DEV:-$(cd "$HERE/../../.." && pwd)}"   # FR_DEV: raíz alterna (worktrees) para probar antes de publicar
VER="$(head -1 "$HERE/VERSION" | tr -d '[:space:]')"
MODE=write; ONLY=""; DIROVR=""
while [ $# -gt 0 ]; do case "$1" in
  --check) MODE=check;; --list) MODE=list;; --repo) shift; ONLY="${1:-}";; --dir) shift; DIROVR="${1:-}";; *) echo "argumento desconocido: $1" >&2; exit 2;; esac; shift; done

# repo | ruta del repo | carpeta de las copias | fuentes (archivos con extensión)
REPOS=(
  "cima-desktop|cima/cima-desktop|app/i18n|i18n.js format.js glosario.md"
  "cima-mobile|cima/cima-mobile|app/i18n|i18n.js format.js glosario.md"
  "myvitalcase|cima/myvitalcase|app/i18n|i18n.js format.js glosario.md"
)
sha_of() { shasum -a 256 "$HERE/$1" | cut -d' ' -f1; }

render() { # fuente → stdout
  local f="$1" h="COPIA de tools/i18n/$1 · VERSION $VER · sha256:$(sha_of "$1") — no editar aquí. Edita la fuente y corre tools/i18n/sync.sh"
  case "$f" in
    *.md) printf '<!-- %s -->\n' "$h";;
    *)    printf '/* %s */\n' "$h";;
  esac
  cat "$HERE/$f"
}

bad=0
note() { echo "$1"; case "$1" in OK*|copiado*) ;; *) bad=1;; esac; }

for entry in "${REPOS[@]}"; do
  IFS='|' read -r name path dir srcs <<<"$entry"
  [ -n "$ONLY" ] && [ "$ONLY" != "$name" ] && continue
  if [ "$MODE" = list ]; then for s in $srcs; do echo "$name  $path/$dir/$s"; done; continue; fi
  root="$DEV/$path"; [ -n "$DIROVR" ] && [ -n "$ONLY" ] && root="$DIROVR"
  [ -d "$root" ] || { note "FALTA  repo $path"; continue; }
  want=""
  for s in $srcs; do
    rel="$dir/$s"; want="$want $rel"; full="$root/$rel"
    if [ "$MODE" = check ]; then
      if [ ! -f "$full" ]; then note "FALTA   $name/$rel"
      elif ! diff -q <(render "$s") "$full" >/dev/null; then note "DIFIERE $name/$rel"
      else note "OK      $name/$rel"; fi
    else mkdir -p "$(dirname "$full")"; render "$s" > "$full"; note "copiado $name/$rel"; fi
  done
  # copias FUERA DE LISTA: archivos rastreados con nombre de fuente en una carpeta i18n/ que este repo no declara
  if git -C "$root" rev-parse >/dev/null 2>&1; then
    while IFS= read -r f; do
      case " $want " in *" $f "*) ;; *) note "FUERA DE LISTA $name/$f (copia no declarada en sync.sh)";; esac
    done < <(git -C "$root" ls-files | grep -E '(^|/)i18n/(i18n\.js|format\.js|glosario\.md)$')
  fi
done
[ "$MODE" = check ] && { [ $bad = 0 ] && echo "TODO COINCIDE (copias de i18n)" || { echo "HAY DIFERENCIAS: corre tools/i18n/sync.sh (nunca edites una copia)"; exit 1; }; }
exit 0
