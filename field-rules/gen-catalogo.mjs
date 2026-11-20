// gen-catalogo.mjs — escribe CATALOGO.md a partir de catalog.json (los ejemplos son los mismos que corre test.mjs).
//   node gen-catalogo.mjs          escribe CATALOGO.md
//   node gen-catalogo.mjs --check  sale con 1 si CATALOGO.md no coincide (lo usa test.mjs)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const cat = JSON.parse(readFileSync(join(HERE, 'catalog.json'), 'utf8'));
const ver = readFileSync(join(HERE, 'VERSION'), 'utf8').split('\n')[0].trim();
const j = (x) => '`' + JSON.stringify(x).replace(/\|/g, '\\|') + '`';

export function render() {
  const L = [];
  L.push('# Catálogo de campos de CIMA', '',
    `Versión ${ver}. **Generado desde catalog.json por gen-catalogo.mjs; no se edita a mano** (el test falla si no coincide). Los ejemplos de cada tabla se ejecutan en test.mjs: si este documento miente, el test se cae.`, '',
    '## Reglas generales', '', ...cat.reglas_generales.map((r) => '- ' + r), '',
    '## Cómo se usa', '',
    '- **Capturar:** solo con los componentes `Cima*Field` (con `data-cima-field`). Nadie escribe un `<input>` suelto para estos datos.',
    '- **Guardar:** `FieldRules.check(tipo, valor, opts).value`.',
    '- **Mostrar:** `FieldFormat.show(tipo, valor, opts)`.',
    '- **Servidores:** core normaliza SIEMPRE al escribir (plan F2).',
    '- **Estado:** «implementado» tiene código y ejemplos probados; «catalogado» tiene la regla decidida y una fase que la implementa.', '');
  let grupo = '';
  for (const t of cat.tipos) {
    if (t.grupo !== grupo) { grupo = t.grupo; L.push('## ' + grupo, ''); }
    L.push(`### ${t.titulo} · \`${t.id}\``, '',
      `- **Estado:** ${t.estado}${t.fase ? ' (' + t.fase + ')' : ''}`,
      `- **Se guarda:** ${t.guardado}`, `- **Se muestra:** ${t.mostrado}`, `- **Regla:** ${t.regla}`, '');
    if (t.ejemplos && t.ejemplos.length) {
      L.push('| Llamada | Entrada | Resultado |', '|---|---|---|');
      for (const e of t.ejemplos) {
        const call = e.fn === 'check' ? `FieldRules.check('${e.type}', …${e.opts ? ', ' + JSON.stringify(e.opts).replace(/\|/g, '\\|') : ''})`
          : e.fn === 'show' ? `FieldFormat.show('${e.id}', …${e.opts ? ', ' + JSON.stringify(e.opts).replace(/\|/g, '\\|') : ''})`
          : e.fn === 'phoneCanon' ? `FieldRules.phoneCanon(…${e.home ? ", '" + e.home + "'" : ''})`
          : e.fn === 'normDocType' ? `FieldRules.normDocType(…${e.iso ? ", '" + e.iso + "'" : ''})`
          : `FieldFormat.${e.fn}(…)`;
        L.push(`| \`${call}\` | ${j(e.in)} | ${e.error ? '**error** (rechaza con mensaje)' : j(e.out)} |`);
      }
      L.push('');
    }
  }
  L.push('## Etiquetas de tipos de documento', '', '| Código | Etiqueta |', '|---|---|',
    ...Object.entries(cat.paises.doc_etiquetas).map(([k, v]) => `| ${k} | ${v} |`), '');
  return L.join('\n');
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = render();
  if (process.argv[2] === '--check') {
    let cur = ''; try { cur = readFileSync(join(HERE, 'CATALOGO.md'), 'utf8'); } catch (e) {}
    if (cur !== out) { console.error('CATALOGO.md no coincide con catalog.json: corre node gen-catalogo.mjs'); process.exit(1); }
  } else { writeFileSync(join(HERE, 'CATALOGO.md'), out); console.log('CATALOGO.md escrito'); }
}
