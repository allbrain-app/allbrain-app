let cart = [];
let allMenuItems = [];
let currentCategory = 'ALL';
let confirmModal, messageModal, recommendModal, historyModal, myPageModal, optionModal, tableModal, checkoutConfirmModal, resetTableModal;
let tasteChartInstance = null;
let shouldReload = false;
let currentTableId = null;

let pendingItem = null; 
const PLACEHOLDER_IMG = "https://placehold.co/100x100/eeeeee/999999?text=No+Img";

// ★高速化用キャッシュ変数
let historyCache = null;
let myTasteCache = null;
let isHistoryLoading = false;

// 初期化処理
window.onload = function() {
  if (typeof MY_LIFF_ID === 'undefined' || typeof GAS_API_URL === 'undefined') {
    if(document.getElementById('messageModal')) {
       messageModal = new bootstrap.Modal(document.getElementById('messageModal'));
       showMessage("Config Error", "config.js が見つかりません");
    } else {
       alert("config.js が見つかりません");
    }
    return;
  }

  confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));
  messageModal = new bootstrap.Modal(document.getElementById('messageModal'));
  recommendModal = new bootstrap.Modal(document.getElementById('recommendModal'));
  historyModal = new bootstrap.Modal(document.getElementById('historyModal'));
  myPageModal = new bootstrap.Modal(document.getElementById('myPageModal'));
  optionModal = new bootstrap.Modal(document.getElementById('optionModal'));
  tableModal = new bootstrap.Modal(document.getElementById('tableModal'));
  checkoutConfirmModal = new bootstrap.Modal(document.getElementById('checkoutConfirmModal'));
  resetTableModal = new bootstrap.Modal(document.getElementById('resetTableModal'));

  checkTableId();
};

function checkTableId() {
  const urlParams = new URLSearchParams(window.location.search);
  const paramTableId = urlParams.get('table');

  if (paramTableId) {
    currentTableId = paramTableId;
    localStorage.setItem('MO_TABLE_ID', currentTableId);
    initializeLiff(); 
  } else {
    const savedTableId = localStorage.getItem('MO_TABLE_ID');
    if (savedTableId) {
      currentTableId = savedTableId;
      initializeLiff(); 
    } else {
      tableModal.show();
    }
  }
}

function saveTableId() {
  const inputVal = document.getElementById('input-table-id').value.trim();
  if (!inputVal) {
    document.getElementById('input-table-id').classList.add('is-invalid');
    return;
  }
  currentTableId = inputVal;
  localStorage.setItem('MO_TABLE_ID', currentTableId);
  
  tableModal.hide();
  initializeLiff(); 
}

function openResetTableModal() {
    resetTableModal.show();
}

function executeResetTable() {
    localStorage.removeItem('MO_TABLE_ID');
    location.href = location.pathname; 
}

function initializeLiff() {
  var cached = localStorage.getItem('MO_MENU_CACHE');
  if (cached) {
    try {
      allMenuItems = JSON.parse(cached);
      initCategoryTabs(allMenuItems);
      renderMenu();
    } catch(e) {}
  }

  liff.init({ liffId: MY_LIFF_ID })
    .then(function() {
      if (!liff.isLoggedIn()) {
        liff.login({ redirectUri: location.href });
      } else {
        liff.getProfile().then(function(p) {
          document.getElementById('user-info').innerText = 'Table: ' + currentTableId + ' / Guest: ' + p.displayName;
          fetchInitData(p.userId, p.displayName);
          preloadHistoryData(p.userId);
        });
      }
    })
    .catch(function(err) { showMessage("Error", "LIFF Init failed: " + err.message); });
}

function preloadHistoryData(userId) {
    if (isHistoryLoading) return;
    isHistoryLoading = true;
    const url = `${GAS_API_URL}?action=getHistory&userId=${userId}`;
    fetch(url)
      .then(res => res.json())
      .then(data => {
          historyCache = data;
          isHistoryLoading = false;
          console.log("History preloaded.");
      })
      .catch(err => {
          console.error("Preload error", err);
          isHistoryLoading = false;
      });
}

function fetchInitData(userId, displayName) {
  fetch(GAS_API_URL + "?action=getInitData&userId=" + userId)
    .then(function(res) {
      if (!res.ok) throw new Error("Network error");
      return res.text().then(function(text) {
        try { return JSON.parse(text); }
        catch(e) { throw new Error("Data Error"); }
      });
    })
    .then(function(data) {
      if (data.status === 'error') throw new Error(data.message);

      allMenuItems = data.menu;
      localStorage.setItem('MO_MENU_CACHE', JSON.stringify(data.menu));
      initCategoryTabs(allMenuItems);
      renderMenu();

      showGreetingToast(displayName, data.profile);
    })
    .catch(function(err) {
      if (allMenuItems.length === 0) {
        document.getElementById('menu-list').innerHTML = '<div class="text-danger text-center mt-5">' + err.message + '</div>';
      }
    });
}

