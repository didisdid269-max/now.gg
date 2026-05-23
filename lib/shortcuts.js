/** Common site names → full URLs (fixes "tiktok", "crazygames.gg", etc.) */
const SHORTCUTS = {
  tiktok: "https://www.tiktok.com",
  crazygames: "https://www.crazygames.com",
  "crazygames.gg": "https://www.crazygames.com",
  "crazygames.com": "https://www.crazygames.com",
  youtube: "https://www.youtube.com",
  google: "https://www.google.com",
  discord: "https://discord.com/app",
  twitter: "https://x.com",
  x: "https://x.com",
  instagram: "https://www.instagram.com",
  reddit: "https://www.reddit.com",
  netflix: "https://www.netflix.com",
  spotify: "https://open.spotify.com",
  twitch: "https://www.twitch.tv",
  roblox: "https://www.roblox.com",
  nowgg: "https://now.gg",
  "now.gg": "https://now.gg",
};

const GAME_HOSTS =
  /crazygames|poki\.com|kongregate|itch\.io|miniclip|armorgames|now\.gg|gamepix/i;

function applyShortcut(input) {
  const key = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
  if (SHORTCUTS[key]) return SHORTCUTS[key];
  return null;
}

function isGameSite(url) {
  try {
    return GAME_HOSTS.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

module.exports = { SHORTCUTS, applyShortcut, isGameSite, GAME_HOSTS };
