import { supabase } from '../supabase/supabase.js';

/**
 * ClassManager class for handling Arknights class page functionality
 */
export class ClassManager {
    constructor() {
        this.classesGrid = null;
        this.classModal = null;
        this.closeModalBtn = null;
        this.classes = [];
        this.currentClass = null;
    }

    /**
     * Initialize the class page functionality
     */
    async init() {
        this.cacheElements();
        this.bindEvents();

        // Check for class ID parameter
        const urlParams = new URLSearchParams(window.location.search);
        const classId = urlParams.get('id');

        if (classId) {
            await this.loadClassById(classId);
        } else {
            await this.loadClasses();
        }

        console.log('ClassManager initialized');
    }

    /**
     * Cache DOM elements for performance
     */
    cacheElements() {
        this.classesGrid = document.getElementById('classesGrid');
        this.classModal = document.getElementById('classModal');
        this.closeModalBtn = document.getElementById('closeClassModal');
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Close modal events
        if (this.closeModalBtn) {
            this.closeModalBtn.addEventListener('click', () => this.closeModal());
        }

        if (this.classModal) {
            this.classModal.addEventListener('click', (e) => {
                if (e.target === this.classModal) {
                    this.closeModal();
                }
            });
        }

        // ESC key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.classModal.classList.contains('active')) {
                this.closeModal();
            }
        });
    }

    /**
     * Load classes data from Supabase
     */
    async loadClasses() {
        try {
            const { data, error } = await supabase
                .from('classes')
                .select(`
                    id,
                    name,
                    description,
                    icon_url,
                    archetypes(id, name)
                `)
                .order('name');

            if (error) {
                console.error('Error loading classes:', error);
                this.showError('Không thể tải danh sách lớp');
                return;
            }

            this.classes = data || [];
            this.renderClasses();

        } catch (error) {
            console.error('Error loading classes:', error);
            this.showError('Lỗi kết nối');
        }
    }

    /**
     * Load specific class by ID and show modal
     */
    async loadClassById(classId) {
        try {
            const { data, error } = await supabase
                .from('classes')
                .select(`
                    id,
                    name,
                    description,
                    icon_url,
                    archetypes(id, name)
                `)
                .eq('id', classId)
                .single();

            if (error) {
                console.error('Error loading class:', error);
                // Fallback to loading all classes
                await this.loadClasses();
                return;
            }

            this.currentClass = data;
            this.renderClassModal();
            this.classModal.classList.add('active');

        } catch (error) {
            console.error('Error loading class by ID:', error);
            // Fallback to loading all classes
            await this.loadClasses();
        }
    }

    /**
     * Render classes grid
     */
    renderClasses() {
        if (!this.classesGrid) return;

        const classesHTML = this.classes.map((classData, index) => {
            const iconEmoji = this.getClassIcon(classData.name);
            const archetypeCount = classData.archetypes?.length || 0;

            return `
                <div class="class-card" data-class-id="${classData.id}" style="animation-delay: ${index * 0.1}s">
                    <div class="class-icon">${iconEmoji}</div>
                    <h3>${classData.name}</h3>
                    <p>${classData.description || 'Chưa có mô tả'}</p>
                    <div class="class-stats">
                        <span class="archetype-count">${archetypeCount} Archetypes</span>
                    </div>
                    <button class="cta-button view-class-btn" data-class-id="${classData.id}">
                        Xem Chi Tiết
                    </button>
                </div>
            `;
        }).join('');

        this.classesGrid.innerHTML = classesHTML;

        // Bind click events for class cards
        this.classesGrid.querySelectorAll('.class-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.classList.contains('view-class-btn')) {
                    const classId = card.dataset.classId;
                    this.showClassModal(classId);
                }
            });
        });

        // Bind click events for view buttons
        this.classesGrid.querySelectorAll('.view-class-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const classId = btn.dataset.classId;
                this.showClassModal(classId);
            });
        });
    }

    /**
     * Show class detail modal
     * @param {string} classId - The class ID to show
     */
    async showClassModal(classId) {
        try {
            const { data, error } = await supabase
                .from('classes')
                .select(`
                    id,
                    name,
                    description,
                    icon_url,
                    archetypes(
                        id,
                        name,
                        description
                    )
                `)
                .eq('id', classId)
                .single();

            if (error) {
                console.error('Error loading class details:', error);
                return;
            }

            this.currentClass = data;
            this.renderClassModal();
            this.classModal.classList.add('active');

        } catch (error) {
            console.error('Error loading class details:', error);
        }
    }

    /**
     * Render class modal content
     */
    renderClassModal() {
        if (!this.currentClass) return;

        const iconEmoji = this.getClassIcon(this.currentClass.name);

        // Update modal header
        document.getElementById('modalClassTitle').textContent = this.currentClass.name;
        document.getElementById('modalClassIcon').innerHTML = iconEmoji;
        document.getElementById('modalClassName').textContent = this.currentClass.name;
        document.getElementById('modalClassDescription').textContent =
            this.currentClass.description || 'Chưa có mô tả chi tiết';

        // Render archetypes
        const archetypesGrid = document.getElementById('modalArchetypesGrid');
        if (this.currentClass.archetypes && this.currentClass.archetypes.length > 0) {
            const archetypesHTML = this.currentClass.archetypes.map(archetype => `
                <div class="archetype-card" data-archetype-id="${archetype.id}">
                    <h4>${archetype.name}</h4>
                    <p>${archetype.description || 'Chưa có mô tả'}</p>
                    <button class="archetype-link-btn" data-archetype-id="${archetype.id}">
                        Xem Chi Tiết
                    </button>
                </div>
            `).join('');

            archetypesGrid.innerHTML = archetypesHTML;

            // Bind archetype click events
            archetypesGrid.querySelectorAll('.archetype-link-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const archetypeId = btn.dataset.archetypeId;
                    this.navigateToArchetype(archetypeId);
                });
            });
        } else {
            archetypesGrid.innerHTML = '<p class="no-archetypes">Chưa có archetypes cho lớp này</p>';
        }
    }

    /**
     * Navigate to archetype detail page
     * @param {string} archetypeId - The archetype ID to navigate to
     */
    navigateToArchetype(archetypeId) {
        window.location.href = `archetype.html?id=${archetypeId}`;
    }

    /**
     * Close modal
     */
    closeModal() {
        if (this.classModal) {
            this.classModal.classList.remove('active');
            this.currentClass = null;
        }
    }

    /**
     * Get emoji icon for class
     * @param {string} className - The class name
     * @returns {string} Emoji icon
     */
    getClassIcon(className) {
        const iconMap = {
            'Guard': '⚔️',
            'Sniper': '🏹',
            'Caster': '🔮',
            'Defender': '🛡️',
            'Medic': '💊',
            'Specialist': '🔧',
            'Vanguard': '🚀',
            'Supporter': '🔥'
        };
        return iconMap[className] || '❓';
    }

    /**
     * Show error message
     * @param {string} message - Error message to display
     */
    showError(message) {
        if (this.classesGrid) {
            this.classesGrid.innerHTML = `
                <div class="error-message">
                    <p>${message}</p>
                    <button onclick="location.reload()">Thử lại</button>
                </div>
            `;
        }
    }

    /**
     * Destroy the manager and clean up event listeners
     */
    destroy() {
        if (this.closeModalBtn) {
            this.closeModalBtn.removeEventListener('click', this.closeModal);
        }

        if (this.classModal) {
            this.classModal.removeEventListener('click', this.closeModal);
        }

        document.removeEventListener('keydown', this.closeModal);
        console.log('ClassManager destroyed');
    }
}