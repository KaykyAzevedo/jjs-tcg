// checkout.js — página pages/checkout.html (Loja / Kitsune)
// Checkout SIMULADO. Ponto de extensão para gateway real: processPayment().
import { cartSummary, clearCart, SHIPPING_OPTIONS, FREE_SHIPPING_MIN, notify } from './cart.js';
import { formatBRL, escapeHTML as esc, siteUrl } from './store.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const form = $('#checkout-form');
const ORDERS_KEY = 'jjtcg_orders';
export const PIX_DISCOUNT = 0.05;
const MAX_INSTALLMENTS = 10;
const MIN_INSTALLMENT = 20;

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
// Faixas de CEP por UF (fallback quando o ViaCEP não responde)
const CEP_UF = [
  [1000, 19999, 'SP'], [20000, 28999, 'RJ'], [29000, 29999, 'ES'], [30000, 39999, 'MG'],
  [40000, 48999, 'BA'], [49000, 49999, 'SE'], [50000, 56999, 'PE'], [57000, 57999, 'AL'],
  [58000, 58999, 'PB'], [59000, 59999, 'RN'], [60000, 63999, 'CE'], [64000, 64999, 'PI'],
  [65000, 65999, 'MA'], [66000, 68899, 'PA'], [68900, 68999, 'AP'], [69000, 69299, 'AM'],
  [69300, 69399, 'RR'], [69400, 69899, 'AM'], [69900, 69999, 'AC'], [70000, 73699, 'DF'],
  [72800, 76799, 'GO'], [76800, 76999, 'RO'], [77000, 77999, 'TO'], [78000, 78899, 'MT'],
  [79000, 79999, 'MS'], [80000, 87999, 'PR'], [88000, 89999, 'SC'], [90000, 99999, 'RS'],
];

let shipping = 'pac';
let payment = 'pix';

/* ---------------- máscaras ---------------- */
const digits = (v) => String(v || '').replace(/\D/g, '');
const MASKS = {
  cpf: (v) => digits(v).slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'),
  cep: (v) => digits(v).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2'),
  phone: (v) => {
    const d = digits(v).slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : '';
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  },
  card: (v) => digits(v).slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 '),
  exp: (v) => digits(v).slice(0, 4).replace(/(\d{2})(\d)/, '$1/$2'),
  cvv: (v) => digits(v).slice(0, 4),
};
form.addEventListener('input', (e) => {
  const m = e.target.dataset.mask;
  if (m && MASKS[m]) {
    const before = e.target.value;
    const after = MASKS[m](before);
    if (before !== after) e.target.value = after;
  }
  if (e.target.closest('.field.is-invalid')) validateField(e.target);
  if (e.target.name?.startsWith('cartao')) updateCardPreview();
  if (e.target.name === 'cep' && digits(e.target.value).length === 8) lookupCep();
});

/* ---------------- validação ---------------- */
function validCPF(v) {
  const d = digits(v);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (n) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === +d[9] && calc(10) === +d[10];
}
function luhn(v) {
  const d = digits(v);
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = +d[d.length - 1 - i];
    if (i % 2) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0;
}
function validExp(v) {
  const m = /^(\d{2})\/(\d{2})$/.exec(v || '');
  if (!m) return false;
  const mm = +m[1], yy = 2000 + +m[2];
  if (mm < 1 || mm > 12) return false;
  const now = new Date();
  return yy > now.getFullYear() || (yy === now.getFullYear() && mm >= now.getMonth() + 1);
}
function cardBrand(v) {
  const d = digits(v);
  if (/^4/.test(d)) return 'VISA';
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'MASTERCARD';
  if (/^3[47]/.test(d)) return 'AMEX';
  if (/^(4011|4312|4389|4514|4576|5041|5066|5090|6277|6362|6363|650|6516|6550)/.test(d)) return 'ELO';
  if (/^(38|60)/.test(d)) return 'HIPERCARD';
  return "JJ'S CARD";
}