function initCategoryTabs(items) {
  const categories = new Set();
  items.forEach(item => { if(item.category) categories.add(item.category); });
  const tabContainer = document.getElementById('category-tabs');
  let html = `<li class="nav-item"><a class="nav-link active" href="#" onclick="filterCategory('ALL', this); return false;">ALL</a></li>`;
  categories.forEach(cat => {
    html += `<li class="nav-item"><a class="nav-link" href="#" onclick="filterCategory('${cat}', this); return false;">${cat}</a></li>`;
  });
  tabContainer.innerHTML = html;
}

function filterCategory(category, element) {
  currentCategory = category;
  document.querySelectorAll('#category-tabs .nav-link').forEach(el => el.classList.remove('active'));
  element.classList.add('active');
  renderMenu();
}

function renderMenu() {
  var container = document.getElementById('menu-list');
  var itemsToShow = (currentCategory === 'ALL') ? allMenuItems : allMenuItems.filter(function(item) { return item.category === currentCategory; });

  if (itemsToShow.length === 0) {
    container.innerHTML = '<div class="text-secondary text-center mt-5">該当する商品がありません</div>';
    return;
  }

  var html = '';
  for (var i = 0; i < itemsToShow.length; i++) {
    var item = itemsToShow[i];
    var isSoldOut = item.isSoldOut;
    var btnState = isSoldOut ? 'disabled' : '';
    var btnText = isSoldOut ? 'SOLD OUT' : '追加';
    var btnClass = isSoldOut ? 'btn-secondary' : 'btn-add';
    var cardOpacity = isSoldOut ? 'opacity: 0.6;' : '';
    var imgUrl = convertDriveUrl(item.image);

    html += '<div class="card" style="' + cardOpacity + '">'
      + '<div class="card-body-custom">'
      + '<div class="img-area"><img src="' + imgUrl + '" alt="' + item.name + '" onerror="this.onerror=null; this.src=\'' + PLACEHOLDER_IMG + '\';"></div>'
      + '<div class="text-area">'
      + '<div class="item-name">' + item.name + (isSoldOut ? '<span class="badge bg-danger ms-1" style="font-size:0.5em;">売切</span>' : '') + '</div>'
      + '<div class="item-flavor">' + item.flavor + '</div>'
      + '<div class="item-price">¥' + item.price + '</div>'
      + '</div>'
      + '<div class="btn-area"><button class="btn ' + btnClass + '" onclick="addToCart(\'' + item.id + '\')" ' + btnState + '>' + btnText + '</button></div>'
      + '</div></div>';
  }
  container.innerHTML = html;
}

function convertDriveUrl(url) {
  if (!url) return PLACEHOLDER_IMG;
  if (url.includes("/folders/")) return PLACEHOLDER_IMG;
  let match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) match = url.match(/id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return `https://drive.google.com/uc?export=view&id=${match[1]}`;
  return url;
}

function addToCart(id) {
  const item = allMenuItems.find(m => String(m.id) === String(id));
  if (!item) return;

  if (item.optionsStr && item.optionsStr.trim() !== "") {
    openOptionModal(item);
  } else {
    cart.push({ id: item.id, name: item.name, price: item.price, options: [] });
    updateCartUI();
  }
}

function openOptionModal(item) {
  if (!optionModal) optionModal = new bootstrap.Modal(document.getElementById('optionModal'));
   
  pendingItem = item;
  document.getElementById('optionModalTitle').innerText = item.name;
   
  const options = item.optionsStr.split(',').map(s => {
    const parts = s.split(':');
    return { name: parts[0], price: Number(parts[1] || 0) };
  });

  const container = document.getElementById('option-container');
  container.innerHTML = '';

  options.forEach((opt, index) => {
    const html = `
      <div class="form-check py-2 border-bottom">
        <input class="form-check-input option-check" type="checkbox" 
               id="opt-${index}" value="${index}" onchange="calcOptionTotal()">
        <label class="form-check-label w-100 d-flex justify-content-between" for="opt-${index}">
          <span>${opt.name}</span>
          <span>+¥${opt.price}</span>
        </label>
      </div>
    `;
    container.innerHTML += html;
  });

  calcOptionTotal();
  optionModal.show();
}

function calcOptionTotal() {
  if (!pendingItem) return;
  let total = pendingItem.price;
   
  const checkboxes = document.querySelectorAll('.option-check:checked');
  const optionsList = pendingItem.optionsStr.split(',').map(s => {
    const parts = s.split(':');
    return { name: parts[0], price: Number(parts[1] || 0) };
  });

  checkboxes.forEach(cb => {
    const idx = parseInt(cb.value);
    total += optionsList[idx].price;
  });

  document.getElementById('option-total-price').innerText = "合計: ¥" + total;
}

