import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const FR = require('./field_rules.js');
const RF = require('./role_fields.js');

// tabla: [entrada, opts, ok, valor esperado]
function table(type, rows) {
  for (const [input, opts, okExp, valExp] of rows) {
    test(`${type}: ${JSON.stringify(input)} ${JSON.stringify(opts || {})}`, () => {
      const r = FR.check(type, input, opts);
      assert.equal(r.ok, okExp, 'ok → ' + r.msg);
      if (valExp !== undefined) assert.equal(r.value, valExp);
      if (!okExp) assert.ok(r.msg && r.msg.length > 3, 'debe traer mensaje');
    });
  }
}

table('email', [
  ['  Ana@Correo.COM ', {}, true, 'ana@correo.com'],
  ['a.b+c@x.co', {}, true, 'a.b+c@x.co'],
  ['', {}, true, ''],
  ['sin-arroba.com', {}, false],
  ['a b@x.com', {}, false],
  ['a@x', {}, false],
  ['a@x.c', {}, false],
  ['a'.repeat(115) + '@x.com', {}, false],
  ['', { required: true }, false]
]);

table('phone', [
  ['0414-912.40.22', {}, true, '+584149124022'],
  ['0414 1234567', {}, true, '+584141234567'],
  ['+13055551234', {}, true, '+13055551234'],
  ['0013055551234', {}, true, '+13055551234'],
  ['+57 300 123 4567', {}, true, '+573001234567'],
  ['+34 612 345 678', {}, true, '+34612345678'],
  ['+507 6123-4567', {}, true, '+50761234567'],
  ['+507 612-3456', {}, true, '+5076123456'],
  ['+54 9 11 1234 5678', {}, true, '+5491112345678'],
  ['+593 99 123 4567', {}, true, '+593991234567'],
  ['+58 414 123456', {}, false],        // faltan
  ['+58 414 12345678', {}, false],      // sobran
  ['0414 123 456 789', {}, false],      // sobran
  ['+000123456789', {}, false],         // código desconocido
  ['+99 12345', {}, false],            // internacional: faltan
  ['+99 1234567890', {}, true, '+991234567890'],
  ['+99 12345678901234567', {}, false], // internacional: sobran
  ['abc', {}, false],
  ['', {}, true, '']
]);
test('phone: mensajes faltan/sobran', () => {
  assert.match(FR.check('phone', '+58 414 123456').msg, /^Faltan dígitos/);
  assert.match(FR.check('phone', '+58 414 12345678').msg, /^Sobran dígitos/);
  assert.match(FR.check('phone', '+000123456789').msg, /Código de país desconocido/);
});
test('phone: prefijo más largo (+507 no se corta a 3 como antes)', () => {
  assert.equal(FR.check('phone', '+5076123456').ok, true);
  assert.equal(FR.check('phone', '+1 305 555 1234').value, '+13055551234');
});
test('COUNTRIES: 13 entradas con iso, code, len', () => {
  assert.equal(FR.COUNTRIES.length, 13);
  for (const c of FR.COUNTRIES) assert.ok(c.iso && c.code && Array.isArray(c.len));
});

table('doc', [
  ['V-00012345', {}, true, 'V-12345'],
  ['V-16855327', {}, true, 'V-16855327'],
  ['16.855.327', { docType: 'V' }, true, 'V-16855327'],
  ['v 16855327', {}, true, 'V-16855327'],
  ['V16855327', {}, true, 'V-16855327'],
  ['0016855327', { docType: 'V' }, true, 'V-16855327'],
  ['123456789', { docType: 'V' }, false],           // 9 dígitos
  ['123456789', { docType: 'E' }, true, 'E-123456789'],
  ['E-1234567890', {}, false],
  ['J-12345678-9', {}, true, 'J-12345678-9'],
  ['J123456789', {}, true, 'J-12345678-9'],
  ['12345678', { docType: 'J' }, false],            // falta verificador
  ['G-20000000-0', {}, true, 'G-20000000-0'],
  ['P-AB12345', {}, true, 'P-AB12345'],
  ['ab12345', { docType: 'P' }, true, 'P-AB12345'],
  ['P123', { docType: 'P' }, false],               // 5 mínimo
  ['AB-123456789012345X', { docType: 'P' }, false], // más de 15
  ['12345', {}, false],                             // sin tipo
  ['V-0000', {}, false],
  ['V-12a45', {}, false],
  ['E-123', { docType: 'V' }, false],               // letra contradice tipo
  ['', {}, true, '']
]);
test('docDigits: compara contra datos viejos con ceros', () => {
  assert.equal(FR.docDigits('V-00012345'), '12345');
  assert.equal(FR.docDigits('12.345'), '12345');
  assert.equal(FR.docDigits(FR.check('doc', 'V-00012345').value), FR.docDigits('00012345'));
  assert.equal(FR.docDigits(''), '');
});

