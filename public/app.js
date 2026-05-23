const SHORTCUTS = {
  tiktok: "https://www.tiktok.com",
  crazygames: "https://www.crazygames.com",
  "crazygames.gg": "https://www.crazygames.com",
  youtube: "https://www.youtube.com",
  google: "https://www.google.com",
  discord: "https://discord.com/app",
  twitter: "https://x.com",
  instagram: "https://www.instagram.com",
  reddit: "https://www.reddit.com",
};

const GAME_HOSTS =
  /crazygames|poki\.com|kongregate|itch\.io|miniclip|armorgames|now\.gg|gamepix/i;

const SITES = [
  { name: "Wikipedia", url: "https://www.wikipedia.org", icon: "📚", cat: "learn" },
  { name: "YouTube", url: "https://www.youtube.com", icon: "▶️", cat: "media" },
  { name: "Reddit", url: "https://www.reddit.com", icon: "🔴", cat: "social" },
  { name: "Twitter / X", url: "https://x.com", icon: "🐦", cat: "social" },
  { name: "Discord", url: "https://discord.com/app", icon: "💬", cat: "social" },
  { name: "Twitch", url: "https://www.twitch.tv", icon: "🟣", cat: "media" },
  { name: "Spotify Web", url: "https://open.spotify.com", icon: "🎵", cat: "media" },
  { name: "GitHub", url: "https://github.com", icon: "🐙", cat: "tools" },
  { name: "Google", url: "https://www.google.com", icon: "🔎", cat: "tools" },
  { name: "DuckDuckGo", url: "https://duckduckgo.com", icon: "🦆", cat: "tools" },
  { name: "Hacker News", url: "https://news.ycombinator.com", icon: "📰", cat: "news" },
  { name: "BBC News", url: "https://www.bbc.com/news", icon: "🌍", cat: "news" },
  { name: "Internet Archive", url: "https://archive.org", icon: "🏛️", cat: "learn" },
  { name: "Khan Academy", url: "https://www.khanacademy.org", icon: "🎓", cat: "learn" },
  { name: "Stack Overflow", url: "https://stackoverflow.com", icon: "📋", cat: "tools" },
  { name: "Netflix", url: "https://www.netflix.com", icon: "🎬", cat: "media" },
  { name: "Instagram", url: "https://www.instagram.com", icon: "📷", cat: "social" },
  { name: "TikTok", url: "https://www.tiktok.com", icon: "🎵", cat: "media" },
  { name: "CrazyGames", url: "https://www.crazygames.com", icon: "🎮", cat: "media" },
  { name: "Pinterest", url: "https://www.pinterest.com", icon: "📌", cat: "social" },
  { name: "LinkedIn", url: "https://www.linkedin.com", icon: "💼", cat: "social" },
  { name: "CNN", url: "https://www.cnn.com", icon: "📺", cat: "news" },
  { name: "NY Times", url: "https://www.nytimes.com", icon: "📰", cat: "news" },
  { name: "Coursera", url: "https://www.coursera.org", icon: "📖", cat: "learn" },
  { name: "CodePen", url: "https://codepen.io", icon: "✏️", cat: "tools" },
];

let tabs = [{ id: 1, title: "New tab", url: "", history: [], historyIndex: -1 }];
let activeTabId = 1;
let nextTabId = 2;
let currentFilter = "all";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function proxyUrl(target) {
  return `/browse?url=${encodeURIComponent(target)}`;
}

function hostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function showView(name) {
  $$(".view").forEach((v) => v.classList.remove("active"));
  $$(".nav-btn").forEach((b) => b.classList.remove("active"));
  if (name === "home") {
    $("#view-home").classList.add("active");
    $$('.nav-btn[data-tab="home"]')[0]?.classList.add("active");
  } else {
    $("#view-browse").classList.add("active");
    $$('.nav-btn[data-tab="browse"]')[0]?.classList.add("active");
  }
}

function getActiveTab() {
  return tabs.find((t) => t.id === activeTabId) || tabs[0];
}

function renderTabs() {
  const strip = $("#tab-strip");
  strip.innerHTML = "";
  tabs.forEach((tab) => {
    const el = document.createElement("div");
    el.className = "tab" + (tab.id === activeTabId ? " active" : "");
    el.innerHTML = `
      <span class="tab-title">${tab.title || "New tab"}</span>
      ${tabs.length > 1 ? '<button class="tab-close" type="button">×</button>' : ""}
    `;
    el.addEventListener("click", (e) => {
      if (e.target.classList.contains("tab-close")) {
        closeTab(tab.id);
        return;
      }
      switchTab(tab.id);
    });
    strip.appendChild(el);
  });
}

