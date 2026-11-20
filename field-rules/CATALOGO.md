# Catálogo de campos de CIMA

Versión 1.0.0. **Generado desde catalog.json por gen-catalogo.mjs; no se edita a mano** (el test falla si no coincide). Los ejemplos de cada tabla se ejecutan en test.mjs: si este documento miente, el test se cae.

## Reglas generales

- Guardado = FieldRules.check(id, v, opts).value. Mostrado = FieldFormat.show(id, v, opts). Un dato que no valida se conserva y se cuenta, salvo que el interruptor estricto del campo esté en 1 (plan F2/F7).
- Nunca se muestra una fecha como 05/11: el mes va en letras («5 nov 2026»).
- Vacío siempre es válido (value ''), salvo opts.required.
- Un tipo nuevo se agrega PRIMERO a este catálogo, con ejemplos; luego al código; luego se corre sync.sh.

## Cómo se usa

- **Capturar:** solo con los componentes `Cima*Field` (con `data-cima-field`). Nadie escribe un `<input>` suelto para estos datos.
- **Guardar:** `FieldRules.check(tipo, valor, opts).value`.
- **Mostrar:** `FieldFormat.show(tipo, valor, opts)`.
- **Servidores:** core normaliza SIEMPRE al escribir (plan F2).
- **Estado:** «implementado» tiene código y ejemplos probados; «catalogado» tiene la regla decidida y una fase que la implementa.

## Identidad

### Tipo de documento · `doc_type`

- **Estado:** implementado
- **Se guarda:** Código por país: VE V E J G P · CL RUT P · CO CC CE NIT P · AR DNI CUIT P. «Cedula» pasa a V, «Pasaporte» a P, «Otro» a vacío (FieldRules.normDocType).
- **Se muestra:** El código (V) o «V — Venezolano» donde haya espacio. La lista sale del país del consultorio (FieldRules.COUNTRY_DOCS).
- **Regla:** Solo códigos de COUNTRY_DOCS del país del consultorio.

| Llamada | Entrada | Resultado |
|---|---|---|
| `FieldRules.normDocType(…)` | `"Cedula"` | `"V"` |
| `FieldRules.normDocType(…)` | `"Otro"` | `""` |
| `FieldRules.normDocType(…, 'CO')` | `"Cedula"` | `"CC"` |

### Número de documento · `doc_number`

- **Estado:** implementado
- **Se guarda:** Con prefijo y SIN ceros a la izquierda en V ni E: V-5142891, E-123456789, J-12345678-9, P-AB123456. RUT 12345678-5, NIT 900123456-8, CUIT 11 dígitos, CC y DNI solo dígitos.
- **Se muestra:** V/E/J/G/P tal cual se guardan; RUT 12.345.678-5; NIT 900.123.456-8; CUIT 20-12345678-3; DNI 12.345.678; CC 1.012.345.678.
- **Regla:** DOC_RULES[tipo] más dígito verificador (RUT módulo 11, NIT DIAN, CUIT). V hasta 8 dígitos, E hasta 9. P no acepta un valor de cédula.

| Llamada | Entrada | Resultado |
|---|---|---|
| `FieldRules.check('doc', …)` | `"V-05142891"` | `"V-5142891"` |
| `FieldRules.check('doc', …)` | `"v 5.142.891"` | `"V-5142891"` |
| `FieldRules.check('doc', …, {"docType":"V"})` | `"005142891"` | `"V-5142891"` |
| `FieldRules.check('doc', …)` | `"E-000123456789"` | `"E-123456789"` |
| `FieldRules.check('doc', …)` | `"j-12345678-9"` | `"J-12345678-9"` |
| `FieldRules.check('doc', …, {"docType":"P"})` | `"pab123456"` | `"P-PAB123456"` |
| `FieldRules.check('doc', …, {"country":"CL","docType":"RUT"})` | `"12.345.678-5"` | `"12345678-5"` |
| `FieldRules.check('doc', …, {"country":"CL","docType":"RUT"})` | `"12.345.678-9"` | **error** (rechaza con mensaje) |
| `FieldFormat.show('doc_number', …)` | `"V-5142891"` | `"V-5142891"` |
| `FieldFormat.show('doc_number', …)` | `"12345678-5"` | `"12.345.678-5"` |

