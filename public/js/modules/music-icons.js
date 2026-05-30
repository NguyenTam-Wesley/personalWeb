/**
 * Rhodes Island terminal icon set — Music page only.
 * Stroke-based SVGs; use currentColor for theme tokens.
 */

const SVG_ROOT =
  'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter"';

const PATHS = {
  play: '<polygon points="9,6 9,18 19,12" />',
  pause: '<line x1="8" y1="6" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="18" />',
  prev: '<polyline points="6,6 6,18" /><polygon points="6,12 16,6 16,18" />',
  next: '<polyline points="18,6 18,18" /><polygon points="18,12 8,6 8,18" />',
  shuffle:
    '<polyline points="4,16 9,11 14,16" /><polyline points="20,8 15,13 10,8" /><line x1="4" y1="8" x2="9" y2="13" /><line x1="15" y1="11" x2="20" y2="16" />',
  shuffleOff: '<line x1="5" y1="12" x2="19" y2="12" /><polyline points="14,7 19,12 14,17" />',
  repeat:
    '<polyline points="17,7 17,4 7,4 7,9" /><polyline points="7,17 7,20 17,20 17,15" /><polyline points="14,7 17,4 17,7" /><polyline points="10,17 7,20 7,17" />',
  repeatOne:
    '<polyline points="17,7 17,4 7,4 7,9" /><polyline points="7,17 7,20 17,20 17,15" /><polyline points="14,7 17,4 17,7" /><polyline points="10,17 7,20 7,17" /><text x="12" y="15" font-size="7" font-family="monospace" fill="currentColor" stroke="none" text-anchor="middle">1</text>',
  queue:
    '<line x1="5" y1="7" x2="19" y2="7" /><line x1="5" y1="12" x2="19" y2="12" /><line x1="5" y1="17" x2="14" y2="17" /><polyline points="16,15 19,17 16,19" />',
  queueAdd:
    '<line x1="5" y1="8" x2="13" y2="8" /><line x1="5" y1="12" x2="11" y2="12" /><line x1="5" y1="16" x2="9" y2="16" /><line x1="17" y1="12" x2="21" y2="12" /><line x1="19" y1="10" x2="19" y2="14" />',
  playNext:
    '<polygon points="8,6 8,18 16,12" /><line x1="18" y1="6" x2="18" y2="18" />',
  add:
    '<rect x="5" y="5" width="14" height="14" /><line x1="12" y1="9" x2="12" y2="15" /><line x1="9" y1="12" x2="15" y2="12" />',
  remove:
    '<rect x="6" y="6" width="12" height="12" /><line x1="9" y1="9" x2="15" y2="15" /><line x1="15" y1="9" x2="9" y2="15" />',
  search:
    '<circle cx="10" cy="10" r="5" /><line x1="14" y1="14" x2="19" y2="19" />',
  close:
    '<line x1="7" y1="7" x2="17" y2="17" /><line x1="17" y1="7" x2="7" y2="17" />',
  clear:
    '<line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /><rect x="4" y="4" width="16" height="16" />',
  back:
    '<polyline points="14,6 8,12 14,18" /><line x1="5" y1="12" x2="19" y2="12" />',
  track:
    '<rect x="4" y="8" width="3" height="8" /><rect x="9" y="5" width="3" height="14" /><rect x="14" y="10" width="3" height="6" /><rect x="19" y="7" width="3" height="10" />',
  artist:
    '<rect x="9" y="4" width="6" height="9" /><line x1="7" y1="13" x2="17" y2="13" /><line x1="12" y1="13" x2="12" y2="19" /><line x1="9" y1="19" x2="15" y2="19" />',
  genre:
    '<rect x="4" y="4" width="7" height="7" /><rect x="13" y="4" width="7" height="7" /><rect x="4" y="13" width="7" height="7" /><rect x="13" y="13" width="7" height="7" />',
  region:
    '<circle cx="12" cy="12" r="8" /><line x1="4" y1="12" x2="20" y2="12" /><ellipse cx="12" cy="12" rx="4" ry="8" />',
  playlist:
    '<path d="M5 6h14v12H9l-4 4V6z" /><line x1="9" y1="10" x2="17" y2="10" /><line x1="9" y1="14" x2="15" y2="14" />',
  pencil:
    '<path d="M5 19l3-1 9-9-2-2-9 9-1 3z" /><line x1="14" y1="6" x2="18" y2="10" />',
  eraser:
    '<polygon points="5,19 9,15 19,5 15,5 5,15" /><line x1="5" y1="19" x2="9" y2="19" />',
  drag:
    '<line x1="8" y1="7" x2="16" y2="7" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="8" y1="17" x2="16" y2="17" />',
  empty:
    '<polygon points="12,5 19,12 12,19 5,12" />',
  success:
    '<polyline points="6,12 10,16 18,8" /><rect x="4" y="4" width="16" height="16" />',
  error:
    '<line x1="8" y1="8" x2="16" y2="16" /><line x1="16" y1="8" x2="8" y2="16" /><rect x="4" y="4" width="16" height="16" />',
  warning:
    '<line x1="12" y1="8" x2="12" y2="13" /><line x1="12" y1="16" x2="12" y2="17" /><polygon points="12,4 20,20 4,20" />',
  info:
    '<line x1="12" y1="10" x2="12" y2="16" /><line x1="12" y1="7" x2="12" y2="8" /><rect x="4" y="4" width="16" height="16" />',
  statusReady:
    '<line x1="5" y1="16" x2="5" y2="10" /><line x1="10" y1="16" x2="10" y2="7" /><line x1="15" y1="16" x2="15" y2="12" /><line x1="20" y1="16" x2="20" y2="5" />',
  statusOnline:
    '<path d="M5 18c3-4 11-4 14 0" /><path d="M8 15c2-2 6-2 8 0" /><circle cx="12" cy="8" r="2" />',
  archive:
    '<rect x="4" y="6" width="16" height="14" /><polyline points="4,6 8,3 16,3 20,6" />'
};

const CATEGORY_ICONS = {
  artist: "artist",
  genre: "genre",
  region: "region",
  playlist: "playlist"
};

/**
 * @param {string} name
 * @param {string} [className]
 * @returns {string}
 */
export function musicIcon(name, className = "ri-icon") {
  const body = PATHS[name];
  if (!body) return "";
  return `<svg class="${className}" ${SVG_ROOT} aria-hidden="true">${body}</svg>`;
}

/**
 * @param {HTMLElement} el
 * @param {string} name
 */
export function setMusicIcon(el, name) {
  if (!el) return;
  el.innerHTML = musicIcon(name);
}

/**
 * @param {HTMLElement} el
 * @param {"play"|"pause"} state
 */
export function setPlayPauseIcon(el, state) {
  setMusicIcon(el, state === "pause" ? "pause" : "play");
}

/**
 * @param {string} type
 * @returns {string}
 */
export function categoryIconName(type) {
  return CATEGORY_ICONS[type] || "archive";
}

/**
 * @param {string} type
 * @returns {string}
 */
export function getNotificationIconMarkup(type) {
  const map = {
    success: "success",
    error: "error",
    warning: "warning",
    info: "info"
  };
  return musicIcon(map[type] || "info", "ri-icon ri-icon--notify");
}