table('date', [
  ['2026-10-27', {}, true, '2026-10-27'],
  ['2024-02-29', {}, true, '2024-02-29'],
  ['2025-02-29', {}, false],
  ['2026-13-01', {}, false],
  ['27/10/2026', {}, false],
  ['2026-10-27', { min: '2026-11-01' }, false],
  ['2026-10-27', { max: '2026-10-01' }, false],
  ['2026-10-27', { min: '2026-10-01', max: '2026-12-31' }, true, '2026-10-27'],
  ['', {}, true, '']
]);
table('birth', [
  ['1990-05-10', { today: '2026-10-27' }, true, '1990-05-10'],
  ['2030-01-01', { today: '2026-10-27' }, false],                 // futura
  ['2026-10-01', { today: '2026-10-27' }, true, '2026-10-01'],    // recién nacido paciente
  ['2012-01-01', { staff: true, today: '2026-10-27' }, false],    // 14 años
  ['2010-10-27', { staff: true, today: '2026-10-27' }, true, '2010-10-27'], // 16
  ['1920-01-01', { staff: true, today: '2026-10-27' }, false],    // >100
  ['1890-01-01', { today: '2026-10-27' }, false]                  // >120 paciente
]);
test('birth: personal de 20 años es válido', () => {
  assert.equal(FR.check('birth', '2005-10-28', { staff: true, today: '2026-10-27' }).ok, true);
});
test('birth: date con opts.birth equivale al atajo', () => {
  assert.equal(FR.check('date', '2030-01-01', { birth: true, today: '2026-10-27' }).ok, false);
});
test('birth: cumpleaños de 15 años aún no llegado → error', () => {
  assert.equal(FR.check('birth', '2011-10-28', { staff: true, today: '2026-10-27' }).ok, false);
  assert.equal(FR.check('birth', '2011-10-27', { staff: true, today: '2026-10-27' }).ok, true);
});

table('name', [
  ['Josmar', {}, true, 'Josmar'],
  ['Josmar2', {}, false],
  ['María  José', {}, true, 'María José'],
  ["O'Brien", {}, true, "O'Brien"],
  ['Ana-Lucía Peña', {}, true, 'Ana-Lucía Peña'],
  ['Müller Núñez', {}, true, 'Müller Núñez'],
  ['  Pedro  ', {}, true, 'Pedro'],
  ['Juan_', {}, false],
  ['Dr. Pérez', {}, false],
  ['-Ana', {}, false],
  ['A'.repeat(61), {}, false],
  ['A'.repeat(60), {}, true],
  ['', {}, true, '']
]);
test('name: mensaje', () => {
  assert.equal(FR.check('name', 'Josmar2').msg, 'Un nombre no lleva números ni símbolos.');
});

table('number', [
  ['12', {}, true, 12],
  ['12,5', {}, true, 12.5],
  ['12.5', {}, true, 12.5],
  ['1.234,56', {}, true, 1234.56],
  ['1,234.56', {}, true, 1234.56],
  ['abc', {}, false],
  ['1,2,3', {}, false],
  ['12,5', { int: true }, false],
  ['12', { int: true }, true, 12],
  ['-1', { min: 0 }, false],
  ['101', { max: 100 }, false],
  ['50', { min: 0, max: 100 }, true, 50],
  [7, {}, true, 7],
  ['', {}, true, '']
]);

table('url', [
  ['ejemplo.com', {}, true, 'https://ejemplo.com'],
  ['https://ejemplo.com/ruta?x=1', {}, true, 'https://ejemplo.com/ruta?x=1'],
  ['http://a.co', {}, true, 'http://a.co'],
  ['www.ejemplo.com', {}, true, 'https://www.ejemplo.com'],
  ['localhost', {}, false],
  ['ftp://ejemplo.com', {}, false],
  ['javascript:alert(1)', {}, false],
  ['hola mundo.com', {}, false],
  ['https://sinpunto', {}, false],
  ['', {}, true, '']
]);

table('instagram', [
  ['@dr.perez', {}, true, 'dr.perez'],
  ['instagram.com/dr.perez', {}, true, 'dr.perez'],
  ['https://www.instagram.com/Dr_Perez/', {}, true, 'dr_perez'],
  ['https://instagram.com/dr.perez?igsh=abc', {}, true, 'dr.perez'],
  ['dr perez', {}, false],
  ['a'.repeat(31), {}, false],
  ['a'.repeat(30), {}, true, 'a'.repeat(30)],
  ['dr-perez', {}, false],
  ['', {}, true, '']
]);

