#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
contenido-carpeta (de3222, 25 nov 2026) — la carpeta de la Mac que sube contenido sola a BASE › Negocio › Contenido.

Cada pasada (launchd: cada 2 min y al cambiar la carpeta):
  1. Lee la configuración de BASE (GET /admin/social/folder): ruta, modo (borrador o cola), subcarpeta → redes, encendido.
  2. Busca videos e imágenes en la raíz y en cada subcarpeta (un nivel). Solo toma los que llevan quietos al menos
     60 s y no cambiaron desde la pasada anterior (la exportación terminó).
  3. Los sube por partes a la biblioteca como borrador, con los destinos de su subcarpeta (la raíz = sin destino) y,
     si hay un .txt con el mismo nombre, su 1.ª línea como título y el resto como texto. En modo cola, además
     los agrega a la cola (cada red a su siguiente horario libre).
  4. Mueve el archivo (y su .txt) a «subidos/<fecha>/<subcarpeta>/». Lo que no se puede subir va a «revisar/».
     Nada se borra.
  5. Le avisa a BASE lo que hizo (POST /admin/social/folder/ping): tras subir, o una vez por hora sin novedades.

Usa la llave del agente de ~/.base-agente.env (AGENTE_KEY), que nunca se imprime. Solo la biblioteca estándar de
Python de macOS, más sips/mdls (vienen con macOS) y ffprobe si está instalado.
"""
import fcntl
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from datetime import datetime

VERSION = '1.1'
API = os.environ.get('CONTENIDO_API', 'https://sima.cima-api.workers.dev')
SESION = 'contenido-carpeta'
HOME = os.path.expanduser('~')
APP_DIR = os.path.join(HOME, 'Library', 'Application Support', 'contenido-carpeta')
LOG = os.path.join(HOME, 'Library', 'Logs', 'contenido-carpeta.log')
ENV_FILE = os.path.join(HOME, '.base-agente.env')
VIDEO = {'.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime'}
IMAGE_JPEG = {'.jpg', '.jpeg'}
IMAGE_CONVERT = {'.png', '.heic', '.heif', '.webp', '.tif', '.tiff'}   # se pasan a JPEG con sips; el original se conserva
RESERVED = {'subidos', 'revisar'}
QUIET_S = 60
PING_EVERY_S = 3600


# Cada línea del registro dice qué tan grave es (pedido de Miguel, 26 nov: «que no asuste»):
#   OK         todo bien (subido, se resolvió un fallo)
#   ESPERA     algo normal que se hace en la próxima pasada (un archivo que aún se copia)
#   PASAJERO   fallo de red o de BASE que se reintenta solo cada 2 minutos; no hay que hacer nada
#   ATENCIÓN   algo que no se arregla solo (llave, ruta, carpeta): alguien tiene que mirarlo
#   A REVISAR  un archivo que no se pudo subir y pasó a la carpeta «revisar»
def log(msg, clase='OK'):
    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    line = datetime.now().strftime('%Y-%m-%d %H:%M:%S') + '  ' + ('[%s] ' % clase).ljust(12) + msg
    with open(LOG, 'a', encoding='utf-8') as f:
        f.write(line + '\n')
    if sys.stdout.isatty():
        print(line)


def load_json(path, default):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return default


def save_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + '.tmp'
    old = os.umask(0o077)
    try:
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False)
        os.replace(tmp, path)
    finally:
        os.umask(old)


class ApiError(Exception):
    def __init__(self, status, msg):
        super().__init__(msg)
        self.status = status


def clase_de(e):
    """→ (clase, explicación corta) de un fallo al hablar con BASE."""
    st = getattr(e, 'status', 0)
    if st == -1:
        return 'ATENCIÓN', 'falta la llave del agente en esta Mac'
    if st == 0 or st >= 500 or st == 429:
        return 'PASAJERO', 'se reintenta solo en 2 minutos; no hay que hacer nada'
    if st in (401, 403):
        return 'ATENCIÓN', 'la llave del agente no sirve: hay que revisarla en BASE'
    if st == 404:
        return 'ATENCIÓN', 'BASE no reconoce la ruta: hay que avisar al equipo'
    return 'ATENCIÓN', 'BASE rechazó el pedido'


def texto_red(err):
    """Mensajes del sistema en inglés → español claro."""
    t = str(err)
    for k, v in (('timed out', 'BASE tardó demasiado en responder'), ('Name or service not known', 'sin internet'),
                 ('nodename nor servname', 'sin internet'), ('Network is unreachable', 'sin internet'),
                 ('Connection refused', 'BASE no respondió'), ('Connection reset', 'se cortó la conexión')):
        if k.lower() in t.lower():
            return v
    return t[:160]


# ── Acceso a BASE ──────────────────────────────────────────────────────────────────────────────────────────────────
def agent_key():
    try:
        with open(ENV_FILE, encoding='utf-8') as f:
            for ln in f:
                m = re.match(r'\s*(?:export\s+)?AGENTE_KEY\s*=\s*(.+?)\s*$', ln)
                if m:
                    return m.group(1).strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    raise ApiError(-1, 'Falta la llave del agente en ~/.base-agente.env')


def http(method, path, body=None, token=None, raw=None, timeout=60, headers=None):
    h = {'X-Agente-Sesion': SESION, 'User-Agent': 'contenido-carpeta/' + VERSION}
    if token:
        h['Authorization'] = 'Bearer ' + token
    data = None
    if raw is not None:
        data = raw
        h['Content-Type'] = 'application/octet-stream'
        h['Content-Length'] = str(len(raw))
    elif body is not None:
        data = json.dumps(body).encode('utf-8')
        h['Content-Type'] = 'application/json'
    if headers:
        h.update(headers)
    req = urllib.request.Request(API + path, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            txt = r.read().decode('utf-8', 'replace')
            status = r.status
    except urllib.error.HTTPError as e:
        txt = e.read().decode('utf-8', 'replace')
        status = e.code
    except Exception as e:   # sin internet, tiempo agotado…
        raise ApiError(0, 'Sin conexión con BASE: ' + texto_red(e))
    try:
        d = json.loads(txt) if txt else {}
    except Exception:
        d = {}
    if status >= 400 or (isinstance(d, dict) and d.get('success') is False):
        raise ApiError(status, (d.get('error') if isinstance(d, dict) else None) or ('HTTP %d' % status))
    return d if isinstance(d, dict) else {}


class Base:
    def __init__(self):
        self.cache = os.path.join(APP_DIR, 'token.json')
        self.token = None

    def login(self, force=False):
        c = load_json(self.cache, {})
        if not force and c.get('token') and int(c.get('exp') or 0) > time.time() + 120:
            self.token = c['token']
            return
        d = http('POST', '/auth/agent', headers={'Authorization': 'Bearer ' + agent_key()}, body={})
        tok = d.get('token') or (d.get('data') or {}).get('token')
        exp = d.get('exp') or (d.get('data') or {}).get('exp') or (time.time() + 3000)
        if not tok:
            raise ApiError(401, 'BASE no aceptó la llave del agente')
        self.token = tok
        save_json(self.cache, {'token': tok, 'exp': int(exp)})

    def call(self, method, path, body=None, raw=None, timeout=60):
        if not self.token:
            self.login()
        try:
            return http(method, path, body=body, raw=raw, token=self.token, timeout=timeout)
        except ApiError as e:
            if e.status == 401:   # token vencido o llave rotada: un reintento con token nuevo
                self.login(force=True)
                return http(method, path, body=body, raw=raw, token=self.token, timeout=timeout)
            raise


# ── Medidas del archivo ────────────────────────────────────────────────────────────────────────────────────────────
def run(cmd, timeout=60):
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout).stdout
    except Exception:
        return ''


def ffprobe_bin():
    for p in ('/opt/homebrew/bin/ffprobe', '/usr/local/bin/ffprobe'):
        if os.path.exists(p):
            return p
    return shutil.which('ffprobe')


def video_meta(path):
    """→ (duración en s, ancho, alto) tal como se ve (con la rotación aplicada)."""
    fp = ffprobe_bin()
    if fp:
        out = run([fp, '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                   'stream=width,height:stream_tags=rotate:stream_side_data=rotation:format=duration', '-of', 'json', path])
        try:
            d = json.loads(out)
            s = (d.get('streams') or [{}])[0]
            w, h = int(s.get('width') or 0), int(s.get('height') or 0)
            rot = 0
            try:
                rot = int(float((s.get('tags') or {}).get('rotate') or 0))
            except Exception:
                pass
            for sd in s.get('side_data_list') or []:
                if 'rotation' in sd:
                    rot = int(float(sd['rotation']))
            if abs(rot) % 180 == 90:
                w, h = h, w
            dur = float((d.get('format') or {}).get('duration') or 0)
            if w and h:
                return dur, w, h
        except Exception:
            pass
    out = run(['/usr/bin/mdls', '-raw', '-name', 'kMDItemDurationSeconds', '-name', 'kMDItemPixelWidth', '-name', 'kMDItemPixelHeight', path])
    parts = out.split('\0')
    num = lambda x: float(x) if re.match(r'^[\d.]+$', (x or '').strip()) else 0
    if len(parts) >= 3:
        return num(parts[0]), int(num(parts[1])), int(num(parts[2]))
    return 0, 0, 0


def image_meta(path):
    out = run(['/usr/bin/sips', '-g', 'pixelWidth', '-g', 'pixelHeight', path])
    w = re.search(r'pixelWidth:\s*(\d+)', out)
    h = re.search(r'pixelHeight:\s*(\d+)', out)
    return int(w.group(1)) if w else 0, int(h.group(1)) if h else 0


def to_jpeg(path, tmpdir):
    dst = os.path.join(tmpdir, os.path.splitext(os.path.basename(path))[0] + '.jpg')
    subprocess.run(['/usr/bin/sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '90', path, '--out', dst],
                   capture_output=True, timeout=120)
    if not os.path.exists(dst) or os.path.getsize(dst) == 0:
        raise ValueError('No se pudo convertir la imagen a JPEG')
    return dst


def companion_text(path):
    """.txt con el mismo nombre (sin importar mayúsculas): 1.ª línea = título, el resto = texto."""
    d, stem = os.path.dirname(path), os.path.splitext(os.path.basename(path))[0].lower()
    for n in os.listdir(d):
        if n.lower() == stem + '.txt':
            p = os.path.join(d, n)
            try:
                with open(p, encoding='utf-8', errors='replace') as f:
                    lines = f.read().replace('\r\n', '\n').split('\n')
            except Exception:
                return p, '', ''
            while lines and not lines[0].strip():
                lines.pop(0)
            title = lines[0].strip()[:100] if lines else ''
            return p, title, '\n'.join(lines[1:]).strip()[:5000]
    return None, '', ''


def unique_dest(folder, name):
    os.makedirs(folder, exist_ok=True)
    base, ext = os.path.splitext(name)
    dst, i = os.path.join(folder, name), 2
    while os.path.exists(dst):
        dst = os.path.join(folder, '%s (%d)%s' % (base, i, ext))
        i += 1
    return dst


def move_with_text(path, txt, folder):
    shutil.move(path, unique_dest(folder, os.path.basename(path)))
    if txt and os.path.exists(txt):
        shutil.move(txt, unique_dest(folder, os.path.basename(txt)))


# ── Subida ─────────────────────────────────────────────────────────────────────────────────────────────────────────
def upload(api, path, up_path, mime, meta, title):
    size = os.path.getsize(up_path)
    body = {'name': os.path.basename(up_path), 'mime': mime, 'size': size, 'source': 'carpeta'}
    if title:
        body['title'] = title
    body.update({k: v for k, v in meta.items() if v})
    st = api.call('POST', '/admin/social/upload/start', body)
    pid, psize, nparts = st['post_id'], int(st['part_size']), int(st['parts'])
    parts = []
    with open(up_path, 'rb') as f:
        for n in range(1, nparts + 1):
            chunk = f.read(psize)
            for intento in range(3):
                try:
                    r = api.call('PUT', '/admin/social/upload/%s/part/%d' % (pid, n), raw=chunk, timeout=600)
                    parts.append({'n': n, 'etag': r['etag']})
                    break
                except ApiError as e:
                    if intento == 2 or (400 <= e.status < 500 and e.status != 401):
                        raise
                    time.sleep(5 * (intento + 1))
    api.call('POST', '/admin/social/upload/%s/complete' % pid, {'parts': parts}, timeout=120)
    return pid


def handle(api, cfg, path, sub, labels):
    """Sube un archivo. → evento para BASE. Lanza ApiError(0) si no hay conexión (se reintenta en la próxima pasada)."""
    name = os.path.basename(path)
    ext = os.path.splitext(name)[1].lower()
    wanted = list(cfg['carpetas'].get(sub, [])) if sub else []
    ev = {'nombre': name, 'carpeta': sub or '', 'ok': False}
    txt, title, caption = companion_text(path)
    root = os.path.expanduser(cfg['ruta'])
    with tempfile.TemporaryDirectory() as tmp:
        if ext in VIDEO:
            dur, w, h = video_meta(path)
            mime, up_path, meta = VIDEO[ext], path, {'duration_s': round(dur, 2) if dur else None, 'width': w, 'height': h}
        elif ext in IMAGE_JPEG or ext in IMAGE_CONVERT:
            up_path = path if ext in IMAGE_JPEG else to_jpeg(path, tmp)
            w, h = image_meta(up_path)
            mime, meta = 'image/jpeg', {'width': w, 'height': h}
        else:
            raise ValueError('Formato no admitido (sube MP4, MOV o una imagen)')
        if os.path.getsize(up_path) > 4 * 1024 ** 3:
            raise ValueError('Pesa más de 4 GB')
        pid = upload(api, path, up_path, mime, meta, title)
    ev['post_id'] = pid
    notas = []
    post = (api.call('GET', '/admin/social/posts/' + pid).get('post') or {})
    allowed = post.get('allowed') or []
    ok = [n for n in wanted if n in allowed]
    fuera = [n for n in wanted if n not in allowed]
    if fuera:
        notas.append('No sirve para ' + ', '.join(labels.get(n, n) for n in fuera) + ': quedó sin ese destino')
    upd = {}
    if caption:
        upd['caption'] = caption
    if ok:
        upd['networks'] = ok
    if upd:
        try:
            api.call('POST', '/admin/social/posts/' + pid, upd)
        except ApiError as e:
            if e.status == 0:
                raise
            notas.append('No se guardaron los destinos: ' + str(e))
    if cfg.get('modo') == 'cola' and ok:
        try:
            api.call('POST', '/admin/social/posts/%s/queue' % pid, {'networks': ok})
            notas.append('Agregado a la cola')
        except ApiError as e:
            if e.status == 0:
                raise
            notas.append('Quedó como borrador: ' + str(e))
    day = datetime.now().strftime('%Y-%m-%d')
    move_with_text(path, txt, os.path.join(root, 'subidos', day, sub) if sub else os.path.join(root, 'subidos', day))
    ev['ok'] = True
    if notas:
        ev['nota'] = ' · '.join(notas)[:200]
    return ev


# ── Pasada ─────────────────────────────────────────────────────────────────────────────────────────────────────────
def candidates(root, cfg):
    """→ [(ruta, subcarpeta o '')] de un nivel; crea las subcarpetas que falten."""
    for sub in list(cfg['carpetas'].keys()) + list(RESERVED):
        os.makedirs(os.path.join(root, sub), exist_ok=True)
    out = []
    for n in sorted(os.listdir(root)):
        p = os.path.join(root, n)
        if n.startswith('.') or n.startswith('~$'):
            continue
        if os.path.isdir(p):
            if n.lower() in RESERVED:
                continue
            for m in sorted(os.listdir(p)):
                q = os.path.join(p, m)
                if not m.startswith('.') and not m.startswith('~$') and os.path.isfile(q) and not m.lower().endswith('.txt'):
                    out.append((q, n))
        elif os.path.isfile(p) and not n.lower().endswith('.txt'):
            out.append((p, ''))
    return out


def main():
    os.makedirs(APP_DIR, exist_ok=True)
    lock = open(os.path.join(APP_DIR, 'pasada.lock'), 'w')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        return   # otra pasada sigue subiendo
    state = load_json(os.path.join(APP_DIR, 'estado.json'), {})
    api = Base()
    pasada = {'en_carpeta': 0, 'subidos': 0, 'revisar': 0, 'errores': 0}
    eventos, error = [], None
    try:
        F = api.call('GET', '/admin/social/folder')
    except ApiError as e:
        cl, por = clase_de(e)
        if not state.get('fallo'):   # una sola línea por fallo, no una cada 2 minutos
            log('No pude leer la configuración de BASE (%s): %s' % (por, e), cl)
            state['fallo'] = {'desde': time.time(), 'clase': cl}
            save_json(os.path.join(APP_DIR, 'estado.json'), state)
        return
    if state.get('fallo'):
        d = datetime.fromtimestamp(float(state['fallo'].get('desde') or time.time()))
        mes = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][d.month - 1]
        log('Resuelto: BASE volvió a responder; el fallo del %d %s a las %s ya pasó.' % (d.day, mes, d.strftime('%H:%M')))
        state.pop('fallo', None)
    cfg, labels = F.get('folder') or {}, F.get('networks') or {}
    if os.environ.get('CONTENIDO_RUTA'):   # solo para pruebas: otra carpeta sin tocar la de BASE
        cfg['ruta'] = os.environ['CONTENIDO_RUTA']
    root = os.path.expanduser(cfg.get('ruta') or '~/CIMA Contenido/Para publicar')
    if cfg.get('activa', True):
        try:
            os.makedirs(root, exist_ok=True)
            items = candidates(root, cfg)
        except Exception as e:
            items, error = [], 'No puedo abrir la carpeta %s: %s' % (cfg.get('ruta'), str(e)[:120])
            log(error, 'ATENCIÓN')
        vistos, nuevos_vistos, now = state.get('vistos', {}), {}, time.time()
        for path, sub in items:
            try:
                stt = os.stat(path)
            except OSError:
                continue
            firma = '%d:%d' % (stt.st_size, int(stt.st_mtime))
            nuevos_vistos[path] = firma
            if vistos.get(path) != firma or now - stt.st_mtime < QUIET_S or stt.st_size == 0:
                pasada['en_carpeta'] += 1   # aún se está copiando o exportando: la próxima pasada
                if path not in vistos:
                    log('Llegó %s: espera a que termine de copiarse y sube en la próxima pasada.' % os.path.relpath(path, root), 'ESPERA')
                continue
            if sub and sub not in cfg['carpetas']:
                log('«%s/» no tiene destinos en BASE: %s sube sin destino' % (sub, os.path.basename(path)), 'ATENCIÓN')
            try:
                ev = handle(api, cfg, path, sub if sub in cfg['carpetas'] else '', labels)
                pasada['subidos'] += 1
                eventos.append(ev)
                nuevos_vistos.pop(path, None)
                log('Subido %s → %s%s' % (os.path.relpath(path, root), ev.get('post_id'), (' · ' + ev['nota']) if ev.get('nota') else ''))
            except ApiError as e:
                if e.status == 0 or e.status >= 500 or e.status in (401, 403, 429):
                    pasada['errores'] += 1
                    error = str(e)[:200]
                    cl, por = clase_de(e)
                    log('No se pudo subir %s (%s): %s' % (os.path.basename(path), por, e), cl)
                    if e.status == 0:
                        break   # sin conexión: no sigue con el resto
                else:
                    revisar(root, path, sub, str(e), pasada, eventos)
                    nuevos_vistos.pop(path, None)
            except (ValueError, OSError) as e:
                revisar(root, path, sub, str(e), pasada, eventos)
                nuevos_vistos.pop(path, None)
        state['vistos'] = nuevos_vistos
    # Aviso a BASE: tras subir o mover algo, si hubo error, o una vez por hora.
    if eventos or error or now_minus(state.get('ping'), PING_EVERY_S):
        try:
            api.call('POST', '/admin/social/folder/ping', {'host': socket.gethostname().replace('.local', '')[:60], 'version': VERSION,
                     'ruta': cfg.get('ruta'), 'pasada': pasada, 'eventos': eventos, 'error': error if cfg.get('activa', True) else 'Vigilancia apagada en BASE'})
            state['ping'] = time.time()
        except ApiError as e:
            log('No pude avisar a BASE (%s): %s' % (clase_de(e)[1], e), clase_de(e)[0])
    save_json(os.path.join(APP_DIR, 'estado.json'), state)


def now_minus(t, s):
    return not t or time.time() - float(t) >= s


def revisar(root, path, sub, motivo, pasada, eventos):
    txt = companion_text(path)[0]
    try:
        move_with_text(path, txt, os.path.join(root, 'revisar'))
    except OSError as e:
        log('No pude mover %s a revisar: %s' % (path, e), 'ATENCIÓN')
    pasada['revisar'] += 1
    eventos.append({'nombre': os.path.basename(path), 'carpeta': sub or '', 'ok': False, 'nota': (motivo + ': pasó a «revisar»')[:200]})
    log('A revisar %s: %s' % (os.path.basename(path), motivo), 'A REVISAR')


if __name__ == '__main__':
    try:
        main()
    except Exception as e:   # nunca se cae en silencio: queda en el registro
        log('Error inesperado (hay que avisar al equipo): %r' % e, 'ATENCIÓN')
        sys.exit(1)