function confirmOptionAdd() {
  if (!pendingItem) return;
   
  const checkboxes = document.querySelectorAll('.option-check:checked');
  const optionsList = pendingItem.optionsStr.split(',').map(s => {
    const parts = s.split(':');
    return { name: parts[0], price: Number(parts[1] || 0) };
  });

  let addedOptions = [];
  let finalPrice = pendingItem.price;
  let displayName = pendingItem.name;

  if (checkboxes.length > 0) {
    const optNames = [];
    checkboxes.forEach(cb => {
      const idx = parseInt(cb.value);
      const opt = optionsList[idx];
      addedOptions.push(opt);
      optNames.push(opt.name);
      finalPrice += opt.price;
    });
    displayName += ` (${optNames.join(', ')})`;
  }

  cart.push({ 
    id: pendingItem.id, 
    name: displayName, 
    price: finalPrice, 
    options: addedOptions 
  });

  updateCartUI();
  optionModal.hide();
  pendingItem = null;
}

function updateCartUI() {
  document.getElementById('cart-count').innerText = cart.length;
  document.getElementById('cart-total').innerText = "¥" + cart.reduce((sum, item) => sum + item.price, 0);
  if (cart.length > 0) document.getElementById('cart-bar').style.display = 'flex';
  else document.getElementById('cart-bar').style.display = 'none';
}

function showConfirmModal() {
  const container = document.getElementById('cart-items-container');
  container.innerHTML = "";
   
  if (cart.length === 0) {
    container.innerHTML = "<div class='text-center text-muted'>カートは空です</div>";
    document.getElementById('btn-final-order').disabled = true;
  } else {
    document.getElementById('btn-final-order').disabled = false;
    let total = 0;
    cart.forEach((item, index) => {
      total += item.price;
      container.innerHTML += `
        <div class="cart-list-item">
          <div>
            <div style="font-weight:bold;">${item.name}</div>
            <div class="text-muted small">¥${item.price}</div>
          </div>
          <button class="btn-delete" onclick="removeFromCart(${index})">×</button>
        </div>
      `;
    });
    document.getElementById('cart-grand-total').innerText = "合計: ¥" + total;
  }
  confirmModal.show();
}

function removeFromCart(index) {
  cart.splice(index, 1);
  updateCartUI(); 
  showConfirmModal(); 
  if(cart.length === 0) confirmModal.hide();
}

function executeOrder() {
  confirmModal.hide(); 
  
  if (!recommendModal) recommendModal = new bootstrap.Modal(document.getElementById('recommendModal'));
  const textElem = document.getElementById('recommendation-text');
  const loadingElem = document.getElementById('recommendation-loading');
  const itemContainer = document.getElementById('recommendation-item-container');
  const cardArea = document.getElementById('recommendation-card-area');
  
  recommendModal.show();
  if(textElem) textElem.style.display = 'none';
  if(loadingElem) {
      loadingElem.style.display = 'block';
      const loadingText = loadingElem.querySelector('p');
      if(loadingText) loadingText.innerText = "ご注文を送信しています...";
  }
  if(itemContainer) itemContainer.style.display = 'none';
  if(cardArea) cardArea.innerHTML = "";

  const lastOrderedItems = [...cart];

  const payload = { 
    accessToken: liff.getAccessToken(), 
    items: cart,
    tableId: currentTableId 
  };

  fetch(GAS_API_URL, {
    method: "POST",
    body: JSON.stringify(payload)
  })
  .then(r => r.text().then(t => ({ok: r.ok, text: t})))
  .then(res => {
    let data;
    try { data = JSON.parse(res.text); }
    catch(e) {
      if(res.text.includes("success") || res.text.includes("注文完了")) {
          handleOrderSuccess(lastOrderedItems);
          return;
      }
      throw new Error("通信エラー");
    }
    
    if(data.status === "success"){
        handleOrderSuccess(lastOrderedItems);
    } else { 
        recommendModal.hide();
        showMessage("Error", data.message);
    }
  })
  .catch(err => {
     recommendModal.hide();
     showMessage("Error", err.message);
  });
}

function handleOrderSuccess(items) {
    shouldReload = true;
    cart = [];
    updateCartUI();

    historyCache = null;
    myTasteCache = null;

    liff.getProfile().then(function(p) {
      preloadHistoryData(p.userId);
      startAiAnalysis(items, p.userId);
    });

    const loadingElem = document.getElementById('recommendation-loading');
    if (loadingElem) {
        const loadingText = loadingElem.querySelector('p');
        if (loadingText) loadingText.innerText = "AIソムリエが分析中...";
    }
}

function startAiAnalysis(orderedItems, userId) {
    const textElem = document.getElementById('recommendation-text');
    const loadingElem = document.getElementById('recommendation-loading');

    const itemNames = orderedItems.map(i => i.name);
    const currentStats = calculateStats(itemNames);

    const payload = {
        action: "getAiComment",
        stats: currentStats,
        history: itemNames,
        userId: userId
    };

    fetch(GAS_API_URL, {
        method: "POST",
        body: JSON.stringify(payload)
    })
    .then(r => r.json())
    .then(res => {
        if(loadingElem) loadingElem.style.display = 'none';
        if(textElem) textElem.style.display = 'block';

        if (res.status === "success") {
            try {
                const aiData = JSON.parse(res.message);
                typeWriter(textElem, aiData.message || "おすすめをご用意しました。");
                if (aiData.recommendItemName) {
                    renderRecommendCard(aiData.recommendItemName);
                }
            } catch (e) {
                typeWriter(textElem, res.message);
            }
        } else {
            textElem.innerText = "通信エラーが発生しました。";
        }
    })
    .catch(err => {
        if(loadingElem) loadingElem.style.display = 'none';
        if(textElem) {
            textElem.style.display = 'block';
            textElem.innerText = "システムエラーが発生しました。";
        }
        console.error(err);
    });
}

