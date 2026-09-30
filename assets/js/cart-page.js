// cart-page.js — página pages/carrinho.html (Loja / Kitsune)
import { setQty, removeFromCart, cartSummary, applyCoupon, getCoupon, FREE_SHIPPING_MIN, SHIPPING_OPTIONS } from './cart.js';
import { getProducts, productCardHTML, formatBRL, productUrl, escapeHTML as esc, siteUrl } from './store.js';

const root = document.querySelector('[data-cart-page]');
const sub = document.querySelector('[data-cart-sub]');
let couponMsg = '';
let couponOk = true;

function render() {
  const s = cartSummary();
  sub.textContent = s.count ? `${s.count} ${s.count === 1 ? 'item' : 'itens'} no carrinho` : '';

  if (!s.items.length) {
    root.innerHTML = `<div class="empty-state panel" style="text-align:center;padding:3rem 1rem;display:grid;gap:1rem;justify-items:center">
      <p class="h2">Seu carrinho está vazio ✦</p>
      <p class="muted">Bora encher de boosters? Confira os destaques da semana.</p>
      <a class="btn btn--primary btn--lg" href="${siteUrl(`pages/catalogo.html`)}">Explorar a loja</a>
    </div>
    <section class="section" aria-labelledby="sug-title">
      <div class="section-head"><span class="section-kicker">Sugestões</span><h2 class="section-title" id="sug-title">Em destaque</h2></div>
      <div class="product-grid" data-suggest></div>
    </section>`;
    getProducts({ featured: true, emEstoque: true, limit: 4 }).then((l) => {
      const g = root.querySelector('[data-suggest]');
      if (g) g.innerHTML = l.map(productCardHTML).join('');
    }).catch(() => {});
    return;
  }

  const base = s.subtotal - s.discount;
  const pct = Math.min(100, (base / FREE_SHIPPING_MIN) * 100);
  const coupon = getCoupon();

  root.innerHTML = `<div class="cart-layout">
    <div>
      <ul class="cart-list">
        ${s.items.map((i) => `
        <li class="cart-item panel" data-item="${esc(i.id)}">
          <a class="cart-item__img" href="${productUrl(i)}"><img src="${esc(siteUrl(i.imagem))}" alt="" width="88" height="123"></a>
          <div class="cart-item__info">
            <a class="cart-item__name" href="${productUrl(i)}">${esc(i.nome)}</a>
            <p class="cart-item__meta">${formatBRL(i.preco)} cada</p>
          </div>
          <div class="qty">
            <button class="qty__btn" type="button" data-qty-dec aria-label="Diminuir quantidade de ${esc(i.nome)}">−</button>
            <input class="qty__input" type="number" min="1" value="${i.qty}" inputmode="numeric" aria-label="Quantidade de ${esc(i.nome)}">
            <button class="qty__btn" type="button" data-qty-inc aria-label="Aumentar quantidade de ${esc(i.nome)}">+</button>
          </div>
          <strong class="cart-item__total">${formatBRL(i.preco * i.qty)}</strong>
          <button class="btn btn--ghost btn--icon btn--sm cart-item__remove" type="button" data-remove aria-label="Remover ${esc(i.nome)}">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>
          </button>
        </li>`).join('')}
      </ul>
      <div class="cart-actions">
        <a class="btn btn--ghost" href="${siteUrl(`pages/catalogo.html`)}">← Continuar comprando</a>
      </div>
    </div>

    <aside class="summary panel" aria-label="Resumo do pedido">
      <h2>Resumo</h2>
      <div class="ship-progress">
        <span>${s.freeShipping ? '🚚 <strong>Parabéns!</strong> Você ganhou frete grátis.' : `Faltam <strong>${formatBRL(s.missingForFree)}</strong> para frete grátis`}</span>
        <div class="ship-progress__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}" aria-label="Progresso para frete grátis"><div class="ship-progress__fill" style="width:${pct}%"></div></div>
      </div>

      <form class="coupon" data-coupon-form novalidate>
        <label class="sr-only" for="coupon">Cupom de desconto</label>
        <input class="input" id="coupon" name="coupon" placeholder="Cupom (ex.: JJ10)" value="${coupon ? coupon.code : ''}" autocomplete="off" ${coupon ? 'readonly' : ''}>
        ${coupon
          ? '<button class="btn btn--outline" type="button" data-coupon-remove>Remover</button>'
          : '<button class="btn btn--outline" type="submit">Aplicar</button>'}
      </form>
      <p class="coupon-msg ${couponMsg ? (couponOk ? 'is-ok' : 'is-err') : ''}" aria-live="polite">${esc(couponMsg)}</p>

      <dl class="summary__rows">
        <div class="summary__row"><dt>Subtotal</dt><dd>${formatBRL(s.subtotal)}</dd></div>
        ${s.discount ? `<div class="summary__row summary__row--discount"><dt>Cupom ${esc(s.coupon.code)}</dt><dd>− ${formatBRL(s.discount)}</dd></div>` : ''}
        <div class="summary__row"><dt>Frete</dt><dd>${s.freeShipping ? 'Grátis' : `a partir de ${formatBRL(SHIPPING_OPTIONS.pac.preco)}`}</dd></div>
        <div class="summary__row summary__row--total"><dt>Total</dt><dd>${formatBRL(s.freeShipping ? base : base + SHIPPING_OPTIONS.pac.preco)}</dd></div>
      </dl>
      <p class="muted" style="font-size:var(--fs-xs);margin:0">Frete calculado no checkout pelo CEP.</p>
      <a class="btn btn--primary btn--lg btn--block" href="${siteUrl(`pages/checkout.html`)}">Finalizar compra</a>
    </aside>
  </div>`;
}

