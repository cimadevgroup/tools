/* field_rules.js — validador común de campos (fuente única: tools/field-rules).
 * JavaScript puro, sin dependencias. Navegador: window.FieldRules. Node/CommonJS: module.exports.
 * Servidores (Workers, ES modules): sync.sh genera field_rules.mjs con `export default` a partir de este mismo archivo.
 *
 *   FieldRules.check(type, value, opts)  → { ok, value, msg }
 *   FieldRules.checkAll({campo:{type,value,opts}}) → { ok, values, errors:{campo:msg} }
 *   FieldRules.phoneParts(v, {defaultCountry}) → { iso, code, national }   (para el selector de país)
 *   FieldRules.COUNTRIES, FieldRules.docDigits(v)
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
  function email(v) {
    const s = str(v).trim().toLowerCase();
    if (!s) return ok('');
    if (/\s/.test(s)) return bad('El correo no lleva espacios.', s);
    if (s.length > 120) return bad('El correo es demasiado largo (máximo 120 caracteres).', s);
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(s)) return bad('Escribe un correo válido, como nombre@dominio.com.', s);
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
  function phone(v, opts) {
    const raw = str(v).trim();
    if (!raw) return ok('');
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
  function doc(v, opts) {
    const raw = str(v).trim();
    if (!raw) return ok('');
    let t = (opts && opts.docType) ? String(opts.docType).toUpperCase() : '';
    let rest = raw.toUpperCase();
    const m = rest.match(/^([VEJGP])(?:[\s.-]+|(?=\d))(.*)$/);
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
    const s = str(v).trim();
    if (s.length > max) return bad('Es demasiado largo (máximo ' + max + ' caracteres).', s);
    return ok(s);
  }

  const TYPES = {
    email, phone, doc, date, name, number, url, instagram, username, password, text,
    birth: (v, o) => date(v, Object.assign({}, o, { birth: true }))
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

  const FR = { check, checkAll, docDigits, phoneParts, COUNTRIES, TYPES: Object.keys(TYPES) };
  if (typeof module === 'object' && module && module.exports) module.exports = FR;
  root.FieldRules = FR;
})(typeof globalThis !== 'undefined' ? globalThis : this);
