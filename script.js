/* ============================================================================
   SKIN GLOW · JavaScript vanilla (sin frameworks ni librerías)
   ---------------------------------------------------------------------------
   01. Utilidades              06. Comparador antes/después
   02. Header + scrollspy      07. Slider de testimonios
   03. Menú móvil              08. Cuenta regresiva
   04. Animaciones al scroll   09. Formulario de contacto
   05. Filtros de servicios    10. Botón volver arriba · varios
   ========================================================================== */
'use strict';

/* ══════════════ 01. UTILIDADES ══════════════ */
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Ejecuta fn como máximo una vez por frame de animación. */
function rafThrottle(fn) {
  let ticking = false;
  return (...args) => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { fn(...args); ticking = false; });
  };
}

/** Notificación flotante. tipo: 'ok' | 'err' | '' */
let toastTimer;
function toast(msg, tipo = '') {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast is-shown' + (tipo ? ' is-' + tipo : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 4200);
}


/* ══════════════ 02. HEADER + SCROLLSPY ══════════════ */
(function header() {
  const header = $('#header');
  const links = $$('.nav__link');
  const sections = links
    .map(a => $(a.getAttribute('href')))
    .filter(Boolean);

  const onScroll = rafThrottle(() => {
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 60);

    // Sección activa: la última cuyo inicio ya pasó la línea de referencia
    const marca = y + window.innerHeight * 0.32;
    let activa = sections[0];
    for (const sec of sections) {
      if (sec.offsetTop <= marca) activa = sec;
    }
    // Al final de la página, marcamos la última sección visible
    if (window.innerHeight + y >= document.body.offsetHeight - 80) {
      activa = sections[sections.length - 1];
    }
    links.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + activa.id));
  });

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();
})();


/* ══════════════ 03. MENÚ MÓVIL (hamburguesa) ══════════════ */
(function menuMovil() {
  const burger   = $('#burger');
  const nav      = $('#nav');
  const backdrop = $('#navBackdrop');
  if (!burger || !nav) return;

  const abrir = () => {
    nav.classList.add('is-open');
    burger.classList.add('is-open');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Cerrar menú');
    document.body.classList.add('is-locked');
    backdrop.hidden = false;
    requestAnimationFrame(() => backdrop.classList.add('is-open'));
  };

  const cerrar = () => {
    nav.classList.remove('is-open');
    burger.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Abrir menú');
    document.body.classList.remove('is-locked');
    backdrop.classList.remove('is-open');
    setTimeout(() => { backdrop.hidden = true; }, 350);
  };

  const alternar = () => nav.classList.contains('is-open') ? cerrar() : abrir();

  burger.addEventListener('click', alternar);
  backdrop.addEventListener('click', cerrar);
  nav.addEventListener('click', e => { if (e.target.closest('a')) cerrar(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) { cerrar(); burger.focus(); }
  });
  // Si se pasa a escritorio con el menú abierto, se restablece
  window.addEventListener('resize', () => {
    if (window.innerWidth > 980 && nav.classList.contains('is-open')) cerrar();
  });
})();


