import { supabase } from '../supabase/supabase.js';

export class LineupManager {
    constructor() {
        this.lineups = [];
        this.totalItems = 0;
        this.currentPage = 1;
        this.itemsPerPage = 9;

        this.filters = {
            mapId: '',
            typeId: '',
            agentId: '',
            siteId: '',
            sideId: '',
            search: ''
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
            sidesById: {}
        };

        this.init();
    }

    async init() {
        try {
            await this.loadFilterOptions();
            this.setupFiltersUI();
            this.setupEventListeners();
            await this.loadLineups();
        } catch (error) {
            console.error('Error initializing LineupManager:', error);
            this.showError('Lỗi khi khởi tạo danh sách lineup');
        }
    }

    async loadFilterOptions() {
        try {
            const [{ data: maps, error: mapError },
                   { data: types, error: typeError },
                   { data: agents, error: agentError },
                   { data: sites, error: siteError },
                   { data: sides, error: sideError }] = await Promise.all([
                supabase.from('maps').select('*').order('name', { ascending: true }),
                supabase.from('lineup_types').select('*').order('name', { ascending: true }),
                supabase.from('agents').select('*').order('name', { ascending: true }),
                supabase.from('sites').select('*').order('name', { ascending: true }),
                supabase.from('sides').select('*').order('name', { ascending: true }),
            ]);

            if (mapError || typeError || agentError || siteError || sideError) {
                console.error('Error loading filter options:', { mapError, typeError, agentError, siteError, sideError });
                return;
            }

            this.options.maps = maps || [];
            this.options.types = types || [];
            this.options.agents = agents || [];
            this.options.sites = sites || [];
            this.options.sides = sides || [];

            this.options.mapsById = Object.fromEntries(this.options.maps.map(m => [m.id, m]));
            this.options.typesById = Object.fromEntries(this.options.types.map(t => [t.id, t]));
            this.options.agentsById = Object.fromEntries(this.options.agents.map(a => [a.id, a]));
            this.options.sitesById = Object.fromEntries(this.options.sites.map(s => [s.id, s]));
            this.options.sidesById = Object.fromEntries(this.options.sides.map(s => [s.id, s]));
        } catch (error) {
            console.error('Error in loadFilterOptions:', error);
        }
    }

    setupFiltersUI() {
        const container = document.querySelector('.crosshair-container');
        if (!container) return;

        const existing = container.querySelector('.crosshair-filters');
        if (existing) {
            existing.remove();
        }

        const filtersHTML = `
            <div class="crosshair-filters lineup-filters">
                <div class="search-box">
                    <input type="text" id="lineupSearch" placeholder="Tìm lineup theo tiêu đề hoặc mô tả..." />
                    <span class="search-icon">🔍</span>
                </div>
                <div class="filter-options">
                    <select id="mapFilter">
                        <option value="">Tất cả map</option>
                        ${this.options.maps.map(m => `<option value="${m.id}">${this.escapeHtml(m.name)}</option>`).join('')}
                    </select>
                    <select id="typeFilter">
                        <option value="">Tất cả kiểu</option>
                        ${this.options.types.map(t => `<option value="${t.id}">${this.escapeHtml(t.name)}</option>`).join('')}
                    </select>
                    <select id="agentFilter">
                        <option value="">Tất cả agent</option>
                        ${this.options.agents.map(a => `<option value="${a.id}">${this.escapeHtml(a.name)}</option>`).join('')}
                    </select>
                    <select id="siteFilter">
                        <option value="">Tất cả site</option>
                        ${this.options.sites.map(s => `<option value="${s.id}">${this.escapeHtml(s.name)}</option>`).join('')}
                    </select>
                    <select id="sideFilter">
                        <option value="">Tất cả side</option>
                        ${this.options.sides.map(s => `<option value="${s.id}">${this.escapeHtml(s.name)}</option>`).join('')}
                    </select>
                </div>
            </div>
        `;

        const header = container.querySelector('.crosshair-header');
        if (header) {
            header.insertAdjacentHTML('afterend', filtersHTML);
        } else {
            container.insertAdjacentHTML('afterbegin', filtersHTML);
        }
    }

