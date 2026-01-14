/**
 * Theme Toggle Module
 * Reusable component for theme switching functionality
 */
export class ThemeToggle {
  constructor() {
    this.currentTheme = "light";
    this.themeToggleButton = null;
    this.isInitialized = false;
    this.boundToggleTheme = this.toggleTheme.bind(this);
  }

  /**
   * Initialize theme toggle functionality
   * @param {string} buttonSelector - CSS selector for theme toggle button
   */
  initialize(buttonSelector = "#themeToggle") {
    if (this.isInitialized) return;

    // Ensure theme CSS is loaded
    this.loadThemeCSS();

    const themeToggle = document.querySelector(buttonSelector);
    if (!themeToggle) {
      console.warn("Theme toggle button not found:", buttonSelector);
      return;
    }

    this.themeToggleButton = themeToggle;
    this.themeToggleButton.addEventListener("click", this.boundToggleTheme);
    this.loadSavedTheme();
    this.updateButtonDisplay();
    this.isInitialized = true;
  }

  /**
   * Toggle between light and dark themes
   */
  toggleTheme() {
    const currentTheme = this.getCurrentTheme();
    const newTheme = currentTheme === "dark" ? "light" : "dark";

    this.setTheme(newTheme);
    this.saveTheme(newTheme);
    this.updateButtonDisplay();
  }

  /**
   * Set theme directly
   * @param {string} theme - "light" or "dark"
   */
  setTheme(theme) {
    if (theme !== "light" && theme !== "dark") {
      console.warn("Invalid theme:", theme);
      return;
    }

    document.documentElement.setAttribute("data-theme", theme);
    this.currentTheme = theme;
  }

  /**
   * Get current theme
   * @returns {string} Current theme ("light" or "dark")
   */
  getCurrentTheme() {
    return document.documentElement.getAttribute("data-theme") || "light";
  }

  /**
   * Save theme to localStorage
   * @param {string} theme - Theme to save
   */
  saveTheme(theme) {
    try {
      localStorage.setItem("globalTheme", theme);
    } catch (error) {
      console.warn("Failed to save theme to localStorage:", error);
    }
  }

  /**
   * Load saved theme from localStorage
   */
  loadSavedTheme() {
    try {
      const savedTheme = localStorage.getItem("globalTheme") || "light";
      this.setTheme(savedTheme);
    } catch (error) {
      console.warn("Failed to load theme from localStorage:", error);
      this.setTheme("light");
    }
  }

  /**
   * Load theme CSS file if not already loaded
   */
  loadThemeCSS() {
    // Check if theme CSS is already loaded
    const existingLink = document.querySelector('link[data-theme-css]');
    if (existingLink) return;

    // Create and inject theme CSS link
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '../../../style/themes.css';
    link.setAttribute('data-theme-css', 'true');

    // Insert at the beginning of head to ensure high priority
    const head = document.head;
    head.insertBefore(link, head.firstChild);
  }

  /**
   * Update theme toggle button display
   */
  updateButtonDisplay() {
    if (!this.themeToggleButton) return;

    const currentTheme = this.getCurrentTheme();

    if (currentTheme === "dark") {
      this.themeToggleButton.innerHTML = '<span class="theme-icon">☀️</span>';
      this.themeToggleButton.title = "Switch to Light Mode";
      this.themeToggleButton.setAttribute("aria-label", "Switch to Light Mode");
    } else {
      this.themeToggleButton.innerHTML = '<span class="theme-icon">🌙</span>';
      this.themeToggleButton.title = "Switch to Dark Mode";
      this.themeToggleButton.setAttribute("aria-label", "Switch to Dark Mode");
    }
  }

  /**
   * Destroy theme toggle (remove event listeners)
   */
  destroy() {
    if (this.themeToggleButton) {
      this.themeToggleButton.removeEventListener("click", this.boundToggleTheme);
      this.themeToggleButton = null;
    }
    this.isInitialized = false;
  }

  /**
   * Get theme toggle button element
   * @returns {HTMLElement|null} Theme toggle button element
   */
  getButton() {
    return this.themeToggleButton;
  }

  /**
   * Check if theme toggle is initialized
   * @returns {boolean} Initialization status
   */
  isReady() {
    return this.isInitialized;
  }
}

// Export singleton instance for easy usage
export const themeToggle = new ThemeToggle();