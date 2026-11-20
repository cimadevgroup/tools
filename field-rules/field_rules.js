/* field_rules.js — validador común de campos (fuente única: tools/field-rules).
 * JavaScript puro, sin dependencias. Navegador: window.FieldRules. Node/CommonJS: module.exports.
 * Servidores (Workers, ES modules): sync.sh genera field_rules.mjs con `export default` a partir de este mismo archivo.
 *
 *   FieldRules.check(type, value, opts)  → { ok, value, msg }
 *   FieldRules.checkAll({campo:{type,value,opts}}) → { ok, values, errors:{campo:msg} }
 *   FieldRules.phoneParts(v, {defaultCountry}) → { iso, code, national }   (para el selector de país)
 *   FieldRules.COUNTRIES, FieldRules.docDigits(v)
 *   de2627: opts.country (ISO) en 'phone' y 'doc' → reglas de ese país (CL, CO, AR). Sin country = Venezuela como siempre.
 *   Un país sin reglas propias (fuera de COUNTRY_DOCS para documentos, o fuera de COUNTRIES para teléfonos) usa las de siempre.
 *   FieldRules.COUNTRY_DOCS[iso] = códigos de documento del país; FieldRules.DOC_RULES[código] = {pattern, dv?, format}.
 *
 *   F0 (catálogo): FieldRules.phoneCanon(raw, home) (motor de core, tolerante), EMAIL_RE (única regex de correo), tipos 'sex' y 'country',
 *   normSex, normDocType. El catálogo completo (reglas, ejemplos) está en CATALOGO.md; la presentación en FieldFormat (field_format.js).
 *
 * value = dato normalizado listo para guardar; msg = mensaje en español para mostrar bajo el campo.
 * Vacío = válido (value ''), salvo opts.required.
 */
