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
var currentUserId = "";

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
  document.body.style.overflow = ""; 
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
  document.body.style.overflow = "";
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
// ローディングオーバーレイ（注文送信中）
// ============================================================
function showOrderLoading(show) {
  var overlay = document.getElementById("order-loading-overlay");
  if (show) {
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "order-loading-overlay";
      overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:1500;display:flex;flex-direction:column;justify-content:center;align-items:center;";
      overlay.innerHTML = '<div class="dot-loader"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>'
        + '<p style="margin-top:16px;color:var(--text-secondary);font-size:14px;font-weight:600;">注文を送信しています...</p>';
      document.body.appendChild(overlay);
    }
    overlay.style.display = "flex";
  } else {
    if (overlay) {
      overlay.style.display = "none";
    }
  }
}

function resetOrderBtn(btn) {
  if (btn) {
    btn.disabled = false;
    btn.textContent = btn.dataset.originalText || "注文する";
    btn.style.opacity = "1";
  }
}

// ============================================================
// 初期化
// ============================================================

function initializeLiff() {
  var APP_VERSION = "20260307a";
  var savedVer = localStorage.getItem("MO_APP_VERSION");
  if (savedVer !== APP_VERSION) {
    localStorage.removeItem("MO_MENU_CACHE");
    localStorage.setItem("MO_APP_VERSION", APP_VERSION);
  }
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

 // 店舗名・テーマを動的に取得
  fetch(GAS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getShopConfig' })
  }).then(function(r) { return r.json(); }).then(function(d) {
    if (d.status === 'success') {
      var iconEl = document.getElementById('shop-icon');
      var nameEl = document.getElementById('shop-name-text');
      if (iconEl && d.shopIcon) iconEl.textContent = d.shopIcon;
      if (nameEl && d.shopName) nameEl.textContent = d.shopName;
      if (d.shopName) document.title = d.shopName;
      // テーマ適用
      var theme = d.themeMode || 'light';
      document.documentElement.setAttribute('data-theme', theme);
    }
  }).catch(function(e) { console.warn('Shop config load failed:', e); });

  liff.init({ liffId: MY_LIFF_ID }).then(function() {
    if (!liff.isLoggedIn()) {
      liff.login();
      return;
    }
    liff.getProfile().then(function(p) {
      currentUserId = p.userId;
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

      if (d.profile && d.profile.orderCount !== undefined) {
        totalOrderCount = Number(d.profile.orderCount) || 0;
        console.log("初期オーダー数:", totalOrderCount);
      }

      // 最新5件だけ事前取得
      if (userId) {
        preloadHistoryData(userId, true);
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
// メニュー画面スワイプでカテゴリ切替
// ============================================================
(function() {
  var menuScreen = document.getElementById("screen-menu");
  if (!menuScreen) return;

  var categories = ["ALL", "Food", "Drink"];
  var touchStartX = 0;
  var touchStartY = 0;
  var touchStartTime = 0;

  menuScreen.addEventListener("touchstart", function(e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
  }, { passive: true });

  menuScreen.addEventListener("touchend", function(e) {
    var touchEndX = e.changedTouches[0].clientX;
    var touchEndY = e.changedTouches[0].clientY;
    var diffX = touchEndX - touchStartX;
    var diffY = touchEndY - touchStartY;
    var elapsed = Date.now() - touchStartTime;

    // 横移動が50px以上、縦移動より大きく、500ms以内
    if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY) * 1.5 && elapsed < 500) {
      // 現在のカテゴリを取得
      var activeBtn = document.querySelector(".cat-btn.active");
      var currentCat = "ALL";
      if (activeBtn) {
        var onclickStr = activeBtn.getAttribute("onclick") || "";
        var match = onclickStr.match(/filterCategory\(['"](.+?)['"]\)/);
        if (match) currentCat = match[1];
      }

      var currentIndex = categories.indexOf(currentCat);
      if (currentIndex === -1) currentIndex = 0;

      if (diffX < 0) {
        // 左スワイプ → 次のカテゴリ
        if (currentIndex < categories.length - 1) {
          filterCategory(categories[currentIndex + 1]);
          updateCatBtnActive(categories[currentIndex + 1]);
        }
      } else {
        // 右スワイプ → 前のカテゴリ
        if (currentIndex > 0) {
          filterCategory(categories[currentIndex - 1]);
          updateCatBtnActive(categories[currentIndex - 1]);
        }
      }
    }
  }, { passive: true });

  function updateCatBtnActive(cat) {
    var btns = document.querySelectorAll(".cat-btn");
    btns.forEach(function(btn) {
      var onclickStr = btn.getAttribute("onclick") || "";
      var match = onclickStr.match(/filterCategory\(['"](.+?)['"]\)/);
      if (match && match[1] === cat) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
    // アクティブなタブが見えるようスクロール
    var activeBtn = document.querySelector(".cat-btn.active");
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }
})();


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
    var soldBadge = item.isSoldOut ? '<span class="sold-out-badge">売切</span>' : '';

    var imgHtml;
    if (imgSrc) {
      imgHtml = '<img src="' + imgSrc + '" alt="' + item.name + '" onerror="this.outerHTML=\'<div class=menu-card-img-placeholder style=font-size:42px;display:flex;align-items:center;justify-content:center;width:100%;height:100%;>' + (item.emoji || '🍸') + '</div>\'">';
    } else {
      imgHtml = '<div class="menu-card-img-placeholder" style="font-size:42px;display:flex;align-items:center;justify-content:center;width:100%;height:100%;">' + (item.emoji || '🍸') + '</div>';
    }

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

  // テーブル番号チェック
  if (!tableId) {
    showToast("テーブル番号を設定してください");
    openModal("tableModal");
    return;
  }

  var orderItems = cart.map(function(item) {
    return { name: item.name, price: item.price };
  });

  var prevLevel = getLevel(totalOrderCount);
  var newOrderCount = totalOrderCount + orderItems.length;

  var accessToken = "";
  var userId = "";
  var userName = "ゲスト";
  try {
    accessToken = liff.getAccessToken() || "";
  } catch (e) {}
  try {
    var profile = liff.getDecodedIDToken();
    if (profile) {
      userId = profile.sub || "";
      userName = profile.name || "ゲスト";
    }
  } catch (e) {}

  var payload = {
    action: "placeOrder",
    accessToken: accessToken,
    userId: userId,
    userName: userName,
    tableId: tableId,
    items: orderItems
  };

  var orderBtn = document.querySelector("#cart-footer .btn-primary");
  if (orderBtn) {
    orderBtn.disabled = true;
    orderBtn.dataset.originalText = orderBtn.textContent;
    orderBtn.textContent = "注文送信中...";
    orderBtn.style.opacity = "0.6";
  }
  showOrderLoading(true);

  fetch(GAS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
    .then(function(r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function(d) {
      console.log("注文応答:", d);
      showOrderLoading(false);
      resetOrderBtn(orderBtn);

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

        if (userId) {
          preloadHistoryData(userId, true);
        }
      } else {
        showOrderError(d.message || "注文処理に失敗しました", payload);
      }
    })
    .catch(function(err) {
      console.error("通信エラー:", err);
      showOrderLoading(false);
      resetOrderBtn(orderBtn);
      showOrderError("通信エラーが発生しました。電波状況を確認してください。", payload);
    });
}

// 注文エラー表示（リトライ付き）
var lastFailedPayload = null;

function showOrderError(message, payload) {
  lastFailedPayload = payload;
  var container = document.getElementById("cart-items");
  var footer = document.getElementById("cart-footer");

  container.innerHTML = '<div style="text-align:center; padding:24px 0;">'
    + '<div style="font-size:36px; margin-bottom:12px;">⚠️</div>'
    + '<div style="font-size:15px; font-weight:700; color:var(--danger); margin-bottom:8px;">注文に失敗しました</div>'
    + '<div style="font-size:13px; color:var(--text-muted); line-height:1.6;">' + message + '</div>'
    + '</div>';

  footer.innerHTML = '<button class="btn-primary" onclick="retryOrder()" style="margin-bottom:8px;">🔄 もう一度送信する</button>'
    + '<button class="btn-ghost" onclick="closeOrderError()">戻る</button>';
  footer.style.display = "block";
}

function retryOrder() {
  if (!lastFailedPayload) return;

  var footer = document.getElementById("cart-footer");
  var retryBtn = footer.querySelector(".btn-primary");
  if (retryBtn) {
    retryBtn.disabled = true;
    retryBtn.textContent = "再送信中...";
    retryBtn.style.opacity = "0.6";
  }
  showOrderLoading(true);

  fetch(GAS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lastFailedPayload)
  })
    .then(function(r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function(d) {
      showOrderLoading(false);
      if (d.status === "success") {
        lastFailedPayload = null;
        var prevLevel = getLevel(totalOrderCount);
        totalOrderCount += lastFailedPayload ? 0 : cart.length;
        cart = [];
        updateCartBadge();
        closeModal("cartModal");
        historyCache = null;
        openModal("completeModal");
      } else {
        showOrderError(d.message || "注文処理に失敗しました", lastFailedPayload);
      }
    })
    .catch(function(err) {
      console.error("リトライエラー:", err);
      showOrderLoading(false);
      showOrderError("再送信にも失敗しました。しばらくしてからお試しください。", lastFailedPayload);
    });
}

function closeOrderError() {
  lastFailedPayload = null;
  openCart();
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

  var userId = currentUserId;
  if (!userId) {
    try {
      var profile = liff.getDecodedIDToken();
      if (profile) userId = profile.sub || "";
    } catch (e) {}
  }

  if (!userId) return;

  fetch(GAS_API_URL + "?action=getHistory&userId=" + encodeURIComponent(userId) + "&limit=5")
    .then(function(r) { return r.json(); })
    .then(function(d) {
      historyCache = d;
      renderHistoryInTaste(d);
      var tasteData = calculateTasteData(d);
      renderTasteChart(tasteData);
      renderTastePeriodSelector();
    })
    .catch(function(e) {
      console.error("履歴取得エラー:", e);
      if (historyCache) {
        renderHistoryInTaste(historyCache);
        var tasteData = calculateTasteData(historyCache);
        renderTasteChart(tasteData);
        renderTastePeriodSelector();
      }
    });
}


function renderTastePeriodSelector() {
  if (document.getElementById("taste-period-selector")) return;
  var chartContainer = document.querySelector(".chart-container");
  if (!chartContainer) return;

  var wrapper = document.createElement("div");
  wrapper.id = "taste-period-selector";
  wrapper.style.cssText = "text-align:center;margin-bottom:12px;";

  var select = document.createElement("select");
  select.id = "taste-period";
  select.style.cssText = "padding:8px 16px;border:1px solid var(--border-color);border-radius:8px;font-size:14px;font-family:inherit;background:var(--bg-input);color:var(--text-primary);cursor:pointer;";
  select.innerHTML =
    '<option value="all">今までの全期間の分析</option>' +
    '<option value="30">直近1ヶ月の分析</option>' +
    '<option value="90">直近3ヶ月の分析</option>' +
    '<option value="180">直近6ヶ月の分析</option>';

  select.addEventListener("change", function() {
    loadTasteByPeriod(this.value);
  });

  wrapper.appendChild(select);
  chartContainer.parentNode.insertBefore(wrapper, chartContainer);
}

function loadTasteByPeriod(period) {
  var userId = currentUserId;
  if (!userId) {
    try { var p = liff.getDecodedIDToken(); if (p) userId = p.sub || ""; } catch(e) {}
  }
  if (!userId) return;

  var chartContainer = document.querySelector(".chart-container");
  if (chartContainer) {
    chartContainer.style.opacity = "0.5";
  }

  var url = GAS_API_URL + "?action=getTasteAnalysis&userId=" + encodeURIComponent(userId);
  if (period !== "all") {
    url += "&days=" + period;
  }

  fetch(url)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (chartContainer) chartContainer.style.opacity = "1";
      if (data.status === "success" && data.tasteData) {
        renderTasteChart(data.tasteData);
      } else {
        showToast("この期間のデータがありません");
      }
    })
    .catch(function(err) {
      if (chartContainer) chartContainer.style.opacity = "1";
      console.error("Taste period error:", err);
      showToast("データ取得に失敗しました");
    });
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

// ============================================================
// 注文履歴描画（最新5件 + 月別もっと見る）
// ============================================================
function renderHistoryInTaste(data) {
  var container = document.getElementById("history-items");

  var items = [];
  if (Array.isArray(data)) {
    items = data;
  } else if (data && Array.isArray(data.current)) {
    items = data.current.concat(
      data.past ? data.past.reduce(function(acc, order) {
        return acc.concat(order.items || []);
      }, []) : []
    );
  }

  if (items.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted); text-align:center;">注文履歴はありません</p>';
    return;
  }

  var html = "";

  // 最新5件を表示
  items.forEach(function(item) {
    var name = item.itemName || item.name || "不明";
    var price = item.price || 0;
    var time = item.timestamp || item.time || "";
    html += '<div class="history-item"><div><div class="h-name">' + name + '</div><div class="h-date">' + time + '</div></div>' +
      '<span class="h-price">¥' + Number(price).toLocaleString() + '</span></div>';
  });

  // 「過去の注文をもっと見る」ボタン
  html += '<div id="history-more-section">';
  html += '<button id="history-more-btn" onclick="loadHistoryMonths()" style="'
    + 'width:100%;padding:14px;margin-top:12px;background:var(--bg-card);border:1px solid var(--border-color);'
    + 'border-radius:12px;font-size:13px;font-weight:600;color:var(--text-secondary);cursor:pointer;'
    + 'display:flex;align-items:center;justify-content:center;gap:6px;font-family:inherit;'
    + 'transition:all 0.2s;">'
    + '📅 過去の注文をもっと見る'
    + '</button>';
  html += '<div id="history-month-selector" style="display:none;"></div>';
  html += '<div id="history-month-items" style="display:none;"></div>';
  html += '</div>';

  container.innerHTML = html;
}

// 月一覧を取得して表示
function loadHistoryMonths() {
  var userId = currentUserId;
  if (!userId) {
    try {
      var profile = liff.getDecodedIDToken();
      if (profile) userId = profile.sub || "";
    } catch (e) {}
  }
  if (!userId) return;

  var btn = document.getElementById("history-more-btn");
  btn.textContent = "読み込み中...";
  btn.style.opacity = "0.6";

  fetch(GAS_API_URL + "?action=getHistoryMonths&userId=" + encodeURIComponent(userId))
    .then(function(r) { return r.json(); })
    .then(function(months) {
      btn.style.display = "none";

      var selector = document.getElementById("history-month-selector");

      if (!months || months.length === 0) {
        selector.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:12px 0;font-size:13px;">過去の注文はありません</p>';
        selector.style.display = "block";
        return;
      }

      var html = '<div style="font-size:13px;font-weight:700;color:var(--text-primary);margin:16px 0 10px;">何月の注文を見ますか？</div>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
      months.forEach(function(m) {
        var parts = m.month.split("-");
        var label = Number(parts[0]) + "年" + Number(parts[1]) + "月";
        html += '<button onclick="loadMonthHistory(\'' + m.month + '\')" style="'
          + 'padding:10px 16px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:10px;'
          + 'font-size:13px;font-weight:600;color:var(--text-primary);cursor:pointer;font-family:inherit;'
          + 'transition:all 0.15s;">'
          + label + ' <span style="color:var(--text-muted);font-weight:400;">(' + m.count + '件)</span>'
          + '</button>';
      });
      html += '</div>';

      // 「閉じる」ボタン
      html += '<button onclick="closeHistoryMonths()" style="'
        + 'width:100%;padding:10px;margin-top:10px;background:none;border:none;'
        + 'font-size:13px;color:var(--text-muted);cursor:pointer;font-family:inherit;">'
        + '▲ 閉じる</button>';

      selector.innerHTML = html;
      selector.style.display = "block";
    })
    .catch(function(e) {
      console.error("月一覧取得エラー:", e);
      btn.textContent = "📅 過去の注文をもっと見る";
      btn.style.opacity = "1";
      showToast("読み込みに失敗しました");
    });
}

// 月別履歴の「閉じる」
function closeHistoryMonths() {
  document.getElementById("history-month-selector").style.display = "none";
  document.getElementById("history-month-items").style.display = "none";

  var btn = document.getElementById("history-more-btn");
  btn.style.display = "flex";
  btn.textContent = "📅 過去の注文をもっと見る";
  btn.style.opacity = "1";
}

// 指定月の履歴を取得
function loadMonthHistory(month) {
  var userId = currentUserId;
  if (!userId) {
    try {
      var profile = liff.getDecodedIDToken();
      if (profile) userId = profile.sub || "";
    } catch (e) {}
  }
  if (!userId) return;

  var itemsContainer = document.getElementById("history-month-items");
  itemsContainer.innerHTML = '<div style="text-align:center;padding:20px 0;"><div class="dot-loader"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>';
  itemsContainer.style.display = "block";

  // 選択された月をハイライト
  var buttons = document.querySelectorAll("#history-month-selector button");
  buttons.forEach(function(b) {
    if (b.onclick && b.getAttribute("onclick") && b.getAttribute("onclick").indexOf(month) >= 0) {
      b.style.background = "var(--primary)";
      b.style.color = "#000";
      b.style.borderColor = "var(--primary)";
    } else if (b.getAttribute("onclick") && b.getAttribute("onclick").indexOf("loadMonthHistory") >= 0) {
      b.style.background = "var(--bg-card)";
      b.style.color = "var(--text-primary)";
      b.style.borderColor = "var(--border-color)";
    }
  });

  fetch(GAS_API_URL + "?action=getHistoryByMonth&userId=" + encodeURIComponent(userId) + "&month=" + encodeURIComponent(month))
    .then(function(r) { return r.json(); })
    .then(function(items) {
      if (!items || items.length === 0) {
        itemsContainer.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:12px 0;font-size:13px;">この月の注文はありません</p>';
        return;
      }

      var parts = month.split("-");
      var label = Number(parts[0]) + "年" + Number(parts[1]) + "月";
      var html = '<div style="font-size:13px;font-weight:700;color:var(--text-primary);margin:12px 0 8px;padding-top:12px;border-top:1px solid var(--border-color);">'
        + '📋 ' + label + 'の注文（' + items.length + '件）</div>';

      items.forEach(function(item) {
        var name = item.itemName || item.name || "不明";
        var price = item.price || 0;
        var time = item.timestamp || item.time || "";
        html += '<div class="history-item"><div><div class="h-name">' + name + '</div><div class="h-date">' + time + '</div></div>' +
          '<span class="h-price">¥' + Number(price).toLocaleString() + '</span></div>';
      });

      itemsContainer.innerHTML = html;
    })
    .catch(function(e) {
      console.error("月別履歴取得エラー:", e);
      itemsContainer.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:12px 0;">読み込みに失敗しました</p>';
    });
}

// ============================================================
// 味覚チャート
// ============================================================
function calculateTasteData(data) {
  var totals = { salty: 0, sweet: 0, sour: 0, bitter: 0, rich: 0 };
  var count = 0;

  var items = [];
  if (Array.isArray(data)) {
    items = data;
  } else if (data && Array.isArray(data.current)) {
    items = data.current.concat(
      data.past ? data.past.reduce(function(acc, order) {
        return acc.concat(order.items || []);
      }, []) : []
    );
  }

  items.forEach(function(h) {
    var name = h.itemName || h.name || "";
    var item = allMenuItems.find(function(m) { return m.name === name; });
    if (item && item.params) {
      totals.salty += Number(item.params.salty) || 0;
      totals.sweet += Number(item.params.sweet) || 0;
      totals.sour += Number(item.params.sour) || 0;
      totals.bitter += Number(item.params.bitter) || 0;
      totals.rich += Number(item.params.rich) || 0;
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

  // テーマに応じたチャートカラーを取得
  var cs = getComputedStyle(document.documentElement);
  var chartBorder = cs.getPropertyValue('--chart-border').trim() || '#3b82f6';
  var chartFill = cs.getPropertyValue('--chart-fill').trim() || 'rgba(59,130,246,0.15)';
  var chartGrid = cs.getPropertyValue('--chart-grid').trim() || 'rgba(0,0,0,0.08)';
  var chartLabel = cs.getPropertyValue('--chart-label').trim() || '#6b7280';
  var tickColor = cs.getPropertyValue('--text-muted').trim() || '#9ca3af';

  tasteChartInstance = new Chart(ctx, {
    type: "radar",
    data: {
      labels: ["塩味", "甘味", "酸味", "苦味", "コク"],
      datasets: [{
        label: "My Taste",
        data: [data.salty, data.sweet, data.sour, data.bitter, data.rich],
        backgroundColor: chartFill,
        borderColor: chartBorder,
        borderWidth: 2.5,
        pointBackgroundColor: chartBorder
      }]
    },
    options: {
      maintainAspectRatio: true,
      aspectRatio: 1,
      scales: {
        r: {
          beginAtZero: true,
          max: 10,
          ticks: { stepSize: 2, color: tickColor },
          grid: { color: chartGrid },
          pointLabels: { color: chartLabel, font: { size: 13 } }
        }
      },
      plugins: { legend: { display: false } }
    }
  });

  var maxKey = Object.keys(data).reduce(function(a, b) { return data[a] > data[b] ? a : b; });
  var labels = { salty: "塩味", sweet: "甘味", sour: "酸味", bitter: "苦味", rich: "コク" };
  document.getElementById("taste-caption").textContent = labels[maxKey] + "を好む傾向があります";
}

// ============================================================
// 注文履歴プリロード（最新5件）
// ============================================================
function preloadHistoryData(userId, forceRefresh) {
  if (historyCache && !forceRefresh) return;
  fetch(GAS_API_URL + "?action=getHistory&userId=" + encodeURIComponent(userId) + "&limit=5")
    .then(function(r) { return r.json(); })
    .then(function(d) { historyCache = d; })
    .catch(function(e) { console.error("History preload error:", e); });
}

// ============================================================
// AIソムリエ：おすすめモーダル
// ============================================================
function openSommelierRec() {
  var container = document.getElementById("rec-content");
  container.innerHTML = '<div style="text-align:center;"><div style="font-size:13px; color:var(--text-secondary); margin-bottom:12px;">味覚データを分析中</div><div class="dot-loader"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>';
  openModal("recModal");

  var userId = currentUserId;
  if (!userId) {
    try {
      var profile = liff.getDecodedIDToken();
      if (profile) userId = profile.sub || "";
    } catch (e) {}
  }

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
      console.log("AI応答:", d);
      if (d.status === "success" && d.recommendations && d.recommendations.length > 0) {
        renderRecResults(d.recommendations, d.comment || "");
      } else {
        renderRecFallback();
      }
    })
    .catch(function(err) {
      console.error("AI error:", err);
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
  var popular = allMenuItems.filter(function(i) { return !i.isSoldOut; }).slice(0, 3);
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

  var userId = currentUserId;
  if (!userId) {
    try {
      var profile = liff.getDecodedIDToken();
      if (profile) userId = profile.sub || "";
    } catch (e) {}
  }

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
      console.log("相談AI応答:", d);
      if (d.status === "success" && d.recommendation) {
        renderConsultResult(d.recommendation, d.comment || "");
      } else {
        renderConsultFallback();
      }
    })
    .catch(function(err) {
      console.error("Consult error:", err);
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
  var available = allMenuItems.filter(function(i) { return !i.isSoldOut; });
  var item = available[Math.floor(Math.random() * available.length)] || { name: "おすすめドリンク", price: 800, emoji: "🍹" };
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

  var tasteData = null;
  if (historyCache) {
    tasteData = calculateTasteData(historyCache);
  }

  var canvas = document.createElement("canvas");
  canvas.width = 540;
  canvas.height = 960;
  var ctx = canvas.getContext("2d");

  // 背景（白）
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 540, 960);

  // 上部アクセントライン
  ctx.fillStyle = "#3b82f6";
  ctx.fillRect(0, 0, 540, 4);

  // 店名
  var shopNameText = document.getElementById("shop-name-text");
  var shopName = shopNameText ? shopNameText.textContent : "BAR";
  ctx.fillStyle = "#9ca3af";
  ctx.font = "16px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(shopName, 270, 45);

  // タイトル
  ctx.fillStyle = "#1f2937";
  ctx.font = "bold 28px sans-serif";
  ctx.fillText("My Taste 診断結果", 270, 85);

  // レベル
  var curLevel = getLevel(totalOrderCount);
  ctx.fillStyle = "#3b82f6";
  ctx.font = "bold 22px sans-serif";
  ctx.fillText(curLevel.icon + " Lv." + curLevel.lv + " " + curLevel.name, 270, 125);

  // 注文数
  ctx.fillStyle = "#6b7280";
  ctx.font = "15px sans-serif";
  ctx.fillText("累計 " + totalOrderCount + " オーダー", 270, 155);

  // 区切り線
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, 175);
  ctx.lineTo(480, 175);
  ctx.stroke();

  // レーダーチャート
  if (tasteData) {
    var cx = 270, cy = 380, radius = 120;
    var labels = ["塩味", "甘味", "酸味", "苦味", "コク"];
    var values = [tasteData.salty, tasteData.sweet, tasteData.sour, tasteData.bitter, tasteData.rich];
    var maxVal = 10;
    var angleStep = (Math.PI * 2) / 5;
    var startAngle = -Math.PI / 2;

    // グリッド線
    for (var ring = 1; ring <= 5; ring++) {
      var r = radius * (ring / 5);
      ctx.beginPath();
      for (var j = 0; j < 5; j++) {
        var angle = startAngle + j * angleStep;
        var px = cx + r * Math.cos(angle);
        var py = cy + r * Math.sin(angle);
        if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 軸線
    for (var j = 0; j < 5; j++) {
      var angle = startAngle + j * angleStep;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // データ領域
    ctx.beginPath();
    for (var j = 0; j < 5; j++) {
      var angle = startAngle + j * angleStep;
      var val = Math.min(values[j], maxVal);
      var r = radius * (val / maxVal);
      var px = cx + r * Math.cos(angle);
      var py = cy + r * Math.sin(angle);
      if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(59,130,246,0.15)";
    ctx.fill();
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.stroke();

    // データポイント
    for (var j = 0; j < 5; j++) {
      var angle = startAngle + j * angleStep;
      var val = Math.min(values[j], maxVal);
      var r = radius * (val / maxVal);
      var px = cx + r * Math.cos(angle);
      var py = cy + r * Math.sin(angle);
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#3b82f6";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // ラベル + 数値
    ctx.font = "bold 15px sans-serif";
    ctx.textAlign = "center";
    for (var j = 0; j < 5; j++) {
      var angle = startAngle + j * angleStep;
      var lx = cx + (radius + 35) * Math.cos(angle);
      var ly = cy + (radius + 35) * Math.sin(angle);
      ctx.fillStyle = "#1f2937";
      ctx.fillText(labels[j], lx, ly);
      ctx.fillStyle = "#6b7280";
      ctx.font = "13px sans-serif";
      ctx.fillText(values[j].toFixed(1), lx, ly + 17);
      ctx.font = "bold 15px sans-serif";
    }

    // 味覚傾向
    var maxKey = Object.keys(tasteData).reduce(function(a, b) { return tasteData[a] > tasteData[b] ? a : b; });
    var labelMap = { salty: "塩味", sweet: "甘味", sour: "酸味", bitter: "苦味", rich: "コク" };
    ctx.fillStyle = "#1f2937";
    ctx.font = "bold 17px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("「" + labelMap[maxKey] + "」を好む傾向があります", 270, 560);
  } else {
    ctx.fillStyle = "#9ca3af";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("注文データがまだありません", 270, 380);
  }

  // 区切り線
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, 585);
  ctx.lineTo(480, 585);
  ctx.stroke();

  // 注文履歴（最新5件）
  if (historyCache) {
    var items = [];
    if (Array.isArray(historyCache)) { items = historyCache; }
    else if (historyCache.current) { items = historyCache.current; }
    if (items.length > 0) {
      ctx.fillStyle = "#1f2937";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("最近のオーダー", 270, 615);

      ctx.font = "14px sans-serif";
      ctx.textAlign = "left";
      var displayItems = items.slice(0, 5);
      for (var k = 0; k < displayItems.length; k++) {
        var item = displayItems[k];
        var name = item.itemName || item.name || "不明";
        var price = item.price || 0;
        var yPos = 650 + k * 30;
        ctx.fillStyle = "#1f2937";
        ctx.fillText("• " + name, 90, yPos);
        ctx.textAlign = "right";
        ctx.fillStyle = "#6b7280";
        ctx.fillText("¥" + Number(price).toLocaleString(), 450, yPos);
        ctx.textAlign = "left";
      }
    }
  }

  // フッター
  ctx.fillStyle = "#9ca3af";
  ctx.font = "13px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("AIソムリエがあなたの味覚を分析しました", 270, 920);

  // アップロード
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
      if (d.status === "success" && d.url) {
        document.getElementById("share-result").style.display = "block";
        document.getElementById("share-preview-img").src = d.url;
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
// 画像保存 & LINEシェア
// ============================================================
var shareImageUrl = "";

function saveShareImage() {
  if (!shareImageUrl) return;
  var btn = document.getElementById("share-save-btn");
  btn.textContent = "処理中...";
  btn.disabled = true;

  // Canvas から Blob を生成してダウンロード試行
  fetch(shareImageUrl)
    .then(function(r) { return r.blob(); })
    .then(function(blob) {
      // Web Share API（iOS Safari / Android Chrome 対応）
      if (navigator.share && navigator.canShare) {
        var file = new File([blob], "mytaste.png", { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          return navigator.share({
            files: [file],
            title: "My Taste 診断結果"
          }).then(function() {
            showToast("シェアしました！");
          });
        }
      }
      // フォールバック: <a download> でダウンロード
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "mytaste.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("画像を保存しました");
    })
    .catch(function() {
      // 最終フォールバック: 別タブで開く
      window.open(shareImageUrl, "_blank");
      showToast("別タブで開きました。長押しで保存してください");
    })
    .finally(function() {
      btn.textContent = "💾 画像を保存する";
      btn.disabled = false;
    });
}

function shareToLine() {
  if (!shareImageUrl) return;
  if (typeof liff !== "undefined" && liff.isInClient && liff.isInClient()) {
    // LIFF内: shareTargetPicker を使用
    liff.shareTargetPicker([
      {
        type: "image",
        originalContentUrl: shareImageUrl,
        previewImageUrl: shareImageUrl
      }
    ]).then(function(res) {
      if (res && res.status === "success") {
        showToast("シェアしました！");
      }
    }).catch(function(e) {
      console.error("Share error:", e);
      // フォールバック: LINE URLスキーム
      var lineUrl = "https://line.me/R/share?text=" + encodeURIComponent("My Taste 診断結果 🍷\n" + shareImageUrl);
      window.open(lineUrl, "_blank");
    });
  } else {
    // 外部ブラウザ: LINE URLスキーム
    var lineUrl = "https://line.me/R/share?text=" + encodeURIComponent("My Taste 診断結果 🍷\n" + shareImageUrl);
    window.open(lineUrl, "_blank");
  }
}


// ============================================================
// 会計機能
// ============================================================
var billData = null;
var billRequested = false;


function closeBill() {
  var modal = document.getElementById("billModal");
  modal.classList.remove("show");
  document.body.style.overflow = "";  // ← これも確認
}

function openBill() {
  var modal = document.getElementById("billModal");
  modal.classList.add("show");
  document.body.style.overflow = "hidden";

  // リセット表示
  document.getElementById("bill-loading").style.display = "block";
  document.getElementById("bill-content").style.display = "none";
  document.getElementById("bill-requested").style.display = "none";
  document.getElementById("bill-empty").style.display = "none";

  // 既にリクエスト済みならリクエスト画面を表示
  if (billRequested && billData) {
    showBillRequested();
    return;
  }

  fetch(GAS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "getBill",
      userId: currentUserId || "",
      tableId: tableId || ""
    })
  })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      document.getElementById("bill-loading").style.display = "none";

      if (d.status === "success" && d.items && d.items.length > 0) {
        billData = d;
        renderBill(d);
      } else {
        document.getElementById("bill-empty").style.display = "block";
      }
    })
    .catch(function(e) {
      console.error("getBill error:", e);
      document.getElementById("bill-loading").style.display = "none";
      document.getElementById("bill-empty").style.display = "block";
    });
}

function requestBill() {
  if (!billData) return;

  var btn = document.getElementById("bill-request-btn");
  btn.disabled = true;
  btn.textContent = "送信中...";

  fetch(GAS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "requestBill",
      userId: currentUserId || "",
      tableId: tableId || "",
      total: billData.total || 0,
      displayName: ""
    })
  })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.status === "success") {
        billRequested = true;
        showBillRequested();
      } else {
        btn.disabled = false;
        btn.textContent = "🙋 会計をお願いする";
        alert("エラーが発生しました");
      }
    })
    .catch(function(e) {
      console.error("requestBill error:", e);
      btn.disabled = false;
      btn.textContent = "🙋 会計をお願いする";
      alert("通信エラーが発生しました");
    });
}


function renderBill(data) {
  document.getElementById("bill-table-no").textContent = tableId || "-";
  document.getElementById("bill-content").style.display = "block";

  var container = document.getElementById("bill-items");
  var html = "";
  var total = 0;

  data.items.forEach(function(item) {
    var itemTotal = (item.price || 0) * (item.quantity || 1);
    total += itemTotal;
    html += '<div class="bill-item-row">';
    html += '<div>';
    html += '<div class="bill-item-name">' + (item.name || "不明") + '</div>';
    if (item.option) {
      html += '<div class="bill-item-option">' + item.option + '</div>';
    }
    html += '</div>';
    html += '<span class="bill-item-qty">×' + (item.quantity || 1) + '</span>';
    html += '<span class="bill-item-price">¥' + itemTotal.toLocaleString() + '</span>';
    html += '</div>';
  });

  container.innerHTML = html;
  document.getElementById("bill-total").textContent = "¥" + total.toLocaleString();
}

function showBillRequested() {
  document.getElementById("bill-loading").style.display = "none";
  document.getElementById("bill-content").style.display = "none";
  document.getElementById("bill-empty").style.display = "none";
  document.getElementById("bill-requested").style.display = "block";

  document.getElementById("bill-req-table").textContent = tableId || "-";

  var total = 0;
  var html = "";
  if (billData && billData.items) {
    billData.items.forEach(function(item) {
      var itemTotal = (item.price || 0) * (item.quantity || 1);
      total += itemTotal;
      html += '<div style="display:flex; justify-content:space-between; padding:6px 0; font-size:13px;">';
      html += '<span>' + (item.name || "") + (item.option ? " (" + item.option + ")" : "") + ' ×' + (item.quantity || 1) + '</span>';
      html += '<span style="font-weight:600;">¥' + itemTotal.toLocaleString() + '</span>';
      html += '</div>';
    });
  }

  document.getElementById("bill-req-items").innerHTML = html;
  document.getElementById("bill-req-total").textContent = "¥" + total.toLocaleString();
}


// ============================================================
// 起動
// ============================================================
initializeLiff();
