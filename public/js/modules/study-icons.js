/**
 * Rhodes Island Knowledge Archive icons — Study page only.
 */

const SVG_ROOT =
  'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter"';

const PATHS = {
  search:
    '<circle cx="10" cy="10" r="5" /><line x1="14" y1="14" x2="19" y2="19" />',
  document:
    '<path d="M7 4h7l5 5v11H7V4z" /><line x1="14" y1="4" x2="14" y2="9" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="13" y2="16" />',
  archive:
    '<rect x="4" y="6" width="16" height="14" /><polyline points="4,6 8,3 16,3 20,6" />',
  folder:
    '<path d="M4 7h6l2 2h8v10H4V7z" />',
  external:
    '<polyline points="14,4 20,4 20,10" /><line x1="20" y1="4" x2="11" y2="13" /><line x1="4" y1="11" x2="4" y2="20" /><line x1="11" y1="20" x2="20" y2="20" />',
  filter:
    '<polygon points="5,4 19,4 13,13 13,20 11,20 11,13" />',
  sort:
    '<line x1="6" y1="8" x2="18" y2="8" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="10" y1="16" x2="14" y2="16" />',
  index:
    '<line x1="5" y1="6" x2="19" y2="6" /><line x1="5" y1="12" x2="19" y2="12" /><line x1="5" y1="18" x2="14" y2="18" />',
  statusReady:
    '<line x1="5" y1="16" x2="5" y2="10" /><line x1="10" y1="16" x2="10" y2="7" /><line x1="15" y1="16" x2="15" y2="12" /><line x1="20" y1="16" x2="20" y2="5" />',
  statusOnline:
    '<path d="M5 18c3-4 11-4 14 0" /><path d="M8 15c2-2 6-2 8 0" /><circle cx="12" cy="8" r="2" />',
  empty:
    '<polygon points="12,5 19,12 12,19 5,12" />'
};

/**
 * @param {string} name
 * @param {string} [className]
 * @returns {string}
 */
export function studyIcon(name, className = "stu-icon") {
  const body = PATHS[name];
  if (!body) return "";
  return `<svg class="${className}" ${SVG_ROOT} aria-hidden="true">${body}</svg>`;
}

/**
 * @param {HTMLElement} el
 * @param {string} name
 */
export function setStudyIcon(el, name) {
  if (!el) return;
  el.innerHTML = studyIcon(name);
}

export function initStudyPageIcons() {
  const map = [
    [".study-search-icon", "search"],
    [".study-status-badge-icon", "statusReady"],
    [".study-monitor-sys-icon", "statusOnline"],
    [".study-filter-icon--type", "filter"],
    [".study-filter-icon--sort", "sort"]
  ];
  map.forEach(([sel, icon]) => {
    const el = document.querySelector(sel);
    if (el) setStudyIcon(el, icon);
  });
}