const RULES = {
  nome: (v) => (v.trim().split(/\s+/).length >= 2 && v.trim().length >= 5) || 'Informe nome e sobrenome.',
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || 'E-mail inválido.',
  telefone: (v) => [10, 11].includes(digits(v).length) || 'Celular com DDD, ex.: (11) 91234-5678.',
  cpf: (v) => validCPF(v) || 'CPF inválido.',
  cep: (v) => digits(v).length === 8 || 'CEP deve ter 8 dígitos.',
  rua: (v) => v.trim().length >= 3 || 'Informe o endereço.',
  numero: (v) => v.trim().length > 0 || 'Informe o número (ou S/N).',
  bairro: (v) => v.trim().length >= 2 || 'Informe o bairro.',
  cidade: (v) => v.trim().length >= 2 || 'Informe a cidade.',
  uf: (v) => UFS.includes(v) || 'Selecione o estado.',
  cartaoNumero: (v) => luhn(v) || 'Número de cartão inválido.',
  cartaoNome: (v) => v.trim().length >= 3 || 'Informe o nome impresso no cartão.',
  cartaoValidade: (v) => validExp(v) || 'Validade inválida ou vencida.',
  cartaoCvv: (v) => /^\d{3,4}$/.test(v) || 'CVV com 3 ou 4 dígitos.',
};

function isActive(input) {
  const need = input.dataset.payRequired;
  return !need || need === payment;
}
function validateField(input) {
  const rule = RULES[input.name];
  if (!rule || !isActive(input)) return setError(input, ''), true;
  const res = rule(input.value || '');
  setError(input, res === true ? '' : res);
  return res === true;
}
function setError(input, msg) {
  const field = input.closest('.field');
  field?.classList.toggle('is-invalid', !!msg);
  if (msg) input.setAttribute('aria-invalid', 'true');
  else input.removeAttribute('aria-invalid');
  const err = field?.querySelector('.field__error');
  if (err) err.textContent = msg;
}
form.addEventListener('focusout', (e) => {
  if (e.target.name && RULES[e.target.name] && e.target.value) validateField(e.target);
});

/* ---------------- CEP (ViaCEP + fallback) ---------------- */
const cepStatus = $('[data-cep-status]');
let lastCep = '';
async function lookupCep() {
  const input = form.cep;
  const cep = digits(input.value);
  if (cep.length !== 8) return validateField(input);
  if (cep === lastCep) return;
  lastCep = cep;
  setError(input, '');
  cepStatus.className = 'cep-status';
  cepStatus.textContent = 'Buscando endereço…';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: ctrl.signal });
    if (!r.ok) throw new Error('http ' + r.status);
    const d = await r.json();
    if (d.erro) {
      cepStatus.classList.add('is-err');
      cepStatus.textContent = 'CEP não encontrado. Confira ou preencha o endereço manualmente.';
      return;
    }
    fill({ rua: d.logradouro, bairro: d.bairro, cidade: d.localidade, uf: d.uf });
    cepStatus.classList.add('is-ok');
    cepStatus.textContent = `✓ ${d.localidade} / ${d.uf}`;
    (d.logradouro ? form.numero : form.rua).focus();
  } catch {
    // fallback offline: descobre a UF pela faixa do CEP e libera preenchimento manual
    const n = +cep.slice(0, 5);
    const uf = CEP_UF.find(([a, b]) => n >= a && n <= b)?.[2];
    if (uf && !form.uf.value) fill({ uf });
    cepStatus.classList.add('is-err');
    cepStatus.textContent = 'Não conseguimos consultar o CEP agora — preencha o endereço manualmente.';
    form.rua.focus();
  } finally {
    clearTimeout(timer);
    renderSummary();
  }
}
function fill(obj) {
  for (const [k, v] of Object.entries(obj)) {
    if (v && form[k]) { form[k].value = v; validateField(form[k]); }
  }
}
$('[data-cep-search]').addEventListener('click', () => { lastCep = ''; lookupCep(); });
form.cep.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); lastCep = ''; lookupCep(); } });

/* ---------------- envio / pagamento ---------------- */
function renderShipping() {
  const s = cartSummary();
  const base = s.subtotal - s.discount;
  $('[data-shipping-options]').innerHTML = Object.values(SHIPPING_OPTIONS).map((o) => {
    const free = o.freeEligible && base > FREE_SHIPPING_MIN;
    return `<label class="option">
      <input type="radio" name="envio" value="${o.id}" ${o.id === shipping ? 'checked' : ''}>
      <span class="option__main"><span class="option__title">${o.nome}</span><span class="option__sub">${o.prazo}${o.freeEligible && !free ? ` · grátis acima de ${formatBRL(FREE_SHIPPING_MIN)}` : ''}</span></span>
      <span class="option__price ${free ? 'is-free' : ''}">${free ? 'Grátis' : formatBRL(o.preco)}</span>
    </label>`;
  }).join('');
}

