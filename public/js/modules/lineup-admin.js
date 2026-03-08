import { supabase } from '../supabase/supabase.js';
import { getCurrentUserWithRetry } from '../supabase/auth.js';

export class LineupAdminManager {
    constructor() {
        this.currentUser = null;
        this.lineups = [];
        this.totalItems = 0;
        this.currentPage = 1;
        this.itemsPerPage = 20;
        this.editingLineup = null;

        this.filters = {
            search: '',
            mapId: '',
            typeId: '',
            agentId: '',
            siteId: '',
            sideId: '',
        };

        this.options = {
            maps: [],
            types: [],
            agents: [],
            sites: [],
            sides: [],
            mapsById: {},
            typesById: {},
            agentsById: {},
            sitesById: {},
            sidesById: {},
        };

        this.init();
    }

    async init() {
        // Auth check giống CrosshairAdminManager
        const userData = await getCurrentUserWithRetry();
        this.currentUser = userData?.profile;

        console.log(`🔒 Lineup admin check: User=${this.currentUser?.username}, App Role=${this.currentUser?.role}`);

        if (!this.currentUser || this.currentUser.role !== 'admin') {
            console.log(`❌ Access denied for LineupAdmin: role=${this.currentUser?.role || 'none'}`);
            this.redirectToLogin();
            return;
        }

        console.log(`✅ Lineup admin access granted for: ${this.currentUser.username}`);

        await this.loadFilterOptions();
        this.setupEventListeners();
        await this.loadLineups();
    }

    async loadFilterOptions() {
        try {
            const [
                { data: maps, error: mapError },
                { data: types, error: typeError },
                { data: agents, error: agentError },
                { data: sites, error: siteError },
                { data: sides, error: sideError },
            ] = await Promise.all([
                supabase.from('maps').select('*').order('name', { ascending: true }),
                supabase.from('lineup_types').select('*').order('name', { ascending: true }),
                supabase.from('agents').select('*').order('name', { ascending: true }),
                supabase.from('sites').select('*').order('name', { ascending: true }),
                supabase.from('sides').select('*').order('name', { ascending: true }),
            ]);

            if (mapError || typeError || agentError || siteError || sideError) {
                console.error('Error loading lineup filter options:', {
                    mapError,
                    typeError,
                    agentError,
                    siteError,
                    sideError,
                });
                return;
            }

            this.options.maps = maps || [];
            this.options.types = types || [];
            this.options.agents = agents || [];
            this.options.sites = sites || [];
            this.options.sides = sides || [];

            this.options.mapsById = Object.fromEntries(this.options.maps.map((m) => [m.id, m]));
            this.options.typesById = Object.fromEntries(this.options.types.map((t) => [t.id, t]));
            this.options.agentsById = Object.fromEntries(this.options.agents.map((a) => [a.id, a]));
            this.options.sitesById = Object.fromEntries(this.options.sites.map((s) => [s.id, s]));
            this.options.sidesById = Object.fromEntries(this.options.sides.map((s) => [s.id, s]));

            this.populateFilterSelects();
            this.populateFormSelects();
        } catch (error) {
            console.error('Error in loadFilterOptions:', error);
        }
    }

    populateFilterSelects() {
        const mapFilter = document.getElementById('filterMap');
        const typeFilter = document.getElementById('filterType');
        const agentFilter = document.getElementById('filterAgent');
        const siteFilter = document.getElementById('filterSite');
        const sideFilter = document.getElementById('filterSide');

        if (mapFilter) {
            mapFilter.innerHTML = `
                <option value="">Tất cả map</option>
                ${this.options.maps
                    .map((m) => `<option value="${m.id}">${this.escapeHtml(m.name)}</option>`)
                    .join('')}
            `;
        }

        if (typeFilter) {
            typeFilter.innerHTML = `
                <option value="">Tất cả kiểu</option>
                ${this.options.types
                    .map((t) => `<option value="${t.id}">${this.escapeHtml(t.name)}</option>`)
                    .join('')}
            `;
        }

        if (agentFilter) {
            agentFilter.innerHTML = `
                <option value="">Tất cả agent</option>
                ${this.options.agents
                    .map((a) => `<option value="${a.id}">${this.escapeHtml(a.name)}</option>`)
                    .join('')}
            `;
        }

        if (siteFilter) {
            siteFilter.innerHTML = `
                <option value="">Tất cả site</option>
                ${this.options.sites
                    .map((s) => `<option value="${s.id}">${this.escapeHtml(s.name)}</option>`)
                    .join('')}
            `;
        }

        if (sideFilter) {
            sideFilter.innerHTML = `
                <option value="">Tất cả side</option>
                ${this.options.sides
                    .map((s) => `<option value="${s.id}">${this.escapeHtml(s.name)}</option>`)
                    .join('')}
            `;
        }
    }

