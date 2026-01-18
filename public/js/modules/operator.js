/**
 * OperatorManager class for handling Arknights operator page functionality
 */
export class OperatorManager {
    constructor() {
        this.operatorCards = null;
        this.recruitmentCard = null;
        this.classesGrid = null;
    }

    /**
     * Initialize the operator page functionality
     */
    init() {
        this.cacheElements();
        this.bindEvents();
        this.initializeOperatorCards();
        console.log('OperatorManager initialized');
    }

    /**
     * Cache DOM elements for performance
     */
    cacheElements() {
        this.operatorCards = document.querySelectorAll('.operator-card');
        this.recruitmentCard = document.querySelector('.recruitment-card');
        this.classesGrid = document.querySelector('.classes-grid');
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Bind click events for operator cards
        this.operatorCards.forEach(card => {
            const ctaButton = card.querySelector('.cta-button');
            if (ctaButton) {
                ctaButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleOperatorDetail(card);
                });
            }
        });

        // Bind recruitment functionality
        if (this.recruitmentCard) {
            const recruitButton = this.recruitmentCard.querySelector('.cta-button');
            if (recruitButton) {
                recruitButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleRecruitment();
                });
            }
        }

        // Bind class card hover effects
        if (this.classesGrid) {
            const classCards = this.classesGrid.querySelectorAll('.class-card');
            classCards.forEach(card => {
                card.addEventListener('mouseenter', () => this.handleClassHover(card, true));
                card.addEventListener('mouseleave', () => this.handleClassHover(card, false));
            });
        }
    }

    /**
     * Initialize operator cards with animations and interactions
     */
    initializeOperatorCards() {
        this.operatorCards.forEach((card, index) => {
            // Add staggered animation delay
            card.style.animationDelay = `${index * 0.1}s`;
            card.classList.add('animate-in');
        });
    }

    /**
     * Handle operator detail view
     * @param {HTMLElement} card - The operator card element
     */
    handleOperatorDetail(card) {
        const operatorName = card.querySelector('h3').textContent;
        console.log(`Viewing details for operator: ${operatorName}`);

        // TODO: Implement operator detail modal or navigation
        // For now, just show an alert
        alert(`Chi tiết của ${operatorName} sẽ được hiển thị tại đây!`);
    }

    /**
     * Handle recruitment functionality
     */
    handleRecruitment() {
        console.log('Starting recruitment process');

        // TODO: Implement recruitment system
        // For now, just show an alert
        alert('Hệ thống tuyển dụng sẽ được mở!');
    }

    /**
     * Handle class card hover effects
     * @param {HTMLElement} card - The class card element
     * @param {boolean} isHover - Whether mouse is hovering
     */
    handleClassHover(card, isHover) {
        if (isHover) {
            card.classList.add('hovered');
        } else {
            card.classList.remove('hovered');
        }
    }

    /**
     * Get operator data (placeholder for future API integration)
     * @param {string} operatorName - Name of the operator
     * @returns {Object} Operator data
     */
    getOperatorData(operatorName) {
        // TODO: Replace with actual API call or data structure
        const mockData = {
            'Amiya': {
                class: 'Caster',
                rarity: 6,
                dpCost: 18,
                redeployTime: 70
            },
            'SilverAsh': {
                class: 'Guard',
                rarity: 6,
                dpCost: 19,
                redeployTime: 70
            },
            'Exusiai': {
                class: 'Sniper',
                rarity: 6,
                dpCost: 21,
                redeployTime: 20
            }
        };

        return mockData[operatorName] || null;
    }

    /**
     * Destroy the manager and clean up event listeners
     */
    destroy() {
        // Remove event listeners
        this.operatorCards.forEach(card => {
            const ctaButton = card.querySelector('.cta-button');
            if (ctaButton) {
                ctaButton.removeEventListener('click', this.handleOperatorDetail);
            }
        });

        if (this.recruitmentCard) {
            const recruitButton = this.recruitmentCard.querySelector('.cta-button');
            if (recruitButton) {
                recruitButton.removeEventListener('click', this.handleRecruitment);
            }
        }

        if (this.classesGrid) {
            const classCards = this.classesGrid.querySelectorAll('.class-card');
            classCards.forEach(card => {
                card.removeEventListener('mouseenter', this.handleClassHover);
                card.removeEventListener('mouseleave', this.handleClassHover);
            });
        }

        console.log('OperatorManager destroyed');
    }
}