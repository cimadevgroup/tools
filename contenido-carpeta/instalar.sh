#!/bin/bash
# Instala «contenido-carpeta» en esta Mac (de3222): la carpeta que sube videos e imágenes sola a BASE › Contenido.
# Uso: bash ~/Documents/dev/modular-mango/tools/contenido-carpeta/instalar.sh
# Se puede repetir sin problema (actualiza el programa y vuelve a arrancarlo).
set -euo pipefail

AQUI="$(cd "$(dirname "$0")" && pwd)"
APP="$HOME/Library/Application Support/contenido-carpeta"
PLIST="$HOME/Library/LaunchAgents/com.modularmango.contenido-carpeta.plist"
LABEL="com.modularmango.contenido-carpeta"
LOG="$HOME/Library/Logs/contenido-carpeta.log"
PY=/usr/bin/python3

[ -x "$PY" ] && "$PY" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)' 2>/dev/null || {
  echo "Falta Python 3 de macOS. Ejecuta: xcode-select --install  y vuelve a correr este comando."; exit 1; }
[ -f "$HOME/.base-agente.env" ] || { echo "Falta la llave del agente en ~/.base-agente.env (pídesela al equipo)."; exit 1; }

# El programa vive fuera de Documentos para que macOS no pida permisos a cada rato.
mkdir -p "$APP" "$HOME/Library/LaunchAgents" "$(dirname "$LOG")"
cp "$AQUI/contenido_carpeta.py" "$APP/contenido_carpeta.py"
chmod 700 "$APP"

# La ruta de la carpeta se lee de BASE; la primera pasada la crea con sus subcarpetas.
echo "Primera pasada (lee la configuración de BASE y crea las carpetas)…"
"$PY" "$APP/contenido_carpeta.py" || true
RUTA="$("$PY" - <<'EOF'
import json, os, sys
sys.path.insert(0, os.path.expanduser('~/Library/Application Support/contenido-carpeta'))
import contenido_carpeta as c
try:
    F = c.Base().call('GET', '/admin/social/folder')
    print(os.path.expanduser((F.get('folder') or {}).get('ruta') or '~/CIMA Contenido/Para publicar'))
except Exception:
    print(os.path.expanduser('~/CIMA Contenido/Para publicar'))
EOF
)"
mkdir -p "$RUTA"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>$PY</string><string>$APP/contenido_carpeta.py</string></array>
  <key>StartInterval</key><integer>120</integer>
  <key>WatchPaths</key><array><string>$RUTA</string></array>
  <key>RunAtLoad</key><true/>
  <key>ProcessType</key><string>Background</string>
  <key>LowPriorityIO</key><true/>
  <key>Nice</key><integer>10</integer>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl enable "gui/$(id -u)/$LABEL"

echo ""
echo "Listo. La carpeta es: $RUTA"
echo "Suelta ahí (o en su subcarpeta de destino) los videos e imágenes; llegan solos a BASE › Negocio › Contenido."
echo "Registro: $LOG"
open "$RUTA" 2>/dev/null || true
