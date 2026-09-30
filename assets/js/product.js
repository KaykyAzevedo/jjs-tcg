// product.js — página pages/produto.html?id= (ou ?slug=) (Loja / Kitsune)
import { getProduct, getProducts, productCardHTML, formatBRL, discountPct, JOGOS, TIPOS, escapeHTML as esc, siteUrl } from './store.js';
import { getCart, addToCart } from './cart.js';

const $ = (s, r = document) => r.querySelector(s);
const root = $('[data-pdp]');
const params = new URLSearchParams(location.search);
const key = params.get('id') || params.get('slug');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

const MAX_INSTALLMENTS = 10;

function stockInfo(p) {
  if (p.estoque <= 0) return { cls: 'out', txt: 'Esgotado — avise-me quando chegar' };
  if (p.estoque <= 3) return { cls: 'low', txt: p.estoque === 1 ? 'Última unidade!' : `Últimas ${p.estoque} unidades!` };
  return { cls: 'ok', txt: `Em estoque (${p.estoque} disponíveis)` };
}

function inCart(p) {
  return getCart().find((i) => i.id === p.id)?.qty || 0;
}

function renderNotFound() {
  root.innerHTML = `<div class="empty-state" style="padding:4rem 1rem;text-align:center">
    <p class="h2">Produto não encontrado ✦</p>
    <p class="muted">Ele pode ter saído do catálogo. Que tal dar uma olhada na loja?</p>
    <a class="btn btn--primary" href="${siteUrl(`pages/catalogo.html`)}">Ir para a loja</a></div>`;
  document.title = "Produto não encontrado — JJ's TCG";
}

function render(p) {
  const imgs = (p.galeria?.length ? p.galeria : [p.imagem]).map(siteUrl);
  const off = discountPct(p);
  const st = stockInfo(p);
  const soldOut = p.estoque <= 0;
  const inst = p.preco / MAX_INSTALLMENTS;
  const max = Math.max(1, p.estoque - inCart(p));

  document.title = `${p.nome} — JJ's TCG`;
  $('meta[name="description"]')?.setAttribute('content', p.descricao);
  $('[data-pdp-crumb]').insertAdjacentHTML('beforeend',
    `<span>/</span><a href="${siteUrl(`pages/catalogo.html?jogo=${p.jogo}`)}">${esc(JOGOS[p.jogo])}</a><span>/</span><span aria-current="page">${esc(p.nome)}</span>`);

  root.innerHTML = `
  <article class="pdp" data-game="${p.jogo}" style="--game-color: var(--game-${p.jogo})">
    <div class="gallery">
      <div class="gallery__main" data-tilt>
        <img src="${esc(siteUrl(imgs[0]))}" alt="${esc(p.nome)}" width="600" height="840" id="pdp-img" data-gallery-main>
      </div>
      ${imgs.length > 1 ? `<div class="gallery__thumbs" role="group" aria-label="Imagens do produto">
        ${imgs.map((src, i) => `<button class="gallery__thumb" type="button" data-thumb="${i}" aria-label="Imagem ${i + 1} de ${imgs.length}" aria-current="${i === 0}"><img src="${esc(siteUrl(src))}" alt="" width="72" height="101" loading="lazy"></button>`).join('')}
      </div>` : ''}
    </div>

    <div class="pdp__info">
      <div class="pdp__tags">
        <span class="pdp__game">${esc(JOGOS[p.jogo])}</span>
        <span class="muted">•</span>
        <span class="muted">${esc(TIPOS[p.tipo])}</span>
        ${p.lancamento ? '<span class="badge badge--new">Lançamento</span>' : ''}
        ${p.raridade ? `<span class="badge badge--rare">${esc(p.raridade)}</span>` : ''}
        ${off ? `<span class="badge badge--sale">-${off}%</span>` : ''}
      </div>
      <h1 class="pdp__title display">${esc(p.nome)}</h1>

      <div>
        <div class="pdp__prices">
          <strong class="price-lg">${formatBRL(p.preco)}</strong>
          ${p.precoAntigo ? `<s class="pdp__old">${formatBRL(p.precoAntigo)}</s>` : ''}
        </div>
        <p class="pdp__installments">ou ${MAX_INSTALLMENTS}x de ${formatBRL(inst)} sem juros · 5% off no Pix: <strong>${formatBRL(p.preco * 0.95)}</strong></p>
      </div>

      <span class="pdp__stock pdp__stock--${st.cls}" data-stock>${st.txt}</span>

      <div class="pdp__buy">
        <div class="qty" data-qty>
          <button class="qty__btn" type="button" data-qty-dec aria-label="Diminuir quantidade" ${soldOut ? 'disabled' : ''}>−</button>
          <input class="qty__input" type="number" id="pdp-qty" value="1" min="1" max="${max}" inputmode="numeric" aria-label="Quantidade" ${soldOut ? 'disabled' : ''}>
          <button class="qty__btn" type="button" data-qty-inc aria-label="Aumentar quantidade" ${soldOut ? 'disabled' : ''}>+</button>
        </div>
        <button class="btn btn--primary btn--lg" type="button" data-add-to-cart="${p.id}" data-qty-from="#pdp-qty" data-fly-from="#pdp-img" ${soldOut ? 'disabled' : ''}>${soldOut ? 'Esgotado' : 'Adicionar ao carrinho'}</button>
        <button class="btn btn--outline btn--lg" type="button" data-buy-now ${soldOut ? 'disabled' : ''}>Comprar agora</button>
      </div>

      <ul class="pdp__perks">
        <li>🚚 Frete grátis em compras acima de R$ 300</li>
        <li>🛡️ Produto original e lacrado · cartas avulsas conferidas</li>
        <li>⭐ Use o cupom <strong>JJ10</strong> e ganhe 10% de desconto</li>
      </ul>

      <div class="divider"></div>
      <h2 class="h3">Descrição</h2>
      <p class="pdp__desc">${esc(p.descricao)}</p>

      <table class="specs">
        <tbody>
          <tr><th scope="row">Jogo</th><td>${esc(JOGOS[p.jogo])}</td></tr>
          <tr><th scope="row">Categoria</th><td>${esc(TIPOS[p.tipo])}</td></tr>
          ${p.raridade ? `<tr><th scope="row">Raridade</th><td>${esc(p.raridade)}</td></tr>` : ''}
          <tr><th scope="row">Idioma</th><td>Português</td></tr>
          <tr><th scope="row">SKU</th><td>${esc(p.id.toUpperCase())}</td></tr>
        </tbody>
      </table>
    </div>
  </article>`;

  bindGallery(imgs);
  bindQty(p);
}

