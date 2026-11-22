/**
 * CIMA — Coordinador Inteligente de Monitoreo Avanzado
 * Archivo  : app/i18n/format.js
 * Función  : CimaFormat — fechas, horas, números y dinero según el idioma y el país (sobre Intl).
 *            Locale: idioma 'en' → 'en-US' (o el locale en-* del país); idioma 'es' → CimaCountry.locale() ('es-VE' por defecto,
 *            igual que hoy). Solo lo usan las pantallas que se van traduciendo (V3.x); nada existente lo llama todavía.
 * Autores  : CIMA Development Group
 * Copyright: © 2024–2026 CIMA Development Group. Todos los derechos reservados.
 *
 * Fechas: acepta Date, milisegundos, ISO o 'YYYY-MM-DD' (esta última se toma como fecha local, sin corrimiento por UTC).
 * Para instantes UTC del worker con zona clínica sigue mandando CimaTime; aquí se puede pasar { timeZone }.
 */
(function () {
    'use strict';

    function locale() {
        var lang = (window.CimaI18n && window.CimaI18n.lang()) || 'es', loc = '';
        try { loc = (window.CimaCountry && window.CimaCountry.locale && window.CimaCountry.locale()) || ''; } catch (e) { loc = ''; }
        if (lang === 'en') return /^en(-|$)/i.test(loc) ? loc : 'en-US';
        return loc || 'es-VE';
    }

    function _date(v) {
        if (v == null || v === '') return null;
        if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
        if (typeof v === 'number') { var dn = new Date(v); return isNaN(dn.getTime()) ? null : dn; }
        var s = String(v).trim(), m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
        var d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s.replace(' ', 'T'));
        return isNaN(d.getTime()) ? null : d;
    }

    function _fmt(kind, v, opts, base) {
        var d = _date(v);
        if (!d) return '';
        var o = {}, k;
        for (k in base) o[k] = base[k];
        if (opts) for (k in opts) o[k] = opts[k];
        try { return new Intl.DateTimeFormat(locale(), o).format(d); } catch (e) { return ''; }
    }

    function date(v, opts) { return _fmt('date', v, opts, { day: 'numeric', month: 'long', year: 'numeric' }); }
    function dateShort(v, opts) { return _fmt('dateShort', v, opts, { day: 'numeric', month: 'short', year: 'numeric' }); }
    function time(v, opts) { return _fmt('time', v, opts, { hour: 'numeric', minute: '2-digit' }); }
    function dateTime(v, opts) { return _fmt('dateTime', v, opts, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }); }

    function number(n, opts) {
        var x = Number(n);
        if (n == null || n === '' || !isFinite(x)) return '';
        try { return new Intl.NumberFormat(locale(), opts || {}).format(x); } catch (e) { return String(x); }
    }

    function money(n, currency, opts) {
        var x = Number(n);
        if (n == null || n === '' || !isFinite(x)) return '';
        var o = { style: 'currency', currency: currency || 'USD' };
        if (opts) for (var k in opts) o[k] = opts[k];
        try { return new Intl.NumberFormat(locale(), o).format(x); } catch (e) { return String(x); }
    }

    window.CimaFormat = { locale: locale, date: date, dateShort: dateShort, time: time, dateTime: dateTime, number: number, money: money };
})();
