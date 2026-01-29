let cart = [];
let allMenuItems = [];
let currentCategory = 'ALL';
let confirmModal, messageModal, recommendModal; // ★ recommendModal を追加
let shouldReload = false;
const PLACEHOLDER_IMG = "https://placehold.co/100x100/333/888?text=No+Img";

// 初期化処理
window.onload = function() {
  if (typeof MY_LIFF_ID === 'undefined' || typeof GAS_API_URL === 'undefined') {
    alert("config.js が見つかりません"); return;
  }
  confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));
  messageModal = new bootstrap.Modal(document.getElementById('messageModal'));
  
  // ★追加: レコメンドモーダルの初期化
  recommendModal = new bootstrap.Modal(document.getElementById('recommendModal'));

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

// 注文実行処理 (フェーズ2修正)
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
         shouldReload = true; 
         hideLoading();
         // 救済措置の場合もレコメンドへ
         recommendModal.show(); 
         cart = []; updateCartUI();
         return;
      }
      throw new Error("通信エラー");
    }
    
    if(data.status === "success"){
      shouldReload = true;
      hideLoading();
      
      // ★修正: メッセージではなくレコメンド画面を表示
      recommendModal.show();
      
      // 注文済みなのでカートを空にする
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

// ローディング制御関数
function showLoading() {
  const overlay = document.getElementById('loading-overlay');
  overlay.classList.remove('overlay-hidden');
}

function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  overlay.classList.add('overlay-hidden');
}

// ★追加: レコメンドモーダルからの完了フロー
function finishOrderFlow() {
  recommendModal.hide();
  showMessage("Thanks!", "ご注文ありがとうございました。<br>料理の到着をお待ちください。");
}


// ▼▼▼ フェーズ3追加: 履歴・会計ロジック ▼▼▼

let historyModal;

// 初期化に追加 (window.onload内に追加してください)
/*
  historyModal = new bootstrap.Modal(document.getElementById('historyModal'));
*/
// ↑ これを既存の window.onload 内の confirmModal 等の初期化の下に追加します。
// その上で、以下の関数を script.js の末尾に貼り付けてください。

// ★注意: window.onload の中身を書き換えるのを忘れないでください。
// 面倒であれば、ファイルの末尾に以下を追記するだけでも動くように設計します。
// ただし、本来は onload 内で new bootstrap.Modal するのが綺麗です。
// ここでは関数呼び出し時に初期化チェックを行う安全策をとります。

function openHistoryModal() {
  if (!historyModal) historyModal = new bootstrap.Modal(document.getElementById('historyModal'));
  historyModal.show();
  fetchHistoryData();
}

function switchHistoryTab(tabName) {
  // タブの見た目
  document.querySelectorAll('#history-tabs .nav-link').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active'); // クリックされたボタンをactiveに

  // コンテンツの切り替え
  document.getElementById('tab-current').style.display = (tabName === 'current') ? 'block' : 'none';
  document.getElementById('tab-past').style.display = (tabName === 'past') ? 'block' : 'none';
}

function fetchHistoryData() {
  const currentContainer = document.getElementById('current-order-list');
  const pastContainer = document.getElementById('past-order-container');
  
  // 読み込み中表示
  currentContainer.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-light"></div></div>';
  
  if (!liff.isLoggedIn()) {
    currentContainer.innerHTML = '<div class="text-center text-danger">ログインが必要です</div>';
    return;
  }

  // プロファイル取得してから履歴APIを叩く
  liff.getProfile().then(profile => {
    const url = `${GAS_API_URL}?action=getHistory&userId=${profile.userId}`;
    
    fetch(url)
      .then(res => res.json())
      .then(data => {
        renderHistory(data);
      })
      .catch(err => {
        currentContainer.innerHTML = `<div class="text-danger text-center">エラー: ${err.message}</div>`;
      });
  });
}

function renderHistory(data) {
  // 1. 現在の注文 (未会計)
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
      html += `
        <div class="history-item-row">
          <div>${item.name}</div>
          <div>¥${item.price}</div>
        </div>
      `;
    });
    currentContainer.innerHTML = html;
    totalDisplay.innerText = "¥" + total;
    checkoutBtn.disabled = false;
    checkoutBtn.innerText = "お会計を確定する";
  }

  // 2. 過去の履歴 (会計済み)
  const pastContainer = document.getElementById('past-order-container');
  if (data.past.length === 0) {
    pastContainer.innerHTML = '<div class="text-center text-secondary py-3">過去の履歴はありません</div>';
  } else {
    let html = '';
    data.past.forEach((order, index) => {
      // order = { id, time, total, items: [{name, price}, ...] }
      const itemsHtml = order.items.map(i => `<div>・${i.name} (¥${i.price})</div>`).join("");
      
      html += `
        <div class="past-order-card">
          <div class="past-order-header" onclick="toggleAccordion('past-body-${index}')">
            <div>
              <span style="color:#03dac6; font-weight:bold;">${order.time}</span>
              <span class="ms-2 small text-secondary">会計済</span>
            </div>
            <div class="fw-bold">¥${order.total} ▼</div>
          </div>
          <div id="past-body-${index}" class="past-order-body">
            ${itemsHtml}
          </div>
        </div>
      `;
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
  if (!confirm("お会計を確定しますか？\n（店員が席へ向かいます）")) return;
  
  // ボタンをローディング状態に
  const btn = document.getElementById('btn-checkout');
  const originalText = btn.innerText;
  btn.disabled = true;
  btn.innerText = "送信中...";

  const payload = { 
    action: "checkout", 
    accessToken: liff.getAccessToken() 
  };

  fetch(GAS_API_URL, {
    method: "POST",
    body: JSON.stringify(payload)
  })
  .then(res => res.json())
  .then(data => {
    if (data.status === "success") {
      alert("お会計を承りました。\nそのままお席でお待ちください。");
      historyModal.hide();
      // 画面リロードして状態を最新にする（現在の注文がゼロになり、過去履歴が増える）
      setTimeout(() => location.reload(), 500); 
    } else {
      alert("エラー: " + data.message);
      btn.disabled = false;
      btn.innerText = originalText;
    }
  })
  .catch(err => {
    alert("通信エラー");
    btn.disabled = false;
    btn.innerText = originalText;
  });
}
