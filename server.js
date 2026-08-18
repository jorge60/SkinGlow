#!/usr/bin/env node
/* ============================================================================
   SKIN GLOW · Servidor web local (Node.js puro, sin dependencias)
   ---------------------------------------------------------------------------
   · Sirve el sitio estático con compresión gzip y caché por ETag.
   · Detecta la IP local y publica el sitio en toda la red WiFi (0.0.0.0).
   · Si el puerto está ocupado, busca el siguiente disponible.
   · Recibe el formulario en POST /api/contacto y guarda los mensajes
     en data/mensajes.json.

   Uso:  node server.js  [--port 3000]  [--open]
   ========================================================================== */
'use strict';

const http = require('http');
const fs   = require('fs');
const fsp  = require('fs/promises');
const path = require('path');
const os   = require('os');
const zlib = require('zlib');
const net  = require('net');
const { execFile } = require('child_process');

/* ══════════════ Configuración ══════════════ */
const RAIZ        = __dirname;
const DIR_DATOS   = path.join(RAIZ, 'data');
const ARCHIVO_MSG = path.join(DIR_DATOS, 'mensajes.json');
const HOST        = '0.0.0.0';
const MAX_BODY    = 64 * 1024;          // 64 KB máximo por petición
const INTENTOS    = 25;                 // puertos a probar si el primero está ocupado

const args = process.argv.slice(2);
const leerArg = (nombre, def) => {
  const i = args.indexOf(nombre);
  return i !== -1 && args[i + 1] ? args[i + 1] : def;
};
const PUERTO_BASE = Number(leerArg('--port', process.env.PORT || 3000));

/* ══════════════ Tipos MIME ══════════════ */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.webp': 'image/webp',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.gif':  'image/gif',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
  '.ttf':  'font/ttf',
  '.txt':  'text/plain; charset=utf-8',
  '.xml':  'application/xml; charset=utf-8',
  '.pdf':  'application/pdf',
  '.mp4':  'video/mp4'
};
const COMPRIMIBLES = new Set(['.html', '.css', '.js', '.json', '.svg', '.txt', '.xml', '.webmanifest']);

/* ══════════════ Utilidades de red ══════════════ */
function ipsLocales() {
  const salida = [];
  for (const [nombre, direcciones] of Object.entries(os.networkInterfaces())) {
    for (const d of direcciones || []) {
      if (d.family === 'IPv4' && !d.internal) salida.push({ nombre, ip: d.address });
    }
  }
  // Prioriza rangos domésticos típicos (192.168.x.x)
  return salida.sort((a, b) => Number(b.ip.startsWith('192.168.')) - Number(a.ip.startsWith('192.168.')));
}

function puertoLibre(puerto) {
  return new Promise(resolve => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.once('listening', () => s.close(() => resolve(true)));
    s.listen(puerto, HOST);
  });
}

async function buscarPuerto(inicio) {
  for (let p = inicio; p < inicio + INTENTOS; p++) {
    if (await puertoLibre(p)) return { puerto: p, cambiado: p !== inicio };
  }
  throw new Error(`No hay puertos libres entre ${inicio} y ${inicio + INTENTOS - 1}.`);
}

/* Comprueba el estado del cortafuegos (solo informativo).
   `ufw status` exige privilegios de root, así que si no los hay recurrimos a
   leer /etc/ufw/ufw.conf, que sí es legible por cualquier usuario. */
function estadoFirewallSinRoot() {
  try {
    const conf = fs.readFileSync('/etc/ufw/ufw.conf', 'utf8');
    const habilitado = /^\s*ENABLED\s*=\s*yes/im.test(conf);
    return habilitado
      ? { disponible: true, activo: true, abierto: null,
          nota: 'ufw está activo. Si el móvil no conecta, abre el puerto (ver abajo).' }
      : { disponible: true, activo: false, abierto: true,
          nota: 'ufw está instalado pero desactivado: la red local tiene acceso libre.' };
  } catch {
    return null;
  }
}

