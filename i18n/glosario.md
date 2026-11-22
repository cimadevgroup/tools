# Glosario español → inglés (global)

Terminología médica para `en.js`. Se amplía con cada paso de V3.

| Español | Inglés (global) |
|---|---|
| Récipe | Prescription |
| Historia (clínica) | Chart |
| Consulta | Visit |
| Paciente | Patient |
| Consultorio | Practice |
| Agenda | Schedule |
| Cédula | no aplica |
| Ingresar | Sign in |
| Registrarse | Sign up |
| Contraseña | Password |
| Seguimiento (mediciones en casa, de2294; médico y paciente) | FollowUp (nombre propio, decisión de Miguel 22 nov 2026). SOLO mediciones en casa |
| Contacto a Pacientes (pestaña CRM de Mensajería, followup.js) | Patient Outreach (decisión de Miguel 22 nov 2026). La etapa y la fecha «seguimiento» de una tarea siguen como «Follow-up» |
| Reposo (médico) | Sick leave (en todo en.js; no «Medical Leave Note» ni «Medical leave») |

## Claves con contexto (`contexto::texto`)

Cuando el MISMO texto en español necesita dos traducciones, la segunda lleva prefijo de contexto en la clave:
`t('agenda::Bloquear')`. En español devuelve «Bloquear» (se quita el prefijo, nunca se muestra); en inglés busca
la entrada `"agenda::Bloquear": "Block"` en `en.js`. Reglas:

- Contexto en minúsculas, dígitos o guion, seguido de `::` (lo valida `tools/i18n-check.mjs`).
- La clave simple conserva su sentido original (`Bloquear` = Lock de la pantalla; `Nombre` = First name; `Documento` = ID document; `Guardado` = Autosave; `Mar` = Tue).
- Una clave con contexto SIN entrada no cae a la clave simple: sale en español y queda en `CimaI18n.missing()`.
- Funciona igual con variables y plurales (`tn('ctx::{n} cita|{n} citas', n)`).
- Prohibido crear ayudantes locales tipo `_L2(es, en)` con inglés dentro del código.

Contextos en uso: `agenda::Bloquear` (Block), `archivo::Nombre` (Name), `archivo::Documento` (Document), `estado::Guardado` (Saved), `mes::Ene`…`mes::Dic` (meses abreviados, Jan…Dec), `mediciones::Seguimiento` (FollowUp).

## Lo que se guarda o viaja: clave, no texto traducido

`sessionStorage`, `localStorage` y el servidor reciben la CLAVE en español, nunca el resultado de `t()` (cambiaría con el idioma).
`CimaI18n.k('texto')` marca una clave que se guarda (devuelve el mismo texto; el verificador la cuenta como clave) y se traduce al mostrar con `t(valor, vars)`.
Si lleva variables, se guardan aparte (`{k, v}`). Los textos ya guardados en otro formato siguen mostrándose tal cual (`t()` devuelve lo que no conoce).

`CimaI18n.src(textoMostrado)` devuelve el español de origen (con variables) de un texto que salió de `t()` con idioma ≠ es; con es devuelve el mismo texto.
Úsalo para DECIDIR por el español (p. ej. `cimaAviso` deduce error/éxito/atención sobre el español, no sobre el texto traducido). Donde se conoce el tipo, pásalo explícito.

`CimaI18n.parts(textoMostrado)` devuelve `{k, v}` (clave y variables) de un texto que salió de `t()`; la campana (`notify_center.js`) guarda `msg` en español, más `k` y `v` si el texto lleva variables, y traduce al mostrar. Deduplica por clave y variables, no por texto traducido; los avisos viejos guardados como texto se muestran tal cual.
