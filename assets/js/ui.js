/* =========================================================
   JJ's TCG — ui.js (dono: Prisma / Design)
   ES module. Injeta header/footer/drawer, preloader, cursor com
   rastro de estrelas, reveals (GSAP), tilt holográfico, flyToCart,
   badge do carrinho, toasts e transições de página.

   Exports:
     initTilt(root?)            tilt 3D holográfico em .product-card / [data-tilt] (idempotente)
     initReveals(root?)         reveal no scroll para [data-reveal] (idempotente)
     flyToCart(imgEl) -> Promise
     toast(msg, {type, duration}) / showToast (alias)
     openCartDrawer() / closeCartDrawer()
     bumpCartBadge(count)
     renderProductCard(product, {formatPrice, gameLabel})
     starBurst(x, y, n?) / confetti(n?)
     animateCount(el, to, opts?)
     ensureGSAP() -> Promise<gsap|null>
   ========================================================= */

/** Raiz do site (funciona em localhost:5500 e em subpasta do GitHub Pages). */
export const BASE = new URL('../../', import.meta.url).href;
/** Resolve um caminho do site (ex.: 'pages/x.html', '#ancora'; barra inicial é ignorada) a partir da raiz. */
export const url = (p = '') => new URL(String(p).replace(/^\//, ''), BASE).href;

const docEl = document.documentElement;
docEl.classList.add('js');

const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
const mqFine = window.matchMedia('(hover: hover) and (pointer: fine)');
const reduced = () => mqReduce.matches;

const CART_KEY = 'jjtcg_cart';
const STAR_POINTS = '50,2 61,37 98,37 68,58 79,94 50,72 21,94 32,58 2,37 39,37';
let uid = 0;

export const GAMES = {
  pokemon: { label: 'Pokémon', color: '#FFD21F' },
  magic: { label: 'Magic', color: '#FF7A45' },
  yugioh: { label: 'Yu-Gi-Oh!', color: '#A968C9' },
  onepiece: { label: 'One Piece', color: '#FF5470' },
  lorcana: { label: 'Lorcana', color: '#6FB6FF' },
  acessorios: { label: 'Acessórios', color: '#3DDC97' },
};

/* ---------------- helpers ---------------- */
export function starSVG(cls = 'star-svg', gradId) {
  const id = gradId || `jjstar-${++uid}`;
  return `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <defs><linearGradient id="${id}" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#FF4FD8"/><stop offset=".55" stop-color="#FF7A45"/><stop offset="1" stop-color="#FFD21F"/>
    </linearGradient></defs>
    <polygon points="${STAR_POINTS}" fill="url(#${id})" stroke-linejoin="round"/>
  </svg>`;
}

const icons = {
  cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6h15l-1.5 9h-12z"/><path d="M6 6 5 3H2"/><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 7v6M12 17h.01"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 11v6M12 7h.01"/></svg>',
  insta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
  whats: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 21l1.7-5A8.5 8.5 0 1 1 8 19.3z"/><path d="M9 9.5c.3 2 2.5 4.3 4.5 4.8l1.3-1.2 2 1-.5 1.6c-3.5.4-8-4-7.6-7.6l1.6-.5 1 2z" stroke-width="1.4"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.5 2.5 2.3 4 5 4.2"/></svg>',
};
export { icons };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

let gsapPromise;
/** Garante GSAP + ScrollTrigger (usa window.gsap se a página já incluiu via CDN). */
export function ensureGSAP() {
  if (gsapPromise) return gsapPromise;
  gsapPromise = (async () => {
    try {
      if (!window.gsap) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js');
      if (!window.ScrollTrigger) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js');
      window.gsap.registerPlugin(window.ScrollTrigger);
      return window.gsap;
    } catch (e) {
      console.warn('[ui] GSAP indisponível, usando fallback CSS.');
      return null;
    }
  })();
  return gsapPromise;
}

/* ---------------- header / footer / drawer ---------------- */
function currentGame() {
  try { return new URL(location.href).searchParams.get('jogo'); } catch { return null; }
}

function renderHeader(el) {
  const basePath = new URL(BASE).pathname;
  const path = (location.pathname.startsWith(basePath) ? location.pathname.slice(basePath.length) : location.pathname.replace(/^\//, '')).replace(/index\.html$/, '');
  const game = currentGame();
  const is = (p) => (path === p ? ' aria-current="page"' : '');
  const shop = path === 'pages/catalogo.html' && !game ? ' aria-current="page"' : '';
  const gameLinks = Object.entries(GAMES).map(([k, g]) =>
    `<a href="${url(`pages/catalogo.html?jogo=${k}`)}"${game === k ? ' aria-current="page"' : ''}><span class="nav__dot" style="--dot:${g.color}"></span>${g.label}</a>`).join('');

  el.classList.add('site-header');
  el.innerHTML = `
    <div class="site-header__inner container">
      <a class="brand" href="${url()}" aria-label="JJ's TCG — início">
        <img class="brand__logo" src="${url(`assets/img/logo.jpeg`)}" alt="" width="42" height="42">
        <span class="brand__name">JJ's <b>TCG</b></span>
      </a>
      <nav class="nav" id="site-nav" aria-label="Principal">
        <ul class="nav__list">
          <li><a class="nav__link" href="${url()}"${is('')}>Início</a></li>
          <li><a class="nav__link" href="${url(`pages/catalogo.html`)}"${shop}>Loja</a></li>
          <li class="nav__item--drop">
            <a class="nav__link" href="${url(`pages/catalogo.html`)}" aria-haspopup="true"${game ? ' aria-current="page"' : ''}>Jogos ${icons.chevron}</a>
            <div class="nav__drop">${gameLinks}</div>
          </li>
          <li><a class="nav__link" href="${url(`pages/catalogo.html?tipo=booster-box`)}">Booster Boxes</a></li>
          <li><a class="nav__link" href="${url(`pages/catalogo.html?jogo=acessorios`)}">Acessórios</a></li>
          <li class="nav__mobile-only"><a class="nav__link" href="${url(`pages/carrinho.html`)}"${is('pages/carrinho.html')}>Carrinho</a></li>
        </ul>
      </nav>
      <div class="header-actions">
        <a class="icon-btn hide-mobile" href="${url(`pages/catalogo.html#busca`)}" aria-label="Buscar produtos">${icons.search}</a>
        <button class="icon-btn" type="button" data-cart-toggle aria-label="Abrir carrinho" aria-controls="cart-drawer">
          ${icons.cart}
          <span class="cart-count" data-cart-count data-empty="true" aria-hidden="true">0</span>
        </button>
        <button class="icon-btn nav-toggle" type="button" aria-label="Abrir menu" aria-expanded="false" aria-controls="site-nav">
          <span class="nav-toggle__bars"></span>
        </button>
      </div>
    </div>`;

  const toggle = el.querySelector('.nav-toggle');
  const nav = el.querySelector('.nav');
  const mqMobile = window.matchMedia('(max-width: 900px)');
  const syncInert = () => { nav.inert = mqMobile.matches && !nav.classList.contains('is-open'); };
  const setOpen = (open) => {
    nav.classList.toggle('is-open', open);
    syncInert();
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    document.body.classList.toggle('is-locked', open);
  };
  syncInert();
  mqMobile.addEventListener('change', syncInert);
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (e) => { if (e.target.closest('a') && !e.target.closest('[aria-haspopup]')) setOpen(false); });
  nav.querySelector('[aria-haspopup]').addEventListener('click', (e) => {
    if (window.matchMedia('(max-width: 900px)').matches) e.preventDefault();
  });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  window.matchMedia('(min-width: 901px)').addEventListener('change', (m) => { if (m.matches) setOpen(false); });

  // Scroll: fundo com blur, esconder ao descer, barra de progresso
  let lastY = window.scrollY, ticking = false;
  const onScroll = () => {
    const y = window.scrollY;
    const max = docEl.scrollHeight - innerHeight; // leituras antes das escritas
    const goingDown = y > lastY && y > 400 && !nav.classList.contains('is-open');
    const focused = el.matches(':focus-within');
    el.classList.toggle('is-scrolled', y > 12);
    el.classList.toggle('is-hidden', goingDown && !focused);
    el.style.setProperty('--scroll-progress', max > 0 ? (y / max).toFixed(4) : 0);
    lastY = y; ticking = false;
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
}

function renderFooter(el) {
  const year = new Date().getFullYear();
  el.classList.add('site-footer');
  el.innerHTML = `
    <div class="container">
      <div class="site-footer__grid">
        <div class="site-footer__about">
          <a class="brand" href="${url()}"><img class="brand__logo" src="${url(`assets/img/logo.jpeg`)}" alt="" width="42" height="42" loading="lazy"><span class="brand__name">JJ's <b>TCG</b></span></a>
          <p>Sua loja de cartas colecionáveis: Pokémon, Magic, Yu-Gi-Oh!, One Piece e Lorcana. Produtos lacrados, originais e enviados com carinho.</p>
          <div class="socials">
            <a class="icon-btn" href="#" aria-label="Instagram">${icons.insta}</a>
            <a class="icon-btn" href="#" aria-label="WhatsApp">${icons.whats}</a>
            <a class="icon-btn" href="#" aria-label="TikTok">${icons.tiktok}</a>
          </div>
        </div>
        <div>
          <h4>Jogos</h4>
          <ul class="site-footer__links">${Object.entries(GAMES).map(([k, g]) => `<li><a href="${url(`pages/catalogo.html?jogo=${k}`)}">${g.label}</a></li>`).join('')}</ul>
        </div>
        <div>
          <h4>Loja</h4>
          <ul class="site-footer__links">
            <li><a href="${url(`pages/catalogo.html`)}">Todos os produtos</a></li>
            <li><a href="${url(`pages/catalogo.html?tipo=booster-box`)}">Booster Boxes</a></li>
            <li><a href="${url(`pages/catalogo.html?tipo=carta-avulsa`)}">Cartas avulsas</a></li>
            <li><a href="${url(`pages/carrinho.html`)}">Meu carrinho</a></li>
          </ul>
        </div>
        <div>
          <h4>Ajuda</h4>
          <ul class="site-footer__links">
            <li><a href="${url('#beneficios')}">Frete e entrega</a></li>
            <li><a href="${url('#beneficios')}">Trocas e devoluções</a></li>
            <li><a href="${url('#beneficios')}">Autenticidade</a></li>
            <li><a href="#">Fale conosco</a></li>
          </ul>
        </div>
      </div>
      <div class="site-footer__bottom">
        <span>© ${year} JJ's TCG. Todas as marcas pertencem aos seus respectivos donos.</span>
        <div class="pay-list" aria-label="Formas de pagamento"><span>PIX</span><span>Cartão</span><span>Boleto</span></div>
      </div>
      <div class="site-footer__big" aria-hidden="true">JJ's TCG</div>
    </div>`;
}

let drawerEl, lastFocus;
function renderDrawer() {
  if (document.querySelector('[data-cart-drawer]')) return (drawerEl = document.querySelector('[data-cart-drawer]'));
  drawerEl = document.createElement('div');
  drawerEl.className = 'cart-drawer';
  drawerEl.id = 'cart-drawer';
  drawerEl.setAttribute('data-cart-drawer', '');
  drawerEl.setAttribute('aria-hidden', 'true');
  drawerEl.inert = true;
  drawerEl.innerHTML = `
    <div class="cart-drawer__backdrop" data-cart-close></div>
    <div class="cart-drawer__panel" role="dialog" aria-modal="true" aria-labelledby="cart-drawer-title">
      <header class="cart-drawer__head">
        <h2 id="cart-drawer-title">Seu carrinho</h2>
        <button class="icon-btn" type="button" data-cart-close aria-label="Fechar carrinho">${icons.close}</button>
      </header>
      <div class="cart-drawer__body" data-cart-drawer-body>
        <div class="empty-state">
          ${starSVG('empty-state__icon')}
          <h3>Seu carrinho está vazio</h3>
          <p>Que tal abrir uns boosters?</p>
          <a class="btn btn--primary btn--sm" href="${url(`pages/catalogo.html`)}">Ver a loja</a>
        </div>
      </div>
      <footer class="cart-drawer__footer" data-cart-drawer-footer></footer>
    </div>`;
  document.body.appendChild(drawerEl);
  drawerEl.addEventListener('click', (e) => { if (e.target.closest('[data-cart-close]')) closeCartDrawer(); });
  window.addEventListener('keydown', (e) => {
    if (!drawerEl.classList.contains('is-open')) return;
    if (e.key === 'Escape') return closeCartDrawer();
    if (e.key !== 'Tab') return;
    const f = [...drawerEl.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((n) => n.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (!drawerEl.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  });
  return drawerEl;
}

export function openCartDrawer() {
  renderDrawer();
  lastFocus = document.activeElement;
  drawerEl.inert = false;
  drawerEl.setAttribute('aria-hidden', 'false');
  drawerEl.classList.add('is-open');
  document.body.classList.add('is-locked');
  window.dispatchEvent(new CustomEvent('cart:drawer-open'));
  setTimeout(() => drawerEl.querySelector('.cart-drawer__head [data-cart-close]')?.focus(), 60);
}

export function closeCartDrawer() {
  if (!drawerEl) return;
  drawerEl.classList.remove('is-open');
  drawerEl.setAttribute('aria-hidden', 'true');
  drawerEl.inert = true;
  document.body.classList.remove('is-locked');
  window.dispatchEvent(new CustomEvent('cart:drawer-close'));
  lastFocus?.focus?.();
}

/* ---------------- carrinho: badge ---------------- */
function countFromStorage() {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    const items = Array.isArray(raw) ? raw : (raw.items || []);
    return items.reduce((n, it) => n + (Number(it.qty) || 0), 0);
  } catch { return 0; }
}

export function bumpCartBadge(count, { animate = true } = {}) {
  const label = count ? `Abrir carrinho, ${count} ${count === 1 ? 'item' : 'itens'}` : 'Abrir carrinho, vazio';
  document.querySelectorAll('[data-cart-toggle]').forEach((t) => t.setAttribute('aria-label', label));
  let live = document.getElementById('cart-live');
  if (!live) {
    live = document.createElement('span');
    live.id = 'cart-live'; live.className = 'sr-only';
    live.setAttribute('aria-live', 'polite');
    document.body.appendChild(live);
  }
  document.querySelectorAll('[data-cart-count]').forEach((b) => {
    const prev = Number(b.textContent) || 0;
    b.textContent = count > 99 ? '99+' : String(count);
    b.dataset.empty = String(!count);
    if (animate && count !== prev && !reduced()) {
      b.classList.remove('is-bump'); void b.offsetWidth; b.classList.add('is-bump');
    }
  });
  if (animate) live.textContent = `Carrinho: ${count} ${count === 1 ? 'item' : 'itens'}`;
}

/* ---------------- toasts ---------------- */
let toastStack;
export function toast(message, { type = 'success', duration = 3000 } = {}) {
  if (!toastStack) {
    toastStack = document.createElement('div');
    toastStack.className = 'toast-stack';
    toastStack.setAttribute('role', 'status');
    toastStack.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastStack);
  }
  const t = document.createElement('div');
  t.className = `toast toast--${type}`;
  const icon = type === 'error' ? icons.alert : type === 'info' ? icons.info : icons.check;
  t.innerHTML = `<span class="toast__icon">${icon}</span><span class="toast__msg"></span><span class="toast__bar"></span>`;
  t.querySelector('.toast__msg').textContent = message;
  toastStack.appendChild(t);
  const bar = t.querySelector('.toast__bar');
  bar.animate?.([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration, easing: 'linear', fill: 'forwards' });
  const remove = () => { t.classList.add('is-leaving'); setTimeout(() => t.remove(), 320); };
  const timer = setTimeout(remove, duration);
  t.addEventListener('click', () => { clearTimeout(timer); remove(); });
  while (toastStack.children.length > 4) toastStack.firstElementChild.remove();
  return t;
}
export const showToast = toast;

/* ---------------- estrelas: burst / confete ---------------- */
const SPARK_COLORS = ['#FFD21F', '#FF4FD8', '#FF7A45', '#FFEBC8', '#A968C9'];

export function starBurst(x, y, n = 12) {
  if (reduced()) return;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i');
    s.className = 'spark';
    const a = (Math.PI * 2 * i) / n + Math.random() * .5;
    const d = 30 + Math.random() * 50;
    s.style.cssText = `left:${x}px;top:${y}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;--rz:${Math.random() * 360}deg;--spark-c:${SPARK_COLORS[i % SPARK_COLORS.length]};transform:scale(${.5 + Math.random() * .8})`;
    s.addEventListener('animationend', () => s.remove());
    frag.appendChild(s);
  }
  document.body.appendChild(frag);
}

export function confetti(n = 80) {
  if (reduced()) return;
  const wrap = document.createElement('div');
  wrap.className = 'star-rain';
  wrap.setAttribute('aria-hidden', 'true');
  let max = 0;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i');
    const d = 2.4 + Math.random() * 2.2, delay = Math.random() * 1.2;
    max = Math.max(max, d + delay);
    s.style.cssText = `left:${Math.random() * 100}%;--s:${8 + Math.random() * 16}px;--d:${d}s;--delay:${delay}s;--drift:${(Math.random() - .5) * 200}px;--rz:${(Math.random() - .5) * 1080}deg;--spark-c:${SPARK_COLORS[i % SPARK_COLORS.length]}`;
    wrap.appendChild(s);
  }
  document.body.appendChild(wrap);
  setTimeout(() => wrap.remove(), max * 1000 + 200);
}

/* ---------------- fly to cart ---------------- */
export function flyToCart(imgEl) {
  const header = document.querySelector('[data-site-header]');
  header?.classList.remove('is-hidden');
  const target = document.querySelector('[data-cart-toggle]');
  if (!imgEl || !target || reduced() || !imgEl.getBoundingClientRect) {
    return Promise.resolve();
  }
  const from = imgEl.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  if (!from.width) return Promise.resolve();

  const clone = document.createElement('img');
  clone.src = imgEl.currentSrc || imgEl.src;
  clone.alt = '';
  clone.className = 'fly-clone';
  const w = Math.min(from.width, 220), h = w * (from.height / from.width);
  const x0 = from.left + (from.width - w) / 2, y0 = from.top + (from.height - h) / 2;
  clone.style.cssText = `left:${x0}px;top:${y0}px;width:${w}px;height:${h}px`;
  document.body.appendChild(clone);

  const dx = to.left + to.width / 2 - (x0 + w / 2);
  const dy = to.top + to.height / 2 - (y0 + h / 2);
  const s = 24 / w;
  const anim = clone.animate([
    { transform: 'translate(0,0) scale(1) rotate(0)', opacity: 1 },
    { transform: `translate(${dx * .35}px, ${dy * .1 - 90}px) scale(.7) rotate(-12deg)`, opacity: 1, offset: .35 },
    { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(18deg)`, opacity: .6 },
  ], { duration: 850, easing: 'cubic-bezier(.55,.05,.35,1)', fill: 'forwards' });

  return anim.finished.catch(() => {}).then(() => {
    clone.remove();
    starBurst(to.left + to.width / 2, to.top + to.height / 2, 10);
    target.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(1.25) rotate(-8deg)' }, { transform: 'scale(1)' }], { duration: 450, easing: 'cubic-bezier(.34,1.56,.64,1)' });
  });
}

/* ---------------- tilt holográfico ---------------- */
const TILT_SEL = '.product-card, [data-tilt]';
const MAX_TILT = 10;

function bindTilt(card) {
  if (card.__tilt) return;
  card.__tilt = true;
  let raf = 0, rect = null, px = 0, py = 0;
  const update = () => {
    raf = 0;
    const x = (px - rect.left) / rect.width, y = (py - rect.top) / rect.height;
    card.style.setProperty('--ry', `${((x - .5) * MAX_TILT * 2).toFixed(2)}deg`);
    card.style.setProperty('--rx', `${((.5 - y) * MAX_TILT * 2).toFixed(2)}deg`);
    card.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
    card.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
  };
  card.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'mouse' || reduced()) return;
    rect = card.getBoundingClientRect();
    card.classList.add('is-tilting');
    card.style.setProperty('--hover', '1');
  });
  card.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !rect) return;
    px = e.clientX; py = e.clientY;
    if (!raf) raf = requestAnimationFrame(update);
  });
  card.addEventListener('pointerleave', () => {
    if (raf) cancelAnimationFrame(raf), (raf = 0);
    rect = null;
    card.classList.remove('is-tilting');
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');
    card.style.setProperty('--hover', '0');
  });
}

