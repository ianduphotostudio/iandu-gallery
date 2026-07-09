function getSlug() {
  const params = new URLSearchParams(location.search);
  const fromQuery = params.get("slug");
  if (fromQuery) return fromQuery;
  const path = location.pathname.replace(/^\//, "").replace(/\/$/, "");
  if (path && path !== "index.html") return path.split("/").pop();
  return DEFAULT_SLUG;
}

let showFavoritesOnly = false;
let lastPhotos = [];
let lightboxIndex = 0;
let touchStartX = 0;
let touchStartY = 0;
let zoomScale = 1;

function favoriteKey() {
  return "iuFavoritePhotos_" + getSlug();
}

function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem(favoriteKey()) || "[]");
  } catch(e) {
    return [];
  }
}

function saveFavorites(favorites) {
  localStorage.setItem(favoriteKey(), JSON.stringify(favorites));
}

function toggleFavorite(photoName) {
  const favorites = getFavorites();
  const index = favorites.indexOf(photoName);
  if (index >= 0) {
    favorites.splice(index, 1);
  } else {
    favorites.push(photoName);
  }
  saveFavorites(favorites);
  renderPhotos(lastPhotos);
}

function checkExpired(limitDateText) {
  if (!limitDateText) return false;
  const normalized = String(limitDateText).replace(/\./g, "/").replace(/-/g, "/");
  const limit = new Date(normalized + " 23:59:59");
  if (isNaN(limit.getTime())) return false;
  return new Date() > limit;
}

function showAlbum() {
  document.getElementById("passwordPanel").style.display = "none";
  document.getElementById("albumContent").style.display = "block";
}

function setupPassword(album) {
  const savedKey = "iuAlbumPass_" + album.slug;
  const savedPass = sessionStorage.getItem(savedKey);
  if (!album.password || String(album.password) === savedPass) {
    showAlbum();
    return;
  }
  document.getElementById("passwordPanel").style.display = "block";
  document.getElementById("passwordBtn").addEventListener("click", () => {
    const input = document.getElementById("passwordInput").value;
    if (String(input) === String(album.password)) {
      sessionStorage.setItem(savedKey, String(input));
      showAlbum();
    } else {
      document.getElementById("passwordError").textContent = "パスワードが違います。";
    }
  });
}

function applyAlbum(album) {
  if (album.error) {
    document.getElementById("albumTitle").textContent = "アルバムが見つかりません";
    return;
  }
  document.getElementById("albumTitle").textContent = album.title;
  document.getElementById("shootDate").textContent = album.shootDate;
  document.getElementById("limitDate").textContent = album.limitDate;
  document.getElementById("folderLink").href = "https://drive.google.com/drive/folders/" + album.folderId;
  const allBtn = document.getElementById("downloadAllBtn");
  if (allBtn) allBtn.href = "https://drive.google.com/drive/folders/" + album.folderId;
  document.getElementById("photoCount").textContent = "全" + (album.photos ? album.photos.length : 0) + "枚";

  if (checkExpired(album.limitDate)) {
    document.getElementById("albumContent").innerHTML = '<div class="expired">ダウンロード期限が終了しました。<br>再発行をご希望の場合はお問い合わせください。</div>';
    showAlbum();
    return;
  }
  renderPhotos(album.photos);
  setupPassword(album);
}

function openLightbox(photo, index) {
  lightboxIndex = typeof index === "number" ? index : lightboxIndex;
  const lightbox = document.getElementById("lightbox");
  const image = document.getElementById("lightboxImage");
  const counter = document.getElementById("lightboxCounter");

  zoomScale = 1;
  image.style.transform = "scale(1)";
  image.src = photo.largeUrl || photo.imageUrl;
  image.alt = photo.name || "";

  document.getElementById("lightboxOriginal").href = getOriginalSaveUrl(photo);
  document.getElementById("lightboxMobile").href = photo.mobileUrl || photo.imageUrl;
  if (counter) counter.textContent = `${lightboxIndex + 1} / ${lastPhotos.length}`;
  lightbox.classList.add("is-open");
  lightbox.setAttribute("aria-hidden", "false");
}

function closeLightbox() {
  const lightbox = document.getElementById("lightbox");
  const image = document.getElementById("lightboxImage");
  lightbox.classList.remove("is-open");
  lightbox.setAttribute("aria-hidden", "true");
  image.src = "";
}

function showLightboxByIndex(index) {
  if (!lastPhotos || !lastPhotos.length) return;
  if (index < 0) index = lastPhotos.length - 1;
  if (index >= lastPhotos.length) index = 0;
  lightboxIndex = index;
  openLightbox(lastPhotos[lightboxIndex], lightboxIndex);
}

function nextPhoto() {
  showLightboxByIndex(lightboxIndex + 1);
}

function prevPhoto() {
  showLightboxByIndex(lightboxIndex - 1);
}

function toggleZoomLightbox() {
  const img = document.getElementById("lightboxImage");
  zoomScale = zoomScale === 1 ? 1.8 : 1;
  img.style.transform = `scale(${zoomScale})`;
}