    populateFormSelects() {
        const mapSelect = document.getElementById('lineupMap');
        const typeSelect = document.getElementById('lineupType');
        const agentsSelect = document.getElementById('lineupAgents');
        const sitesSelect = document.getElementById('lineupSites');
        const sidesSelect = document.getElementById('lineupSides');

        if (mapSelect) {
            mapSelect.innerHTML = `
                <option value="">Chọn map</option>
                ${this.options.maps
                    .map((m) => `<option value="${m.id}">${this.escapeHtml(m.name)}</option>`)
                    .join('')}
            `;
        }

        if (typeSelect) {
            typeSelect.innerHTML = `
                <option value="">Chọn kiểu lineup</option>
                ${this.options.types
                    .map((t) => `<option value="${t.id}">${this.escapeHtml(t.name)}</option>`)
                    .join('')}
            `;
        }

        if (agentsSelect) {
            agentsSelect.innerHTML = this.options.agents
                .map((a) => `<option value="${a.id}">${this.escapeHtml(a.name)}</option>`)
                .join('');
        }

        if (sitesSelect) {
            sitesSelect.innerHTML = this.options.sites
                .map((s) => `<option value="${s.id}">${this.escapeHtml(s.name)}</option>`)
                .join('');
        }

        if (sidesSelect) {
            sidesSelect.innerHTML = this.options.sides
                .map((s) => `<option value="${s.id}">${this.escapeHtml(s.name)}</option>`)
                .join('');
        }
    }

