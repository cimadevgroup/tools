#!/bin/bash
# instalar-hooks.sh [REPO|--all] — activa .githooks en cada repo (git config core.hooksPath .githooks). Una vez por máquina.
HERE="$(cd "$(dirname "$0")" && pwd)"; DEV="${FR_DEV:-$(cd "$HERE/../.." && pwd)}"
for p in cima/cima-desktop cima/cima-mobile cima/cima-patient cima/cima-landing cima/myvitalcase cima/cima-server cima/cima-crm-server cima/mi-cima-server cima/paginas-consultorio base/base-server base/base-desktop; do
  [ -n "${1:-}" ] && [ "$1" != "--all" ] && [ "$(basename "$p")" != "$1" ] && continue
  [ -d "$DEV/$p/.git" ] || [ -f "$DEV/$p/.git" ] || continue
  git -C "$DEV/$p" config core.hooksPath .githooks && echo "hooks activos: $p"
done