export function initTilt(root = document) {
  if (!mqFine.matches) return;
  if (root.matches?.(TILT_SEL)) bindTilt(root);
  root.querySelectorAll?.(TILT_SEL).forEach(bindTilt);
}

/* ---------------- reveals ---------------- */
let revealIO;
const pendingReveals = new Set();
let revealQueue = [], revealFlushing = false;

function flushReveals() {
  const batch = revealQueue; revealQueue = []; revealFlushing = false;
  const gsap = window.gsap;
  if (gsap) {
    gsap.to(batch, {
      opacity: 1, x: 0, y: 0, scale: 1,
      duration: 1, ease: 'expo.out', stagger: .08, overwrite: true,
      onComplete() { batch.forEach((el) => el.classList.add('is-revealed')); },
    });
    // failsafe: se o ticker do GSAP estiver pausado (aba oculta etc.), o CSS revela
    setTimeout(() => batch.forEach((el) => el.classList.add('is-revealed')), 1400 + batch.length * 80);
  } else {
    batch.forEach((el, i) => { el.style.setProperty('--reveal-delay', `${i * .08}s`); el.classList.add('is-revealed'); });
  }
}

function revealNow(el) {
  if (!pendingReveals.delete(el)) return;
  revealIO?.unobserve(el);
  revealQueue.push(el);
  if (el.dataset.countTo != null) animateCount(el, Number(el.dataset.countTo));
  el.querySelectorAll('[data-count-to]').forEach((c) => animateCount(c, Number(c.dataset.countTo)));
  if (!revealFlushing) { revealFlushing = true; setTimeout(flushReveals, 16); }
}

