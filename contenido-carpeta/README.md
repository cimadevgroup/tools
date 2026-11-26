# contenido-carpeta

La carpeta de la Mac que sube videos e imágenes sola a **BASE › Negocio › Contenido** (ticket de3222, 25 nov 2026).

Sueltas un archivo en la carpeta, en la subcarpeta de su destino, y a los pocos minutos aparece en la biblioteca de
Contenido como borrador con esos destinos ya marcados (o en la cola, si así se configura en BASE).

## Instalar (una sola vez)

```bash
bash ~/Documents/dev/modular-mango/tools/contenido-carpeta/instalar.sh
```

Necesita Python 3 de macOS (`/usr/bin/python3`; si falta: `xcode-select --install`) y la llave del agente en
`~/.base-agente.env`. Se puede repetir para actualizar. Para quitarlo: `bash …/desinstalar.sh` (la carpeta se queda).

## Cómo se usa

Carpeta de fábrica: `~/CIMA Contenido/Para publicar` (se cambia en BASE › Contenido › Carpeta).

| Subcarpeta | Destino |
|---|---|
| `youtube/` | YouTube (video) |
| `youtube-shorts/` | YouTube Shorts |
| `instagram-reel/` | Instagram · Reel |
| `instagram-historia/` | Instagram · Historia |
| `instagram-publicacion/` | Instagram · Publicación (imagen) |
| `facebook/` | Facebook · Página |
| `facebook-reel/` | Facebook · Reel |
| `reel-en-todas/` | Instagram Reel + Facebook Reel + YouTube Shorts |
| la raíz | sin destino (se elige en BASE) |

- **Texto:** un `.txt` con el mismo nombre del archivo (`video.mp4` + `video.txt`). Primera línea = título; el resto = texto de la publicación.
- **Formatos:** MP4, MOV y M4V; imágenes JPEG, PNG, HEIC, WEBP y TIFF (las que no son JPEG se convierten con `sips`; el original se conserva). Hasta 4 GB.
- **Al terminar:** el archivo y su `.txt` pasan a `subidos/<fecha>/<subcarpeta>/`. Lo que no se puede subir pasa a `revisar/` con el motivo en BASE. **Nada se borra.**
- Si el archivo no sirve para un destino (por ejemplo, un video horizontal en `youtube-shorts/`), se sube igual con los destinos que sí sirven y queda la nota.
- Solo toma archivos que llevan al menos 60 s sin cambiar (la exportación terminó).

## Qué se configura en BASE (Contenido › Carpeta)

Ruta, si lo que llega queda como borrador o se agrega a la cola, encender o apagar la vigilancia, y la tabla
subcarpeta → destinos. El programa lee esa configuración en cada pasada. Ahí también se ve cuándo pasó la Mac
por última vez, cuántos subió hoy y los últimos archivos.

> Si la carpeta se mueve a Documentos, Escritorio o iCloud, macOS pedirá una vez permiso de acceso a archivos para
> Python. En la carpeta personal (la de fábrica) no pide nada. Tras cambiar la ruta en BASE, volver a correr
> `instalar.sh` hace que reaccione al instante (si no, igual pasa cada 2 minutos).

## Por dentro

- `contenido_carpeta.py`: un solo archivo, solo la biblioteca estándar de Python, más `sips`/`mdls` de macOS y
  `ffprobe` si está instalado (medidas y rotación del video).
- launchd (`~/Library/LaunchAgents/com.modularmango.contenido-carpeta.plist`): cada 2 min y al cambiar la carpeta.
  El programa se copia a `~/Library/Application Support/contenido-carpeta/` (fuera de Documentos).
- Registro: `~/Library/Logs/contenido-carpeta.log`.
  Cada línea dice qué tan grave es: **OK** (subido o fallo resuelto) · **ESPERA** (archivo que aún se copia; sube en la
  próxima pasada) · **PASAJERO** (red o BASE caídos un rato; se reintenta solo, no hay que hacer nada) · **ATENCIÓN** (no se
  arregla solo: llave, ruta o carpeta) · **A REVISAR** (archivo movido a «revisar»). Un fallo se anota una sola vez y, cuando
  BASE vuelve a responder, queda la línea «Resuelto».
- API de BASE (`sima`), con la llave del agente (nunca se imprime; token de 1 h guardado en modo 600):
  `GET /admin/social/folder` → `POST /admin/social/upload/start` → `PUT …/part/:n` (50 MB) → `POST …/complete`
  → `GET /admin/social/posts/:id` (redes permitidas) → `POST /admin/social/posts/:id` (texto y destinos, sin fecha)
  → en modo cola `POST /admin/social/posts/:id/queue` → `POST /admin/social/folder/ping`.
- La llave solo puede subir, poner texto y destinos sin fecha, agregar a la cola y avisar la pasada. La fecha la
  confirma Miguel (BASE o tarjeta «Hacer» del Asistente).
- Consumo: una lectura de configuración cada 2 min (sin fila de auditoría), un aviso por hora o tras subir. Gasto cero.
- Pruebas sin tocar la carpeta real: `CONTENIDO_RUTA=/otra/carpeta /usr/bin/python3 contenido_carpeta.py`.
