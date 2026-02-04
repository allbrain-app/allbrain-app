let cart = [];
let allMenuItems = [];
let currentCategory = 'ALL';
// モーダル変数に optionModal を追加
let confirmModal, messageModal, recommendModal, historyModal, myPageModal, optionModal;
let tasteChartInstance = null;
let shouldReload = false;
let currentTableId = null;

// オプション選択中の一時データ
let pendingItem = null; 

const PLACEHOLDER_IMG = "https://placehold.co/100x100/eeeeee/999999?text=No+Img";

// 初期化処理
window.onload = function() {
  if (typeof MY_LIFF_ID === 'undefined' || typeof GAS_API_URL === 'undefined') {
    alert("config.js が見つかりません"); return;
  }

  // テーブル番号の自動取得と記憶
  const urlParams = new URLSearchParams(window.location.search);
  const paramTableId = urlParams.get('table');

  if (paramTableId) {
    currentTableId = paramTableId;
    localStorage.setItem('MO_TABLE_ID', currentTableId);
  } else {
    const savedTableId = localStorage.getItem('MO_TABLE_ID');
    if (savedTableId) {
      currentTableId = savedTableId;
    } else {
      currentTableId = prompt("テーブル番号を入力してください", "1") || "Free";
      localStorage.setItem('MO_TABLE_ID', currentTableId);
    }
  }

  confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));
  messageModal = new bootstrap.Modal(document.getElementById('messageModal'));
  recommendModal = new bootstrap.Modal(document.getElementById('recommendModal'));
  historyModal = new bootstrap.Modal(document.getElementById('historyModal'));
  myPageModal = new bootstrap.Modal(document.getElementById('myPageModal'));
  optionModal = new bootstrap.Modal(document.getElementById('optionModal'));

  initializeLiff();
};

function initializeLiff() {
  liff.init({ liffId: MY_LIFF_ID })
    .then(() => {
      if (!liff.isLoggedIn()) {
        liff.login({ redirectUri: location.href });
      } else {
        liff.getProfile().then(p => {
          document.getElementById('user-info').innerText = `Table: ${currentTableId} / Guest: ${p.displayName}`;
        });
        fetchMenu(); 
      }
    })
    .catch(err => showMessage("Error", "LIFF Init failed: " + err.message));
}

function fetchMenu() {
  fetch(GAS_API_URL + "?action=getMenu")
    .then(res => {
      if (!res.ok) throw new Error("Network error");
      return res.text().then(text => { try { return JSON.parse(text); } catch(e) { throw new Error("Data Error"); }});
    })
    .then(data => {
       if(data.status === 'error') throw new Error(data.message);
       allMenuItems = data;
       initCategoryTabs(allMenuItems);
       renderMenu();
    })
    .catch(err => document.getElementById('menu-list').innerHTML = `<div class="text-danger text-center mt-5">${err.message}</div>`);
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
  const container = document.getElementById('menu-list');
  container.innerHTML = ""; 
  const itemsToShow = (currentCategory === 'ALL') ? allMenuItems : allMenuItems.filter(item => item.category === currentCategory);
  if(itemsToShow.length === 0) {
     container.innerHTML = '<div class="text-secondary text-center mt-5">該当する商品がありません</div>'; return;
  }
  itemsToShow.forEach(item => {
    const isSoldOut = item.isSoldOut;
    const btnState = isSoldOut ? 'disabled' : '';
    const btnText = isSoldOut ? 'SOLD OUT' : '追加';
    const btnClass = isSoldOut ? 'btn-secondary' : 'btn-add';
    const cardOpacity = isSoldOut ? 'opacity: 0.6;' : '';
    const imgUrl = convertDriveUrl(item.image);
    const card = `
      <div class="card" style="${cardOpacity}">
        <div class="card-body-custom">
          <div class="img-area"><img src="${imgUrl}" alt="${item.name}" onerror="this.onerror=null; this.src='${PLACEHOLDER_IMG}';"></div>
          <div class="text-area">
            <div class="item-name">${item.name}${isSoldOut ? '<span class="badge bg-danger ms-1" style="font-size:0.5em;">売切</span>' : ''}</div>
            <div class="item-flavor">${item.flavor}</div>
            <div class="item-price">¥${item.price}</div>
          </div>
          <div class="btn-area"><button class="btn ${btnClass}" onclick="addToCart('${item.id}')" ${btnState}>${btnText}</button></div>
        </div>
      </div>`;
    container.innerHTML += card;
  });
}

