let allAlbums = [];

function extractFolderId(url) {
  const match = String(url).match(/folders\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  return String(url).trim();
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}.${m}.${d}`;
}

function limitAfter60Days() {
  const d = new Date();
  d.setDate(d.getDate() + 60);
  return formatDate(d);
}

function slugBase(text) {
  return String(text).toLowerCase().replace(/様/g, "").replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]/g, "").slice(0, 24);
}

function makeSlug(customer, type) {
  const today = new Date();
  const ymd = String(today.getFullYear()).slice(2) + String(today.getMonth() + 1).padStart(2, "0") + String(today.getDate()).padStart(2, "0");
  const map = {
    "ニューボーン":"newborn",
    "100日":"100",
    "お宮参り":"omiyamairi",
    "ハーフバースデー":"half",
    "ころりんフォト":"kororin",
    "1000日":"1000",
    "Birthday":"birthday",
    "ミルクバス":"milkbath",
    "BOXフォト":"box",
    "アニバーサリー":"anniversary",
    "家族写真":"family",
    "七五三":"753",
    "マタニティ":"maternity",
    "撮影会":"event",
    "ひなまつり":"hinamatsuri",
    "こどもの日":"kodomo",
    "クリスマス":"christmas",
    "その他":"album"
  };
  return `${slugBase(customer)}-${map[type] || "album"}-${ymd}`;
}

function jsonp(url) {
  return new Promise((resolve, reject) => {
    const name = "cb_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
    window[name] = (data) => { resolve(data); delete window[name]; script.remove(); };
    const script = document.createElement("script");
    script.onerror = reject;
    script.src = url + (url.includes("?") ? "&" : "?") + "callback=" + name;
    document.body.appendChild(script);
  });
}

function albumUrlFromSlug(slug) {
  return location.origin + "/?slug=" + encodeURIComponent(slug);
}

function makeLineText(title, albumUrl, password, limitDate) {
  return `この度はi&u photo studioをご利用いただき、
誠にありがとうございます🙇‍♀️

撮影データのご用意ができました🌿

▼アルバムはこちら
${albumUrl}

▼パスワード
${password}

▼ダウンロード期限
${limitDate}

写真は
・オリジナル保存
・スマホ用保存
の2種類からお選びいただけます😌

いつまでも色褪せない宝物となりますように…🕊️`;
}

function showResult(slug, title, password, limitDate) {
  const albumUrl = albumUrlFromSlug(slug);
  document.getElementById("albumUrlOutput").value = albumUrl;
  document.getElementById("previewLink").href = albumUrl;
  const qrImage = document.getElementById("qrImage");
  qrImage.src = "https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=" + encodeURIComponent(albumUrl);
  qrImage.style.display = "block";
  document.getElementById("resultBox").style.display = "block";
  window.lastLineText = makeLineText(title, albumUrl, password, limitDate);
}

document.getElementById("saveAlbumBtn").addEventListener("click", async () => {
  const key = document.getElementById("keyInput").value.trim();
  const customer = document.getElementById("customerInput").value.trim();
  const type = document.getElementById("typeInput").value;
  const folderId = extractFolderId(document.getElementById("folderInput").value);
  const password = document.getElementById("passwordInputAdmin").value.trim();
  const limitDate = limitAfter60Days();
  const title = `${customer} ${type}`;
  const slug = makeSlug(customer, type);
  const msg = document.getElementById("adminMessage");

  if (!key || !customer || !type || !folderId || !password) {
    msg.textContent = "未入力の項目があります。";
    msg.style.color = "#a33";
    return;
  }

  msg.textContent = "保存中です...";
  msg.style.color = "#6f655a";

  const params = new URLSearchParams({ action:"add", key, slug, customer, type, title, shootDate: formatDate(new Date()), limitDate, folderId, password });
  try {
    const data = await jsonp(ALBUM_API_URL + "?" + params.toString());
    if (data.ok) {
      msg.textContent = "保存しました。";
      msg.style.color = "#3b7d4a";
      showResult(data.slug || slug, title, password, limitDate);
      loadAlbumList();
    } else {
      msg.textContent = data.error || "保存できませんでした。";
      msg.style.color = "#a33";
    }
  } catch(e) {
    msg.textContent = "通信エラーです。";
    msg.style.color = "#a33";
  }
});

document.getElementById("copyTextBtn").addEventListener("click", async () => {
  await navigator.clipboard.writeText(window.lastLineText || document.getElementById("albumUrlOutput").value);
  alert("LINE送信用文をコピーしました。");
});

function isExpired(limitDateText) {
  const normalized = String(limitDateText || "").replace(/\./g, "/").replace(/-/g, "/");
  const limit = new Date(normalized + " 23:59:59");
  return !isNaN(limit.getTime()) && new Date() > limit;
}

function renderDashboard(albums) {
  const active = albums.filter(a => !isExpired(a.limitDate)).length;
  const expired = albums.filter(a => isExpired(a.limitDate)).length;
  document.getElementById("dashboard").innerHTML = `
    <div>公開中<br><strong>${active}</strong></div>
    <div>期限切れ<br><strong>${expired}</strong></div>
    <div>合計<br><strong>${albums.length}</strong></div>
  `;
}

function renderAlbumList() {
  const q = document.getElementById("searchInput").value.trim().toLowerCase();
  const list = document.getElementById("albumList");
  const filtered = allAlbums.filter(a => `${a.customer || ""} ${a.type || ""} ${a.title || ""} ${a.slug || ""}`.toLowerCase().includes(q));
  renderDashboard(allAlbums);
  if (!filtered.length) {
    list.innerHTML = '<p class="admin-message">該当するアルバムがありません。</p>';
    return;
  }
  list.innerHTML = "";
  [...filtered].reverse().forEach((album) => {
    const url = albumUrlFromSlug(album.slug);
    const item = document.createElement("div");
    item.className = "album-item";
    item.innerHTML = `
      <h3>${album.title || album.slug}</h3>
      <p class="album-meta">
        slug：${album.slug}<br>
        納品日：${album.shootDate || "-"}<br>
        期限：${album.limitDate || "-"}<br>
        パスワード：${album.password || "-"}<br>
        状態：${isExpired(album.limitDate) ? "期限切れ" : "公開中"}
      </p>
      <div class="album-actions">
        <a href="${url}" target="_blank">開く</a>
        <button type="button" data-copy-url="${url}">URLコピー</button>
        <button type="button" class="line" data-line="${album.slug}">LINE文コピー</button>
        <button type="button" data-edit="${album.slug}">編集</button>
        <button type="button" data-delete="${album.slug}">削除</button>
      </div>`;
    list.appendChild(item);
  });
  list.querySelectorAll("[data-copy-url]").forEach(btn => btn.addEventListener("click", async () => {
    await navigator.clipboard.writeText(btn.dataset.copyUrl);
    alert("URLをコピーしました。");
  }));
  list.querySelectorAll("[data-line]").forEach(btn => btn.addEventListener("click", async () => {
    const album = allAlbums.find(a => a.slug === btn.dataset.line);
    await navigator.clipboard.writeText(makeLineText(album.title, albumUrlFromSlug(album.slug), album.password, album.limitDate));
    alert("LINE送信用文をコピーしました。");
  }));
  list.querySelectorAll("[data-edit]").forEach(btn => btn.addEventListener("click", () => openEdit(btn.dataset.edit)));
  list.querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", () => deleteAlbum(btn.dataset.delete)));
}

async function loadAlbumList() {
  const key = document.getElementById("keyInput").value.trim();
  const list = document.getElementById("albumList");
  if (!key) {
    list.innerHTML = '<p class="admin-message" style="color:#a33;">管理キーを入力してください。</p>';
    return;
  }
  list.innerHTML = '<p class="admin-message">読み込み中です...</p>';
  const params = new URLSearchParams({ action:"list", key });
  const data = await jsonp(ALBUM_API_URL + "?" + params.toString());
  if (!data.ok) {
    list.innerHTML = '<p class="admin-message" style="color:#a33;">' + (data.error || "読み込めませんでした。") + '</p>';
    return;
  }
  allAlbums = data.albums || [];
  renderAlbumList();
}

document.getElementById("loadListBtn").addEventListener("click", loadAlbumList);
document.getElementById("searchInput").addEventListener("input", renderAlbumList);

function openEdit(slug) {
  const album = allAlbums.find(a => a.slug === slug);
  if (!album) return;
  document.getElementById("editSlug").value = album.slug;
  document.getElementById("editCustomer").value = album.customer || (album.title || "").split(" ")[0] || "";
  document.getElementById("editType").value = album.type || "その他";
  document.getElementById("editFolder").value = album.folderId || "";
  document.getElementById("editPassword").value = album.password || "";
  document.getElementById("editLimit").value = album.limitDate || "";
  document.getElementById("editDialog").showModal();
}

document.getElementById("updateAlbumBtn").addEventListener("click", async () => {
  const key = document.getElementById("keyInput").value.trim();
  const slug = document.getElementById("editSlug").value;
  const customer = document.getElementById("editCustomer").value.trim();
  const type = document.getElementById("editType").value;
  const folderId = extractFolderId(document.getElementById("editFolder").value);
  const password = document.getElementById("editPassword").value.trim();
  const limitDate = document.getElementById("editLimit").value.trim();
  const title = `${customer} ${type}`;
  const params = new URLSearchParams({ action:"update", key, slug, customer, type, title, folderId, password, limitDate });
  const data = await jsonp(ALBUM_API_URL + "?" + params.toString());
  if (data.ok) {
    alert("更新しました。");
    document.getElementById("editDialog").close();
    loadAlbumList();
  } else {
    alert(data.error || "更新できませんでした。");
  }
});

async function deleteAlbum(slug) {
  if (!confirm("本当に削除しますか？")) return;
  const key = document.getElementById("keyInput").value.trim();
  const params = new URLSearchParams({ action:"delete", key, slug });
  const data = await jsonp(ALBUM_API_URL + "?" + params.toString());
  if (data.ok) {
    alert("削除しました。");
    loadAlbumList();
  } else {
    alert(data.error || "削除できませんでした。");
  }
}
