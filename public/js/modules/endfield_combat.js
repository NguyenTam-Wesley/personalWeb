import { supabase } from '../supabase/supabase.js';

/** Cache toàn bộ keywords, entries và keyword links */
let ALL_KEYWORDS_CACHE = null;
let ALL_ENTRIES_CACHE = null;
let KEYWORD_LINK_MAP_CACHE = {};

/**
 * EndfieldCombatManager - Wiki combat Endfield, load từ Supabase
 */
export class EndfieldCombatManager {
  constructor() {
    this.app = null;
  }

  static getSlug() {
    return new URLSearchParams(window.location.search).get('slug');
  }

  static getCategory() {
    return new URLSearchParams(window.location.search).get('category');
  }

  async init() {
    this.app = document.getElementById('endfieldCombatApp');
    if (!this.app) return;

    window.endfieldCombatNavigateTo = (slug) => this.navigateTo(slug);
    window.endfieldCombatNavigateToCategory = (category) => this.navigateToCategory(category);
    window.endfieldCombatNavigateToHome = () => this.navigateToHome();

    window.addEventListener('popstate', this.handlePopState = () => this.onPopState());

    await this.preloadAllData();

    const slug = EndfieldCombatManager.getSlug();
    const category = EndfieldCombatManager.getCategory();

    if (slug) {
      localStorage.setItem('endfieldLastSlug', slug);
      await this.loadEntry(slug);
    } else if (category) {
      await this.loadEntryList(category);
    } else {
      await this.loadEntryList();
    }

    console.log('EndfieldCombatManager initialized');
  }

  navigateTo(slug) {
    if (!slug) return;
    localStorage.setItem('endfieldLastSlug', slug);
    const url = new URL(window.location.href);
    url.searchParams.set('slug', slug);
    url.searchParams.delete('category');
    history.pushState({}, '', url);
    this.loadEntry(slug);
  }

  navigateToCategory(category) {
    const url = new URL(window.location.href);
    url.searchParams.set('category', category || '');
    url.searchParams.delete('slug');
    history.pushState({}, '', url);
    this.loadEntryList(category || null);
  }

  navigateToHome() {
    const url = new URL(window.location.href);
    url.search = '';
    history.pushState({}, '', url);
    this.loadEntryList();
  }

  onPopState() {
    const slug = EndfieldCombatManager.getSlug();
    const category = EndfieldCombatManager.getCategory();
    if (slug) {
      localStorage.setItem('endfieldLastSlug', slug);
      this.loadEntry(slug);
    } else if (category) {
      this.loadEntryList(category);
    } else {
      this.loadEntryList();
    }
  }

  async loadAllKeywords() {
    if (ALL_KEYWORDS_CACHE) return ALL_KEYWORDS_CACHE;
    const { data: keywords, error } = await supabase
      .from('endfield_keyword')
      .select(`
        id,
        keyword,
        slug,
        endfield_keyword_style(color),
        endfield_tooltip(description)
      `)
      .order('keyword', { ascending: true });
    if (error) {
      console.error('Error loading keywords:', error);
      return [];
    }
    ALL_KEYWORDS_CACHE = keywords || [];
    return ALL_KEYWORDS_CACHE;
  }

  async loadAllEntries() {
    if (ALL_ENTRIES_CACHE) return ALL_ENTRIES_CACHE;
    const { data: entries, error } = await supabase
      .from('endfield_combat_system')
      .select('id, slug, title')
      .order('title');
    if (error) {
      console.error('Error loading entries:', error);
      return [];
    }
    ALL_ENTRIES_CACHE = entries || [];
    return ALL_ENTRIES_CACHE;
  }

  async loadAllKeywordLinks() {
    if (Object.keys(KEYWORD_LINK_MAP_CACHE).length > 0) return KEYWORD_LINK_MAP_CACHE;
    const { data: keywordLinks, error } = await supabase
      .from('endfield_keyword_link')
      .select(`
        keyword_id,
        target_entry_id,
        endfield_keyword!inner(keyword),
        endfield_combat_system!inner(slug)
      `);
    if (error) {
      console.error('Error loading keyword links:', error);
      return {};
    }
    const linkMap = {};
    if (keywordLinks) {
      keywordLinks.forEach(link => {
        if (link.endfield_keyword && link.endfield_combat_system) {
          linkMap[link.endfield_keyword.keyword] = link.endfield_combat_system.slug;
        }
      });
    }
    KEYWORD_LINK_MAP_CACHE = linkMap;
    return KEYWORD_LINK_MAP_CACHE;
  }

