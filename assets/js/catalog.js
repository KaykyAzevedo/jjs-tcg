// catalog.js — página pages/catalogo.html (Loja / Kitsune)
// Estado dos filtros vive na URL: ?jogo=&tipo=&q=&min=&max=&sort=&estoque=1
import { getProducts, loadProducts, productCardHTML, JOGOS, TIPOS, SORTS, formatBRL, escapeHTML as esc } from './store.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

const el = {
  grid: $('[data-catalog-grid]'),
  count: $('[data-catalog-count]'),
  title: $('[data-catalog-title]'),
  sub: $('[data-catalog-sub]'),
  crumb: $('[data-crumb]'),
  jogo: $('[data-filter-jogo]'),
  tipo: $('[data-filter-tipo]'),
  faixa: $('[data-filter-faixa]'),
  min: $('[data-filter-min]'),
  max: $('[data-filter-max]'),
  q: $('[data-filter-q]'),
  sort: $('[data-filter-sort]'),
  stock: $('[data-filter-stock]'),
  active: $('[data-active-filters]'),
  panel: $('#filtros'),
  open: $('[data-filters-open]'),
};

const SUBS = {
  pokemon: 'Boosters, ETBs e cartas avulsas para treinadores de todas as gerações.',
  magic: 'Play Boosters, Collector Boosters, Commander e singles para planeswalkers.',
  yugioh: 'Structure Decks, boosters e raridades que brilham no campo de duelo.',
  onepiece: 'Zarpe com a tripulação: boosters, starters e alt arts.',
  lorcana: 'Tinta mágica em forma de carta: boosters, gift sets e starters.',
  acessorios: 'Proteja e exiba sua coleção: sleeves, playmats, deck boxes e fichários.',
};

/* ---------- estado <-> URL ---------- */
function readState() {
  const u = new URLSearchParams(location.search);
  const list = (k) => (u.get(k) || '').split(',').filter(Boolean);
  return {
    jogo: list('jogo').filter((j) => JOGOS[j]),
    tipo: list('tipo').filter((t) => TIPOS[t]),
    q: u.get('q') || '',
    min: u.get('min') || '',
    max: u.get('max') || '',
    sort: SORTS[u.get('sort')] ? u.get('sort') : 'relevancia',
    emEstoque: u.get('estoque') === '1',
  };
}
let state = readState();

function writeURL() {
  const u = new URLSearchParams();
  if (state.jogo.length) u.set('jogo', state.jogo.join(','));
  if (state.tipo.length) u.set('tipo', state.tipo.join(','));
  if (state.q) u.set('q', state.q);
  if (state.min !== '') u.set('min', state.min);
  if (state.max !== '') u.set('max', state.max);
  if (state.sort !== 'relevancia') u.set('sort', state.sort);
  if (state.emEstoque) u.set('estoque', '1');
  const qs = u.toString();
  history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
}

/* ---------- UI de filtros ---------- */
function chip(value, label, pressed, attr) {
  return `<button class="chip${pressed ? ' is-active' : ''}" type="button" aria-pressed="${pressed}" ${attr}="${esc(value)}">${esc(label)}</button>`;
}

function syncControls() {
  el.jogo.innerHTML = Object.entries(JOGOS).map(([k, v]) => chip(k, v, state.jogo.includes(k), 'data-jogo')).join('');
  el.tipo.innerHTML = Object.entries(TIPOS).map(([k, v]) => chip(k, v, state.tipo.includes(k), 'data-tipo')).join('');
  $$('.chip', el.faixa).forEach((c) => {
    const on = c.dataset.min === state.min && c.dataset.max === state.max && (state.min !== '' || state.max !== '');
    c.setAttribute('aria-pressed', on);
    c.classList.toggle('is-active', on);
  });
  el.min.value = state.min;
  el.max.value = state.max;
  if (document.activeElement !== el.q) el.q.value = state.q;
  el.sort.value = state.sort;
  el.stock.checked = state.emEstoque;

  // título / breadcrumb conforme jogo único
  const one = state.jogo.length === 1 ? state.jogo[0] : null;
  const name = one ? JOGOS[one] : 'Loja';
  el.title.textContent = name;
  el.crumb.textContent = name;
  el.sub.textContent = one ? SUBS[one] : 'Tudo para o seu próximo duelo — e para a sua coleção.';
  document.title = `${name} — JJ's TCG`;

  // filtros ativos (removíveis)
  const act = [];
  state.jogo.forEach((j) => act.push(`<button class="chip is-active" type="button" data-remove="jogo:${j}">${esc(JOGOS[j])}</button>`));
  state.tipo.forEach((t) => act.push(`<button class="chip is-active" type="button" data-remove="tipo:${t}">${esc(TIPOS[t])}</button>`));
  if (state.min !== '' || state.max !== '') {
    const lbl = state.min !== '' && state.max !== '' ? `${formatBRL(state.min)} – ${formatBRL(state.max)}`
      : state.min !== '' ? `A partir de ${formatBRL(state.min)}` : `Até ${formatBRL(state.max)}`;
    act.push(`<button class="chip is-active" type="button" data-remove="preco">${lbl}</button>`);
  }
  if (state.q) act.push(`<button class="chip is-active" type="button" data-remove="q">“${esc(state.q)}”</button>`);
  if (state.emEstoque) act.push(`<button class="chip is-active" type="button" data-remove="estoque">Em estoque</button>`);
  el.active.innerHTML = act.join('');
}

