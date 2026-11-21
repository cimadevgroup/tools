#!/bin/bash
# sync.sh — copia las fuentes de tools/field-rules a los repos que las usan y mantiene el bloque de CLAUDE.md.
#   ./sync.sh                         escribe TODAS las copias, el bloque CAMPOS de cada CLAUDE.md y .githooks/pre-commit
#   ./sync.sh --repo NOMBRE           solo ese repo
#   ./sync.sh --check [--repo NOMBRE] compara sin escribir; sale con 1 si una copia FALTA, DIFIERE, hay una copia FUERA DE LISTA
#                                     o el bloque CAMPOS del CLAUDE.md falta o difiere
#   ./sync.sh --claude-only [--repo N] solo reescribe el bloque de CLAUDE.md (repos donde CLAUDE.md no se versiona)
#   ./sync.sh --check --repo N --dir RUTA  compara contra RUTA (el directorio desde el que se despliega), no contra el checkout principal
#   ./sync.sh --list                  repos y destinos
# Navegador → .js (+ cabecera); servidores (Workers) → .mjs: mismo texto + `export default`. Cabecera: «COPIA … VERSION x sha256:… no editar».
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
DEV="${FR_DEV:-$(cd "$HERE/../../.." && pwd)}"   # FR_DEV: raíz alterna (worktrees) para probar antes de publicar
VER="$(head -1 "$HERE/VERSION" | tr -d '[:space:]')"
MODE=write; ONLY=""; CLAUDE_ONLY=""; DIROVR=""
while [ $# -gt 0 ]; do case "$1" in
  --check) MODE=check;; --list) MODE=list;; --claude-only) CLAUDE_ONLY=1;; --repo) shift; ONLY="${1:-}";; --dir) shift; DIROVR="${1:-}";; *) echo "argumento desconocido: $1" >&2; exit 2;; esac; shift; done

# repo | ruta del repo | carpeta de las copias | fuentes (field_rules field_format role_fields phone_input) | tipo (js navegador | mjs servidor)
REPOS=(
  "cima-desktop|cima/cima-desktop|app/ui|field_rules field_format role_fields phone_input|js"
  "cima-mobile|cima/cima-mobile|app/ui|field_rules field_format|js"
  "cima-patient|cima/cima-patient|app/ui|field_rules field_format|js"
  "cima-landing|cima/cima-landing|app/landing|field_rules field_format phone_input|js"
  "myvitalcase|cima/myvitalcase|app/ui|field_rules field_format|js"
  "cima-server|cima/cima-server|.|field_rules field_format role_fields|mjs"
  "cima-crm-server|cima/cima-crm-server|.|field_rules field_format|mjs"
  "myvitalcase-server|cima/myvitalcase-server|worker|field_rules field_format|mjs"
  "paginas-consultorio|cima/paginas-consultorio|src|field_rules field_format|mjs"
  "base-server|base/base-server|worker|field_rules field_format role_fields|mjs"
  "base-desktop|base/base-desktop|modules|field_rules field_format role_fields phone_input|js"
)
glob_of() { case "$1" in field_rules) echo FieldRules;; field_format) echo FieldFormat;; role_fields) echo RoleFields;; phone_input) echo PhoneInput;; esac; }
sha_of() { shasum -a 256 "$HERE/$1.js" | cut -d' ' -f1; }

render() { # fuente tipo → stdout
  local src="$1" kind="$2"
  echo "/* COPIA de tools/field-rules/$src.js · VERSION $VER · sha256:$(sha_of "$src") — no editar aquí. Edita la fuente y corre tools/field-rules/sync.sh */"
  cat "$HERE/$src.js"
  [ "$kind" = mjs ] && printf '\nexport default globalThis.%s;\n' "$(glob_of "$src")"
  return 0
}
block_text() { printf '<!-- CAMPOS:INICIO -->\n'; cat "$HERE/claude-block.md"; printf '<!-- CAMPOS:FIN -->\n'; }
extract_block() { awk '/<!-- CAMPOS:INICIO -->/{f=1} f{print} /<!-- CAMPOS:FIN -->/{f=0}' "$1"; }
HOOK_SRC="$HERE/hooks/pre-commit"