  async preloadAllData() {
    try {
      await Promise.all([
        this.loadAllKeywords(),
        this.loadAllEntries(),
        this.loadAllKeywordLinks()
      ]);
    } catch (err) {
      console.error('Error preloading Endfield combat data:', err);
    }
  }

  async loadEntry(slug) {
    if (!this.app) return;
    if (!slug) {
      this.loadEntryList();
      return;
    }
    this.app.innerHTML = '<div class="loading-spinner">Đang tải...</div>';

    const { data: entry, error } = await supabase
      .from('endfield_combat_system')
      .select(`
        *,
        category:category_id(name)
      `)
      .eq('slug', slug)
      .maybeSingle();

    if (error || !entry) {
      this.app.innerHTML = '<p class="combat-wiki-error">Không tìm thấy mục.</p>';
      return;
    }

    const keywords = await this.loadAllKeywords();
    const allEntries = await this.loadAllEntries();
    const keywordLinkMap = await this.loadAllKeywordLinks();
    this.render(entry, keywords, allEntries, keywordLinkMap);
  }

  async loadEntryList(categoryFilter = null) {
    if (!this.app) return;
    this.app.innerHTML = '<div class="loading-spinner">Đang tải danh sách...</div>';

    const { data: entries, error } = await supabase
      .from('endfield_combat_system')
      .select(`
        slug,
        title,
        category:category_id(name)
      `)
      .order('title');

    if (error || !entries) {
      this.app.innerHTML = '<p class="combat-wiki-error">Không thể tải danh sách.</p>';
      return;
    }
    this.renderEntryList(entries, categoryFilter);
  }

  escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  parseTextWithKeywords(rawText, keywords, allEntries, keywordLinkMap, currentSlug) {
    const allKeywords = [];
    for (const k of keywords) {
      if (!k.keyword || k.keyword.trim() === '') continue;
      const linkedSlug = keywordLinkMap[k.keyword];
      const self = this;
      allKeywords.push({
        term: k.keyword,
        priority: 1,
        length: k.keyword.length,
        render(match) {
          const color = k.endfield_keyword_style?.color || '#ffffff';
          const tooltip = k.endfield_tooltip?.description
            ? `<span class="combat-tooltip">${self.escapeHtml(k.endfield_tooltip.description)}</span>`
            : '';
          const safeSlug = linkedSlug ? self.escapeHtml(linkedSlug).replace(/'/g, '&#39;') : '';
          if (linkedSlug) {
            return `<span class="combat-keyword combat-keyword-linked" style="color:${color}" data-navigate-slug="${safeSlug}">${self.escapeHtml(match)}${tooltip}</span>`;
          }
          if (k.endfield_tooltip?.description) {
            return `<span class="combat-keyword" style="color:${color}">${self.escapeHtml(match)}${tooltip}</span>`;
          }
          return `<span class="combat-keyword combat-keyword-no-tooltip" style="color:${color}">${self.escapeHtml(match)}</span>`;
        }
      });
    }
    for (const e of allEntries) {
      if (e.slug === currentSlug) continue;
      const self = this;
      const safeSlug = this.escapeHtml(e.slug).replace(/'/g, '&#39;');
      allKeywords.push({
        term: e.title,
        priority: 2,
        length: e.title.length,
        render(match) {
          return `<span class="combat-auto-link" data-navigate-slug="${safeSlug}">${self.escapeHtml(match)}</span>`;
        }
      });
    }
    allKeywords.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.length - a.length;
    });

    const tokens = [];
    let remaining = rawText || '';
    while (remaining.length > 0) {
      let matched = false;
      for (const kw of allKeywords) {
        const regex = new RegExp(`^(${this.escapeRegex(kw.term)})(?![a-zA-Z0-9_])`, 'i');
        const match = remaining.match(regex);
        if (match) {
          tokens.push({ type: 'keyword', html: kw.render(match[1]) });
          remaining = remaining.slice(match[1].length);
          matched = true;
          break;
        }
      }
      if (!matched) {
        const char = remaining[0];
        if (tokens.length > 0 && tokens[tokens.length - 1].type === 'text') {
          tokens[tokens.length - 1].text += char;
        } else {
          tokens.push({ type: 'text', text: char });
        }
        remaining = remaining.slice(1);
      }
    }
    return tokens.map(t => t.type === 'keyword' ? t.html : this.escapeHtml(t.text)).join('');
  }