/* ══════════════ 04. ANIMACIONES AL HACER SCROLL ══════════════ */
(function revelar() {
  const elementos = $$('[data-reveal]');
  if (!elementos.length) return;

  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    elementos.forEach(el => el.classList.add('is-visible'));
    return;
  }

  const io = new IntersectionObserver((entradas, obs) => {
    entradas.forEach(entrada => {
      if (!entrada.isIntersecting) return;
      // Retraso escalonado entre hermanos para un efecto en cascada
      const hermanos = Array.from(entrada.target.parentElement.children)
        .filter(n => n.hasAttribute('data-reveal'));
      const i = hermanos.indexOf(entrada.target);
      entrada.target.style.transitionDelay = (i > 0 ? Math.min(i, 5) * 90 : 0) + 'ms';
      entrada.target.classList.add('is-visible');
      obs.unobserve(entrada.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

  elementos.forEach(el => io.observe(el));

  // Red de seguridad: si el observador no llega a ejecutarse (navegadores
  // antiguos, pestañas en segundo plano), mostramos lo que ya está en pantalla.
  window.addEventListener('load', () => {
    setTimeout(() => {
      elementos.forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('is-visible');
      });
    }, 900);
  });
})();


/* Contadores animados */
(function contadores() {
  const stats = $$('.stat');
  if (!stats.length || !('IntersectionObserver' in window)) {
    stats.forEach(s => s.textContent = formatear(s));
    return;
  }

  function formatear(el, valor) {
    const dec = Number(el.dataset.decimal || 0);
    const v = valor === undefined ? Number(el.dataset.count) : valor;
    const num = dec ? (v / Math.pow(10, dec)).toFixed(dec) : Math.round(v);
    return num + (el.dataset.suffix || '');
  }

  const io = new IntersectionObserver((entradas, obs) => {
    entradas.forEach(({ isIntersecting, target }) => {
      if (!isIntersecting) return;
      obs.unobserve(target);

      const fin = Number(target.dataset.count) || 0;
      if (prefersReducedMotion) { target.textContent = formatear(target, fin); return; }

      const dur = 1600;
      const t0 = performance.now();
      const paso = ahora => {
        const p = Math.min((ahora - t0) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);          // easeOutCubic
        target.textContent = formatear(target, fin * eased);
        if (p < 1) requestAnimationFrame(paso);
      };
      requestAnimationFrame(paso);
    });
  }, { threshold: 0.5 });

  stats.forEach(s => io.observe(s));
})();


/* ══════════════ 05. FILTROS DE SERVICIOS ══════════════ */
(function filtros() {
  const botones = $$('.filter');
  const tarjetas = $$('#cardsGrid .card');
  if (!botones.length) return;

  botones.forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.filter;
      botones.forEach(b => b.classList.toggle('is-active', b === btn));

      let visibles = 0;
      tarjetas.forEach(card => {
        const cats = (card.dataset.cat || '').split(' ');
        const mostrar = cat === 'all' || cats.includes(cat);
        card.classList.toggle('is-hidden', !mostrar);
        if (mostrar) {
          visibles++;
          if (!prefersReducedMotion) {
            card.style.animation = 'none';
            void card.offsetWidth;                      // fuerza reflow
            card.style.animation = `fadeUp .5s ${visibles * 55}ms both`;
          }
        }
      });
    });
  });
})();


/* ══════════════ 06. COMPARADOR ANTES / DESPUÉS ══════════════ */
(function antesDespues() {
  $$('.ba__frame').forEach(frame => {
    const range = $('.ba__range', frame);
    if (!range) return;

    const aplicar = v => frame.style.setProperty('--pos', v + '%');

    range.addEventListener('input', () => aplicar(range.value));
    aplicar(range.value);

    // Arrastre directo sobre la imagen (ratón, dedo o lápiz)
    let arrastrando = false;
    const mover = e => {
      const r = frame.getBoundingClientRect();
      const pct = Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100));
      range.value = pct;
      aplicar(pct);
    };

    frame.addEventListener('pointerdown', e => {
      arrastrando = true;
      frame.setPointerCapture(e.pointerId);
      mover(e);
    });
    frame.addEventListener('pointermove', e => { if (arrastrando) mover(e); });
    ['pointerup', 'pointercancel'].forEach(ev =>
      frame.addEventListener(ev, e => {
        arrastrando = false;
        if (frame.hasPointerCapture?.(e.pointerId)) frame.releasePointerCapture(e.pointerId);
      })
    );
  });
})();


/* ══════════════ 07. SLIDER DE TESTIMONIOS ══════════════ */
(function slider() {
  const raiz  = $('#slider');
  const track = $('#sliderTrack');
  if (!raiz || !track) return;

  const slides = $$('.slide', track);
  const dots   = $('#sliderDots');
  const total  = slides.length;
  let indice = 0;
  let timer;

  // Puntos de navegación
  slides.forEach((_, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-label', `Testimonio ${i + 1} de ${total}`);
    b.addEventListener('click', () => { ir(i); reiniciar(); });
    dots.appendChild(b);
  });
  const puntos = $$('button', dots);

  function ir(i) {
    indice = (i + total) % total;
    track.style.transform = `translateX(-${indice * 100}%)`;
    puntos.forEach((p, k) => {
      p.classList.toggle('is-active', k === indice);
      p.setAttribute('aria-selected', k === indice ? 'true' : 'false');
    });
    slides.forEach((s, k) => s.setAttribute('aria-hidden', k === indice ? 'false' : 'true'));
  }

  const siguiente = () => ir(indice + 1);
  const anterior  = () => ir(indice - 1);

  function iniciar() { if (!prefersReducedMotion) timer = setInterval(siguiente, 6500); }
  function detener() { clearInterval(timer); }
  function reiniciar() { detener(); iniciar(); }

  $('#nextBtn').addEventListener('click', () => { siguiente(); reiniciar(); });
  $('#prevBtn').addEventListener('click', () => { anterior();  reiniciar(); });

  raiz.addEventListener('mouseenter', detener);
  raiz.addEventListener('mouseleave', iniciar);
  raiz.addEventListener('focusin', detener);
  raiz.addEventListener('focusout', iniciar);

  // Teclado
  raiz.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { siguiente(); reiniciar(); }
    if (e.key === 'ArrowLeft')  { anterior();  reiniciar(); }
  });

  // Deslizar con el dedo
  let x0 = null, y0 = null;
  track.addEventListener('touchstart', e => {
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
    detener();
  }, { passive: true });

  track.addEventListener('touchend', e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    // Solo si el gesto fue claramente horizontal
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) dx < 0 ? siguiente() : anterior();
    x0 = y0 = null;
    iniciar();
  }, { passive: true });

  // Pausa cuando la pestaña no está visible
  document.addEventListener('visibilitychange', () => document.hidden ? detener() : iniciar());

  ir(0);
  iniciar();
})();


