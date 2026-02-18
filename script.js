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
      var cached = localStorage.getItem("MO_MENU_CACHE");
      if (cached) {
        try {
          allMenuItems = JSON.parse(cached);
          buildCategoryTabs();
          renderMenu();
        } catch (e) {}
      }
      document.getElementById("menu-skeleton").style.display = "none";
      document.getElementById("menu-container").style.display = "block";
      document.getElementById("loading-overlay").style.display = "none";
    });

  setTimeout(function () {
    var skeleton = document.getElementById("menu-skeleton");
    if (skeleton && skeleton.style.display !== "none") {
      skeleton.style.display = "none";
      document.getElementById("menu-container").style.display = "block";
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
    html += '<div class="col-6">' +
      '<div class="card h-100 shadow-sm ' + soldOutClass + '" style="cursor:pointer;" onclick="addToCart(\'' + item.id + '\')">' +
      '<div class="position-relative">' +
      '<img src="' + imgSrc + '" class="card-img-top" style="height:140px; object-fit:cover;" alt="' + item.name + '">' +
      soldOutBadge +
      "</div>" +
      '<div class="card-body p-2">' +
      '<p class="card-title fw-bold mb-1 small">' + item.name + "</p>" +
      '<p class="text-warning fw-bold mb-0">&yen;' + item.price + "</p>" +
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
        '<label class="form-check-label" for="opt-' + name + '">' + name + (price > 0 ? " (+&yen;" + price + ")" : "") + "</label></div>";
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
    document.getElementById("cart-total").textContent = "&yen;0";
  } else {
    var html = "";
    var total = 0;
    cart.forEach(function (item, idx) {
      total += item.price;
      html += '<div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">' +
        "<div><strong>" + item.name + "</strong><br><small class='text-warning'>&yen;" + item.price + "</small></div>" +
        '<button class="btn btn-sm btn-outline-danger" onclick="removeFromCart(' + idx + ')"><i class="bi bi-trash"></i></button></div>';
    });
    container.innerHTML = html;
    document.getElementById("cart-total").textContent = "&yen;" + total;
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
    html += '<div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">' +
      "<div><strong>" + item.itemName + "</strong><br><small class='text-muted'>" + item.timestamp + "</small></div>" +
      "<span class='text-warning fw-bold'>&yen;" + item.price + "</span></div>";
  });
  container.innerHTML = html;
}

// ============================================================
// My Taste
// ============================================================
function openMyPage() {
  var modal = new bootstrap.Modal(document.getElementById("myPageModal"));
  modal.show();

  if (myTasteCache) {
    renderMyTasteFromCache(myTasteCache);
    return;
  }

  var userId = "";
  try {
    var profile = liff.getDecodedIDToken();
    if (profile) userId = profile.sub || "";
  } catch (e) {}

  if (!userId) return;

  if (!historyCache) {
    preloadHistoryData(userId);
  }

  setTimeout(function () {
    var history = historyCache || [];
    if (history.length === 0) {
      document.getElementById("my-taste-text").innerHTML = "<p>注文履歴がまだありません。</p>";
      return;
    }

    var tasteData = calculateTasteData(history);
    renderTasteChart(tasteData);
    fetchAiTasteComment(tasteData, history);
  }, 1500);
}

