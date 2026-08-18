# Skin Glow · Landing page para centro de estética

Página web profesional de una sola pantalla para una cosmetóloga, construida con
**HTML5 + CSS3 + JavaScript vanilla** (sin React, Angular ni librerías externas) y
servida por un **servidor Node.js sin dependencias**.

---

## Cómo levantarla

```bash
cd /home/jsanchez/skinglow
node server.js          # o: npm start
```

Al arrancar, la consola muestra la URL local y la de la red WiFi:

```
En este equipo
  http://localhost:3000

Desde el móvil (misma red WiFi)
  http://192.168.100.11:3000
```

Opciones:

| Comando | Efecto |
|---|---|
| `node server.js` | Puerto 3000 (o el siguiente libre) |
| `node server.js --port 8080` | Fuerza otro puerto de inicio |
| `PORT=5000 node server.js` | Igual, mediante variable de entorno |

Para detenerlo: `Ctrl + C`.

Si el puerto está ocupado, el servidor prueba automáticamente los 25 siguientes
y avisa en pantalla de cuál acabó usando.

---

## Estructura

```
skinglow/
├── index.html            Todo el contenido de la página
├── styles.css            Estilos (14 bloques numerados con índice arriba)
├── script.js             Interacciones (10 bloques numerados)
├── server.js             Servidor local + API del formulario
├── site.webmanifest      Instalable como app en el móvil
├── robots.txt            SEO
├── sitemap.xml           SEO
├── package.json
├── data/
│   └── mensajes.json     Se crea solo al recibir el primer formulario
└── assets/
    ├── fonts/            Cormorant Garamond + Jost (self-hosted, 64 KB)
    ├── icons/            Favicon SVG/ICO/PNG y logo
    └── images/
        ├── hero/         Portada y fondo de promociones
        ├── about/        Retrato y estudio
        ├── servicios/    9 tratamientos
        ├── galeria/      3 pares antes/después
        ├── testimonios/  4 avatares
        └── og-image.jpg  Imagen para compartir en redes
```

---

## Qué personalizar

Busca en los archivos la marca **`✏️ EDITABLE`**: señala cada punto pensado para
cambiarse. Resumen:

| Qué | Dónde |
|---|---|
| Nombre del centro | `index.html` → logo del header, hero, footer y `<title>` |
| Frase principal | `index.html` → `.hero__tagline` |
| Presentación de la cosmetóloga | `index.html` → sección `#nosotros` |
| **Precios y duración** | `index.html` → `.card__price` y `.card__meta` de cada tarjeta |
| Servicios (añadir/quitar) | Duplica un bloque `<article class="card">` y ajusta `data-cat` |
| Promociones y descuentos | `index.html` → sección `#promociones` |
| Fin de la cuenta regresiva | `index.html` → `data-deadline="2026-09-01T23:59:59"` |
| Teléfono / WhatsApp | Busca y reemplaza `56954207050` en todo el proyecto |
| Instagram | Busca y reemplaza `skinglowbydiana` en los enlaces sociales |
| Dirección y Google Maps | `index.html` → sección `#contacto` (parámetro `q=` del iframe) |
| Horarios | `index.html` → `#contacto` y footer |
| Colores | `styles.css` → bloque `:root` (paleta completa en un solo sitio) |
| Dominio real para SEO | `index.html` (canonical, Open Graph, JSON-LD), `robots.txt`, `sitemap.xml` |

### Cambiar la paleta

Todo el color sale de variables CSS. Por ejemplo, para un dorado más cálido basta con:

```css
:root {
  --oro: #C9A96E;        /* dorado principal */
  --rosa-300: #E8BDB4;   /* rosado */
  --beige-100: #F3EDE2;  /* beige */
}
```

---

## ⚠️ Antes de publicar: sustituye las fotografías

Todas las imágenes son **fotografías de stock de Unsplash** usadas como marcador de
posición. Antes de poner el sitio en producción:

1. **Retrato de la cosmetóloga** (`assets/images/about/cosmetologa.webp`): hoy muestra
   a una profesional de stock que no es la persona del negocio. Reemplázalo por una
   foto real; de lo contrario el sitio atribuye un nombre y unas credenciales a alguien
   que no le corresponde.
2. **Galería antes/después** (`assets/images/galeria/`): los seis archivos son **la misma
   fotografía duplicada**, con la versión «antes» apagada digitalmente para demostrar el
   comparador. **No son resultados reales.** Sustitúyelos por fotos auténticas de
   clientas, con autorización escrita, y actualiza el aviso bajo la galería (hay un
   comentario en el HTML con el texto sugerido).
3. **Testimonios**: los nombres y opiniones son ficticios. Cámbialos por reseñas reales.
4. **Imágenes de servicios**: son ilustrativas; ganan mucho con fotos de tu propio espacio.

