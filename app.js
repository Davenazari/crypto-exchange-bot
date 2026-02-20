// ============================================
// CryptoX - Telegram Mini App
// Demo Exchange using CoinGecko Free API
// ============================================

// Telegram WebApp init
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

// ---- State ----
let state = {
  prices: {},
  portfolio: {
    usdt: 10000,
    holdings: {} // { bitcoin: { amount: 0.5, avgPrice: 40000 } }
  },
  transactions: [],
  tradeMode: 'buy', // 'buy' or 'sell'
  allCoins: [],
};

// ---- Coin Config ----
const COINS = [
  { id: 'bitcoin',      symbol: 'BTC', name: 'بیت‌کوین',      icon: '₿' },
  { id: 'ethereum',     symbol: 'ETH', name: 'اتریوم',         icon: 'Ξ' },
  { id: 'tether',       symbol: 'USDT', name: 'تتر',           icon: '₮' },
  { id: 'binancecoin',  symbol: 'BNB', name: 'بایننس کوین',    icon: '⬡' },
  { id: 'solana',       symbol: 'SOL', name: 'سولانا',          icon: '◎' },
  { id: 'ripple',       symbol: 'XRP', name: 'ریپل',           icon: '✕' },
  { id: 'cardano',      symbol: 'ADA', name: 'کاردانو',        icon: '₳' },
  { id: 'dogecoin',     symbol: 'DOGE', name: 'دوج‌کوین',      icon: 'Ð' },
];

const COIN_IDS = COINS.map(c => c.id).join(',');

// ---- API ----
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
    document.getElementById('coinList').innerHTML = `<p class="empty-state">خطا در دریافت قیمت‌ها. دوباره تلاش کن.</p>`;
  }
}

// ---- Render Market ----
function renderMarket(filter = '') {
  const list = document.getElementById('coinList');
  const filtered = state.allCoins.filter(c =>
    c.name.includes(filter) || c.symbol.toLowerCase().includes(filter.toLowerCase()) || c.id.includes(filter.toLowerCase())
  );

  if (!filtered.length) {
    list.innerHTML = `<p class="empty-state">ارزی یافت نشد</p>`;
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

// ---- Trade Tab ----
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
  document.getElementById('receiveAmount').textContent = `${receive.toFixed(6)} ${coin?.symbol || ''}`;
  document.getElementById('feeAmount').textContent = `$${fee.toFixed(4)}`;
}

function executeTrade() {
  const coinId = document.getElementById('tradeCoin').value;
  const amount = parseFloat(document.getElementById('tradeAmount').value);
  const priceData = state.prices[coinId];
  const coin = COINS.find(c => c.id === coinId);

  if (!amount || amount <= 0) return showToast('مقدار را وارد کن', 'error');
  if (!priceData) return showToast('قیمت در دسترس نیست', 'error');

  const price = priceData.usd;
  const fee = amount * 0.001;
  const net = amount - fee;
  const coinAmount = net / price;

  if (state.tradeMode === 'buy') {
    if (amount > state.portfolio.usdt) return showToast('موجودی کافی نیست', 'error');

    state.portfolio.usdt -= amount;
    if (!state.portfolio.holdings[coinId]) {
      state.portfolio.holdings[coinId] = { amount: 0, avgPrice: 0 };
    }
    const h = state.portfolio.holdings[coinId];
    const totalCost = h.amount * h.avgPrice + net;
    h.amount += coinAmount;
    h.avgPrice = totalCost / h.amount;

    state.transactions.unshift({
      type: 'buy', coin: coin.symbol, coinName: coin.name,
      amount: coinAmount, usdValue: amount, price, date: new Date()
    });
    showToast(`خرید موفق! ${coinAmount.toFixed(6)} ${coin.symbol}`, 'success');

  } else {
    const holding = state.portfolio.holdings[coinId];
    if (!holding || holding.amount < coinAmount) return showToast('دارایی کافی نیست', 'error');

    holding.amount -= coinAmount;
    state.portfolio.usdt += net;

    state.transactions.unshift({
      type: 'sell', coin: coin.symbol, coinName: coin.name,
      amount: coinAmount, usdValue: net, price, date: new Date()
    });
    showToast(`فروش موفق! +$${net.toFixed(2)}`, 'success');
  }

  document.getElementById('tradeAmount').value = '';
  updateTradeInfo();
  updatePortfolioValue();
  renderWallet();
}

// ---- Wallet ----
function renderWallet() {
  document.getElementById('usdtBalance').textContent = `$${state.portfolio.usdt.toFixed(2)}`;

  // Holdings
  const holdingsList = document.getElementById('holdingsList');
  const entries = Object.entries(state.portfolio.holdings).filter(([, h]) => h.amount > 0.000001);

  if (!entries.length) {
    holdingsList.innerHTML = `<p class="empty-state">هنوز هیچ ارزی خریداری نشده</p>`;
  } else {
    holdingsList.innerHTML = entries.map(([coinId, holding]) => {
      const coin = COINS.find(c => c.id === coinId);
      const currentPrice = state.prices[coinId]?.usd || 0;
      const value = holding.amount * currentPrice;
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
  }

  // Transactions
  const txList = document.getElementById('txList');
  if (!state.transactions.length) {
    txList.innerHTML = `<p class="empty-state">تراکنشی وجود ندارد</p>`;
  } else {
    txList.innerHTML = state.transactions.slice(0, 20).map(tx => `
      <div class="tx-item">
        <div>
          <span class="tx-type ${tx.type}">${tx.type === 'buy' ? 'خرید' : 'فروش'}</span>
          <div class="tx-coin">${tx.coinName}</div>
        </div>
        <div class="tx-amount">
          ${tx.amount.toFixed(6)} ${tx.coin}<br>
          <span style="color: var(--text2); font-size:11px">$${tx.usdValue.toFixed(2)}</span>
        </div>
      </div>
    `).join('');
  }
}

function updatePortfolioValue() {
  let total = state.portfolio.usdt;
  for (const [coinId, holding] of Object.entries(state.portfolio.holdings)) {
    const price = state.prices[coinId]?.usd || 0;
    total += holding.amount * price;
  }
  document.getElementById('totalPortfolio').textContent = `$${total.toFixed(2)}`;
}

// ---- Tab Switching ----
function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`tab-${tabName}`).classList.add('active');

  if (tabName === 'wallet') renderWallet();
}

// ---- Helpers ----
function formatPrice(price) {
  if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(6);
}

function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast show ${type}`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ---- Event Listeners ----
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

document.getElementById('searchInput').addEventListener('input', e => {
  renderMarket(e.target.value);
});

document.getElementById('tradeCoin').addEventListener('change', updateTradeInfo);
document.getElementById('tradeAmount').addEventListener('input', updateTradeInfo);

document.getElementById('buyBtn').addEventListener('click', () => {
  state.tradeMode = 'buy';
  document.getElementById('buyBtn').classList.add('active');
  document.getElementById('sellBtn').classList.remove('active');
  document.getElementById('buyBtn').classList.remove('sell-active');
  document.getElementById('tradeBtn').textContent = 'ثبت سفارش خرید';
  document.getElementById('tradeBtn').className = 'trade-btn buy';
});

document.getElementById('sellBtn').addEventListener('click', () => {
  state.tradeMode = 'sell';
  document.getElementById('sellBtn').classList.add('active');
  document.getElementById('sellBtn').classList.add('sell-active');
  document.getElementById('buyBtn').classList.remove('active');
  document.getElementById('tradeBtn').textContent = 'ثبت سفارش فروش';
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
// Refresh prices every 30 seconds
setInterval(fetchPrices, 30000);
