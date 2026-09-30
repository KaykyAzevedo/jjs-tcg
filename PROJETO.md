# JJ's TCG — Especificação do projeto

E-commerce de cartas colecionáveis (TCG): Pokémon, Magic: The Gathering, Yu-Gi-Oh!, One Piece, Lorcana.
Booster boxes, boosters avulsos, ETBs, cartas avulsas, decks, acessórios (sleeves, playmats, deck boxes).
Idioma: **português (pt-BR)**, preços em **R$**.

## Stack (sem build)
- HTML + CSS + JavaScript puro (ES modules). **Node não está instalado** — não usar npm/Vite/React.
- Bibliotecas só via CDN (cdnjs / jsdelivr): GSAP + ScrollTrigger permitidos; Lenis (smooth scroll) opcional.
- Servidor local: `python -m http.server 5500` na raiz do projeto → http://localhost:5500
- Estado do carrinho: `localStorage` (chave `jjtcg_cart`). Checkout é simulado (sem gateway real ainda) — gera número de pedido e tela de confirmação. Deixar ponto de extensão claro para Mercado Pago/Stripe no futuro.

## Identidade visual (extraída de assets/img/logo.jpeg)
Fundo em degradê roxo → lilás → rosa → laranja; estrela com degradê rosa-choque → laranja → amarelo; letras "JJ" creme com sombra escura escalonada (efeito 3D/eco).

```css
:root {
  --c-violet: #7B4FF0;   /* roxo do canto esquerdo */
  --c-lilac: #A968C9;
  --c-rose: #C9788F;
  --c-peach: #E8925F;    /* laranja do canto direito */
  --c-hotpink: #FF4FD8;  /* base da estrela */
  --c-orange: #FF7A45;
  --c-gold: #FFD21F;     /* ponta da estrela */
  --c-cream: #FFEBC8;    /* letras JJ */
  --c-ink: #1A0F24;      /* sombra escura */
  --c-night: #120A1E;    /* fundo escuro do site */
  --grad-bg: linear-gradient(90deg, #7B4FF0, #A968C9 35%, #C9788F 65%, #E8925F);
  --grad-star: linear-gradient(45deg, #FF4FD8, #FF7A45 55%, #FFD21F);
}
```
Direção: tema escuro (`--c-night`) com glows em degradê, tipografia display pesada com sombra escalonada tipo logo (sugestão: "Bricolage Grotesque"/"Clash Display"-like via Google Fonts, ex. `Bricolage Grotesque` + `Inter`), cartas com efeito holográfico/foil no hover (tilt 3D + brilho que segue o mouse), estrelas como motivo recorrente.

## Animações (muitas, mas performáticas)
Preloader com a estrela girando; hero com cartas flutuando em parallax; reveal no scroll (GSAP ScrollTrigger); marquee de marcas; tilt 3D holográfico nos cards; botão "adicionar ao carrinho" com a carta voando até o ícone do carrinho; contador animado; cursor customizado com rastro de estrelas (desktop apenas); transições entre páginas. Respeitar `prefers-reduced-motion`.

## Estrutura e DONO de cada arquivo (não editar arquivos de outro dono)
| Arquivo | Dono |
|---|---|
| `assets/css/tokens.css`, `base.css`, `animations.css`, `components.css` | **Design (Prisma)** |
| `assets/js/ui.js` (header/footer injetados, preloader, cursor, reveals, tilt holográfico, transições) | **Design (Prisma)** |
| `index.html` (home) | **Design (Prisma)** |
| `data/products.json`, `assets/img/products/*` | **Loja (Kitsune)** |
| `assets/js/store.js` (carregar produtos, formatar R$), `cart.js`, `catalog.js`, `product.js`, `checkout.js` | **Loja (Kitsune)** |
| `assets/css/shop.css`, `pages/catalogo.html`, `produto.html`, `carrinho.html`, `checkout.html`, `pedido.html` | **Loja (Kitsune)** |
| relatórios de QA | **QA (Vigia)** — não edita código, reporta bugs |

## Contratos entre módulos
- Toda página inclui: `tokens.css`, `base.css`, `animations.css`, `components.css` (+ `shop.css` nas páginas da loja), e scripts `<script type="module" src="/assets/js/ui.js">` + os da loja.
- Header e footer: elementos `<header data-site-header></header>` e `<footer data-site-footer></footer>` preenchidos por `ui.js`. O header contém um botão de carrinho com `[data-cart-count]` e `[data-cart-toggle]`, e links: Início (`/`), Loja (`/pages/catalogo.html`), categorias por jogo (`/pages/catalogo.html?jogo=pokemon`), Carrinho (`/pages/carrinho.html`).
- `cart.js` exporta `addToCart(id, qty)`, `removeFromCart(id)`, `setQty(id, qty)`, `getCart()`, `cartTotal()`, `clearCart()` e dispara `window.dispatchEvent(new CustomEvent('cart:updated', {detail}))`. `ui.js` escuta `cart:updated` para atualizar o badge com animação. `cart.js` também atualiza `[data-cart-count]` na carga da página.
- Animação "voar pro carrinho": `ui.js` exporta `flyToCart(imgElement)`; `cart.js`/páginas chamam ao adicionar.
- Componente de card de produto: classe `.product-card` (markup definido pelo Design em `components.css` e documentado no topo do arquivo); `ui.js` exporta `initTilt(root)` para aplicar o efeito holográfico em qualquer `.product-card` / `[data-tilt]`.
- Home (`index.html`) usa `store.js` → `getProducts({featured:true})` para vitrines de destaque.
- `products.json`: `[{ id, slug, nome, jogo: "pokemon|magic|yugioh|onepiece|lorcana|acessorios", tipo: "booster-box|booster|etb|carta-avulsa|deck|acessorio", preco, precoAntigo?, estoque, destaque, lancamento, raridade?, imagem, galeria?, descricao }]`. Imagens: SVGs gerados localmente (arte de "carta/caixa" estilizada com o degradê da marca) — nada de imagens com copyright.

## Critérios de pronto
- Funciona abrindo http://localhost:5500 sem erros no console.
- Responsivo (360px → 1440px), sem scroll horizontal.
- Fluxo completo: home → catálogo (filtros por jogo/tipo/preço, busca, ordenação) → produto → adicionar ao carrinho → carrinho (alterar qtd, remover, cupom `JJ10` = 10%) → checkout (formulário com validação, CEP, frete fixo/grátis acima de R$ 300, Pix/cartão/boleto simulados) → página de pedido confirmado com confete de estrelas.
