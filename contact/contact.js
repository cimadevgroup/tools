/**
 * Contacto único (de2884) — FUENTE COMPARTIDA: modular-mango/tools/contact/contact.js
 * Módulo  : window.CimaContact (y el alias window.sima.contact que usa BASE).
 * Función : el ÚNICO componente para contactar a alguien desde cualquier ventana. Un teléfono o un enlace wa.me
 *           ofrece: «Escribir por Link» (abre o crea la conversación en Link), «Abrir en WhatsApp» (app de
 *           WhatsApp de la computadora: whatsapp://send, con respaldo a wa.me en el navegador externo; NUNCA
 *           dentro de una ventana de la app) y «Llamar» (tel:). Un correo ofrece «Enviar correo» (mailto:, el
 *           programa de correo de la computadora); solo sale cuando hay correo.
 * API     : CimaContact.html(phone, name, wa?, email?) → botones Escribir + Llamar (+ Correo si hay email) para una fila
 *           CimaContact.menu(anchor, { phones:[{label, phone, email?}], act:'write'|'call', title })
 *           CimaContact.openWA(phone) · CimaContact.link(phone, name) · CimaContact.call(phone) · CimaContact.mail(email)
 *           CimaContact.resolvers.<tipo>(id) → Promise<[{label, phone, email?}]>  (para botones con data-ct-src="tipo:id")
 *           CimaContact.linkHandler = (phone, name) => Promise   (cada app conecta su «Link»; si no hay, se usa
 *           window.sima.salesinbox.openByPhone, el de BASE)
 * Botones : <button data-ct-act="write|call" data-ct-phone=".." data-ct-name=".."> o data-ct-src="tipo:id";
 *           <button data-ct-act="mail" data-ct-email=".."> abre el correo directo.
 * Estilos : contact.css (misma carpeta). Copias por tools/contact/sync.sh; nunca se edita una copia.
 */