function renderRecommendCard(targetItemName) {
    const itemContainer = document.getElementById('recommendation-item-container');
    const cardArea = document.getElementById('recommendation-card-area');
    
    const item = allMenuItems.find(m => m.name.trim() === targetItemName.trim());

    if (!item) {
        console.log("推奨商品は見つかりませんでした: " + targetItemName);
        return; 
    }

    const imgUrl = convertDriveUrl(item.image);
    
    const html = `
      <div class="card border-0 shadow-sm" style="overflow:hidden;">
        <div class="d-flex align-items-center p-2">
          <div class="flex-shrink-0">
            <img src="${imgUrl}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;" onerror="this.src='${PLACEHOLDER_IMG}'">
          </div>
          <div class="ms-3 flex-grow-1 text-start" style="min-width: 0;">
            <div class="fw-bold text-dark text-truncate" style="font-size: 0.9rem;">${item.name}</div>
            <div class="text-primary fw-bold small">¥${item.price}</div>
          </div>
          <div class="ms-2 flex-shrink-0">
            <button class="btn btn-sm btn-primary px-3 rounded-pill" style="font-size: 0.8rem; white-space: nowrap;" onclick="addItemFromRecommend('${item.id}')">
              追加
            </button>
          </div>
        </div>
      </div>
    `;

    cardArea.innerHTML = html;
    setTimeout(() => {
        itemContainer.style.display = 'block';
        itemContainer.classList.add('fade-in-up'); 
    }, 1000); 
}

function addItemFromRecommend(itemId) {
    recommendModal.hide();
    const item = allMenuItems.find(m => String(m.id) === String(itemId));
    if (!item) return;

    if (item.optionsStr && item.optionsStr.trim() !== "") {
        setTimeout(() => { addToCart(itemId); }, 300);
    } else {
        addToCart(itemId);
        setTimeout(() => { showConfirmModal(); }, 300);
    }
}

function showMessage(title, body) {
  document.getElementById('messageModalTitle').innerText = title;
  document.getElementById('messageModalBody').innerHTML = body;
  messageModal.show();
}

function finishOrderFlow() {
  recommendModal.hide();
  showMessage("Thanks!", "ご注文ありがとうございました。<br>料理の到着をお待ちください。");
}

function closeRecommendation() {
    recommendModal.hide();
    showMessage("Thanks!", "ご注文ありがとうございました。<br>料理の到着をお待ちください。");
}

function openHistoryModal() {
  if (!historyModal) historyModal = new bootstrap.Modal(document.getElementById('historyModal'));
  historyModal.show();
  
  if (historyCache) {
      renderHistory(historyCache);
  } else {
      fetchHistoryData();
  }
}

function switchHistoryTab(tabName) {
  document.querySelectorAll('#history-tabs .nav-link').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('tab-current').style.display = (tabName === 'current') ? 'block' : 'none';
  document.getElementById('tab-past').style.display = (tabName === 'past') ? 'block' : 'none';
}

function fetchHistoryData() {
  const currentContainer = document.getElementById('current-order-list');
  currentContainer.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-secondary"></div></div>';
  
  if (!liff.isLoggedIn()) { 
      currentContainer.innerHTML = '<div class="text-center text-danger">ログインが必要です</div>'; 
      return; 
  }
  
  liff.getProfile().then(profile => {
    const url = `${GAS_API_URL}?action=getHistory&userId=${profile.userId}`;
    fetch(url)
      .then(res => res.json())
      .then(data => { 
          historyCache = data;
          renderHistory(data); 
      })
      .catch(err => {
        currentContainer.innerHTML = `<div class="text-danger text-center">エラー: ${err.message}</div>`;
      });
  });
}