    async loadLineups() {
        try {
            this.showLoading();

            // Nếu filter theo agent/site/side, lấy danh sách lineup_id phù hợp
            let allowedLineupIds = null;

            if (this.filters.agentId) {
                const { data, error } = await supabase
                    .from('lineup_agents')
                    .select('lineup_id')
                    .eq('agent_id', this.filters.agentId);

                if (error) {
                    console.error('Error loading lineup_agents for admin:', error);
                    this.showError('Lỗi khi tải lineup theo agent');
                    return;
                }

                allowedLineupIds = (data || []).map((row) => row.lineup_id);
            }

            if (this.filters.siteId) {
                const { data, error } = await supabase
                    .from('lineup_sites')
                    .select('lineup_id')
                    .eq('site_id', this.filters.siteId);

                if (error) {
                    console.error('Error loading lineup_sites for admin:', error);
                    this.showError('Lỗi khi tải lineup theo site');
                    return;
                }

                const siteLineupIds = (data || []).map((row) => row.lineup_id);

                if (allowedLineupIds === null) {
                    allowedLineupIds = siteLineupIds;
                } else {
                    const set = new Set(siteLineupIds);
                    allowedLineupIds = allowedLineupIds.filter((id) => set.has(id));
                }
            }

            if (this.filters.sideId) {
                const { data, error } = await supabase
                    .from('lineup_sides')
                    .select('lineup_id')
                    .eq('side_id', this.filters.sideId);

                if (error) {
                    console.error('Error loading lineup_sides for admin:', error);
                    this.showError('Lỗi khi tải lineup theo side');
                    return;
                }

                const sideLineupIds = (data || []).map((row) => row.lineup_id);

                if (allowedLineupIds === null) {
                    allowedLineupIds = sideLineupIds;
                } else {
                    const set = new Set(sideLineupIds);
                    allowedLineupIds = allowedLineupIds.filter((id) => set.has(id));
                }
            }

            // Nếu đã tính allowedLineupIds mà rỗng, không cần query tiếp
            if (allowedLineupIds !== null && allowedLineupIds.length === 0) {
                this.lineups = [];
                this.totalItems = 0;
                this.renderTable();
                this.renderPagination();
                return;
            }

            // Query chính từ bảng lineups
            let query = supabase.from('lineups').select('*', { count: 'exact' });

            if (this.filters.mapId) {
                query = query.eq('map_id', this.filters.mapId);
            }

            if (this.filters.typeId) {
                query = query.eq('type_id', this.filters.typeId);
            }

            if (this.filters.search) {
                const search = this.filters.search;
                query = query.or(
                    `title.ilike.%${search}%,description.ilike.%${search}%,video_url.ilike.%${search}%`
                );
            }

            if (allowedLineupIds !== null) {
                query = query.in('id', allowedLineupIds);
            }

            query = query.order('created_at', { ascending: false });

            const from = (this.currentPage - 1) * this.itemsPerPage;
            const to = from + this.itemsPerPage - 1;
            query = query.range(from, to);

            const { data: lineups, error, count } = await query;

            if (error) {
                console.error('Error loading lineups (admin):', error);
                this.showError('Lỗi khi tải danh sách lineup');
                return;
            }

            const lineupList = lineups || [];
            this.totalItems = count || 0;

            if (!lineupList.length) {
                this.lineups = [];
                this.renderTable();
                this.renderPagination();
                return;
            }

            const lineupIds = lineupList.map((l) => l.id);

            const [
                { data: lineupAgents, error: laError },
                { data: lineupSites, error: lsError },
                { data: lineupSides, error: lsideError },
            ] = await Promise.all([
                supabase
                    .from('lineup_agents')
                    .select('lineup_id, agent_id')
                    .in('lineup_id', lineupIds),
                supabase
                    .from('lineup_sites')
                    .select('lineup_id, site_id')
                    .in('lineup_id', lineupIds),
                supabase
                    .from('lineup_sides')
                    .select('lineup_id, side_id')
                    .in('lineup_id', lineupIds),
            ]);

            if (laError || lsError || lsideError) {
                console.error('Error loading lineup relations (admin):', {
                    laError,
                    lsError,
                    lsideError,
                });
            }

            const agentsByLineup = {};
            (lineupAgents || []).forEach((row) => {
                if (!agentsByLineup[row.lineup_id]) agentsByLineup[row.lineup_id] = [];
                const agent = this.options.agentsById[row.agent_id];
                if (agent) agentsByLineup[row.lineup_id].push(agent);
            });

            const sitesByLineup = {};
            (lineupSites || []).forEach((row) => {
                if (!sitesByLineup[row.lineup_id]) sitesByLineup[row.lineup_id] = [];
                const site = this.options.sitesById[row.site_id];
                if (site) sitesByLineup[row.lineup_id].push(site);
            });

            const sidesByLineup = {};
            (lineupSides || []).forEach((row) => {
                if (!sidesByLineup[row.lineup_id]) sidesByLineup[row.lineup_id] = [];
                const side = this.options.sidesById[row.side_id];
                if (side) sidesByLineup[row.lineup_id].push(side);
            });

            this.lineups = lineupList.map((l) => ({
                ...l,
                map: this.options.mapsById[l.map_id] || null,
                type: this.options.typesById[l.type_id] || null,
                agents: agentsByLineup[l.id] || [],
                sites: sitesByLineup[l.id] || [],
                sides: sidesByLineup[l.id] || [],
            }));

            this.renderTable();
            this.renderPagination();
        } catch (error) {
            console.error('Error in loadLineups (admin):', error);
            this.showError('Lỗi khi tải danh sách lineup');
        }
    }

