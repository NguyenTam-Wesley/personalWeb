import { supabase } from "./supabase.js";

class StudyApp {
  constructor() {
    this.currentDocuments = [];
    // DOM elements
    this.subjectsContainer = document.getElementById('subjects');
    this.documentsContainer = document.getElementById('documents');
    this.searchInput = document.getElementById('searchInput');
    this.typeFilter = document.getElementById('typeFilter');
    this.sortSelect = document.getElementById('sortSelect');
    this.controlsDiv = document.getElementById('controls');

    // Ẩn controls lúc đầu
    this.controlsDiv.hidden = true;
    this.documentsContainer.hidden = true;

    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.populateTypeFilter();
    await this.fetchSubjects();
  }

  async fetchSubjects() {
    const { data, error } = await supabase
      .from('subjects')
      .select('id, name');
    if (error) {
      console.error('Lỗi khi lấy danh sách môn học:', error.message);
      return;
    }
    this.renderSubjects(data);
  }

  renderSubjects(subjects) {
    this.subjectsContainer.innerHTML = '';
    subjects.forEach(subject => {
      const btn = document.createElement('button');
      btn.textContent = subject.name;
      btn.addEventListener('click', () => {
        this.onSubjectClick(subject.id);
      });
      this.subjectsContainer.appendChild(btn);
    });
  }

  async onSubjectClick(subjectId) {
    this.controlsDiv.hidden = false;
    this.documentsContainer.hidden = false;
    this.searchInput.value = '';
    this.typeFilter.value = '';
    this.sortSelect.value = 'az';
    await this.fetchDocuments(subjectId);
  }

  async fetchDocuments(subjectId) {
    const { data, error } = await supabase
      .from('documents')
      .select('*, document_types(name)')
      .eq('subject_id', subjectId);

    if (error) {
      console.error('Lỗi khi lấy tài liệu:', error.message);
      return;
    }
    this.currentDocuments = data || [];
    this.renderDocuments(this.currentDocuments);
  }

  async populateTypeFilter() {
    const { data, error } = await supabase
      .from('document_types')
      .select('name');
    if (error) {
      console.error('Lỗi khi lấy loại tài liệu:', error.message);
      return;
    }
    this.typeFilter.innerHTML = '<option value="">-- Lọc theo loại --</option>';
    data.forEach(type => {
      const option = document.createElement('option');
      option.value = type.name;
      option.textContent = type.name.charAt(0).toUpperCase() + type.name.slice(1);
      this.typeFilter.appendChild(option);
    });
  }

  renderDocuments(documents) {
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
        ? a.title.localeCompare(b.title)
        : b.title.localeCompare(a.title);
    });

    this.documentsContainer.innerHTML = '';

    if(filtered.length === 0) {
      this.documentsContainer.innerHTML = '<p style="color:#0ff; text-align:center;">Không tìm thấy tài liệu phù hợp.</p>';
      return;
    }

    filtered.forEach(doc => {
      const typeName = doc.document_types?.name || 'Unknown';
      const div = document.createElement('div');
      div.classList.add('document-item');
      div.innerHTML = `
        <div class="document-title">${doc.title}</div>
        <a href="${doc.url}" target="_blank">${typeName.toUpperCase()} ➜</a>
      `;
      this.documentsContainer.appendChild(div);
    });
  }

  setupEventListeners() {
    this.searchInput.addEventListener('input', () => {
      this.renderDocuments(this.currentDocuments);
    });
    this.typeFilter.addEventListener('change', () => {
      this.renderDocuments(this.currentDocuments);
    });
    this.sortSelect.addEventListener('change', () => {
      this.renderDocuments(this.currentDocuments);
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new StudyApp();
});