function renderHistory(data) {
  const currentContainer = document.getElementById('current-order-list');
  const totalDisplay = document.getElementById('current-total-price');
  const checkoutBtn = document.getElementById('btn-checkout');
  
  if (data.current.length === 0) {
    currentContainer.innerHTML = '<div class="text-center text-secondary py-3">現在のご注文はありません</div>';
    totalDisplay.innerText = "¥0";
    checkoutBtn.disabled = true;
    checkoutBtn.innerText = "お会計対象なし";
  } else {
    let html = '';
    let total = 0;
    let isRequesting = false;
    data.current.forEach(item => {
      total += Number(item.price);
      if (item.status === 'PAY_REQ') isRequesting = true;
      html += `<div class="history-item-row"><div>${item.name}</div><div>¥${item.price}</div></div>`;
    });
    currentContainer.innerHTML = html;
    totalDisplay.innerText = "¥" + total;
    if (isRequesting) {
      checkoutBtn.disabled = true;
      checkoutBtn.innerText = "店員を呼出中...";
      checkoutBtn.classList.replace('btn-add', 'btn-secondary');
    } else {
      checkoutBtn.disabled = false;
      checkoutBtn.innerText = "お会計を確定する";
      checkoutBtn.classList.replace('btn-secondary', 'btn-add');
    }
  }
  const pastContainer = document.getElementById('past-order-container');
  if (data.past.length === 0) {
    pastContainer.innerHTML = '<div class="text-center text-secondary py-3">過去の履歴はありません</div>';
  } else {
    let html = '';
    data.past.forEach((order, index) => {
      const itemsHtml = order.items.map(i => `<div>・${i.name} (¥${i.price})</div>`).join("");
      html += `<div class="past-order-card"><div class="past-order-header" onclick="toggleAccordion('past-body-${index}')"><div><span class="text-primary fw-bold">${order.time}</span><span class="ms-2 small text-secondary">会計済</span></div><div class="fw-bold">¥${order.total} ▼</div></div><div id="past-body-${index}" class="past-order-body">${itemsHtml}</div></div>`;
    });
    pastContainer.innerHTML = html;
  }
}

function toggleAccordion(id) {
  const el = document.getElementById(id);
  if (el.style.display === "block") el.style.display = "none";
  else el.style.display = "block";
}

function openCheckoutModal() {
    historyModal.hide(); 
    checkoutConfirmModal.show(); 
}

function cancelCheckout() {
    checkoutConfirmModal.hide(); 
    historyModal.show(); 
}

function executeCheckout() {
  checkoutConfirmModal.hide();

  const btn = document.getElementById('btn-checkout');
  if(btn) { btn.disabled = true; btn.innerText = "送信中..."; }
  
  const payload = { action: "checkout", accessToken: liff.getAccessToken() };
  fetch(GAS_API_URL, { method: "POST", body: JSON.stringify(payload) })
  .then(res => res.json())
  .then(data => {
    if (data.status === "success") {
      historyCache = null;
      showMessage("Staff Called", "店員をお呼びしました。<br>そのままお席でお待ちください。<br><br><small style='color:#888;'>明日、LINEであなた専用のメッセージをお届けしますね。</small>");
      setTimeout(function() { location.reload(); }, 3000);
    } else { 
        historyModal.show();
        setTimeout(() => showMessage("Error", "エラー: " + data.message), 500);
        if(btn) { btn.disabled = false; btn.innerText = "お会計を確定する"; }
    }
  })
  .catch(err => { 
      historyModal.show();
      setTimeout(() => showMessage("Error", "通信エラー"), 500);
      if(btn) { btn.disabled = false; btn.innerText = "お会計を確定する"; }
  });
}

function openMyPageModal() {
  if (!myPageModal) myPageModal = new bootstrap.Modal(document.getElementById('myPageModal'));
  myPageModal.show();
  loadAndRenderChart();
}

function loadAndRenderChart() {
  if (!liff.isLoggedIn()) { alert("ログインが必要です"); return; }
  
  if (myTasteCache) {
      renderMyTasteFromCache(myTasteCache);
      return;
  }

  liff.getProfile().then(profile => {
    if(historyCache) {
        const allItems = extractAllItems(historyCache);
        calculateAndDraw(allItems);
    } else {
        fetch(`${GAS_API_URL}?action=getHistory&userId=${profile.userId}`)
          .then(res => res.json())
          .then(historyData => {
            historyCache = historyData;
            const allItems = extractAllItems(historyData);
            calculateAndDraw(allItems);
          });
    }
  });
}

function extractAllItems(historyData) {
    const allItems = [];
    historyData.current.forEach(item => allItems.push(item.name));
    historyData.past.forEach(order => { order.items.forEach(i => allItems.push(i.name)); });
    return allItems;
}

function renderMyTasteFromCache(data) {
    const allItems = extractAllItems(historyCache || {current:[], past:[]}); 
    const stats = calculateStats(allItems);
    const dataValues = [stats.salty, stats.sweet, stats.sour, stats.bitter, stats.rich];
    drawChart(dataValues);

    const commentBox = document.getElementById('my-taste-text');
    const recommendContainer = document.getElementById('my-taste-recommendation');
    const cardArea = document.getElementById('my-taste-card-area');

    if (data.aiData) {
        const aiData = data.aiData;
        let htmlContent = "";
        if(aiData.persona) htmlContent += `<strong>【 ${aiData.persona} 】</strong><br><br>`;
        if(aiData.analysis) htmlContent += `${aiData.analysis.replace(/\n/g, '<br>')}<br><br>`;
        if(aiData.advice) htmlContent += `<em>✨ ${aiData.advice}</em>`;
        commentBox.innerHTML = htmlContent;

        // ★シェアボタンを表示
        var shareBtn = document.getElementById('share-btn-area');
        if (shareBtn) shareBtn.style.display = 'block';

        if (aiData.recommendItemName) {
           renderMyTasteCard(aiData.recommendItemName);
        }
    }
}