function estadoFirewall(puerto) {
  return new Promise(resolve => {
    execFile('ufw', ['status'], { timeout: 3000 }, (err, stdout) => {
      if (err) {
        const alternativa = estadoFirewallSinRoot();
        if (alternativa) return resolve(alternativa);
        // Sin ufw instalado o sin forma de consultarlo
        const sinPermiso = /root|permission|denied|administrador/i.test(String(err.message || ''));
        return resolve({
          disponible: false,
          activo: null,
          nota: sinPermiso
            ? 'No se pudo consultar ufw sin privilegios (ejecuta: sudo ufw status).'
            : 'ufw no está instalado; probablemente no haya cortafuegos bloqueando.'
        });
      }
      const activo = /Status:\s*active|Estado:\s*activo/i.test(stdout);
      const abierto = new RegExp(`\\b${puerto}\\b`).test(stdout);
      resolve({
        disponible: true,
        activo,
        abierto,
        nota: !activo ? 'El cortafuegos está inactivo: la red local ya tiene acceso.'
             : abierto ? `El puerto ${puerto} ya está permitido.`
                       : `El cortafuegos está activo y el puerto ${puerto} no aparece permitido.`
      });
    });
  });
}

/* ══════════════ Servidor de archivos estáticos ══════════════ */
function seguro(urlPath) {
  // Normaliza y bloquea intentos de salir del directorio raíz (../../etc/passwd)
  const limpio = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const destino = path.normalize(path.join(RAIZ, limpio));
  return destino.startsWith(RAIZ) ? destino : null;
}

async function servirArchivo(req, res, archivo) {
  const st = await fsp.stat(archivo);
  const ext = path.extname(archivo).toLowerCase();
  const etag = `W/"${st.size}-${st.mtimeMs.toString(36)}"`;

  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { ETag: etag });
    return res.end();
  }

  const cabeceras = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'ETag': etag,
    'Last-Modified': st.mtime.toUTCString(),
    'X-Content-Type-Options': 'nosniff',
    // El HTML se revalida siempre; los recursos estáticos se cachean 1 hora
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
  };

  const acepta = String(req.headers['accept-encoding'] || '');
  const comprimir = COMPRIMIBLES.has(ext) && /\bgzip\b/.test(acepta) && st.size > 1024;

  if (comprimir) {
    cabeceras['Content-Encoding'] = 'gzip';
    cabeceras['Vary'] = 'Accept-Encoding';
    res.writeHead(200, cabeceras);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(archivo).pipe(zlib.createGzip({ level: 6 })).pipe(res);
  } else {
    cabeceras['Content-Length'] = st.size;
    res.writeHead(200, cabeceras);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(archivo).pipe(res);
  }
}

function json(res, codigo, cuerpo) {
  const texto = JSON.stringify(cuerpo);
  res.writeHead(codigo, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(texto),
    'Cache-Control': 'no-store'
  });
  res.end(texto);
}

/* ══════════════ API: recepción del formulario ══════════════ */
function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    let datos = '', tam = 0;
    req.on('data', trozo => {
      tam += trozo.length;
      if (tam > MAX_BODY) { reject(new Error('La solicitud es demasiado grande.')); req.destroy(); return; }
      datos += trozo;
    });
    req.on('end', () => resolve(datos));
    req.on('error', reject);
  });
}

const validos = {
  nombre:   v => typeof v === 'string' && v.trim().length >= 3 && v.trim().length <= 80,
  telefono: v => typeof v === 'string' && /^\d{7,15}$/.test(v.replace(/[\s()+-]/g, '')),
  correo:   v => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(v.trim()),
  mensaje:  v => typeof v === 'string' && v.trim().length >= 10 && v.trim().length <= 600
};

/* Límite simple: máximo 5 envíos por IP cada 10 minutos */
const envios = new Map();
function limitado(ip) {
  const ahora = Date.now();
  const ventana = 10 * 60 * 1000;
  const lista = (envios.get(ip) || []).filter(t => ahora - t < ventana);
  if (lista.length >= 5) { envios.set(ip, lista); return true; }
  lista.push(ahora);
  envios.set(ip, lista);
  return false;
}