// Fallback por scroll (debounce) — cobre casos em que o IO não dispara
let revealScrollT = 0;
function checkRevealsByRect() {
  revealScrollT = 0;
  const limit = innerHeight * .95;
  pendingReveals.forEach((el) => { if (el.getBoundingClientRect().top < limit) revealNow(el); });
}
window.addEventListener('scroll', () => {
  if (pendingReveals.size && !revealScrollT) revealScrollT = setTimeout(checkRevealsByRect, 150);
}, { passive: true });

export function initReveals(root = document) {
  const els = [...(root.querySelectorAll?.('[data-reveal]:not([data-reveal-bound])') || [])];
  if (root.matches?.('[data-reveal]:not([data-reveal-bound])')) els.unshift(root);
  if (!els.length) return;
  if (reduced() || !('IntersectionObserver' in window)) {
    els.forEach((el) => { el.dataset.revealBound = ''; el.classList.add('is-revealed'); });
    return;
  }
  if (!revealIO) {
    revealIO = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) revealNow(en.target); });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });
  }
  els.forEach((el) => { el.dataset.revealBound = ''; pendingReveals.add(el); revealIO.observe(el); });
  setTimeout(checkRevealsByRect, 200);
}

/* ---------------- contador ---------------- */
export function animateCount(el, to, { duration = 1600, prefix = el.dataset.prefix || '', suffix = el.dataset.suffix || '' } = {}) {
  if (el.__counted) return; el.__counted = true;
  const fmt = new Intl.NumberFormat('pt-BR');
  if (reduced()) { el.textContent = prefix + fmt.format(to) + suffix; return; }
  const t0 = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - t0) / duration);
    const e = 1 - Math.pow(1 - p, 4);
    el.textContent = prefix + fmt.format(Math.round(to * e)) + suffix;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---------------- card de produto ---------------- */
