// ============================================================
// グローバル変数
// ============================================================
var allMenuItems = [];
var cart = [];
var currentCategory = "ALL";
var tableId = "";
var historyCache = null;
var tasteChartInstance = null;
var currentOptionItem = null;
var myTasteCache = null;
var totalOrderCount = 0;
var currentScreen = "menu";


// レベル定義
var LEVELS = [
  { lv: 1, name: "ビギナー", icon: "🌱", req: 1, reqLabel: "初回注文", sommelier: "基本モード", shopBenefit: "—", color: "#9ca3af", bg: "#f9fafb" },
  { lv: 2, name: "レギュラー", icon: "⭐", req: 5, reqLabel: "5オーダー", sommelier: "相談：質問+1", shopBenefit: "店舗特典あり", color: "#3b82f6", bg: "#eff6ff" },
  { lv: 3, name: "エキスパート", icon: "💎", req: 15, reqLabel: "15オーダー", sommelier: "相談：質問+2", shopBenefit: "店舗特典あり", color: "#8b5cf6", bg: "#f5f3ff" },
  { lv: 4, name: "マスター", icon: "👑", req: 30, reqLabel: "30オーダー", sommelier: "相談：フル解放", shopBenefit: "店舗特典あり", color: "#f59e0b", bg: "#fffbeb" },
  { lv: 5, name: "レジェンド", icon: "🏆", req: 50, reqLabel: "50オーダー", sommelier: "全機能解放", shopBenefit: "店舗特典あり", color: "#ef4444", bg: "#fef2f2" }
];

function getLevel(orders) {
  for (var i = LEVELS.length - 1; i >= 0; i--) {
    if (orders >= LEVELS[i].req) return LEVELS[i];
  }
  return LEVELS[0];
}

function getNextLevel(orders) {
  for (var i = 0; i < LEVELS.length; i++) {
    if (orders < LEVELS[i].req) return LEVELS[i];
  }
  return null;
}

// ============================================================
// 画面切り替え
// ============================================================
function switchScreen(screen) {
  currentScreen = screen;
  document.querySelectorAll(".screen").forEach(function(el) {
    el.classList.remove("active");
  });
  document.getElementById("screen-" + screen).classList.add("active");

  document.querySelectorAll(".footer-tab").forEach(function(tab) {
    tab.classList.remove("active");
    if (tab.getAttribute("data-screen") === screen) {
      tab.classList.add("active");
    }
  });

  if (screen === "taste") {
    renderMyTaste();
  }

  window.scrollTo({ top: 0 });
}

// ============================================================
// モーダル制御
// ============================================================
function openModal(id) {
  document.getElementById(id).classList.add("show");
}

function closeModal(id) {
  document.getElementById(id).classList.remove("show");
}

// ============================================================
// トースト
// ============================================================
function showToast(msg) {
  var el = document.createElement("div");
  el.className = "toast-msg";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(function() { el.classList.add("out"); }, 1800);
  setTimeout(function() { el.remove(); }, 2200);
}

// ============================================================
// 初期化
// ============================================================
function initializeLiff() {
  var cached = localStorage.getItem("MO_MENU_CACHE");
  if (cached) {
    try {
      allMenuItems = JSON.parse(cached);
      buildCategoryTabs();
      renderMenu();
      document.getElementById("menu-skeleton").style.display = "none";
      document.getElementById("menu-items").style.display = "grid";
    } catch (e) {}
  }

  liff.init({ liffId: MY_LIFF_ID }).then(function() {
    if (!liff.isLoggedIn()) {
      liff.login();
      return;
    }
    liff.getProfile().then(function(p) {
      fetchInitData(p.userId, p.displayName);
      checkTableId();
    });
  }).catch(function(err) {
    console.error("LIFF init error:", err);
    fetchInitData("", "ゲスト");
    checkTableId();
  });
}