function calculateTasteData(history) {
  var totals = { salty: 0, sweet: 0, sour: 0, bitter: 0, rich: 0 };
  var count = 0;

  history.forEach(function (h) {
    var item = allMenuItems.find(function (m) { return m.name === h.itemName; });
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

  if (tasteChartInstance) {
    tasteChartInstance.destroy();
  }

  tasteChartInstance = new Chart(ctx, {
    type: "radar",
    data: {
      labels: ["塩味", "甘味", "酸味", "苦味", "コク"],
      datasets: [{
        label: "My Taste",
        data: [data.salty, data.sweet, data.sour, data.bitter, data.rich],
        backgroundColor: "rgba(255,152,0,0.3)",
        borderColor: "#ff9800",
        borderWidth: 2,
        pointBackgroundColor: "#ff9800"
      }]
    },
    options: {
      scales: {
        r: {
          beginAtZero: true,
          max: 10,
          ticks: { stepSize: 2 }
        }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function fetchAiTasteComment(tasteData, history) {
  var commentBox = document.getElementById("my-taste-text");
  commentBox.innerHTML = '<p class="text-muted">AI が分析中...</p>';

  var cardArea = document.getElementById("my-taste-recommendation");
  if (cardArea) cardArea.innerHTML = "";

  var shareBtnHide = document.getElementById("share-btn-area");
  if (shareBtnHide) shareBtnHide.style.display = "none";

  fetch(GAS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "getTasteAnalysis",
      tasteData: tasteData,
      history: history
    })
  })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d.status === "success" && d.analysis) {
        var htmlContent = d.analysis.replace(/\n/g, "<br>");
        commentBox.innerHTML = htmlContent;

        myTasteCache = { tasteData: tasteData, analysis: d.analysis };

        var shareBtn = document.getElementById("share-btn-area");
        if (shareBtn) shareBtn.style.display = "block";
      } else {
        commentBox.innerHTML = "<p>分析結果を取得できませんでした。</p>";
      }
    })
    .catch(function (err) {
      console.error("Taste analysis error:", err);
      commentBox.innerHTML = "<p>通信エラーが発生しました。</p>";
    });
}

function renderMyTasteFromCache(cache) {
  renderTasteChart(cache.tasteData);
  var commentBox = document.getElementById("my-taste-text");
  var htmlContent = cache.analysis.replace(/\n/g, "<br>");
  commentBox.innerHTML = htmlContent;

  var shareBtn = document.getElementById("share-btn-area");
  if (shareBtn) shareBtn.style.display = "block";
}

// ============================================================
// シェア画像生成 & Google Drive 保存
// ============================================================
function generateTasteImage() {
  var modal = new bootstrap.Modal(document.getElementById("shareImageModal"));
  modal.show();

  document.getElementById("share-loading").style.display = "block";
  document.getElementById("share-result").style.display = "none";

  var canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  var ctx = canvas.getContext("2d");

  // 背景グラデーション
  var grad = ctx.createLinearGradient(0, 0, 0, 1920);
  grad.addColorStop(0, "#1a1a2e");
  grad.addColorStop(0.5, "#16213e");
  grad.addColorStop(1, "#0f3460");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1080, 1920);

  // 装飾グロー
  ctx.beginPath();
  ctx.arc(540, 700, 350, 0, Math.PI * 2);
  var glow = ctx.createRadialGradient(540, 700, 0, 540, 700, 350);
  glow.addColorStop(0, "rgba(255,152,0,0.15)");
  glow.addColorStop(1, "rgba(255,152,0,0)");
  ctx.fillStyle = glow;
  ctx.fill();

  // 店名ヘッダー
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "36px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("茶飯事Bar", 540, 100);

  ctx.fillStyle = "#ff9800";
  ctx.font = "bold 56px sans-serif";
  ctx.fillText("My Taste 診断結果", 540, 180);

  // レーダーチャート描画
  var labels = ["塩味", "甘味", "酸味", "苦味", "コク"];
  var scores = [3, 3, 3, 3, 3];
  if (tasteChartInstance && tasteChartInstance.data) {
    scores = tasteChartInstance.data.datasets[0].data;
  }
  var cx = 540;
  var cy = 620;
  var radius = 220;
  var angleStep = (Math.PI * 2) / 5;
  var startAngle = -Math.PI / 2;

  // グリッド線
  var level, i, angle, r, px, py;
  for (level = 1; level <= 5; level++) {
    ctx.beginPath();
    for (i = 0; i <= 5; i++) {
      angle = startAngle + angleStep * (i % 5);
      r = radius * (level / 5);
      px = cx + r * Math.cos(angle);
      py = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // 軸線
  for (i = 0; i < 5; i++) {
    angle = startAngle + angleStep * i;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.stroke();
  }

  // データ領域
  ctx.beginPath();
  for (i = 0; i < 5; i++) {
    angle = startAngle + angleStep * i;
    var val = Math.min(scores[i] || 0, 10);
    var r2 = radius * (val / 10);
    px = cx + r2 * Math.cos(angle);
    py = cy + r2 * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = "rgba(255,152,0,0.3)";
  ctx.fill();
  ctx.strokeStyle = "#ff9800";
  ctx.lineWidth = 3;
  ctx.stroke();

  // データ点 & ラベル
  for (i = 0; i < 5; i++) {
    angle = startAngle + angleStep * i;
    val = Math.min(scores[i] || 0, 10);
    r2 = radius * (val / 10);
    px = cx + r2 * Math.cos(angle);
    py = cy + r2 * Math.sin(angle);

    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#ff9800";
    ctx.fill();

    var lx = cx + (radius + 40) * Math.cos(angle);
    var ly = cy + (radius + 40) * Math.sin(angle);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 30px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(labels[i], lx, ly);
  }

  // 称号
  var personaEl = document.querySelector("#my-taste-text strong");
  var persona = personaEl ? personaEl.textContent : "";
  var yPos = 920;

  if (persona) {
    ctx.fillStyle = "rgba(255,152,0,0.2)";
    drawRoundRect(ctx, 190, yPos - 40, 700, 70, 35);
    ctx.fill();
    ctx.strokeStyle = "#ff9800";
    ctx.lineWidth = 2;
    drawRoundRect(ctx, 190, yPos - 40, 700, 70, 35);
    ctx.stroke();

    ctx.fillStyle = "#ff9800";
    ctx.font = "bold 44px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(persona, 540, yPos + 5);
    yPos += 80;
  }

  // コメント詳細
  var commentEl = document.getElementById("my-taste-text");
  var commentText = "";
  if (commentEl) {
    var clone = commentEl.cloneNode(true);
    var strongTag = clone.querySelector("strong");
    if (strongTag) strongTag.remove();
    commentText = clone.textContent.trim();
  }

  if (commentText) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "28px sans-serif";
    ctx.textAlign = "center";
    var lines = wrapTextForShare(ctx, commentText, 900);
    for (i = 0; i < lines.length && i < 12; i++) {
      ctx.fillText(lines[i], 540, yPos + 50 + i * 42);
    }
  }

  // フッター
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = "28px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("AIソムリエがあなたの味覚を分析しました", 540, 1820);
  ctx.fillText("茶飯事Bar x AI", 540, 1870);

  // Base64変換 & GAS送信
  var dataUrl = canvas.toDataURL("image/png");
  var base64 = dataUrl.replace(/^data:image\/png;base64,/, "");

  fetch(GAS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "saveShareImage", imageData: base64 })
  })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      document.getElementById("share-loading").style.display = "none";
      if (d.status === "success") {
        document.getElementById("share-result").style.display = "block";
        document.getElementById("share-preview-img").src = d.url;
        document.getElementById("share-direct-link").href = d.url;
      } else {
        alert("画像保存に失敗しました。もう一度お試しください。");
      }
    })
    .catch(function (e) {
      document.getElementById("share-loading").style.display = "none";
      alert("通信エラーが発生しました。");
      console.error(e);
    });
}

