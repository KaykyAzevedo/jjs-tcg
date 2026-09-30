# JJ's TCG

E-commerce de cartas colecionáveis (Pokémon, Magic, Yu-Gi-Oh!, One Piece, Lorcana e acessórios).
HTML, CSS e JavaScript puros (ES modules), animações com GSAP via CDN. Sem build.

## Rodar localmente
```bash
python -m http.server 5500
```
Abra http://localhost:5500

## Estrutura
- `index.html`: home
- `pages/`: catálogo, produto, carrinho, checkout, pedido
- `assets/css`, `assets/js`: design system (`ui.js`) e loja (`store.js`, `cart.js`, ...)
- `data/products.json`: catálogo de produtos

Checkout simulado: o ponto de integração com gateway de pagamento é `processPayment()` em `assets/js/checkout.js`.
Especificação completa em `PROJETO.md`.
