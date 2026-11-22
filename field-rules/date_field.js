/**
 * CIMA — Coordinador Inteligente de Monitoreo Avanzado
 * Archivo  : app/ui/date_field.js
 * Función  : de3026 — Campo de fecha propio (día / mes / año) que REEMPLAZA al selector nativo del navegador
 *            (mm/dd/aaaa y calendario estilo Windows 95). Todo <input type="date"> del escritorio, existente o
 *            que se agregue después, se convierte solo: el input original queda oculto con su valor AAAA-MM-DD
 *            (leer/escribir .value, eventos input/change, min, max, required, disabled y readonly siguen igual),
 *            y a su lado se dibujan tres casillas: día (número), mes (con el nombre del idioma de la interfaz) y año.
 *            Una fecha solo se entrega cuando es real del calendario (30 de febrero no existe). Colores del tema.
 *            Opt-out: data-native-date en el input.
 * Autores  : CIMA Development Group
 * Copyright: © 2024–2026 CIMA Development Group. Todos los derechos reservados.
 */
(function () {
    'use strict';
    if (window.CimaDateField) return;

    var VD = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    function t(s) { return (window.t ? window.t(s) : s); }
    function lang() { try { return (window.CimaI18n && window.CimaI18n.lang()) || 'es'; } catch (e) { return 'es'; } }
    function monthNames() {
        var out = [];
        for (var m = 0; m < 12; m++) {
            try { out.push(new Date(2024, m, 1).toLocaleDateString(lang(), { month: 'short' }).replace('.', '')); }
            catch (e) { out.push(String(m + 1)); }
        }
        return out;
    }
    function pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }
    function realDate(y, m, d) {
        if (!(y >= 1000 && y <= 9999 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return false;
        var dt = new Date(y, m - 1, d);
        return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
    }

    function injectCss() {
        if (document.getElementById('cdf-css')) return;
        var st = document.createElement('style'); st.id = 'cdf-css';
        st.textContent =
            '.cdf{display:flex;align-items:center;gap:6px;width:100%;box-sizing:border-box;min-width:0}' +
            '.cdf-p{box-sizing:border-box;min-width:0;background:transparent;border:1px solid var(--glass-border);color:var(--text-main);' +
            'border-radius:8px;padding:7px 8px;font-size:.84rem;font-family:inherit;text-align:center;outline:none}' +
            '.cdf-p:focus{border-color:var(--primary)}' +
            '.cdf-d{flex:0 0 3.4em}.cdf-y{flex:0 0 4.8em}.cdf-m{flex:1 1 5em}' +
            '.cdf.is-bad .cdf-p{border-color:var(--danger,var(--accent))}' +
            '.cdf.is-off .cdf-p{opacity:.55;pointer-events:none}' +
            '.cdf-sum{display:none;flex:1 1 auto;min-width:0;text-align:left;background:transparent;border:1px solid var(--glass-border);color:var(--text-main);' +
            'border-radius:8px;padding:7px 10px;font-size:.84rem;font-family:inherit;cursor:text}' +
            '.cdf.show-sum .cdf-sum{display:block}.cdf.show-sum .cdf-p{display:none}' +
            '.cdf-btn{flex:0 0 auto;background:transparent;border:1px solid var(--glass-border);color:var(--text-muted);border-radius:8px;padding:6px 8px;cursor:pointer;line-height:1}' +
            '.cdf-btn:hover{color:var(--text-main);border-color:var(--primary)}' +
            '.cdf-cal{position:absolute;z-index:99995;width:248px;box-sizing:border-box;padding:10px;border-radius:12px;background:var(--glass-bg);' +
            'border:1px solid var(--glass-border);color:var(--text-main);box-shadow:0 10px 30px color-mix(in srgb, var(--text-main) 22%, transparent);backdrop-filter:blur(14px)}' +
            '.cdf-cal.is-fixed{position:fixed}' +
            '.cdf-ch{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:6px;font-weight:600;font-size:.86rem}' +
            '.cdf-ch button{background:none;border:0;color:inherit;cursor:pointer;padding:4px 8px;border-radius:6px;font-size:1rem}' +
            '.cdf-ch button:hover{background:color-mix(in srgb, var(--primary) 18%, transparent)}' +
            '.cdf-g{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center;font-size:.78rem}' +
            '.cdf-g .w{color:var(--text-muted);font-size:.68rem;padding:3px 0;text-transform:uppercase}' +
            '.cdf-g button{background:none;border:0;color:inherit;cursor:pointer;padding:6px 0;border-radius:6px;font-family:inherit;font-size:.78rem}' +
            '.cdf-g button:hover:not(:disabled){background:color-mix(in srgb, var(--primary) 20%, transparent)}' +
            '.cdf-g button.is-today{outline:1px solid var(--primary)}' +
            '.cdf-g button.is-sel{background:var(--primary);color:var(--primary-text,#fff)}' +
            '.cdf-g button:disabled{opacity:.3;cursor:default}';
        document.head.appendChild(st);
    }

    function enhance(inp) {
        if (!inp || inp._cdf || inp.type !== 'date' || inp.hasAttribute('data-native-date')) return;
        injectCss();
        var wrap = document.createElement('span'); wrap.className = 'cdf';
        var names = monthNames();
        var d = document.createElement('input'), mo = document.createElement('input'), y = document.createElement('input');
        d.className = 'cdf-p cdf-d'; y.className = 'cdf-p cdf-y';
        mo.className = 'cdf-p cdf-m';
        [d, y].forEach(function (x) { x.type = 'text'; x.inputMode = 'numeric'; x.autocomplete = 'off'; });
        mo.type = 'text'; mo.autocomplete = 'off'; mo.maxLength = 10; 
        d.maxLength = 2; y.maxLength = 4;
        d.placeholder = t('Día'); y.placeholder = t('Año');
        d.setAttribute('aria-label', t('Día')); y.setAttribute('aria-label', t('Año')); mo.setAttribute('aria-label', t('Mes'));
        mo.placeholder = t('Mes');
        // Mes: acepta 1–12 o el nombre (o sus primeras letras). Se guarda el número en mo._n y se muestra el nombre al salir.
        function monthOf(txt) {
            txt = String(txt || '').trim().toLowerCase().replace('.', '');
            if (!txt) return 0;
            if (/^\d{1,2}$/.test(txt)) { var n = +txt; return n >= 1 && n <= 12 ? n : 0; }
            var hit = 0, cnt = 0;
            names.forEach(function (nm, i) { var a = nm.toLowerCase().replace('.', ''); if (a.indexOf(txt) === 0 || txt.indexOf(a) === 0) { hit = i + 1; cnt++; } });
            return cnt === 1 ? hit : 0;
        }
        function monthVal() { return monthOf(mo.value); }
        var cb = document.createElement('button'); cb.type = 'button'; cb.className = 'cdf-btn';
        cb.setAttribute('aria-label', t('Calendario')); cb.title = t('Calendario'); cb.innerHTML = '<i class="bi bi-calendar3"></i>';
        var sum = document.createElement('button'); sum.type = 'button'; sum.className = 'cdf-sum';
        wrap.appendChild(sum); wrap.appendChild(d); wrap.appendChild(mo); wrap.appendChild(y); wrap.appendChild(cb);
        // Si el input original trae id, las etiquetas <label for> apuntan a la casilla del día.
        if (inp.id) d.id = inp.id + '-d';
        inp.parentNode.insertBefore(wrap, inp);
        inp.style.display = 'none'; inp.tabIndex = -1;
        inp._cdf = wrap;

        var nativeSet = function (v) { VD.set.call(inp, v); };
        var minV = function () { return inp.getAttribute('min') || ''; }, maxV = function () { return inp.getAttribute('max') || ''; };
        function paintFrom(v) {
            var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || '');
            d.value = m ? String(+m[3]) : ''; mo.value = m ? names[+m[2] - 1] : ''; y.value = m ? m[1] : '';
            wrap.classList.remove('is-bad');
            if (typeof paintSum === 'function') paintSum();
        }
        // «22 nov 2026» al salir del campo (fecha completa y válida); al volver el foco se ven las tres casillas.
        function paintSum() {
            var v = VD.get.call(inp), m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
            if (!m || wrap.contains(document.activeElement) || cal) { wrap.classList.remove('show-sum'); return; }
            sum.textContent = (+m[3]) + ' ' + names[+m[2] - 1] + ' ' + m[1];
            wrap.classList.add('show-sum');
        }
        function emit() { inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); }
        function commit() {
            var dd = parseInt(d.value, 10), mm = monthVal(), yy = parseInt(y.value, 10);
            var prev = VD.get.call(inp), next = '', bad = false;
            if (!d.value && !mo.value && !y.value) next = '';
            else if (mo.value && !monthVal()) { bad = true; next = ''; }
            else if (d.value && monthVal() && y.value.length === 4) {
                if (realDate(yy, mm, dd)) {
                    next = pad(yy, 4) + '-' + pad(mm, 2) + '-' + pad(dd, 2);
                    if ((minV() && next < minV()) || (maxV() && next > maxV())) { bad = true; next = ''; }
                } else bad = true;
            } else { next = ''; }   // incompleta: no hay fecha todavía
            wrap.classList.toggle('is-bad', bad);
            if (next !== prev) { nativeSet(next); emit(); }
        }
        // Calendario propio: se monta DENTRO de la ventana dueña (nunca sobre todo el entorno).
        var cal = null;
        function closeCal() { if (cal) { cal.remove(); cal = null; document.removeEventListener('mousedown', outside, true); document.removeEventListener('keydown', escKey, true); } }
        function outside(e) { if (cal && !cal.contains(e.target) && !cb.contains(e.target)) closeCal(); }
        function escKey(e) { if (e.key === 'Escape') { e.stopPropagation(); closeCal(); } }
        function openCal() {
            if (cal) { closeCal(); return; }
            var cur = VD.get.call(inp), mm0 = /^(\d{4})-(\d{2})-(\d{2})/.exec(cur || ''), now = new Date();
            var vy = mm0 ? +mm0[1] : now.getFullYear(), vm = mm0 ? +mm0[2] - 1 : now.getMonth();
            var host = wrap.closest('[data-cima-window],.util-window'), fixed = !host;
            cal = document.createElement('div'); cal.className = 'cdf-cal' + (fixed ? ' is-fixed' : '');
            (host || document.body).appendChild(cal);
            if (host && getComputedStyle(host).position === 'static') host.style.position = 'relative';
            function paint() {
                var first = (new Date(vy, vm, 1).getDay() + 6) % 7, days = new Date(vy, vm + 1, 0).getDate();
                var title = new Date(vy, vm, 1).toLocaleDateString(lang(), { month: 'long', year: 'numeric' });
                title = title.charAt(0).toUpperCase() + title.slice(1);
                var wd = ''; for (var k = 0; k < 7; k++) wd += '<span class="w">' + new Date(2024, 0, 1 + k).toLocaleDateString(lang(), { weekday: 'narrow' }) + '</span>';
                var cells = ''; for (var b = 0; b < first; b++) cells += '<span></span>';
                var sel = mm0 ? pad(+mm0[1], 4) + '-' + pad(+mm0[2], 2) + '-' + pad(+mm0[3], 2) : '', today = pad(now.getFullYear(), 4) + '-' + pad(now.getMonth() + 1, 2) + '-' + pad(now.getDate(), 2);
                for (var n = 1; n <= days; n++) {
                    var iso = pad(vy, 4) + '-' + pad(vm + 1, 2) + '-' + pad(n, 2);
                    var off = (minV() && iso < minV()) || (maxV() && iso > maxV());
                    cells += '<button type="button" data-iso="' + iso + '"' + (off ? ' disabled' : '') + ' class="' + (iso === sel ? 'is-sel ' : '') + (iso === today ? 'is-today' : '') + '">' + n + '</button>';
                }
                cal.innerHTML = '<div class="cdf-ch"><button type="button" data-nav="-1" aria-label="‹">‹</button><span>' + title + '</span><button type="button" data-nav="1" aria-label="›">›</button></div><div class="cdf-g">' + wd + cells + '</div>';
            }
            paint();
            cal.addEventListener('click', function (e) {
                var nv = e.target.closest('[data-nav]'), db = e.target.closest('[data-iso]');
                if (nv) { vm += +nv.getAttribute('data-nav'); if (vm < 0) { vm = 11; vy--; } if (vm > 11) { vm = 0; vy++; } paint(); return; }
                if (db && !db.disabled) {
                    var q = db.getAttribute('data-iso').split('-'); d.value = String(+q[2]); mo.value = names[+q[1] - 1]; y.value = q[0];
                    wrap.classList.remove('is-bad'); commit(); closeCal(); try { d.focus(); } catch (x) {}
                }
            });
            // Posición bajo el campo, dentro de la ventana (o fija si no hay ventana).
            var r = wrap.getBoundingClientRect(), hr = host ? host.getBoundingClientRect() : { left: 0, top: 0 };
            var left = r.left - hr.left, top = r.bottom - hr.top + 4;
            var maxLeft = (host ? host.clientWidth : window.innerWidth) - 258; if (left > maxLeft) left = Math.max(4, maxLeft);
            cal.style.left = left + 'px'; cal.style.top = top + 'px';
            document.addEventListener('mousedown', outside, true); document.addEventListener('keydown', escKey, true);
        }
        cb.addEventListener('click', openCal);
        sum.addEventListener('click', function () { wrap.classList.remove('show-sum'); try { d.focus(); } catch (e) {} });
        wrap.addEventListener('focusout', function () { setTimeout(paintSum, 0); });

        d.addEventListener('input', function () { d.value = d.value.replace(/\D/g, ''); if (d.value.length === 2 && +d.value >= 1) { mo.focus(); mo.select(); } commit(); });
        y.addEventListener('input', function () { y.value = y.value.replace(/\D/g, ''); commit(); });
        mo.addEventListener('input', function () { commit(); if (/^\d{2}$/.test(mo.value) && monthVal()) y.focus(); });
        mo.addEventListener('blur', function () { var n = monthVal(); if (n) mo.value = names[n - 1]; commit(); });
        // El valor puesto por código (inp.value = 'AAAA-MM-DD') también se dibuja.
        Object.defineProperty(inp, 'value', {
            configurable: true,
            get: function () { return VD.get.call(inp); },
            set: function (v) { VD.set.call(inp, v); paintFrom(VD.get.call(inp)); }
        });
        var origFocus = inp.focus;
        inp.focus = function () { try { d.focus(); } catch (e) { origFocus.call(inp); } };
        function syncState() {
            var off = inp.disabled || inp.readOnly;
            d.disabled = y.disabled = mo.disabled = cb.disabled = !!off; wrap.classList.toggle('is-off', !!off);
            if (inp.required) { d.required = mo.required = y.required = true; }
        }
        new MutationObserver(syncState).observe(inp, { attributes: true, attributeFilter: ['disabled', 'readonly', 'required'] });
        // Si el contenedor oculta/quita el original, el campo propio lo sigue (se quita con él).
        paintFrom(VD.get.call(inp)); syncState();
    }

    function scan(root) {
        if (!root || !root.querySelectorAll) return;
        if (root.matches && root.matches('input[type="date"]')) enhance(root);
        var l = root.querySelectorAll('input[type="date"]');
        for (var i = 0; i < l.length; i++) enhance(l[i]);
    }
    function start() {
        scan(document.body);
        new MutationObserver(function (muts) {
            for (var i = 0; i < muts.length; i++) {
                var a = muts[i].addedNodes;
                for (var j = 0; j < a.length; j++) if (a[j].nodeType === 1) scan(a[j]);
            }
        }).observe(document.body, { childList: true, subtree: true });
    }
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);

    window.CimaDateField = { enhance: enhance, scan: scan };
})();