function wrapTextForShare(ctx, text, maxWidth) {
  var lines = [];
  var current = "";
  for (var i = 0; i < text.length; i++) {
    var test = current + text[i];
    if (ctx.measureText(test).width > maxWidth) {
      lines.push(current);
      current = text[i];
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ============================================================
// 会計
// ============================================================
function openCheckout() {
  new bootstrap.Modal(document.getElementById("checkoutModal")).show();
}

function executeCheckout() {
  fetch(GAS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "checkout", tableId: tableId })
  })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      bootstrap.Modal.getInstance(document.getElementById("checkoutModal")).hide();
      if (data.status === "success") {
        historyCache = null;
        showMessage(
          "Staff Called",
          "店員をお呼びしました。<br>そのままお席でお待ちください。<br><br><small style='color:#888;'>明日、LINEであなた専用のメッセージをお届けしますね。</small>"
        );
        setTimeout(function () { location.reload(); }, 3000);
      } else {
        showMessage("エラー", "通信エラーが発生しました。");
      }
    })
    .catch(function (err) {
      console.error("Checkout error:", err);
      showMessage("エラー", "通信エラーが発生しました。");
    });
}

// ============================================================
// ユーティリティ
// ============================================================
function showMessage(title, body) {
  document.getElementById("msg-title").textContent = title;
  document.getElementById("msg-body").innerHTML = body;
  new bootstrap.Modal(document.getElementById("msgModal")).show();
}

function showToast(msg) {
  var toast = document.createElement("div");
  toast.className = "toast-notification";
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(function () { toast.classList.add("show"); }, 100);
  setTimeout(function () { toast.classList.remove("show"); }, 2000);
  setTimeout(function () { toast.remove(); }, 2500);
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ============================================================
// 起動
// ============================================================
initializeLiff();
