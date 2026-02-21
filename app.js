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
  selectCoin(coinId, 'trade');
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
// Trade amount input
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
initDropdownDisplays();
fetchInitialPrices().then(() => connectWebSocket());

// ============================================
// FUTURES MODULE
// ============================================

// Max leverage per coin
const MAX_LEVERAGE = {
  bitcoin: 125, ethereum: 125,
  binancecoin: 75, solana: 75, ripple: 75,
  cardano: 50, 'avalanche-2': 50, chainlink: 50, polkadot: 50, tron: 50, sui: 50,
  dogecoin: 25, 'shiba-inu': 25, pepe: 25, bonk: 25, dogwifcoin: 25,
  floki: 25, 'cat-in-a-dogs-world': 25, 'brett-based': 25,
};

let futuresMode = 'long'; // 'long' | 'short'
let openPositions = [];
let futuresHistory = [];

// ─── Update leverage slider ───
function updateLeverageUI() {
  const coinId = document.getElementById('futuresCoin').value;
  const maxLev = MAX_LEVERAGE[coinId] || 25;
  const slider = document.getElementById('leverageSlider');
  const current = Math.min(parseInt(slider.value), maxLev);

  slider.max = maxLev;
  slider.value = current;

  // Update gradient fill
  const pct = ((current - 1) / (maxLev - 1)) * 100;
  slider.style.setProperty('--pct', pct + '%');

  document.getElementById('leverageValue').textContent = current + 'x';

  // Update preset buttons - hide any > maxLev
  document.querySelectorAll('.lev-preset').forEach(btn => {
    const lev = parseInt(btn.dataset.lev);
    btn.style.opacity = lev > maxLev ? '0.3' : '1';
    btn.style.pointerEvents = lev > maxLev ? 'none' : 'auto';
    btn.classList.toggle('active', lev === current);
  });

  updateFuturesInfo();
}

function updateFuturesInfo() {
  const coinId = document.getElementById('futuresCoin').value;
  const margin = parseFloat(document.getElementById('futuresMargin').value) || 0;
  const leverage = parseInt(document.getElementById('leverageSlider').value);
  const p = state.prices[coinId];

  if (!p || !margin) {
    ['fEntryPrice','fPositionSize','fLiqPrice','fFee'].forEach(id => document.getElementById(id).textContent = '—');
    return;
  }

  const entryPrice = p.usd;
  const positionSize = margin * leverage;
  const fee = positionSize * 0.0005;
  // Liq price: for long = entry * (1 - 1/leverage * 0.9), for short = entry * (1 + 1/leverage * 0.9)
  const liqPrice = futuresMode === 'long'
    ? entryPrice * (1 - 0.9 / leverage)
    : entryPrice * (1 + 0.9 / leverage);

  const coin = COINS.find(c => c.id === coinId);
  document.getElementById('fEntryPrice').textContent = `$${formatPrice(entryPrice)}`;
  document.getElementById('fPositionSize').textContent = `$${positionSize.toLocaleString('en-US', {maximumFractionDigits:2})}`;
  document.getElementById('fLiqPrice').textContent = `$${formatPrice(liqPrice)}`;
  document.getElementById('fFee').textContent = `$${fee.toFixed(4)}`;
}

function openFuturesPosition() {
  const coinId = document.getElementById('futuresCoin').value;
  const margin = parseFloat(document.getElementById('futuresMargin').value);
  const leverage = parseInt(document.getElementById('leverageSlider').value);
  const p = state.prices[coinId];
  const coin = COINS.find(c => c.id === coinId);

  if (!margin || margin <= 0) return showToast('Enter a margin amount', 'error');
  if (!p) return showToast('Price unavailable', 'error');
  if (margin > state.portfolio.usdt) return showToast('Insufficient USDT balance', 'error');

  const entryPrice = p.usd;
  const positionSize = margin * leverage;
  const fee = positionSize * 0.0005;
  const liqPrice = futuresMode === 'long'
    ? entryPrice * (1 - 0.9 / leverage)
    : entryPrice * (1 + 0.9 / leverage);

  state.portfolio.usdt -= (margin + fee);

  const pos = {
    id: Date.now(),
    coinId, coin, side: futuresMode,
    entryPrice, margin, leverage,
    size: positionSize,
    liqPrice,
    coinAmount: positionSize / entryPrice,
    openedAt: new Date(),
  };

  openPositions.push(pos);

  document.getElementById('futuresMargin').value = '';
  updateFuturesInfo();
  updatePortfolioValue();
  renderPositions();
  showToast(`${futuresMode === 'long' ? '↑ Long' : '↓ Short'} opened: $${positionSize.toLocaleString()} at ${leverage}x`, 'success');
}

