let cart = [];
let allMenuItems = [];
let currentCategory = 'ALL';
let confirmModal, messageModal, recommendModal, historyModal, myPageModal;
let tasteChartInstance = null;
let shouldReload = false;
const PLACEHOLDER_IMG = "https://placehold.co/100x100/333/888?text=No+Img";

// 初期化処理
window.onload = function() {
  if (typeof MY_LIFF_ID === 'undefined' || typeof GAS_API_URL === 'undefined') {
    alert("config.js が見つかりません"); return;
  }
  confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));
  messageModal = new bootstrap.Modal(document.getElementById('messageModal'));
  recommendModal = new bootstrap.Modal(document.getElementById('recommendModal'));
  historyModal = new bootstrap.Modal(document.getElementById('historyModal'));
  myPageModal = new bootstrap.Modal(document.getElementById('myPageModal'));

  initializeLiff();
};

function initializeLiff() {
  liff.init({ liffId: MY_LIFF_ID })
    .then(() => {
      if (!liff.isLoggedIn()) {
        liff.login({ redirectUri: location.href });
      } else {
        liff.getProfile().then(p => document.getElementById('user-info').innerText = `Guest: ${p.displayName}`);
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
          <div class="btn-area"><button class="btn ${btnClass}" onclick="addToCart('${item.id}', '${item.name}', ${item.price})" ${btnState}>${btnText}</button></div>
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

function addToCart(id, name, price) {
  cart.push({ id, name, price });
  updateCartUI();
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
  showLoading();

  const payload = { accessToken: liff.getAccessToken(), items: cart };

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
         shouldReload = true; hideLoading(); recommendModal.show(); cart = []; updateCartUI(); return;
      }
      throw new Error("通信エラー");
    }
    
    if(data.status === "success"){
      shouldReload = true;
      hideLoading();
      recommendModal.show();
      cart = [];
      updateCartUI();
    } else { 
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
  currentContainer.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-light"></div></div>';
  
  if (!liff.isLoggedIn()) {
    currentContainer.innerHTML = '<div class="text-center text-danger">ログインが必要です</div>';
    return;
  }

  liff.getProfile().then(profile => {
    const url = `${GAS_API_URL}?action=getHistory&userId=${profile.userId}`;
    fetch(url)
      .then(res => res.json())
      .then(data => { renderHistory(data); })
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
    data.current.forEach(item => {
      total += Number(item.price);
      html += `<div class="history-item-row"><div>${item.name}</div><div>¥${item.price}</div></div>`;
    });
    currentContainer.innerHTML = html;
    totalDisplay.innerText = "¥" + total;
    checkoutBtn.disabled = false;
    checkoutBtn.innerText = "お会計を確定する";
  }

  const pastContainer = document.getElementById('past-order-container');
  if (data.past.length === 0) {
    pastContainer.innerHTML = '<div class="text-center text-secondary py-3">過去の履歴はありません</div>';
  } else {
    let html = '';
    data.past.forEach((order, index) => {
      const itemsHtml = order.items.map(i => `<div>・${i.name} (¥${i.price})</div>`).join("");
      html += `
        <div class="past-order-card">
          <div class="past-order-header" onclick="toggleAccordion('past-body-${index}')">
            <div><span style="color:#03dac6; font-weight:bold;">${order.time}</span><span class="ms-2 small text-secondary">会計済</span></div>
            <div class="fw-bold">¥${order.total} ▼</div>
          </div>
          <div id="past-body-${index}" class="past-order-body">${itemsHtml}</div>
        </div>`;
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
  if (!confirm("お会計を確定しますか？")) return;
  const btn = document.getElementById('btn-checkout');
  btn.disabled = true; btn.innerText = "送信中...";
  const payload = { action: "checkout", accessToken: liff.getAccessToken() };
  
  fetch(GAS_API_URL, { method: "POST", body: JSON.stringify(payload) })
  .then(res => res.json())
  .then(data => {
    if (data.status === "success") {
      alert("お会計を承りました。"); historyModal.hide(); setTimeout(() => location.reload(), 500);
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
  let stats = { salty: 0, sweet: 0, sour: 0, bitter: 0, rich: 0 };
  let count = 0;

  itemNames.forEach(name => {
    const masterItem = allMenuItems.find(m => m.name === name);
    if (masterItem && masterItem.params) {
      stats.salty += masterItem.params.salty;
      stats.sweet += masterItem.params.sweet;
      stats.sour += masterItem.params.sour;
      stats.bitter += masterItem.params.bitter;
      stats.rich += masterItem.params.rich;
      count++;
    }
  });

  const avgStats = count === 0 ? { salty:0, sweet:0, sour:0, bitter:0, rich:0 } : {
    salty: Number((stats.salty / count).toFixed(1)),
    sweet: Number((stats.sweet / count).toFixed(1)),
    sour:  Number((stats.sour / count).toFixed(1)),
    bitter: Number((stats.bitter / count).toFixed(1)),
    rich:  Number((stats.rich / count).toFixed(1))
  };

  const dataValues = [avgStats.salty, avgStats.sweet, avgStats.sour, avgStats.bitter, avgStats.rich];
  drawChart(dataValues);
  
  fetchAiComment(avgStats, itemNames);
}

function drawChart(dataValues) {
  const ctx = document.getElementById('tasteChart').getContext('2d');
  if (tasteChartInstance) tasteChartInstance.destroy();

  tasteChartInstance = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['塩味', '甘味', '酸味', '苦味', 'コク'],
      datasets: [{
        label: '好み傾向',
        data: dataValues,
        backgroundColor: 'rgba(187, 134, 252, 0.2)',
        borderColor: '#bb86fc',
        pointBackgroundColor: '#03dac6',
        borderWidth: 2
      }]
    },
    options: {
      scales: {
        r: {
          angleLines: { color: '#444' }, grid: { color: '#444' },
          pointLabels: { color: '#fff', font: {size: 12} },
          ticks: { display: false, max: 5, min: 0 }
        }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function fetchAiComment(stats, historyItems) {
  const commentBox = document.querySelector('#myPageModal .text-light');
  commentBox.innerHTML = '<span class="spinner-border spinner-border-sm text-warning" role="status"></span> 分析中... AIがコメントを考えています';

  if (historyItems.length === 0) {
    commentBox.innerText = "まだデータがありません。注文するとAIが分析を開始します！";
    return;
  }

  const payload = {
    action: "getAiComment",
    stats: stats,
    history: historyItems
  };

  fetch(GAS_API_URL, {
    method: "POST",
    body: JSON.stringify(payload)
  })
  .then(res => res.json())
  .then(data => {
    if (data.status === "success") {
      commentBox.innerText = data.message;
    } else {
      commentBox.innerText = "コメントの取得に失敗しました。";
    }
  })
  .catch(err => {
    commentBox.innerText = "通信エラーが発生しました。";
  });
}
