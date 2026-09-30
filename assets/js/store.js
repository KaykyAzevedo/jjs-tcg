// store.js — catálogo de produtos (Loja / Kitsune)
// Fonte de dados: data/products.json. Ponto de extensão: troque loadProducts()
// por uma chamada à API real quando existir backend.

export const JOGOS = {
  pokemon: 'Pokémon',
  magic: 'Magic',
  yugioh: 'Yu-Gi-Oh!',
  onepiece: 'One Piece',
  lorcana: 'Lorcana',
  acessorios: 'Acessórios',
};

export const TIPOS = {
  'booster-box': 'Booster Box',
  booster: 'Booster',
  etb: 'Elite Trainer Box',
  'carta-avulsa': 'Carta avulsa',
  deck: 'Deck',
  acessorio: 'Acessório',
};

export const SORTS = {
  relevancia: 'Relevância',
  lancamentos: 'Lançamentos',
  'menor-preco': 'Menor preço',
  'maior-preco': 'Maior preço',
  nome: 'Nome (A–Z)',
};

// Raiz do site resolvida a partir deste módulo (assets/js/ -> ../../), para funcionar
// em localhost:5500 e em subpasta (GitHub Pages: /jjs-tcg/). p é relativo à raiz do site.
export const SITE_ROOT = new URL('../../', import.meta.url);
export const siteUrl = (p = '') => new URL(String(p).replace(/^\/+/, ''), SITE_ROOT).href;

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Formata número em reais: 1234.5 -> "R$ 1.234,50" */
export function formatBRL(n) {
  return brl.format(Number(n) || 0).replace(/ /g, ' ');
}

/** Percentual de desconto (inteiro) ou 0 */
export function discountPct(p) {
  if (!p || !p.precoAntigo || p.precoAntigo <= p.preco) return 0;
  return Math.round((1 - p.preco / p.precoAntigo) * 100);
}

let cache = null;

export function loadProducts() {
  if (!cache) {
    cache = fetch(siteUrl('data/products.json'))
      .then((r) => {
        if (!r.ok) throw new Error('Falha ao carregar produtos: ' + r.status);
        return r.json();
      })
      .catch((err) => {
        cache = null;
        throw err;
      });
  }
  return cache;
}

/** Normaliza texto para busca (sem acento, minúsculo) */
export function normalize(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * getProducts(filtros)
 * filtros: { featured, lancamento, jogo (string|array), tipo (string|array),
 *            q, min, max, emEstoque, sort, limit, exclude (id) }
 */
export async function getProducts(filtros = {}) {
  const all = await loadProducts();
  const f = filtros || {};
  const asList = (v) => (v == null || v === '' ? null : Array.isArray(v) ? v : [v]);
  const jogos = asList(f.jogo);
  const tipos = asList(f.tipo);
  const terms = normalize(f.q).split(/\s+/).filter(Boolean);
  const min = f.min != null && f.min !== '' ? Number(f.min) : null;
  const max = f.max != null && f.max !== '' ? Number(f.max) : null;

  let list = all.filter((p) => {
    if (f.featured && !p.destaque) return false;
    if (f.lancamento && !p.lancamento) return false;
    if (f.emEstoque && p.estoque <= 0) return false;
    if (f.exclude && p.id === f.exclude) return false;
    if (jogos && jogos.length && !jogos.includes(p.jogo)) return false;
    if (tipos && tipos.length && !tipos.includes(p.tipo)) return false;
    if (min != null && p.preco < min) return false;
    if (max != null && p.preco > max) return false;
    if (terms.length) {
      const hay = normalize([p.nome, JOGOS[p.jogo], TIPOS[p.tipo], p.raridade, p.descricao].join(' '));
      if (!terms.every((t) => hay.includes(t))) return false;
    }
    return true;
  });

  const byStock = (a, b) => (b.estoque > 0) - (a.estoque > 0);
  switch (f.sort) {
    case 'menor-preco': list.sort((a, b) => a.preco - b.preco); break;
    case 'maior-preco': list.sort((a, b) => b.preco - a.preco); break;
    case 'nome': list.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')); break;
    case 'lancamentos': list.sort((a, b) => b.lancamento - a.lancamento || byStock(a, b)); break;
    default:
      list.sort((a, b) => byStock(a, b) || b.destaque - a.destaque || b.lancamento - a.lancamento);
  }
  if (f.limit) list = list.slice(0, f.limit);
  return list;
}

/** getProduct(idOuSlug) -> produto | null */
export async function getProduct(key) {
  if (!key) return null;
  const all = await loadProducts();
  return all.find((p) => p.id === key || p.slug === key) || null;
}

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export { esc as escapeHTML };

export function productUrl(p) {
  return siteUrl(`pages/produto.html?id=${encodeURIComponent(p.id)}`);
}

/** HTML do .product-card (contrato do design system em components.css) */
export function productCardHTML(p) {
  const url = productUrl(p);
  const off = discountPct(p);
  const soldOut = p.estoque <= 0;
  const badges = [
    off ? `<span class="badge badge--sale">-${off}%</span>` : '',
    p.lancamento ? `<span class="badge badge--new">Lançamento</span>` : '',
    p.raridade ? `<span class="badge badge--rare">${esc(p.raridade)}</span>` : '',
    soldOut ? `<span class="badge badge--soldout">Esgotado</span>` : '',
  ].join('');
  return `<article class="product-card" data-product-id="${esc(p.id)}" data-game="${esc(p.jogo)}">
  <a class="product-card__media" href="${url}">
    <img class="product-card__img" src="${esc(siteUrl(p.imagem))}" alt="${esc(p.nome)}" loading="lazy" width="400" height="560">
    <span class="product-card__foil" aria-hidden="true"></span>
    <span class="product-card__glare" aria-hidden="true"></span>
    <div class="product-card__badges">${badges}</div>
  </a>
  <div class="product-card__body">
    <span class="product-card__game">${esc(JOGOS[p.jogo] || p.jogo)}</span>
    <h3 class="product-card__title"><a href="${url}">${esc(p.nome)}</a></h3>
    <div class="product-card__price">
      ${p.precoAntigo ? `<s class="product-card__old">${formatBRL(p.precoAntigo)}</s>` : ''}
      <strong class="product-card__now">${formatBRL(p.preco)}</strong>
    </div>
    <button class="btn btn--primary btn--sm btn--block product-card__add" type="button" data-add-to-cart="${esc(p.id)}"${soldOut ? ' disabled' : ''}>${soldOut ? 'Esgotado' : 'Adicionar'}</button>
  </div>
</article>`;
}
