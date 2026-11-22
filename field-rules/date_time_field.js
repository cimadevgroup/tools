/**
 * CIMA — Coordinador Inteligente de Monitoreo Avanzado
 * Archivo  : app/ui/date_time_field.js
 * Función  : Campo de fecha y hora propio que REEMPLAZA al selector nativo de <input type="datetime-local">. El input original queda
 *            oculto con su valor AAAA-MM-DDTHH:MM (leer/escribir .value, eventos input/change y min/max siguen igual); a su lado van la
 *            fecha (el campo día/mes/año de date_field.js, que debe cargarse antes) y la hora en 12 h (hora · minutos · a. m./p. m.).
 *            Se aplica a los que ya existen y a los que se agreguen. Opt-out: data-native-date en el input. Colores del tema.
 * Autores  : CIMA Development Group
 * Copyright: © 2024–2026 CIMA Development Group. Todos los derechos reservados.
 */
(function () {
    'use strict';
    if (window.CimaDateTimeField) return;

    var VD = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    function pad(n) { n = String(n); return n.length < 2 ? '0' + n : n; }
    function opts(from, to, sel, fmt) { var h = ''; for (var i = from; i <= to; i++) h += '<option value="' + i + '"' + (i === sel ? ' selected' : '') + '>' + (fmt ? fmt(i) : i) + '</option>'; return h; }

    function injectCss() {
        if (document.getElementById('cdt-css')) return;
        var st = document.createElement('style'); st.id = 'cdt-css';
        st.textContent =
            '.cdt{display:grid;gap:8px;width:100%;box-sizing:border-box;min-width:0}' +
            '.cdt-time{display:flex;gap:8px;max-width:360px}' +
            '.cdt-s{flex:1 1 0;min-width:0;min-height:44px;box-sizing:border-box;background:transparent;border:1px solid var(--glass-border);color:var(--text-main);' +
            'border-radius:8px;padding:7px 8px;font-size:1rem;font-family:inherit;outline:none;color-scheme:inherit}' +
            '.cdt-s:focus{border-color:var(--primary)}' +
            '.cdt-s option{background:var(--glass-bg,#fff);color:var(--text-main)}';
        document.head.appendChild(st);
    }

    function upgrade(inp) {
        if (!inp || inp._cdt || inp.type !== 'datetime-local' || inp.hasAttribute('data-native-date')) return;
        inp._cdt = true; injectCss();
        var wrap = document.createElement('div'); wrap.className = 'cdt';
        var d = document.createElement('input'); d.type = 'date';
        if (inp.min) d.min = inp.min.slice(0, 10);
        if (inp.max) d.max = inp.max.slice(0, 10);
        var tm = document.createElement('div'); tm.className = 'cdt-time';
        tm.innerHTML = '<select class="cdt-s cdt-h" aria-label="Hora">' + opts(1, 12, 12) + '</select>' +
            '<select class="cdt-s cdt-mi" aria-label="Minutos">' + opts(0, 59, 0, pad) + '</select>' +
            '<select class="cdt-s cdt-ap" aria-label="a. m. o p. m."><option value="0">a. m.</option><option value="1">p. m.</option></select>';
        wrap.appendChild(d); wrap.appendChild(tm);
        inp.style.display = 'none'; inp.setAttribute('tabindex', '-1');
        inp.parentNode.insertBefore(wrap, inp.nextSibling);
        var hs = tm.querySelector('.cdt-h'), ms = tm.querySelector('.cdt-mi'), as = tm.querySelector('.cdt-ap');
        var busy = false;
        function own() { return VD.get.call(inp); }
        function push() {   // visible → original
            if (busy) return;
            var h = (parseInt(hs.value, 10) % 12) + (as.value === '1' ? 12 : 0);
            var v = d.value ? d.value + 'T' + pad(h) + ':' + pad(ms.value) : '';
            if (v === own()) return;
            VD.set.call(inp, v);
            inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true }));
        }
        function pull() {   // original → visible
            busy = true;
            var m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(own() || '');
            if (m) {
                d.value = m[1];
                var h = parseInt(m[2], 10); as.value = h >= 12 ? '1' : '0'; hs.value = String(h % 12 || 12); ms.value = String(parseInt(m[3], 10));
            } else d.value = '';
            busy = false;
        }
        d.addEventListener('input', push); d.addEventListener('change', push);
        [hs, ms, as].forEach(function (s) { s.addEventListener('change', push); });
        // El código de la pantalla escribe inp.value = …: se refleja en los campos visibles.
        Object.defineProperty(inp, 'value', {
            configurable: true,
            get: function () { return VD.get.call(this); },
            set: function (v) { VD.set.call(this, v); pull(); }
        });
        pull();
    }
    function scan(root) { var r = root || document; var l = r.querySelectorAll ? r.querySelectorAll('input[type="datetime-local"]') : []; for (var i = 0; i < l.length; i++) upgrade(l[i]); }
    function start() {
        scan(document);
        new MutationObserver(function (muts) {
            muts.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) { if (n.matches && n.matches('input[type="datetime-local"]')) upgrade(n); else scan(n); } }); });
        }).observe(document.documentElement, { childList: true, subtree: true });
    }
    window.CimaDateTimeField = { upgrade: upgrade, scan: scan };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
