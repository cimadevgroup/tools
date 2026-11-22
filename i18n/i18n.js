/**
 * CIMA — Coordinador Inteligente de Monitoreo Avanzado
 * Archivo  : app/i18n/i18n.js
 * Función  : Traducción de la interfaz (V3.0 de VitalCase). Estilo gettext: el TEXTO EN ESPAÑOL ES LA CLAVE.
 *              t('Nueva cita')                        → 'Nueva cita' (es) / 'New appointment' (en)
 *              t('Hola {n}', { n: nombre })           → interpolación
 *              t('{n} cita|{n} citas', { n: 3 })      → plural (Intl.PluralRules); también tn(clave, n, vars)
 *              t('agenda::Bloquear')                  → CLAVE CON CONTEXTO «contexto::texto»: en es devuelve 'Bloquear' (sin el prefijo);
 *                                                       en en busca la entrada 'agenda::Bloquear' ('Block'). Para el mismo texto en español
 *                                                       con otro sentido (Bloquear = Lock/Block, Nombre = First name/Name). El contexto es
 *                                                       minúsculas/guion y NO se muestra jamás; una clave contextual sin entrada NO cae a la
 *                                                       clave simple (saldría con el sentido equivocado): sale en español y queda en missing().
 * Autores  : CIMA Development Group
 * Copyright: © 2024–2026 CIMA Development Group. Todos los derechos reservados.
 *
 * Lo que se GUARDA o viaja (sessionStorage, localStorage, servidor) lleva la CLAVE en español (CimaI18n.k('…'), con sus variables
 *   aparte) y se traduce al MOSTRAR con t(). Nunca se guarda el resultado de t(): cambiaría con el idioma. k() es la identidad.
 *
 * Reglas:
 *   · Con idioma 'es' (o sin traducción) t() devuelve EL MISMO español: CIMA no cambia ni puede romperse por un texto
 *     faltante. No hay diccionario español.
 *   · Idioma activo = preferencia (localStorage 'cima_ui_lang') → idioma por defecto → 'es'.
 *     Por defecto: window.CIMA_I18N.defaultLang si la app lo define; si no, la marca (VitalCase = en, CIMA = es),
 *     que sale de window.CIMA_BRAND si existe (V2) y, mientras no, del nombre del dominio.
 *   · CONFIGURACIÓN opcional: la app define ANTES de cargar este script  window.CIMA_I18N = { defaultLang: 'es', keyPrefix: 'vc_' }.
 *     defaultLang fija el idioma por defecto; keyPrefix se antepone a la clave de localStorage ('cima_ui_lang'). Sin esa global,
 *     el comportamiento es el de CIMA Escritorio. El prefijo debe estar ya definido al cargar el script (se lee una sola vez).
 *   · La ruta de en.js se calcula SIEMPRE desde la URL de este mismo script (la carpeta donde vive), nunca absoluta.
 *   · Diccionario en app/i18n/en.js (español → inglés); se carga SOLO si el idioma es 'en'.
 *   · t() devuelve texto plano: quien lo meta en innerHTML con variables debe escapar esas variables.
 *   · NO es el widget de Google Translate (ui/i18n.js, window.I18n, clave 'cima_lang'): ese sigue aparte.
 * ES5 a propósito (igual que domain_bridge.js).
 */
