#!/bin/bash
# sync.sh — copia field_rules.js y role_fields.js a los repos que los usan.
#   ./sync.sh          escribe las copias (cabecera «COPIA… no editar aquí»)
#   ./sync.sh --check  compara; sale con error si alguna copia falta o difiere
# Navegador → .js tal cual (+ cabecera; phone_input.js es solo navegador). Servidores (Workers) → .mjs: mismo texto + `export default`.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
DEV="${FR_DEV:-$(cd "$HERE/../.." && pwd)}"   # FR_DEV: raíz alterna (worktrees) para probar antes de publicar
MODE="${1:-write}"

# destino | fuente | global
TARGETS=(
  "base-desktop/modules/field_rules.js|field_rules|FieldRules"
  "base-server/worker/field_rules.mjs|field_rules|FieldRules"
  "cima-desktop/app/ui/field_rules.js|field_rules|FieldRules"
  "cima-server/field_rules.mjs|field_rules|FieldRules"
  "cima-landing/app/landing/field_rules.js|field_rules|FieldRules"
  "cima-ventas-worker/field_rules.mjs|field_rules|FieldRules"
  "base-desktop/modules/role_fields.js|role_fields|RoleFields"
  "base-server/worker/role_fields.mjs|role_fields|RoleFields"
  "cima-desktop/app/ui/role_fields.js|role_fields|RoleFields"
  "cima-server/role_fields.mjs|role_fields|RoleFields"
  "cima-desktop/app/ui/phone_input.js|phone_input|PhoneInput"
  "base-desktop/modules/phone_input.js|phone_input|PhoneInput"
  "cima-landing/app/landing/phone_input.js|phone_input|PhoneInput"
)

render() { # fuente global destino → stdout
  local src="$HERE/$1.js" glob="$2" dest="$3"
  echo "/* COPIA de tools/field-rules/$1.js — no editar aquí. Edita la fuente y corre tools/field-rules/sync.sh */"
  cat "$src"
  case "$dest" in *.mjs) printf '\nexport default globalThis.%s;\n' "$glob";; esac
}

bad=0
for t in "${TARGETS[@]}"; do
  IFS='|' read -r dest src glob <<<"$t"
  full="$DEV/$dest"
  if [ "$MODE" = "--check" ]; then
    if [ ! -f "$full" ]; then echo "FALTA  $dest"; bad=1
    elif [ "$(render "$src" "$glob" "$dest" | md5 -q)" != "$(md5 -q "$full")" ]; then echo "DIFIERE $dest"; bad=1
    else echo "OK     $dest"; fi
  else
    mkdir -p "$(dirname "$full")"
    render "$src" "$glob" "$dest" > "$full"
    echo "copiado $dest"
  fi
done
[ "$MODE" = "--check" ] && { [ $bad = 0 ] && echo "TODAS LAS COPIAS COINCIDEN" || { echo "HAY COPIAS DISTINTAS"; exit 1; }; }
exit 0
