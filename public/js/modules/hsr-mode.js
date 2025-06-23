export class HsrModeManager {
    constructor() {
        this.teamCards = document.querySelectorAll('.team-card');
    }

    init() {
        if (this.teamCards.length > 0) {
            this.addHoverEffects();
        }
    }

    addHoverEffects() {
        this.teamCards.forEach(card => {
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-5px) scale(1.02)';
                card.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.25)';
            });

            card.addEventListener('mouseleave', () => {
                card.style.transform = 'translateY(0) scale(1)';
                card.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
            });
        });
    }
} 