function convertDriveUrl(url) {
  if (!url) return PLACEHOLDER_IMG;
  if (url.includes("/folders/")) return PLACEHOLDER_IMG;
  let match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) match = url.match(/id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return `https://drive.google.com/uc?export=view&id=${match[1]}`;
  return url;
}

// カート追加 (オプション対応)
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

// オプション関連ロジック
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

// ▼▼▼ 注文実行処理 (画面遷移をシームレスにする修正) ▼▼▼
function executeOrder() {
  // 1. まず全画面ローディングを出す（これが最優先）
  showLoading(); 
  
  // 2. その後で確認モーダルを閉じる
  // (ローディングが前面にあるので、裏で閉じてもメニュー画面は見えない)
  confirmModal.hide(); 
  
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
          shouldReload = true; 
          cart = []; 
          updateCartUI();
          // ローディングを消さずに、そのままAI画面へバトンタッチ
          showRecommendationModal(lastOrderedItems); 
          return;
      }
      throw new Error("通信エラー");
    }
    
    if(data.status === "success"){
      shouldReload = true;
      cart = [];
      updateCartUI();
      // ローディングを消さずに、そのままAI画面へバトンタッチ
      showRecommendationModal(lastOrderedItems);
    } else { 
      // エラーの時だけローディングを消す
      hideLoading();
      throw new Error(data.message); 
    }
  })
  .catch(err => {
     hideLoading();
     showMessage("Error", err.message);
  });
}

function showMessage(title, body) {
  document.getElementById('messageModalTitle').innerText = title;
  document.getElementById('messageModalBody').innerHTML = body;
  messageModal.show();
}

function showLoading() {
  const overlay = document.getElementById('loading-overlay');
  overlay.classList.remove('overlay-hidden');
}

function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  overlay.classList.add('overlay-hidden');
}

function finishOrderFlow() {
  recommendModal.hide();
  showMessage("Thanks!", "ご注文ありがとうございました。<br>料理の到着をお待ちください。");
}

