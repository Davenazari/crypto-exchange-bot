// ============================================
// KolonoEX - Telegram Mini App
// Demo Exchange using CoinGecko Free API
// ============================================

const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

// ---- State ----
let state = {
  prices: {},
  portfolio: {
    usdt: 10000,
    holdings: {}
  },
  transactions: [],
  tradeMode: 'buy',
  allCoins: [],
};

// ---- Coin Config ----
const COINS = [
  { id: 'bitcoin',      symbol: 'BTC',  name: 'Bitcoin',       icon: '₿' },
  { id: 'ethereum',     symbol: 'ETH',  name: 'Ethereum',      icon: 'Ξ' },
  { id: 'tether',       symbol: 'USDT', name: 'Tether',        icon: '₮' },
  { id: 'binancecoin',  symbol: 'BNB',  name: 'BNB',           icon: '⬡' },
  { id: 'solana',       symbol: 'SOL',  name: 'Solana',        icon: '◎' },
  { id: 'ripple',       symbol: 'XRP',  name: 'XRP',           icon: '✕' },
  { id: 'cardano',      symbol: 'ADA',  name: 'Cardano',       icon: '₳' },
  { id: 'dogecoin',     symbol: 'DOGE', name: 'Dogecoin',      icon: 'Ð' },
];

const COIN_IDS = COINS.map(c => c.id).join(',');

