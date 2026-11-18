# Banderas del ecosistema (fuente única)

- Origen: https://github.com/lipis/flag-icons, licencia MIT (ver LICENSE). Copia de `flags/4x3` del commit `ac7e0eb3259eb62aa6100c435607e2fe03896a97` (2026-11-17).
- 271 banderas SVG 4:3: los 249 países y territorios de ISO 3166-1, más 22 extras (EU, UN, ARAB, ASEAN, CEFTA, EAC, PC, XK,
  CP, DG, IC, XX y subdivisiones: GB-ENG, GB-NIR, GB-SCT, GB-WLS, ES-CT, ES-GA, ES-PV, SH-AC, SH-HL, SH-TA). Más que las banderas emoji.
- Revisión de seguridad al copiar: ningún <script>, ningún manejador on*, ninguna referencia externa (solo «#id» internos).
- Viven en NUESTROS repos: cada uno tiene su copia (sync.sh) y la sirve desde su propio dominio. Nada se pide a internet.
- Se cargan una por una, bajo demanda (<img src=".../4x3/xx.svg" loading="lazy">), nunca las 271 juntas.
- Firma común en los front: `flagSvg(iso, size=16)` → la bandera 4:3 (esquinas de 2 px, borde fino del tema); sin bandera → el código ISO.
- Para actualizar: reemplazar 4x3/ desde el repo de origen, repetir la revisión de seguridad, anotar el commit aquí y correr `./sync.sh`.
