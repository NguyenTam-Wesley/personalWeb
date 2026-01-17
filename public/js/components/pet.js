/**
 * Pet Component - Official pet system for website integration
 * @author Wesley Nguyen
 * @version 1.0.0
 */

export class Pet {
    constructor(options = {}) {
        // Default options
        this.options = {
            container: document.body,
            size: 'medium',                    // small, medium, large
            theme: 'default',                  // default, dark, light
            position: { x: 100, y: 200 },     // Initial position
            autoStart: true,                   // Start automatically
            showControls: false,               // Show control panel
            showDebug: false,                  // Show debug panel
            boundaryMode: 'wrap',              // wrap, bounce, none
            persistence: true,                 // Save position/state
            ...options
        };

        // Component state
        this.manifest = null;
        this.states = {};
        this.currentState = null;
        this.container = null;
        this.element = null;

        // Movement state
        this.position = { ...this.options.position };
        this.targetPosition = { ...this.position };
        this.isMoving = false;
        this.direction = 1;
        this.speed = 0;

        // System state
        this.isInitialized = false;
        this.isRunning = false;
        this.intervals = new Set();

        // UI elements
        this.controlsPanel = null;
        this.debugPanel = null;

        // Initialize
        this.init();
    }

    async init() {
        try {
            console.log('🐾 Initializing Pet Component...');

            // Load manifest
            await this.loadManifest();

            // Load saved state
            this.loadState();

            // Create UI
            this.createContainer();

            // Setup systems
            this.setupEventListeners();

            // Start if autoStart
            if (this.options.autoStart) {
                this.start();
            }

            this.isInitialized = true;
            console.log('✅ Pet Component initialized successfully');

        } catch (error) {
            console.error('❌ Failed to initialize Pet Component:', error);
        }
    }

    async loadManifest() {
        try {
                const response = await fetch('/pets/cat/pet.json');
            this.manifest = await response.json();

            // Build states from manifest
            Object.keys(this.manifest.states).forEach(stateName => {
                this.states[stateName.toUpperCase()] = {
                    name: stateName,
                    speed: this.manifest.speeds[stateName],
                    gif: this.manifest.states[stateName],
                    color: this.manifest.colors[stateName],
                    emoji: this.manifest.emojis[stateName]
                };
            });

            console.log('📄 Pet manifest loaded:', this.manifest);
        } catch (error) {
            console.error('❌ Failed to load pet manifest:', error);
            // Use fallback states
            this.states = {
                IDLE: { name: 'idle', speed: 0, gif: 'black_idle_8fps.gif', color: '#2ec4b6', emoji: '🟢' },
                WALK: { name: 'walk', speed: 0.5, gif: 'black_walk_8fps.gif', color: '#ffff00', emoji: '🟡' },
                RUN: { name: 'run', speed: 1.2, gif: 'black_run_8fps.gif', color: '#ff4444', emoji: '🔴' },
                WALLCLIMB: { name: 'wallclimb', speed: 0.2, gif: 'black_wallclimb_8fps.gif', color: '#9b59b6', emoji: '🧗' },
                SWIPE: { name: 'swipe', speed: 0.8, gif: 'black_swipe_8fps.gif', color: '#f39c12', emoji: '👋' }
            };
        }
    }

    createContainer() {
        // Create pet element
        this.element = document.createElement('img');
        this.element.id = 'pet-component';
        this.element.src = `pets/cat/${this.states.IDLE.gif}`;
        this.element.alt = 'Pet';
        this.element.style.position = 'fixed';
        this.element.style.zIndex = '1000';
        this.element.style.cursor = 'pointer';
        this.element.style.userSelect = 'none';
        this.element.style.pointerEvents = 'auto';

        // Set size based on options
        const sizes = { small: 32, medium: 48, large: 64 };
        const size = sizes[this.options.size] || 48;
        this.element.style.width = `${size}px`;
        this.element.style.height = `${size}px`;

        // Set initial position
        this.updatePosition();

        // Add to container
        this.options.container.appendChild(this.element);

        // Create UI panels if needed
        if (this.options.showControls) {
            this.createControlsPanel();
        }
        if (this.options.showDebug) {
            this.createDebugPanel();
        }
    }