function bindGallery(imgs) {
  const main = $('[data-gallery-main]');
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-thumb]');
    if (!t) return;
    const i = +t.dataset.thumb;
    root.querySelectorAll('[data-thumb]').forEach((b) => b.setAttribute('aria-current', b === t));
    if (main.getAttribute('src') === imgs[i]) return;
    // troca na hora (não depende da animação terminar); só anima a entrada
    main.setAttribute('src', imgs[i]);
    if (reduceMotion.matches) return;
    main.getAnimations().forEach((a) => a.cancel());
    main.animate([{ opacity: 0, transform: 'scale(1.03)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.22,1,.36,1)' });
  });
  // setas do teclado entre miniaturas
  root.addEventListener('keydown', (e) => {
    const t = e.target.closest('[data-thumb]');
    if (!t || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const n = imgs.length;
    const next = (+t.dataset.thumb + (e.key === 'ArrowRight' ? 1 : n - 1)) % n;
    const b = root.querySelector(`[data-thumb="${next}"]`);
    b.focus();
    b.click();
  });
}

function bindQty(p) {
  const input = $('#pdp-qty');
  if (!input) return;
  const clamp = () => {
    const max = Math.max(1, p.estoque - inCart(p));
    input.max = max;
    let v = parseInt(input.value, 10);
    if (isNaN(v) || v < 1) v = 1;
    if (v > max) v = max;
    input.value = v;
  };
  root.querySelector('[data-qty-dec]').addEventListener('click', () => { input.value = +input.value - 1; clamp(); });
  root.querySelector('[data-qty-inc]').addEventListener('click', () => { input.value = +input.value + 1; clamp(); });
  input.addEventListener('change', clamp);
  const refresh = () => {
    clamp();
    const left = p.estoque - inCart(p);
    const btn = root.querySelector('[data-add-to-cart]');
    if (left <= 0 && p.estoque > 0) {
      btn.disabled = true;
      btn.textContent = 'Estoque todo no carrinho';
    }
  };
  window.addEventListener('cart:updated', refresh);
  refresh();

  root.querySelector('[data-buy-now]')?.addEventListener('click', async (e) => {
    const b = e.currentTarget;
    b.classList.add('is-loading');
    const res = await addToCart(p.id, parseInt(input.value, 10) || 1);
    if (res.ok || res.reason === 'max-stock') location.href = siteUrl('pages/checkout.html');
    else b.classList.remove('is-loading');
  });
}

async function renderRelated(p) {
  const same = await getProducts({ jogo: p.jogo, exclude: p.id, emEstoque: true });
  let list = same.slice(0, 4);
  if (list.length < 4) {
    const extra = await getProducts({ tipo: p.tipo, exclude: p.id, emEstoque: true, sort: 'relevancia' });
    for (const x of extra) if (list.length < 4 && !list.some((y) => y.id === x.id)) list.push(x);
  }
  if (list.length < 4) {
    const extra = await getProducts({ featured: true, exclude: p.id });
    for (const x of extra) if (list.length < 4 && !list.some((y) => y.id === x.id)) list.push(x);
  }
  if (!list.length) return;
  const sec = $('[data-related]');
  $('[data-related-grid]').innerHTML = list.map(productCardHTML).join('');
  $('[data-related-more]').href = siteUrl(`pages/catalogo.html?jogo=${p.jogo}`);
  sec.hidden = false;
}

(async () => {
  try {
    const p = await getProduct(key);
    if (!p) return renderNotFound();
    render(p);
    renderRelated(p);
  } catch (err) {
    console.warn(err);
    root.innerHTML = `<div class="empty-state" style="padding:4rem 1rem;text-align:center"><p>Falha ao carregar o produto.</p><button class="btn btn--primary" type="button" onclick="location.reload()">Tentar de novo</button></div>`;
  }
})();