function fetchInitData(userId, displayName) {
  var url = GAS_API_URL + "?action=getInitData&userId=" + encodeURIComponent(userId);
  fetch(url)
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.menu) {
        allMenuItems = d.menu;
        localStorage.setItem("MO_MENU_CACHE", JSON.stringify(d.menu));
        buildCategoryTabs();
        renderMenu();
      }
      document.getElementById("menu-skeleton").style.display = "none";
      document.getElementById("menu-items").style.display = "grid";
      document.getElementById("loading-overlay").style.display = "none";

      if (d.profile && d.profile.orderCount) {
        totalOrderCount = d.profile.orderCount;
      }
    })
    .catch(function(err) {
      console.error("fetchInitData error:", err);
      document.getElementById("menu-skeleton").style.display = "none";
      document.getElementById("menu-items").style.display = "grid";
      document.getElementById("loading-overlay").style.display = "none";
    });

  setTimeout(function() {
    var sk = document.getElementById("menu-skeleton");
    if (sk && sk.style.display !== "none") {
      sk.style.display = "none";
      document.getElementById("menu-items").style.display = "grid";
      document.getElementById("loading-overlay").style.display = "none";
    }
  }, 10000);
}

function checkTableId() {
  var params = new URLSearchParams(window.location.search);
  if (params.get("table")) {
    tableId = params.get("table");
    localStorage.setItem("MO_TABLE", tableId);
  } else if (localStorage.getItem("MO_TABLE")) {
    tableId = localStorage.getItem("MO_TABLE");
  } else {
    openModal("tableModal");
  }
}

function setTable() {
  var val = document.getElementById("table-input").value.trim();
  if (!val) return;
  tableId = val;
  localStorage.setItem("MO_TABLE", tableId);
  closeModal("tableModal");
}

// ============================================================
// カテゴリータブ
// ============================================================
function buildCategoryTabs() {
  var cats = ["ALL"];
  allMenuItems.forEach(function(item) {
    if (item.category && cats.indexOf(item.category) < 0) cats.push(item.category);
  });
  var container = document.getElementById("category-tabs");
  var html = "";
  cats.forEach(function(cat) {
    var cls = cat === currentCategory ? "cat-btn active" : "cat-btn";
    html += '<button class="' + cls + '" onclick="filterCategory(\'' + cat + '\')">' + cat + '</button>';
  });
  container.innerHTML = html;
}

function filterCategory(cat) {
  currentCategory = cat;
  buildCategoryTabs();
  renderMenu();
}

// ============================================================
// メニュー描画
// ============================================================
function renderMenu() {
  var container = document.getElementById("menu-items");
  var items = currentCategory === "ALL" ? allMenuItems : allMenuItems.filter(function(i) { return i.category === currentCategory; });
  var html = "";
  items.forEach(function(item) {
    var imgSrc = item.image ? convertDriveUrl(item.image) : "";
    var soldClass = item.isSoldOut ? " sold-out" : "";
    var imgHtml = imgSrc
      ? '<img src="' + imgSrc + '" alt="' + item.name + '">'
      : '<span style="font-size:42px;">' + (item.emoji || '🍽') + '</span>';
    var soldBadge = item.isSoldOut ? '<span class="sold-out-badge">売切</span>' : '';

    html += '<div class="menu-card' + soldClass + '" id="card-' + item.id + '" onclick="addToCart(\'' + item.id + '\')">' +
      '<div class="card-img">' + imgHtml + soldBadge + '</div>' +
      '<div class="card-body">' +
      '<div class="item-name">' + item.name + '</div>' +
      '<div class="item-price">¥' + item.price + '</div>' +
      '</div></div>';
  });
  container.innerHTML = html;
}

function convertDriveUrl(url) {
  if (!url) return "";
  var match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return "https://lh3.googleusercontent.com/d/" + match[1];
  return url;
}

// ============================================================
// カート操作
// ============================================================
function addToCart(itemId) {
  var item = allMenuItems.find(function(i) { return i.id === itemId; });
  if (!item || item.isSoldOut) return;

  if (item.optionsStr) {
    showOptionModal(item);
    return;
  }

  cart.push({ id: item.id, name: item.name, price: item.price, options: [] });
  updateCartBadge();
  showToast(item.name + " をカートに追加");

  var card = document.getElementById("card-" + itemId);
  if (card) {
    card.classList.add("added");
    setTimeout(function() { card.classList.remove("added"); }, 500);
  }
}

