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

// ============================================================
// 初期化
// ============================================================
function initializeLiff() {
  // キャッシュからメニューを即表示
  var cached = localStorage.getItem("MO_MENU_CACHE");
  if (cached) {
    try {
      allMenuItems = JSON.parse(cached);
      buildCategoryTabs();
      renderMenu();
      document.getElementById("menu-skeleton").style.display = "none";
      document.getElementById("menu-container").style.display = "block";
    } catch (e) {}
  }

  liff.init({ liffId: MY_LIFF_ID }).then(function () {
    if (!liff.isLoggedIn()) {
      liff.login();
      return;
    }
    liff.getProfile().then(function (p) {
      fetchInitData(p.userId, p.displayName);
      checkTableId();
    });
  }).catch(function (err) {
    console.error("LIFF init error:", err);
    fetchInitData("", "ゲスト");
    checkTableId();
  });
}

function fetchInitData(userId, displayName) {
  var url = GAS_API_URL + "?action=getInitData&userId=" + encodeURIComponent(userId);
  fetch(url)
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d.menu) {
        allMenuItems = d.menu;
        localStorage.setItem("MO_MENU_CACHE", JSON.stringify(d.menu));
        buildCategoryTabs();
        renderMenu();
      }
      document.getElementById("menu-skeleton").style.display = "none";
      document.getElementById("menu-container").style.display = "block";
      document.getElementById("loading-overlay").style.display = "none";

      if (d.profile) {
        showGreetingToast(displayName, d.profile);
      }
    })
    .catch(function (err) {
      console.error("fetchInitData error:", err);
      document.getElementById("menu-skeleton").style.display = "none";
      document.getElementById("menu-container").style.display = "block";
      document.getElementById("loading-overlay").style.display = "none";
    });
}

function checkTableId() {
  var params = new URLSearchParams(window.location.search);
  if (params.get("table")) {
    tableId = params.get("table");
    localStorage.setItem("MO_TABLE", tableId);
  } else if (localStorage.getItem("MO_TABLE")) {
    tableId = localStorage.getItem("MO_TABLE");
  } else {
    var m = new bootstrap.Modal(document.getElementById("tableModal"));
    m.show();
  }
}

function setTable() {
  var val = document.getElementById("table-input").value.trim();
  if (!val) return;
  tableId = val;
  localStorage.setItem("MO_TABLE", tableId);
  bootstrap.Modal.getInstance(document.getElementById("tableModal")).hide();
}

// ============================================================
// 挨拶トースト
// ============================================================
function showGreetingToast(name, profile) {
  if (sessionStorage.getItem("MO_GREETED")) return;

  if (profile && profile.status === "found") {
    var today = new Date();
    var todayStr = (today.getMonth() + 1) + "/" + today.getDate();
    if (profile.lastVisit === todayStr) return;
  }

  sessionStorage.setItem("MO_GREETED", "1");

  var msg = "";
  if (profile && profile.status === "found" && profile.visitCount >= 2) {
    msg = name + "さん、" + profile.visitCount + "回目のご来店ですね！";
    if (profile.aiPersona) msg += "\nあなたの称号：" + profile.aiPersona;
  } else {
    msg = "ようこそ " + name + " さん！\nはじめてのご来店ありがとうございます。";
  }

  var toast = document.createElement("div");
  toast.id = "greeting-toast";
  toast.innerText = msg;
  document.body.appendChild(toast);
  setTimeout(function () { toast.classList.add("show"); }, 100);
  setTimeout(function () { toast.classList.remove("show"); }, 4000);
  setTimeout(function () { toast.remove(); }, 4500);
}

// ============================================================
// カテゴリータブ
// ============================================================
function buildCategoryTabs() {
  var cats = ["ALL"];
  allMenuItems.forEach(function (item) {
    if (item.category && cats.indexOf(item.category) < 0) cats.push(item.category);
  });
  var container = document.getElementById("category-tabs");
  var html = "";
  cats.forEach(function (cat) {
    var active = cat === currentCategory ? "btn-warning" : "btn-outline-secondary";
    html += '<button class="btn btn-sm rounded-pill ' + active + ' flex-shrink-0" onclick="filterCategory(\'' + cat + '\')">' + cat + "</button>";
  });
  container.innerHTML = html;
}