(function (root) {
  'use strict';

  const COUNTRIES = [
    { iso: 'VE', code: '58',  name: 'Venezuela',            len: [10] },
    { iso: 'CO', code: '57',  name: 'Colombia',             len: [10] },
    { iso: 'US', code: '1',   name: 'Estados Unidos/Canadá', len: [10] },
    { iso: 'ES', code: '34',  name: 'España',               len: [9] },
    { iso: 'MX', code: '52',  name: 'México',               len: [10] },
    { iso: 'PA', code: '507', name: 'Panamá',               len: [7, 8] },
    { iso: 'PE', code: '51',  name: 'Perú',                 len: [9] },
    { iso: 'CL', code: '56',  name: 'Chile',                len: [9] },
    { iso: 'AR', code: '54',  name: 'Argentina',            len: [10, 11] },
    { iso: 'EC', code: '593', name: 'Ecuador',              len: [8, 9] },
    { iso: 'DO', code: '1',   name: 'República Dominicana', len: [10] },
    { iso: 'PT', code: '351', name: 'Portugal',             len: [9] },
    { iso: 'IT', code: '39',  name: 'Italia',               len: [9, 10] }
  ];

  // Códigos de país conocidos que NO tienen regla de longitud arriba: solo sirven para separar código y número
  // en phoneParts (el teléfono se valida con el rango internacional genérico).
  const EXTRA_CODES = ['7', '20', '27', '30', '31', '32', '33', '36', '40', '41', '43', '44', '45', '46', '47', '48', '49',
    '55', '60', '61', '62', '63', '64', '65', '66', '81', '82', '84', '86', '90', '91', '92', '93', '94', '95', '98',
    '212', '213', '216', '351', '353', '354', '358', '372', '380', '501', '502', '503', '504', '505', '506', '591', '595',
    '598', '961', '962', '966', '971', '972'];

  const ok = (value) => ({ ok: true, value, msg: '' });
  const bad = (msg, value) => ({ ok: false, value: value === undefined ? '' : value, msg });
  const str = (v) => (v === null || v === undefined) ? '' : String(v);

  // ── correo ───────────────────────────────────────────────────────────────
  // UNA sola regex para todo el ecosistema (core, escritorio, móvil, portal, páginas). Quien necesite probar un correo usa
  // FieldRules.EMAIL_RE o FieldRules.check('email', …); nadie escribe otra.
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
  function email(v) {
    const s = str(v).trim().toLowerCase();
    if (!s) return ok('');
    if (/\s/.test(s)) return bad('El correo no lleva espacios.', s);
    if (s.length > 120) return bad('El correo es demasiado largo (máximo 120 caracteres).', s);
    if (!EMAIL_RE.test(s)) return bad('Escribe un correo válido, como nombre@dominio.com.', s);
    return ok(s);
  }

  // ── teléfono → E.164 ─────────────────────────────────────────────────────
  function countryByDigits(d) {
    let best = null;
    for (const c of COUNTRIES) {
      if (d.startsWith(c.code) && (!best || c.code.length > best.code.length)) best = c;
    }
    return best;
  }
  // de2627: modo PAÍS (opts.country = ISO). Solo se activa si llega country: sin él, phone() es exactamente el de siempre.
  //  · el país da el código por defecto de un número escrito sin «+»;
  //  · un número que ya trae ese código sin «+» (56912345678 con CL) se toma como explícito;
  //  · Argentina: quita el 0 y el 15 locales y antepone el 9 de celular (011 15 2345-6789 → +54 9 11 2345 6789).
  function countryIso(iso) { const t = str(iso).trim().toUpperCase(); return COUNTRIES.find((c) => c.iso === t) || null; }
  function phoneCountry(raw, c) {
    let d = raw.replace(/\D/g, '');
    if (!d) return bad('Un teléfono solo lleva números.', raw);
    if (raw.startsWith('+') || d.startsWith('00')) {
      // Explícito: el camino de siempre, salvo un argentino con el 15 local (+54 11 15 2345 6789), que se limpia abajo.
      if (c.iso !== 'AR') return null;
      const e = d.startsWith('00') ? d.slice(2) : d;
      if (!(e.startsWith('54') && e.length === 14 && [2, 3, 4].some((a) => e.substr(2 + a, 2) === '15'))) return null;
      d = e;
    }
    const max = Math.max.apply(null, c.len) + (c.iso === 'AR' ? 1 : 0);
    if (d.startsWith(c.code) && d.length - c.code.length >= Math.min.apply(null, c.len) && d.length - c.code.length <= max) {
      d = d.slice(c.code.length);                                            // ya trae el código, sin «+»
    } else {
      if (d.charAt(0) === '0' && ['CO', 'US', 'DO', 'CL', 'MX', 'ES', 'PA', 'PT'].indexOf(c.iso) >= 0) return bad('Un número de ' + c.name + ' no lleva 0 inicial. Si es de otro país, escríbelo con + (p. ej. +58).', raw);
      d = d.replace(/^0+/, '');                                              // 0 de marcación local
    }
    if (c.iso === 'AR') {
      let n = d, mobile = false;
      if (n.length === 11 && n.charAt(0) === '9') { n = n.slice(1); mobile = true; }
      if (!mobile && n.length === 12) {
        for (const a of [2, 3, 4]) { if (n.substr(a, 2) === '15') { n = n.slice(0, a) + n.slice(a + 2); mobile = true; break; } }
      }
      if (n.length !== 10) return bad('Un número de Argentina lleva 10 dígitos con el código de área (p. ej. 11 2345 6789); el celular, con 9 delante.', raw);
      return ok('+54' + (mobile ? '9' : '') + n);
    }
    return '+' + c.code + d;                                                 // lo valida el camino de siempre
  }
  function phone(v, opts) {
    const raw = str(v).trim();
    if (!raw) return ok('');
    if (opts && opts.country && !/[^\d\s().+-]/.test(raw)) {
      const c = countryIso(opts.country);
      if (c && c.iso !== 'VE') {
        const r = phoneCountry(raw, c);
        if (r && typeof r === 'object') return r;
        if (typeof r === 'string') return phone(r, Object.assign({}, opts, { country: null }));
      } else if (c && c.iso === 'VE') {
        opts = Object.assign({}, opts, { country: null, defaultCountry: (opts && opts.defaultCountry) || '58' });
      }
    }
    if (/[^\d\s().+-]/.test(raw)) return bad('Un teléfono solo lleva números.', raw);
    let d = raw.replace(/\D/g, '');
    if (!d) return bad('Un teléfono solo lleva números.', raw);
    let explicit = false;
    if (raw.startsWith('+')) { explicit = true; }
    else if (d.startsWith('00')) { d = d.slice(2); explicit = true; }
    else if (d.startsWith('0')) { d = ((opts && opts.defaultCountry) || '58') + d.replace(/^0+/, ''); }
    else if (d.length === 12 && d.startsWith('58')) { explicit = true; }   // «58 414 9124022» sin +
    else { d = ((opts && opts.defaultCountry) || '58') + d; }
    if (d.startsWith('0')) return bad('Código de país desconocido; escríbelo con + (p. ej. +58).', raw);
    const c = countryByDigits(d);
    if (c) {
      if (c.iso === 'VE') {
        d = '58' + d.slice(2).replace(/^0+/, '');   // «+58 0414…»: el 0 de marcación local sobra
        const f = d.charAt(2);
        if (f && f !== '2' && f !== '4') return bad('Ese número no parece de Venezuela; si es de otro país, escríbelo con + (p. ej. +1…).', raw);
      }
      const n = d.length - c.code.length;
      const min = Math.min.apply(null, c.len), max = Math.max.apply(null, c.len);
      if (n < min) return bad('Faltan dígitos: un número de ' + c.name + ' lleva ' + c.len.join(' u ') + ' después del +' + c.code + '.', '+' + d);
      if (n > max) return bad('Sobran dígitos: un número de ' + c.name + ' lleva ' + c.len.join(' u ') + ' después del +' + c.code + '.', '+' + d);
      return ok('+' + d);
    }
    if (!explicit) return bad('Código de país desconocido; escríbelo con + (p. ej. +58).', raw);
    if (d.length < 8) return bad('Faltan dígitos: un número internacional lleva entre 8 y 15.', '+' + d);
    if (d.length > 15) return bad('Sobran dígitos: un número internacional lleva entre 8 y 15.', '+' + d);
    return ok('+' + d);
  }

  // Parte un teléfono en país + número nacional con la MISMA detección que `phone` (prefijo más largo,
  // 0 tras +58, 00…). No valida: sirve para pintar el selector de país de un campo de teléfono.
  // opts.defaultCountry: ISO («VE») o código («58»). Vacío → país por defecto y national ''.
  function phoneParts(v, opts) {
    const dflt = String((opts && opts.defaultCountry) || 'VE');
    const dc = COUNTRIES.find((c) => c.iso === dflt.toUpperCase()) || COUNTRIES.find((c) => c.code === dflt) || COUNTRIES[0];
    const raw = str(v).trim();
    let d = raw.replace(/\D/g, '');
    if (!d) return { iso: dc.iso, code: dc.code, national: '' };
    if (raw.startsWith('+')) { /* explícito */ }
    else if (d.startsWith('00')) d = d.slice(2);
    else if (d.startsWith('0')) d = dc.code + d.replace(/^0+/, '');
    else if (!(d.length === 12 && d.startsWith('58'))) d = dc.code + d;
    const c = countryByDigits(d);
    if (c) {
      let national = d.slice(c.code.length);
      if (c.iso === 'VE') national = national.replace(/^0+/, '');
      return { iso: c.iso, code: c.code, national };
    }
    // Fuera de la lista de países con validación: el código conocido más largo (EXTRA_CODES); si tampoco
    // está, se asume un número nacional de 10 dígitos (códigos de 1 a 3 dígitos).
    let code = '';
    for (const k of EXTRA_CODES) if (d.startsWith(k) && k.length > code.length) code = k;
    if (!code) code = d.slice(0, Math.min(3, Math.max(1, d.length - 10)));
    return { iso: '', code, national: d.slice(code.length) };
  }

  // ── documento de identidad ───────────────────────────────────────────────
  function docDigits(v) {
    return str(v).replace(/\D/g, '').replace(/^0+/, '');
  }
  // de2627: documentos por país. Sin opts.country (o con 'VE') doc() es exactamente el de siempre.
  const COUNTRY_DOCS = { VE: ['V', 'E', 'P', 'J', 'G'], CL: ['RUT', 'P'], CO: ['CC', 'CE', 'NIT', 'P'], AR: ['DNI', 'CUIT', 'P'] };
  // Lo que el servidor publica en /countries (pattern sobre el valor ya limpio: sin puntos, guiones ni espacios, en mayúsculas).
  const DOC_RULES = {
    V: { pattern: '^\\d{1,8}$', format: 'V-12345678' }, E: { pattern: '^\\d{1,9}$', format: 'E-123456789' },
    J: { pattern: '^\\d{9}$', format: 'J-12345678-9' }, G: { pattern: '^\\d{9}$', format: 'G-12345678-9' },
    P: { pattern: '^[A-Z0-9]{5,15}$', format: 'AB1234567' },
    RUT: { pattern: '^\\d{7,8}[0-9K]$', dv: 'rut', format: '12.345.678-K' },
    CC: { pattern: '^\\d{6,10}$', format: '1012345678' }, CE: { pattern: '^[A-Z0-9]{6,10}$', format: '1234567' },
    NIT: { pattern: '^\\d{7,11}$', dv: 'dian', format: '900.123.456-8' },
    DNI: { pattern: '^\\d{7,8}$', format: '12.345.678' },
    CUIT: { pattern: '^\\d{11}$', dv: 'cuit', format: '20-12345678-3' }
  };
  function rutDv(body) { let s = 0, m = 2; for (let i = body.length - 1; i >= 0; i--) { s += Number(body.charAt(i)) * m; m = m === 7 ? 2 : m + 1; } const r = 11 - (s % 11); return r === 11 ? '0' : (r === 10 ? 'K' : String(r)); }
  function nitDv(body) { const w = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71]; let s = 0; for (let i = 0; i < body.length; i++) s += Number(body.charAt(body.length - 1 - i)) * w[i]; const r = s % 11; return r > 1 ? String(11 - r) : String(r); }
  function cuitOk(d) { const w = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]; let s = 0; for (let i = 0; i < 10; i++) s += Number(d.charAt(i)) * w[i]; let r = 11 - (s % 11); if (r === 11) r = 0; return r !== 10 && r === Number(d.charAt(10)); }
  function docCountry(raw, iso, t) {
    const list = COUNTRY_DOCS[iso];
    if (!t) t = list[0];
    if (list.indexOf(t) < 0) return bad('Tipo de documento desconocido para este país (' + list.join(', ') + ').', raw);
    const c = raw.toUpperCase().replace(/[\s.\-]/g, '');
    if (t === 'P') {
      if (/^[VE][\s.-]*\d+$/i.test(raw)) return bad('Eso parece una cédula (V o E), no un pasaporte. Elige el tipo de documento correcto.', raw);
      const p = /^P[\s.-]/i.test(raw) ? c.slice(1) : c;   // «P-AB12345» → AB12345; «PA123456» se queda entero
      if (!/^[A-Z0-9]+$/.test(p)) return bad('El pasaporte lleva solo letras y números.', raw);
      if (p.length < 5 || p.length > 15) return bad('El pasaporte lleva entre 5 y 15 letras y números.', raw);
      return ok('P-' + p);
    }
    if (t === 'RUT') {
      if (!/^\d{7,8}[0-9K]$/.test(c)) return bad('El RUT lleva 7 u 8 números y un dígito verificador (0-9 o K), p. ej. 12.345.678-5.', raw);
      const body = c.slice(0, -1), dv = c.slice(-1);
      if (rutDv(body) !== dv) return bad('El dígito verificador del RUT no coincide. Revisa el número.', raw);
      return ok(body + '-' + dv);
    }
    if (t === 'NIT') {
      // Con guion, el guion separa cuerpo y DV (900.123.456-8, 12345678-9); sin guion, 9 dígitos son el cuerpo y 10 = cuerpo + DV.
      const m = raw.toUpperCase().replace(/[\s.]/g, '').match(/^(\d{6,10})-(\d)$/);
      let body, given = null;
      if (m) { body = m[1]; given = m[2]; }
      else if (/^\d{6,9}$/.test(c)) body = c;
      else if (/^\d{10}$/.test(c)) { body = c.slice(0, 9); given = c.charAt(9); }
      else return bad('El NIT lleva de 6 a 10 números y el dígito verificador (p. ej. 900.123.456-8).', raw);
      const dv = nitDv(body);
      if (given !== null && given !== dv) return bad('El dígito verificador del NIT no coincide. Revisa el número.', raw);
      return ok(body + '-' + dv);
    }
    if (t === 'CUIT') {
      if (!/^\d{11}$/.test(c)) return bad('El CUIT/CUIL lleva 11 números, p. ej. 20-12345678-3.', raw);
      if (!cuitOk(c)) return bad('El dígito verificador del CUIT/CUIL no coincide. Revisa el número.', raw);
      return ok(c);
    }
    if (t === 'CE') {
      if (!/^[A-Z0-9]{6,10}$/.test(c)) return bad('La cédula de extranjería lleva entre 6 y 10 letras y números.', raw);
      return ok(c);
    }
    if (/[^\d]/.test(c)) return bad('El documento lleva solo números.', raw);
    const d = c.replace(/^0+/, '');
    if (t === 'CC') { if (d.length < 6 || d.length > 10) return bad('La cédula de ciudadanía lleva entre 6 y 10 números.', raw); return ok(d); }
    if (t === 'DNI') { if (d.length < 7 || d.length > 8) return bad('El DNI lleva 7 u 8 números.', raw); return ok(d); }
    return bad('Tipo de documento desconocido.', raw);
  }
  function doc(v, opts) {
    const raw = str(v).trim();
    if (!raw) return ok('');
    const iso = (opts && opts.country) ? str(opts.country).trim().toUpperCase() : '';
    if (iso && iso !== 'VE' && COUNTRY_DOCS[iso]) return docCountry(raw, iso, (opts && opts.docType) ? str(opts.docType).trim().toUpperCase() : '');
    let t = (opts && opts.docType) ? String(opts.docType).toUpperCase() : '';
    let rest = raw.toUpperCase();
    const m = rest.match(/^([VEJGP])(?:[\s.-]+|(?=\d))(.*)$/);
    if (t === 'P' && /^[VE][\s.-]*\d+$/i.test(rest)) return bad('Eso parece una cédula (V o E), no un pasaporte. Elige el tipo de documento correcto.', raw);
    if (t === 'P') {
      // pasaporte: solo se quita «P-» si trae separador (P123456 puede ser el pasaporte entero)
      const mp = rest.match(/^P[\s.-]+(.*)$/);
      if (mp) rest = mp[1];
    } else if (m && (!t || m[1] === t)) {
      if (!t) t = m[1];
      rest = m[2];
    } else if (m && t && m[1] !== t) {
      return bad('El documento empieza con ' + m[1] + ' pero el tipo elegido es ' + t + '.', raw);
    }
    if (!t) return bad('Elige el tipo de documento (V, E, J, G o P).', raw);
    if (!'VEJGP'.includes(t)) return bad('Tipo de documento desconocido (V, E, J, G o P).', raw);
    if (t === 'P') {
      const p = rest.replace(/[\s.-]/g, '');
      if (!/^[A-Z0-9]+$/.test(p)) return bad('El pasaporte lleva solo letras y números.', raw);
      if (p.length < 5) return bad('Faltan caracteres: el pasaporte lleva entre 5 y 15.', raw);
      if (p.length > 15) return bad('Sobran caracteres: el pasaporte lleva entre 5 y 15.', raw);
      return ok('P-' + p);
    }
    if (/[^\d\s.-]/.test(rest)) return bad('El documento lleva solo números después de la letra.', raw);
    const d = rest.replace(/\D/g, '');
    if (t === 'J' || t === 'G') {
      let x = d;
      if (x.length > 9) x = x.replace(/^0+/, '');
      if (x.length < 9) return bad('Faltan dígitos: el RIF (' + t + ') lleva 8 números y un dígito verificador, p. ej. ' + t + '-12345678-9.', raw);
      if (x.length > 9) return bad('Sobran dígitos: el RIF (' + t + ') lleva 8 números y un dígito verificador, p. ej. ' + t + '-12345678-9.', raw);
      return ok(t + '-' + x.slice(0, 8) + '-' + x.slice(8));
    }
    const max = t === 'V' ? 8 : 9;
    const n = d.replace(/^0+/, '');
    if (!n) return bad('Escribe el número del documento.', raw);
    if (n.length > max) return bad('Sobran dígitos: la cédula ' + t + ' lleva hasta ' + max + ' números.', raw);
    return ok(t + '-' + n);
  }

  // ── fecha ────────────────────────────────────────────────────────────────
  function realDate(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    const y = +m[1], mo = +m[2], da = +m[3];
    const dt = new Date(Date.UTC(y, mo - 1, da));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== da) return null;
    return { y, mo, da };
  }
  function todayISO(opts) {
    if (opts && opts.today) return String(opts.today);
    if (opts && opts.timezone) { try { return new Intl.DateTimeFormat('en-CA', { timeZone: opts.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); } catch (e) { /* zona inválida: reloj local */ } }
    const n = new Date();
    return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
  }
  function ageOn(d, todayStr) {
    const t = realDate(todayStr);
    let a = t.y - d.y;
    if (t.mo < d.mo || (t.mo === d.mo && t.da < d.da)) a--;
    return a;
  }
  function date(v, opts) {
    opts = opts || {};
    const s = str(v).trim();
    if (!s) return ok('');
    const d = realDate(s);
    if (!d) return bad('Escribe una fecha real con el formato AAAA-MM-DD.', s);
    if (opts.min && s < opts.min) return bad('La fecha no puede ser anterior al ' + opts.min + '.', s);
    if (opts.max && s > opts.max) return bad('La fecha no puede ser posterior al ' + opts.max + '.', s);
    if (opts.birth) {
      const today = todayISO(opts);
      if (s > today) return bad('La fecha de nacimiento no puede ser futura.', s);
      const age = ageOn(d, today);
      const lo = opts.staff ? 15 : 0, hi = opts.staff ? 100 : 120;
      if (age < lo || age > hi) return bad('La edad debe estar entre ' + lo + ' y ' + hi + ' años.', s);
    }
    return ok(s);
  }

  // ── nombre ───────────────────────────────────────────────────────────────
  function name(v) {
    const s = str(v).trim().replace(/\s+/g, ' ');
    if (!s) return ok('');
    if (s.length > 60) return bad('El nombre es demasiado largo (máximo 60 caracteres).', s);
    if (!/^[\p{L}][\p{L}\s'’-]*$/u.test(s)) return bad('Un nombre no lleva números ni símbolos.', s);
    if (s === s.toUpperCase() || s === s.toLowerCase()) return ok(s.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()));
    return ok(s);
  }

  // ── número ───────────────────────────────────────────────────────────────
  function number(v, opts) {
    opts = opts || {};
    if (typeof v === 'number') v = isFinite(v) ? String(v) : 'x';
    let s = str(v).trim().replace(/\s/g, '');
    if (!s) return ok('');
    const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
    if (lc >= 0 && ld >= 0) {
      const dec = lc > ld ? ',' : '.', mil = dec === ',' ? '.' : ',';
      if (s.split(dec).length > 2) return bad('Escribe un número válido.', s);
      s = s.split(mil).join('').replace(dec, '.');
    } else if (lc >= 0) {
      if (s.split(',').length > 2) return bad('Escribe un número válido.', s);
      s = s.replace(',', '.');
    }
    if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return bad('Escribe un número válido.', s);
    const n = Number(s);
    if (!isFinite(n)) return bad('Escribe un número válido.', s);
    if (opts.int && !Number.isInteger(n)) return bad('Escribe un número entero, sin decimales.', s);
    if (opts.min !== undefined && n < opts.min) return bad('El mínimo es ' + opts.min + '.', n);
    if (opts.max !== undefined && n > opts.max) return bad('El máximo es ' + opts.max + '.', n);
    return ok(n);
  }

  // ── enlace ───────────────────────────────────────────────────────────────
  function url(v) {
    let s = str(v).trim();
    if (!s) return ok('');
    if (/\s/.test(s)) return bad('El enlace no lleva espacios.', s);
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^[^/]*\.[^/]*:\d/.test(s)) return bad('El enlace debe empezar con http:// o https://.', s);
      s = 'https://' + s;
    }
    let u;
    try { u = new URL(s); } catch (e) { return bad('Escribe un enlace válido, como https://ejemplo.com.', s); }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return bad('El enlace debe empezar con http:// o https://.', s);
    if (u.hostname.indexOf('.') < 1 || u.hostname.endsWith('.')) return bad('Escribe un enlace válido, como https://ejemplo.com.', s);
    return ok(s);
  }

  // ── instagram ────────────────────────────────────────────────────────────
  function instagram(v) {
    let s = str(v).trim().toLowerCase();
    if (!s) return ok('');
    s = s.replace(/^https?:\/\//, '').replace(/^(www\.)?instagram\.com\//, '').replace(/[/?#].*$/, '').replace(/^@/, '');
    if (!/^[a-z0-9._]{1,30}$/.test(s)) return bad('Usuario de Instagram no válido: letras, números, punto y guion bajo (máximo 30).', s);
    return ok(s);
  }

  // ── credenciales: misma política de hoy (cima-server/index.js, validateUsername/validatePassword) ──
  function username(v) {
    const u = str(v).toLowerCase().trim();
    if (!u) return ok('');
    if (u.length < 3) return bad('El nombre de usuario debe tener al menos 3 caracteres', u);
    if (u.length > 32) return bad('El nombre de usuario no puede exceder 32 caracteres', u);
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(u)) return bad('Usa solo minúsculas, números y . _ - (empezando con letra o número)', u);
    return ok(u);
  }
  function password(v) {
    const pw = str(v);
    if (!pw) return ok('');
    if (pw.length < 8) return bad('La contraseña debe tener al menos 8 caracteres', pw);
    if (!/[A-Z]/.test(pw)) return bad('La contraseña debe incluir al menos una mayúscula', pw);
    if (!/[0-9]/.test(pw)) return bad('La contraseña debe incluir al menos un número', pw);
    return ok(pw);
  }

  // ── texto libre ──────────────────────────────────────────────────────────
  function text(v, opts) {
    const max = (opts && opts.max) || 200;
    const s = str(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
    if (s.length > max) return bad('Es demasiado largo (máximo ' + max + ' caracteres).', s);
    return ok(s);
  }

  // ── teléfono canónico tolerante (motor de core, de2818) ───────────────────
  // Distinto de phone(): phone() VALIDA con el largo de cada país y devuelve mensajes; phoneCanon() solo NORMALIZA lo que ya
  // está guardado o llega sucio (importaciones, páginas públicas) y devuelve '+{código}{número}' o null (7 a 15 dígitos).
  // `home` = país del consultorio: ISO («VE») o fila {dial, trunk, nsn_min, nsn_max}; lo usan los números escritos sin «+».
  // Es EL motor de core (_phoneCanon) movido aquí: misma lógica, misma tabla de países con prefijo de marcación local.
  const PHONE_HOMES = [
    { code: 'VE', dial: '58', trunk: '0', nsn_min: 10, nsn_max: 10 },
    { code: 'CO', dial: '57', trunk: '',  nsn_min: 10, nsn_max: 10 },
    { code: 'CL', dial: '56', trunk: '',  nsn_min: 9,  nsn_max: 9 },
    { code: 'AR', dial: '54', trunk: '0', nsn_min: 10, nsn_max: 11 }
  ];
  function phoneCanon(raw, home) {
    if (typeof home === 'string') { const iso = home.trim().toUpperCase(); home = PHONE_HOMES.find((c) => c.code === iso) || null; }
    let s = str(raw).trim().replace(/[\s().-]/g, '');
    if (s.startsWith('00')) s = '+' + s.slice(2);
    if (!/^\+?\d+$/.test(s)) return null;
    let d = s.replace(/\D/g, '');
    if (s.startsWith('+')) {
      let best = null;
      for (const c of PHONE_HOMES) { const dl = c.dial; if (dl && dl !== '1' && d.startsWith(dl) && (!best || dl.length > best.dial.length)) best = c; }
      if (best && best.trunk) { const rest = d.slice(best.dial.length); if (rest.startsWith(best.trunk)) d = best.dial + rest.slice(best.trunk.length); }
    } else if (home) {
      const dl = String(home.dial || ''), tr = String(home.trunk || '');
      if (dl && tr && d.startsWith(dl + tr)) d = dl + d.slice(dl.length + tr.length);   // «58 0414…» sin «+»
      else if (tr && d.startsWith(tr)) { d = d.slice(tr.length); if (d.length < (home.nsn_min || 10) || d.length > (home.nsn_max || 10)) return null; d = dl + d; }
      else if (d.length >= (home.nsn_min || 10) && d.length <= (home.nsn_max || 10)) d = dl + d;
      else if (dl && d.startsWith(dl) && d.length >= dl.length + (home.nsn_min || 10)) { /* ya trae el código de país sin «+» */ }
      else return null;
    } else return null;
    if (d.length < 8 || d.length > 15) return null;
    let own = null;
    for (const c of PHONE_HOMES) if (d.startsWith(c.dial) && (!own || c.dial.length > own.dial.length)) own = c;
    if (own) { const n = d.length - own.dial.length; if (n < own.nsn_min || n > own.nsn_max) return null; if (own.code === 'VE' && ['2', '4'].indexOf(d.charAt(2)) < 0) return null; }
    return '+' + d;   // más estricto que _phoneCanon de core (7 a 15 sin largo por país): lo que devuelve siempre pasa check('phone')
  }

  // ── sexo (absorbe CimaFieldCatalog.normSex del escritorio, de2846) ───────
  // Se guarda F | M | '' . NUNCA se deduce del título (Dr./Dra.). «Prefiero no decir» = vacío.
  const SEX = [{ v: 'F', t: 'Femenino' }, { v: 'M', t: 'Masculino' }];
  function normSex(v) {
    const s = str(v).trim().toLowerCase();
    if (!s) return '';
    if (/^(f|fem|femenino|femenina|mujer|woman|female)$/.test(s)) return 'F';
    if (/^(m|mas|masculino|hombre|varon|varón|man|male)$/.test(s)) return 'M';
    return '';
  }
  function sex(v) {
    const s = str(v).trim().toLowerCase();
    if (!s) return ok('');
    if (/^(prefiero no decir|no (dec|sab|resp)\w*|n\/?a|otro|ninguno)$/.test(s)) return ok('');
    const n = normSex(v);
    return n ? ok(n) : bad('El sexo es F (femenino) o M (masculino); puede quedar vacío.', s);
  }

  // ── país (ISO 3166-1 alfa-2; nunca texto libre) ──────────────────────────
  const _strip = (s) => str(s).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  const ISO2 = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
  function country(v) {
    const raw = str(v).trim();
    if (!raw) return ok('');
    const up = raw.toUpperCase();
    if (up === 'UK') return ok('GB');
    if (/^[A-Z]{2}$/.test(up)) return ISO2.indexOf(up) >= 0 ? ok(up) : bad('«' + up + '» no es un código de país ISO (VE, CO, CL…).', raw);
    const k = _strip(raw);
    const byName = (k === 'estados unidos' || k === 'usa' || k === 'ee.uu.' || k === 'eeuu') ? COUNTRIES.find((c) => c.iso === 'US') : COUNTRIES.find((c) => _strip(c.name) === k);
    return byName ? ok(byName.iso) : bad('El país se guarda con su código de 2 letras (VE, CO, CL…).', raw);
  }

  // ── tipo de documento: viejo → código (de2846; «Cedula» → V, «Otro» → vacío) ──
  function normDocType(t, iso) {
    const u = str(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase().replace(/[.\s]/g, '');
    const list = COUNTRY_DOCS[str(iso).trim().toUpperCase()] || COUNTRY_DOCS.VE;
    if (!u || u === 'OTRO' || u === 'OTHER') return '';
    let r = u;
    if (u === 'CEDULA' || u === 'CI' || u === 'VENEZOLANO') r = list[0];
    else if (u === 'EXTRANJERO') r = 'E';
    else if (u === 'PASAPORTE' || u === 'PASSPORT') r = 'P';
    return list.indexOf(r) >= 0 ? r : '';
  }

  function doc_type(v, opts) {
    const iso = str(opts && opts.country).trim().toUpperCase();
    const c = normDocType(v, iso);
    return c ? ok(c) : (str(v).trim() ? bad('Tipo de documento desconocido para este país.', str(v)) : ok(''));
  }
  const TYPES = {
    email, phone, doc, date, name, number, url, instagram, username, password, text, sex, country,
    birth: (v, o) => date(v, Object.assign({}, o, { birth: true })),
    doc_type,
    // ids del catálogo (catalog.json) → el mismo validador
    birthdate: (v, o) => date(v, Object.assign({}, o, { birth: true })),
    doc_number: doc, tax_id: doc, phone2: phone, emerg_phone: phone, whatsapp: phone
  };

  function check(type, value, opts) {
    opts = opts || {};
    const fn = TYPES[type];
    if (!fn) return bad('Tipo de campo desconocido: ' + type + '.');
    const empty = value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
    if (empty) return opts.required ? bad('Este dato es obligatorio.') : ok('');
    return fn(value, opts);
  }

  function checkAll(fields) {
    const values = {}, errors = {};
    let all = true;
    for (const k of Object.keys(fields || {})) {
      const f = fields[k] || {};
      const r = check(f.type, f.value, f.opts);
      values[k] = r.value;
      if (!r.ok) { all = false; errors[k] = r.msg; }
    }
    return { ok: all, values, errors };
  }

  const FR = { check, checkAll, docDigits, phoneParts, phoneCanon, normSex, normDocType, EMAIL_RE, SEX, ISO2, PHONE_HOMES, COUNTRIES, COUNTRY_DOCS, DOC_RULES, TYPES: Object.keys(TYPES) };
  if (typeof module === 'object' && module && module.exports) module.exports = FR;
  root.FieldRules = FR;
})(typeof globalThis !== 'undefined' ? globalThis : this);