function addToCartDirect(name, price) {
  cart.push({ id: "rec", name: name, price: price, options: [] });
  updateCartBadge();
  showToast(name + " をカートに追加");
}

function showOptionModal(item) {
  currentOptionItem = item;
  document.getElementById("option-item-name").textContent = item.name;
  var list = document.getElementById("option-list");
  var opts = item.optionsStr.split(",");
  var html = "";
  opts.forEach(function(opt) {
    var parts = opt.trim().split(":");
    if (parts.length === 2) {
      var name = parts[0].trim();
      var price = Number(parts[1].trim());
      html += '<label style="display:flex; align-items:center; padding:12px 0; border-bottom:1px solid var(--border-light); cursor:pointer;">' +
        '<input type="checkbox" value="' + name + '" data-price="' + price + '" style="width:20px;height:20px;margin-right:12px;">' +
        '<span>' + name + (price > 0 ? ' (+¥' + price + ')' : '') + '</span></label>';
    }
  });
  list.innerHTML = html;
  openModal("optionModal");
}

function addWithOptions() {
  if (!currentOptionItem) return;
  var checks = document.querySelectorAll("#option-list input:checked");
  var options = [];
  var extra = 0;
  checks.forEach(function(c) {
    options.push(c.value);
    extra += Number(c.getAttribute("data-price")) || 0;
  });
  cart.push({
    id: currentOptionItem.id,
    name: currentOptionItem.name + (options.length ? " (" + options.join(", ") + ")" : ""),
    price: currentOptionItem.price + extra,
    options: options
  });
  updateCartBadge();
  closeModal("optionModal");
  showToast(currentOptionItem.name + " をカートに追加");
  currentOptionItem = null;
}

function updateCartBadge() {
  var badge = document.getElementById("cart-badge");
  if (cart.length > 0) {
    badge.textContent = cart.length;
    badge.style.display = "flex";
  } else {
    badge.style.display = "none";
  }
}

function openCart() {
  var container = document.getElementById("cart-items");
  var footer = document.getElementById("cart-footer");
  if (cart.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:40px 0;">カートは空です</p>';
    footer.style.display = "none";
  } else {
    var html = "";
    var total = 0;
    cart.forEach(function(item, idx) {
      total += item.price;
      html += '<div class="cart-item"><div><div class="ci-name">' + item.name + '</div><div class="ci-price">¥' + item.price.toLocaleString() + '</div></div>' +
        '<button class="cart-remove" onclick="removeFromCart(' + idx + ')">削除</button></div>';
    });
    container.innerHTML = html;
    document.getElementById("cart-total").textContent = "¥" + total.toLocaleString();
    footer.style.display = "block";
  }
  openModal("cartModal");
}

function removeFromCart(idx) {
  cart.splice(idx, 1);
  updateCartBadge();
  openCart();
}

// ============================================================
// 注文送信
// ============================================================
function submitOrder() {
  if (cart.length === 0) return;

  var orderItems = cart.map(function(item) {
    return { name: item.name, price: item.price };
  });

  var prevLevel = getLevel(totalOrderCount);
  var newOrderCount = totalOrderCount + cart.length;

  // LIFF の accessToken を取得
  var accessToken = "";
  try {
    accessToken = liff.getAccessToken();
  } catch (e) {
    console.error("getAccessToken error:", e);
  }

  fetch(GAS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accessToken: accessToken,
      tableId: tableId,
      items: orderItems
    })
  })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.status === "success") {
        totalOrderCount = newOrderCount;
        cart = [];
        updateCartBadge();
        closeModal("cartModal");
        historyCache = null;

        var afterLevel = getLevel(totalOrderCount);
        if (afterLevel.lv > prevLevel.lv) {
          showLevelUp(afterLevel);
        } else {
          openModal("completeModal");
        }

        var userId = "";
        try {
          var profile = liff.getDecodedIDToken();
          if (profile) userId = profile.sub || "";
        } catch (e) {}
        if (userId) {
          preloadHistoryData(userId);
        }
      } else {
        showToast("注文に失敗しました: " + (d.message || ""));
      }
    })
    .catch(function(err) {
      console.error("Order error:", err);
      showToast("通信エラーが発生しました");
    });
}