function totals() {
  const s = cartSummary({ shipping });
  const pix = payment === 'pix' ? Math.round((s.subtotal - s.discount) * PIX_DISCOUNT * 100) / 100 : 0;
  return { ...s, pix, total: Math.round((s.total - pix) * 100) / 100 };
}

function renderInstallments(total) {
  const sel = $('[data-installments]');
  const prev = sel.value || '1';
  const max = Math.max(1, Math.min(MAX_INSTALLMENTS, Math.floor(total / MIN_INSTALLMENT)));
  sel.innerHTML = Array.from({ length: max }, (_, i) => i + 1)
    .map((n) => `<option value="${n}">${n}x de ${formatBRL(total / n)} sem juros</option>`).join('');
  sel.value = +prev <= max ? prev : '1';
}

function renderSummary() {
  const t = totals();
  if (!t.items.length) {
    $('[data-checkout]').hidden = true;
    $('[data-checkout-empty]').hidden = false;
    return;
  }
  $('[data-summary-items]').innerHTML = t.items.map((i) => `<li class="summary__item">
      <img src="${esc(siteUrl(i.imagem))}" alt="" width="44" height="62"><span>${i.qty}× ${esc(i.nome)}</span><strong>${formatBRL(i.preco * i.qty)}</strong></li>`).join('');
  $('[data-summary-rows]').innerHTML = `
    <div class="summary__row"><dt>Subtotal</dt><dd>${formatBRL(t.subtotal)}</dd></div>
    ${t.discount ? `<div class="summary__row summary__row--discount"><dt>Cupom ${esc(t.coupon.code)}</dt><dd>− ${formatBRL(t.discount)}</dd></div>` : ''}
    ${t.pix ? `<div class="summary__row summary__row--discount"><dt>Desconto Pix (5%)</dt><dd>− ${formatBRL(t.pix)}</dd></div>` : ''}
    <div class="summary__row"><dt>Frete (${SHIPPING_OPTIONS[shipping].nome})</dt><dd>${t.shipping ? formatBRL(t.shipping) : 'Grátis'}</dd></div>
    <div class="summary__row summary__row--total"><dt>Total</dt><dd>${formatBRL(t.total)}</dd></div>`;
  renderInstallments(t.total);
}

form.addEventListener('change', (e) => {
  if (e.target.name === 'envio') { shipping = e.target.value; renderSummary(); }
  if (e.target.name === 'pagamento') {
    payment = e.target.value;
    $$('[data-pay-panel]').forEach((p) => (p.hidden = p.dataset.payPanel !== payment));
    $$('[data-pay-required]').forEach((i) => { if (!isActive(i)) setError(i, ''); });
    renderSummary();
  }
});

function updateCardPreview() {
  const num = digits(form.cartaoNumero.value);
  $('[data-card-num]').textContent = (num.padEnd(16, '•').match(/.{1,4}/g) || []).join(' ');
  $('[data-card-name]').textContent = form.cartaoNome.value.trim().toUpperCase() || 'NOME NO CARTÃO';
  $('[data-card-exp]').textContent = form.cartaoValidade.value || 'MM/AA';
  $('[data-card-brand]').textContent = cardBrand(num);
}

/* ---------------- pagamento (EXTENSÃO) ----------------
 * Hoje: simulação local. Para integrar um gateway real:
 *  - Mercado Pago: crie a preferência/pagamento no SEU backend
 *    (POST /api/pagamentos) e use o Checkout Bricks no front;
 *  - Stripe: crie um PaymentIntent no backend e confirme com Stripe.js/Elements.
 * NUNCA envie o número do cartão para seu próprio servidor — tokenize no SDK.
 * Esta função deve resolver com { status: 'approved'|'pending'|'rejected', ... }.
 */
export async function processPayment(order) {
  await new Promise((r) => setTimeout(r, 1200));
  if (order.pagamento.metodo === 'cartao') {
    return { status: 'approved', autorizacao: String(Math.floor(100000 + Math.random() * 900000)) };
  }
  if (order.pagamento.metodo === 'pix') {
    return { status: 'pending', pixCopiaECola: fakePix(order), expiraEm: Date.now() + 30 * 60 * 1000 };
  }
  return { status: 'pending', linhaDigitavel: fakeBoleto(), vencimento: addBusinessDays(new Date(), 3).toISOString() };
}

