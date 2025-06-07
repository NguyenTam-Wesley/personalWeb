import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://calwzopyjitbtahiafzw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhbHd6b3B5aml0YnRhaGlhZnp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxNjgyOTAsImV4cCI6MjA2NDc0NDI5MH0.lFDePS6m0MpNXDcC43dJaqa1pHtCKHNRKoiDbnxTBBc';
const supabase = createClient(supabaseUrl, SUPABASE_ANON_KEY);

let currentDocuments = [];

// DOM elements
const subjectsContainer = document.getElementById('subjects');
const documentsContainer = document.getElementById('documents');
const searchInput = document.getElementById('searchInput');
const typeFilter = document.getElementById('typeFilter');
const sortSelect = document.getElementById('sortSelect');
const controlsDiv = document.getElementById('controls');

// Ẩn controls lúc đầu
controlsDiv.hidden = true;
documentsContainer.hidden = true;

// 1. Lấy danh sách môn học
async function fetchSubjects() {
  const { data, error } = await supabase
    .from('subjects')
    .select('id, name');

  if (error) {
    console.error('Lỗi khi lấy danh sách môn học:', error.message);
    return;
  }

  renderSubjects(data);
}

// 2. Hiển thị môn học
function renderSubjects(subjects) {
  subjectsContainer.innerHTML = '';
  subjects.forEach(subject => {
    const btn = document.createElement('button');
    btn.textContent = subject.name;
    btn.addEventListener('click', () => {
      onSubjectClick(subject.id);
    });
    subjectsContainer.appendChild(btn);
  });

  // KHÔNG tự động load môn đầu tiên nữa
}

// Xử lý khi bấm vào môn học
async function onSubjectClick(subjectId) {
  // Hiện controls và documents
  controlsDiv.hidden = false;
  documentsContainer.hidden = false;

  // Reset các filter khi chọn môn mới
  searchInput.value = '';
  typeFilter.value = '';
  sortSelect.value = 'az';

  // Lấy tài liệu theo môn học
  await fetchDocuments(subjectId);
}

// 3. Lấy tài liệu theo môn
async function fetchDocuments(subjectId) {
  const { data, error } = await supabase
    .from('documents')
    .select('*, document_types(name)')
    .eq('subject_id', subjectId);

  if (error) {
    console.error('Lỗi khi lấy tài liệu:', error.message);
    return;
  }

  currentDocuments = data || [];
  renderDocuments(currentDocuments);
}

// 4. Lấy danh sách loại tài liệu và đổ vào dropdown
async function populateTypeFilter() {
  const { data, error } = await supabase
    .from('document_types')
    .select('name');

  if (error) {
    console.error('Lỗi khi lấy loại tài liệu:', error.message);
    return;
  }

  typeFilter.innerHTML = '<option value="">-- Lọc theo loại --</option>';
  data.forEach(type => {
    const option = document.createElement('option');
    option.value = type.name;
    option.textContent = type.name.charAt(0).toUpperCase() + type.name.slice(1);
    typeFilter.appendChild(option);
  });
}

// 5. Hiển thị tài liệu (lọc, tìm kiếm, sắp xếp)
function renderDocuments(documents) {
  const searchText = searchInput.value.toLowerCase();
  const selectedType = typeFilter.value;
  const sortOrder = sortSelect.value;

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

  documentsContainer.innerHTML = '';

  if(filtered.length === 0) {
    documentsContainer.innerHTML = '<p style="color:#0ff; text-align:center;">Không tìm thấy tài liệu phù hợp.</p>';
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
    documentsContainer.appendChild(div);
  });
}

// 6. Event listeners
searchInput.addEventListener('input', () => {
  renderDocuments(currentDocuments);
});

typeFilter.addEventListener('change', () => {
  renderDocuments(currentDocuments);
});

sortSelect.addEventListener('change', () => {
  renderDocuments(currentDocuments);
});

// 7. Bắt đầu load danh sách môn học và danh sách loại tài liệu (cho filter)
populateTypeFilter();
fetchSubjects();