async function guardarMensaje(datos) {
  await fsp.mkdir(DIR_DATOS, { recursive: true });
  let lista = [];
  try {
    lista = JSON.parse(await fsp.readFile(ARCHIVO_MSG, 'utf8'));
    if (!Array.isArray(lista)) lista = [];
  } catch { /* primer mensaje: el archivo aún no existe */ }
  lista.push(datos);
  await fsp.writeFile(ARCHIVO_MSG, JSON.stringify(lista, null, 2), 'utf8');
  return lista.length;
}

async function apiContacto(req, res, ip) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Método no permitido.' });

  let cuerpo;
  try {
    cuerpo = JSON.parse(await leerCuerpo(req) || '{}');
  } catch {
    return json(res, 400, { ok: false, error: 'Formato de datos inválido.' });
  }

  // Campo trampa anti-spam: si viene relleno, respondemos ok sin guardar
  if (cuerpo.website) return json(res, 200, { ok: true, mensaje: 'Recibido.' });

  if (limitado(ip)) {
    return json(res, 429, { ok: false, error: 'Demasiados envíos seguidos. Inténtalo en unos minutos.' });
  }

  const errores = Object.entries(validos)
    .filter(([campo, prueba]) => !prueba(cuerpo[campo]))
    .map(([campo]) => campo);

  if (errores.length) {
    return json(res, 422, { ok: false, error: 'Revisa los campos: ' + errores.join(', '), campos: errores });
  }

  const limpiar = t => String(t).trim().slice(0, 600);
  const registro = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    fecha: new Date().toISOString(),
    nombre:   limpiar(cuerpo.nombre),
    telefono: limpiar(cuerpo.telefono),
    correo:   limpiar(cuerpo.correo),
    servicio: cuerpo.servicio ? limpiar(cuerpo.servicio) : 'Sin especificar',
    mensaje:  limpiar(cuerpo.mensaje),
    ip
  };

  try {
    const total = await guardarMensaje(registro);
    console.log(`\n  📩 Nueva solicitud de cita (#${total})`);
    console.log(`     ${registro.nombre} · ${registro.telefono} · ${registro.correo}`);
    console.log(`     Servicio: ${registro.servicio}`);
    console.log(`     Guardada en data/mensajes.json\n`);
    return json(res, 200, { ok: true, mensaje: 'Solicitud recibida.', id: registro.id });
  } catch (err) {
    console.error('  ⚠️  No se pudo guardar el mensaje:', err.message);
    return json(res, 500, { ok: false, error: 'Error al guardar la solicitud.' });
  }
}