function calculateAndDraw(itemNames) {
  const stats = calculateStats(itemNames); 
  const dataValues = [stats.salty, stats.sweet, stats.sour, stats.bitter, stats.rich];
  drawChart(dataValues);
  fetchAiComment(stats, itemNames);
}

function calculateStats(itemNames) {
  let stats = { salty: 0, sweet: 0, sour: 0, bitter: 0, rich: 0 };
  let count = 0;
  if(!itemNames) itemNames = [];

  itemNames.forEach(name => {
    const baseName = name.split(' (')[0]; 
    const masterItem = allMenuItems.find(m => m.name === baseName);
    if (masterItem && masterItem.params) {
      stats.salty += masterItem.params.salty;
      stats.sweet += masterItem.params.sweet;
      stats.sour += masterItem.params.sour;
      stats.bitter += masterItem.params.bitter;
      stats.rich += masterItem.params.rich;
      count++;
    }
  });

  if (count === 0) return { salty:0, sweet:0, sour:0, bitter:0, rich:0 };

  return {
    salty: Number((stats.salty / count).toFixed(1)),
    sweet: Number((stats.sweet / count).toFixed(1)),
    sour:  Number((stats.sour / count).toFixed(1)),
    bitter: Number((stats.bitter / count).toFixed(1)),
    rich:  Number((stats.rich / count).toFixed(1))
  };
}

function drawChart(dataValues) {
  const ctx = document.getElementById('tasteChart').getContext('2d');
  if (tasteChartInstance) tasteChartInstance.destroy();
  const colorPrimary = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#ff9800';
  
  tasteChartInstance = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['塩味', '甘味', '酸味', '苦味', 'コク'],
      datasets: [{ label: '好み傾向', data: dataValues, backgroundColor: 'rgba(255, 152, 0, 0.2)', borderColor: colorPrimary, pointBackgroundColor: colorPrimary, borderWidth: 2 }]
    },
    options: {
      scales: { r: { angleLines: { color: '#ddd' }, grid: { color: '#ddd' }, pointLabels: { color: '#666', font: {size: 12} }, ticks: { display: false, max: 5, min: 0 } } },
      plugins: { legend: { display: false } }
    }
  });
}

function fetchAiComment(stats, historyItems) {
  const commentBox = document.getElementById('my-taste-text');
  const recommendContainer = document.getElementById('my-taste-recommendation');
  const cardArea = document.getElementById('my-taste-card-area');
  
  if(commentBox) {
    commentBox.innerHTML = '<span class="spinner-border spinner-border-sm text-primary" role="status"></span> <span class="small text-primary">マスターがあなたの好みを分析中...</span>';
  }
  if(recommendContainer) recommendContainer.style.display = 'none';
  if(cardArea) cardArea.innerHTML = "";
  
  // シェアボタンを一旦非表示（再分析時）
  var shareBtnHide = document.getElementById('share-btn-area');
  if (shareBtnHide) shareBtnHide.style.display = 'none';

  if (historyItems.length === 0) { 
    if(commentBox) commentBox.innerText = "まだデータがありません。注文履歴が増えると、AIがあなたの好みを分析します！"; 
    return; 
  }

  const payload = { action: "getTasteAnalysis", stats: stats, history: historyItems };

  fetch(GAS_API_URL, { method: "POST", body: JSON.stringify(payload) })
  .then(res => res.json())
  .then(data => { 
    if (data.status === "success" && commentBox) { 
      try {
        const aiData = JSON.parse(data.message);
        
        myTasteCache = { aiData: aiData };

        let htmlContent = "";
        if(aiData.persona) htmlContent += `<strong>【 ${aiData.persona} 】</strong><br><br>`;
        if(aiData.analysis) htmlContent += `${aiData.analysis.replace(/\n/g, '<br>')}<br><br>`;
        if(aiData.advice) htmlContent += `<em>✨ ${aiData.advice}</em>`;
        
        commentBox.innerHTML = htmlContent;

        // ★シェアボタンを表示
        var shareBtn = document.getElementById('share-btn-area');
        if (shareBtn) shareBtn.style.display = 'block';

        if (aiData.recommendItemName) {
           renderMyTasteCard(aiData.recommendItemName);
        }

      } catch (e) {
        commentBox.innerText = data.message;
      }
    } else if(commentBox) { 
      commentBox.innerText = "コメントの取得に失敗しました。"; 
    } 
  })
  .catch(err => { 
    console.error(err);
    if(commentBox) commentBox.innerText = "通信エラーが発生しました。"; 
  });
}

