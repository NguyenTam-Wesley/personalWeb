/**
 * QuillEditor - Reusable Rich Text Editor Component
 * Supports theme toggle, auto-sync with hidden inputs, and customizable toolbar
 */

export class QuillEditor {
  constructor(options = {}) {
    this.options = {
      container: '#editor', // CSS selector or DOM element
      hiddenInput: null, // CSS selector for hidden input to sync with
      height: 300,
      placeholder: 'Start writing...',
      theme: 'snow',
      toolbar: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'indent': '-1'}, { 'indent': '+1' }],
        ['link'],
        [{ 'color': [] }, { 'background': [] }],
        ['clean']
      ],
      formats: [
        'header', 'bold', 'italic', 'underline', 'strike',
        'list', 'bullet', 'indent', 'link', 'color', 'background'
      ],
      ...options
    };

    this.quill = null;
    this.container = null;
    this.hiddenInput = null;
    this.themeObserver = null;

    this.init();
  }

  init() {
    // Wait for Quill to be available
    if (typeof Quill === 'undefined') {
      console.warn('⚠️ Quill not loaded, retrying...');
      setTimeout(() => this.init(), 100);
      return;
    }

    this.setupContainer();
    this.setupHiddenInput();
    this.initializeQuill();
    this.setupThemeObserver();
    this.bindEvents();
  }

  setupContainer() {
    if (typeof this.options.container === 'string') {
      this.container = document.querySelector(this.options.container);
    } else {
      this.container = this.options.container;
    }

    if (!this.container) {
      throw new Error(`Container element not found: ${this.options.container}`);
    }

    // Ensure container has proper styling
    this.container.style.minHeight = this.options.height + 'px';
  }

  setupHiddenInput() {
    if (this.options.hiddenInput) {
      if (typeof this.options.hiddenInput === 'string') {
        this.hiddenInput = document.querySelector(this.options.hiddenInput);
      } else {
        this.hiddenInput = this.options.hiddenInput;
      }
    }
  }

  initializeQuill() {
    try {
      this.quill = new Quill(this.container, {
        theme: this.options.theme,
        modules: {
          toolbar: this.options.toolbar
        },
        placeholder: this.options.placeholder,
        formats: this.options.formats
      });

      console.log('✅ QuillEditor initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize QuillEditor:', error);
      throw error;
    }
  }

  setupThemeObserver() {
    // Watch for theme changes
    this.themeObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          this.updateTheme();
        }
      });
    });

    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    // Initial theme setup
    this.updateTheme();
  }

  updateTheme() {
    if (!this.quill) return;

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    // Update Quill styling based on theme
    const toolbar = this.container.querySelector('.ql-toolbar');
    const container = this.container.querySelector('.ql-container');

    if (toolbar && container) {
      if (isDark) {
        toolbar.style.background = 'var(--bg-card, #2d3748)';
        toolbar.style.borderColor = 'var(--bg-tertiary, #374151)';
        container.style.background = 'var(--bg-card, #2d3748)';
        container.style.borderColor = 'var(--bg-tertiary, #374151)';
      } else {
        toolbar.style.background = 'var(--bg-primary, #ffffff)';
        toolbar.style.borderColor = 'var(--bg-tertiary, #f1f5f9)';
        container.style.background = 'var(--bg-primary, #ffffff)';
        container.style.borderColor = 'var(--bg-tertiary, #f1f5f9)';
      }
    }
  }

  bindEvents() {
    if (!this.quill) return;

    // Sync content to hidden input
    this.quill.on('text-change', () => {
      if (this.hiddenInput) {
        this.hiddenInput.value = this.getHTML();
      }
    });
  }

  // Public API methods
  getHTML() {
    return this.quill ? this.quill.root.innerHTML : '';
  }

  getText() {
    return this.quill ? this.quill.getText() : '';
  }

  getContents() {
    return this.quill ? this.quill.getContents() : null;
  }

  setHTML(html) {
    if (this.quill) {
      this.quill.root.innerHTML = html;
      if (this.hiddenInput) {
        this.hiddenInput.value = html;
      }
    }
  }

  setContents(delta) {
    if (this.quill) {
      this.quill.setContents(delta);
    }
  }

  setText(text) {
    if (this.quill) {
      this.quill.setText(text);
    }
  }

  reset() {
    if (this.quill) {
      this.quill.setContents([]);
      if (this.hiddenInput) {
        this.hiddenInput.value = '';
      }
    }
  }

  focus() {
    if (this.quill) {
      this.quill.focus();
    }
  }

  destroy() {
    if (this.themeObserver) {
      this.themeObserver.disconnect();
    }

    if (this.quill) {
      // Quill doesn't have a destroy method, but we can clean up
      this.quill = null;
    }
  }

  // Utility method to check if editor is ready
  isReady() {
    return this.quill !== null;
  }

  // Get editor instance (for advanced usage)
  getQuill() {
    return this.quill;
  }
}

// Factory function for easier usage
export function createQuillEditor(options) {
  return new QuillEditor(options);
}

// Default export
export default QuillEditor;