function closePosition(posId, reason = 'manual') {
  const idx = openPositions.findIndex(p => p.id === posId);
  if (idx === -1) return;
  const pos = openPositions[idx];
  const currentPrice = state.prices[pos.coinId]?.usd || pos.entryPrice;

  const priceDiff = currentPrice - pos.entryPrice;
  const pnlPct = (priceDiff / pos.entryPrice) * pos.leverage;
  const pnl = pos.margin * (pos.side === 'long' ? pnlPct : -pnlPct);
  const returned = pos.margin + pnl;

  if (returned > 0) state.portfolio.usdt += returned;

  // Save to history
  futuresHistory.unshift({
    ...pos,
    closePrice: currentPrice,
    pnl,
    pnlPct: pnlPct * 100,
    closedAt: new Date(),
    reason,
  });

  openPositions.splice(idx, 1);
  renderPositions();
  updatePortfolioValue();
  showToast(
    reason === 'liquidated'
      ? `Liquidated! Lost $${pos.margin.toFixed(2)}`
      : `Closed. PnL: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`,
    pnl >= 0 && reason !== 'liquidated' ? 'success' : 'error'
  );
}

function formatDateTime(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    + ' ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function renderPositions() {
  const list = document.getElementById('positionsList');
  const countEl = document.getElementById('positionsCount');
  countEl.textContent = `${openPositions.length} active`;

  // Check liquidations first
  openPositions.forEach(pos => {
    const currentPrice = state.prices[pos.coinId]?.usd || pos.entryPrice;
    const isLiquidated = pos.side === 'long' ? currentPrice <= pos.liqPrice : currentPrice >= pos.liqPrice;
    if (isLiquidated) closePosition(pos.id, 'liquidated');
  });

  if (!openPositions.length) {
    list.innerHTML = `<p class="empty-state">No open positions</p>`;
  } else {
    list.innerHTML = openPositions.map(pos => {
      const currentPrice = state.prices[pos.coinId]?.usd || pos.entryPrice;
      const priceDiff = currentPrice - pos.entryPrice;
      const pnlPct = (priceDiff / pos.entryPrice) * pos.leverage;
      const pnl = pos.margin * (pos.side === 'long' ? pnlPct : -pnlPct);
      const pnlClass = pnl >= 0 ? 'profit' : 'loss';

      return `
        <div class="position-card">
          <div class="position-header">
            <div class="position-coin">
              <img src="${pos.coin.img}" style="width:24px;height:24px;border-radius:50%;object-fit:cover" />
              ${pos.coin.symbol}
              <span class="position-lev">${pos.leverage}x</span>
            </div>
            <span class="position-side ${pos.side}">${pos.side === 'long' ? '↑ Long' : '↓ Short'}</span>
          </div>
          <div class="position-pnl ${pnlClass}">${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} <span style="font-size:14px">(${(pnlPct * 100).toFixed(1)}%)</span></div>
          <div class="position-details" style="margin-top:10px">
            <div class="pos-detail">Entry Price<span>$${formatPrice(pos.entryPrice)}</span></div>
            <div class="pos-detail">Current Price<span>$${formatPrice(currentPrice)}</span></div>
            <div class="pos-detail">Margin<span style="color:#ffaa00">$${pos.margin.toFixed(2)}</span></div>
            <div class="pos-detail">Position Size<span>$${pos.size.toLocaleString('en-US',{maximumFractionDigits:0})}</span></div>
            <div class="pos-detail">Liq. Price<span style="color:var(--red)">$${formatPrice(pos.liqPrice)}</span></div>
            <div class="pos-detail">Opened At<span style="font-size:11px">${formatDateTime(pos.openedAt)}</span></div>
          </div>
          <button class="close-pos-btn" onclick="closePosition(${pos.id})">Close Position</button>
        </div>`;
    }).join('');
  }

  // Futures History
  const histEl = document.getElementById('futuresHistoryList');
  if (!histEl) return;
  if (!futuresHistory.length) {
    histEl.innerHTML = `<p class="empty-state">No closed positions yet</p>`;
  } else {
    histEl.innerHTML = futuresHistory.slice(0, 20).map(h => {
      const pnlClass = h.pnl >= 0 ? 'profit' : 'loss';
      const isLiq = h.reason === 'liquidated';
      return `
        <div class="position-card" style="opacity:0.85">
          <div class="position-header">
            <div class="position-coin">
              <img src="${h.coin.img}" style="width:22px;height:22px;border-radius:50%;object-fit:cover" />
              ${h.coin.symbol}
              <span class="position-lev">${h.leverage}x</span>
            </div>
            <div style="display:flex;gap:6px;align-items:center">
              <span class="position-side ${h.side}">${h.side === 'long' ? '↑ Long' : '↓ Short'}</span>
              ${isLiq ? '<span style="font-size:10px;color:var(--red);font-weight:700;background:rgba(255,82,82,0.1);padding:2px 8px;border-radius:999px;border:1px solid rgba(255,82,82,0.3)">LIQ</span>' : ''}
            </div>
          </div>
          <div class="position-pnl ${pnlClass}" style="font-size:18px">${h.pnl >= 0 ? '+' : ''}$${h.pnl.toFixed(2)} <span style="font-size:13px">(${h.pnlPct.toFixed(1)}%)</span></div>
          <div class="position-details" style="margin-top:8px">
            <div class="pos-detail">Entry<span>$${formatPrice(h.entryPrice)}</span></div>
            <div class="pos-detail">Close<span>$${formatPrice(h.closePrice)}</span></div>
            <div class="pos-detail">Margin<span style="color:#ffaa00">$${h.margin.toFixed(2)}</span></div>
            <div class="pos-detail">Size<span>$${h.size.toLocaleString('en-US',{maximumFractionDigits:0})}</span></div>
            <div class="pos-detail">Opened<span style="font-size:11px">${formatDateTime(h.openedAt)}</span></div>
            <div class="pos-detail">Closed<span style="font-size:11px">${formatDateTime(h.closedAt)}</span></div>
          </div>
        </div>`;
    }).join('');
  }
}

