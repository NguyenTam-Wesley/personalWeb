import { supabase } from '../supabase/supabase.js';

/**
 * ArknightsOperatorAdminManager class for managing Arknights operators in admin panel
 */
export class ArknightsOperatorAdminManager {
    constructor() {
        this.tableBody = null;
        this.modal = null;
        this.deleteModal = null;
        this.form = null;
        this.currentOperatorId = null;
        this.classes = [];
        this.archetypes = [];
        this.rarities = [
            { id: 1, stars: '★' },
            { id: 2, stars: '★★' },
            { id: 3, stars: '★★★' },
            { id: 4, stars: '★★★★' },
            { id: 5, stars: '★★★★★' },
            { id: 6, stars: '★★★★★★' }
        ];

        // Filters
        this.filters = {
            search: '',
            classId: '',
            archetypeId: '',
            rarityId: ''
        };

        // Pagination
        this.currentPage = 1;
        this.pageSize = 10;
        this.totalRecords = 0;
    }

    /**
     * Initialize the admin manager
     */
    async init() {
        this.cacheElements();
        this.bindEvents();
        await this.loadMetadata();
        await this.loadOperators();
        console.log('ArknightsOperatorAdminManager initialized');
    }

    /**
     * Cache DOM elements
     */
    cacheElements() {
        this.tableBody = document.getElementById('operatorTableBody');
        this.modal = document.getElementById('operatorModal');
        this.deleteModal = document.getElementById('deleteModal');
        this.form = document.getElementById('operatorForm');
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Modal events
        document.getElementById('closeModal')?.addEventListener('click', () => this.closeModal());
        document.getElementById('closeDeleteModal')?.addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('cancelBtn')?.addEventListener('click', () => this.closeModal());
        document.getElementById('cancelDelete')?.addEventListener('click', () => this.closeDeleteModal());

        // Form events
        this.form?.addEventListener('submit', (e) => this.handleSubmit(e));
        document.getElementById('confirmDelete')?.addEventListener('click', () => this.deleteOperator());

        // Add button
        document.getElementById('addOperatorBtn')?.addEventListener('click', () => this.openAddModal());

        // Search and filters
        document.getElementById('adminSearch')?.addEventListener('input', (e) => {
            this.filters.search = e.target.value;
            this.debouncedSearch();
        });

        document.getElementById('adminClassFilter')?.addEventListener('change', (e) => {
            this.filters.classId = e.target.value;
            this.filters.archetypeId = ''; // Reset archetype when class changes
            this.loadArchetypes();
            this.loadOperators();
        });

        document.getElementById('adminArchetypeFilter')?.addEventListener('change', (e) => {
            this.filters.archetypeId = e.target.value;
            this.loadOperators();
        });

        document.getElementById('adminRarityFilter')?.addEventListener('change', (e) => {
            this.filters.rarityId = e.target.value;
            this.loadOperators();
        });

        // Pagination
        document.getElementById('adminPrevPage')?.addEventListener('click', () => this.prevPage());
        document.getElementById('adminNextPage')?.addEventListener('click', () => this.nextPage());

        // Modal backdrop click
        this.modal?.addEventListener('click', (e) => {
            if (e.target === this.modal) this.closeModal();
        });

        this.deleteModal?.addEventListener('click', (e) => {
            if (e.target === this.deleteModal) this.closeDeleteModal();
        });

        // ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                this.closeDeleteModal();
            }
        });
    }

    /**
     * Debounced search
     */
    debouncedSearch() {
        clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => {
            this.currentPage = 1;
            this.loadOperators();
        }, 300);
    }

    /**
     * Load metadata (classes, archetypes)
     */
    async loadMetadata() {
        await Promise.all([
            this.loadClasses(),
            this.loadArchetypes()
        ]);
        this.populateFilters();
    }

    /**
     * Load classes from database
     */
    async loadClasses() {
        try {
            const { data, error } = await supabase
                .from('classes')
                .select('id, name')
                .order('name');

            if (error) throw error;
            this.classes = data || [];
        } catch (error) {
            console.error('Error loading classes:', error);
            this.showMessage('Lỗi khi tải danh sách Class', 'error');
        }
    }

    /**
     * Load archetypes from database
     */
    async loadArchetypes() {
        try {
            const { data, error } = await supabase
                .from('archetypes')
                .select('id, name, class_id')
                .order('name');

            if (error) throw error;
            this.archetypes = data || [];
        } catch (error) {
            console.error('Error loading archetypes:', error);
            this.showMessage('Lỗi khi tải danh sách Archetype', 'error');
        }
    }

    /**
     * Populate filter dropdowns
     */
    populateFilters() {
        // Class filter
        const classFilter = document.getElementById('adminClassFilter');
        if (classFilter) {
            classFilter.innerHTML = '<option value="">Tất cả Class</option>' +
                this.classes.map(cls => `<option value="${cls.id}">${cls.name}</option>`).join('');
        }

        // Archetype filter
        this.updateArchetypeFilter();

        // Form selects
        this.populateFormSelects();
    }

    /**
     * Update archetype filter based on selected class
     */
    updateArchetypeFilter() {
        const archetypeFilter = document.getElementById('adminArchetypeFilter');
        if (!archetypeFilter) return;

        const selectedClassId = document.getElementById('adminClassFilter')?.value;
        let filteredArchetypes = this.archetypes;

        if (selectedClassId) {
            filteredArchetypes = this.archetypes.filter(arch => arch.class_id === selectedClassId);
        }

        archetypeFilter.innerHTML = '<option value="">Tất cả Archetype</option>' +
            filteredArchetypes.map(arch => `<option value="${arch.id}">${arch.name}</option>`).join('');
    }

    /**
     * Populate form select elements
     */
    populateFormSelects() {
        // Class select
        const classSelect = document.getElementById('operatorClass');
        if (classSelect) {
            classSelect.innerHTML = '<option value="">Chọn Class</option>' +
                this.classes.map(cls => `<option value="${cls.id}">${cls.name}</option>`).join('');
        }

        // Archetype select
        this.updateFormArchetypeSelect();
    }

    /**
     * Update form archetype select based on selected class
     */
    updateFormArchetypeSelect() {
        const classSelect = document.getElementById('operatorClass');
        const archetypeSelect = document.getElementById('operatorArchetype');

        if (!classSelect || !archetypeSelect) return;

        classSelect.addEventListener('change', () => {
            const selectedClassId = classSelect.value;
            let filteredArchetypes = this.archetypes;

            if (selectedClassId) {
                filteredArchetypes = this.archetypes.filter(arch => arch.class_id === selectedClassId);
            }

            archetypeSelect.innerHTML = '<option value="">Chọn Archetype</option>' +
                filteredArchetypes.map(arch => `<option value="${arch.id}">${arch.name}</option>`).join('');
        });
    }

    /**
     * Load operators with filters and pagination
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
                    description,
                    rarity_id,
                    created_at,
                    class:classes(id, name),
                    archetype:archetypes(id, name)
                `, { count: 'exact' })
                .order('created_at', { ascending: false });

            // Apply filters
            if (this.filters.search) {
                query = query.ilike('name', `%${this.filters.search}%`);
            }

            if (this.filters.classId) {
                query = query.eq('class_id', this.filters.classId);
            }

            if (this.filters.archetypeId) {
                query = query.eq('archetype_id', this.filters.archetypeId);
            }

            if (this.filters.rarityId) {
                query = query.eq('rarity_id', parseInt(this.filters.rarityId));
            }

            // Pagination
            const from = (this.currentPage - 1) * this.pageSize;
            const to = from + this.pageSize - 1;
            query = query.range(from, to);

            const { data, error, count } = await query;

            if (error) throw error;

            this.totalRecords = count || 0;
            this.renderOperators(data || []);
            this.renderPagination();

        } catch (error) {
            console.error('Error loading operators:', error);
            this.showError('Không thể tải danh sách operators');
        }
    }

    /**
     * Render operators table
     */
    renderOperators(operators) {
        if (!this.tableBody) return;

        if (operators.length === 0) {
            this.tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="no-data">Không có operator nào</td>
                </tr>
            `;
            return;
        }

        this.tableBody.innerHTML = operators.map(op => `
            <tr>
                <td>
                    <img src="${op.avatar_url || '/placeholder-avatar.png'}"
                         alt="${op.name}"
                         class="operator-avatar"
                         onerror="this.src='/placeholder-avatar.png'">
                </td>
                <td>${op.name}</td>
                <td>${op.class?.name || 'N/A'}</td>
                <td>${op.archetype?.name || 'N/A'}</td>
                <td>${this.getRarityStars(op.rarity_id)}</td>
                <td class="description-cell">${op.description || ''}</td>
                <td>${this.formatDate(op.created_at)}</td>
                <td>
                    <button class="btn-edit" onclick="window.operatorAdmin.editOperator('${op.id}')">
                        ✏️ Sửa
                    </button>
                    <button class="btn-delete" onclick="window.operatorAdmin.confirmDelete('${op.id}', '${op.name}')">
                        🗑️ Xóa
                    </button>
                </td>
            </tr>
        `).join('');
    }

    /**
     * Render pagination
     */
    renderPagination() {
        const pagination = document.getElementById('adminPagination');
        const pageNumbers = document.getElementById('adminPageNumbers');

        if (!pagination || !pageNumbers) return;

        const totalPages = Math.ceil(this.totalRecords / this.pageSize);

        if (totalPages <= 1) {
            pagination.style.display = 'none';
            return;
        }

        pagination.style.display = 'flex';

        // Update prev/next buttons
        document.getElementById('adminPrevPage').disabled = this.currentPage === 1;
        document.getElementById('adminNextPage').disabled = this.currentPage === totalPages;

        // Generate page numbers
        let pages = [];
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(totalPages, this.currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            pages.push(`
                <button class="page-number ${i === this.currentPage ? 'active' : ''}"
                        onclick="window.operatorAdmin.goToPage(${i})">
                    ${i}
                </button>
            `);
        }

        pageNumbers.innerHTML = pages.join('');
    }

    /**
     * Show loading state
     */
    showLoading() {
        if (this.tableBody) {
            this.tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="loading">Đang tải...</td>
                </tr>
            `;
        }
    }

    /**
     * Show error state
     */
    showError(message) {
        if (this.tableBody) {
            this.tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="error">${message}</td>
                </tr>
            `;
        }
    }

    /**
     * Open add modal
     */
    openAddModal() {
        this.currentOperatorId = null;
        document.getElementById('modalTitle').textContent = 'Thêm Operator Mới';
        this.resetForm();
        this.modal.classList.add('show');
    }

    /**
     * Open edit modal
     */
    async editOperator(id) {
        try {
            const { data, error } = await supabase
                .from('operators')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;

            this.currentOperatorId = id;
            this.populateForm(data);
            document.getElementById('modalTitle').textContent = 'Chỉnh sửa Operator';
            this.modal.classList.add('show');

        } catch (error) {
            console.error('Error loading operator:', error);
            this.showMessage('Không thể tải thông tin operator', 'error');
        }
    }

    /**
     * Reset form
     */
    resetForm() {
        this.form.reset();
        document.getElementById('operatorId').value = '';
        this.updateFormArchetypeSelect();
    }

    /**
     * Populate form with operator data
     */
    populateForm(operator) {
        document.getElementById('operatorId').value = operator.id;
        document.getElementById('operatorName').value = operator.name;
        document.getElementById('operatorClass').value = operator.class_id;
        document.getElementById('operatorRarity').value = operator.rarity_id;
        document.getElementById('operatorAvatar').value = operator.avatar_url || '';
        document.getElementById('operatorDescription').value = operator.description || '';

        // Trigger class change to load archetypes
        document.getElementById('operatorClass').dispatchEvent(new Event('change'));

        // Set archetype after archetypes are loaded
        setTimeout(() => {
            document.getElementById('operatorArchetype').value = operator.archetype_id;
        }, 100);
    }

    /**
     * Handle form submission
     */
    async handleSubmit(e) {
        e.preventDefault();

        const formData = {
            name: document.getElementById('operatorName').value.trim(),
            class_id: document.getElementById('operatorClass').value,
            archetype_id: document.getElementById('operatorArchetype').value,
            rarity_id: parseInt(document.getElementById('operatorRarity').value),
            avatar_url: document.getElementById('operatorAvatar').value.trim() || null,
            description: document.getElementById('operatorDescription').value.trim() || null
        };

        // Validation
        if (!formData.name || !formData.class_id || !formData.archetype_id || !formData.rarity_id) {
            this.showMessage('Vui lòng điền đầy đủ thông tin bắt buộc', 'error');
            return;
        }

        try {
            document.getElementById('saveBtn').disabled = true;
            document.getElementById('saveBtn').textContent = 'Đang lưu...';

            let result;
            if (this.currentOperatorId) {
                // Update
                result = await supabase
                    .from('operators')
                    .update(formData)
                    .eq('id', this.currentOperatorId);
            } else {
                // Create
                result = await supabase
                    .from('operators')
                    .insert([formData]);
            }

            if (result.error) throw result.error;

            this.showMessage(
                this.currentOperatorId ? 'Operator đã được cập nhật' : 'Operator đã được thêm',
                'success'
            );

            this.closeModal();
            await this.loadOperators();

        } catch (error) {
            console.error('Error saving operator:', error);
            if (error.code === '23505') {
                this.showMessage('Tên operator đã tồn tại', 'error');
            } else {
                this.showMessage('Lỗi khi lưu operator', 'error');
            }
        } finally {
            document.getElementById('saveBtn').disabled = false;
            document.getElementById('saveBtn').textContent = 'Lưu';
        }
    }

    /**
     * Confirm delete
     */
    confirmDelete(id, name) {
        this.currentOperatorId = id;
        document.getElementById('deleteOperatorName').textContent = name;
        this.deleteModal.classList.add('show');
    }

    /**
     * Delete operator
     */
    async deleteOperator() {
        if (!this.currentOperatorId) return;

        try {
            const { error } = await supabase
                .from('operators')
                .delete()
                .eq('id', this.currentOperatorId);

            if (error) throw error;

            this.showMessage('Operator đã được xóa', 'success');
            this.closeDeleteModal();
            await this.loadOperators();

        } catch (error) {
            console.error('Error deleting operator:', error);
            this.showMessage('Lỗi khi xóa operator', 'error');
        }
    }

    /**
     * Close modal
     */
    closeModal() {
        this.modal.classList.remove('show');
        this.resetForm();
    }

    /**
     * Close delete modal
     */
    closeDeleteModal() {
        this.deleteModal.classList.remove('show');
        this.currentOperatorId = null;
    }

    /**
     * Pagination methods
     */
    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.loadOperators();
        }
    }

    nextPage() {
        const totalPages = Math.ceil(this.totalRecords / this.pageSize);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.loadOperators();
        }
    }

    goToPage(page) {
        this.currentPage = page;
        this.loadOperators();
    }

    /**
     * Utility methods
     */
    getRarityStars(rarityId) {
        const rarity = this.rarities.find(r => r.id === rarityId);
        return rarity ? rarity.stars : '';
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('vi-VN');
    }

    showMessage(message, type = 'info') {
        // Simple alert for now - can be enhanced with toast notifications
        alert(message);
    }
}

// Global reference for button onclick handlers
window.operatorAdmin = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.operatorAdmin = new ArknightsOperatorAdminManager();
    window.operatorAdmin.init();
});