    renderTable() {
        const tableBody = document.getElementById('lineupTableBody');
        if (!tableBody) return;

        if (!this.lineups.length) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" class="no-data">Không có lineup nào</td>
                </tr>
            `;
            return;
        }

        const rowsHTML = this.lineups.map((l) => this.createTableRow(l)).join('');
        tableBody.innerHTML = rowsHTML;

        tableBody.querySelectorAll('.edit-btn').forEach((btn, index) => {
            btn.addEventListener('click', () => this.editLineup(this.lineups[index]));
        });

        tableBody.querySelectorAll('.delete-btn').forEach((btn, index) => {
            btn.addEventListener('click', () => this.showDeleteModal(this.lineups[index]));
        });
    }

    createTableRow(lineup) {
        const mapName = lineup.map?.name || '-';
        const typeName = lineup.type?.name || '-';
        const agentsText = (lineup.agents || []).map((a) => a.name).join(', ') || '-';
        const sitesText = (lineup.sites || []).map((s) => s.name).join(', ') || '-';
        const sidesText = (lineup.sides || []).map((s) => s.name).join(', ') || '-';
        const createdAt = lineup.created_at
            ? new Date(lineup.created_at).toLocaleString('vi-VN')
            : '-';

        return `
            <tr data-lineup-id="${lineup.id}">
                <td>
                    <div class="crosshair-info-cell">
                        <strong>${this.escapeHtml(lineup.title || '(Không có tiêu đề)')}</strong>
                        <small>${this.escapeHtml(lineup.description || '')}</small>
                    </div>
                </td>
                <td>${this.escapeHtml(mapName)}</td>
                <td>${this.escapeHtml(typeName)}</td>
                <td>${this.escapeHtml(agentsText)}</td>
                <td>${this.escapeHtml(sitesText)}</td>
                <td>${this.escapeHtml(sidesText)}</td>
                <td>
                    <a href="${this.escapeHtml(lineup.video_url)}" target="_blank">
                        Xem clip
                    </a>
                </td>
                <td>${this.escapeHtml(createdAt)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon edit-btn" title="Chỉnh sửa">
                            ✏️
                        </button>
                        <button class="btn-icon delete-btn" title="Xóa">
                            🗑️
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    setupEventListeners() {
        const searchInput = document.getElementById('adminLineupSearch');
        const mapFilter = document.getElementById('filterMap');
        const typeFilter = document.getElementById('filterType');
        const agentFilter = document.getElementById('filterAgent');
        const siteFilter = document.getElementById('filterSite');
        const sideFilter = document.getElementById('filterSide');

        if (searchInput) {
            searchInput.addEventListener('input', this.debounce(() => this.handleSearch(), 300));
        }

        if (mapFilter) {
            mapFilter.addEventListener('change', () => this.handleFilterChange());
        }
        if (typeFilter) {
            typeFilter.addEventListener('change', () => this.handleFilterChange());
        }
        if (agentFilter) {
            agentFilter.addEventListener('change', () => this.handleFilterChange());
        }
        if (siteFilter) {
            siteFilter.addEventListener('change', () => this.handleFilterChange());
        }
        if (sideFilter) {
            sideFilter.addEventListener('change', () => this.handleFilterChange());
        }

        const addBtn = document.getElementById('addLineupBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.showAddModal());
        }

        const modal = document.getElementById('lineupModal');
        const closeModal = document.getElementById('closeLineupModal');
        const cancelBtn = document.getElementById('cancelLineupBtn');
        const form = document.getElementById('lineupForm');

        if (closeModal) {
            closeModal.addEventListener('click', () => this.closeModal());
        }
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeModal());
        }
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeModal();
            });
        }
        if (form) {
            form.addEventListener('submit', (e) => this.handleSave(e));
        }

        const deleteModal = document.getElementById('deleteLineupModal');
        const closeDeleteModal = document.getElementById('closeDeleteLineupModal');
        const cancelDelete = document.getElementById('cancelDeleteLineup');
        const confirmDelete = document.getElementById('confirmDeleteLineup');

        if (closeDeleteModal) {
            closeDeleteModal.addEventListener('click', () => this.closeDeleteModal());
        }
        if (cancelDelete) {
            cancelDelete.addEventListener('click', () => this.closeDeleteModal());
        }
        if (deleteModal) {
            deleteModal.addEventListener('click', (e) => {
                if (e.target === deleteModal) this.closeDeleteModal();
            });
        }
        if (confirmDelete) {
            confirmDelete.addEventListener('click', () => this.deleteLineup());
        }

        const prevPage = document.getElementById('lineupAdminPrevPage');
        const nextPage = document.getElementById('lineupAdminNextPage');

        if (prevPage) {
            prevPage.addEventListener('click', () => this.goToPage(this.currentPage - 1));
        }
        if (nextPage) {
            nextPage.addEventListener('click', () => this.goToPage(this.currentPage + 1));
        }
    }

    handleSearch() {
        const searchInput = document.getElementById('adminLineupSearch');
        if (searchInput) {
            this.filters.search = searchInput.value.trim();
            this.currentPage = 1;
            this.loadLineups();
        }
    }

    handleFilterChange() {
        const mapFilter = document.getElementById('filterMap');
        const typeFilter = document.getElementById('filterType');
        const agentFilter = document.getElementById('filterAgent');
        const siteFilter = document.getElementById('filterSite');
        const sideFilter = document.getElementById('filterSide');

        this.filters.mapId = mapFilter?.value || '';
        this.filters.typeId = typeFilter?.value || '';
        this.filters.agentId = agentFilter?.value || '';
        this.filters.siteId = siteFilter?.value || '';
        this.filters.sideId = sideFilter?.value || '';

        this.currentPage = 1;
        this.loadLineups();
    }

    showAddModal() {
        this.editingLineup = null;
        this.resetForm();
        const titleEl = document.getElementById('lineupModalTitle');
        if (titleEl) titleEl.textContent = 'Thêm Lineup Mới';
        document.getElementById('lineupModal')?.classList.add('show');
    }

    editLineup(lineup) {
        this.editingLineup = lineup;
        this.fillForm(lineup);
        const titleEl = document.getElementById('lineupModalTitle');
        if (titleEl) titleEl.textContent = 'Chỉnh sửa Lineup';
        document.getElementById('lineupModal')?.classList.add('show');
    }

    fillForm(lineup) {
        document.getElementById('lineupId').value = lineup.id;
        document.getElementById('lineupTitle').value = lineup.title || '';
        document.getElementById('lineupDescription').value = lineup.description || '';
        document.getElementById('lineupVideoUrl').value = lineup.video_url || '';
        document.getElementById('lineupMap').value = lineup.map_id || '';
        document.getElementById('lineupType').value = lineup.type_id || '';

        const agentsSelect = document.getElementById('lineupAgents');
        const sitesSelect = document.getElementById('lineupSites');
        const sidesSelect = document.getElementById('lineupSides');

        const agentIds = new Set((lineup.agents || []).map((a) => String(a.id)));
        const siteIds = new Set((lineup.sites || []).map((s) => String(s.id)));
        const sideIds = new Set((lineup.sides || []).map((s) => String(s.id)));

        if (agentsSelect) {
            Array.from(agentsSelect.options).forEach((opt) => {
                opt.selected = agentIds.has(opt.value);
            });
        }
        if (sitesSelect) {
            Array.from(sitesSelect.options).forEach((opt) => {
                opt.selected = siteIds.has(opt.value);
            });
        }
        if (sidesSelect) {
            Array.from(sidesSelect.options).forEach((opt) => {
                opt.selected = sideIds.has(opt.value);
            });
        }
    }

    resetForm() {
        const form = document.getElementById('lineupForm');
        if (form) form.reset();
        const idEl = document.getElementById('lineupId');
        if (idEl) idEl.value = '';

        ['lineupAgents', 'lineupSites', 'lineupSides'].forEach((id) => {
            const select = document.getElementById(id);
            if (select) {
                Array.from(select.options).forEach((opt) => {
                    opt.selected = false;
                });
            }
        });
    }

    async handleSave(e) {
        e.preventDefault();

        const saveBtn = document.getElementById('saveLineupBtn');
        const originalText = saveBtn?.textContent;

        try {
            if (saveBtn) {
                saveBtn.textContent = 'Đang lưu...';
                saveBtn.disabled = true;
            }

            const mainData = this.getMainFormData();
            const relations = this.getRelationsFormData();

            if (this.editingLineup) {
                await this.updateLineup(mainData, relations);
            } else {
                await this.createLineup(mainData, relations);
            }

            this.closeModal();
            await this.loadLineups();
            this.showNotification('Lưu lineup thành công!', 'success');
        } catch (error) {
            console.error('Error saving lineup:', error);
            this.showNotification('Lỗi khi lưu lineup', 'error');
        } finally {
            if (saveBtn) {
                saveBtn.textContent = originalText;
                saveBtn.disabled = false;
            }
        }
    }

    getMainFormData() {
        return {
            title: document.getElementById('lineupTitle').value.trim(),
            description: document.getElementById('lineupDescription').value.trim(),
            video_url: document.getElementById('lineupVideoUrl').value.trim(),
            map_id: document.getElementById('lineupMap').value || null,
            type_id: document.getElementById('lineupType').value || null,
        };
    }

    getRelationsFormData() {
        const getSelectedValues = (selectId) => {
            const select = document.getElementById(selectId);
            if (!select) return [];
            return Array.from(select.selectedOptions).map((opt) => opt.value);
        };

        return {
            agentIds: getSelectedValues('lineupAgents'),
            siteIds: getSelectedValues('lineupSites'),
            sideIds: getSelectedValues('lineupSides'),
        };
    }

    async createLineup(mainData, relations) {
        const { data, error } = await supabase
            .from('lineups')
            .insert([mainData])
            .select()
            .single();

        if (error) throw error;

        const lineupId = data.id;
        await this.syncRelations(lineupId, relations);
    }

    async updateLineup(mainData, relations) {
        if (!this.editingLineup) return;

        const { error } = await supabase
            .from('lineups')
            .update(mainData)
            .eq('id', this.editingLineup.id);

        if (error) throw error;

        await this.syncRelations(this.editingLineup.id, relations);
    }

    async syncRelations(lineupId, relations) {
        const { agentIds, siteIds, sideIds } = relations;

        // Xóa hết cũ rồi insert lại theo form (đơn giản, dễ hiểu)
        const operations = [];

        operations.push(
            supabase.from('lineup_agents').delete().eq('lineup_id', lineupId),
            supabase.from('lineup_sites').delete().eq('lineup_id', lineupId),
            supabase.from('lineup_sides').delete().eq('lineup_id', lineupId)
        );

        await Promise.all(operations);

        const inserts = [];

        if (agentIds.length) {
            inserts.push(
                supabase
                    .from('lineup_agents')
                    .insert(agentIds.map((agentId) => ({ lineup_id: lineupId, agent_id: agentId })))
            );
        }

        if (siteIds.length) {
            inserts.push(
                supabase
                    .from('lineup_sites')
                    .insert(siteIds.map((siteId) => ({ lineup_id: lineupId, site_id: siteId })))
            );
        }

        if (sideIds.length) {
            inserts.push(
                supabase
                    .from('lineup_sides')
                    .insert(sideIds.map((sideId) => ({ lineup_id: lineupId, side_id: sideId })))
            );
        }

        if (inserts.length) {
            const results = await Promise.all(inserts);
            const error = results.find((r) => r.error)?.error;
            if (error) throw error;
        }
    }

    showDeleteModal(lineup) {
        this.editingLineup = lineup;
        const span = document.getElementById('deleteLineupTitle');
        if (span) span.textContent = lineup.title || '(Không có tiêu đề)';
        const modal = document.getElementById('deleteLineupModal');
        if (modal) modal.style.display = 'flex';
    }

    async deleteLineup() {
        if (!this.editingLineup) return;

        try {
            const { error } = await supabase
                .from('lineups')
                .delete()
                .eq('id', this.editingLineup.id);

            if (error) throw error;

            this.closeDeleteModal();
            await this.loadLineups();
            this.showNotification('Đã xóa lineup thành công!', 'success');
        } catch (error) {
            console.error('Error deleting lineup:', error);
            this.showNotification('Lỗi khi xóa lineup', 'error');
        }
    }

    closeModal() {
        document.getElementById('lineupModal')?.classList.remove('show');
        this.editingLineup = null;
    }

    closeDeleteModal() {
        const modal = document.getElementById('deleteLineupModal');
        if (modal) modal.style.display = 'none';
        this.editingLineup = null;
    }

    renderPagination() {
        const container = document.getElementById('lineupAdminPagination');
        if (!container) return;

        const totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
        if (totalPages <= 1) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'flex';

        const prevBtn = container.querySelector('#lineupAdminPrevPage');
        const nextBtn = container.querySelector('#lineupAdminNextPage');
        const pageNumbers = container.querySelector('#lineupAdminPageNumbers');

        if (prevBtn) {
            prevBtn.disabled = this.currentPage <= 1;
        }
        if (nextBtn) {
            nextBtn.disabled = this.currentPage >= totalPages;
        }
        if (pageNumbers) {
            pageNumbers.innerHTML = this.generatePageNumbers(totalPages);
        }
    }

    generatePageNumbers(totalPages) {
        const pages = [];
        const maxVisible = 5;

        let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
        let end = Math.min(totalPages, start + maxVisible - 1);

        if (end - start + 1 < maxVisible) {
            start = Math.max(1, end - maxVisible + 1);
        }

        for (let i = start; i <= end; i++) {
            pages.push(`
                <button class="page-number ${i === this.currentPage ? 'active' : ''}" 
                        onclick="window.lineupAdminManager.goToPage(${i})">${i}</button>
            `);
        }

        return pages.join('');
    }

    goToPage(page) {
        this.currentPage = page;
        this.loadLineups();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    showLoading() {
        const tableBody = document.getElementById('lineupTableBody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" class="loading">
                        <div class="loading-spinner">
                            <div class="spinner"></div>
                            <p>Đang tải...</p>
                        </div>
                    </td>
                </tr>
            `;
        }
    }

    showError(message) {
        const tableBody = document.getElementById('lineupTableBody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" class="error">
                        <p>❌ ${message}</p>
                        <button onclick="location.reload()">Thử lại</button>
                    </td>
                </tr>
            `;
        }
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `admin-notification ${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => notification.classList.add('show'), 100);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text ?? '';
        return div.innerHTML;
    }

    debounce(func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    redirectToLogin() {
        window.location.href = '../../login.html';
    }
}

