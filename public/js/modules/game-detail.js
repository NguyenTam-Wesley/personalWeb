
export class GameDetailManager {
    constructor(gameId) {
        this.gameId = gameId;
        this.init();
    }


    async copyCode(button) {
        try {
            const codeElement = button.closest('.crosshair-code')?.querySelector('code');
            const tooltip = button.querySelector('.tooltip');
    
            const code = codeElement?.textContent.trim();
            if (!code) throw new Error('Không tìm thấy mã crosshair');
    
            await navigator.clipboard.writeText(code);
    
            // Thông báo thành công
            const originalText = button.textContent;
            button.textContent = 'Copied!';
            button.style.backgroundColor = '#28a745';
    
            // Tooltip (nếu có)
            if (tooltip) {
                tooltip.classList.add('show');
                setTimeout(() => {
                    tooltip.classList.remove('show');
                }, 2000);
            }
    
            this.showNotification?.('Crosshair code đã được copy!', 'success');
    
            setTimeout(() => {
                button.textContent = originalText;
                button.style.backgroundColor = '';
            }, 2000);
        } catch (error) {
            console.error('Lỗi khi copy code:', error);
            this.showNotification?.('Không thể copy code. Vui lòng thử lại!', 'error');
        }
    }
    


    init() {
        // Add event listeners for interactive elements
        this.setupEventListeners();

        // Initialize any game-specific features
        this.initializeGameFeatures();
    }

    setupEventListeners() {
        // Add click handlers for character cards
        const characterCards = document.querySelectorAll('.character-card');
        characterCards.forEach(card => {
            card.addEventListener('click', () => {
                this.handleCharacterClick(card);
            });
        });

        // Add click handlers for map cards if they exist
        const mapCards = document.querySelectorAll('.map-card');
        mapCards.forEach(card => {
            card.addEventListener('click', () => {
                this.handleMapClick(card);
            });
        });
    }

    initializeGameFeatures() {
        // Initialize game-specific features based on gameId
        switch(this.gameId) {
            case 'valorant':
                this.initializeValorantFeatures();
                break;
            case 'arknights':
                this.initializeArknightsFeatures();
                break;
            case 'hsr':
                this.initializeHSRFeatures();
                break;
            case 'endfield':
                this.initializeEndfieldFeatures();
                break;
            default:
                console.log(`No specific features for game: ${this.gameId}`);
                break;
        }
    }

    initializeValorantFeatures() {
    console.log('Initializing Valorant features');

    const copyButtons = document.querySelectorAll('.copy-button');
    copyButtons.forEach(button => {
        button.addEventListener('click', () => {
            this.copyCode(button);
        });        
    });
}


    initializeArknightsFeatures() {
        // Add Arknights-specific features
        console.log('Initializing Arknights features');
    }

    initializeHSRFeatures() {
        // Add HSR-specific features
        console.log('Initializing HSR features');
    }

    initializeEndfieldFeatures() {
        // Add Endfield-specific features
        console.log('Initializing Endfield features');
    }

    handleCharacterClick(card) {
        const characterName = card.querySelector('h3').textContent;
        console.log(`Character clicked: ${characterName}`);
        // Add character-specific interactions here
    }

    handleMapClick(card) {
        const mapName = card.dataset.map;
        console.log(`Map clicked: ${mapName}`);
        window.location.href = `/pages/games/valorant/map/${mapName.toLowerCase()}.html`;
    }
} 

// Have to be exported for entry point