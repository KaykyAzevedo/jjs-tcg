// pedido.js — página pages/pedido.html?n= (Loja / Kitsune)
import { formatBRL, escapeHTML as esc, productUrl, siteUrl } from './store.js';
import { notify } from './cart.js';

const root = document.querySelector('[data-order]');
const n = new URLSearchParams(location.search).get('n');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function findOrder() {
  try {
    const list = JSON.parse(localStorage.getItem('jjtcg_orders') || '[]');
    const o = n ? list.find((x) => x.numero === n) : list[0];
    if (o) return o;
  } catch { /* ignore */ }
  try {
    const last = JSON.parse(sessionStorage.getItem('jjtcg_last_order') || 'null');
    if (last && (!n || last.numero === n)) return last;
  } catch { /* ignore */ }
  return null;
}

const STAR = `<svg class="order__star" viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="og" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#FF4FD8"/><stop offset=".55" stop-color="#FF7A45"/><stop offset="1" stop-color="#FFD21F"/></linearGradient></defs><path fill="url(#og)" d="M50 4l13.2 28.6 31.3 3.6-23.2 21.3 6.3 30.9L50 72.8 22.4 88.4l6.3-30.9L5.5 36.2l31.3-3.6z"/></svg>`;

// "QR" decorativo (simulação — não é um QR Code válido)
function fakeQR(seed) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const rnd = () => ((h = (h * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const N = 25;
  let cells = '';
  const finder = (x, y) => x < 7 && y < 7;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (finder(x, y) || finder(N - 1 - x, y) || finder(x, N - 1 - y)) continue;
    if (rnd() > 0.52) cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
  }
  const f = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3"/>`;
  return `<svg class="order__qr" viewBox="0 0 ${N} ${N}" shape-rendering="crispEdges" role="img" aria-label="QR Code Pix (simulado)"><g fill="#120A1E">${cells}${f(0, 0)}${f(N - 7, 0)}${f(0, N - 7)}</g></svg>`;
}

function payBlock(o) {
  const p = o.pagamento;
  if (p.metodo === 'pix') {
    return `<div class="panel order__pay">
      <h2 class="h3">Pague com Pix</h2>
      ${fakeQR(o.numero)}
      <p class="muted" style="margin:0">Escaneie o QR Code ou use o Pix copia e cola. Válido por 30 minutos.</p>
      <code class="order__code" data-copy-src>${esc(p.pixCopiaECola || '')}</code>
      <button class="btn btn--outline btn--sm" type="button" data-copy>Copiar código Pix</button>
    </div>`;
  }
  if (p.metodo === 'boleto') {
    const venc = p.vencimento ? new Date(p.vencimento).toLocaleDateString('pt-BR') : '';
    return `<div class="panel order__pay">
      <h2 class="h3">Boleto bancário</h2>
      <p class="muted" style="margin:0">Vencimento: <strong>${venc}</strong>. O pedido é separado após a compensação (1 a 3 dias úteis).</p>
      <code class="order__code" data-copy-src>${esc(p.linhaDigitavel || '')}</code>
      <button class="btn btn--outline btn--sm" type="button" data-copy>Copiar linha digitável</button>
    </div>`;
  }
  return `<div class="panel order__pay">
    <h2 class="h3">Pagamento aprovado ✓</h2>
    <p class="muted" style="margin:0">${esc(p.bandeira || 'Cartão')} final ${esc(p.final || '••••')} · ${p.parcelas}x de ${formatBRL(o.totais.total / p.parcelas)} · autorização ${esc(p.autorizacao || '')}</p>
  </div>`;
}

function render(o) {
  const first = o.cliente.nome.split(' ')[0];
  const e = o.endereco;
  const t = o.totais;
  document.title = `Pedido ${o.numero} — JJ's TCG`;
  root.innerHTML = `
    ${STAR}
    <div>
      <p class="section-kicker">Pedido confirmado</p>
      <h1 class="display" style="margin:.25rem 0">Valeu, ${esc(first)}! ✦</h1>
      <p class="muted">Enviamos os detalhes para <strong>${esc(o.cliente.email)}</strong>.</p>
    </div>
    <div><span class="order__num" aria-label="Número do pedido">#${esc(o.numero)}</span></div>

    ${payBlock(o)}

    <div class="panel" style="display:grid;gap:var(--sp-4)">
      <h2 class="h3" style="margin:0">Resumo</h2>
      <ul class="summary__items" style="max-height:none">
        ${o.itens.map((i) => `<li class="summary__item"><img src="${esc(siteUrl(i.imagem))}" alt="" width="44" height="62"><span><a href="${productUrl(i)}">${esc(i.nome)}</a> × ${i.qty}</span><strong>${formatBRL(i.preco * i.qty)}</strong></li>`).join('')}
      </ul>
      <dl class="summary__rows">
        <div class="summary__row"><dt>Subtotal</dt><dd>${formatBRL(t.subtotal)}</dd></div>
        ${t.desconto ? `<div class="summary__row summary__row--discount"><dt>Cupom ${esc(t.cupom)}</dt><dd>− ${formatBRL(t.desconto)}</dd></div>` : ''}
        ${t.descontoPix ? `<div class="summary__row summary__row--discount"><dt>Desconto Pix</dt><dd>− ${formatBRL(t.descontoPix)}</dd></div>` : ''}
        <div class="summary__row"><dt>Frete (${esc(o.envio.nome)} · ${esc(o.envio.prazo)})</dt><dd>${t.frete ? formatBRL(t.frete) : 'Grátis'}</dd></div>
        <div class="summary__row summary__row--total"><dt>Total</dt><dd>${formatBRL(t.total)}</dd></div>
      </dl>
      <div class="divider"></div>
      <div>
        <p class="field__label" style="margin:0 0 .25rem">Entregar em</p>
        <p class="muted" style="margin:0">${esc(e.rua)}, ${esc(e.numero)}${e.complemento ? ' — ' + esc(e.complemento) : ''}<br>${esc(e.bairro)} · ${esc(e.cidade)}/${esc(e.uf)} · CEP ${esc(e.cep)}</p>
      </div>
    </div>

    <div class="order__actions">
      <a class="btn btn--primary btn--lg" href="${siteUrl(`pages/catalogo.html`)}">Continuar comprando</a>
      <a class="btn btn--ghost btn--lg" href="${siteUrl('')}">Voltar ao início</a>
    </div>`;

  root.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-copy]');
    if (!b) return;
    const txt = root.querySelector('[data-copy-src]')?.textContent || '';
    try {
      await navigator.clipboard.writeText(txt);
      notify('Código copiado!', 'success');
    } catch {
      notify('Selecione e copie o código manualmente.', 'info');
    }
  });

  celebrate();
}