### Clave de búsqueda del documento · `doc_key`

- **Estado:** catalogado (F2 (core))
- **Se guarda:** Índice interno (_mpiNormDoc de core): sin prefijo, sin ceros y sin signos; el pasaporte va aparte. No se captura nunca.
- **Se muestra:** No se muestra.
- **Regla:** Solo core la calcula; las pantallas no.

### Registro profesional (matrícula) · `med_license`

- **Estado:** catalogado (F2/F3)
- **Se guarda:** Mayúsculas con la sigla del ente: MPPS-12345. VE MPPS o colegio; CO RETHUS; el resto texto de hasta 20.
- **Se muestra:** Tal cual.
- **Regla:** Sigla por país según la tabla de países del servidor (prof_reg_short).

### Identificación fiscal del consultorio · `tax_id`

- **Estado:** implementado
- **Se guarda:** Es un doc_number de tipo J, G, NIT, CUIT o RUT.
- **Se muestra:** Como doc_number.
- **Regla:** Igual que doc_number.

| Llamada | Entrada | Resultado |
|---|---|---|
| `FieldRules.check('doc', …)` | `"g-20000001-0"` | `"G-20000001-0"` |

## Contacto

### Teléfono (phone, phone2, emerg_phone, whatsapp) · `phone`

- **Estado:** implementado
- **Se guarda:** E.164 sin el 0 nacional: +584141234567. Sin «+» se usa el país del consultorio. +1 no se adivina (EE. UU. o R. Dominicana). El índice de búsqueda guarda también las formas nacionales.
- **Se muestra:** Agrupado: +58 414 123 4567. Los enlaces tel: y wa.me se arman SIEMPRE desde el guardado (FieldFormat.tel / wa).
- **Regla:** 8 a 15 dígitos; largo nacional según el país (FieldRules.COUNTRIES). check valida con mensaje; phoneCanon normaliza tolerante lo que llega sucio (motor de core, de2818).

| Llamada | Entrada | Resultado |
|---|---|---|
| `FieldRules.check('phone', …)` | `"0414-1234567"` | `"+584141234567"` |
| `FieldRules.check('phone', …)` | `"+58 0414 123 4567"` | `"+584141234567"` |
| `FieldRules.check('phone', …)` | `"414 1234567"` | `"+584141234567"` |
| `FieldRules.check('phone', …, {"country":"CO"})` | `"300 1234567"` | `"+573001234567"` |
| `FieldRules.phoneCanon(…, 'VE')` | `"0414-1234567"` | `"+584141234567"` |
| `FieldRules.phoneCanon(…, 'VE')` | `"0058 414 1234567"` | `"+584141234567"` |
| `FieldRules.phoneCanon(…)` | `"414 1234567"` | `null` |
| `FieldFormat.show('phone', …)` | `"+584141234567"` | `"+58 414 123 4567"` |
| `FieldFormat.show('phone', …)` | `"+56912345678"` | `"+56 9 1234 5678"` |
| `FieldFormat.show('phone', …)` | `"+5491123456789"` | `"+54 9 11 2345 6789"` |
| `FieldFormat.tel(…)` | `"+584141234567"` | `"tel:+584141234567"` |
| `FieldFormat.wa(…)` | `"+584141234567"` | `"https://wa.me/584141234567"` |

### Correo · `email`

- **Estado:** implementado
- **Se guarda:** Sin espacios alrededor, en minúsculas, hasta 120 caracteres.
- **Se muestra:** Tal cual.
- **Regla:** UNA sola regex: FieldRules.EMAIL_RE. Nadie escribe otra.

| Llamada | Entrada | Resultado |
|---|---|---|
| `FieldRules.check('email', …)` | `"  Ana.Perez@Correo.COM "` | `"ana.perez@correo.com"` |
| `FieldRules.check('email', …)` | `"ana@correo"` | **error** (rechaza con mensaje) |