function fakePix(order) {
  const v = order.totais.total.toFixed(2);
  return `00020126580014BR.GOV.BCB.PIX0136jjtcg-${order.numero.toLowerCase()}520400005303986540${v.length}${v}5802BR5909JJS TCG6009SAO PAULO62070503***6304${rand(4, '0123456789ABCDEF')}`;
}
function fakeBoleto() {
  const d = () => rand(5, '0123456789');
  return `34191.${d()} ${d()}.${d()}${rand(1, '0123456789')} ${d()}.${d()}${rand(1, '0123456789')} ${rand(1, '123456789')} ${rand(14, '0123456789')}`;
}
function addBusinessDays(date, n) {
  const d = new Date(date);
  while (n > 0) { d.setDate(d.getDate() + 1); if (d.getDay() % 6) n--; }
  return d;
}
function rand(n, chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789') {
  let s = '';
  const buf = crypto.getRandomValues(new Uint32Array(n));
  for (let i = 0; i < n; i++) s += chars[buf[i] % chars.length];
  return s;
}
function orderNumber() {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `JJ${ymd}-${rand(5)}`;
}

/* ---------------- envio do formulário ---------------- */
const errBox = $('[data-form-error]');
const submitBtn = $('[data-submit]');
let sending = false;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (sending) return;
  errBox.textContent = '';
  const inputs = $$('input[name], select[name]', form).filter((i) => RULES[i.name]);
  const invalid = inputs.filter((i) => !validateField(i));
  if (invalid.length) {
    errBox.textContent = `Revise ${invalid.length === 1 ? 'o campo destacado' : `os ${invalid.length} campos destacados`}.`;
    invalid[0].focus({ preventScroll: true });
    invalid[0].scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    return;
  }
  const t = totals();
  if (!t.items.length) return renderSummary();

  const f = form.elements;
  const order = {
    numero: orderNumber(),
    criadoEm: new Date().toISOString(),
    cliente: { nome: f.nome.value.trim(), email: f.email.value.trim(), telefone: f.telefone.value, cpf: f.cpf.value.replace(/^(\d{3}).*(\d{2})$/, '$1.***.***-$2') },
    endereco: {
      cep: f.cep.value, rua: f.rua.value.trim(), numero: f.numero.value.trim(), complemento: f.complemento.value.trim(),
      bairro: f.bairro.value.trim(), cidade: f.cidade.value.trim(), uf: f.uf.value,
    },
    envio: { ...SHIPPING_OPTIONS[shipping], preco: t.shipping },
    pagamento: {
      metodo: payment,
      parcelas: payment === 'cartao' ? +f.parcelas.value : 1,
      bandeira: payment === 'cartao' ? cardBrand(f.cartaoNumero.value) : null,
      final: payment === 'cartao' ? digits(f.cartaoNumero.value).slice(-4) : null,
    },
    itens: t.items.map(({ id, nome, preco, qty, imagem }) => ({ id, nome, preco, qty, imagem })),
    totais: { subtotal: t.subtotal, cupom: t.coupon?.code || null, desconto: t.discount, descontoPix: t.pix, frete: t.shipping, total: t.total },
  };

  sending = true;
  submitBtn.classList.add('is-loading');
  submitBtn.disabled = true;
  submitBtn.textContent = payment === 'cartao' ? 'Processando pagamento…' : 'Gerando pedido…';
  try {
    const result = await processPayment(order);
    if (result.status === 'rejected') throw new Error('Pagamento recusado');
    order.status = result.status;
    order.pagamento = { ...order.pagamento, ...result };
    saveOrder(order);
    clearCart();
    location.href = siteUrl(`pages/pedido.html?n=${encodeURIComponent(order.numero)}`);
  } catch (err) {
    console.warn(err);
    errBox.textContent = 'Não foi possível concluir o pagamento. Tente novamente ou escolha outra forma.';
    notify('Falha no pagamento.', 'error');
    sending = false;
    submitBtn.classList.remove('is-loading');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Confirmar pedido';
  }
});

function saveOrder(order) {
  try {
    const list = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
    list.unshift(order);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(list.slice(0, 10)));
  } catch { /* ignore */ }
  try { sessionStorage.setItem('jjtcg_last_order', JSON.stringify(order)); } catch { /* ignore */ }
}

/* ---------------- init ---------------- */
$('[data-uf]').insertAdjacentHTML('beforeend', UFS.map((u) => `<option value="${u}">${u}</option>`).join(''));
renderShipping();
renderSummary();
window.addEventListener('cart:updated', () => { if (!sending) { renderShipping(); renderSummary(); } });