// ============================================================
// レベルアップ演出
// ============================================================
function showLevelUp(level) {
  var html = '<div class="confetti-container"><span>🎉</span><span>✨</span><span>🎊</span><span>⭐</span></div>' +
    '<div class="lu-label">LEVEL UP!</div>' +
    '<div class="lu-icon">' + level.icon + '</div>' +
    '<div class="lu-name" style="color:' + level.color + ';">Lv.' + level.lv + ' ' + level.name + '</div>' +
    '<div class="lu-msg">おめでとうございます！<br>新しい特典が解放されました</div>' +
    '<div class="levelup-tags">' +
    '<span class="tag-sommelier">🍷 ' + level.sommelier + '</span>' +
    (level.shopBenefit !== "—" ? '<span class="tag-shop">🎁 ' + level.shopBenefit + '</span>' : '') +
    '</div>' +
    '<button class="btn-primary" style="background:' + level.color + ';" onclick="closeModal(\'levelUpModal\'); openModal(\'completeModal\');">OK！</button>';

  document.getElementById("levelup-content").innerHTML = html;
  openModal("levelUpModal");
}

// ============================================================
// My Taste 描画
// ============================================================
function renderMyTaste() {
  renderLevelDisplay();
  renderLevelList();

  var userId = "";
  try {
    var profile = liff.getDecodedIDToken();
    if (profile) userId = profile.sub || "";
  } catch (e) {}

  if (!userId) return;

  if (historyCache) {
    renderHistoryInTaste(historyCache);
    var tasteData = calculateTasteData(historyCache);
    renderTasteChart(tasteData);
  } else {
    preloadHistoryData(userId);
    setTimeout(function() {
      if (historyCache) {
        renderHistoryInTaste(historyCache);
        var tasteData = calculateTasteData(historyCache);
        renderTasteChart(tasteData);
      }
    }, 2000);
  }
}

function renderLevelDisplay() {
  var cur = getLevel(totalOrderCount);
  var nxt = getNextLevel(totalOrderCount);
  var pct = nxt ? Math.round(((totalOrderCount - cur.req) / (nxt.req - cur.req)) * 100) : 100;

  var html = '<div class="level-display">' +
    '<div class="level-icon">' + cur.icon + '</div>' +
    '<div class="level-badge" style="background:' + cur.bg + '; color:' + cur.color + '; border:1.5px solid ' + cur.color + '30;">Lv.' + cur.lv + ' ' + cur.name + '</div>' +
    '<div class="level-title">称号：味覚の冒険者</div>' +
    '</div>' +
    '<div class="progress-bar-container">' +
    '<div class="progress-info"><span>' + totalOrderCount + 'オーダー</span><span>' + (nxt ? '次のレベルまで あと' + (nxt.req - totalOrderCount) + 'オーダー' : 'MAX') + '</span></div>' +
    '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%; background:linear-gradient(90deg,' + cur.color + ',' + (nxt ? nxt.color : cur.color) + ');"></div></div>' +
    '</div>';

  document.getElementById("level-display-card").innerHTML = html;
}

function renderLevelList() {
  var cur = getLevel(totalOrderCount);
  var html = "";
  LEVELS.forEach(function(lv) {
    var unlocked = totalOrderCount >= lv.req;
    var isCur = lv.lv === cur.lv;
    var lockedClass = unlocked ? "" : " locked";
    var iconBg = isCur ? lv.bg : unlocked ? "#f9fafb" : "#f3f4f6";
    var iconBorder = isCur ? "2px solid " + lv.color : "1px solid var(--border-color)";
    var iconClass = isCur ? " current" : "";

    html += '<div class="level-item' + lockedClass + '">' +
      '<div class="level-item-icon' + iconClass + '" style="background:' + iconBg + '; border:' + iconBorder + ';">' + (unlocked ? lv.icon : '🔒') + '</div>' +
      '<div style="flex:1;">' +
      '<div style="display:flex; align-items:center;">' +
      '<span class="level-item-name" style="color:' + (isCur ? lv.color : '#374151') + ';">Lv.' + lv.lv + ' ' + lv.name + '</span>' +
      (isCur ? '<span class="now-badge" style="background:' + lv.color + ';">NOW</span>' : '') +
      '</div>' +
      '<div class="level-item-req">' + lv.reqLabel + 'で到達</div>' +
      '<div class="level-tags">' +
      '<span class="tag-sommelier">🍷 ' + lv.sommelier + '</span>' +
      (lv.shopBenefit !== "—" ? '<span class="tag-shop">🎁 ' + lv.shopBenefit + '</span>' : '') +
      '</div></div></div>';
  });
  document.getElementById("level-list").innerHTML = html;
}

