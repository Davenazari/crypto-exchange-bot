// ============================================
// KolonoEX — Liquid Glass Edition
// ============================================

const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

// ─── State ───
let state = {
  prices: {},
  portfolio: { usdt: 10000, holdings: {} },
  transactions: [],
  tradeMode: 'buy',
  allCoins: [],
};

const COINS = [
  // ── Major coins ──
  { id: 'bitcoin',          symbol: 'BTC',   name: 'Bitcoin',        icon: '₿', img: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png' },
  { id: 'ethereum',         symbol: 'ETH',   name: 'Ethereum',       icon: 'Ξ', img: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png' },
  { id: 'tether',           symbol: 'USDT',  name: 'Tether',         icon: '₮', img: 'https://assets.coingecko.com/coins/images/325/small/Tether.png' },
  { id: 'binancecoin',      symbol: 'BNB',   name: 'BNB',            icon: '⬡', img: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png' },
  { id: 'solana',           symbol: 'SOL',   name: 'Solana',         icon: '◎', img: 'https://assets.coingecko.com/coins/images/4128/small/solana.png' },
  { id: 'ripple',           symbol: 'XRP',   name: 'XRP',            icon: '✕', img: 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png' },
  { id: 'cardano',          symbol: 'ADA',   name: 'Cardano',        icon: '₳', img: 'https://assets.coingecko.com/coins/images/975/small/cardano.png' },
  { id: 'avalanche-2',      symbol: 'AVAX',  name: 'Avalanche',      icon: '🔺', img: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png' },
  { id: 'chainlink',        symbol: 'LINK',  name: 'Chainlink',      icon: '⬡', img: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png' },
  { id: 'polkadot',         symbol: 'DOT',   name: 'Polkadot',       icon: '●', img: 'https://assets.coingecko.com/coins/images/12171/small/polkadot.png' },
  { id: 'tron',             symbol: 'TRX',   name: 'TRON',           icon: '◈', img: 'https://assets.coingecko.com/coins/images/1094/small/tron-logo.png' },
  { id: 'sui',              symbol: 'SUI',   name: 'Sui',            icon: '💧', img: 'https://assets.coingecko.com/coins/images/26375/small/sui_asset.jpeg' },
  // ── Memecoins ──
  { id: 'dogecoin',         symbol: 'DOGE',  name: 'Dogecoin',       icon: 'Ð', img: 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png' },
  { id: 'shiba-inu',        symbol: 'SHIB',  name: 'Shiba Inu',      icon: '🐕', img: 'https://assets.coingecko.com/coins/images/11939/small/shiba.png' },
  { id: 'pepe',             symbol: 'PEPE',  name: 'Pepe',           icon: '🐸', img: 'https://assets.coingecko.com/coins/images/29850/small/pepe-token.jpeg' },
  { id: 'bonk',             symbol: 'BONK',  name: 'Bonk',           icon: '🔨', img: 'https://assets.coingecko.com/coins/images/28600/small/bonk.jpg' },
  { id: 'dogwifcoin',       symbol: 'WIF',   name: 'dogwifhat',      icon: '🎩', img: 'https://assets.coingecko.com/coins/images/33566/small/dogwifhat.jpg' },
  { id: 'floki',            symbol: 'FLOKI', name: 'FLOKI',          icon: '⚡', img: 'https://assets.coingecko.com/coins/images/16746/small/PNG_image.png' },
  { id: 'cat-in-a-dogs-world', symbol: 'MEW', name: 'cat in a dogs world', icon: '🐱', img: 'https://assets.coingecko.com/coins/images/36440/small/MEW.png' },
  { id: 'brett-based',      symbol: 'BRETT', name: 'Brett',          icon: '🟦', img: 'https://assets.coingecko.com/coins/images/35529/small/Brett.png' },
];

const COIN_IDS = COINS.map(c => c.id).join(',');

// Binance WebSocket symbol mapping
const BINANCE_WS_SYMBOL = {
  bitcoin:               'btcusdt',
  ethereum:              'ethusdt',
  tether:                null,
  binancecoin:           'bnbusdt',
  solana:                'solusdt',
  ripple:                'xrpusdt',
  cardano:               'adausdt',
  'avalanche-2':         'avaxusdt',
  chainlink:             'linkusdt',
  polkadot:              'dotusdt',
  tron:                  'trxusdt',
  sui:                   'suiusdt',
  dogecoin:              'dogeusdt',
  'shiba-inu':           'shibusdt',
  pepe:                  'pepeusdt',
  bonk:                  'bonkusdt',
  dogwifcoin:            'wifusdt',
  floki:                 'flokiusdt',
  'cat-in-a-dogs-world': 'mewusdt',
  'brett-based':         null, // not on Binance, will use CoinGecko fallback
};

// ─── Init prices from Binance REST (fast, no rate limit) ───
async function fetchInitialPrices() {
  try {
    const symbols = COINS
      .filter(c => BINANCE_WS_SYMBOL[c.id])
      .map(c => `"${BINANCE_WS_SYMBOL[c.id].toUpperCase()}"`);
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=[${symbols.join(',')}]`);
    const data = await res.json();

    // Tether is always $1
    state.prices['tether'] = { usd: 1, usd_24h_change: 0 };

    for (const ticker of data) {
      const coin = COINS.find(c =>
        BINANCE_WS_SYMBOL[c.id] === ticker.symbol.toLowerCase()
      );
      if (coin) {
        state.prices[coin.id] = {
          usd: parseFloat(ticker.lastPrice),
          usd_24h_change: parseFloat(ticker.priceChangePercent),
        };
      }
    }

    state.allCoins = COINS;
    renderMarket();
    renderMiniList();
    updatePortfolioValue();
  } catch {
    // fallback to CoinGecko if Binance fails
    try {
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${COIN_IDS}&vs_currencies=usd&include_24hr_change=true`);
      const data = await res.json();
      state.prices = data;
      state.allCoins = COINS;
      renderMarket();
      renderMiniList();
      updatePortfolioValue();
    } catch { /* silent */ }
  }
}

// ─── Binance WebSocket for real-time updates ───
let ws = null;

function connectWebSocket() {
  const streams = COINS
    .filter(c => BINANCE_WS_SYMBOL[c.id])
    .map(c => `${BINANCE_WS_SYMBOL[c.id]}@ticker`)
    .join('/');

  ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (!msg.data) return;
    const d = msg.data;
    const coin = COINS.find(c => BINANCE_WS_SYMBOL[c.id] === d.s.toLowerCase());
    if (!coin) return;

    const newPrice = parseFloat(d.c);
    const oldPrice = state.prices[coin.id]?.usd;

    state.prices[coin.id] = {
      usd: newPrice,
      usd_24h_change: parseFloat(d.P),
    };

    // Update UI elements in-place (no full re-render — smooth & fast)
    updateCoinPriceInDOM(coin.id, newPrice, oldPrice, parseFloat(d.P));
    updatePortfolioValue();
    updateTradeInfoIfVisible(coin.id);
  };

  ws.onclose = () => {
    // Reconnect after 3s if connection drops
    setTimeout(connectWebSocket, 3000);
  };

  ws.onerror = () => ws.close();
}

function updateCoinPriceInDOM(coinId, newPrice, oldPrice, change) {
  // Update all coin-item elements showing this coin
  document.querySelectorAll(`[data-coin-id="${coinId}"]`).forEach(el => {
    const priceEl = el.querySelector('.coin-price');
    const changeEl = el.querySelector('.coin-change');
    if (priceEl) {
      // Flash green/red on price change
      const isUp = !oldPrice || newPrice >= oldPrice;
      priceEl.textContent = `$${formatPrice(newPrice)}`;
      priceEl.classList.remove('flash-up', 'flash-down');
      void priceEl.offsetWidth; // force reflow
      priceEl.classList.add(isUp ? 'flash-up' : 'flash-down');
    }
    if (changeEl) {
      const isPos = change >= 0;
      changeEl.textContent = `${isPos ? '+' : ''}${change.toFixed(2)}%`;
      changeEl.className = `coin-change ${isPos ? 'positive' : 'negative'}`;
    }
  });

  // Update chart header if this coin is open
  if (coinId === currentChartCoin) {
    document.getElementById('chartPrice').textContent = `$${formatPrice(newPrice)}`;
    const badge = document.getElementById('chartChange');
    badge.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
    badge.className = `chart-change-badge ${change >= 0 ? 'positive' : 'negative'}`;
  }
}

function updateTradeInfoIfVisible(coinId) {
  const tradePage = document.getElementById('page-trade');
  if (tradePage?.classList.contains('active')) {
    const selected = document.getElementById('tradeCoin')?.value;
    if (selected === coinId) updateTradeInfo();
  }
}

// ─── Coin Item HTML ───
function coinItemHTML(coin, onclick) {
  const p = state.prices[coin.id];
  if (!p) return '';
  const change = p.usd_24h_change?.toFixed(2);
  const isPos = change >= 0;
  return `
    <div class="coin-item" data-coin-id="${coin.id}" onclick="${onclick}('${coin.id}')">
      <div class="coin-left">
        <div class="coin-icon">
          <img src="${coin.img}" alt="${coin.symbol}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
          <span class="coin-icon-fallback" style="display:none">${coin.icon}</span>
        </div>
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

// ─── Render Market (click → chart) ───
function renderMarket(filter = '') {
  const list = document.getElementById('coinList');
  if (!list) return;
  const filtered = state.allCoins.filter(c =>
    c.name.toLowerCase().includes(filter.toLowerCase()) ||
    c.symbol.toLowerCase().includes(filter.toLowerCase())
  );
  if (!filtered.length) { list.innerHTML = `<p class="empty-state">No results</p>`; return; }
  list.innerHTML = filtered.map(c => coinItemHTML(c, 'openChart')).join('');
}

// ─── Render Home Mini List (click → chart) ───
function renderMiniList() {
  const list = document.getElementById('miniCoinList');
  if (!list) return;
  list.innerHTML = state.allCoins.slice(0, 4).map(c => coinItemHTML(c, 'openChart')).join('');
}

// ─── Chart Module (TradingView Widget) ───
let currentChartCoin = null;
let currentTf = 5;
let chartSourcePage = 'market';

const TF_INTERVAL = { 5: '5', 15: '15', 30: '30', 60: '60' };

// CoinGecko id → TradingView symbol
const TV_SYMBOL = {
  bitcoin:               'BINANCE:BTCUSDT',
  ethereum:              'BINANCE:ETHUSDT',
  tether:                'BINANCE:USDTBUSD',
  binancecoin:           'BINANCE:BNBUSDT',
  solana:                'BINANCE:SOLUSDT',
  ripple:                'BINANCE:XRPUSDT',
  cardano:               'BINANCE:ADAUSDT',
  'avalanche-2':         'BINANCE:AVAXUSDT',
  chainlink:             'BINANCE:LINKUSDT',
  polkadot:              'BINANCE:DOTUSDT',
  tron:                  'BINANCE:TRXUSDT',
  sui:                   'BINANCE:SUIUSDT',
  dogecoin:              'BINANCE:DOGEUSDT',
  'shiba-inu':           'BINANCE:SHIBUSDT',
  pepe:                  'BINANCE:PEPEUSDT',
  bonk:                  'BINANCE:BONKUSDT',
  dogwifcoin:            'BINANCE:WIFUSDT',
  floki:                 'BINANCE:FLOKIUSDT',
  'cat-in-a-dogs-world': 'BYBIT:MEWUSDT',
  'brett-based':         'BYBIT:BRETTUSDT',
};

async function openChart(coinId) {
  currentChartCoin = coinId;
  const active = document.querySelector('.page.active');
  chartSourcePage = active ? active.id.replace('page-', '') : 'market';

  const coin = COINS.find(c => c.id === coinId);
  const p = state.prices[coinId];

  const chartIconEl = document.getElementById('chartIcon');
  chartIconEl.innerHTML = `<img src="${coin.img}" alt="${coin.symbol}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;" onerror="this.outerHTML='${coin.icon}'" />`;
  document.getElementById('chartName').textContent = coin.name;
  document.getElementById('chartPrice').textContent = p ? `$${formatPrice(p.usd)}` : '—';

  const change = p?.usd_24h_change?.toFixed(2);
  const badge = document.getElementById('chartChange');
  badge.textContent = change !== undefined ? `${Number(change) >= 0 ? '+' : ''}${change}%` : '—';
  badge.className = `chart-change-badge ${Number(change) >= 0 ? 'positive' : 'negative'}`;

  document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.tf-btn[data-tf="${currentTf}"]`)?.classList.add('active');

  switchPage('chart');
  renderTVWidget(coinId, currentTf);
}

function renderTVWidget(coinId, tf) {
  const container = document.getElementById('tvWidgetContainer');
  const symbol = TV_SYMBOL[coinId] || 'BINANCE:BTCUSDT';
  const interval = TF_INTERVAL[tf] || '5';

  container.innerHTML = `
    <iframe
      src="https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(symbol)}&interval=${interval}&theme=dark&style=1&locale=en&hide_top_toolbar=0&hide_legend=0&hide_side_toolbar=1&allow_symbol_change=0&save_image=0&backgroundColor=rgba(13,13,30,0)&gridColor=rgba(255,255,255,0.05)"
      style="width:100%;height:320px;border:none;display:block;"
      allowtransparency="true"
      frameborder="0"
      scrolling="no">
    </iframe>`;
}

function goToTradeFromChart(mode) {
  if (!currentChartCoin) return;
  switchPage('trade');
  document.getElementById('tradeCoin').value = currentChartCoin;
  if (mode === 'sell') document.getElementById('sellBtn').click();
  else document.getElementById('buyBtn').click();
  updateTradeInfo();
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
    h.avgPrice = (h.amount * h.avgPrice + net) / (h.amount + coinAmount);
    h.amount += coinAmount;
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
  // Don't highlight any nav btn for chart page (it's a sub-page)
  if (name !== 'chart') {
    document.querySelector(`[data-page="${name}"]`)?.classList.add('active');
  }
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

// ─── Event Listeners ───

// Bottom nav
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => switchPage(btn.dataset.page));
});

// Chart back button
document.getElementById('chartBackBtn').addEventListener('click', () => {
  switchPage(chartSourcePage);
});

// Timeframe buttons
document.querySelectorAll('.tf-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTf = parseInt(btn.dataset.tf);
    if (currentChartCoin) renderTVWidget(currentChartCoin, currentTf);
  });
});

// Search
document.getElementById('searchInput').addEventListener('input', e => renderMarket(e.target.value));

// Trade
document.getElementById('tradeCoin').addEventListener('change', updateTradeInfo);
document.getElementById('tradeAmount').addEventListener('input', updateTradeInfo);

document.getElementById('buyBtn').addEventListener('click', () => {
  state.tradeMode = 'buy';
  document.getElementById('buyBtn').className = 'toggle-btn buy-active';
  document.getElementById('sellBtn').className = 'toggle-btn';
  document.getElementById('tradeBtn').textContent = 'Place Buy Order';
  document.getElementById('tradeBtn').className = 'cta-btn buy-cta';
});

document.getElementById('sellBtn').addEventListener('click', () => {
  state.tradeMode = 'sell';
  document.getElementById('sellBtn').className = 'toggle-btn sell-active';
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
fetchInitialPrices().then(() => connectWebSocket());