export function renderProductCard(p, { formatPrice = (n) => brl.format(n), gameLabel } = {}) {
  const label = gameLabel || GAMES[p.jogo]?.label || p.jogo || '';
  const href = url(`pages/produto.html?id=${encodeURIComponent(p.id)}`);
  const sale = p.precoAntigo && p.precoAntigo > p.preco ? Math.round((1 - p.preco / p.precoAntigo) * 100) : 0;
  const soldout = Number(p.estoque) <= 0;
  const badges = [
    sale ? `<span class="badge badge--sale">-${sale}%</span>` : '',
    p.lancamento ? `<span class="badge badge--new">Lançamento</span>` : '',
    p.preVenda || p.prevenda ? `<span class="badge badge--preorder">Pré-venda</span>` : '',
    p.raridade ? `<span class="badge badge--rare">${esc(p.raridade)}</span>` : '',
    soldout ? `<span class="badge badge--soldout">Esgotado</span>` : '',
  ].join('');
  return `<article class="product-card" data-product-id="${esc(p.id)}" data-game="${esc(p.jogo)}"${soldout ? ' data-soldout' : ''}>
    <a class="product-card__media" href="${href}" tabindex="-1" aria-hidden="true">
      <img class="product-card__img" src="${esc(p.imagem ? url(p.imagem) : '')}" alt="${esc(p.nome)}" loading="lazy" width="400" height="560">
      <span class="product-card__foil" aria-hidden="true"></span>
      <span class="product-card__glare" aria-hidden="true"></span>
      <div class="product-card__badges">${badges}</div>
    </a>
    <div class="product-card__body">
      <span class="product-card__game">${esc(label)}</span>
      <h3 class="product-card__title"><a href="${href}">${esc(p.nome)}</a></h3>
      <div class="product-card__price">
        ${sale ? `<s class="product-card__old">${formatPrice(p.precoAntigo)}</s>` : ''}
        <strong class="product-card__now">${formatPrice(p.preco)}</strong>
      </div>
      <button class="btn btn--primary btn--sm btn--block product-card__add" type="button" data-add-to-cart="${esc(p.id)}"${soldout ? ' disabled' : ''}>${soldout ? 'Esgotado' : 'Adicionar'}</button>
    </div>
  </article>`;
}