function renderMyTasteCard(targetItemName) {
    const recommendContainer = document.getElementById('my-taste-recommendation');
    const cardArea = document.getElementById('my-taste-card-area');
    
    const item = allMenuItems.find(m => m.name.replace(/\s+/g, '') === targetItemName.replace(/\s+/g, ''));

    if (!item) return;

    const imgUrl = convertDriveUrl(item.image);
    
    const html = `
      <div class="card border-0 shadow-sm bg-white" style="overflow:hidden;">
        <div class="d-flex align-items-center p-2">
          <div class="flex-shrink-0">
            <img src="${imgUrl}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;" onerror="this.src='${PLACEHOLDER_IMG}'">
          </div>
          <div class="ms-3 flex-grow-1 text-start" style="min-width: 0;">
            <div class="fw-bold text-dark text-truncate" style="font-size: 0.9rem;">${item.name}</div>
            <div class="text-primary fw-bold small">¥${item.price}</div>
          </div>
          <div class="ms-2 flex-shrink-0">
            <button class="btn btn-sm btn-primary px-3 rounded-pill" style="font-size: 0.8rem; white-space: nowrap;" onclick="addMyTasteItem('${item.id}')">
              追加
            </button>
          </div>
        </div>
      </div>
    `;

    cardArea.innerHTML = html;
    recommendContainer.style.display = 'block';
    recommendContainer.classList.add('fade-in-up');
}

function addMyTasteItem(itemId) {
    myPageModal.hide();
    addItemFromRecommend(itemId);
}

