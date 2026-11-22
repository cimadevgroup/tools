# tools/i18n

Fuente única del motor de traducción de la interfaz: `i18n.js` (t, tn, k, src, parts, claves con contexto), `format.js` y `glosario.md`.
`sync.sh` las copia con cabecera «COPIA … VERSION … sha256» a cada repo (ver `./sync.sh --list`). Nunca se edita una copia.

- Cada app conserva su `en.js` y su verificador `tools/i18n-check.mjs`.
- Configuración opcional por app, definida ANTES de cargar `i18n.js`: `window.CIMA_I18N = { defaultLang: 'es', keyPrefix: 'vc_' }`.
  Sin ella, el comportamiento es el de CIMA Escritorio (idioma por marca, clave `cima_ui_lang`).
- La ruta de `en.js` sale siempre de la URL del propio script.
- Cambio en la fuente: sube `VERSION`, corre `./sync.sh` (o con `FR_DEV`/`--dir` para worktrees) y `./sync.sh --check`.