/* ══════════════ Enrutado ══════════════ */
const servidor = http.createServer(async (req, res) => {
  const ip = (req.socket.remoteAddress || '').replace('::ffff:', '');
  const url = req.url || '/';

  try {
    // API
    if (url.split('?')[0] === '/api/contacto') return await apiContacto(req, res, ip);

    // Listado de mensajes recibidos (solo desde el propio equipo)
    if (url.split('?')[0] === '/api/mensajes') {
      if (!['127.0.0.1', '::1'].includes(ip)) return json(res, 403, { ok: false, error: 'Acceso restringido.' });
      try {
        return json(res, 200, { ok: true, mensajes: JSON.parse(await fsp.readFile(ARCHIVO_MSG, 'utf8')) });
      } catch {
        return json(res, 200, { ok: true, mensajes: [] });
      }
    }

    if (!['GET', 'HEAD'].includes(req.method)) {
      return json(res, 405, { ok: false, error: 'Método no permitido.' });
    }

    let destino = seguro(url);
    if (!destino) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('403 · Acceso denegado');
    }

    // No exponer el código del servidor ni los mensajes guardados
    const relativo = path.relative(RAIZ, destino);
    if (relativo === 'server.js' || relativo.startsWith('data')) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('403 · Acceso denegado');
    }

    let st;
    try { st = await fsp.stat(destino); } catch { st = null; }
    if (st?.isDirectory()) {
      destino = path.join(destino, 'index.html');
      try { st = await fsp.stat(destino); } catch { st = null; }
    }

    if (!st) {                                    // 404 · vuelve al inicio
      const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1"><title>404 · Página no encontrada</title>
        <style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;
        background:#FDF6F4;color:#35292A;text-align:center;padding:2rem}h1{font-size:4rem;margin:0;color:#C9A96E}
        a{color:#A88949}</style></head><body><div><h1>404</h1>
        <p>No encontramos <code>${url.replace(/[<>&"]/g, '')}</code></p>
        <p><a href="/">Volver al inicio</a></p></div></body></html>`;
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    }

    await servirArchivo(req, res, destino);

  } catch (err) {
    console.error('  ⚠️  Error:', err.message);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('500 · Error interno del servidor');
    }
  }
});

/* ══════════════ Arranque ══════════════ */
const c = {
  reset: '\x1b[0m', neg: '\x1b[1m', tenue: '\x1b[2m',
  oro: '\x1b[38;5;179m', rosa: '\x1b[38;5;217m',
  verde: '\x1b[38;5;114m', ambar: '\x1b[38;5;215m', gris: '\x1b[38;5;245m'
};

(async () => {
  let puerto, cambiado;
  try {
    ({ puerto, cambiado } = await buscarPuerto(PUERTO_BASE));
  } catch (err) {
    console.error(`\n  ${c.ambar}✖ ${err.message}${c.reset}\n`);
    process.exit(1);
  }

  servidor.listen(puerto, HOST, async () => {
    const ips = ipsLocales();
    const fw  = await estadoFirewall(puerto);
    const línea = `${c.tenue}${'─'.repeat(62)}${c.reset}`;

    console.log(`\n${línea}`);
    console.log(`  ${c.oro}${c.neg}✿  SKIN GLOW${c.reset} ${c.gris}· servidor local en marcha${c.reset}`);
    console.log(`${línea}\n`);

    console.log(`  ${c.neg}En este equipo${c.reset}`);
    console.log(`    ${c.rosa}http://localhost:${puerto}${c.reset}\n`);

    if (ips.length) {
      console.log(`  ${c.neg}Desde el móvil (misma red WiFi)${c.reset}`);
      ips.forEach(({ ip, nombre }) =>
        console.log(`    ${c.verde}${c.neg}http://${ip}:${puerto}${c.reset}  ${c.gris}(${nombre})${c.reset}`));
      console.log('');
    } else {
      console.log(`  ${c.ambar}⚠  Sin interfaces de red: conéctate al WiFi para acceder desde el móvil.${c.reset}\n`);
    }

    if (cambiado) {
      console.log(`  ${c.ambar}ℹ  El puerto ${PUERTO_BASE} estaba ocupado; se usó el ${puerto}.${c.reset}\n`);
    }

    const iconoFw = fw.activo === true && fw.abierto === false ? '⚠' : '✔';
    console.log(`  ${c.neg}Cortafuegos${c.reset}`);
    console.log(`    ${iconoFw}  ${c.gris}${fw.nota}${c.reset}`);
    if (fw.activo === true && fw.abierto === false) {
      console.log(`    ${c.ambar}Ábrelo con:${c.reset} sudo ufw allow ${puerto}/tcp`);
    }
    console.log('');
    console.log(`  ${c.gris}Los mensajes del formulario se guardan en data/mensajes.json${c.reset}`);
    console.log(`  ${c.gris}Detener el servidor: Ctrl + C${c.reset}`);
    console.log(`${línea}\n`);
  });
})();

servidor.on('error', err => {
  console.error(`\n  ${c.ambar}✖ Error del servidor: ${err.message}${c.reset}\n`);
  process.exit(1);
});

/* Cierre ordenado */
let cerrando = false;
['SIGINT', 'SIGTERM'].forEach(señal => {
  process.on(señal, () => {
    if (cerrando) process.exit(0);
    cerrando = true;
    console.log(`\n  ${c.gris}Cerrando el servidor…${c.reset}\n`);
    servidor.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2500).unref();
  });
});