    setupEventListeners() {
        const searchInput = document.getElementById('lineupSearch');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce(() => this.handleSearch(), 300));
        }

        const mapFilter = document.getElementById('mapFilter');
        const typeFilter = document.getElementById('typeFilter');
        const agentFilter = document.getElementById('agentFilter');
        const siteFilter = document.getElementById('siteFilter');
        const sideFilter = document.getElementById('sideFilter');

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
    }

    handleSearch() {
        const searchInput = document.getElementById('lineupSearch');
        if (searchInput) {
            this.filters.search = searchInput.value.trim();
            this.currentPage = 1;
            this.loadLineups();
        }
    }

    handleFilterChange() {
        const mapFilter = document.getElementById('mapFilter');
        const typeFilter = document.getElementById('typeFilter');
        const agentFilter = document.getElementById('agentFilter');
        const siteFilter = document.getElementById('siteFilter');
        const sideFilter = document.getElementById('sideFilter');

        this.filters.mapId = mapFilter?.value || '';
        this.filters.typeId = typeFilter?.value || '';
        this.filters.agentId = agentFilter?.value || '';
        this.filters.siteId = siteFilter?.value || '';
        this.filters.sideId = sideFilter?.value || '';

        this.currentPage = 1;
        this.loadLineups();
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
                    console.error('Error loading lineup_agents:', error);
                    this.showError('Lỗi khi tải lineup theo agent');
                    return;
                }

                allowedLineupIds = (data || []).map(row => row.lineup_id);
            }

            if (this.filters.siteId) {
                const { data, error } = await supabase
                    .from('lineup_sites')
                    .select('lineup_id')
                    .eq('site_id', this.filters.siteId);

                if (error) {
                    console.error('Error loading lineup_sites:', error);
                    this.showError('Lỗi khi tải lineup theo site');
                    return;
                }

                const siteIds = (data || []).map(row => row.lineup_id);

                if (allowedLineupIds === null) {
                    allowedLineupIds = siteIds;
                } else {
                    const set = new Set(siteIds);
                    allowedLineupIds = allowedLineupIds.filter(id => set.has(id));
                }
            }

            if (this.filters.sideId) {
                const { data, error } = await supabase
                    .from('lineup_sides')
                    .select('lineup_id')
                    .eq('side_id', this.filters.sideId);

                if (error) {
                    console.error('Error loading lineup_sides:', error);
                    this.showError('Lỗi khi tải lineup theo side');
                    return;
                }

                const sideLineupIds = (data || []).map(row => row.lineup_id);

                if (allowedLineupIds === null) {
                    allowedLineupIds = sideLineupIds;
                } else {
                    const set = new Set(sideLineupIds);
                    allowedLineupIds = allowedLineupIds.filter(id => set.has(id));
                }
            }

            // Nếu đã tính allowedLineupIds mà rỗng, không cần query tiếp
            if (allowedLineupIds !== null && allowedLineupIds.length === 0) {
                this.lineups = [];
                this.totalItems = 0;
                this.renderLineups();
                this.renderPagination();
                return;
            }

            // Query chính từ bảng lineups
            let query = supabase
                .from('lineups')
                .select('*', { count: 'exact' });

            if (this.filters.mapId) {
                query = query.eq('map_id', this.filters.mapId);
            }

            if (this.filters.typeId) {
                query = query.eq('type_id', this.filters.typeId);
            }

            if (this.filters.search) {
                const search = this.filters.search;
                query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
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
                console.error('Error loading lineups:', error);
                this.showError('Lỗi khi tải danh sách lineup');
                return;
            }

            const lineupList = lineups || [];
            this.totalItems = count || 0;

            // Nếu không có lineup nào, render luôn
            if (!lineupList.length) {
                this.lineups = [];
                this.renderLineups();
                this.renderPagination();
                return;
            }

            // Lấy agents, sites & sides cho các lineup trong trang hiện tại
            const lineupIds = lineupList.map(l => l.id);

            const [{ data: lineupAgents, error: laError },
                   { data: lineupSites, error: lsError },
                   { data: lineupSides, error: lsideError }] = await Promise.all([
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
                    .in('lineup_id', lineupIds)
            ]);

            if (laError || lsError || lsideError) {
                console.error('Error loading lineup relations:', { laError, lsError, lsideError });
            }

            const agentsByLineup = {};
            (lineupAgents || []).forEach(row => {
                if (!agentsByLineup[row.lineup_id]) agentsByLineup[row.lineup_id] = [];
                const agent = this.options.agentsById[row.agent_id];
                if (agent) agentsByLineup[row.lineup_id].push(agent);
            });

            const sitesByLineup = {};
            (lineupSites || []).forEach(row => {
                if (!sitesByLineup[row.lineup_id]) sitesByLineup[row.lineup_id] = [];
                const site = this.options.sitesById[row.site_id];
                if (site) sitesByLineup[row.lineup_id].push(site);
            });

            const sidesByLineup = {};
            (lineupSides || []).forEach(row => {
                if (!sidesByLineup[row.lineup_id]) sidesByLineup[row.lineup_id] = [];
                const side = this.options.sidesById[row.side_id];
                if (side) sidesByLineup[row.lineup_id].push(side);
            });

            this.lineups = lineupList.map(l => ({
                ...l,
                map: this.options.mapsById[l.map_id] || null,
                type: this.options.typesById[l.type_id] || null,
                agents: agentsByLineup[l.id] || [],
                sites: sitesByLineup[l.id] || [],
                sides: sidesByLineup[l.id] || []
            }));

            this.renderLineups();
            this.renderPagination();
        } catch (error) {
            console.error('Error in loadLineups:', error);
            this.showError('Lỗi khi tải danh sách lineup');
        }
    }

    renderLineups() {
        const grid = document.querySelector('.crosshair-grid');
        if (!grid) return;

        if (!this.lineups.length) {
            grid.innerHTML = `
                <div class="no-crosshairs">
                    <p>Không tìm thấy lineup nào phù hợp</p>
                </div>
            `;
            return;
        }

        const html = this.lineups.map(lineup => this.createLineupCard(lineup)).join('');
        grid.innerHTML = html;
    }

    createLineupCard(lineup) {
        const mapName = lineup.map?.name || 'Unknown map';
        const typeName = lineup.type?.name || 'Unknown type';
        const agents = (lineup.agents || []).map(a => a.name).join(', ');
        const sites = (lineup.sites || []).map(s => s.name).join(', ');
        const sides = (lineup.sides || []).map(s => s.name).join(', ');

        const agentsText = agents || 'Nhiều agent';
        const sitesText = sites || 'Nhiều site';
        const sidesText = sides || 'Cả 2 side';

        return `
            <div class="crosshair-card lineup-card" data-lineup-id="${lineup.id}">
                <div class="crosshair-info">
                    <div class="crosshair-header">
                        <h3>${this.escapeHtml(lineup.title || 'Lineup không tên')}</h3>
                        <div class="crosshair-badges">
                            <span class="badge category-badge">🗺️ ${this.escapeHtml(mapName)}</span>
                            <span class="badge difficulty-badge">${this.escapeHtml(typeName)}</span>
                        </div>
                    </div>
                    <p class="crosshair-description">
                        ${this.escapeHtml(lineup.description || 'Không có mô tả chi tiết cho lineup này.')}
                    </p>
                    <div class="crosshair-meta">
                        <span class="player-info">👤 ${this.escapeHtml(agentsText)}</span>
                        <span class="team-info">📍 ${this.escapeHtml(sitesText)}</span>
                        <span class="team-info">⚔️ ${this.escapeHtml(sidesText)}</span>
                    </div>
                </div>
                <div class="crosshair-code">
                    <button class="copy-button" onclick="window.open('${encodeURI(lineup.video_url)}', '_blank')">Xem clip</button>
                </div>
            </div>
        `;
    }

    renderPagination() {
        const paginationContainer = document.querySelector('.crosshair-pagination');
        if (!paginationContainer) return;

        const totalPages = Math.ceil(this.totalItems / this.itemsPerPage);

        if (totalPages <= 1) {
            paginationContainer.style.display = 'none';
            return;
        }

        paginationContainer.style.display = 'flex';

        const prevBtn = paginationContainer.querySelector('#prevPage');
        const nextBtn = paginationContainer.querySelector('#nextPage');
        const pageNumbers = paginationContainer.querySelector('#pageNumbers');

        if (prevBtn) {
            prevBtn.disabled = this.currentPage <= 1;
            prevBtn.onclick = () => this.goToPage(this.currentPage - 1);
        }

        if (nextBtn) {
            nextBtn.disabled = this.currentPage >= totalPages;
            nextBtn.onclick = () => this.goToPage(this.currentPage + 1);
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
                        onclick="window.lineupManager.goToPage(${i})">${i}</button>
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
        const grid = document.querySelector('.crosshair-grid');
        if (grid) {
            grid.innerHTML = `
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <p>Đang tải lineups...</p>
                </div>
            `;
        }
    }

    showError(message) {
        const grid = document.querySelector('.crosshair-grid');
        if (grid) {
            grid.innerHTML = `
                <div class="error-message">
                    <p>❌ ${message}</p>
                    <button onclick="location.reload()">Thử lại</button>
                </div>
            `;
        }
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

    static init() {
        const manager = new LineupManager();
        window.lineupManager = manager;
        return manager;
    }
}