function filterCategory(cat) {
  currentCategory = cat;
  buildCategoryTabs();
  renderMenu();
}

// ============================================================
// メニュー描画（一括 DOM 更新）
// ============================================================
function renderMenu() {
  var container = document.getElementById("menu-items");
  var items = currentCategory === "ALL" ? allMenuItems : allMenuItems.filter(function (i) { return i.category === currentCategory; });
  var html = "";
  items.forEach(function (item) {
    var imgSrc = item.image ? convertDriveUrl(item.image) : "https://via.placeholder.com/300x200?text=No+Image";
    var soldOutClass = item.isSoldOut ? "opacity-50" : "";
    var soldOutBadge = item.isSoldOut ? '<span class="badge bg-danger position-absolute top-0 end-0 m-2">売切</span>' : "";
    var btnDisabled = item.isSoldOut ? "disabled" : "";
    html += '<div class="col-6">' +
      '<div class="card h-100 shadow-sm ' + soldOutClass + '" style="cursor:pointer;" onclick="addToCart(\'' + item.id + '\')">' +
      '<div class="position-relative">' +
      '<img src="' + imgSrc + '" class="card-img-top" style="height:140px; object-fit:cover;" alt="' + item.name + '">' +
      soldOutBadge +
      "</div>" +
      '<div class="card-body p-2">' +
      '<p class="card-title fw-bold mb-1 small">' + item.name + "</p>" +
      '<p class="text-warning fw-bold mb-0">¥' + item.price + "</p>" +
      "</div>" +
      "</div></div>";
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
  var item = allMenuItems.find(function (i) { return i.id === itemId; });
  if (!item || item.isSoldOut) return;

  if (item.optionsStr) {
    showOptionModal(item);
    return;
  }

  cart.push({ id: item.id, name: item.name, price: item.price, options: [] });
  updateCartBadge();
  showToast(item.name + " をカートに追加しました");
}

function showOptionModal(item) {
  currentOptionItem = item;
  document.getElementById("option-item-name").textContent = item.name;
  var list = document.getElementById("option-list");
  var opts = item.optionsStr.split(",");
  var html = "";
  opts.forEach(function (opt) {
    var parts = opt.trim().split(":");
    if (parts.length === 2) {
      var name = parts[0].trim();
      var price = Number(parts[1].trim());
      html += '<div class="form-check mb-2">' +
        '<input class="form-check-input" type="checkbox" value="' + name + '" data-price="' + price + '" id="opt-' + name + '">' +
        '<label class="form-check-label" for="opt-' + name + '">' + name + (price > 0 ? " (+¥" + price + ")" : "") + "</label></div>";
    }
  });
  list.innerHTML = html;
  new bootstrap.Modal(document.getElementById("optionModal")).show();
}

function addWithOptions() {
  if (!currentOptionItem) return;
  var checks = document.querySelectorAll("#option-list .form-check-input:checked");
  var options = [];
  var extra = 0;
  checks.forEach(function (c) {
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
  bootstrap.Modal.getInstance(document.getElementById("optionModal")).hide();
  showToast(currentOptionItem.name + " をカートに追加しました");
  currentOptionItem = null;
}

function updateCartBadge() {
  var badge = document.getElementById("cart-badge");
  if (cart.length > 0) {
    badge.textContent = cart.length;
    badge.style.display = "inline";
  } else {
    badge.style.display = "none";
  }
}

function openCart() {
  var container = document.getElementById("cart-items");
  if (cart.length === 0) {
    container.innerHTML = '<p class="text-muted text-center">カートは空です</p>';
    document.getElementById("cart-total").textContent = "¥0";
  } else {
    var html = "";
    var total = 0;
    cart.forEach(function (item, idx) {
      total += item.price;
      html += '<div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">' +
        "<div><strong>" + item.name + '</strong><br><small class="text-warning">¥' + item.price + "</small></div>" +
        '<button class="btn btn-sm btn-outline-danger" onclick="removeFromCart(' + idx + ')"><i class="bi bi-trash"></i></button></div>';
    });
    container.innerHTML = html;
    document.getElementById("cart-total").textContent = "¥" + total;
  }
  new bootstrap.Modal(document.getElementById("cartModal")).show();
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

  var userId = "";
  var userName = "ゲスト";
  try {
    var profile = liff.getDecodedIDToken();
    if (profile) {
      userId = profile.sub || "";
      userName = profile.name || "ゲスト";
    }
  } catch (e) {}

  var orderItems = cart.map(function (item) {
    return { name: item.name, price: item.price };
  });

  fetch(GAS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "placeOrder",
      userId: userId,
      userName: userName,
      tableId: tableId,
      items: orderItems
    })
  })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d.status === "success") {
        var orderedItems = cart.slice();
        cart = [];
        updateCartBadge();
        bootstrap.Modal.getInstance(document.getElementById("cartModal")).hide();
        showMessage("注文完了", "ご注文ありがとうございます！<br>オーダーID: " + d.orderId);
        historyCache = null;
        handleOrderSuccess(orderedItems, userId);
      } else {
        showMessage("エラー", "注文に失敗しました。もう一度お試しください。");
      }
    })
    .catch(function (err) {
      console.error("Order error:", err);
      showMessage("エラー", "通信エラーが発生しました。");
    });
}