/* ══════════════ 08. CUENTA REGRESIVA DE PROMOCIONES ══════════════ */
(function cuentaRegresiva() {
  const reloj = $('#countdown');
  if (!reloj) return;

  const campos = {
    d: $('[data-cd="d"]', reloj), h: $('[data-cd="h"]', reloj),
    m: $('[data-cd="m"]', reloj), s: $('[data-cd="s"]', reloj)
  };
  let fin = new Date(reloj.dataset.deadline).getTime();

  // Si la fecha ya pasó o no es válida, se proyecta a 14 días vista
  if (isNaN(fin) || fin < Date.now()) fin = Date.now() + 14 * 864e5;

  const pad = n => String(n).padStart(2, '0');

  function tic() {
    const falta = fin - Date.now();
    if (falta <= 0) {
      Object.values(campos).forEach(c => c.textContent = '00');
      clearInterval(intervalo);
      return;
    }
    const s = Math.floor(falta / 1000);
    campos.d.textContent = pad(Math.floor(s / 86400));
    campos.h.textContent = pad(Math.floor(s / 3600) % 24);
    campos.m.textContent = pad(Math.floor(s / 60) % 60);
    campos.s.textContent = pad(s % 60);
  }

  tic();
  const intervalo = setInterval(tic, 1000);
})();


