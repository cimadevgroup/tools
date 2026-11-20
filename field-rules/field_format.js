/* field_format.js — presentación común de campos (fuente única: tools/field-rules). Pareja de field_rules.js:
 *   FieldRules  = qué se GUARDA (check(id, v).value);   FieldFormat = cómo se MUESTRA (show(id, v, opts)).
 * Navegador: window.FieldFormat. Node/CommonJS: module.exports. Servidores (Workers): sync.sh genera field_format.mjs
 * (importa field_rules.mjs antes, que deja globalThis.FieldRules).
 *
 *   FieldFormat.show(id, v, opts)          → texto para pantalla; lo que no entiende lo devuelve tal cual (nunca lanza, nunca inventa)
 *   FieldFormat.phone('+584141234567')     → '+58 414 123 4567'          FieldFormat.tel(v) → 'tel:+584141234567'   FieldFormat.wa(v) → 'https://wa.me/584141234567'
 *   FieldFormat.doc('V-5142891')           → 'V-5142891' (RUT 12.345.678-5, NIT 900.123.456-8, DNI 12.345.678, CC 1.012.345.678)
 *   FieldFormat.date('2026-11-10')         → '10 nov 2026'               (NUNCA 10/11/2026 ni 11/10: el mes va en letras)
 *   FieldFormat.birthdate('1990-11-10', {today}) → '10 nov 1990 (36 años)'    FieldFormat.age('1990-11-10', {today}) → 36
 *   FieldFormat.instant('2026-11-10T19:45:00Z', {timezone:'America/Caracas'}) → '10 nov 2026, 15:45'
 *   FieldFormat.money({amount_minor:123450, currency:'USD'}) → '1.234,50 USD'
 *   FieldFormat.hours([{dow:1,open:'08:00',close:'17:00'},…]) → 'Lun a vie 08:00–17:00; sáb 09:00–12:00'
 *   FieldFormat.address({line1,line2,city,state,postal,country}) → una línea
 *   FieldFormat.sex('F') → 'Femenino'      FieldFormat.number(1234.5, {decimals}) → '1.234,5' (coma al mostrar)
 * dow: 1 = lunes … 7 = domingo (ISO 8601).
 */
