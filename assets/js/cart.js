// cart.js — carrinho (Loja / Kitsune)
// Estado em localStorage 'jjtcg_cart' => [{ id, qty, preco, nome, imagem }]
// preco/nome/imagem são snapshots atualizados a partir de products.json na carga.
// Dispara window 'cart:updated' com detail { items, count, subtotal }.
import { getProduct, loadProducts, formatBRL, escapeHTML as esc, productUrl, siteUrl } from './store.js';

const KEY = 'jjtcg_cart';
const COUPON_KEY = 'jjtcg_coupon';

export const COUPONS = { JJ10: { code: 'JJ10', pct: 10, label: '10% de desconto' } };
export const FREE_SHIPPING_MIN = 300;
export const SHIPPING_OPTIONS = {
  pac: { id: 'pac', nome: 'Econômico', prazo: '5 a 9 dias úteis', preco: 24.9, freeEligible: true },
  expresso: { id: 'expresso', nome: 'Expresso', prazo: '2 a 4 dias úteis', preco: 39.9, freeEligible: false },
};

let ui = null;
const uiReady = import('./ui.js').then((m) => (ui = m)).catch(() => null);

/* ---------- storage ---------- */
function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.filter((i) => i && i.id && i.qty > 0) : [];
  } catch {
    return [];
  }
}
function write(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch { /* storage indisponível */ }
  emit(items);
}
function emit(items = read()) {
  const detail = { items, count: countOf(items), subtotal: subtotalOf(items) };
  updateBadges(detail.count);
  window.dispatchEvent(new CustomEvent('cart:updated', { detail }));
}
const countOf = (items) => items.reduce((s, i) => s + i.qty, 0);
const subtotalOf = (items) => round(items.reduce((s, i) => s + (i.preco || 0) * i.qty, 0));
const round = (n) => Math.round(n * 100) / 100;

function updateBadges(count) {
  document.querySelectorAll('[data-cart-count]').forEach((el) => {
    el.textContent = count;
    el.hidden = count === 0 && el.hasAttribute('data-hide-empty');
  });
}

/* ---------- API pública (contrato) ---------- */
export function getCart() {
  return read();
}
export function cartCount() {
  return countOf(read());
}
/** Subtotal (sem cupom/frete) */
export function cartTotal() {
  return subtotalOf(read());
}

/** Adiciona qty do produto (limitado ao estoque). Resolve com { ok, qty, reason? } */
export async function addToCart(id, qty = 1) {
  const p = await getProduct(id);
  if (!p) return { ok: false, reason: 'not-found' };
  if (p.estoque <= 0) return { ok: false, reason: 'sold-out' };
  qty = Math.max(1, qty | 0);
  const items = read();
  const it = items.find((i) => i.id === p.id);
  const current = it ? it.qty : 0;
  const next = Math.min(current + qty, p.estoque);
  if (next === current) return { ok: false, reason: 'max-stock', qty: current };
  if (it) Object.assign(it, snap(p), { qty: next });
  else items.push({ ...snap(p), qty: next });
  write(items);
  return { ok: true, qty: next, limited: next < current + qty };
}

export function removeFromCart(id) {
  write(read().filter((i) => i.id !== id));
}

/** Define quantidade (0 remove). Limita ao estoque conhecido. */
export async function setQty(id, qty) {
  qty = Math.max(0, parseInt(qty, 10) || 0);
  if (qty === 0) return removeFromCart(id);
  const p = await getProduct(id);
  const items = read();
  const it = items.find((i) => i.id === id);
  if (!it) return;
  it.qty = p ? Math.min(qty, Math.max(p.estoque, 1)) : qty;
  write(items);
}

export function clearCart() {
  write([]);
  setCoupon(null);
}

const snap = (p) => ({ id: p.id, preco: p.preco, nome: p.nome, imagem: p.imagem });

/* ---------- cupom / frete / resumo ---------- */
export function getCoupon() {
  try {
    const c = localStorage.getItem(COUPON_KEY);
    return c && COUPONS[c] ? COUPONS[c] : null;
  } catch {
    return null;
  }
}
/** Aplica cupom; retorna o cupom ou null se inválido. null/'' remove. */
export function applyCoupon(code) {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return setCoupon(null), null;
  if (!COUPONS[c]) return null;
  setCoupon(c);
  return COUPONS[c];
}
function setCoupon(code) {
  try {
    code ? localStorage.setItem(COUPON_KEY, code) : localStorage.removeItem(COUPON_KEY);
  } catch { /* ignore */ }
  emit();
}

export function shippingCost(optionId = 'pac', subtotalAfterDiscount = 0) {
  const opt = SHIPPING_OPTIONS[optionId] || SHIPPING_OPTIONS.pac;
  if (opt.freeEligible && subtotalAfterDiscount > FREE_SHIPPING_MIN) return 0;
  return opt.preco;
}

/** Resumo completo { items, count, subtotal, coupon, discount, shipping, total } */
export function cartSummary({ shipping = null } = {}) {
  const items = read();
  const subtotal = subtotalOf(items);
  const coupon = getCoupon();
  const discount = coupon ? round((subtotal * coupon.pct) / 100) : 0;
  const base = round(subtotal - discount);
  const ship = shipping == null || !items.length ? null : shippingCost(shipping, base);
  return {
    items,
    count: countOf(items),
    subtotal,
    coupon,
    discount,
    shipping: ship,
    freeShipping: base > FREE_SHIPPING_MIN,
    missingForFree: Math.max(0, round(FREE_SHIPPING_MIN - base + 0.01)),
    total: round(base + (ship || 0)),
  };
}