// ─── Custom Coin Dropdown ───
const FUTURES_COINS = COINS.filter(c => c.id !== 'tether');
const MAJOR_IDS = ['bitcoin','ethereum','binancecoin','solana','ripple','cardano','avalanche-2','chainlink','polkadot','tron','sui'];
const MEME_IDS  = ['dogecoin','shiba-inu','pepe','bonk','dogwifcoin','floki','cat-in-a-dogs-world','brett-based'];

let dropdownOpen = false;
let tradeDropdownOpen = false;

// ── Build a dropdown list HTML ──
function buildDropdownHTML(coins, selectedId, showLev = false) {
  const renderGroup = (ids, label) => {
    const group = coins.filter(c => ids.includes(c.id));
    if (!group.length) return '';
    return `<div class="coin-dropdown-divider">${label}</div>` +
      group.map(coin => {
        const p = state.prices[coin.id];
        const price = p ? `$${formatPrice(p.usd)}` : '—';
        const change = p?.usd_24h_change?.toFixed(2);
        const isPos = change >= 0;
        const maxLev = MAX_LEVERAGE[coin.id] || 25;
        return `
          <div class="coin-dropdown-option ${coin.id === selectedId ? 'selected' : ''}" onclick="selectCoin('${coin.id}','${showLev ? 'futures' : 'trade'}')">
            <div class="opt-left">
              <img src="${coin.img}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:1px solid rgba(255,255,255,0.1)" />
              <div>
                <div class="opt-name">${coin.name}</div>
                <div class="opt-sym">${coin.symbol}</div>
              </div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
              <span class="opt-price">${price}</span>
              ${showLev
                ? `<span class="opt-lev">max ${maxLev}x</span>`
                : `<span class="coin-change ${isPos ? 'positive' : 'negative'}" style="font-size:11px">${isPos ? '+' : ''}${change}%</span>`
              }
            </div>
          </div>`;
      }).join('');
  };

  const majorGroup = renderGroup(MAJOR_IDS, '🔵 Major');
  const memeGroup  = renderGroup(MEME_IDS,  '🐸 Meme');
  // For trade page, also show tether in majors if not futures
  const tetherGroup = !showLev ? renderGroup(['tether'], '💵 Stable') : '';
  return majorGroup + tetherGroup + memeGroup;
}

function selectCoin(coinId, mode) {
  const coin = COINS.find(c => c.id === coinId);
  if (mode === 'futures') {
    document.getElementById('futuresCoin').value = coinId;
    document.getElementById('futuresCoinImg').src = coin.img;
    document.getElementById('futuresCoinName').textContent = coin.name;
    document.getElementById('futuresCoinSym').textContent = coin.symbol;
    if (dropdownOpen) toggleCoinDropdown();
    updateLeverageUI();
  } else {
    document.getElementById('tradeCoin').value = coinId;
    document.getElementById('tradeCoinImg').src = coin.img;
    document.getElementById('tradeCoinName').textContent = coin.name;
    document.getElementById('tradeCoinSym').textContent = coin.symbol;
    if (tradeDropdownOpen) toggleTradeDropdown();
    updateTradeInfo();
  }
}