/* ══════════════ 09. FORMULARIO DE CONTACTO ══════════════ */
(function formulario() {
  const form = $('#contactForm');
  if (!form) return;

  const estado  = $('#formStatus');
  const boton   = $('#submitBtn');
  const contador = $('#charCount');
  const mensaje = $('#mensaje');

  /* Reglas de validación por campo */
  const reglas = {
    nombre: v => {
      if (!v.trim()) return 'Escribe tu nombre.';
      if (v.trim().length < 3) return 'El nombre debe tener al menos 3 caracteres.';
      if (!/^[a-zA-ZÀ-ÿñÑ\s'.-]+$/.test(v.trim())) return 'El nombre solo puede contener letras.';
      return '';
    },
    telefono: v => {
      const limpio = v.replace(/[\s()+-]/g, '');
      if (!limpio) return 'Escribe tu número de teléfono.';
      if (!/^\d{7,15}$/.test(limpio)) return 'Ingresa un teléfono válido (entre 7 y 15 dígitos).';
      return '';
    },
    correo: v => {
      if (!v.trim()) return 'Escribe tu correo electrónico.';
      if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(v.trim())) return 'El correo no parece válido. Ej: nombre@correo.com';
      return '';
    },
    mensaje: v => {
      if (!v.trim()) return 'Cuéntanos en qué podemos ayudarte.';
      if (v.trim().length < 10) return 'El mensaje debe tener al menos 10 caracteres.';
      return '';
    },
    acepto: (v, el) => el.checked ? '' : 'Debes autorizar el tratamiento de datos para continuar.'
  };

  function validarCampo(nombre) {
    const el = form.elements[nombre];
    const err = $('#err-' + nombre);
    const contenedor = el.closest('.field');
    const texto = reglas[nombre](el.value, el);

    if (err) {
      err.textContent = texto;
      err.classList.toggle('is-shown', Boolean(texto));
    }
    if (contenedor) {
      contenedor.classList.toggle('is-invalid', Boolean(texto));
      contenedor.classList.toggle('is-valid', !texto && el.value.trim() !== '');
    }
    el.setAttribute('aria-invalid', texto ? 'true' : 'false');
    return !texto;
  }

  // Validación en vivo: al salir del campo y mientras se corrige un error
  Object.keys(reglas).forEach(nombre => {
    const el = form.elements[nombre];
    if (!el) return;
    const evento = el.type === 'checkbox' ? 'change' : 'blur';
    el.addEventListener(evento, () => validarCampo(nombre));
    el.addEventListener('input', () => {
      const cont = el.closest('.field');
      if (cont?.classList.contains('is-invalid') || el.type === 'checkbox') validarCampo(nombre);
    });
  });

  // Contador de caracteres
  mensaje.addEventListener('input', () => { contador.textContent = mensaje.value.length; });

  // Al pulsar "Agendar" en una tarjeta o promoción, se preselecciona el servicio
  $$('[data-servicio]').forEach(el => {
    el.addEventListener('click', () => {
      const select = form.elements.servicio;
      const valor = el.dataset.servicio;
      const existe = Array.from(select.options).some(o => o.value === valor || o.text === valor);
      select.value = existe ? valor : '';
      if (!existe) {
        mensaje.value = `Hola, me interesa: ${valor}. ¿Qué disponibilidad tienen?`;
        contador.textContent = mensaje.value.length;
      }
      select.closest('.field').classList.add('is-valid');
      setTimeout(() => form.elements.nombre.focus({ preventScroll: true }), 700);
    });
  });

  /* Envío */
  form.addEventListener('submit', async e => {
    e.preventDefault();
    estado.className = 'form__status';

    const ok = Object.keys(reglas).map(validarCampo).every(Boolean);
    if (!ok) {
      const primero = $('.field.is-invalid input, .field.is-invalid textarea, .field.is-invalid select', form)
                   || form.elements.acepto;
      primero?.focus();
      primero?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center' });
      toast('Revisa los campos marcados en rojo.', 'err');
      return;
    }

    // Campo trampa: si viene lleno, es un bot
    if (form.elements.website.value) return;

    boton.classList.add('is-loading');
    boton.disabled = true;
    $('.btn__label', boton).textContent = 'Enviando…';

    const datos = {
      nombre:   form.elements.nombre.value.trim(),
      telefono: form.elements.telefono.value.trim(),
      correo:   form.elements.correo.value.trim(),
      servicio: form.elements.servicio.value,
      mensaje:  form.elements.mensaje.value.trim(),
      website:  form.elements.website.value
    };

    try {
      const res = await fetch('/api/contacto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || 'No se pudo enviar la solicitud.');

      estado.className = 'form__status is-ok';
      estado.textContent = '¡Gracias! Recibimos tu solicitud y te contactaremos muy pronto para confirmar tu cita.';
      toast('Solicitud enviada correctamente ✓', 'ok');
      form.reset();
      contador.textContent = '0';
      $$('.field', form).forEach(f => f.classList.remove('is-valid', 'is-invalid'));

    } catch (err) {
      estado.className = 'form__status is-err';
      estado.innerHTML = 'No pudimos enviar tu mensaje. Escríbenos por ' +
        '<a class="link" href="https://wa.me/56954207050" target="_blank" rel="noopener">WhatsApp</a> ' +
        'o inténtalo de nuevo en un momento.';
      toast('Error al enviar. Intenta por WhatsApp.', 'err');

    } finally {
      boton.classList.remove('is-loading');
      boton.disabled = false;
      $('.btn__label', boton).textContent = 'Enviar solicitud';
    }
  });
})();


/* ══════════════ 10. VOLVER ARRIBA · VARIOS ══════════════ */
(function volverArriba() {
  const btn = $('#toTop');
  if (!btn) return;

  const onScroll = rafThrottle(() => {
    btn.classList.toggle('is-visible', window.scrollY > 600);
  });
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  });
})();

/* Año actual en el footer */
(function anio() {
  const el = $('#year');
  if (el) el.textContent = new Date().getFullYear();
})();

/* Corrige el salto de ancla cuando el header fijo tapa el título */
(function anclas() {
  $$('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id === '#' || id.length < 2) return;
      const destino = $(id);
      if (!destino) return;
      e.preventDefault();
      const offset = ($('#header')?.offsetHeight || 0) + 12;
      window.scrollTo({
        top: destino.getBoundingClientRect().top + window.scrollY - offset,
        behavior: prefersReducedMotion ? 'auto' : 'smooth'
      });
      history.replaceState(null, '', id);
    });
  });
})();