/* ---------- hidrata snapshots com o products.json atual ---------- */
async function hydrate() {
  try {
    const all = await loadProducts();
    const items = read();
    if (!items.length) return;
    let changed = false;
    const next = items
      .map((i) => {
        const p = all.find((x) => x.id === i.id);
        if (!p) return (changed = true), null;
        const qty = Math.min(i.qty, Math.max(p.estoque, 0));
        if (i.preco !== p.preco || i.nome !== p.nome || i.imagem !== p.imagem || qty !== i.qty) changed = true;
        return qty > 0 ? { ...snap(p), qty } : ((changed = true), null);
      })
      .filter(Boolean);
    if (changed) write(next);
  } catch { /* offline: mantém snapshot */ }
}

/* ---------- toast (usa ui.js; fallback simples) ---------- */
export function notify(message, type = 'success') {
  if (ui && typeof ui.toast === 'function') return ui.toast(message, { type });
  let box = document.querySelector('.shop-toasts');
  if (!box) {
    box = document.createElement('div');
    box.className = 'shop-toasts';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    document.body.appendChild(box);
  }
  const t = document.createElement('div');
  t.className = `shop-toast shop-toast--${type}`;
  t.textContent = message;
  box.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

export async function fly(img) {
  await uiReady;
  if (img && ui && typeof ui.flyToCart === 'function') {
    try { await ui.flyToCart(img); } catch { /* ignore */ }
  }
}

/* ---------- delegação global: [data-add-to-cart] ---------- */
// Opcional: data-qty-from="#seletor" (input de quantidade) e data-fly-from="#seletor" (imagem).
if (!window.__jjCartBound) {
  window.__jjCartBound = true;
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-add-to-cart]');
    if (!btn || btn.disabled) return;
    e.preventDefault();
    const id = btn.getAttribute('data-add-to-cart');
    const qtyEl = btn.dataset.qtyFrom && document.querySelector(btn.dataset.qtyFrom);
    const qty = qtyEl ? parseInt(qtyEl.value, 10) || 1 : 1;
    const img =
      (btn.dataset.flyFrom && document.querySelector(btn.dataset.flyFrom)) ||
      btn.closest('.product-card')?.querySelector('.product-card__img') ||
      null;
    btn.classList.add('is-loading');
    const res = await addToCart(id, qty);
    btn.classList.remove('is-loading');
    if (res.ok) {
      fly(img);
      notify(res.limited ? 'Adicionado — limite de estoque atingido.' : 'Adicionado ao carrinho!', 'success');
    } else if (res.reason === 'max-stock') {
      notify('Você já tem todo o estoque disponível no carrinho.', 'info');
    } else if (res.reason === 'sold-out') {
      notify('Produto esgotado.', 'error');
    } else {
      notify('Não foi possível adicionar este produto.', 'error');
    }
  });

  // mini-cart (drawer do ui.js)
  window.addEventListener('cart:drawer-open', renderDrawer);
  window.addEventListener('cart:updated', () => {
    if (document.querySelector('[data-cart-drawer-body]')?.offsetParent !== null) renderDrawer();
  });
  document.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-drawer-remove]');
    if (rm) {
      e.preventDefault();
      removeFromCart(rm.getAttribute('data-drawer-remove'));
    }
  });

  // outras abas
  window.addEventListener('storage', (e) => {
    if (e.key === KEY || e.key === COUPON_KEY) emit();
  });

  const initBadge = () => updateBadges(cartCount());
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initBadge);
  else initBadge();
  // o header é injetado pelo ui.js — atualiza de novo quando ele terminar
  uiReady.then(() => requestAnimationFrame(initBadge));
  window.addEventListener('load', initBadge);
  hydrate();
}

export function renderDrawer() {
  const body = document.querySelector('[data-cart-drawer-body]');
  const foot = document.querySelector('[data-cart-drawer-footer]');
  if (!body) return;
  const s = cartSummary();
  if (!s.items.length) {
    body.innerHTML = `<div class="empty-state mini-cart__empty"><p>Seu carrinho está vazio.</p>
      <a class="btn btn--primary btn--sm" href="${siteUrl(`pages/catalogo.html`)}">Ver a loja</a></div>`;
    if (foot) foot.innerHTML = '';
    return;
  }
  body.innerHTML = `<ul class="mini-cart">${s.items
    .map(
      (i) => `<li class="mini-cart__item">
      <a href="${productUrl(i)}" class="mini-cart__thumb"><img src="${esc(siteUrl(i.imagem))}" alt="" width="56" height="78"></a>
      <div class="mini-cart__info">
        <a href="${productUrl(i)}" class="mini-cart__name">${esc(i.nome)}</a>
        <span class="muted">${i.qty} × ${formatBRL(i.preco)}</span>
      </div>
      <button class="btn btn--ghost btn--icon btn--sm" type="button" data-drawer-remove="${esc(i.id)}" aria-label="Remover ${esc(i.nome)}">×</button>
    </li>`
    )
    .join('')}</ul>`;
  if (foot)
    foot.innerHTML = `<div class="mini-cart__total"><span>Subtotal</span><strong>${formatBRL(s.subtotal - s.discount)}</strong></div>
    ${s.freeShipping ? '<p class="mini-cart__ship">🚚 Frete grátis garantido!</p>' : `<p class="mini-cart__ship muted">Faltam ${formatBRL(s.missingForFree)} para frete grátis</p>`}
    <a class="btn btn--outline btn--block" href="${siteUrl(`pages/carrinho.html`)}">Ver carrinho</a>
    <a class="btn btn--primary btn--block" href="${siteUrl(`pages/checkout.html`)}">Finalizar compra</a>`;
}
