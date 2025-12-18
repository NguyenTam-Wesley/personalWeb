import { supabase } from "../supabase/supabase.js";
import { getCurrentUser } from "../supabase/auth.js";
import components from '../components/components.js';

export class StudyManager {
  constructor() {
    // DOM elements
    this.subjectsContainer = document.getElementById('subjects');
    this.documentsContainer = document.getElementById('documents');
    this.searchInput = document.getElementById('searchInput');
    this.typeFilter = document.getElementById('typeFilter');
    this.sortSelect = document.getElementById('sortSelect');
    this.controlsDiv = document.getElementById('controls');

    // State
    this.currentDocuments = [];
    this.currentSubjectId = null;

    // Bind methods
    this.onSubjectClick = this.onSubjectClick.bind(this);
    this.renderDocuments = this.renderDocuments.bind(this);
    this.handleSearch = this.handleSearch.bind(this);
    this.debouncedSearch = this.debounce(this.handleSearch, 300);

    // Initialize
    this.init();
  }

  // Utility methods
  debounce(func, wait) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  handleSearch() {
    if (Array.isArray(this.currentDocuments)) {
      this.renderDocuments(this.currentDocuments);
    }
  }

  showLoading() {
    this.documentsContainer.innerHTML = '<div class="loading">🔄 Đang tải...</div>';
  }

  showError(message) {
    this.documentsContainer.innerHTML = `
      <div class="error-message">
        <p>❌ ${message}</p>
        <button onclick="studyManager.retry()">🔄 Thử lại</button>
      </div>
    `;
  }

  // Initialization
  init() {
    // Hide controls initially
    this.controlsDiv.hidden = true;
    this.documentsContainer.hidden = true;

    // Set up event listeners
    this.setupEventListeners();

    // Start loading data
    this.populateTypeFilter();
    this.fetchSubjects();
  }

  setupEventListeners() {
    this.searchInput.addEventListener('input', this.debouncedSearch);
    this.typeFilter.addEventListener('change', () => {
      if (Array.isArray(this.currentDocuments)) {
        this.renderDocuments(this.currentDocuments);
      }
    });
    this.sortSelect.addEventListener('change', () => {
      if (Array.isArray(this.currentDocuments)) {
        this.renderDocuments(this.currentDocuments);
      }
    });
  }

  // Data fetching methods
  async fetchSubjects() {
    try {
      this.showLoading();
      const { data, error } = await supabase
        .from('subjects')
        .select('id, name');

      if (error) throw error;
      this.renderSubjects(data);
    } catch (error) {
      this.showError('Không thể tải danh sách môn học. Vui lòng thử lại sau.');
      console.error('Lỗi khi lấy danh sách môn học:', error.message);
    }
  }

  async fetchDocuments(subjectId) {
    try {
      this.showLoading();
      const { data, error } = await supabase
        .from('documents')
        .select('*, document_types(name)')
        .eq('subject_id', subjectId);

      if (error) throw error;

      this.currentDocuments = data || [];
      this.currentSubjectId = subjectId;
      this.renderDocuments(this.currentDocuments);
    } catch (error) {
      this.showError('Không thể tải tài liệu. Vui lòng thử lại sau.');
      console.error('Lỗi khi lấy tài liệu:', error.message);
    }
  }

  async populateTypeFilter() {
    try {
      const { data, error } = await supabase
        .from('document_types')
        .select('name');

      if (error) throw error;

      this.typeFilter.innerHTML = '<option value="">-- Lọc theo loại --</option>';
      data.forEach(type => {
        const option = document.createElement('option');
        option.value = type.name;
        option.textContent = type.name.charAt(0).toUpperCase() + type.name.slice(1);
        this.typeFilter.appendChild(option);
      });
    } catch (error) {
      console.error('Lỗi khi lấy loại tài liệu:', error.message);
      this.typeFilter.innerHTML = '<option value="">-- Lỗi khi tải loại tài liệu --</option>';
    }
  }

  // Render methods
  renderSubjects(subjects) {
    this.subjectsContainer.innerHTML = '';
    subjects.forEach(subject => {
      const btn = document.createElement('button');
      btn.textContent = subject.name;
      btn.addEventListener('click', () => this.onSubjectClick(subject.id));
      this.subjectsContainer.appendChild(btn);
    });
  }

  renderDocuments(documents) {
    if (!Array.isArray(documents)) {
      console.error('Documents is not an array:', documents);
      return;
    }

    const searchText = this.searchInput.value.toLowerCase();
    const selectedType = this.typeFilter.value;
    const sortOrder = this.sortSelect.value;

    let filtered = documents.filter(doc => {
      const typeName = doc.document_types?.name || '';
      return (
        doc.title.toLowerCase().includes(searchText) &&
        (selectedType === '' || typeName === selectedType)
      );
    });

    filtered.sort((a, b) => {
      return sortOrder === 'az'
        ? a.title.localeCompare(b.title, undefined, {numeric: true})
        : b.title.localeCompare(a.title, undefined, {numeric: true});
    });

    this.documentsContainer.innerHTML = '';

    if(filtered.length === 0) {
      this.documentsContainer.innerHTML = '<p style="color:#0ff; text-align:center;">Không tìm thấy tài liệu phù hợp.</p>';
      return;
    }

    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();
    
    filtered.forEach(doc => {
      const typeName = doc.document_types?.name || 'Unknown';
      const div = document.createElement('div');
      div.classList.add('document-item');
      div.innerHTML = `
        <div class="document-title">${doc.title}</div>
        <a href="${doc.url}" target="_blank">${typeName.toUpperCase()} ➜</a>
      `;
      fragment.appendChild(div);
    });

    this.documentsContainer.appendChild(fragment);
  }

  // Event handlers
  async onSubjectClick(subjectId) {
    // Show controls and documents
    this.controlsDiv.hidden = false;
    this.documentsContainer.hidden = false;

    // Reset filters when selecting new subject
    this.searchInput.value = '';
    this.typeFilter.value = '';
    this.sortSelect.value = 'az';

    // Fetch documents for the selected subject
    await this.fetchDocuments(subjectId);
  }

  // Public methods
  retry() {
    if (this.currentSubjectId) {
      this.fetchDocuments(this.currentSubjectId);
    } else {
      this.fetchSubjects();
    }
  }
}

// Initialize the study manager
components.init();
new StudyManager();