/* ---------------- preloader ---------------- */
function runPreloader() {
  const pre = document.querySelector('.preloader');
  if (!pre) return Promise.resolve();
  const bar = pre.querySelector('.preloader__bar span');
  const seen = sessionStorage.getItem('jj_preloaded');
  const minTime = seen || reduced() ? 150 : 1100;
  const t0 = performance.now();
  let prog = 0;
  const tick = setInterval(() => { prog = Math.min(.9, prog + Math.random() * .18); if (bar) bar.style.transform = `scaleX(${prog})`; }, 120);
  const loaded = document.readyState === 'complete' ? Promise.resolve() : new Promise((r) => window.addEventListener('load', r, { once: true }));
  const cap = new Promise((r) => setTimeout(r, 3500));
  return Promise.race([loaded, cap])
    .then(() => new Promise((r) => setTimeout(r, Math.max(0, minTime - (performance.now() - t0)))))
    .then(() => {
      clearInterval(tick);
      if (bar) bar.style.transform = 'scaleX(1)';
      try { sessionStorage.setItem('jj_preloaded', '1'); } catch {}
      return new Promise((r) => setTimeout(() => {
        pre.classList.add('is-done');
        setTimeout(() => pre.remove(), 700);
        r();
      }, 180));
    });
}

/* ---------------- cursor com rastro de estrelas ---------------- */
function initCursor() {
  if (!mqFine.matches || reduced()) return;
  const dot = document.createElement('div'); dot.className = 'cursor-dot';
  const ring = document.createElement('div'); ring.className = 'cursor-ring';
  const trail = document.createElement('div'); trail.className = 'cursor-trail';
  const canvas = document.createElement('canvas');
  trail.appendChild(canvas);
  [trail, ring, dot].forEach((n) => { n.setAttribute('aria-hidden', 'true'); document.body.appendChild(n); });
  const ctx = canvas.getContext('2d');
  let dpr = 1;
  const resize = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
    canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);
  document.body.classList.add('has-custom-cursor');

  let mx = -100, my = -100, rx = -100, ry = -100, lx = 0, ly = 0, visible = false;
  const parts = [];
  let running = false;

  const drawStar = (x, y, r, rot) => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 ? r * .45 : r;
      const a = rot + (i * Math.PI) / 5 - Math.PI / 2;
      ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    ctx.closePath(); ctx.fill();
  };

  const loop = () => {
    rx += (mx - rx) * .2; ry += (my - ry) * .2;
    dot.style.transform = `translate3d(${mx}px,${my}px,0)`;
    ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= .022; p.x += p.vx; p.y += p.vy; p.vy += .04; p.rot += p.vr;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.c;
      drawStar(p.x, p.y, p.r * p.life, p.rot);
    }
    ctx.globalAlpha = 1;
    const settled = Math.abs(mx - rx) < .1 && Math.abs(my - ry) < .1;
    if (parts.length || !settled) requestAnimationFrame(loop); else running = false;
  };
  const kick = () => { if (!running) { running = true; requestAnimationFrame(loop); } };

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    mx = e.clientX; my = e.clientY;
    if (!visible) { visible = true; rx = mx; ry = my; dot.style.opacity = ring.style.opacity = '1'; }
    const dist = Math.hypot(mx - lx, my - ly);
    if (dist > 14 && parts.length < 60) {
      lx = mx; ly = my;
      parts.push({ x: mx, y: my, vx: (Math.random() - .5) * 1.2, vy: (Math.random() - .5) * 1.2 - .3, r: 3 + Math.random() * 4, rot: Math.random() * 6, vr: (Math.random() - .5) * .2, life: 1, c: SPARK_COLORS[(Math.random() * SPARK_COLORS.length) | 0] });
    }
    kick();
  }, { passive: true });
  document.addEventListener('mouseleave', () => { visible = false; dot.style.opacity = ring.style.opacity = '0'; });
  // aba oculta: descarta partículas e limpa o canvas (o loop para sozinho)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { parts.length = 0; rx = mx; ry = my; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  });
  window.addEventListener('pointerdown', () => ring.classList.add('is-down'));
  window.addEventListener('pointerup', () => ring.classList.remove('is-down'));
  const HOVER = 'a, button, [role="button"], .product-card, .chip, label.check, [data-cursor-hover]';
  document.addEventListener('pointerover', (e) => { if (e.target.closest?.(HOVER)) ring.classList.add('is-hover'); });
  document.addEventListener('pointerout', (e) => { if (e.target.closest?.(HOVER) && !e.relatedTarget?.closest?.(HOVER)) ring.classList.remove('is-hover'); });
}