function renderMissing() {
  root.innerHTML = `${STAR}
    <h1 class="display">Pedido não encontrado</h1>
    <p class="muted">Não achamos esse pedido neste navegador. Se você acabou de comprar, confira seu e-mail.</p>
    <div class="order__actions"><a class="btn btn--primary" href="${siteUrl(`pages/catalogo.html`)}">Ir para a loja</a></div>`;
}

/* ---------- confete de estrelas ---------- */
async function celebrate() {
  if (reduceMotion) return;
  try {
    const ui = await import('./ui.js');
    if (typeof ui.confetti === 'function') return ui.confetti();
  } catch { /* usa o fallback */ }
  starConfetti();
}

function starConfetti() {
  const c = document.createElement('canvas');
  c.className = 'star-confetti';
  c.setAttribute('aria-hidden', 'true');
  document.body.appendChild(c);
  const ctx = c.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const resize = () => { c.width = innerWidth * dpr; c.height = innerHeight * dpr; };
  resize();
  addEventListener('resize', resize);
  const colors = ['#FF4FD8', '#FF7A45', '#FFD21F', '#FFEBC8', '#7B4FF0', '#A968C9'];
  const parts = Array.from({ length: Math.min(160, Math.round(innerWidth / 6)) }, (_, i) => ({
    x: Math.random() * innerWidth,
    y: -20 - Math.random() * innerHeight * 0.6,
    r: 5 + Math.random() * 9,
    vy: 1.5 + Math.random() * 3,
    vx: -1 + Math.random() * 2,
    rot: Math.random() * Math.PI,
    vr: -0.08 + Math.random() * 0.16,
    sway: Math.random() * Math.PI * 2,
    color: colors[i % colors.length],
  }));
  const drawStar = (x, y, r, rot) => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? r * 0.45 : r;
      const a = rot - Math.PI / 2 + (i * Math.PI) / 5;
      ctx.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a));
    }
    ctx.closePath();
    ctx.fill();
  };
  const start = performance.now();
  const DURATION = 5200;
  (function frame(now) {
    const el = now - start;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.globalAlpha = el > DURATION - 1000 ? Math.max(0, (DURATION - el) / 1000) : 1;
    for (const p of parts) {
      p.sway += 0.03;
      p.x += p.vx + Math.sin(p.sway) * 0.8;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.fillStyle = p.color;
      drawStar(p.x, p.y, p.r, p.rot);
    }
    if (el < DURATION) requestAnimationFrame(frame);
    else { c.remove(); removeEventListener('resize', resize); }
  })(start);
}

const order = findOrder();
order ? render(order) : renderMissing();