### Dirección · `address`

- **Estado:** catalogado (F3 (validador; FieldFormat.address ya muestra))
- **Se guarda:** Objeto {line1, line2, city, state, postal, country ISO}. País obligatorio. Código postal según el país.
- **Se muestra:** Una línea: «Av. Principal 12, Piso 3, Caracas, Miranda 1060, Venezuela».
- **Regla:** country es ISO alfa-2 (tipo country); las demás partes son texto.

| Llamada | Entrada | Resultado |
|---|---|---|
| `FieldFormat.show('address', …)` | `{"line1":"Av. Principal 12","line2":"Piso 3","city":"Caracas","state":"Miranda","postal":"1060","country":"VE"}` | `"Av. Principal 12, Piso 3, Caracas, Miranda 1060, Venezuela"` |

## Persona

### Nombre y apellido (campos aparte) · `name`

- **Estado:** implementado
- **Se guarda:** Sin espacios sobrantes; se capitaliza solo si llega todo en mayúsculas o todo en minúsculas. De 1 a 60 caracteres, sin dígitos.
- **Se muestra:** Tal cual.
- **Regla:** Letras, espacios, apóstrofo y guion.

| Llamada | Entrada | Resultado |
|---|---|---|
| `FieldRules.check('name', …)` | `"  María   José "` | `"María José"` |
| `FieldRules.check('name', …)` | `"MARIA JOSE"` | `"Maria Jose"` |
| `FieldRules.check('name', …)` | `"Ana2"` | **error** (rechaza con mensaje) |

### Sexo · `sex`

- **Estado:** implementado
- **Se guarda:** F, M o vacío. Acepta «Masculino», «Hombre», «femenino»… (FieldRules.normSex, absorbido de CimaFieldCatalog). NUNCA se deduce del título Dr./Dra.
- **Se muestra:** Femenino / Masculino / Prefiero no decir.
- **Regla:** Cualquier otro valor se rechaza.

| Llamada | Entrada | Resultado |
|---|---|---|
| `FieldRules.check('sex', …)` | `"Masculino"` | `"M"` |
| `FieldRules.check('sex', …)` | `"mujer"` | `"F"` |
| `FieldRules.check('sex', …)` | `"Prefiero no decir"` | `""` |
| `FieldRules.check('sex', …)` | `"x"` | **error** (rechaza con mensaje) |
| `FieldFormat.show('sex', …)` | `"F"` | `"Femenino"` |
| `FieldFormat.show('sex', …)` | `""` | `"Prefiero no decir"` |

### Fecha de nacimiento · `birthdate`

- **Estado:** implementado
- **Se guarda:** AAAA-MM-DD. No futura; hasta 120 años (personal del consultorio, de 15 a 100).
- **Se muestra:** «10 nov 1990 (36 años)». La edad se calcula con la fecha del día, no con el año.
- **Regla:** opts.birth (tipo birth).

| Llamada | Entrada | Resultado |
|---|---|---|
| `FieldRules.check('birth', …, {"today":"2026-11-20"})` | `"1990-11-10"` | `"1990-11-10"` |
| `FieldRules.check('birth', …, {"today":"2026-11-20"})` | `"2999-01-01"` | **error** (rechaza con mensaje) |
| `FieldFormat.show('birthdate', …, {"today":"2026-11-20"})` | `"1990-11-10"` | `"10 nov 1990 (36 años)"` |
| `FieldFormat.show('birthdate', …, {"today":"2026-11-20"})` | `"1990-11-21"` | `"21 nov 1990 (35 años)"` |

### Título y estado civil · `title`

- **Estado:** catalogado (F3)
- **Se guarda:** title: código DR DRA LIC ING… · marital_status: S C D V U.
- **Se muestra:** Dr., Dra., Lic., Ing.
- **Regla:** Lista cerrada.

## Geografía y tiempo

### País · `country`

