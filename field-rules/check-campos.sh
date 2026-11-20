#!/bin/bash
# check-campos.sh REPO [DIR] — candado de despliegue. Por defecto SOLO AVISA (exit 0); bloquea solo con CAMPOS_ESTRICTO=1.
# Compara contra DIR; sin DIR, contra la raíz git del directorio desde el que se corre (cwd o worktree), nunca contra el checkout
# principal de otra sesión. Si no hay repo en cwd, no compara y avisa. Sin sync.sh (build en la nube) se omite.
HERE="$(cd "$(dirname "$0")" && pwd)"
[ -x "$HERE/sync.sh" ] || { echo "check-campos: sync.sh no disponible, omitido" >&2; exit 0; }
DIR="${2:-}"
[ -n "$DIR" ] || DIR="$(git rev-parse --show-toplevel 2>/dev/null)"
[ -n "$DIR" ] && [ -d "$DIR" ] || { echo "check-campos: no hay directorio de $1 contra el cual comparar, omitido" >&2; exit 0; }
out="$("$HERE/sync.sh" --check --repo "$1" --dir "$DIR" | grep -v '^OK')"; rc=${PIPESTATUS[0]}
if [ "$rc" != 0 ]; then
  echo "$out" >&2
  if [ "${CAMPOS_ESTRICTO:-}" = 1 ]; then echo "DEPLOY CANCELADO: copias de campos desactualizadas ($1 en $DIR). Corre tools/field-rules/sync.sh" >&2; exit 1; fi
  echo "AVISO campos ($1): copias desactualizadas, el deploy sigue (CAMPOS_ESTRICTO=1 lo volvería bloqueante)." >&2
fi
exit 0