function toggleLevelList() {
  var list = document.getElementById("level-list");
  var arrow = document.getElementById("level-arrow");
  list.classList.toggle("open");
  arrow.classList.toggle("open");
}

function renderHistoryInTaste(data) {
  var container = document.getElementById("history-items");
  if (!data || data.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted); text-align:center;">注文履歴はありません</p>';
    return;
  }
  var html = "";
  data.forEach(function(item) {
    html += '<div class="history-item"><div><div class="h-name">' + item.itemName + '</div><div class="h-date">' + item.timestamp + '</div></div>' +
      '<span class="h-price">¥' + item.price + '</span></div>';
  });
  container.innerHTML = html;
}

// ============================================================
// 味覚チャート
// ============================================================
function calculateTasteData(history) {
  var totals = { salty: 0, sweet: 0, sour: 0, bitter: 0, rich: 0 };
  var count = 0;
  history.forEach(function(h) {
    var item = allMenuItems.find(function(m) { return m.name === h.itemName; });
    if (item) {
      totals.salty += Number(item.salty) || 0;
      totals.sweet += Number(item.sweet) || 0;
      totals.sour += Number(item.sour) || 0;
      totals.bitter += Number(item.bitter) || 0;
      totals.rich += Number(item.rich) || 0;
      count++;
    }
  });
  if (count > 0) {
    totals.salty = Math.round(totals.salty / count * 10) / 10;
    totals.sweet = Math.round(totals.sweet / count * 10) / 10;
    totals.sour = Math.round(totals.sour / count * 10) / 10;
    totals.bitter = Math.round(totals.bitter / count * 10) / 10;
    totals.rich = Math.round(totals.rich / count * 10) / 10;
  }
  return totals;
}

function renderTasteChart(data) {
  var ctx = document.getElementById("taste-chart").getContext("2d");
  if (tasteChartInstance) tasteChartInstance.destroy();

  tasteChartInstance = new Chart(ctx, {
    type: "radar",
    data: {
      labels: ["塩味", "甘味", "酸味", "苦味", "コク"],
      datasets: [{
        label: "My Taste",
        data: [data.salty, data.sweet, data.sour, data.bitter, data.rich],
        backgroundColor: "rgba(59,130,246,0.15)",
        borderColor: "#3b82f6",
        borderWidth: 2.5,
        pointBackgroundColor: "#3b82f6"
      }]
    },
    options: {
      scales: { r: { beginAtZero: true, max: 10, ticks: { stepSize: 2 } } },
      plugins: { legend: { display: false } }
    }
  });

  var maxKey = Object.keys(data).reduce(function(a, b) { return data[a] > data[b] ? a : b; });
  var labels = { salty: "塩味", sweet: "甘味", sour: "酸味", bitter: "苦味", rich: "コク" };
  document.getElementById("taste-caption").textContent = labels[maxKey] + "を好む傾向があります";
}

// ============================================================
// 注文履歴
// ============================================================
function preloadHistoryData(userId) {
  if (historyCache) return;
  fetch(GAS_API_URL + "?action=getHistory&userId=" + encodeURIComponent(userId))
    .then(function(r) { return r.json(); })
    .then(function(d) { historyCache = d; })
    .catch(function(e) { console.error("History preload error:", e); });
}