// 履歴・会計・マイページ系
function openHistoryModal() {
  if (!historyModal) historyModal = new bootstrap.Modal(document.getElementById('historyModal'));
  historyModal.show();
  fetchHistoryData();
}
function switchHistoryTab(tabName) {
  document.querySelectorAll('#history-tabs .nav-link').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('tab-current').style.display = (tabName === 'current') ? 'block' : 'none';
  document.getElementById('tab-past').style.display = (tabName === 'past') ? 'block' : 'none';
}
function fetchHistoryData() {
  const currentContainer = document.getElementById('current-order-list');
  const pastContainer = document.getElementById('past-order-container');
  currentContainer.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-secondary"></div></div>';
  if (!liff.isLoggedIn()) { currentContainer.innerHTML = '<div class="text-center text-danger">ログインが必要です</div>'; return; }
  liff.getProfile().then(profile => {
    const url = `${GAS_API_URL}?action=getHistory&userId=${profile.userId}`;
    fetch(url).then(res => res.json()).then(data => { renderHistory(data); }).catch(err => {
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
function confirmCheckout() {
  if (!confirm("お会計を確定しますか？\n店員が精算に伺います。")) return;
  const btn = document.getElementById('btn-checkout');
  btn.disabled = true; btn.innerText = "送信中...";
  const payload = { action: "checkout", accessToken: liff.getAccessToken() };
  fetch(GAS_API_URL, { method: "POST", body: JSON.stringify(payload) })
  .then(res => res.json())
  .then(data => {
    if (data.status === "success") {
      alert("店員をお呼びしました。\nそのままお席でお待ちください。");
      historyModal.hide(); setTimeout(() => location.reload(), 500);
    } else { alert("エラー: " + data.message); btn.disabled = false; btn.innerText = "お会計を確定する"; }
  })
  .catch(err => { alert("通信エラー"); btn.disabled = false; btn.innerText = "お会計を確定する"; });
}
function openMyPageModal() {
  if (!myPageModal) myPageModal = new bootstrap.Modal(document.getElementById('myPageModal'));
  myPageModal.show();
  loadAndRenderChart();
}
function loadAndRenderChart() {
  if (!liff.isLoggedIn()) { alert("ログインが必要です"); return; }
  liff.getProfile().then(profile => {
    fetch(`${GAS_API_URL}?action=getHistory&userId=${profile.userId}`)
      .then(res => res.json())
      .then(historyData => {
        const allItems = [];
        historyData.current.forEach(item => allItems.push(item.name));
        historyData.past.forEach(order => { order.items.forEach(i => allItems.push(i.name)); });
        calculateAndDraw(allItems);
      });
  });
}
function calculateAndDraw(itemNames) {
  const stats = calculateStats(itemNames); 
  const dataValues = [stats.salty, stats.sweet, stats.sour, stats.bitter, stats.rich];
  drawChart(dataValues);
  fetchAiComment(stats, itemNames);
}

// 統計データ計算
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
  const commentBox = document.querySelector('#myPageModal .text-muted');
  if(commentBox) commentBox.innerHTML = '<span class="spinner-border spinner-border-sm text-secondary" role="status"></span> 分析中... AIがコメントを考えています';
  if (historyItems.length === 0) { if(commentBox) commentBox.innerText = "まだデータがありません。注文するとAIが分析を開始します！"; return; }
  const payload = { action: "getAiComment", stats: stats, history: historyItems };
  fetch(GAS_API_URL, { method: "POST", body: JSON.stringify(payload) })
  .then(res => res.json())
  .then(data => { if (data.status === "success" && commentBox) { commentBox.innerText = data.message; } else if(commentBox) { commentBox.innerText = "コメントの取得に失敗しました。"; } })
  .catch(err => { if(commentBox) commentBox.innerText = "通信エラーが発生しました。"; });
}

// =========================================================
// ▼▼▼ 敏腕セールスマンAI (表示タイミング調整) ▼▼▼
// =========================================================

function showRecommendationModal(orderedItems) {
    if (!recommendModal) recommendModal = new bootstrap.Modal(document.getElementById('recommendModal'));
    const textElem = document.getElementById('recommendation-text');
    const loadingElem = document.getElementById('recommendation-loading');
    const itemContainer = document.getElementById('recommendation-item-container');
    const cardArea = document.getElementById('recommendation-card-area');

    if (!textElem) {
        hideLoading(); 
        return;
    }

    // 1. 中身を初期化
    textElem.innerHTML = ""; 
    textElem.style.display = 'none'; 
    loadingElem.style.display = 'block'; 
    itemContainer.style.display = 'none'; 
    cardArea.innerHTML = "";

    // 2. モーダルを表示
    recommendModal.show();

    // 3. モーダルが表示された頃合いを見て全画面ローディングを消す
    setTimeout(() => {
        hideLoading();
    }, 500);

    // 4. データ準備 & GAS送信
    const itemNames = orderedItems.map(i => i.name);
    const currentStats = calculateStats(itemNames);
    
    const payload = { 
        action: "getAiComment", 
        stats: currentStats, 
        history: itemNames 
    };

    fetch(GAS_API_URL, {
        method: "POST",
        body: JSON.stringify(payload)
    })
    .then(r => r.json())
    .then(res => {
        loadingElem.style.display = 'none'; 
        textElem.style.display = 'block';

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
        loadingElem.style.display = 'none';
        textElem.style.display = 'block';
        textElem.innerText = "システムエラーが発生しました。";
        console.error(err);
    });
}

// おすすめ商品カードを生成 (スマホ対応版)
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

// おすすめモーダルからカートに追加し、注文画面へ進む処理
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