(function () {
    'use strict';
    window.sima = window.sima || {};
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const toast = (m, t) => { try { window.CimaUI && window.CimaUI.toast(m, t); } catch (e) {} };

    // Dígitos para WhatsApp: con «+» o ya internacional se usan tal cual (sin país no se inventa uno).
    function digits(v) {
        const s = String(v == null ? '' : v).trim();
        try { const FF = window.FieldFormat; const w = FF && FF.wa && FF.wa(s); if (w) return w.replace(/\D/g, ''); } catch (e) {}
        return s.replace(/\D/g, '');
    }
    const valid = v => digits(v).length >= 8;
    // WhatsApp por defecto (de2884): un celular se trata como WhatsApp salvo que se marque lo contrario
    // (wa/is_whatsapp = false | 0 | '0'). Sin la marca, todo número internacional válido ofrece Link y WhatsApp.
    const isWA = p => valid(p && p.phone) && !(p && (p.wa === false || p.wa === 0 || p.wa === '0'));

    let _last = { x: 0, y: 0 };
    document.addEventListener('pointerdown', e => { _last = { x: e.clientX, y: e.clientY }; }, true);

    // Navegador externo: único lugar permitido para salir de BASE (wa.me ya es excepción documentada).
    function external(url) {
        const a = document.createElement('a');
        a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.style.display = 'none';
        document.body.appendChild(a); a.click(); a.remove();
    }
    function openWA(phone) {
        const d = digits(phone);
        if (d.length < 8) { toast('Teléfono no válido para WhatsApp', 'error'); return; }
        let left = false;
        const mark = () => { left = true; };
        const onVis = () => { if (document.hidden) mark(); };
        window.addEventListener('blur', mark);
        document.addEventListener('visibilitychange', onVis);
        const a = document.createElement('a');
        a.href = 'whatsapp://send?phone=' + d; a.style.display = 'none';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => {
            window.removeEventListener('blur', mark);
            document.removeEventListener('visibilitychange', onVis);
            if (!left) external('https://wa.me/' + d);   // la app no respondió: respaldo en el navegador externo
        }, 1800);
    }
    function call(phone) {
        const s = String(phone || '').trim();
        const t = /^\+/.test(s) ? '+' + s.replace(/\D/g, '') : s.replace(/\D/g, '');
        if (!t) { toast('Sin teléfono', 'error'); return; }
        window.location.href = 'tel:' + t;
    }
    const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/;
    const validEmail = v => EMAIL_RE.test(String(v == null ? '' : v).trim());
    function mail(email) {
        const e = String(email == null ? '' : email).trim();
        if (!validEmail(e)) { toast('Correo no válido', 'error'); return; }
        window.location.href = 'mailto:' + e;   // programa de correo de la computadora; nunca una ventana nueva
    }
    async function link(phone, name) {
        if (typeof api.linkHandler === 'function') { await api.linkHandler(phone, name); return; }   // cada app conecta su Link
        const SI = window.sima && window.sima.salesinbox;
        if (!SI || !SI.openByPhone) { toast('Link no está disponible', 'error'); return; }
        await SI.openByPhone(phone, name);
    }

    // ── Menú flotante ───────────────────────────────────────────────────────────────────
    let _menu = null;
    function close() {
        if (_menu) { _menu.remove(); _menu = null; }
        document.removeEventListener('pointerdown', onOut, true);
        document.removeEventListener('keydown', onKey, true);
    }
    function onOut(e) { if (_menu && !_menu.contains(e.target)) close(); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    function menu(anchor, o) {
        o = o || {};
        const act = o.act || 'write';
        const phones = (o.phones || []).filter(p => p && (p.phone || (act !== 'call' && validEmail(p.email))));
        close();
        if (!phones.length) { toast('Sin teléfono registrado', 'warn'); return; }
        const rows = phones.map((p, i) => {
            const w = isWA(p);
            const mailBtn = act !== 'call' && validEmail(p.email) ? `<button type="button" class="sima-ct-it" data-i="${i}" data-a="mail"><i class="bi bi-envelope"></i> Enviar correo</button>` : '';
            if (!p.phone) return `<div class="sima-ct-grp"><div class="sima-ct-who">${p.label ? '<b>' + esc(p.label) + '</b> ' : ''}<span>${esc(p.email)}</span></div>${mailBtn}</div>`;
            const btns = act === 'call' || !w
                ? `<button type="button" class="sima-ct-it" data-i="${i}" data-a="call"><i class="bi bi-telephone"></i> Llamar</button>`
                : `<button type="button" class="sima-ct-it" data-i="${i}" data-a="link"${w ? '' : ' disabled'}><i class="bi bi-chat-dots"></i> Escribir por Link</button>`
                + `<button type="button" class="sima-ct-it" data-i="${i}" data-a="wa"${w ? '' : ' disabled'}><i class="bi bi-whatsapp"></i> Abrir en WhatsApp</button>`;
            return `<div class="sima-ct-grp"><div class="sima-ct-who">${p.label ? '<b>' + esc(p.label) + '</b> ' : ''}<span>${esc(p.phone)}</span></div>${btns}${mailBtn}</div>`;
        }).join('');
        const m = document.createElement('div');
        m.className = 'sima-ct-menu'; m.setAttribute('role', 'menu');
        m.innerHTML = (o.title ? `<div class="sima-ct-title">${esc(o.title)}</div>` : '') + rows;
        document.body.appendChild(m); _menu = m;
        const r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: _last.x, bottom: _last.y, top: _last.y };
        const mw = m.offsetWidth, mh = m.offsetHeight;
        let x = Math.min(Math.max(8, r.left), window.innerWidth - mw - 8);
        let y = r.bottom + 4; if (y + mh > window.innerHeight - 8) y = Math.max(8, r.top - mh - 4);
        m.style.left = x + 'px'; m.style.top = y + 'px';
        m.addEventListener('click', async e => {
            const b = e.target.closest('.sima-ct-it'); if (!b || b.disabled) return;
            const p = phones[+b.dataset.i], a = b.dataset.a;
            b.disabled = true;
            close();
            if (a === 'mail') mail(p.email);
            else if (a === 'wa') openWA(p.phone);
            else if (a === 'call') call(p.phone);
            else await link(p.phone, p.label || o.name);
        });
        setTimeout(() => { document.addEventListener('pointerdown', onOut, true); document.addEventListener('keydown', onKey, true); }, 0);
    }

    function html(phone, name, wa, email) {
        const p = esc(phone || ''), n = esc(name || ''), w = wa === false || wa === 0 || wa === '0' ? ' data-ct-wa="0"' : '';
        const m = validEmail(email) ? `<button type="button" class="sima-ct-btn" data-ct-act="mail" data-ct-email="${esc(String(email).trim())}" title="Enviar correo" aria-label="Enviar correo"><i class="bi bi-envelope"></i></button>` : '';
        if (!phone && !m) return '<span class="sima-ct-none" title="Sin teléfono">—</span>';
        if (!phone) return `<span class="sima-ct-btns">${m}</span>`;
        return `<span class="sima-ct-btns">`
            + `<button type="button" class="sima-ct-btn" data-ct-act="write" data-ct-phone="${p}" data-ct-name="${n}"${w} title="Escribir" aria-label="Escribir"><i class="bi bi-whatsapp"></i></button>`
            + `<button type="button" class="sima-ct-btn" data-ct-act="call" data-ct-phone="${p}" data-ct-name="${n}"${w} title="Llamar" aria-label="Llamar"><i class="bi bi-telephone"></i></button>${m}</span>`;
    }
    // Botones cuyo teléfono se resuelve al pulsar (p. ej. el usuario principal de un consultorio).
    function htmlSrc(src, name) {
        const n = esc(name || ''), s = esc(src);
        return `<span class="sima-ct-btns">`
            + `<button type="button" class="sima-ct-btn" data-ct-act="write" data-ct-src="${s}" data-ct-name="${n}" title="Escribir" aria-label="Escribir"><i class="bi bi-whatsapp"></i></button>`
            + `<button type="button" class="sima-ct-btn" data-ct-act="call" data-ct-src="${s}" data-ct-name="${n}" title="Llamar" aria-label="Llamar"><i class="bi bi-telephone"></i></button></span>`;
    }

    document.addEventListener('click', async e => {
        const b = e.target.closest && e.target.closest('[data-ct-act]'); if (!b) return;
        e.preventDefault(); e.stopPropagation();
        if (b.disabled) return;
        const act = b.dataset.ctAct, name = b.dataset.ctName || '';
        if (act === 'mail') { mail(b.dataset.ctEmail); return; }
        let phones;
        if (b.dataset.ctSrc) {
            const [kind, id] = b.dataset.ctSrc.split(/:(.*)/s);
            const R = api.resolvers[kind]; if (!R) return;
            b.disabled = true;
            try { phones = await R(id); } catch (err) { toast(err.message || 'No se pudo leer el contacto', 'error'); b.disabled = false; return; }
            b.disabled = false;
        } else phones = [{ label: name, phone: b.dataset.ctPhone, wa: b.dataset.ctWa === '0' ? 0 : undefined }];
        phones = (phones || []).filter(p => p && (p.phone || (act !== 'call' && validEmail(p.email))));
        if (!phones.length) { toast('Sin teléfono registrado', 'warn'); return; }
        if (act === 'call' && phones.length === 1) { call(phones[0].phone); return; }
        menu(b, { phones, act, name, title: act === 'call' ? 'Llamar a' : 'Escribir a' });
    }, true);

    const api = { digits, valid, validEmail, openWA, call, mail, link, menu, close, html, htmlSrc, external, resolvers: {}, linkHandler: null };
    window.CimaContact = api;
    window.sima.contact = api;   // alias de BASE (sus módulos llaman sima.contact)
})();