Formato recomendado: **WebP**, ancho 900 px para tarjetas y 1920 px para la portada.
Para convertir tus JPG:

```bash
python3 -c "from PIL import Image; im=Image.open('foto.jpg'); im.save('foto.webp','WEBP',quality=80,method=6)"
```

Mantén los mismos nombres de archivo y no hará falta tocar el HTML. Si cambias la
proporción, ajusta también `width` y `height` en la etiqueta `<img>` (evita saltos de
maquetación al cargar).

---

## Funcionalidades incluidas

**Diseño**
- Responsive real, probado de 390 px a 1600 px (breakpoints: 1100 / 980 / 720 / 520).
- Menú hamburguesa con panel lateral, fondo oscurecido, cierre con `Esc` y bloqueo de scroll.
- Animaciones de entrada al hacer scroll (IntersectionObserver, en cascada).
- Contadores animados, cuenta regresiva de promociones y efecto de zoom en la portada.
- Respeta `prefers-reduced-motion`: si el sistema pide menos movimiento, se desactivan.

**Componentes**
- Filtros de servicios por categoría (Faciales / Avanzados).
- Comparador antes/después arrastrable con ratón, dedo y teclado.
- Carrusel de testimonios con autoplay, puntos, flechas, swipe y pausa al pasar el cursor.
- Botón flotante de WhatsApp y botón «volver arriba».
- Al pulsar «Agendar» en un servicio, el formulario se rellena con ese tratamiento.

**Formulario**
- Validación en vivo (nombre, teléfono, correo, mensaje y consentimiento) con mensajes en español.
- Contador de caracteres y estados visuales de válido/inválido.
- Envío por `fetch` a `POST /api/contacto`; si falla, ofrece WhatsApp como alternativa.
- Campo trampa anti-spam y límite de 5 envíos por IP cada 10 minutos.

**SEO y rendimiento**
- Meta descripción, keywords, canonical, Open Graph y Twitter Card.
- Datos estructurados JSON-LD tipo `BeautySalon` (horarios, dirección, valoración).
- Favicon SVG + ICO + apple-touch-icon y manifiesto web.
- Imágenes en WebP (1,2 MB en total), `loading="lazy"` salvo la portada, `width`/`height` en todas.
- Tipografías self-hosted: la página funciona **sin conexión a internet** (salvo el mapa).
- Compresión gzip y caché por ETag desde el servidor (`styles.css`: 44 KB → 10 KB).

**Accesibilidad**
- Enlace «saltar al contenido», foco visible, roles ARIA en carrusel y menú.
- Etiquetas asociadas a cada campo y errores anunciados con `role="alert"`.

---

## Formulario: dónde llegan los mensajes

Cada solicitud se guarda en `data/mensajes.json`:

```json
[
  {
    "id": "msete9wxpxcsk",
    "fecha": "2026-08-04T16:41:02.531Z",
    "nombre": "Ana Torres",
    "telefono": "9 5420 7050",
    "correo": "ana@correo.com",
    "servicio": "Dermaplaning",
    "mensaje": "Quisiera agendar para el sábado por la mañana.",
    "ip": "192.168.100.24"
  }
]
```

También aparecen en la consola del servidor en cuanto entran. Para consultarlas desde
el propio equipo: <http://localhost:3000/api/mensajes> (bloqueado desde otros dispositivos).

> Este almacenamiento en archivo es suficiente para pruebas y uso local. Para producción,
> conviene enviar el formulario a un correo o a un servicio tipo Formspree, o guardar en
> una base de datos.

---

## Acceso desde el móvil

1. Conecta el móvil a **la misma red WiFi** que este equipo.
2. Abre la URL con la IP que muestra la consola, por ejemplo `http://192.168.100.11:3000`.
3. Si no carga:
   - Comprueba que la IP sigue siendo la misma (`hostname -I`); cambia al reconectar el WiFi.
   - Verifica el cortafuegos: `sudo ufw status`. Si está activo, abre el puerto con
     `sudo ufw allow 3000/tcp`.
   - Algunas redes WiFi públicas o de invitados aíslan los dispositivos entre sí
     («AP isolation») y no permiten esta conexión.

En el móvil puedes usar «Añadir a pantalla de inicio»: gracias a `site.webmanifest`
se instala con su icono propio y se abre a pantalla completa.

---

## Notas técnicas del servidor

- Sin dependencias: solo módulos nativos de Node (`http`, `fs`, `zlib`, `net`, `os`).
- Escucha en `0.0.0.0` para ser accesible desde la red local.
- Bloquea el acceso a `server.js` y a `data/`, y rechaza rutas con `../` (path traversal).
- Cierre ordenado con `Ctrl + C`.

Créditos de las fotografías: [Unsplash](https://unsplash.com) (licencia libre, sin atribución obligatoria).