- **Estado:** implementado
- **Se guarda:** ISO 3166-1 alfa-2 en mayúsculas, NUNCA texto libre. Un nombre conocido («Venezuela») se traduce al código.
- **Se muestra:** El nombre del país en español (FieldFormat.countryName).
- **Regla:** 2 letras o un nombre de FieldRules.COUNTRIES.

| Llamada | Entrada | Resultado |
|---|---|---|
| `FieldRules.check('country', …)` | `"ve"` | `"VE"` |
| `FieldRules.check('country', …)` | `"Venezuela"` | `"VE"` |
| `FieldRules.check('country', …)` | `"Narnia"` | **error** (rechaza con mensaje) |
| `FieldFormat.show('country', …)` | `"CO"` | `"Colombia"` |

### Estado o provincia · `state`

- **Estado:** catalogado (F3)
- **Se guarda:** ISO 3166-2 si hay catálogo del país; si no, texto de hasta 60.
- **Se muestra:** El nombre.
- **Regla:** city: texto de hasta 60.

### Zona horaria · `timezone`

- **Estado:** catalogado (F2)
- **Se guarda:** IANA (America/Caracas); la válida de cada país sale de la tabla country del servidor.
- **Se muestra:** Nombre de la ciudad.
- **Regla:** countryTzOk de core.

### Fecha · `date`

- **Estado:** implementado
- **Se guarda:** AAAA-MM-DD, fecha real del calendario.
- **Se muestra:** «10 nov 2026». Nunca 10/11/2026.
- **Regla:** Se rechazan 2026-02-30 y similares.

| Llamada | Entrada | Resultado |
|---|---|---|
| `FieldRules.check('date', …)` | `"2026-11-10"` | `"2026-11-10"` |
| `FieldRules.check('date', …)` | `"2026-02-30"` | **error** (rechaza con mensaje) |
| `FieldFormat.show('date', …)` | `"2026-11-05"` | `"5 nov 2026"` |

### Instante · `instant`

- **Estado:** implementado
- **Se guarda:** ISO UTC con Z (o epoch ms: UNA sola forma por tabla).
- **Se muestra:** En la zona del consultorio: «10 nov 2026, 15:45».
- **Regla:** opts.timezone IANA; sin zona se muestra en UTC.

| Llamada | Entrada | Resultado |
|---|---|---|
| `FieldFormat.show('instant', …, {"timezone":"America/Caracas"})` | `"2026-11-10T19:45:00Z"` | `"10 nov 2026, 15:45"` |
| `FieldFormat.show('instant', …, {"timezone":"America/Caracas"})` | `"2026-11-10T02:30:00Z"` | `"9 nov 2026, 22:30"` |

### Cita, duración y horario · `appointment`

- **Estado:** catalogado (F2)
- **Se guarda:** appointment: fecha y hora local más la zona del consultorio. duration: minutos. opening_hours: [{dow, open, close}] en 24 h (dow 1=lunes … 7=domingo) más la zona.
- **Se muestra:** El horario se agrupa: «Lun a vie 08:00–17:00; sáb 09:00–12:00».
- **Regla:** open < close; horas HH:MM.

| Llamada | Entrada | Resultado |
|---|---|---|
| `FieldFormat.show('opening_hours', …)` | `[{"dow":1,"open":"08:00","close":"17:00"},{"dow":2,"open":"08:00","close":"17:00"},{"dow":3,"open":"08:00","close":"17:00"},{"dow":4,"open":"08:00","close":"17:00"},{"dow":5,"open":"08:00","close":"17:00"},{"dow":6,"open":"09:00","close":"12:00"}]` | `"Lun a vie 08:00–17:00; sáb 09:00–12:00"` |

## Clínicos

### Datos clínicos (un valor raro avisa, no bloquea) · `clinicos`

- **Estado:** catalogado (F3)
- **Se guarda:** blood_type (catálogo A+ A- B+ B- AB+ AB- O+ O-); weight kg con 1 decimal (0,3 a 400); height cm (30 a 250); bp_sys / bp_dia; heart_rate; spo2; temp °C; glucose mg/dL; bmi calculado; icd con icd_system.
- **Se muestra:** Con su unidad: «72,5 kg», «170 cm».
- **Regla:** Fuera de rango = aviso, no error.