(function (root) {
  'use strict';
  const FRref = () => root.FieldRules || (typeof require === 'function' ? (function () { try { return require('./field_rules.js'); } catch (e) { return null; } })() : null);
  const str = (v) => (v === null || v === undefined) ? '' : String(v);
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const DOWS = ['', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

  // ── teléfono ─────────────────────────────────────────────────────────────
  // Agrupación del número nacional por país (código → tamaños de grupo); lo que no está se agrupa 3-3-resto.
  const PHONE_GROUPS = { '58': [3, 3, 4], '57': [3, 3, 4], '1': [3, 3, 4], '56': [1, 4, 4], '54': [1, 2, 4, 4], '34': [3, 3, 3], '52': [2, 4, 4], '51': [3, 3, 3], '593': [2, 3, 4], '507': [4, 4], '351': [3, 3, 3], '39': [3, 3, 4] };
  function phone(v) {
    const s = str(v).trim();
    if (!/^\+\d{8,15}$/.test(s)) return s;                      // no canónico: se muestra como llegó
    const FR = FRref();
    let code = '', national = s.slice(1);
    if (FR && FR.phoneParts) { const p = FR.phoneParts(s); if (p && p.code && s.slice(1).startsWith(p.code)) { code = p.code; national = p.national; } }
    if (!code) { code = s.slice(1, 3); national = s.slice(3); }
    let groups = PHONE_GROUPS[code];
    // Argentina celular: +54 9 11 2345 6789 → el 9 va aparte; nacional de 11 dígitos con 9 delante
    if (code === '54' && !(national.length === 11 && national.charAt(0) === '9')) groups = [2, 4, 4];
    if (!groups) groups = [3, 3];
    const out = []; let i = 0;
    for (let g = 0; g < groups.length && i < national.length; g++) { out.push(national.substr(i, groups[g])); i += groups[g]; }
    if (i < national.length) out.push(national.slice(i));
    return '+' + code + ' ' + out.join(' ');
  }
  function tel(v) { const s = str(v).trim(); return /^\+\d{8,15}$/.test(s) ? 'tel:' + s : ''; }
  function wa(v) { const s = str(v).trim(); return /^\+\d{8,15}$/.test(s) ? 'https://wa.me/' + s.slice(1) : ''; }

  // ── documento ────────────────────────────────────────────────────────────
  function dots(n) { return n.replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function doc(v) {
    const s = str(v).trim();
    if (!s) return '';
    let m;
    if ((m = /^(V|E)-(\d+)$/.exec(s))) return m[1] + '-' + m[2];                 // V-5142891 (sin puntos, sin ceros)
    if ((m = /^(\d{7,8})-([0-9K])$/.exec(s))) return dots(m[1]) + '-' + m[2];     // RUT 12.345.678-5
    if ((m = /^(\d{6,10})-(\d)$/.exec(s))) return dots(m[1]) + '-' + m[2];        // NIT 900.123.456-8
    if (/^\d{11}$/.test(s)) return s.slice(0, 2) + '-' + s.slice(2, 10) + '-' + s.slice(10);   // CUIT 20-12345678-3
    if (/^\d{7,10}$/.test(s)) return dots(s);                                      // DNI / CC
    return s;                                                                      // J-12345678-9, P-AB123456…
  }

  // ── fechas ───────────────────────────────────────────────────────────────
  function parts(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str(s).trim());
    if (!m) return null;
    const y = +m[1], mo = +m[2], d = +m[3];
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return { y, mo, d };
  }
  function todayISO(opts) {
    if (opts && opts.today) return String(opts.today);
    const n = new Date();
    return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
  }
  function date(v) {
    const p = parts(v);
    return p ? p.d + ' ' + MONTHS[p.mo - 1] + ' ' + p.y : str(v);
  }
  function age(v, opts) {
    const b = parts(v), t = parts(todayISO(opts));
    if (!b || !t) return null;
    let a = t.y - b.y;
    if (t.mo < b.mo || (t.mo === b.mo && t.d < b.d)) a--;
    return a;
  }
  function birthdate(v, opts) {
    const p = parts(v);
    if (!p) return str(v);
    const a = age(v, opts);
    return date(v) + (a !== null && a >= 0 ? ' (' + (a === 1 ? '1 año' : a + ' años') + ')' : '');
  }
  // instante ISO UTC (con Z) o epoch ms → «10 nov 2026, 15:45» en la zona del consultorio (opts.timezone, IANA; sin zona = UTC)
  function instant(v, opts) {
    let dt;
    if (typeof v === 'number') dt = new Date(v);
    else if (/^\d{10,}$/.test(str(v).trim())) dt = new Date(Number(v));
    else dt = new Date(str(v).trim());
    if (isNaN(dt.getTime())) return str(v);
    const tz = (opts && opts.timezone) || 'UTC';
    let f;
    try { f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(dt); }
    catch (e) { return str(v); }
    const g = {}; f.forEach((x) => { g[x.type] = x.value; });
    const out = (+g.day) + ' ' + MONTHS[+g.month - 1] + ' ' + g.year;
    return (opts && opts.dateOnly) ? out : out + ', ' + g.hour + ':' + g.minute;
  }

  // ── dinero ───────────────────────────────────────────────────────────────
  const ZERO_DEC = { CLP: 1, JPY: 1, PYG: 1, KRW: 1, VND: 1 };
  function grouped(intStr) { return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function money(v, opts) {
    if (!v || typeof v !== 'object') return str(v);
    const cur = str(v.currency).toUpperCase();
    const minor = Number(v.amount_minor);
    if (!Number.isFinite(minor) || !Number.isInteger(minor)) return str(v.amount_minor);
    const dec = ZERO_DEC[cur] ? 0 : 2;
    const neg = minor < 0, abs = Math.abs(minor);
    const unit = dec ? Math.floor(abs / 100) : abs, frac = dec ? String(abs % 100).padStart(2, '0') : '';
    return (neg ? '-' : '') + grouped(String(unit)) + (dec ? ',' + frac : '') + (cur && !(opts && opts.noCurrency) ? ' ' + cur : '');
  }
  function number(v, opts) {
    const n = Number(v);
    if (v === '' || v === null || v === undefined || !Number.isFinite(n)) return str(v);
    const d = opts && Number.isInteger(opts.decimals) ? opts.decimals : null;
    let s = d === null ? String(n) : n.toFixed(d);
    const neg = s.startsWith('-'); if (neg) s = s.slice(1);
    const [i, f] = s.split('.');
    return (neg ? '-' : '') + grouped(i) + (f ? ',' + f : '');
  }

  // ── horario ──────────────────────────────────────────────────────────────
  function hours(v) {
    if (!Array.isArray(v) || !v.length) return '';
    const byDow = {};
    v.forEach((x) => { if (x && x.dow >= 1 && x.dow <= 7) (byDow[x.dow] = byDow[x.dow] || []).push(str(x.open) + '–' + str(x.close)); });
    const days = Object.keys(byDow).map(Number).sort((a, b) => a - b);
    const out = []; let i = 0;
    while (i < days.length) {
      let j = i;
      const key = byDow[days[i]].join(', ');
      while (j + 1 < days.length && days[j + 1] === days[j] + 1 && byDow[days[j + 1]].join(', ') === key) j++;
      const name = j === i ? DOWS[days[i]] : (j === i + 1 ? DOWS[days[i]] + ' y ' + DOWS[days[j]] : DOWS[days[i]] + ' a ' + DOWS[days[j]]);
      out.push(name + ' ' + key);
      i = j + 1;
    }
    const s = out.join('; ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // ── dirección, sexo, país ────────────────────────────────────────────────
  function countryName(iso) {
    const FR = FRref(), u = str(iso).trim().toUpperCase();
    const c = FR && FR.COUNTRIES ? FR.COUNTRIES.find((x) => x.iso === u) : null;
    return c ? c.name : u;
  }
  function address(v) {
    if (!v || typeof v !== 'object') return str(v);
    const lines = [v.line1, v.line2].map(str).map((x) => x.trim()).filter(Boolean);
    const area = [v.city, [v.state, v.postal].map(str).map((x) => x.trim()).filter(Boolean).join(' ')].map(str).map((x) => x.trim()).filter(Boolean);
    const c = str(v.country).trim() ? countryName(v.country) : '';
    return lines.concat(area, c ? [c] : []).join(', ');
  }
  function sex(v) {
    const s = str(v).trim().toUpperCase();
    return s === 'F' ? 'Femenino' : s === 'M' ? 'Masculino' : (s ? s : 'Prefiero no decir');
  }

  const SHOWERS = {
    phone, phone2: phone, emerg_phone: phone, whatsapp: phone, doc: doc, doc_number: doc, tax_id: doc,
    date, birthdate, birth: birthdate, instant, money, number, hours, opening_hours: hours, address, sex, country: countryName
  };
  function show(id, v, opts) {
    const fn = SHOWERS[id];
    if (!fn) return str(v);
    try { return fn(v, opts || {}); } catch (e) { return str(v); }
  }

  const FF = { show, phone, tel, wa, doc, date, age, birthdate, instant, money, number, hours, address, sex, countryName, MONTHS, TYPES: Object.keys(SHOWERS) };
  if (typeof module === 'object' && module && module.exports) module.exports = FF;
  root.FieldFormat = FF;
})(typeof globalThis !== 'undefined' ? globalThis : this);