    createControlsPanel() {
        this.controlsPanel = document.createElement('div');
        this.controlsPanel.id = 'pet-controls';
        this.controlsPanel.innerHTML = `
            <div style="position: fixed; top: 20px; right: 20px; background: rgba(0,0,0,0.8); padding: 10px; border-radius: 8px; z-index: 1001;">
                <h4 style="color: #2ec4b6; margin: 0 0 10px 0;">🐾 Pet Controls</h4>
                <button onclick="window.petComponent?.setState(window.petComponent.states.IDLE)">🟢 IDLE</button>
                <button onclick="window.petComponent?.setState(window.petComponent.states.WALK)">🟡 WALK</button>
                <button onclick="window.petComponent?.setState(window.petComponent.states.RUN)">🔴 RUN</button>
                <button onclick="window.petComponent?.stop()">⏹️ STOP</button>
            </div>
        `;
        document.body.appendChild(this.controlsPanel);
    }

    createDebugPanel() {
        this.debugPanel = document.createElement('div');
        this.debugPanel.id = 'pet-debug';
        this.debugPanel.innerHTML = `
            <div style="position: fixed; bottom: 20px; left: 20px; background: rgba(0,0,0,0.8); padding: 10px; border-radius: 8px; z-index: 1001; font-size: 11px;">
                <h4 style="color: #2ec4b6; margin: 0 0 10px 0;">🔍 Debug</h4>
                <div>State: <span id="debug-state">IDLE</span></div>
                <div>Position: <span id="debug-pos">0, 0</span></div>
                <div>Speed: <span id="debug-speed">0</span></div>
            </div>
        `;
        document.body.appendChild(this.debugPanel);
    }

    setupEventListeners() {
        // Pet click
        this.element.addEventListener('click', (e) => {
            e.stopPropagation();
            this.randomState();
            this.createParticles(this.currentState.color);
        });

        // Click anywhere to move (if not clicking on pet)
        document.addEventListener('click', (e) => {
            if (e.target !== this.element && !this.element.contains(e.target)) {
                const rect = this.element.getBoundingClientRect();
                this.targetPosition.x = e.clientX - rect.width / 2;
                this.targetPosition.y = e.clientY - rect.height / 2;
                this.isMoving = true;
            }
        });
    }

    setState(state) {
        if (!state || this.currentState === state) return;

        this.currentState = state;
        this.speed = state.speed;

        this.element.src = `/pets/cat/${state.gif}`;

        // Update debug
        if (this.debugPanel) {
            this.debugPanel.querySelector('#debug-state').textContent = state.name.toUpperCase();
            this.debugPanel.querySelector('#debug-speed').textContent = this.speed.toFixed(2);
        }

        console.log(`🔄 Pet state: ${state.name} (speed: ${this.speed})`);
    }

    randomState() {
        const states = Object.values(this.states);
        const randomState = states[Math.floor(Math.random() * states.length)];
        this.setState(randomState);
    }

    updatePosition() {
        this.element.style.left = `${this.position.x}px`;
        this.element.style.top = `${this.position.y}px`;

        // Update debug
        if (this.debugPanel) {
            this.debugPanel.querySelector('#debug-pos').textContent =
                `${Math.round(this.position.x)}, ${Math.round(this.position.y)}`;
        }
    }

    start() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.setState(this.states.IDLE);

        // Start movement loop
        this.startMovementLoop();

        // Start auto-save
        if (this.options.persistence) {
            this.startAutoSave();
        }

