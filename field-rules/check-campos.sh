#!/bin/bash
# check-campos.sh REPO — candado de despliegue (no depende del hook). Lo llaman los scripts de deploy al INICIO.
# Si la carpeta field-rules no existe (build en la nube), avisa y sigue: ahí el candado es el hook local.
HERE="$(cd "$(dirname "$0")" && pwd)"
[ -x "$HERE/sync.sh" ] || { echo "check-campos: sync.sh no disponible, omitido" >&2; exit 0; }
"$HERE/sync.sh" --check --repo "$1" | grep -v '^OK' >&2; [ "${PIPESTATUS[0]}" = 0 ] || { echo "DEPLOY CANCELADO: copias de campos desactualizadas ($1). Corre tools/field-rules/sync.sh" >&2; exit 1; }
