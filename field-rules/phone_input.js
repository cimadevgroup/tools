/* phone_input.js — campo de teléfono con selector de país (fuente única: tools/field-rules). Solo navegador.
 * Necesita FieldRules (field_rules.js) cargado antes. No cambia el id ni el name del input.
 *
 *   PhoneInput.attach(inputEl, { country: 'VE' }) → inputEl.frPhone
 *   inputEl.frPhone.get()     → { ok, value, msg }   (value = E.164, '' si está vacío)
 *   inputEl.frPhone.full()    → '+584149124022' tal como está escrito (sin validar) o ''
 *   inputEl.frPhone.set(v)    → separa un valor completo (+…, 00…, 0414…) en país + número nacional
 *
 * El selector lleva «VE +58»; el input muestra solo el número nacional. Si la persona pega o escribe un
 * número con + o 00, el selector cambia solo. Sin colores fijos: clases y variables del tema.
 */
(function (root) {
  'use strict';

  var cssDone = false;
  function css() {
    if (cssDone || !root.document) return;
    cssDone = true;
    var st = root.document.createElement('style');
    st.textContent =
      '.fr-phone{display:flex;gap:6px;align-items:stretch;min-width:0;width:100%}' +
      '.fr-phone>.fr-phone-cc{flex:0 0 auto;width:auto;max-width:44%;min-width:0;padding-left:8px;padding-right:22px}' +
      '.fr-phone>input{flex:1 1 0;min-width:0;width:auto}' +
      '.fr-phone.fr-phone-bad>input{border-color:var(--danger,#ef4444)}';
    root.document.head.appendChild(st);
  }

  function attach(input, opts) {
    var FR = root.FieldRules;
    if (!input || !FR) return null;
    if (input.frPhone) return input.frPhone;
    css();
    opts = opts || {};
    var dflt = String(opts.country || 'VE');

    var wrap = root.document.createElement('span');
    wrap.className = 'fr-phone';
    var sel = root.document.createElement('select');
    sel.className = 'form-select fr-phone-cc';
    sel.setAttribute('aria-label', 'País del teléfono');
    FR.COUNTRIES.forEach(function (c) {
      var o = root.document.createElement('option');
      o.value = c.iso; o.dataset.code = c.code; o.textContent = c.iso + ' +' + c.code;
      sel.appendChild(o);
    });
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(sel);
    wrap.appendChild(input);
    input.removeAttribute('onblur');   // formatPhone(this) trataría el número nacional como completo
    input.setAttribute('inputmode', 'tel');
    input.autocomplete = 'tel-national';

    function code() { var o = sel.options[sel.selectedIndex]; return o ? o.dataset.code : ''; }
    function pick(p) {
      var key = p.iso || ('+' + p.code);
      var found = null;
      for (var i = 0; i < sel.options.length; i++) if (sel.options[i].value === key) found = sel.options[i];
      if (!found) {   // código fuera de la lista: se agrega como opción
        found = root.document.createElement('option');
        found.value = key; found.dataset.code = p.code; found.textContent = '+' + p.code;
        sel.appendChild(found);
      }
      sel.value = key;
    }
    function set(v) {
      var p = FR.phoneParts(v, { defaultCountry: dflt });
      pick(p);
      input.value = p.national;
      mark(true, '');
    }
    function full() {
      var d = String(input.value || '').replace(/\D/g, '');
      return d ? '+' + code() + d : '';
    }
    function get() { return FR.check('phone', full()); }
    function mark(ok, msg) { wrap.classList.toggle('fr-phone-bad', !ok); wrap.title = ok ? '' : msg; }

    function lookAhead() {   // con + o 00 al inicio el país sale del propio número
      var raw = String(input.value || '').trim();
      if (!/^(\+|00)/.test(raw)) return false;
      var p = FR.phoneParts(raw, { defaultCountry: dflt });
      if (!p.iso) return false;
      pick(p); input.value = p.national;
      return true;
    }
    input.addEventListener('input', function () { lookAhead(); mark(true, ''); });
    input.addEventListener('paste', function () { setTimeout(lookAhead, 0); });
    input.addEventListener('blur', function () {
      var raw = String(input.value || '').trim();
      if (/^(\+|00)/.test(raw)) { var p = FR.phoneParts(raw, { defaultCountry: dflt }); pick(p); input.value = p.national; }
      var r = get();
      if (r.ok && r.value) set(r.value); else mark(r.ok, r.msg);
    });
    sel.addEventListener('change', function () { var r = get(); mark(r.ok, r.msg); });

    var api = { wrap: wrap, select: sel, get: get, full: full, set: set };
    input.frPhone = api;
    set(input.value);
    return api;
  }

  root.PhoneInput = { attach: attach };
})(typeof globalThis !== 'undefined' ? globalThis : this);
