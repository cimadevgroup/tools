// lint-campos.mjs — falla si un <input>/<select> de un dato estándar no usa el componente del catálogo (atributo data-cima-field).
//   node lint-campos.mjs --repo RUTA [--staged] [--baseline]
//   Regla: input/select con type tel|email|date, o con id/name cuyas palabras incluyan doc, cedula, phone, tel, whats, email,
//   correo, birth, nacim, sex, country, pais, monto, price → debe llevar data-cima-field.
//   Excepciones: RUTA/campos-excepciones.txt, una por línea: «archivo#clave motivo» (clave = id, name o type) o «archivo motivo» (todo el archivo).
//   --baseline escribe las violaciones de hoy como «pendiente»; las fases F3-F6 las van quitando.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const args = process.argv.slice(2);
const repo = args[args.indexOf('--repo') + 1] || process.cwd();
const staged = args.includes('--staged'), baseline = args.includes('--baseline');
const CAT = JSON.parse(readFileSync(new URL('./catalog.json', import.meta.url), 'utf8'));
const TIPOS = new Set(CAT.lint.tipos_input), IDS = new Set(CAT.lint.ids);
const SKIP = /(^|\/)(node_modules|vendor|\.wt|\.claude|www|public\/modules|dist)\/|\.min\.|(^|\/)(field_rules|field_format|role_fields|phone_input|date_field|date_time_field)\.m?js$/;

const git = (a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8', maxBuffer: 1 << 28 });
const files = (staged ? git(['diff', '--cached', '--name-only', '--diff-filter=ACM']) : git(['ls-files'])).split('\n')
  .filter((f) => /\.(html|js|mjs)$/.test(f) && !SKIP.test(f));

const attr = (tag, n) => { const m = new RegExp('(?<![\\w-])' + n + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i').exec(tag); return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null; };
const words = (s) => s.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

const found = new Map();   // clave → [archivo:línea]
for (const f of files) {
  let txt; try { txt = staged ? git(['show', ':' + f]) : readFileSync(join(repo, f), 'utf8'); } catch (e) { continue; }
  const re = /<(input|select)\b[^>]*>/gi; let m;
  while ((m = re.exec(txt))) {
    const tag = m[0];
    if (/\bdata-cima-field\b/i.test(tag)) continue;
    const type = (attr(tag, 'type') || '').toLowerCase(), id = attr(tag, 'id'), name = attr(tag, 'name');
    const hit = TIPOS.has(type) || words((id || '') + ' ' + (name || '')).some((w) => IDS.has(w));
    if (!hit) continue;
    // Clave estable: un id/name armado en código («doc-tpl-sel-' + sfx + '» o «${id}») se corta en la parte literal; si no queda nada, sigue el otro atributo o el tipo.
    const lit = (v) => (v || '').split(/['"`$ ]/)[0];
    const key = f + '#' + (lit(id) || lit(name) || type || 'campo');
    const line = txt.slice(0, m.index).split('\n').length;
    (found.get(key) || found.set(key, []).get(key)).push(f + ':' + line);
  }
}
const exFile = join(repo, 'campos-excepciones.txt');
const ex = existsSync(exFile) ? readFileSync(exFile, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')) : [];
const exKeys = new Set(ex.map((l) => l.split(/\s+/)[0]));
const nuevas = [...found.keys()].filter((k) => !exKeys.has(k) && !exKeys.has(k.split('#')[0]));
if (baseline) {
  if (nuevas.length) writeFileSync(exFile, (existsSync(exFile) ? readFileSync(exFile, 'utf8').replace(/\n*$/, '\n') : '# Excepciones de lint-campos.mjs: «archivo#clave motivo». Cada una es deuda: se quita al migrar el campo a su componente Cima*Field.\n') + nuevas.map((k) => k + ' pendiente (migrar a Cima*Field)').join('\n') + '\n');
  console.log('lint-campos: ' + nuevas.length + ' excepciones nuevas escritas (' + found.size + ' campos sueltos en total)'); process.exit(0);
}
if (nuevas.length) {
  console.error('lint-campos: ' + nuevas.length + ' campo(s) estándar sin data-cima-field (usa el componente Cima*Field del catálogo, o registra la excepción con motivo en campos-excepciones.txt):');
  for (const k of nuevas) console.error('  ' + found.get(k)[0] + '  → ' + k);
  process.exit(1);
}
console.log('lint-campos: OK (' + found.size + ' campos con excepción registrada, 0 nuevos)');
