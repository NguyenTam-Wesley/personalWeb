import components from '../components/components.js';
import { ArknightsOperatorAdminManager } from './arknights-op-admin.js';
import { QuillEditor } from '../components/quillEditor.js';

// Initialize components
components.init();

// Initialize pet for arknights operator admin (minimal presence)
components.initPet({
  container: document.body,
  size: 'small',
  theme: 'default',
  position: { x: window.innerWidth - 120, y: window.innerHeight - 120 },
  autoStart: true,
  showControls: false,
  showDebug: false,
  boundaryMode: 'wrap',
  persistence: true
});

// Initialize page specific functionality
new ArknightsOperatorAdminManager();

// Initialize Quill Editor for operator description
const descriptionEditor = new QuillEditor({
  container: '#operatorDescriptionEditor',
  hiddenInput: '#operatorDescription',
  height: 120,
  placeholder: 'Mô tả về operator này...',
  toolbar: [
    [{ 'header': [1, 2, false] }],
    ['bold', 'italic', 'underline'],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    ['link'],
    ['clean']
  ]
});

// Make editor available globally for the admin manager
window.descriptionEditor = descriptionEditor;