table('username', [
  ['  Josmar.V ', {}, true, 'josmar.v'],
  ['ab', {}, false],
  ['a'.repeat(33), {}, false],
  ['a'.repeat(32), {}, true, 'a'.repeat(32)],
  ['.punto', {}, false],
  ['con espacio', {}, false],
  ['ñandu', {}, false],
  ['user_1-x', {}, true, 'user_1-x'],
  ['', {}, true, '']
]);

table('password', [
  ['Abcdef12', {}, true, 'Abcdef12'],
  ['abcdef12', {}, false],   // sin mayúscula
  ['Abcdefgh', {}, false],   // sin número
  ['Abc1', {}, false],       // corta
  ['Abcdef1!', {}, true, 'Abcdef1!'],
  ['  Abcdef1 ', {}, true, '  Abcdef1 '], // no se recorta
  ['', {}, true, ''],
  ['', { required: true }, false]
]);
test('password/username: mensajes iguales a cima-server', () => {
  assert.equal(FR.check('password', 'abc').msg, 'La contraseña debe tener al menos 8 caracteres');
  assert.equal(FR.check('password', 'abcdefgh1').msg, 'La contraseña debe incluir al menos una mayúscula');
  assert.equal(FR.check('password', 'Abcdefghi').msg, 'La contraseña debe incluir al menos un número');
  assert.equal(FR.check('username', 'ab').msg, 'El nombre de usuario debe tener al menos 3 caracteres');
});

table('text', [
  ['  hola  ', {}, true, 'hola'],
  ['x'.repeat(200), {}, true, 'x'.repeat(200)],
  ['x'.repeat(201), {}, false],
  ['x'.repeat(11), { max: 10 }, false],
  ['x'.repeat(10), { max: 10 }, true, 'x'.repeat(10)],
  ['', {}, true, ''],
  ['   ', { required: true }, false]
]);

test('check: tipo desconocido', () => {
  assert.equal(FR.check('zzz', 'x').ok, false);
});
test('checkAll: reúne valores y errores', () => {
  const r = FR.checkAll({
    mail: { type: 'email', value: ' A@B.com ' },
    nom: { type: 'name', value: 'Josmar2' },
    tel: { type: 'phone', value: '0414 1234567' },
    ced: { type: 'doc', value: 'V-00012345' }
  });
  assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r.errors), ['nom']);
  assert.equal(r.values.mail, 'a@b.com');
  assert.equal(r.values.tel, '+584141234567');
  assert.equal(r.values.ced, 'V-12345');
  assert.equal(FR.checkAll({}).ok, true);
});

// ── role_fields ──
test('RoleFields.applies', () => {
  assert.equal(RF.applies('assistant', 'specialty'), false);
  assert.equal(RF.applies('doctor', 'specialty'), true);
  assert.equal(RF.applies('owner', 'services'), true);
  assert.equal(RF.applies('resident', 'services'), false);
  assert.equal(RF.applies('nurse', 'institution'), true);
  assert.equal(RF.applies('receptionist', 'blood_type'), true);
  assert.equal(RF.applies('doctor', 'work_for'), false);
  assert.equal(RF.applies('admin', 'work_for'), true);
  assert.equal(RF.applies('rol_raro', 'specialty'), true);
  assert.equal(RF.applies('doctor', 'campo_inexistente'), true);
});
test('RoleFields.titles y label', () => {
  assert.deepEqual(RF.titles('doctor'), ['Dr.', 'Dra.']);
  assert.deepEqual(RF.titles('nurse'), ['Lic.', 'Enf.', 'Sr.', 'Sra.']);
  assert.deepEqual(RF.titles('desconocido'), []);
  const l = { doctor: 'Médico', resident: 'Residente', nurse: 'Enfermería', assistant: 'Asistente',
              receptionist: 'Recepción', admin: 'Administración', owner: 'Dueño' };
  for (const k of Object.keys(l)) assert.equal(RF.label(k), l[k]);
  assert.equal(RF.ROLES.length, 7);
});

// ── copia para servidores (.mjs generado por sync.sh) ──
test('las dos salidas funcionan como script clásico y como módulo', async () => {
  const vm = await import('node:vm');
  const fs = await import('node:fs');
  const ctx = {}; ctx.globalThis = ctx;
  vm.runInNewContext(fs.readFileSync(new URL('./field_rules.js', import.meta.url), 'utf8'), ctx);
  assert.equal(ctx.FieldRules.check('doc', 'V-00012345').value, 'V-12345');
});