bad=0
note() { echo "$1"; case "$1" in OK*|copiado*|bloque*|hook*) ;; *) bad=1;; esac; }

for entry in "${REPOS[@]}"; do
  IFS='|' read -r name path dir srcs kind <<<"$entry"
  [ -n "$ONLY" ] && [ "$ONLY" != "$name" ] && continue
  if [ "$MODE" = list ]; then for s in $srcs; do echo "$name  $path/$dir/$s.${kind}"; done; continue; fi
  root="$DEV/$path"; [ -n "$DIROVR" ] && [ -n "$ONLY" ] && root="$DIROVR"   # --dir: comparar contra ESE directorio (worktree o carpeta de deploy), no contra el checkout principal
  [ -d "$root" ] || { note "FALTA  repo $path"; continue; }
  want=""
  for s in $srcs; do
    rel="$dir/$s.$kind"; rel="${rel#./}"; want="$want $rel"
    full="$root/$rel"
    if [ "$MODE" = check ]; then
      if [ ! -f "$full" ]; then note "FALTA   $name/$rel"
      elif ! diff -q <(render "$s" "$kind") "$full" >/dev/null; then note "DIFIERE $name/$rel"
      else note "OK      $name/$rel"; fi
    elif [ -z "$CLAUDE_ONLY" ]; then mkdir -p "$(dirname "$full")"; render "$s" "$kind" > "$full"; note "copiado $name/$rel"; fi
  done
  # copias FUERA DE LISTA: archivos rastreados con nombre de fuente que no están en la lista de este repo
  if git -C "$root" rev-parse >/dev/null 2>&1; then
    while IFS= read -r f; do
      case " $want " in *" $f "*) ;; *) note "FUERA DE LISTA $name/$f (copia no declarada en sync.sh)";; esac
    done < <(git -C "$root" ls-files | grep -E '(^|/)(field_rules|field_format|role_fields|phone_input)\.m?js$')
  fi
  # bloque de CLAUDE.md
  cm="$root/CLAUDE.md"
  if [ "$MODE" = check ]; then
    if [ ! -f "$cm" ] || ! diff -q <(block_text) <(extract_block "$cm") >/dev/null; then note "BLOQUE  $name/CLAUDE.md sin el bloque CAMPOS vigente"; else note "OK      $name/CLAUDE.md (bloque CAMPOS)"; fi
    if [ -f "$HOOK_SRC" ]; then
      if [ ! -f "$root/.githooks/pre-commit" ] || ! diff -q "$HOOK_SRC" "$root/.githooks/pre-commit" >/dev/null; then note "HOOK    $name/.githooks/pre-commit falta o difiere"; else note "OK      $name/.githooks/pre-commit"; fi
    fi
  else
    if [ ! -f "$cm" ]; then printf '# %s\n\n' "$name" > "$cm"; fi
    if grep -q 'CAMPOS:INICIO' "$cm"; then
      python3 - "$cm" "$(block_text)" <<'PY'
import re,sys
p,b=sys.argv[1],sys.argv[2]
s=open(p).read()
s=re.sub(r'<!-- CAMPOS:INICIO -->.*?<!-- CAMPOS:FIN -->',lambda m:b,s,flags=re.S)
open(p,'w').write(s)
PY
    else printf '\n%s\n' "$(block_text)" >> "$cm"; fi
    note "bloque  $name/CLAUDE.md"
    if [ -z "$CLAUDE_ONLY" ] && [ -f "$HOOK_SRC" ]; then mkdir -p "$root/.githooks"; cp "$HOOK_SRC" "$root/.githooks/pre-commit"; chmod +x "$root/.githooks/pre-commit"; note "hook    $name/.githooks/pre-commit"; fi
  fi
done
[ "$MODE" = check ] && { [ $bad = 0 ] && echo "TODO COINCIDE (copias, bloque de CLAUDE.md, hook)" || { echo "HAY DIFERENCIAS: corre tools/field-rules/sync.sh (nunca edites una copia)"; exit 1; }; }
exit 0