function getDriveFileId(photo) {
  const candidates = [photo.downloadUrl, photo.imageUrl, photo.largeUrl, photo.mobileUrl].filter(Boolean);
  for (const url of candidates) {
    let match = String(url).match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    match = String(url).match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
  }
  return "";
}

function getOriginalSaveUrl(photo) {
  const id = getDriveFileId(photo);
  if (!id) return photo.downloadUrl || photo.largeUrl || photo.imageUrl;
  return "https://drive.google.com/file/d/" + id + "/view?usp=drivesdk";
}

function renderPhotos(photos) {
  lastPhotos = photos || lastPhotos || [];
  const favorites = getFavorites();
  const displayPhotos = showFavoritesOnly ? lastPhotos.filter(p => favorites.includes(p.name)) : lastPhotos;
  const gallery = document.getElementById("gallery");
  gallery.innerHTML = "";

  if (!displayPhotos || !displayPhotos.length) {
    gallery.innerHTML = showFavoritesOnly
      ? '<p class="loading">お気に入り写真はまだありません。</p>'
      : '<p class="loading">写真がまだ入っていません。</p>';
    return;
  }

  displayPhotos.forEach((photo, index) => {
    const realIndex = lastPhotos.findIndex(p => p.name === photo.name);
    const card = document.createElement("article");
    card.className = "photo-card";
    card.style.animationDelay = (index * 0.035) + "s";

    const favBtn = document.createElement("button");
    favBtn.className = "favorite-btn" + (favorites.includes(photo.name) ? " is-active" : "");
    favBtn.type = "button";
    favBtn.textContent = favorites.includes(photo.name) ? "♥" : "♡";
    favBtn.setAttribute("aria-label", "お気に入り");
    favBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavorite(photo.name);
    });

    const button = document.createElement("button");
    button.className = "photo-button";
    button.type = "button";
    button.addEventListener("click", () => openLightbox(photo, realIndex >= 0 ? realIndex : index));

    const img = document.createElement("img");
    img.src = photo.imageUrl;
    img.alt = photo.name;
    img.loading = "lazy";
    button.appendChild(img);

    const actions = document.createElement("div");
    actions.className = "photo-actions";

    const original = document.createElement("a");
    original.className = "original";
    original.href = getOriginalSaveUrl(photo);
    original.target = "_blank";
    original.rel = "noopener";
    original.textContent = "オリジナル保存";

    const mobile = document.createElement("a");
    mobile.className = "mobile";
    mobile.href = photo.mobileUrl || photo.imageUrl;
    mobile.target = "_blank";
    mobile.rel = "noopener";
    mobile.textContent = "スマホ用保存";

    actions.appendChild(original);
    actions.appendChild(mobile);
    card.appendChild(favBtn);
    card.appendChild(button);
    card.appendChild(actions);
    gallery.appendChild(card);
  });
}

document.getElementById("closeLightbox").addEventListener("click", closeLightbox);
document.getElementById("lightbox").addEventListener("click", (e) => {
  if (e.target.id === "lightbox") closeLightbox();
});

const nextBtn = document.getElementById("lightboxNext");
const prevBtn = document.getElementById("lightboxPrev");
const lightboxImage = document.getElementById("lightboxImage");

if (nextBtn) nextBtn.addEventListener("click", (e) => { e.stopPropagation(); nextPhoto(); });
if (prevBtn) prevBtn.addEventListener("click", (e) => { e.stopPropagation(); prevPhoto(); });

if (lightboxImage) {
  lightboxImage.addEventListener("touchstart", (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  lightboxImage.addEventListener("touchend", (e) => {
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const diffX = touchStartX - endX;
    const diffY = touchStartY - endY;
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 45) {
      if (diffX > 0) nextPhoto();
      if (diffX < 0) prevPhoto();
    }
  }, { passive: true });

  lightboxImage.addEventListener("dblclick", toggleZoomLightbox);
}

document.addEventListener("keydown", (e) => {
  const lightbox = document.getElementById("lightbox");
  if (!lightbox || !lightbox.classList.contains("is-open")) return;
  if (e.key === "ArrowRight") nextPhoto();
  if (e.key === "ArrowLeft") prevPhoto();
  if (e.key === "Escape") closeLightbox();
});

const favoriteOnlyBtn = document.getElementById("favoriteOnlyBtn");
if (favoriteOnlyBtn) {
  favoriteOnlyBtn.addEventListener("click", () => {
    showFavoritesOnly = !showFavoritesOnly;
    favoriteOnlyBtn.textContent = showFavoritesOnly ? "全ての写真を表示" : "♡ お気に入りだけ表示";
    renderPhotos(lastPhotos);
  });
}

(function loadAlbum() {
  const s = document.createElement("script");
  s.src = ALBUM_API_URL + "?slug=" + encodeURIComponent(getSlug()) + "&callback=applyAlbum";
  document.body.appendChild(s);
})();