el.sort.innerHTML = Object.entries(SORTS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');

/* ---------- render ---------- */
let renderId = 0;
let firstRender = true;

async function render() {
  const id = ++renderId;
  syncControls();
  writeURL();
  let list;
  try {
    list = await getProducts({
      jogo: state.jogo, tipo: state.tipo, q: state.q,
      min: state.min, max: state.max, sort: state.sort, emEstoque: state.emEstoque,
    });
  } catch (err) {
    console.warn(err);
    el.count.textContent = 'Não foi possível carregar os produtos.';
    el.grid.innerHTML = `<div class="empty-state catalog__empty"><p>Ops! Falha ao carregar o catálogo.</p><button class="btn btn--primary" type="button" onclick="location.reload()">Tentar de novo</button></div>`;
    return;
  }
  if (id !== renderId) return;

  const animate = !reduceMotion.matches && !firstRender;
  if (animate && el.grid.children.length) {
    // limite de tempo: não trava se a aba estiver oculta e as animações não avançarem
    await Promise.race([
      Promise.all(
        [...el.grid.children].slice(0, 24).map((c) =>
          c.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.96) translateY(8px)' }],
            { duration: 140, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {}))
      ),
      new Promise((r) => setTimeout(r, 200)),
    ]);
    if (id !== renderId) return;
  }

  el.count.textContent = list.length === 1 ? '1 produto encontrado' : `${list.length} produtos encontrados`;
  el.grid.innerHTML = list.length
    ? list.map(productCardHTML).join('')
    : `<div class="empty-state catalog__empty">
        <p class="h3">Nenhum produto encontrado ✦</p>
        <p class="muted">Tente outros termos ou remova alguns filtros.</p>
        <button class="btn btn--primary" type="button" data-filters-clear>Limpar filtros</button>
      </div>`;

  if (!reduceMotion.matches) {
    [...el.grid.children].forEach((c, i) => {
      c.animate(
        [{ opacity: 0, transform: 'translateY(24px) scale(.97)' }, { opacity: 1, transform: 'none' }],
        { duration: 420, delay: Math.min(i, 12) * 45, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' }
      );
    });
  }
  firstRender = false;
}

/* ---------- eventos ---------- */
function toggleIn(arr, v) {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.jogo) { state.jogo = toggleIn(state.jogo, t.dataset.jogo); render(); }
  else if (t.dataset.tipo) { state.tipo = toggleIn(state.tipo, t.dataset.tipo); render(); }
  else if (t.closest('[data-filter-faixa]')) {
    const same = state.min === t.dataset.min && state.max === t.dataset.max;
    state.min = same ? '' : t.dataset.min;
    state.max = same ? '' : t.dataset.max;
    render();
  } else if (t.dataset.remove) {
    const [k, v] = t.dataset.remove.split(':');
    if (k === 'jogo' || k === 'tipo') state[k] = state[k].filter((x) => x !== v);
    if (k === 'preco') state.min = state.max = '';
    if (k === 'q') state.q = '';
    if (k === 'estoque') state.emEstoque = false;
    render();
  } else if (t.hasAttribute('data-filters-clear')) {
    state = { jogo: [], tipo: [], q: '', min: '', max: '', sort: state.sort, emEstoque: false };
    render();
  } else if (t.hasAttribute('data-filters-open')) openFilters(true);
  else if (t.hasAttribute('data-filters-close')) openFilters(false);
});

let qTimer;
el.q.addEventListener('input', () => {
  clearTimeout(qTimer);
  qTimer = setTimeout(() => { state.q = el.q.value.trim(); render(); }, 220);
});
el.sort.addEventListener('change', () => { state.sort = el.sort.value; render(); });
el.stock.addEventListener('change', () => { state.emEstoque = el.stock.checked; render(); });
[el.min, el.max].forEach((inp) =>
  inp.addEventListener('change', () => {
    const n = (v) => (v === '' || isNaN(+v) || +v < 0 ? '' : String(Math.round(+v)));
    state.min = n(el.min.value);
    state.max = n(el.max.value);
    if (state.min !== '' && state.max !== '' && +state.min > +state.max) [state.min, state.max] = [state.max, state.min];
    render();
  })
);

// links internos para ?jogo= (ex.: menu do header) sem recarregar a página
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
  const url = new URL(a.href, location.href);
  if (url.origin === location.origin && url.pathname === location.pathname) {
    e.preventDefault();
    history.pushState(null, '', url.pathname + url.search);
    state = readState();
    openFilters(false);
    render();
    window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  }
}, true);
window.addEventListener('popstate', () => { state = readState(); render(); });

/* ---------- drawer de filtros (mobile) ---------- */
let backdrop;
function openFilters(open) {
  el.panel.classList.toggle('is-open', open);
  el.open?.setAttribute('aria-expanded', open);
  if (open) {
    backdrop = document.createElement('div');
    backdrop.className = 'filters-backdrop';
    backdrop.addEventListener('click', () => openFilters(false));
    document.body.appendChild(backdrop);
    el.panel.querySelector('button, input')?.focus();
  } else if (backdrop) {
    backdrop.remove();
    backdrop = null;
  }
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && el.panel.classList.contains('is-open')) openFilters(false); });

loadProducts().catch(() => {});
render();