        console.log('▶️ Pet component started');
    }

    stop() {
        this.isRunning = false;
        this.isMoving = false;

        // Clear intervals
        this.intervals.forEach(interval => clearInterval(interval));
        this.intervals.clear();

        console.log('⏹️ Pet component stopped');
    }

    startMovementLoop() {
        // Random state changes
        const stateInterval = setInterval(() => {
            if (this.isRunning && Math.random() < 0.3) { // 30% chance every 3 seconds
                this.randomState();

                // Sometimes move when changing state
                if (Math.random() < 0.6) {
                    this.moveToRandomPosition();
                }
            }
        }, 3000);

        this.intervals.add(stateInterval);

        // Movement update loop
        const moveLoop = () => {
            if (!this.isRunning) return;

            this.updateMovement();
            requestAnimationFrame(moveLoop);
        };
        moveLoop();
    }

    updateMovement() {
        if (!this.isMoving) return;

        const dx = this.targetPosition.x - this.position.x;
        const dy = this.targetPosition.y - this.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 3) {
            const moveSpeed = Math.min(this.speed * 2, distance);
            this.position.x += (dx / distance) * moveSpeed;
            this.position.y += (dy / distance) * moveSpeed;

            // Update direction
            this.direction = dx > 0 ? 1 : -1;
            this.element.style.transform = this.direction < 0 ? 'scaleX(-1)' : 'scaleX(1)';

            this.updatePosition();
        } else {
            this.isMoving = false;
        }
    }

    moveToRandomPosition() {
        const margin = 50;
        this.targetPosition.x = margin + Math.random() * (window.innerWidth - 100);
        this.targetPosition.y = margin + Math.random() * (window.innerHeight - 100);
        this.isMoving = true;
    }

    createParticles(color, count = 4) {
        for (let i = 0; i < count; i++) {
            const particle = document.createElement('div');
            particle.style.position = 'fixed';
            particle.style.left = `${this.position.x + 24 + Math.random() * 10 - 5}px`;
            particle.style.top = `${this.position.y + 24 + Math.random() * 10 - 5}px`;
            particle.style.width = '4px';
            particle.style.height = '4px';
            particle.style.background = color;
            particle.style.borderRadius = '50%';
            particle.style.pointerEvents = 'none';
            particle.style.zIndex = '999';

            document.body.appendChild(particle);

            // Animate and remove
            let opacity = 1;
            const fade = () => {
                opacity -= 0.05;
                particle.style.opacity = opacity;
                if (opacity > 0) {
                    requestAnimationFrame(fade);
                } else {
                    particle.remove();
                }
            };
            fade();
        }
    }

    // Public API methods
    destroy() {
        this.stop();

        if (this.element) {
            this.element.remove();
        }
        if (this.controlsPanel) {
            this.controlsPanel.remove();
        }
        if (this.debugPanel) {
            this.debugPanel.remove();
        }

        console.log('🗑️ Pet component destroyed');
    }

    getState() {
        return this.currentState;
    }

    getPosition() {
        return { ...this.position };
    }

    // Configuration methods
    setSize(size) {
        const sizes = { small: 32, medium: 48, large: 64 };
        const newSize = sizes[size] || 48;
        this.element.style.width = `${newSize}px`;
        this.element.style.height = `${newSize}px`;
    }

    setTheme(theme) {
        // Future: theme-specific styling
        console.log(`🎨 Pet theme set to: ${theme}`);
    }

    setBoundaryMode(mode) {
        this.options.boundaryMode = mode;
        console.log(`🔄 Boundary mode set to: ${mode}`);
    }

    // Enhanced persistence for cross-page navigation
    saveState() {
        if (!this.options.persistence) return;

        const state = {
            position: this.position,
            currentState: this.currentState?.name,
            options: this.options,
            timestamp: Date.now(),
            page: window.location.pathname
        };
        localStorage.setItem('petComponentState', JSON.stringify(state));
    }

    loadState() {
        if (!this.options.persistence) return;

        try {
            const saved = localStorage.getItem('petComponentState');
            if (saved) {
                const state = JSON.parse(saved);

                // Only load position if on the same page or within last 30 minutes
                const isRecent = (Date.now() - state.timestamp) < (30 * 60 * 1000); // 30 minutes
                const samePage = state.page === window.location.pathname;

                if (isRecent || samePage) {
                    this.position = state.position || this.position;

                    // Try to restore state if same page
                    if (samePage && state.currentState && this.states[state.currentState.toUpperCase()]) {
                        this.setState(this.states[state.currentState.toUpperCase()]);
                    }
                }

                console.log(`📥 Pet state loaded: ${samePage ? 'same page' : 'cross-page'}, position: (${this.position.x}, ${this.position.y})`);
            }
        } catch (error) {
            console.warn('Failed to load pet state:', error);
        }
    }

    // Auto-save state periodically
    startAutoSave() {
        setInterval(() => {
            this.saveState();
        }, 5000); // Save every 5 seconds
    }
}

// Global reference for controls
window.petComponent = null;