// ---- Fetch Prices ----
async function fetchPrices() {
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${COIN_IDS}&vs_currencies=usd&include_24hr_change=true`;
    const res = await fetch(url);
    const data = await res.json();
    state.prices = data;
    state.allCoins = COINS;
    renderMarket();
    updatePortfolioValue();
  } catch (err) {
    document.getElementById('coinList').innerHTML = `<p class="empty-state">Failed to fetch prices. Please try again.</p>`;
  }
}

// ---- Render Market ----
function renderMarket(filter = '') {
  const list = document.getElementById('coinList');
  const filtered = state.allCoins.filter(c =>
    c.name.toLowerCase().includes(filter.toLowerCase()) ||
    c.symbol.toLowerCase().includes(filter.toLowerCase())
  );

  if (!filtered.length) {
    list.innerHTML = `<p class="empty-state">No coins found</p>`;
    return;
  }

  list.innerHTML = filtered.map(coin => {
    const priceData = state.prices[coin.id];
    if (!priceData) return '';
    const price = priceData.usd;
    const change = priceData.usd_24h_change?.toFixed(2);
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
          <div class="coin-price">$${formatPrice(price)}</div>
          <div class="coin-change ${isPos ? 'positive' : 'negative'}">
            ${isPos ? '+' : ''}${change}%
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ---- Trade ----
function goToTrade(coinId) {
  switchTab('trade');
  document.getElementById('tradeCoin').value = coinId;
  updateTradeInfo();
}

function updateTradeInfo() {
  const coinId = document.getElementById('tradeCoin').value;
  const amount = parseFloat(document.getElementById('tradeAmount').value) || 0;
  const priceData = state.prices[coinId];

  if (!priceData || !amount) {
    document.getElementById('unitPrice').textContent = '-';
    document.getElementById('receiveAmount').textContent = '-';
    document.getElementById('feeAmount').textContent = '-';
    return;
  }

  const price = priceData.usd;
  const fee = amount * 0.001;
  const net = amount - fee;
  const receive = net / price;
  const coin = COINS.find(c => c.id === coinId);

  document.getElementById('unitPrice').textContent = `$${formatPrice(price)}`;
  document.getElementById('receiveAmount').textContent = `${receive.toFixed(6)} ${coin?.symbol}`;
  document.getElementById('feeAmount').textContent = `$${fee.toFixed(4)}`;
}

function executeTrade() {
  const coinId = document.getElementById('tradeCoin').value;
  const amount = parseFloat(document.getElementById('tradeAmount').value);
  const priceData = state.prices[coinId];
  const coin = COINS.find(c => c.id === coinId);

  if (!amount || amount <= 0) return showToast('Enter a valid amount', 'error');
  if (!priceData) return showToast('Price unavailable', 'error');

  const price = priceData.usd;
  const fee = amount * 0.001;
  const net = amount - fee;
  const coinAmount = net / price;

  if (state.tradeMode === 'buy') {
    if (amount > state.portfolio.usdt) return showToast('Insufficient USDT balance', 'error');
    state.portfolio.usdt -= amount;
    if (!state.portfolio.holdings[coinId]) state.portfolio.holdings[coinId] = { amount: 0, avgPrice: 0 };
    const h = state.portfolio.holdings[coinId];
    const totalCost = h.amount * h.avgPrice + net;
    h.amount += coinAmount;
    h.avgPrice = totalCost / h.amount;
    state.transactions.unshift({ type: 'buy', coin: coin.symbol, coinName: coin.name, amount: coinAmount, usdValue: amount, price, date: new Date() });
    showToast(`Bought ${coinAmount.toFixed(6)} ${coin.symbol}`, 'success');
  } else {
    const holding = state.portfolio.holdings[coinId];
    if (!holding || holding.amount < coinAmount) return showToast('Insufficient asset balance', 'error');
    holding.amount -= coinAmount;
    state.portfolio.usdt += net;
    state.transactions.unshift({ type: 'sell', coin: coin.symbol, coinName: coin.name, amount: coinAmount, usdValue: net, price, date: new Date() });
    showToast(`Sold ${coinAmount.toFixed(6)} ${coin.symbol} for $${net.toFixed(2)}`, 'success');
  }

  document.getElementById('tradeAmount').value = '';
  updateTradeInfo();
  updatePortfolioValue();
  renderWallet();
}

// ---- Wallet ----
function renderWallet() {
  document.getElementById('usdtBalance').textContent = `$${state.portfolio.usdt.toFixed(2)}`;

  const holdingsList = document.getElementById('holdingsList');
  const entries = Object.entries(state.portfolio.holdings).filter(([, h]) => h.amount > 0.000001);

  holdingsList.innerHTML = !entries.length
    ? `<p class="empty-state">No assets yet. Start trading!</p>`
    : entries.map(([coinId, holding]) => {
        const coin = COINS.find(c => c.id === coinId);
        const value = holding.amount * (state.prices[coinId]?.usd || 0);
        return `
          <div class="holding-item">
            <div>
              <div class="holding-name">${coin?.name || coinId}</div>
              <div class="holding-amount">${holding.amount.toFixed(6)} ${coin?.symbol}</div>
            </div>
            <div class="holding-value">$${value.toFixed(2)}</div>
          </div>
        `;
      }).join('');

  const txList = document.getElementById('txList');
  txList.innerHTML = !state.transactions.length
    ? `<p class="empty-state">No transactions yet</p>`
    : state.transactions.slice(0, 20).map(tx => `
        <div class="tx-item">
          <div>
            <span class="tx-type ${tx.type}">${tx.type.toUpperCase()}</span>
            <div class="tx-coin">${tx.coinName}</div>
          </div>
          <div class="tx-amount">
            ${tx.amount.toFixed(6)} ${tx.coin}<br>
            <span style="color:var(--text2);font-size:11px">$${tx.usdValue.toFixed(2)}</span>
          </div>
        </div>
      `).join('');
}

function updatePortfolioValue() {
  let total = state.portfolio.usdt;
  for (const [coinId, h] of Object.entries(state.portfolio.holdings)) {
    total += h.amount * (state.prices[coinId]?.usd || 0);
  }
  document.getElementById('totalPortfolio').textContent = `$${total.toFixed(2)}`;
}

// ---- Tabs ----
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector(`[data-tab="${name}"]`).classList.add('active');
  document.getElementById(`tab-${name}`).classList.add('active');
  if (name === 'wallet') renderWallet();
}

// ---- Helpers ----
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

// ---- Events ----
document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));
document.getElementById('searchInput').addEventListener('input', e => renderMarket(e.target.value));
document.getElementById('tradeCoin').addEventListener('change', updateTradeInfo);
document.getElementById('tradeAmount').addEventListener('input', updateTradeInfo);

document.getElementById('buyBtn').addEventListener('click', () => {
  state.tradeMode = 'buy';
  document.getElementById('buyBtn').className = 'trade-type active';
  document.getElementById('sellBtn').className = 'trade-type';
  document.getElementById('tradeBtn').textContent = 'Place Buy Order';
  document.getElementById('tradeBtn').className = 'trade-btn buy';
});

document.getElementById('sellBtn').addEventListener('click', () => {
  state.tradeMode = 'sell';
  document.getElementById('sellBtn').className = 'trade-type active sell-active';
  document.getElementById('buyBtn').className = 'trade-type';
  document.getElementById('tradeBtn').textContent = 'Place Sell Order';
  document.getElementById('tradeBtn').className = 'trade-btn sell';
});

document.getElementById('tradeBtn').addEventListener('click', executeTrade);
document.querySelectorAll('.quick-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('tradeAmount').value = btn.dataset.amount;
    updateTradeInfo();
  });
});

// ---- Init ----
fetchPrices();
setInterval(fetchPrices, 30000);