(function () {
    'use strict';

    var LANGS = ['es', 'en'];
    var CFG = (typeof window.CIMA_I18N === 'object' && window.CIMA_I18N) || {};   // configuración opcional de la app (ver cabecera)
    var KEY = (typeof CFG.keyPrefix === 'string' ? CFG.keyPrefix : '') + 'cima_ui_lang';
    var dict = {};            // { en: { 'Texto en español': 'Text in English' } }
    var missing = [];         // claves sin traducción pedidas con idioma distinto de es (solo diagnóstico)
    var hasOwn = Object.prototype.hasOwnProperty;

    function _store() { try { return window.localStorage; } catch (e) { return null; } }

    function _brandLang() {
        if (typeof CFG.defaultLang === 'string' && LANGS.indexOf(CFG.defaultLang) >= 0) return CFG.defaultLang;
        try {
            var b = String(window.CIMA_BRAND || '').toLowerCase();
            if (!b) b = /vitalcase/i.test(window.location.hostname || '') ? 'vitalcase' : 'cima';
            return b === 'vitalcase' ? 'en' : 'es';
        } catch (e) { return 'es'; }
    }

    function _resolve() {
        var s = _store(), v = null;
        try { v = s && s.getItem(KEY); } catch (e) { v = null; }
        if (v && LANGS.indexOf(v) >= 0) return v;
        return _brandLang();
    }

    var active = _resolve();

    function _plural(lang, n) {
        // Formas: [0] = singular, [1] = plural. Solo hay dos idiomas por ahora.
        try { return new Intl.PluralRules(lang).select(n) === 'one' ? 0 : 1; } catch (e) { return n === 1 ? 0 : 1; }
    }

    function _fill(s, vars, lang) {
        if (!vars) return s;
        if (typeof vars.n === 'number' && s.indexOf('|') >= 0) {
            var forms = s.split('|');
            s = forms[Math.min(_plural(lang || active, vars.n), forms.length - 1)];
        }
        return s.replace(/\{(\w+)\}/g, function (m, name) {
            return (hasOwn.call(vars, name) && vars[name] != null) ? String(vars[name]) : m;
        });
    }

    var CTX = /^[a-z][a-z0-9-]*::/;

    // Texto mostrado (idioma ≠ es) → su español de origen, con las variables ya puestas. Para decidir por el ESPAÑOL (p. ej. el tipo de
    // un aviso) en lugar de por el texto traducido. Solo se llena con idioma ≠ es; con es, src() devuelve el mismo texto.
    // También con variables en es (parts() permite guardar clave + variables y traducir al mostrar, p. ej. la campana).
    var rev = {}, revN = 0;

    function _noCtx(key) { var m = CTX.exec(key); return m ? key.slice(m[0].length) : key; }

    // { k: clave, v: variables|null } del que salió un texto mostrado (idioma ≠ es, o con variables); null si no se conoce.
    function parts(text) {
        if (typeof text !== 'string' || !hasOwn.call(rev, text)) return null;
        var p = rev[text];
        return { k: p.k, v: p.v || null };
    }

    function src(text) {
        if (typeof text !== 'string' || !hasOwn.call(rev, text)) return text;
        var p = rev[text];
        return _fill(_noCtx(p.k), p.v, 'es');
    }

    function t(key, vars) {
        if (typeof key !== 'string') return key;
        var s = key;
        var m = CTX.exec(key);
        if (m) s = key.slice(m[0].length);   // en es (y sin traducción) se muestra el texto sin el contexto
        if (active !== 'es') {
            var d = dict[active];
            if (d && hasOwn.call(d, key) && d[key]) s = d[key];
            else if (missing.length < 500 && missing.indexOf(key) < 0) missing.push(key);
        }
        var out = _fill(s, vars);
        if ((active !== 'es' && out !== key) || vars) {
            if (revN >= 3000) { rev = {}; revN = 0; }
            if (!hasOwn.call(rev, out)) revN++;
            rev[out] = { k: key, v: vars || null };
        }
        return out;
    }

    // Marca una CLAVE que se GUARDA (sessionStorage, localStorage, servidor) y se traducirá al MOSTRAR con t(): devuelve la clave tal cual.
    // El verificador la cuenta como clave (necesita entrada en en.js). Nunca guardes t(...) ya traducido.
    function k(key) { return key; }

    function tn(key, n, vars) {
        var v = { n: n };
        if (vars) for (var k in vars) if (hasOwn.call(vars, k)) v[k] = vars[k];
        return t(key, v);
    }

    function add(lang, entries) {
        if (!entries) return;
        var d = dict[lang] || (dict[lang] = {});
        for (var k in entries) if (hasOwn.call(entries, k)) d[k] = entries[k];
    }

    function setLang(lang, noReload) {
        if (LANGS.indexOf(lang) < 0) return false;
        var s = _store();
        try { if (s) s.setItem(KEY, lang); } catch (e) { /* sin almacenamiento: no persiste */ }
        if (!noReload) { try { window.location.reload(); } catch (e) { /* nada */ } }
        return true;
    }

    // Selector de idioma. NO se monta en ninguna pantalla: la UI lo pedirá cuando Miguel lo apruebe (solo cuenta demo).
    function selector() {
        var sel = document.createElement('select');
        sel.className = 'cima-lang-select';
        [['es', 'Español'], ['en', 'English']].forEach(function (o) {
            var op = document.createElement('option');
            op.value = o[0]; op.textContent = o[1];
            if (o[0] === active) op.selected = true;
            sel.appendChild(op);
        });
        sel.addEventListener('change', function () { setLang(sel.value); });
        return sel;
    }

    window.CimaI18n = {
        t: t, tn: tn, k: k, src: src, parts: parts, add: add, setLang: setLang, selector: selector,
        lang: function () { return active; },
        langs: function () { return LANGS.slice(); },
        missing: function () { return missing.slice(); }
    };
    window.t = t;
    window.tn = tn;

    // El diccionario inglés se carga solo si hace falta (script síncrono: queda listo antes de los módulos).
    if (active !== 'es') {
        try { document.documentElement.setAttribute('lang', active); } catch (e) { /* nada */ }
        var cs = document.currentScript, v = '';
        try { var m = cs && /[?&]v=([^&]+)/.exec(cs.src); if (m) v = '?v=' + m[1]; } catch (e) { v = ''; }
        // Ruta relativa al propio i18n.js (la app puede vivir en la raíz o bajo un prefijo: /mobile/, /vc/): nunca absoluta.
        var url = (cs && cs.src ? cs.src.replace(/[^\/?#]*(?:[?#].*)?$/, '') : '/app/i18n/') + active + '.js' + v;
        if (document.readyState === 'loading') {
            document.write('<script src="' + url + '"><\/script>');
        } else {
            var el = document.createElement('script');
            el.src = url;
            document.head.appendChild(el);
        }
    }
})();