/* ---------------- botões magnéticos ---------------- */
function initMagnetic(root = document) {
  if (!mqFine.matches || reduced()) return;
  root.querySelectorAll('[data-magnetic]:not([data-mag-bound])').forEach((el) => {
    el.dataset.magBound = '';
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * .25, y = (e.clientY - r.top - r.height / 2) * .35;
      el.style.transform = `translate(${x}px, ${y}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
}

/* ---------------- transições de página ---------------- */
function initPageTransitions() {
  const overlay = document.createElement('div');
  overlay.className = 'page-transition';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = starSVG('page-transition__star');
  document.body.appendChild(overlay);

  // Entrada: se vier de uma transição, começa cobrindo e revela
  let fromTransition = false;
  try { fromTransition = sessionStorage.getItem('jj_transition') === '1'; sessionStorage.removeItem('jj_transition'); } catch {}
  if (fromTransition && !reduced()) {
    overlay.style.transition = 'none';
    overlay.classList.add('is-active');
    void overlay.offsetWidth;
    overlay.style.transition = '';
    requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.remove('is-active')));
    document.body.classList.add('is-entering');
  }

  window.addEventListener('pageshow', (e) => { if (e.persisted) overlay.classList.remove('is-active'); });

  if (reduced()) return;
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]');
    if (!a || a.target && a.target !== '_self' || a.hasAttribute('download') || a.dataset.noTransition != null) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.search === location.search) return; // âncora na mesma página
    if (url.hash && url.pathname === location.pathname && url.search === location.search) return;
    e.preventDefault();
    overlay.style.setProperty('--px', `${e.clientX}px`);
    overlay.style.setProperty('--py', `${e.clientY}px`);
    overlay.classList.add('is-active');
    try { sessionStorage.setItem('jj_transition', '1'); } catch {}
    setTimeout(() => { location.href = url.href; }, 480);
  });
}

/* ---------------- hero (home) ---------------- */
async function initHero() {
  const hero = document.querySelector('[data-hero]');
  if (!hero) return;
  const gsap = await ensureGSAP();
  const lines = hero.querySelectorAll('[data-hero-line]');
  const fades = hero.querySelectorAll('[data-hero-fade]');
  const cards = hero.querySelectorAll('[data-hero-card]');
  const star = hero.querySelector('[data-hero-star]');

  const countUp = () => hero.querySelectorAll('[data-count-to]').forEach((c) => animateCount(c, Number(c.dataset.countTo)));
  if (!gsap || reduced()) {
    hero.classList.add('is-ready');
    countUp();
    return;
  }
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.from(star, { scale: .2, rotate: -180, opacity: 0, duration: 1.6 }, 0)
    .from(lines, { yPercent: 110, rotate: 4, opacity: 0, duration: 1.2, stagger: .12 }, .1)
    .from(fades, { y: 24, opacity: 0, duration: 1, stagger: .08 }, .5)
    .from(cards, { y: 160, opacity: 0, rotate: (i) => (i % 2 ? 25 : -25), scale: .8, duration: 1.4, stagger: .1 }, .25)
    .add(countUp, .7);
  hero.classList.add('is-ready');

  // Parallax por scroll
  const ST = window.ScrollTrigger;
  cards.forEach((c) => {
    const depth = Number(c.dataset.depth || 1);
    gsap.to(c, { yPercent: -40 * depth, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
  });
  if (star) gsap.to(star, { yPercent: 25, scale: .85, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
  const content = hero.querySelector('.hero__content');
  if (content) gsap.to(content, { yPercent: 18, opacity: .2, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });

  // Parallax pelo mouse (desktop)
  if (mqFine.matches) {
    const layers = [...hero.querySelectorAll('[data-mouse-depth]')].map((el) => ({
      el, d: Number(el.dataset.mouseDepth),
      qx: gsap.quickTo(el, 'x', { duration: .9, ease: 'power3.out' }),
      qy: gsap.quickTo(el, 'y', { duration: .9, ease: 'power3.out' }),
    }));
    hero.addEventListener('pointermove', (e) => {
      const nx = e.clientX / innerWidth - .5, ny = e.clientY / innerHeight - .5;
      layers.forEach((l) => { l.qx(nx * l.d * 40); l.qy(ny * l.d * 40); });
    });
  }
  ST?.refresh();
}

/* ---------------- pausa animações fora da tela ---------------- */
const PAUSE_SEL = '[data-hero], .games-strip, .presale, .newsletter';
function initOffscreenPause() {
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => en.target.classList.toggle('is-paused', !en.isIntersecting));
  }, { rootMargin: '100px 0px' });
  document.querySelectorAll(PAUSE_SEL).forEach((el) => io.observe(el));
}

/* ---------------- boot ---------------- */
function boot() {
  const header = document.querySelector('[data-site-header]');
  const footer = document.querySelector('[data-site-footer]');
  // skip-link em todas as páginas
  const main = document.querySelector('main');
  if (main && !document.querySelector('.skip-link')) {
    if (!main.id) main.id = 'conteudo';
    const skip = document.createElement('a');
    skip.className = 'skip-link';
    skip.href = `#${main.id}`;
    skip.textContent = 'Pular para o conteúdo';
    skip.dataset.noTransition = '';
    document.body.prepend(skip);
  }
  if (main && !main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
  if (header) renderHeader(header);
  if (footer) renderFooter(footer);
  renderDrawer();

  bumpCartBadge(countFromStorage(), { animate: false });
  window.addEventListener('cart:updated', (e) => {
    const c = e.detail && typeof e.detail.count === 'number' ? e.detail.count : countFromStorage();
    bumpCartBadge(c);
  });
  window.addEventListener('storage', (e) => { if (e.key === CART_KEY) bumpCartBadge(countFromStorage()); });

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-cart-toggle]')) { e.preventDefault(); openCartDrawer(); }
  });

  initPageTransitions();
  initTilt(document);
  initMagnetic(document);
  initCursor();
  initOffscreenPause();

  // GSAP carrega em paralelo; reveals funcionam mesmo sem ele
  ensureGSAP();
  runPreloader().then(() => {
    initReveals(document);
    initHero();
  });

  // Conteúdo injetado depois (catálogo, vitrines): tilt + reveals automáticos
  new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) {
      if (n.nodeType !== 1) continue;
      initTilt(n);
      initMagnetic(n);
      if (document.querySelector('.preloader') == null) initReveals(n);
    }
  }).observe(document.body, { childList: true, subtree: true });

  mqReduce.addEventListener?.('change', () => location.reload());
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