function switchTab(id) {
  activeTabId = id;
  const tab = getActiveTab();
  renderTabs();
  updateBrowserUi(tab);
}

function closeTab(id) {
  if (tabs.length === 1) return;
  const idx = tabs.findIndex((t) => t.id === id);
  tabs = tabs.filter((t) => t.id !== id);
  if (activeTabId === id) {
    activeTabId = tabs[Math.max(0, idx - 1)].id;
  }
  renderTabs();
  updateBrowserUi(getActiveTab());
}

function newTab(url = "") {
  const tab = { id: nextTabId++, title: "New tab", url: "", history: [], historyIndex: -1 };
  tabs.push(tab);
  activeTabId = tab.id;
  renderTabs();
  if (url) navigate(url);
  else updateBrowserUi(tab);
}

function pushHistory(tab, url) {
  if (tab.historyIndex < tab.history.length - 1) {
    tab.history = tab.history.slice(0, tab.historyIndex + 1);
  }
  if (tab.history[tab.history.length - 1] !== url) {
    tab.history.push(url);
  }
  tab.historyIndex = tab.history.length - 1;
}

function applyShortcut(input) {
  const key = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
  return SHORTCUTS[key] || null;
}

function normalizeInput(input) {
  let url = (input || "").trim();
  if (!url) return null;

  const proxyMatch = url.match(/\/browse\?url=([^&]+)/i);
  if (proxyMatch) {
    try {
      url = decodeURIComponent(proxyMatch[1]);
    } catch {
      /* keep */
    }
  }

  const shortcut = applyShortcut(url);
  if (shortcut) return shortcut;

  if (!/^https?:\/\//i.test(url)) {
    if (/\s/.test(url)) {
      return `https://www.google.com/search?q=${encodeURIComponent(url)}`;
    }
    if (!url.includes(".")) {
      url = `https://www.${url}.com`;
    } else {
      url = `https://${url}`;
    }
  }

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function isGameSite(url) {
  try {
    return GAME_HOSTS.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

function showProxyError(msg) {
  const el = $("#proxy-error");
  el.textContent = msg;
  el.classList.remove("hidden");
}

function hideProxyError() {
  $("#proxy-error").classList.add("hidden");
}

function checkFrameError(frame) {
  try {
    const text = frame.contentDocument?.body?.innerText || "";
    if (
      /Guru Meditation|Goofy Deploy|NOT_FOUND|404: NOT_FOUND|Deploy Page Server/i.test(
        text
      )
    ) {
      showProxyError(
        "Proxy route missing on your host (404). Redeploy the full project with api/browse.js and vercel.json rewrites. Or click Full page / run locally with node server.js."
      );
      return true;
    }
    if (text.length < 20 && frame.contentDocument?.body?.children.length === 0) {
      showProxyError(
        "Page loaded blank — this site may block proxies or need Full page mode. Try ↗ Full page or a simpler site first."
      );
      return true;
    }
  } catch {
    /* cross-origin — ignore */
  }
  hideProxyError();
  return false;
}

async function resolveUrl(input) {
  const local = normalizeInput(input);
  if (!local) throw new Error("Invalid URL");

  try {
    const res = await fetch(`/api/resolve?url=${encodeURIComponent(input.trim())}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.url) return data;
    }
  } catch {
    /* server unreachable — use client-side normalization */
  }

  return { url: local, proxyUrl: proxyUrl(local) };
}

function openFullPage(target) {
  window.location.href = proxyUrl(target);
}

async function navigate(input, opts = {}) {
  const trimmed = (input || "").trim();
  if (!trimmed) return;

  let target;
  try {
    const data = await resolveUrl(trimmed);
    target = data.url;
  } catch {
    alert("Please enter a valid URL (e.g. example.com or tiktok)");
    return;
  }

  hideProxyError();

  if (opts.fullPage || isGameSite(target)) {
    openFullPage(target);
    return;
  }

  const tab = getActiveTab();
  tab.url = target;
  tab.title = hostname(target);
  pushHistory(tab, target);

  showView("browse");
  renderTabs();
  updateBrowserUi(tab);

  const frame = $("#browser-frame");
  const loading = $("#browser-loading");
  const empty = $("#browser-empty");

  empty.classList.add("hidden");
  loading.classList.remove("hidden");
  frame.classList.remove("hidden");

  frame.onload = () => {
    loading.classList.add("hidden");
    checkFrameError(frame);
  };
  frame.onerror = () => {
    loading.classList.add("hidden");
    showProxyError("Failed to load page. Try ↗ Full page or check that /browse is deployed.");
  };
  frame.src = proxyUrl(target);
}

function updateBrowserUi(tab) {
  $("#browser-url").value = tab.url || "";
  $("#btn-back").disabled = tab.historyIndex <= 0;
  $("#btn-forward").disabled = tab.historyIndex >= tab.history.length - 1;
  $("#btn-fullscreen").hidden = !tab.url;

  const frame = $("#browser-frame");
  const empty = $("#browser-empty");
  const loading = $("#browser-loading");

  if (tab.url) {
    empty.classList.add("hidden");
    frame.src = proxyUrl(tab.url);
    loading.classList.add("hidden");
  } else {
    frame.src = "about:blank";
    empty.classList.remove("hidden");
    loading.classList.add("hidden");
  }
}

function renderCards() {
  const grid = $("#cards-grid");
  const filtered =
    currentFilter === "all" ? SITES : SITES.filter((s) => s.cat === currentFilter);
  grid.innerHTML = filtered
    .map(
      (s) => `
    <article class="card" data-url="${s.url}">
      <div class="card-thumb">${s.icon}</div>
      <div class="card-body">
        <div class="card-title">${s.name}</div>
        <div class="card-meta">${hostname(s.url)}</div>
      </div>
    </article>
  `
    )
    .join("");

  grid.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("click", () => navigate(card.dataset.url));
  });
}

function init() {
  renderCards();

  $("#search-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const val = $("#url-input").value.trim();
    if (val) navigate(val);
  });

  $("#browser-url-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const val = $("#browser-url").value.trim();
    if (val) navigate(val);
  });

  $$(".tag").forEach((btn) => {
    btn.addEventListener("click", () => navigate(btn.dataset.url));
  });

  $$(".cat-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      $$(".cat-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      currentFilter = chip.dataset.filter;
      renderCards();
    });
  });

  $$(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      if (tab === "popular") {
        showView("home");
        document.getElementById("cards-grid").scrollIntoView({ behavior: "smooth" });
        return;
      }
      showView(tab === "browse" ? "browse" : "home");
    });
  });

  $(".logo").addEventListener("click", (e) => {
    e.preventDefault();
    showView("home");
  });

  $("#btn-new-tab").addEventListener("click", () => {
    newTab();
    showView("browse");
  });

  $("#btn-back").addEventListener("click", () => {
    const tab = getActiveTab();
    if (tab.historyIndex > 0) {
      tab.historyIndex--;
      tab.url = tab.history[tab.historyIndex];
      tab.title = hostname(tab.url);
      renderTabs();
      updateBrowserUi(tab);
    }
  });

  $("#btn-forward").addEventListener("click", () => {
    const tab = getActiveTab();
    if (tab.historyIndex < tab.history.length - 1) {
      tab.historyIndex++;
      tab.url = tab.history[tab.historyIndex];
      tab.title = hostname(tab.url);
      renderTabs();
      updateBrowserUi(tab);
    }
  });

  $("#btn-reload").addEventListener("click", () => {
    const tab = getActiveTab();
    if (tab.url) {
      const frame = $("#browser-frame");
      frame.src = proxyUrl(tab.url);
    }
  });

  $("#btn-home-bar").addEventListener("click", () => showView("home"));

  $("#btn-popout").addEventListener("click", () => {
    const tab = getActiveTab();
    if (tab.url) openFullPage(tab.url);
    else {
      const val = $("#browser-url").value.trim();
      if (val) navigate(val, { fullPage: true });
    }
  });

  $("#btn-fullscreen").addEventListener("click", () => {
    const wrap = document.querySelector(".browser-frame-wrap");
    if (!document.fullscreenElement) {
      wrap.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  });

  renderTabs();

  const params = new URLSearchParams(location.search);
  const startUrl = params.get("url");
  if (startUrl) navigate(startUrl);
}

init();