## Dinero

### Dinero · `money`

- **Estado:** implementado
- **Se guarda:** amount_minor (entero, céntimos) más currency ISO 4217. fx_rate: texto decimal con rate_date y rate_source. Antes de migrar, verificar cómo guarda core hoy: nada se migra a ciegas.
- **Se muestra:** «1.234,50 USD» (punto de miles, coma decimal; CLP, JPY, PYG, KRW y VND sin decimales).
- **Regla:** Nunca float.

| Llamada | Entrada | Resultado |
|---|---|---|
| `FieldFormat.show('money', …)` | `{"amount_minor":123450,"currency":"USD"}` | `"1.234,50 USD"` |
| `FieldFormat.show('money', …)` | `{"amount_minor":5,"currency":"USD"}` | `"0,05 USD"` |
| `FieldFormat.show('money', …)` | `{"amount_minor":1500000,"currency":"CLP"}` | `"1.500.000 CLP"` |
| `FieldFormat.show('money', …)` | `{"amount_minor":-2550,"currency":"EUR"}` | `"-25,50 EUR"` |

## URLs, redes y hosting

### Enlace · `url`

- **Estado:** implementado
- **Se guarda:** Solo http(s); sin protocolo se antepone https://. Meta: solo https y sin utm_* (F8).
- **Se muestra:** Tal cual.
- **Regla:** Sin espacios; host con punto.

| Llamada | Entrada | Resultado |
|---|---|---|
| `FieldRules.check('url', …)` | `"ejemplo.com/cita"` | `"https://ejemplo.com/cita"` |
| `FieldRules.check('url', …)` | `"javascript:alert(1)"` | **error** (rechaza con mensaje) |

### Instagram (y tiktok, x, facebook en F8) · `instagram`

- **Estado:** implementado
- **Se guarda:** Usuario sin @, en minúsculas; acepta la URL pegada.
- **Se muestra:** @usuario.
- **Regla:** Letras, números, punto y guion bajo, hasta 30.

| Llamada | Entrada | Resultado |
|---|---|---|
| `FieldRules.check('instagram', …)` | `"https://www.instagram.com/Dra.Perez/?hl=es"` | `"dra.perez"` |
| `FieldRules.check('instagram', …)` | `"@dra.perez"` | `"dra.perez"` |

### Slug, dominio propio y coordenadas · `slug`

- **Estado:** catalogado (F8)
- **Se guarda:** slug [a-z0-9-]{3,40} con lista de reservados; custom_domain en punycode; geo con 6 decimales.
- **Se muestra:** Tal cual.
- **Regla:** Todo formulario publicado se declara con tipos de este catálogo y se valida en el Worker de páginas y otra vez en core; el constructor solo ofrece estos tipos.

## Genéricos

### Texto, número, usuario y contraseña · `text`

- **Estado:** implementado
- **Se guarda:** text: sin espacios sobrantes y con largo máximo. number: punto al guardar. username: minúsculas, 3 a 32, [a-z0-9._-]. password: nunca en claro.
- **Se muestra:** number: coma al mostrar con punto de miles («1.234,5»).
- **Regla:** Política de usuario y contraseña de core.

| Llamada | Entrada | Resultado |
|---|---|---|
| `FieldRules.check('number', …)` | `"1.234,5"` | `1234.5` |
| `FieldFormat.show('number', …)` | `1234.5` | `"1.234,5"` |
| `FieldRules.check('username', …)` | `" Dra.Perez "` | `"dra.perez"` |

## Etiquetas de tipos de documento

| Código | Etiqueta |
|---|---|
| V | Venezolano |
| E | Extranjero |
| P | Pasaporte |
| J | Jurídico |
| G | Gubernamental |
| RUT | RUT |
| CC | Cédula de ciudadanía |
| CE | Cédula de extranjería |
| NIT | NIT |
| DNI | DNI |
| CUIT | CUIT/CUIL |