function typeWriter(element, text) {
    element.innerText = "";
    let i = 0;
    const speed = 30; 
    function type() {
        if (i < text.length) {
            element.innerText += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }
    type();
}

// ==============================
// Step0: パーソナライズ挨拶トースト
// ==============================
function showGreetingToast(name, profile) {
  if (sessionStorage.getItem('MO_GREETED')) return;

  if (profile && profile.status === 'found') {
    var today = new Date();
    var m = today.getMonth() + 1;
    var d = today.getDate();
    var todayStr = m + '/' + d;
    if (profile.lastVisit === todayStr) return;
  }

  sessionStorage.setItem('MO_GREETED', '1');

  var msg = '';

  if (profile && profile.status === 'found' && profile.visitCount >= 2) {
    msg = name + 'さん、' + profile.visitCount + '回目のご来店ですね！';
    if (profile.aiPersona) msg += '\nあなたの称号：' + profile.aiPersona;
  } else {
    msg = 'ようこそ ' + name + ' さん！\nはじめてのご来店ありがとうございます。';
  }

  var toast = document.createElement('div');
  toast.id = 'greeting-toast';
  toast.innerText = msg;
  document.body.appendChild(toast);

  setTimeout(function() { toast.classList.add('show'); }, 100);
  setTimeout(function() { toast.classList.remove('show'); }, 4000);
  setTimeout(function() { toast.remove(); }, 4500);
}

// ==============================
// Step4: Instagram シェア画像生成
// ==============================
var shareImageModal = null;

function generateTasteImage() {
  if (!shareImageModal) {
    shareImageModal = new bootstrap.Modal(document.getElementById('shareImageModal'));
  }

  var canvas = document.createElement('canvas');
  var W = 1080;
  var H = 1920;
  canvas.width = W;
  canvas.height = H;
  var ctx = canvas.getContext('2d');

  // --- 背景 ---
  var bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#1a1a2e');
  bg.addColorStop(0.5, '#16213e');
  bg.addColorStop(1, '#0f3460');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // --- 装飾: 円のグロー ---
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.beginPath();
  ctx.arc(W * 0.2, H * 0.15, 300, 0, Math.PI * 2);
  ctx.fillStyle = '#ff9800';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W * 0.8, H * 0.7, 250, 0, Math.PI * 2);
  ctx.fillStyle = '#03dac6';
  ctx.fill();
  ctx.restore();

  // --- 店名ヘッダー ---
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 42px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('☕ 茶飯事Bar', W / 2, 120);

  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '28px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText('AI Sommelier - My Taste Analysis', W / 2, 170);

  // --- レーダーチャート ---
  var stats = { salty: 0, sweet: 0, sour: 0, bitter: 0, rich: 0 };
  if (tasteChartInstance && tasteChartInstance.data && tasteChartInstance.data.datasets[0]) {
    var d = tasteChartInstance.data.datasets[0].data;
    stats = { salty: d[0], sweet: d[1], sour: d[2], bitter: d[3], rich: d[4] };
  }

  var cx = W / 2;
  var cy = 520;
  var maxR = 200;
  var labels = ['塩味', '甘味', '酸味', '苦味', 'コク'];
  var values = [stats.salty, stats.sweet, stats.sour, stats.bitter, stats.rich];
  var angleStep = (Math.PI * 2) / 5;
  var startAngle = -Math.PI / 2;

  // グリッド線
  for (var level = 1; level <= 5; level++) {
    var r = maxR * (level / 5);
    ctx.beginPath();
    for (var j = 0; j < 5; j++) {
      var a = startAngle + angleStep * j;
      var gx = cx + r * Math.cos(a);
      var gy = cy + r * Math.sin(a);
      if (j === 0) ctx.moveTo(gx, gy);
      else ctx.lineTo(gx, gy);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // 軸線
  for (var k = 0; k < 5; k++) {
    var a2 = startAngle + angleStep * k;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + maxR * Math.cos(a2), cy + maxR * Math.sin(a2));
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // データ塗り
  ctx.beginPath();
  for (var m = 0; m < 5; m++) {
    var a3 = startAngle + angleStep * m;
    var val = Math.min(values[m], 5);
    var dr = maxR * (val / 5);
    var px = cx + dr * Math.cos(a3);
    var py = cy + dr * Math.sin(a3);
    if (m === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(255, 152, 0, 0.35)';
  ctx.fill();
  ctx.strokeStyle = '#ff9800';
  ctx.lineWidth = 3;
  ctx.stroke();

  // データ点
  for (var n = 0; n < 5; n++) {
    var a4 = startAngle + angleStep * n;
    var val2 = Math.min(values[n], 5);
    var dr2 = maxR * (val2 / 5);
    var dotX = cx + dr2 * Math.cos(a4);
    var dotY = cy + dr2 * Math.sin(a4);
    ctx.beginPath();
    ctx.arc(dotX, dotY, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ff9800';
    ctx.fill();
  }

  // ラベル
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  for (var p = 0; p < 5; p++) {
    var a5 = startAngle + angleStep * p;
    var lx = cx + (maxR + 50) * Math.cos(a5);
    var ly = cy + (maxR + 50) * Math.sin(a5);
    ctx.fillText(labels[p], lx, ly + 10);
  }

  // --- 称号 & コメント ---
  var persona = '';
  var comment = '';
  var commentBox = document.getElementById('my-taste-text');

  if (commentBox) {
    var strongTag = commentBox.querySelector('strong');
    if (strongTag) persona = strongTag.innerText.replace(/【|】/g, '');

    var emTag = commentBox.querySelector('em');
    var allText = commentBox.innerText || '';

    comment = allText;
    if (persona) comment = comment.replace(commentBox.querySelector('strong').innerText, '');
    if (emTag) comment = comment.replace(emTag.innerText, '');
    comment = comment.replace(/^\s+|\s+$/g, '');
  }

  // 称号エリア
  var titleY = 820;

  if (persona) {
    ctx.font = 'bold 48px "Helvetica Neue", Arial, sans-serif';
    var personaWidth = ctx.measureText(persona).width + 80;
    var badgeX = (W - personaWidth) / 2;
    ctx.fillStyle = 'rgba(255,152,0,0.2)';
    roundRect(ctx, badgeX, titleY - 45, personaWidth, 65, 32);
    ctx.fill();
    ctx.strokeStyle = '#ff9800';
    ctx.lineWidth = 2;
    roundRect(ctx, badgeX, titleY - 45, personaWidth, 65, 32);
    ctx.stroke();

    ctx.fillStyle = '#ff9800';
    ctx.textAlign = 'center';
    ctx.fillText(persona, W / 2, titleY);
    titleY += 80;
  }

  // コメント（折り返し描画）
  if (comment) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '30px "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    var lines = wrapText(ctx, comment, W - 160);
    for (var li = 0; li < lines.length && li < 12; li++) {
      ctx.fillText(lines[li], W / 2, titleY + li * 44);
    }
    titleY += lines.length * 44 + 30;
  }

  // --- フッター ---
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '26px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Powered by AI Sommelier × 茶飯事Bar', W / 2, H - 80);

  // --- canvasをモーダルに描画 ---
  var displayCanvas = document.getElementById('share-canvas');
  displayCanvas.width = W;
  displayCanvas.height = H;
  var displayCtx = displayCanvas.getContext('2d');
  displayCtx.drawImage(canvas, 0, 0);

  shareImageModal.show();
}

function saveShareImage() {
  var canvas = document.getElementById('share-canvas');

  canvas.toBlob(function(blob) {
    if (!blob) {
      alert('画像の生成に失敗しました');
      return;
    }

    // Web Share API が使えるか試す（画像シェア対応）
    if (navigator.share && navigator.canShare) {
      var file = new File([blob], 'my-taste.png', { type: 'image/png' });
      var shareData = { files: [file] };

      if (navigator.canShare(shareData)) {
        navigator.share(shareData)
          .then(function() { console.log('Shared'); })
          .catch(function(err) { console.log('Share cancelled', err); });
        return;
      }
    }

    // Web Share API が使えない場合 → Blob URLでダウンロード
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'my-taste.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function() { URL.revokeObjectURL(url); }, 1000);

  }, 'image/png');
}


// --- ヘルパー: テキスト折り返し ---
function wrapText(ctx, text, maxWidth) {
  var lines = [];
  var paragraphs = text.split('\n');
  for (var pi = 0; pi < paragraphs.length; pi++) {
    var chars = paragraphs[pi];
    var line = '';
    for (var ci = 0; ci < chars.length; ci++) {
      var testLine = line + chars[ci];
      if (ctx.measureText(testLine).width > maxWidth && line.length > 0) {
        lines.push(line);
        line = chars[ci];
      } else {
        line = testLine;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

// --- ヘルパー: 角丸四角 ---
function roundRect(ctx, x, y, w, h, r) {
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
