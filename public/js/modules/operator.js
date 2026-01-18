import { supabase } from '../supabase/supabase.js';

/**
 * OperatorManager class for handling Arknights operator page functionality
 */
export class OperatorManager {
    constructor() {
        this.operatorsGrid = null;
        this.operatorModal = null;
        this.closeModalBtn = null;
        this.filters = {
            keyword: '',
            classIds: [],
            archetypeIds: [],
            rarityIds: []
        };
        this.filterMetadata = {
            classes: [],
            archetypes: [],
            rarities: []
        };
        this.operators = [];
        this.currentOperator = null;
        this.debounceTimer = null;
    }

    /**
     * Initialize the operator page functionality
     */
    async init() {
        this.cacheElements();
        this.bindEvents();
        await this.loadFilterMetadata();
        await this.loadOperators();
        console.log('OperatorManager initialized');
    }

    /**
     * Cache DOM elements for performance
     */
    cacheElements() {
        this.operatorsGrid = document.getElementById('operatorsGrid');
        this.operatorModal = document.getElementById('operatorModal');
        this.closeModalBtn = document.getElementById('closeOperatorModal');
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Close modal events
        if (this.closeModalBtn) {
            this.closeModalBtn.addEventListener('click', () => this.closeModal());
        }

        if (this.operatorModal) {
            this.operatorModal.addEventListener('click', (e) => {
                if (e.target === this.operatorModal) {
                    this.closeModal();
                }
            });
        }

        // ESC key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.operatorModal.classList.contains('active')) {
                this.closeModal();
            }
        });

        // Filter events
        const keywordFilter = document.getElementById('keywordFilter');
        if (keywordFilter) {
            keywordFilter.addEventListener('input', (e) => {
                this.filters.keyword = e.target.value;
                this.debouncedFilter();
            });
        }

        const clearFiltersBtn = document.getElementById('clearFilters');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => this.clearFilters());
        }
    }

    /**
     * Debounced filter function
     */
    debouncedFilter() {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.loadOperators();
        }, 300);
    }

    /**
     * Load filter metadata from Supabase
     */
    async loadFilterMetadata() {
        try {
            // Load classes
            const { data: classesData, error: classesError } = await supabase
                .from('classes')
                .select('id, name')
                .order('name');

            if (classesError) {
                console.error('Error loading classes:', classesError);
            } else {
                this.filterMetadata.classes = classesData || [];
                this.renderClassFilters();
            }

            // Archetypes will be loaded dynamically when classes are selected
            // So we don't load them initially here

            // Load rarities - temporary hardcoded until table is set up
            this.filterMetadata.rarities = [
                { id: 1, label: '1' },
                { id: 2, label: '2' },
                { id: 3, label: '3' },
                { id: 4, label: '4' },
                { id: 5, label: '5' },
                { id: 6, label: '6' }
            ];
            this.renderRarityFilters();

        } catch (error) {
            console.error('Error loading filter metadata:', error);
        }
    }

    /**
     * Load archetypes filtered by selected classes
     */
    async loadArchetypesByClasses(classIds) {
        try {
            if (classIds.length === 0) {
                this.filterMetadata.archetypes = [];
                this.renderArchetypeFilters();
                return;
            }

            const { data: archetypesData, error: archetypesError } = await supabase
                .from('archetypes')
                .select('id, name, class_id')
                .in('class_id', classIds)
                .order('name');

            if (archetypesError) {
                console.error('Error loading archetypes by classes:', archetypesError);
                this.filterMetadata.archetypes = [];
            } else {
                this.filterMetadata.archetypes = archetypesData || [];
            }

            this.renderArchetypeFilters();

        } catch (error) {
            console.error('Error loading archetypes by classes:', error);
            this.filterMetadata.archetypes = [];
            this.renderArchetypeFilters();
        }
    }

    /**
     * Render class filter options
     */
    renderClassFilters() {
        const classFilters = document.getElementById('classFilters');
        if (!classFilters) return;

        const classHTML = this.filterMetadata.classes.map(classData => `
            <label class="filter-option">
                <input type="checkbox" value="${classData.id}" class="class-filter-checkbox">
                <span class="filter-label">${classData.name}</span>
            </label>
        `).join('');

        classFilters.innerHTML = classHTML;

        // Bind class filter events
        classFilters.querySelectorAll('.class-filter-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.updateClassFilter(e.target.value, e.target.checked);
            });
        });
    }

    /**
     * Render archetype filter options
     */
    renderArchetypeFilters() {
        const archetypeFilters = document.getElementById('archetypeFilters');
        if (!archetypeFilters) return;

        const archetypeHTML = this.filterMetadata.archetypes.map(archetype => `
            <label class="filter-option">
                <input type="checkbox" value="${archetype.id}" class="archetype-filter-checkbox">
                <span class="filter-label">${archetype.name}</span>
            </label>
        `).join('');

        archetypeFilters.innerHTML = archetypeHTML;

        // Bind archetype filter events
        archetypeFilters.querySelectorAll('.archetype-filter-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.updateArchetypeFilter(e.target.value, e.target.checked);
            });
        });
    }

    /**
     * Render rarity filter options
     */
    renderRarityFilters() {
        const rarityFilters = document.getElementById('rarityFilters');
        if (!rarityFilters) return;

        const rarityHTML = this.filterMetadata.rarities.map(rarity => `
            <label class="filter-option">
                <input type="checkbox" value="${rarity.id}" class="rarity-filter-checkbox">
                <span class="filter-label">${rarity.label}</span>
            </label>
        `).join('');

        rarityFilters.innerHTML = rarityHTML;

        // Bind rarity filter events
        rarityFilters.querySelectorAll('.rarity-filter-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.updateRarityFilter(e.target.value, e.target.checked);
            });
        });
    }

    /**
     * Update class filter
     */
    async updateClassFilter(classId, checked) {
        if (checked) {
            this.filters.classIds.push(classId);
        } else {
            this.filters.classIds = this.filters.classIds.filter(id => id !== classId);
        }

        // Show/hide archetype filter based on class selection
        if (this.filters.classIds.length > 0) {
            this.showArchetypeFilter();
            await this.loadArchetypesByClasses(this.filters.classIds);
        } else {
            this.hideArchetypeFilter();
        }

        this.loadOperators();
    }

    /**
     * Update archetype filter
     */
    updateArchetypeFilter(archetypeId, checked) {
        if (checked) {
            this.filters.archetypeIds.push(archetypeId);
        } else {
            this.filters.archetypeIds = this.filters.archetypeIds.filter(id => id !== archetypeId);
        }
        this.loadOperators();
    }

    /**
     * Update rarity filter
     */
    updateRarityFilter(rarityId, checked) {
        if (checked) {
            this.filters.rarityIds.push(rarityId);
        } else {
            this.filters.rarityIds = this.filters.rarityIds.filter(id => id !== rarityId);
        }
        this.loadOperators();
    }

    /**
     * Clear all filters
     */
    clearFilters() {
        this.filters = {
            keyword: '',
            classIds: [],
            archetypeIds: [],
            rarityIds: []
        };

        // Clear keyword input
        const keywordFilter = document.getElementById('keywordFilter');
        if (keywordFilter) {
            keywordFilter.value = '';
        }

        // Clear checkboxes
        document.querySelectorAll('.class-filter-checkbox, .archetype-filter-checkbox, .rarity-filter-checkbox')
            .forEach(checkbox => {
                checkbox.checked = false;
            });

        // Hide archetype filter when no classes selected
        this.hideArchetypeFilter();

        this.loadOperators();
    }

    /**
     * Show archetype filter
     */
    showArchetypeFilter() {
        const archetypeFilterGroup = document.querySelector('.filter-group:has(#archetypeFilters)');
        if (archetypeFilterGroup) {
            archetypeFilterGroup.style.display = 'block';
        }
    }

    /**
     * Hide archetype filter
     */
    hideArchetypeFilter() {
        const archetypeFilterGroup = document.querySelector('.filter-group:has(#archetypeFilters)');
        if (archetypeFilterGroup) {
            archetypeFilterGroup.style.display = 'none';
        }

        // Clear archetype selections when hiding
        this.filters.archetypeIds = [];
        document.querySelectorAll('.archetype-filter-checkbox')
            .forEach(checkbox => {
                checkbox.checked = false;
            });
    }

    /**
     * Load operators based on current filters
     */
    async loadOperators() {
        try {
            this.showLoading();

            let query = supabase
                .from('operators')
                .select(`
                    id,
                    name,
                    avatar_url,
                    rarity_id,
                    class:classes(id, name),
                    archetype:archetypes(id, name)
                `)
                .order('rarity_id', { ascending: false });

            // Apply filters
            if (this.filters.keyword) {
                query = query.ilike('name', `%${this.filters.keyword}%`);
            }

            if (this.filters.classIds.length > 0) {
                query = query.in('class_id', this.filters.classIds);
            }

            if (this.filters.archetypeIds.length > 0) {
                query = query.in('archetype_id', this.filters.archetypeIds);
            }

            if (this.filters.rarityIds.length > 0) {
                query = query.in('rarity_id', this.filters.rarityIds);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error loading operators:', error);
                this.showError('Không thể tải danh sách operators');
                return;
            }

            this.operators = data || [];
            this.renderOperators();
            this.updateOperatorsCount();

        } catch (error) {
            console.error('Error loading operators:', error);
            this.showError('Lỗi kết nối');
        }
    }

    /**
     * Show loading state
     */
    showLoading() {
        if (this.operatorsGrid) {
            this.operatorsGrid.innerHTML = '<div class="loading-spinner">Đang tải...</div>';
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        if (this.operatorsGrid) {
            this.operatorsGrid.innerHTML = `
                <div class="error-message">
                    <p>${message}</p>
                    <button onclick="location.reload()">Thử lại</button>
                </div>
            `;
        }
    }

    /**
     * Render operators grid
     */
    renderOperators() {
        if (!this.operatorsGrid) return;

        if (this.operators.length === 0) {
            this.operatorsGrid.innerHTML = '<div class="no-results">Không tìm thấy operator nào phù hợp với bộ lọc.</div>';
            return;
        }

        const operatorsHTML = this.operators.map((operator, index) => {
            const rarityStars = '★'.repeat(operator.rarity_id || 6);
            const avatarUrl = operator.avatar_url || 'https://via.placeholder.com/300x240?text=No+Image';

            return `
                <div class="operator-card" data-operator-id="${operator.id}" style="animation-delay: ${index * 0.05}s">
                    <img src="${avatarUrl}" alt="${operator.name}" class="operator-image" onerror="this.src='https://via.placeholder.com/300x240?text=No+Image'">
                    <div class="operator-info">
                        <h3>${operator.name}</h3>
                        <p>${operator.class?.name || 'Unknown'} - ${operator.archetype?.name || 'Unknown'}</p>
                        <div class="operator-stats">
                            <div class="stat-item">
                                <span class="stat-label">Rarity</span>
                                <span class="stat-value">${rarityStars}</span>
                            </div>
                        </div>
                        <button class="cta-button view-operator-btn" data-operator-id="${operator.id}">
                            Xem Chi Tiết
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        this.operatorsGrid.innerHTML = operatorsHTML;

        // Bind click events for operator cards
        this.operatorsGrid.querySelectorAll('.operator-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.classList.contains('view-operator-btn')) {
                    const operatorId = card.dataset.operatorId;
                    this.showOperatorModal(operatorId);
                }
            });
        });

        // Bind click events for view buttons
        this.operatorsGrid.querySelectorAll('.view-operator-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const operatorId = btn.dataset.operatorId;
                this.showOperatorModal(operatorId);
            });
        });
    }

    /**
     * Update operators count display
     */
    updateOperatorsCount() {
        const countElement = document.getElementById('operatorsCount');
        if (countElement) {
            countElement.textContent = `${this.operators.length} operators`;
        }
    }

    /**
     * Show operator detail modal
     */
    async showOperatorModal(operatorId) {
        try {
            const { data, error } = await supabase
                .from('operators')
                .select(`
                    name,
                    description,
                    avatar_url,
                    rarity_id,
                    class:classes(id, name, description),
                    archetype:archetypes(id, name, description)
                `)
                .eq('id', operatorId)
                .single();

            if (error) {
                console.error('Error loading operator details:', error);
                return;
            }

            this.currentOperator = data;
            this.renderOperatorModal();
            this.operatorModal.classList.add('active');

        } catch (error) {
            console.error('Error loading operator details:', error);
        }
    }

    /**
     * Render operator modal content
     */
    renderOperatorModal() {
        if (!this.currentOperator) return;

        const rarityStars = '★'.repeat(this.currentOperator.rarity_id || 6);
        const avatarUrl = this.currentOperator.avatar_url || 'https://via.placeholder.com/300x240?text=No+Image';

        // Update modal content
        document.getElementById('modalOperatorTitle').textContent = this.currentOperator.name;
        document.getElementById('modalOperatorAvatar').src = avatarUrl;
        document.getElementById('modalOperatorName').textContent = this.currentOperator.name;

        // Make class and archetype clickable links
        const classElement = document.getElementById('modalOperatorClass');
        const archetypeElement = document.getElementById('modalOperatorArchetype');

        if (classElement) {
            classElement.innerHTML = this.currentOperator.class?.name || 'Unknown';
            classElement.style.cursor = 'pointer';
            classElement.style.color = 'var(--accent-primary)';
            classElement.addEventListener('click', () => {
                if (this.currentOperator.class?.id) {
                    window.location.href = `class.html?id=${this.currentOperator.class.id}`;
                }
            });
        }

        if (archetypeElement) {
            archetypeElement.innerHTML = this.currentOperator.archetype?.name || 'Unknown';
            archetypeElement.style.cursor = 'pointer';
            archetypeElement.style.color = 'var(--accent-primary)';
            archetypeElement.addEventListener('click', () => {
                if (this.currentOperator.archetype?.id) {
                    window.location.href = `archetype.html?id=${this.currentOperator.archetype.id}`;
                }
            });
        }

        document.getElementById('modalOperatorRarity').textContent = rarityStars;
        document.getElementById('modalOperatorDescription').textContent =
            this.currentOperator.description || 'Chưa có mô tả chi tiết';

        // Render stats (placeholder for now)
        const statsGrid = document.getElementById('modalOperatorStats');
        statsGrid.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">Lớp</span>
                <span class="stat-value stat-link" data-class-id="${this.currentOperator.class?.id || ''}">${this.currentOperator.class?.name || 'Unknown'}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Archetype</span>
                <span class="stat-value stat-link" data-archetype-id="${this.currentOperator.archetype?.id || ''}">${this.currentOperator.archetype?.name || 'Unknown'}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Độ hiếm</span>
                <span class="stat-value">${rarityStars}</span>
            </div>
        `;

        // Bind click events for stat links
        statsGrid.querySelectorAll('.stat-link').forEach(link => {
            link.style.cursor = 'pointer';
            link.style.color = 'var(--accent-primary)';
            link.addEventListener('click', (e) => {
                const classId = e.target.getAttribute('data-class-id');
                const archetypeId = e.target.getAttribute('data-archetype-id');

                if (classId) {
                    window.location.href = `class.html?id=${classId}`;
                } else if (archetypeId) {
                    window.location.href = `archetype.html?id=${archetypeId}`;
                }
            });
        });
    }

    /**
     * Close modal
     */
    closeModal() {
        if (this.operatorModal) {
            this.operatorModal.classList.remove('active');
            this.currentOperator = null;
        }
    }

    /**
     * Destroy the manager and clean up event listeners
     */
    destroy() {
        if (this.closeModalBtn) {
            this.closeModalBtn.removeEventListener('click', this.closeModal);
        }

        if (this.operatorModal) {
            this.operatorModal.removeEventListener('click', this.closeModal);
        }

        document.removeEventListener('keydown', this.closeModal);
        clearTimeout(this.debounceTimer);

        console.log('OperatorManager destroyed');
    }
}