# tools/contact — Contacto único (de2884)

Fuente compartida del botón único de contacto: **Escribir por Link**, **Abrir en WhatsApp** (app de la computadora,
con respaldo a wa.me en el navegador externo) y **Llamar**. Nació en BASE (`base-desktop/modules/contact.js`) y se
extrajo aquí el 22 nov 2026 sin cambiar su comportamiento. 1.1.0 (22 nov): «Enviar correo» (mailto:) cuando hay email. 1.2.0: colores por tokens --ct-* con respaldo (BASE --win-*, luego CIMA). 1.3.0: sin _blank ni window.open (openExternal configurable; en BASE sima.app.openInside), gancho beforeWhatsApp, textos por CimaI18n.t() y showLink=false para ocultar Link.

- `contact.js` → `window.CimaContact` (y el alias `window.sima.contact` que usa BASE). API en la cabecera del archivo.
- `contact.css` → botones por fila (`.sima-ct-btn`) y menú flotante (`.sima-ct-menu`); usa los tokens de ventana
  (`--win-*`, `--accent`, `--success`).
- `sync.sh` → copia ambos a cada app con cabecera «COPIA … no editar». `--check` para comparar, `--list` para ver destinos.

## Sumar una app (por ejemplo cima-desktop)
1. Agrega sus filas a `REPOS` en `sync.sh` (una por carpeta de destino: la del .js y la del .css).
2. Corre `./sync.sh --repo <app>` y carga los dos archivos con `?v=` nuevo.
3. Conecta su «Link», si tiene: `CimaContact.linkHandler = (phone, name) => …` (devuelve una promesa). Si la app no
   tiene Link, el botón avisa «Link no está disponible».
4. Las filas usan `CimaContact.html(phone, name)` o botones con `data-ct-act` / `data-ct-phone` / `data-ct-name`.

Nunca se edita una copia: se cambia la fuente, se sube `VERSION` si cambia la API y se corre `sync.sh`.
