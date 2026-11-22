#!/bin/bash
# sync.sh — copia las fuentes de tools/contact (contact.js, contact.css) a los repos que las usan.
#   ./sync.sh                         escribe TODAS las copias
#   ./sync.sh --repo NOMBRE           solo ese repo
#   ./sync.sh --check [--repo NOMBRE] compara sin escribir; sale con 1 si una copia FALTA, DIFIERE o hay una copia FUERA DE LISTA
#   ./sync.sh --check --repo N --dir RUTA  compara/escribe contra RUTA (worktree o carpeta de deploy), no contra el checkout principal
#   ./sync.sh --list                  repos y destinos
# Configuración por app (sin bifurcar): CimaContact.linkHandler = (phone, name) => … para conectar su «Link».
# Cabecera: «COPIA … VERSION x sha256:… no editar». Para sumar una app: una fila más en REPOS por carpeta de destino.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
DEV="${FR_DEV:-$(cd "$HERE/../../.." && pwd)}"   # FR_DEV: raíz alterna (worktrees) para probar antes de publicar
VER="$(head -1 "$HERE/VERSION" | tr -d '[:space:]')"
MODE=write; ONLY=""; DIROVR=""
while [ $# -gt 0 ]; do case "$1" in
  --check) MODE=check;; --list) MODE=list;; --repo) shift; ONLY="${1:-}";; --dir) shift; DIROVR="${1:-}";; *) echo "argumento desconocido: $1" >&2; exit 2;; esac; shift; done

# repo | ruta del repo | carpeta de las copias | fuentes (archivos con extensión)
REPOS=(
  "base-desktop|base/base-desktop|modules|contact.js"
  "base-desktop|base/base-desktop|style|contact.css"
)
sha_of() { shasum -a 256 "$HERE/$1" | cut -d' ' -f1; }
render() { # fuente → stdout
  printf '/* COPIA de tools/contact/%s · VERSION %s · sha256:%s — no editar aquí. Edita la fuente y corre tools/contact/sync.sh */\n' "$1" "$VER" "$(sha_of "$1")"
  cat "$HERE/$1"
}

bad=0
note() { echo "$1"; case "$1" in OK*|copiado*) ;; *) bad=1;; esac; }
declare -a DONE_REPOS=()
for entry in "${REPOS[@]}"; do
  IFS='|' read -r name path dir srcs <<<"$entry"
  [ -n "$ONLY" ] && [ "$ONLY" != "$name" ] && continue
  if [ "$MODE" = list ]; then for s in $srcs; do echo "$name  $path/$dir/$s"; done; continue; fi
  root="$DEV/$path"; [ -n "$DIROVR" ] && [ -n "$ONLY" ] && root="$DIROVR"
  [ -d "$root" ] || { note "FALTA  repo $path"; continue; }
  for s in $srcs; do
    rel="$dir/$s"; full="$root/$rel"
    if [ "$MODE" = check ]; then
      if [ ! -f "$full" ]; then note "FALTA   $name/$rel"
      elif ! diff -q <(render "$s") "$full" >/dev/null; then note "DIFIERE $name/$rel"
      else note "OK      $name/$rel"; fi
    else mkdir -p "$(dirname "$full")"; render "$s" > "$full"; note "copiado $name/$rel"; fi
  done
  # copias FUERA DE LISTA (una vez por repo): archivos rastreados cuya cabecera dice «COPIA de tools/contact/» y que no están declarados
  case " ${DONE_REPOS[*]-} " in *" $path "*) continue;; esac
  DONE_REPOS+=("$path")
  want=""
  for e2 in "${REPOS[@]}"; do IFS='|' read -r n2 p2 d2 s2 <<<"$e2"; [ "$p2" = "$path" ] && for t in $s2; do want="$want $d2/$t"; done; done
  if git -C "$root" rev-parse >/dev/null 2>&1; then
    while IFS= read -r f; do
      head -1 "$root/$f" 2>/dev/null | grep -q 'COPIA de tools/contact/' || continue
      case " $want " in *" $f "*) ;; *) note "FUERA DE LISTA $name/$f (copia no declarada en sync.sh)";; esac
    done < <(git -C "$root" ls-files | grep -E '(^|/)contact\.(js|css)$')
  fi
done
[ "$MODE" = check ] && { [ $bad = 0 ] && echo "TODO COINCIDE (copias de contact)" || { echo "HAY DIFERENCIAS: corre tools/contact/sync.sh (nunca edites una copia)"; exit 1; }; }
exit 0