root.addEventListener('click', (e) => {
  const li = e.target.closest('[data-item]');
  if (li) {
    const id = li.dataset.item;
    const input = li.querySelector('.qty__input');
    if (e.target.closest('[data-qty-inc]')) setQty(id, +input.value + 1);
    else if (e.target.closest('[data-qty-dec]')) {
      if (+input.value <= 1) removeWithAnim(li, id);
      else setQty(id, +input.value - 1);
    } else if (e.target.closest('[data-remove]')) removeWithAnim(li, id);
  }
  if (e.target.closest('[data-coupon-remove]')) {
    applyCoupon(null);
    couponMsg = 'Cupom removido.';
    couponOk = true;
    render();
  }
});

root.addEventListener('change', (e) => {
  const li = e.target.closest('[data-item]');
  if (!li || !e.target.matches('.qty__input')) return;
  const input = e.target;
  const current = cartSummary().items.find((i) => i.id === li.dataset.item)?.qty || 1;
  const v = Number(input.value);
  // vazio/inválido/<1 volta para a qtd anterior — remoção só pelo botão Remover ou −
  if (input.value.trim() === '' || !Number.isInteger(v) || v < 1) {
    input.value = current;
    return;
  }
  if (v !== current) setQty(li.dataset.item, v);
});

root.addEventListener('submit', (e) => {
  if (!e.target.matches('[data-coupon-form]')) return;
  e.preventDefault();
  const code = e.target.coupon.value;
  if (!code.trim()) { couponMsg = 'Digite um cupom.'; couponOk = false; return render(); }
  const c = applyCoupon(code);
  couponMsg = c ? `Cupom ${c.code} aplicado: ${c.label}! ✦` : 'Cupom inválido ou expirado.';
  couponOk = !!c;
  render();
});

function removeWithAnim(li, id) {
  li.classList.add('is-removing');
  const done = () => removeFromCart(id);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return done();
  setTimeout(done, 260);
}

// mantém foco no input de qtd após re-render
window.addEventListener('cart:updated', () => {
  const active = document.activeElement;
  const li = active?.closest?.('[data-item]');
  const sel = li && (active.matches('[data-qty-inc]') ? '[data-qty-inc]' : active.matches('[data-qty-dec]') ? '[data-qty-dec]' : null);
  const id = li?.dataset.item;
  render();
  if (id && sel) root.querySelector(`[data-item="${CSS.escape(id)}"] ${sel}`)?.focus();
});

render();