function handleOrderSuccess(items, userId) {
  if (!userId) {
    try {
      var profile = liff.getDecodedIDToken();
      if (profile) userId = profile.sub || "";
    } catch (e) {}
  }
  if (userId) {
    preloadHistoryData(userId);
    startAiAnalysis(items, userId);
  }
}

// ============================================================
// AI ソムリエ分析
// ============================================================
function startAiAnalysis(items, userId) {
  var stats = items.map(function (i) { return i.name; });

  preloadHistoryData(userId);

  setTimeout(function () {
    var history = historyCache || [];
    fetch(GAS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "getAiComment",
        stats: stats,
        history: history,
        userId: userId
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.status === "success" && d.comment) {
          showAiComment(d.comment);
        }
      })
      .catch(function (err) {
        console.error("AI comment error:", err);
      });
  }, 1000);
}

function showAiComment(comment) {
  var el = document.getElementById("ai-comment");
  el.innerHTML = "";
  var modal = new bootstrap.Modal(document.getElementById("aiModal"));
  modal.show();
  typeWriter(el, comment, 0);
}

function typeWriter(el, text, idx) {
  if (idx < text.length) {
    el.innerHTML += text.charAt(idx);
    setTimeout(function () { typeWriter(el, text, idx + 1); }, 30);
  }
}

// ============================================================
// 注文履歴
// ============================================================
function openHistory() {
  var modal = new bootstrap.Modal(document.getElementById("historyModal"));
  modal.show();

  if (historyCache) {
    renderHistory(historyCache);
    return;
  }

  var userId = "";
  try {
    var profile = liff.getDecodedIDToken();
    if (profile) userId = profile.sub || "";
  } catch (e) {}

  if (!userId) {
    document.getElementById("history-items").innerHTML = '<p class="text-muted text-center">ログインが必要です</p>';
    return;
  }

  preloadHistoryData(userId);
  setTimeout(function () {
    renderHistory(historyCache || []);
  }, 1500);
}

function preloadHistoryData(userId) {
  if (historyCache) return;
  fetch(GAS_API_URL + "?action=getHistory&userId=" + encodeURIComponent(userId))
    .then(function (r) { return r.json(); })
    .then(function (d) {
      historyCache = d;
    })
    .catch(function (e) { console.error("History preload error:", e); });
}

function renderHistory(data) {
  var container = document.getElementById("history-items");
  if (!data || data.length === 0) {
    container.innerHTML = '<p class="text-muted text-center">注文履歴はありません</p>';
    return;
  }
  var html = "";
  data.forEach(function (item) {
    html += '<div class="d-flex justify-content-between align
