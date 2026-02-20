// ============================================
// KolonoEX — Liquid Glass Edition
// ============================================

const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

let state = {
  prices: {},
  portfolio: { usdt: 10000, holdings: {} },
  transactions: [],
  tradeMode: 'buy',
  allCoins: [],
};

const COINS = [
  { id: 'bitcoin',     symbol: 'BTC',  name: 'Bitcoin',  icon: '₿' },
  { id: 'ethereum',    symbol: 'ETH',  name: 'Ethereum', icon: 'Ξ' },
  { id: 'tether',      symbol: 'USDT', name: 'Tether',   icon: '₮' },
  { id: 'binancecoin', symbol: 'BNB',  name: 'BNB',      icon: '⬡' },
  { id: 'solana',      symbol: 'SOL',  name: 'Solana',   icon: '◎' },
  { id: 'ripple',      symbol: 'XRP',  name: 'XRP',      icon: '✕' },
  { id: 'cardano',     symbol: 'ADA',  name: 'Cardano',  icon: '₳' },
  { id: 'dogecoin',    symbol: 'DOGE', name: 'Dogecoin', icon: 'Ð' },
];

const COIN_IDS = COINS.map(c => c.id).join(',');

// ─── Fetch ───
async function fetchPrices() {
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${COIN_IDS}&vs_currencies=usd&include_24hr_change=true`);
    const data = await res.json();
    state.prices = data;
    state.allCoins = COINS;
    renderMarket();
    renderMiniList();
    updatePortfolioValue();
  } catch {
    document.getElementById('coinList').innerHTML = `<p class="empty-state">Failed to load. Retrying…</p>`;
  }
}

// ─── Render market ───
function renderMarket(filter = '') {
  const list = document.getElementById('coinList');
  const filtered = state.allCoins.filter(c =>
    c.name.toLowerCase().includes(filter.toLowerCase()) ||
    c.symbol.toLowerCase().includes(filter.toLowerCase())
  );
  if (!filtered.length) { list.innerHTML = `<p class="empty-state">No results</p>`; return; }
  list.innerHTML = filtered.map(c => coinItemHTML(c)).join('');
}

function renderMiniList() {
  const list = document.getElementById('miniCoinList');
  list.innerHTML = state.allCoins.slice(0, 4).map(c => coinItemHTML(c)).join('');
}

function coinItemHTML(coin) {
  const p = state.prices[coin.id];
  if (!p) return '';
  const change = p.usd_24h_change?.toFixed(2);
  const isPos = change >= 0;
  return `
    <div class="coin-item" onclick="goToTrade('${coin.id}')">
      <div class="coin-left">
        <div class="coin-icon">${coin.icon}</div>
        <div>
          <div class="coin-name">${coin.name}</div>
          <div class="coin-symbol">${coin.symbol}</div>
        </div>
      </div>
      <div class="coin-right">
        <div class="coin-price">$${formatPrice(p.usd)}</div>
        <div class="coin-change ${isPos ? 'positive' : 'negative'}">${isPos ? '+' : ''}${change}%</div>
      </div>
    </div>`;
}

// ─── Trade ───
function goToTrade(coinId) {
  switchPage('trade');
  document.getElementById('tradeCoin').value = coinId;
  updateTradeInfo();
}

function updateTradeInfo() {
  const coinId = document.getElementById('tradeCoin').value;
  const amount = parseFloat(document.getElementById('tradeAmount').value) || 0;
  const p = state.prices[coinId];
  if (!p || !amount) {
    ['unitPrice','receiveAmount','feeAmount'].forEach(id => document.getElementById(id).textContent = '—');
    return;
  }
  const fee = amount * 0.001;
  const receive = (amount - fee) / p.usd;
  const coin = COINS.find(c => c.id === coinId);
  document.getElementById('unitPrice').textContent = `$${formatPrice(p.usd)}`;
  document.getElementById('receiveAmount').textContent = `${receive.toFixed(6)} ${coin?.symbol}`;
  document.getElementById('feeAmount').textContent = `$${fee.toFixed(4)}`;
}

function executeTrade() {
  const coinId = document.getElementById('tradeCoin').value;
  const amount = parseFloat(document.getElementById('tradeAmount').value);
  const p = state.prices[coinId];
  const coin = COINS.find(c => c.id === coinId);

  if (!amount || amount <= 0) return showToast('Enter a valid amount', 'error');
  if (!p) return showToast('Price unavailable', 'error');

  const fee = amount * 0.001;
  const net = amount - fee;
  const coinAmount = net / p.usd;

  if (state.tradeMode === 'buy') {
    if (amount > state.portfolio.usdt) return showToast('Insufficient USDT balance', 'error');
    state.portfolio.usdt -= amount;
    if (!state.portfolio.holdings[coinId]) state.portfolio.holdings[coinId] = { amount: 0, avgPrice: 0 };
    const h = state.portfolio.holdings[coinId];
    const cost = h.amount * h.avgPrice + net;
    h.amount += coinAmount;
    h.avgPrice = cost / h.amount;
    state.transactions.unshift({ type:'buy', coin:coin.symbol, coinName:coin.name, amount:coinAmount, usdValue:amount, price:p.usd });
    showToast(`Bought ${coinAmount.toFixed(6)} ${coin.symbol}`, 'success');
  } else {
    const h = state.portfolio.holdings[coinId];
    if (!h || h.amount < coinAmount) return showToast('Insufficient asset balance', 'error');
    h.amount -= coinAmount;
    state.portfolio.usdt += net;
    state.transactions.unshift({ type:'sell', coin:coin.symbol, coinName:coin.name, amount:coinAmount, usdValue:net, price:p.usd });
    showToast(`Sold for $${net.toFixed(2)}`, 'success');
  }

  document.getElementById('tradeAmount').value = '';
  updateTradeInfo();
  updatePortfolioValue();
  renderMiniList();
}

// ─── Wallet ───
function renderWallet() {
  document.getElementById('usdtBalance').textContent = `$${state.portfolio.usdt.toFixed(2)}`;

  const entries = Object.entries(state.portfolio.holdings).filter(([,h]) => h.amount > 0.000001);
  document.getElementById('holdingsList').innerHTML = !entries.length
    ? `<p class="empty-state">No assets yet. Start trading!</p>`
    : entries.map(([id, h]) => {
        const coin = COINS.find(c => c.id === id);
        const val = h.amount * (state.prices[id]?.usd || 0);
        return `<div class="holding-item"><div><div class="holding-name">${coin?.name}</div><div class="holding-amount">${h.amount.toFixed(6)} ${coin?.symbol}</div></div><div class="holding-value">$${val.toFixed(2)}</div></div>`;
      }).join('');

  document.getElementById('txList').innerHTML = !state.transactions.length
    ? `<p class="empty-state">No transactions yet</p>`
    : state.transactions.slice(0,20).map(tx => `
        <div class="tx-item">
          <div><span class="tx-type ${tx.type}">${tx.type.toUpperCase()}</span><div class="tx-coin">${tx.coinName}</div></div>
          <div class="tx-amount">${tx.amount.toFixed(6)} ${tx.coin}<br><span style="color:var(--text2);font-size:11px">$${tx.usdValue.toFixed(2)}</span></div>
        </div>`).join('');
}

// ─── Portfolio Value ───
function updatePortfolioValue() {
  let total = state.portfolio.usdt;
  for (const [id, h] of Object.entries(state.portfolio.holdings)) {
    total += h.amount * (state.prices[id]?.usd || 0);
  }
  const fmt = `$${total.toFixed(2)}`;
  document.getElementById('totalPortfolio').textContent = fmt;
  document.getElementById('heroBalance').textContent = fmt;
}

// ─── Navigation ───
function switchPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`page-${name}`).classList.add('active');
  document.querySelector(`[data-page="${name}"]`)?.classList.add('active');
  if (name === 'wallet') renderWallet();
}

// ─── Helpers ───
function formatPrice(p) {
  if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(4);
  return p.toFixed(6);
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ─── Events ───
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => switchPage(btn.dataset.page));
});

document.getElementById('searchInput').addEventListener('input', e => renderMarket(e.target.value));
document.getElementById('tradeCoin').addEventListener('change', updateTradeInfo);
document.getElementById('tradeAmount').addEventListener('input', updateTradeInfo);

document.getElementById('buyBtn').addEventListener('click', () => {
  state.tradeMode = 'buy';
  document.getElementById('buyBtn').className = 'toggle-btn active buy-mode';
  document.getElementById('sellBtn').className = 'toggle-btn';
  document.getElementById('tradeBtn').textContent = 'Place Buy Order';
  document.getElementById('tradeBtn').className = 'cta-btn buy-cta';
});

document.getElementById('sellBtn').addEventListener('click', () => {
  state.tradeMode = 'sell';
  document.getElementById('sellBtn').className = 'toggle-btn active sell-mode';
  document.getElementById('buyBtn').className = 'toggle-btn';
  document.getElementById('tradeBtn').textContent = 'Place Sell Order';
  document.getElementById('tradeBtn').className = 'cta-btn sell-cta';
});

document.getElementById('tradeBtn').addEventListener('click', executeTrade);

document.querySelectorAll('.quick-chip').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('tradeAmount').value = btn.dataset.amount;
    updateTradeInfo();
  });
});

// ─── Init ───
fetchPrices();
setInterval(fetchPrices, 30000);