function toggleCoinDropdown() {
  dropdownOpen = !dropdownOpen;
  const listEl = document.getElementById('coinDropdownList');
  const arrow  = document.getElementById('dropdownArrow');
  const sel    = document.getElementById('futuresCoinSelected');
  if (dropdownOpen) {
    listEl.innerHTML = buildDropdownHTML(FUTURES_COINS, document.getElementById('futuresCoin').value, true);
    listEl.style.display = 'block';
    arrow.classList.add('open');
    sel.classList.add('open');
  } else {
    listEl.style.display = 'none';
    arrow.classList.remove('open');
    sel.classList.remove('open');
  }
}

function toggleTradeDropdown() {
  tradeDropdownOpen = !tradeDropdownOpen;
  const listEl = document.getElementById('tradeDropdownList');
  const arrow  = document.getElementById('tradeDropdownArrow');
  const sel    = document.getElementById('tradeCoinSelected');
  if (tradeDropdownOpen) {
    listEl.innerHTML = buildDropdownHTML(COINS, document.getElementById('tradeCoin').value, false);
    listEl.style.display = 'block';
    arrow.classList.add('open');
    sel.classList.add('open');
  } else {
    listEl.style.display = 'none';
    arrow.classList.remove('open');
    sel.classList.remove('open');
  }
}

// Close both dropdowns when clicking outside
document.addEventListener('click', e => {
  if (dropdownOpen && !document.getElementById('futuresCoinDropdown')?.contains(e.target)) toggleCoinDropdown();
  if (tradeDropdownOpen && !document.getElementById('tradeCoinDropdown')?.contains(e.target)) toggleTradeDropdown();
});

// Init dropdown displays after prices load
function initDropdownDisplays() {
  const btc = COINS[0];
  ['futuresCoinImg','tradeCoinImg'].forEach(id => { const el = document.getElementById(id); if(el) el.src = btc.img; });
  ['futuresCoinName','tradeCoinName'].forEach(id => { const el = document.getElementById(id); if(el) el.textContent = btc.name; });
  ['futuresCoinSym','tradeCoinSym'].forEach(id => { const el = document.getElementById(id); if(el) el.textContent = btc.symbol; });
}

// ─── Futures Event Listeners ───
document.getElementById('longBtn').addEventListener('click', () => {
  futuresMode = 'long';
  document.getElementById('longBtn').className = 'toggle-btn buy-active';
  document.getElementById('shortBtn').className = 'toggle-btn';
  document.getElementById('futuresBtn').textContent = 'Open Long Position';
  document.getElementById('futuresBtn').className = 'cta-btn buy-cta';
  updateFuturesInfo();
});

document.getElementById('shortBtn').addEventListener('click', () => {
  futuresMode = 'short';
  document.getElementById('shortBtn').className = 'toggle-btn sell-active';
  document.getElementById('longBtn').className = 'toggle-btn';
  document.getElementById('futuresBtn').textContent = 'Open Short Position';
  document.getElementById('futuresBtn').className = 'cta-btn sell-cta';
  updateFuturesInfo();
});

document.getElementById('futuresCoin').addEventListener('change', updateLeverageUI);
document.getElementById('futuresMargin').addEventListener('input', updateFuturesInfo);
document.getElementById('futuresBtn').addEventListener('click', openFuturesPosition);

document.getElementById('leverageSlider').addEventListener('input', () => {
  const slider = document.getElementById('leverageSlider');
  const maxLev = parseInt(slider.max);
  const val = parseInt(slider.value);
  const pct = ((val - 1) / (maxLev - 1)) * 100;
  slider.style.setProperty('--pct', pct + '%');
  document.getElementById('leverageValue').textContent = val + 'x';
  document.querySelectorAll('.lev-preset').forEach(b => b.classList.toggle('active', parseInt(b.dataset.lev) === val));
  updateFuturesInfo();
});

document.querySelectorAll('.lev-preset').forEach(btn => {
  btn.addEventListener('click', () => {
    const lev = parseInt(btn.dataset.lev);
    const slider = document.getElementById('leverageSlider');
    const maxLev = parseInt(slider.max);
    if (lev > maxLev) return;
    slider.value = lev;
    const pct = ((lev - 1) / (maxLev - 1)) * 100;
    slider.style.setProperty('--pct', pct + '%');
    document.getElementById('leverageValue').textContent = lev + 'x';
    document.querySelectorAll('.lev-preset').forEach(b => b.classList.toggle('active', parseInt(b.dataset.lev) === lev));
    updateFuturesInfo();
  });
});

document.querySelectorAll('[data-famt]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('futuresMargin').value = btn.dataset.famt;
    updateFuturesInfo();
  });
});

// Update open positions PnL every second
setInterval(() => {
  if (openPositions.length > 0) renderPositions();
}, 1000);