  render(entry, keywords, allEntries, keywordLinkMap) {
    const processedHtml = this.parseTextWithKeywords(
      entry.description || '',
      keywords,
      allEntries,
      keywordLinkMap,
      entry.slug
    );
    const catName = this.escapeHtml(entry.category?.name || '');
    const safeCatName = (entry.category?.name || '').replace(/'/g, '&#39;');
    this.app.innerHTML = `
      <nav class="combat-breadcrumb">
        <span class="combat-nav-link" data-nav-home>Trang chủ</span>
        › <span class="combat-nav-link" data-nav-category="${this.escapeHtml(safeCatName)}">${catName}</span>
        › <b>${this.escapeHtml(entry.title)}</b>
      </nav>
      <h2 class="combat-entry-title">${this.escapeHtml(entry.title)}</h2>
      <div class="combat-entry-content">${processedHtml}</div>
      <div class="combat-entry-meta">
        <small>Cập nhật: ${new Date(entry.updated_at || entry.created_at).toLocaleDateString('vi-VN')}</small>
      </div>
    `;
    this.bindAppLinks();
  }

  renderEntryList(entries, categoryFilter) {
    const byCategory = {};
    for (const entry of entries) {
      const name = entry.category?.name || 'Uncategorized';
      if (!byCategory[name]) byCategory[name] = [];
      byCategory[name].push(entry);
    }

    let html = '';
    if (categoryFilter) {
      const safeCat = this.escapeHtml(categoryFilter);
      html += `
        <nav class="combat-breadcrumb">
          <span class="combat-nav-link" data-nav-home>Trang chủ</span>
          › <b>${safeCat}</b>
        </nav>
        <h2 class="combat-entry-title">${safeCat}</h2>
      `;
    } else {
      html += '<h2 class="combat-entry-title">Endfield Combat Wiki</h2>';
      const kCount = ALL_KEYWORDS_CACHE ? ALL_KEYWORDS_CACHE.length : 0;
      const eCount = ALL_ENTRIES_CACHE ? ALL_ENTRIES_CACHE.length : 0;
      const lCount = Object.keys(KEYWORD_LINK_MAP_CACHE).length;
      html += `<div class="combat-global-stats"><small>📊 ${kCount} từ khóa, ${eCount} mục, ${lCount} liên kết</small></div>`;
    }
    for (const [catName, items] of Object.entries(byCategory)) {
      const safeCat = this.escapeHtml(catName).replace(/'/g, '&#39;');
      html += `
        <h3 class="combat-category-title combat-nav-link" data-nav-category="${this.escapeHtml(safeCat)}">
          ${this.escapeHtml(catName)} <span class="combat-count">(${items.length})</span>
        </h3>
        <ul class="combat-entry-list">
          ${items.map(item => `
            <li>
              <span class="combat-entry-link" data-navigate-slug="${this.escapeHtml(item.slug).replace(/'/g, '&#39;')}">${this.escapeHtml(item.title)}</span>
            </li>
          `).join('')}
        </ul>
      `;
    }
    this.app.innerHTML = html;
    this.bindAppLinks();
  }

  bindAppLinks() {
    if (!this.app) return;
    this.app.querySelectorAll('[data-navigate-slug]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const slug = el.getAttribute('data-navigate-slug');
        if (slug) this.navigateTo(slug);
      });
    });
    this.app.querySelectorAll('[data-nav-home]').forEach(el => {
      el.addEventListener('click', () => this.navigateToHome());
    });
    this.app.querySelectorAll('[data-nav-category]').forEach(el => {
      el.addEventListener('click', () => {
        const category = el.getAttribute('data-nav-category');
        if (category != null) this.navigateToCategory(category);
      });
    });
  }

  destroy() {
    window.removeEventListener('popstate', this.handlePopState);
    delete window.endfieldCombatNavigateTo;
    delete window.endfieldCombatNavigateToCategory;
    delete window.endfieldCombatNavigateToHome;
    this.app = null;
  }
}
