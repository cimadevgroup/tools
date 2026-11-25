#!/bin/bash
# Detiene y quita «contenido-carpeta» de esta Mac. La carpeta y todo lo que tiene se quedan (nada se borra).
# Uso: bash ~/Documents/dev/modular-mango/tools/contenido-carpeta/desinstalar.sh
LABEL="com.modularmango.contenido-carpeta"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
rm -f "$HOME/Library/LaunchAgents/$LABEL.plist"
rm -rf "$HOME/Library/Application Support/contenido-carpeta"
echo "Detenido. La carpeta de contenido y el registro (~/Library/Logs/contenido-carpeta.log) se quedan."