// ============================================================
// AIソムリエ：おすすめモーダル
// ============================================================
function openSommelierRec() {
  var container = document.getElementById("rec-content");
  container.innerHTML = '<div style="text-align:center;"><div style="font-size:13px; color:var(--text-sub); margin-bottom:12px;">味覚データを分析中</div><div class="dot-loader"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>';
  openModal("recModal");

  var userId = "";
  try {
    var profile = liff.getDecodedIDToken();
    if (profile) userId = profile.sub || "";
  } catch (e) {}

  var history = historyCache || [];

  fetch(GAS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "getAiRecommendation",
      userId: userId,
      history: history
    })
  })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.status === "success" && d.recommendations) {
        renderRecResults(d.recommendations, d.comment || "");
      } else {
        renderRecFallback();
      }
    })
    .catch(function() {
      renderRecFallback();
    });
}

function renderRecResults(recs, comment) {
  var html = '<div class="rec-analysis"><div class="ra-label">あなたの味覚傾向から分析しました</div><div class="ra-text">' + comment + '</div></div>';
  html += '<div style="font-size:14px; font-weight:700; margin-bottom:12px;">おすすめの' + recs.length + '品</div>';

  recs.forEach(function(item) {
    html += '<div class="rec-card"><div class="rc-top"><div class="rc-emoji">' + (item.emoji || '🍽') + '</div><div style="flex:1;">' +
      '<div style="display:flex; align-items:center;"><span class="rc-name">' + item.name + '</span>' +
      (item.match ? '<span class="rc-match">' + item.match + '%</span>' : '') + '</div>' +
      '<div class="rc-reason">' + (item.reason || '') + '</div>' +
      '<div class="rc-price">¥' + item.price.toLocaleString() + '</div>' +
      '</div></div>' +
      '<button class="btn-cart-add" onclick="addToCartDirect(\'' + item.name.replace(/'/g, "\\'") + '\',' + item.price + ')">🛒 カートに追加</button></div>';
  });

  html += '<button class="btn-ghost" onclick="closeModal(\'recModal\')">閉じる</button>';
  document.getElementById("rec-content").innerHTML = html;
}

function renderRecFallback() {
  var popular = allMenuItems.slice(0, 3);
  var recs = popular.map(function(item) {
    return { name: item.name, price: item.price, emoji: item.emoji || "🍽", reason: "人気メニュー", match: null };
  });
  renderRecResults(recs, "おすすめのメニューをご紹介します。");
}

// ============================================================
// AIソムリエ：相談モーダル
// ============================================================
var consultStep = 0;
var consultAnswers = [];
var consultQuestions = [
  { q: "今日はどんな気分ですか？", opts: ["リラックスしたい", "気分を上げたい", "じっくり味わいたい", "さっぱりしたい"] },
  { q: "どのくらいの強さがいいですか？", opts: ["軽め", "ほどほど", "しっかり", "おまかせ"] }
];

function openConsult() {
  consultStep = 0;
  consultAnswers = [];
  renderConsultStep();
  openModal("consultModal");
}

function renderConsultStep() {
  var container = document.getElementById("consult-content");

  if (consultStep < consultQuestions.length) {
    var q = consultQuestions[consultStep];
    var html = '<div class="consult-bubble"><div class="cb-inner"><div class="cb-icon">🍷</div><div><div class="cb-label">ソムリエ</div><div class="cb-text">' + q.q + '</div></div></div></div>';
    html += '<div class="consult-options">';
    q.opts.forEach(function(opt) {
      html += '<button class="consult-opt" onclick="consultAnswer(\'' + opt + '\')">' + opt + '</button>';
    });
    html += '</div>';
    html += '<div class="consult-progress">';
    consultQuestions.forEach(function(_, i) {
      var cls = i <= consultStep ? "consult-dot active" : "consult-dot inactive";
      html += '<div class="' + cls + '"></div>';
    });
    html += '</div>';
    container.innerHTML = html;
  } else {
    fetchConsultResult();
  }
}

function consultAnswer(answer) {
  consultAnswers.push(answer);
  consultStep++;

  var container = document.getElementById("consult-content");
  container.innerHTML = '<div class="dot-loader"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>';

  setTimeout(function() {
    renderConsultStep();
  }, 700);
}

function fetchConsultResult() {
  var container = document.getElementById("consult-content");
  container.innerHTML = '<div class="dot-loader"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>';

  var userId = "";
  try {
    var profile = liff.getDecodedIDToken();
    if (profile) userId = profile.sub || "";
  } catch (e) {}

  fetch(GAS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "getConsultResult",
      userId: userId,
      answers: consultAnswers,
      history: historyCache || []
    })
  })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.status === "success" && d.recommendation) {
        renderConsultResult(d.recommendation, d.comment || "");
      } else {
        renderConsultFallback();
      }
    })
    .catch(function() {
      renderConsultFallback();
    });
}

