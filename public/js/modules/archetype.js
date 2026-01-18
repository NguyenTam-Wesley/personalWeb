import { supabase } from '../supabase/supabase.js';

/**
 * ArchetypeManager class for handling Arknights archetype detail page functionality
 */
export class ArchetypeManager {
    constructor() {
        this.archetypeId = null;
        this.archetypeData = null;
        this.operatorsGrid = null;
    }

    /**
     * Initialize the archetype page functionality
     */
    async init() {
        this.cacheElements();
        this.getArchetypeIdFromUrl();
        if (this.archetypeId) {
            await this.loadArchetypeData();
            await this.loadArchetypeOperators();
        } else {
            this.showError('Không tìm thấy ID archetype');
        }
        console.log('ArchetypeManager initialized');
    }

    /**
     * Cache DOM elements for performance
     */
    cacheElements() {
        this.operatorsGrid = document.getElementById('archetypeOperatorsGrid');
    }

    /**
     * Get archetype ID from URL parameters
     */
    getArchetypeIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        this.archetypeId = urlParams.get('id');
    }

    /**
     * Load archetype data from Supabase
     */
    async loadArchetypeData() {
        try {
            const { data, error } = await supabase
                .from('archetypes')
                .select(`
                    name,
                    description,
                    icon_url,
                    class:classes(name)
                `)
                .eq('id', this.archetypeId)
                .single();

            if (error) {
                console.error('Error loading archetype:', error);
                this.showError('Không thể tải thông tin archetype');
                return;
            }

            this.archetypeData = data;
            this.renderArchetypeInfo();

        } catch (error) {
            console.error('Error loading archetype:', error);
            this.showError('Lỗi kết nối');
        }
    }

    /**
     * Render archetype information
     */
    renderArchetypeInfo() {
        if (!this.archetypeData) return;

        // Update hero section - kept static for consistent layout

        // Update overview section
        const iconEmoji = this.getArchetypeIcon(this.archetypeData.name);
        document.getElementById('archetypeIcon').textContent = iconEmoji;
        document.getElementById('archetypeName').textContent = this.archetypeData.name;
        document.getElementById('archetypeDetailDescription').textContent =
            this.archetypeData.description || 'Chưa có mô tả chi tiết';
        document.getElementById('archetypeClass').textContent =
            `Thuộc lớp: ${this.archetypeData.class?.name || 'Unknown'}`;
    }

    /**
     * Load operators for this archetype
     */
    async loadArchetypeOperators() {
        try {
            this.showLoading();

            const { data, error } = await supabase
                .from('operators')
                .select(`
                    id,
                    name,
                    avatar_url,
                    rarity:rarities(label),
                    class:classes(id, name),
                    archetype:archetypes(id, name)
                `)
                .eq('archetype_id', this.archetypeId)
                .order('rarity_id', { ascending: false });

            if (error) {
                console.error('Error loading archetype operators:', error);
                this.showError('Không thể tải danh sách operators');
                return;
            }

            this.renderArchetypeOperators(data || []);

        } catch (error) {
            console.error('Error loading archetype operators:', error);
            this.showError('Lỗi kết nối');
        }
    }

    /**
     * Render operators grid for this archetype
     */
    renderArchetypeOperators(operators) {
        if (!this.operatorsGrid) return;

        if (operators.length === 0) {
            this.operatorsGrid.innerHTML = '<div class="no-results">Chưa có operators nào trong archetype này.</div>';
            return;
        }

        const operatorsHTML = operators.map((operator, index) => {
            const rarityStars = operator.rarity?.label ? operator.rarity.label.repeat('★') : '★★★★★★';
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
     * Show operator detail modal
     */
    async showOperatorModal(operatorId) {
        // TODO: Implement operator modal for archetype page
        // For now, navigate to operator page with modal
        window.location.href = `operator.html?modal=${operatorId}`;
    }

    /**
     * Get emoji icon for archetype
     * @param {string} archetypeName - The archetype name
     * @returns {string} Emoji icon
     */
    getArchetypeIcon(archetypeName) {
        // This is a placeholder - you might want to store icons in the database
        const iconMap = {
            'Pioneer': '🚀',
            'Charger': '💪',
            'Standard': '⚔️',
            'Lord': '👑',
            'Arts Fighter': '🔮',
            'Dreadnought': '🛡️',
            'Fighter': '🥊',
            'Swordmaster': '⚔️',
            'Musha': '🎌',
            'Liberator': '🆓',
            'Spearman': '🔱',
            'Flinger': '🏹',
            'Marksman': '🎯',
            'Heavyshooter': '💥',
            'Deadeye': '👁️',
            'Fastshot': '⚡',
            'Blast Caster': '💣',
            'Splash Caster': '💦',
            'Mystic Caster': '🌟',
            'Chain Caster': '⛓️',
            'Splash Caster': '💦',
            'Fortress': '🏰',
            'Warden': '🛡️',
            'Sentinel': '👁️',
            'Durable': '💪',
            'Arts Protector': '🛡️',
            'Hexer': '🧙',
            'Summoner': '🧚',
            'Underminer': '⛏️',
            'Primal Caster': '🌿',
            'Bard': '🎵',
            'Abjurer': '✋',
            'Decel Binder': '🕸️',
            'Splash Caster': '💦',
            'Medic': '💊',
            'Multi-target': '🎯',
            'Therapist': '🏥',
            'Wandering': '🏃',
            'Fortress': '🏰',
            'Durable': '💪',
            'Standard': '⚔️',
            'Dreadnought': '🛡️',
            'Fighter': '🥊',
            'Lord': '👑',
            'Arts Fighter': '🔮',
            'Charger': '💪',
            'Pioneer': '🚀',
            'Tactician': '🧠',
            'Executor': '⚔️',
            'Merchant': '💰',
            'Dreadnought': '🛡️',
            'Lord': '👑',
            'Splash Caster': '💦',
            'Chain Caster': '⛓️',
            'Blast Caster': '💣',
            'Mystic Caster': '🌟',
            'Core Caster': '🔮',
            'Primal Caster': '🌿',
            'Hexer': '🧙',
            'Summoner': '🧚',
            'Underminer': '⛏️',
            'Bard': '🎵',
            'Abjurer': '✋',
            'Decel Binder': '🕸️',
            'Flinger': '🏹',
            'Marksman': '🎯',
            'Heavyshooter': '💥',
            'Deadeye': '👁️',
            'Fastshot': '⚡',
            'Artificer': '🔧',
            'Flinger': '🏹',
            'Splash Caster': '💦',
            'Chain Caster': '⛓️',
            'Blast Caster': '💣',
            'Mystic Caster': '🌟',
            'Core Caster': '🔮',
            'Primal Caster': '🌿',
            'Hexer': '🧙',
            'Summoner': '🧚',
            'Underminer': '⛏️',
            'Bard': '🎵',
            'Abjurer': '✋',
            'Decel Binder': '🕸️'
        };
        return iconMap[archetypeName] || '❓';
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
        // Update hero content for error
        document.getElementById('archetypeTitle').textContent = 'Lỗi';
        document.getElementById('archetypeDescription').textContent = message;

        if (this.operatorsGrid) {
            this.operatorsGrid.innerHTML = `
                <div class="error-message">
                    <p>${message}</p>
                    <button onclick="window.history.back()">Quay lại</button>
                </div>
            `;
        }
    }

    /**
     * Destroy the manager and clean up event listeners
     */
    destroy() {
        console.log('ArchetypeManager destroyed');
    }
}