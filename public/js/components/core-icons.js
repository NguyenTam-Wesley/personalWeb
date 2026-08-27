/**
 * Rhodes Island core infrastructure icons — Header/Footer (shared).
 */

const SVG_ROOT =
  'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter"';

const PATHS = {
  themeSun:
    '<circle cx="12" cy="12" r="4" /><line x1="12" y1="2" x2="12" y2="5" /><line x1="12" y1="19" x2="12" y2="22" /><line x1="2" y1="12" x2="5" y2="12" /><line x1="19" y1="12" x2="22" y2="12" /><line x1="4.2" y1="4.2" x2="6.3" y2="6.3" /><line x1="17.7" y1="17.7" x2="19.8" y2="19.8" /><line x1="4.2" y1="19.8" x2="6.3" y2="17.7" /><line x1="17.7" y1="6.3" x2="19.8" y2="4.2" />',
  themeMoon:
    '<path d="M18 14a6 6 0 11-8-8 7 7 0 008 8z" />',
  network:
    '<circle cx="12" cy="12" r="2" /><line x1="12" y1="2" x2="12" y2="8" /><line x1="12" y1="16" x2="12" y2="22" /><line x1="2" y1="12" x2="8" y2="12" /><line x1="16" y1="12" x2="22" y2="12" />',
  signal:
    '<line x1="5" y1="16" x2="5" y2="10" /><line x1="10" y1="16" x2="10" y2="7" /><line x1="15" y1="16" x2="15" y2="12" /><line x1="20" y1="16" x2="20" y2="5" />',
  access:
    '<rect x="5" y="10" width="14" height="10" /><path d="M8 10V8a4 4 0 018 0v2" />',
  archive:
    '<rect x="4" y="4" width="16" height="6" /><rect x="4" y="12" width="16" height="8" /><line x1="8" y1="8" x2="16" y2="8" /><line x1="8" y1="16" x2="14" y2="16" />',
  node:
    '<rect x="3" y="3" width="8" height="8" /><rect x="13" y="13" width="8" height="8" /><line x1="11" y1="7" x2="13" y2="13" />',
  home:
    '<path d="M4 11L12 4l8 7" /><path d="M6 10v9h12v-9" />',
  menu:
    '<line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" />'
};

/**
 * @param {string} name
 * @param {string} [className]
 * @returns {string}
 */
export function coreIcon(name, className = "ri-core-icon") {
  const body = PATHS[name];
  if (!body) return "";
  return `<svg class="${className}" ${SVG_ROOT} aria-hidden="true">${body}</svg>`;
}