function renderConsultResult(rec, comment) {
  var html = '<div class="rec-analysis"><div class="ra-text">' + comment + '</div></div>' +
    '<div class="consult-result"><div class="cr-emoji">' + (rec.emoji || '🍽') + '</div><div>' +
    '<div class="cr-name">' + rec.name + '</div>' +
    '<div class="cr-desc">' + (rec.reason || '') + '</div>' +
    '<div class="cr-price">¥' + rec.price.toLocaleString() + '</div>' +
    '</div></div>' +
    '<button class="btn-primary" style="margin-top:16px;" onclick="closeModal(\'consultModal\'); addToCartDirect(\'' + rec.name.replace(/'/g, "\\'") + '\',' + rec.price + ')">🛒 カートに追加する</button>';
  document.getElementById("consult-content").innerHTML = html;
}

function renderConsultFallback() {
  var item = allMenuItems[Math.floor(Math.random() * allMenuItems.length)] || { name: "おすすめドリンク", price: 800, emoji: "🍹" };
  renderConsultResult(
    { name: item.name, price: item.price, emoji: item.emoji || "🍽", reason: "今日の気分にぴったりです" },
    "あなたの気分と味覚データを組み合わせて分析しました。"
  );
}

// ============================================================
// シェア画像生成
// ============================================================
function generateTasteImage() {
  openModal("shareImageModal");
  document.getElementById("share-loading").style.display = "block";
  document.getElementById("share-result").style.display = "none";

  var canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  var ctx = canvas.getContext("2d");

  var grad = ctx.createLinearGradient(0, 0, 0, 1920);
  grad.addColorStop(0, "#1e3a5f");
  grad.addColorStop(0.5, "#1a2744");
  grad.addColorStop(1, "#0f1b33");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1080, 1920);

  ctx.beginPath();
  ctx.arc(540, 700, 350, 0, Math.PI * 2);
  var glow = ctx.createRadialGradient(540, 700, 0, 540, 700, 350);
  glow.addColorStop(0, "rgba(59,130,246,0.15)");
  glow.addColorStop(1, "rgba(59,130,246,0)");
  ctx.fillStyle = glow;
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "36px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Your Shop", 540, 100);

  ctx.fillStyle = "#3b82f6";
  ctx.font = "bold 56px sans-serif";
  ctx.fillText("My Taste 診断結果", 540, 180);

  var curLevel = getLevel(totalOrderCount);
  ctx.fillStyle = curLevel.color;
  ctx.font = "bold 40px sans-serif";
  ctx.fillText("Lv." + curLevel.lv + " " + curLevel.name, 540, 260);

  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = "28px sans-serif";
  ctx.fillText("AIソムリエがあなたの味覚を分析しました", 540, 1820);

  var dataUrl = canvas.toDataURL("image/png");
  var base64 = dataUrl.replace(/^data:image\/png;base64,/, "");

  fetch(GAS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "saveShareImage", imageData: base64 })
  })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      document.getElementById("share-loading").style.display = "none";
      if (d.status === "success") {
        document.getElementById("share-result").style.display = "block";
        document.getElementById("share-preview-img").src = d.url;
        document.getElementById("share-direct-link").href = d.url;
      } else {
        showToast("画像保存に失敗しました");
        closeModal("shareImageModal");
      }
    })
    .catch(function() {
      document.getElementById("share-loading").style.display = "none";
      showToast("通信エラーが発生しました");
      closeModal("shareImageModal");
    });
}

// ============================================================
// 起動
// ============================================================
initializeLiff();
