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
    <div class="coin-item" onclick="openChart('${coin.id}')">
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

// ============================================
// CHART MODULE
// ============================================

let chartInstance = null;
let candleSeries = null;
let currentChartCoin = null;
let currentTf = 5;

// CoinGecko maps minutes → days param
const TF_DAYS = { 5: 1, 15: 1, 30: 2, 60: 7 };
// minutes in seconds for OHLC bucketing
const TF_SEC  = { 5: 300, 15: 900, 30: 1800, 60: 3600 };

async function openChart(coinId) {
  currentChartCoin = coinId;
  const coin = COINS.find(c => c.id === coinId);
  const p = state.prices[coinId];

  // Update header
  document.getElementById('chartIcon').textContent = coin.icon;
  document.getElementById('chartName').textContent = coin.name;
  document.getElementById('chartPrice').textContent = p ? `$${formatPrice(p.usd)}` : '—';

  const change = p?.usd_24h_change?.toFixed(2);
  const badge = document.getElementById('chartChange');
  badge.textContent = change ? `${change >= 0 ? '+' : ''}${change}%` : '—';
  badge.className = `chart-change-badge ${change >= 0 ? 'positive' : 'negative'}`;

  switchPage('chart');
  await loadChart(coinId, currentTf);
}

async function loadChart(coinId, tf) {
  const loader = document.getElementById('chartLoader');
  loader.classList.remove('hidden');

  // Init or clear chart
  const container = document.getElementById('chartContainer');
  if (chartInstance) { chartInstance.remove(); chartInstance = null; candleSeries = null; }

  chartInstance = LightweightCharts.createChart(container, {
    width: container.clientWidth,
    height: 260,
    layout: {
      background: { type: 'solid', color: 'transparent' },
      textColor: 'rgba(220,230,255,0.6)',
      fontSize: 11,
      fontFamily: "'DM Mono', monospace",
    },
    grid: {
      vertLines: { color: 'rgba(255,255,255,0.05)' },
      horzLines: { color: 'rgba(255,255,255,0.05)' },
    },
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
      vertLine: { color: 'rgba(79,195,247,0.4)', width: 1, style: 1 },
      horzLine: { color: 'rgba(79,195,247,0.4)', width: 1, style: 1 },
    },
    rightPriceScale: {
      borderColor: 'rgba(255,255,255,0.08)',
      textColor: 'rgba(220,230,255,0.5)',
    },
    timeScale: {
      borderColor: 'rgba(255,255,255,0.08)',
      timeVisible: true,
      secondsVisible: false,
    },
    handleScroll: true,
    handleScale: true,
  });

  candleSeries = chartInstance.addCandlestickSeries({
    upColor: '#00e5a0',
    downColor: '#ff5252',
    borderUpColor: '#00e5a0',
    borderDownColor: '#ff5252',
    wickUpColor: 'rgba(0,229,160,0.6)',
    wickDownColor: 'rgba(255,82,82,0.6)',
  });

  try {
    const days = TF_DAYS[tf];
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=minutely`;
    const res = await fetch(url);
    const data = await res.json();

    // Bucket raw minute data into tf-minute candles
    const bucketSec = TF_SEC[tf];
    const candles = buildCandles(data.prices, bucketSec);
    candleSeries.setData(candles);
    chartInstance.timeScale().fitContent();
  } catch (e) {
    // Fallback: generate realistic-looking demo candles
    candleSeries.setData(generateDemoCandles(state.prices[coinId]?.usd || 1000, tf));
    chartInstance.timeScale().fitContent();
  }

  loader.classList.add('hidden');
}

function buildCandles(prices, bucketSec) {
  if (!prices || !prices.length) return [];
  const map = {};
  for (const [ts, price] of prices) {
    const t = Math.floor(ts / 1000 / bucketSec) * bucketSec;
    if (!map[t]) map[t] = { time: t, open: price, high: price, low: price, close: price };
    else {
      map[t].high = Math.max(map[t].high, price);
      map[t].low  = Math.min(map[t].low,  price);
      map[t].close = price;
    }
  }
  return Object.values(map).sort((a,b) => a.time - b.time);
}

function generateDemoCandles(basePrice, tf) {
  // Fallback realistic random candles
  const candles = [];
  const now = Math.floor(Date.now() / 1000);
  const bucketSec = TF_SEC[tf];
  const count = { 5: 120, 15: 96, 30: 96, 60: 168 }[tf] || 100;
  let price = basePrice;
  for (let i = count; i >= 0; i--) {
    const t = now - i * bucketSec;
    const vol = price * 0.008;
    const open = price;
    const close = price + (Math.random() - 0.48) * vol;
    const high = Math.max(open, close) + Math.random() * vol * 0.5;
    const low  = Math.min(open, close) - Math.random() * vol * 0.5;
    candles.push({ time: t, open, high, low, close });
    price = close;
  }
  return candles;
}

function goToTradeFromChart(mode) {
  if (!currentChartCoin) return;
  switchPage('trade');
  document.getElementById('tradeCoin').value = currentChartCoin;
  if (mode === 'sell') document.getElementById('sellBtn').click();
  else document.getElementById('buyBtn').click();
  updateTradeInfo();
}

// Timeframe buttons
document.querySelectorAll('.tf-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTf = parseInt(btn.dataset.tf);
    if (currentChartCoin) loadChart(currentChartCoin, currentTf);
  });
});

// Resize chart on window resize
window.addEventListener('resize', () => {
  if (chartInstance) {
    const c = document.getElementById('chartContainer');
    chartInstance.applyOptions({ width: c.clientWidth });
  }
});
