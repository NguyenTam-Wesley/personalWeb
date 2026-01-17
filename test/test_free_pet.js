// Load pet manifest
let PET_MANIFEST = null;
let STATES = {};

// Initialize with fallback states first
STATES = {
    IDLE: { name: 'idle', speed: 0, gif: 'black_idle_8fps.gif', color: '#2ec4b6', emoji: '🟢' },
    WALK: { name: 'walk', speed: 0.5, gif: 'black_walk_8fps.gif', color: '#ffff00', emoji: '🟡' },
    RUN: { name: 'run', speed: 1.2, gif: 'black_run_8fps.gif', color: '#ff4444', emoji: '🔴' },
    WALLCLIMB: { name: 'wallclimb', speed: 0.2, gif: 'black_wallclimb_8fps.gif', color: '#9b59b6', emoji: '🧗' },
    SWIPE: { name: 'swipe', speed: 0.8, gif: 'black_swipe_8fps.gif', color: '#f39c12', emoji: '👋' }
};

let currentState = STATES.IDLE; // Now safe to initialize
let currentSpeed = 0;
let petX = window.innerWidth / 2;
let petY = window.innerHeight / 2;
let direction = 1;
let velocityX = 0;
let velocityY = 0;
let targetX = petX;
let targetY = petY;
let isMoving = false;
let autoMode = true;
let manualMode = false;
let changeCount = 0;
let autoInterval;
let movementInterval;
let wallClimbTimer = null;
let isWallClimbing = false;
let lastWallSide = null; // 'left' or 'right'

// Wrap/bounce settings
let wrapX = true;
let wrapY = false;
let bounceMode = false;

// DOM elements
const freePet = document.getElementById('free-pet');
const stateDot = document.getElementById('state-dot');
const stateText = document.getElementById('state-text');
const speedEl = document.getElementById('speed');
const changesEl = document.getElementById('changes');
const posXEl = document.getElementById('pos-x');
const posYEl = document.getElementById('pos-y');
const debugMode = document.getElementById('debug-mode');
const debugTarget = document.getElementById('debug-target');
const debugDirection = document.getElementById('debug-direction');
const screenSize = document.getElementById('screen-size');
const petCoords = document.getElementById('pet-coords');

async function loadPetManifest() {
    try {
        console.log('📥 Loading pet manifest from pets/cat/pet.json...');
        const response = await fetch('pets/cat/pet.json');
        PET_MANIFEST = await response.json();

        console.log('📄 Manifest loaded:', PET_MANIFEST);

        // Build STATES object from manifest
        STATES = {};
        Object.keys(PET_MANIFEST.states).forEach(stateName => {
            STATES[stateName.toUpperCase()] = {
                name: stateName,
                speed: PET_MANIFEST.speeds[stateName],
                gif: PET_MANIFEST.states[stateName],
                color: PET_MANIFEST.colors[stateName],
                emoji: PET_MANIFEST.emojis[stateName]
            };
        });

        console.log('✅ STATES object built:', STATES);
        console.log('✅ Pet manifest loaded successfully');
        return true;
    } catch (error) {
        console.error('❌ Failed to load pet manifest:', error);
        console.log('🔄 Using pre-initialized fallback states');
        return false;
    }
}

// Set pet state - Simplified manifest approach
function setState(newState) {
    // Critical check: ensure newState exists and has required properties
    if (!newState || !newState.name || !newState.gif) {
        console.error('❌ setState called with invalid state:', newState);
        console.error('🔍 Available states:', Object.keys(STATES));
        return;
    }

    if (currentState === newState) return;

    const oldState = currentState;
    currentState = newState;
    currentSpeed = newState.speed;

    console.log(`🔄 Setting state from ${oldState?.name || 'NONE'} to ${newState.name}`);

    // Update visual
    freePet.src = `pets/cat/${newState.gif}`;

    // Set filter based on state (inline styles)
    const filters = {
        idle: 'drop-shadow(0 0 20px rgba(46, 196, 182, 0.8))',
        walk: 'drop-shadow(0 0 20px rgba(255, 255, 0, 0.8))',
        run: 'drop-shadow(0 0 20px rgba(255, 68, 68, 0.8))',
        wallclimb: 'drop-shadow(0 0 20px rgba(155, 89, 182, 0.8))',
        swipe: 'drop-shadow(0 0 20px rgba(243, 156, 18, 0.8))'
    };

    freePet.style.filter = filters[newState.name] || 'drop-shadow(0 0 15px rgba(233, 69, 96, 0.6))';

    // Update UI
    stateDot.className = `state-dot ${newState.name}`;
    stateText.textContent = newState.name.toUpperCase();
    speedEl.textContent = currentSpeed.toFixed(2);
    changeCount++;
    changesEl.textContent = changeCount;

    // Create trail effect
    createTrail(newState.color);

    // Show floating text
    showFloatingText(`${newState.emoji} ${newState.name.toUpperCase()}`, petX + 24, petY - 20);

    console.log(`✅ State set successfully: ${newState.name} (Speed: ${currentSpeed})`);
}

// Random state selection
function getRandomState() {
    const states = Object.values(STATES);
    return states[Math.floor(Math.random() * states.length)];
}

// Force random state
function forceRandomState() {
    const randomState = getRandomState();
    setState(randomState);
    showFloatingText('🎲', petX + 24, petY - 20);
}

// Teleport to random position
function teleportRandom() {
    petX = Math.random() * window.innerWidth;
    petY = Math.random() * window.innerHeight;
    targetX = petX;
    targetY = petY;
    isMoving = false;

    freePet.style.left = petX + 'px';
    freePet.style.top = petY + 'px';

    createParticles(currentState.color, 8);
    showFloatingText('⚡ TELEPORT', petX + 24, petY - 20);

    console.log(`⚡ Teleported to: ${petX.toFixed(0)}, ${petY.toFixed(0)}`);
}

// Stop all movement
function stopMovement() {
    isMoving = false;
    velocityX = 0;
    velocityY = 0;
    targetX = petX;
    targetY = petY;

    // Clear any forced movement
    if (movementInterval) {
        clearInterval(movementInterval);
        movementInterval = null;
    }

    showFloatingText('⏹️', petX + 24, petY - 20);
}

// Auto mode
function startAutoMode() {
    autoMode = true;
    manualMode = false;

    document.getElementById('auto-btn').classList.add('active');
    document.getElementById('manual-btn').classList.remove('active');
    debugMode.textContent = 'AUTO';

    // Random state changes every 3-7 seconds
    autoInterval = setInterval(() => {
        if (autoMode) {
            const randomState = getRandomState();
            setState(randomState);

            // 80% chance to move to random position
            if (Math.random() < 0.8) {
                moveToRandomPosition();
            }
        }
    }, Math.random() * 4000 + 3000); // 3-7 seconds

    // Start movement cycle
    startMovementCycle();
}

function stopAutoMode() {
    autoMode = false;
    clearInterval(autoInterval);
    clearInterval(movementInterval);

    document.getElementById('auto-btn').classList.remove('active');
    debugMode.textContent = 'MANUAL';
}

// Manual mode
function toggleManualMode() {
    if (manualMode) {
        manualMode = false;
        document.getElementById('manual-btn').classList.remove('active');
    } else {
        stopAutoMode();
        manualMode = true;
        document.getElementById('manual-btn').classList.add('active');
        debugMode.textContent = 'MANUAL';
    }
}

function toggleAutoMode() {
    if (autoMode) {
        stopAutoMode();
    } else {
        startAutoMode();
    }
}

// Movement cycle - More frequent for better responsiveness
function startMovementCycle() {
    movementInterval = setInterval(() => {
        if (autoMode && !isMoving) {
            // Always try to move when not moving in auto mode
            moveToRandomPosition();
            console.log('🎯 Auto movement triggered');
        }
    }, Math.random() * 2000 + 500); // 0.5-2.5 seconds (very frequent)
}

// Move to random position
function moveToRandomPosition() {
    const oldX = petX;
    const oldY = petY;

    targetX = Math.random() * window.innerWidth;
    targetY = Math.random() * window.innerHeight;
    isMoving = true;

    debugTarget.textContent = `${targetX.toFixed(0)}, ${targetY.toFixed(0)}`;

    console.log(`🎯 New movement target set: (${oldX.toFixed(0)}, ${oldY.toFixed(0)}) → (${targetX.toFixed(0)}, ${targetY.toFixed(0)})`);
    console.log(`📊 Distance: ${Math.sqrt(Math.pow(targetX - oldX, 2) + Math.pow(targetY - oldY, 2)).toFixed(1)}px`);
}

// Wrap/bounce toggles
function toggleWrapX() {
    wrapX = document.getElementById('wrap-x').checked;
}

function toggleWrapY() {
    wrapY = document.getElementById('wrap-y').checked;
}

function toggleBounce() {
    bounceMode = document.getElementById('bounce').checked;
}

// Game loop
function gameLoop() {
    // Handle movement towards target
    console.log(`🎮 Game loop tick - isMoving: ${isMoving}, target: (${targetX?.toFixed(0)}, ${targetY?.toFixed(0)}), current: (${petX.toFixed(0)}, ${petY.toFixed(0)}), speed: ${currentSpeed}`);

    if (isMoving) {
        const dx = targetX - petX;
        const dy = targetY - petY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        console.log(`📏 Distance to target: ${distance.toFixed(1)}px`);

        if (distance > 3) { // Reduced threshold for smoother movement
            // Move towards target - increased speed multiplier
            const moveSpeed = Math.min(currentSpeed * 3, distance);
            const deltaX = (dx / distance) * moveSpeed;
            const deltaY = (dy / distance) * moveSpeed;

            petX += deltaX;
            petY += deltaY;

            console.log(`➡️ Moving by: (${deltaX.toFixed(2)}, ${deltaY.toFixed(2)}), new pos: (${petX.toFixed(0)}, ${petY.toFixed(0)})`);

            // Update direction
            direction = dx > 0 ? 1 : -1;
            freePet.style.transform = direction < 0 ? 'scaleX(-1)' : 'scaleX(1)';

            debugDirection.textContent = direction > 0 ? 'RIGHT' : 'LEFT';
        } else {
            isMoving = false;
            debugTarget.textContent = 'REACHED';
            debugDirection.textContent = 'NONE';
            console.log('✅ Target reached, stopping movement');
        }
    } else {
        console.log('⏸️ Not moving - waiting for movement trigger');
    }

    // Handle screen boundaries and wall climbing
    if (wrapX || wrapY || bounceMode) {
        let wrapped = false;

        if (wrapX) {
            if (petX < -24) {
                petX = window.innerWidth;
                wrapped = true;
            } else if (petX > window.innerWidth) {
                petX = -24;
                wrapped = true;
            }
        }

        if (wrapY) {
            if (petY < -24) {
                petY = window.innerHeight;
                wrapped = true;
            } else if (petY > window.innerHeight) {
                petY = -24;
                wrapped = true;
            }
        }

        if (bounceMode && !wrapped) {
            const petWidth = PET_MANIFEST?.size?.w || 48;
            const petHeight = PET_MANIFEST?.size?.h || 48;

            if (petX <= 0 || petX >= window.innerWidth - petWidth) {
                velocityX *= -0.8; // Bounce with energy loss
                petX = Math.max(0, Math.min(window.innerWidth - petWidth, petX));
            }
            if (petY <= 0 || petY >= window.innerHeight - petHeight) {
                velocityY *= -0.8;
                petY = Math.max(0, Math.min(window.innerHeight - petHeight, petY));
            }

            petX += velocityX;
            petY += velocityY;
        }
    }

    // Wall climbing detection (left/right edges only)
    if (!wrapX && !bounceMode && !isWallClimbing) {
        const petWidth = PET_MANIFEST?.size?.w || 48;
        const hitLeftEdge = petX <= 0;
        const hitRightEdge = petX >= window.innerWidth - petWidth;

        if ((hitLeftEdge || hitRightEdge) && Math.random() < 0.7) { // 70% chance
            // Determine which side
            const wallSide = hitLeftEdge ? 'left' : 'right';
            lastWallSide = wallSide;

            // Random duration 3-6 seconds
            const climbDuration = Math.random() * 3000 + 3000; // 3-6 seconds

            // Start wall climbing
            isWallClimbing = true;
            setState(STATES.WALLCLIMB);

            // Stop current movement
            isMoving = false;
            velocityX = 0;
            velocityY = 0;

            // Position pet against the wall
            if (wallSide === 'left') {
                petX = 0;
                direction = 1; // Face right
            } else {
                petX = window.innerWidth - petWidth;
                direction = -1; // Face left
            }
            freePet.style.transform = direction < 0 ? 'scaleX(-1)' : 'scaleX(1)';

            showFloatingText(`🧗 CLIMBING ${wallSide.toUpperCase()}`, petX + 24, petY - 20);

            // Stop climbing after duration
            wallClimbTimer = setTimeout(() => {
                isWallClimbing = false;
                setState(getRandomState()); // Return to random state
                showFloatingText('✅ CLIMB COMPLETE', petX + 24, petY - 20);
            }, climbDuration);

            console.log(`🧗 Wall climbing triggered on ${wallSide} side for ${climbDuration.toFixed(0)}ms`);
        }
    }

    // Update position
    const newLeft = petX + 'px';
    const newTop = petY + 'px';

    freePet.style.left = newLeft;
    freePet.style.top = newTop;

    // Debug style application
    const computedLeft = getComputedStyle(freePet).left;
    const computedTop = getComputedStyle(freePet).top;

    console.log(`🎨 Style applied: left=${newLeft} (computed: ${computedLeft}), top=${newTop} (computed: ${computedTop})`);

    // Check if position actually changed
    const rect = freePet.getBoundingClientRect();
    console.log(`📐 Element position: left=${rect.left.toFixed(1)}, top=${rect.top.toFixed(1)}`);

    // Update debug info
    posXEl.textContent = Math.round(petX);
    posYEl.textContent = Math.round(petY);
    petCoords.textContent = `${Math.round(petX)}, ${Math.round(petY)}`;

    requestAnimationFrame(gameLoop);
}

// Create trail particles
function createTrail(color) {
    const trail = document.createElement('div');
    trail.className = 'particle-trail';
    trail.style.left = petX + 24 + 'px';
    trail.style.top = petY + 24 + 'px';
    trail.style.color = color;
    document.body.appendChild(trail);

    setTimeout(() => trail.remove(), 1000);
}

// Create particle effects
function createParticles(color, count = 6) {
    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle-trail';
        particle.style.left = (petX + 24 + Math.random() * 20 - 10) + 'px';
        particle.style.top = (petY + 24 + Math.random() * 20 - 10) + 'px';
        particle.style.color = color;
        particle.style.animationDelay = (Math.random() * 0.5) + 's';
        document.body.appendChild(particle);

        setTimeout(() => particle.remove(), 1500);
    }
}

// Floating text
function showFloatingText(text, x, y) {
    const floatingText = document.createElement('div');
    floatingText.className = 'floating-text';
    floatingText.textContent = text;
    floatingText.style.left = x + 'px';
    floatingText.style.top = y + 'px';
    floatingText.style.color = currentState.color;
    document.body.appendChild(floatingText);

    setTimeout(() => floatingText.remove(), 2000);
}

// Update screen size info
function updateScreenSize() {
    screenSize.textContent = `${window.innerWidth}x${window.innerHeight}`;
}

// Force continuous movement for testing
function forceContinuousMove() {
    if (movementInterval) clearInterval(movementInterval);

    // Force move every 2 seconds for 10 seconds
    let moveCount = 0;
    const maxMoves = 5;

    movementInterval = setInterval(() => {
        if (moveCount < maxMoves && !isMoving) {
            moveToRandomPosition();
            moveCount++;
            console.log(`🎯 Forced move ${moveCount}/${maxMoves}`);
        } else if (moveCount >= maxMoves) {
            clearInterval(movementInterval);
            console.log('✅ Force movement test completed');
            showFloatingText('✅ TEST DONE', petX + 24, petY - 20);
        }
    }, 2000);
}

// Trigger immediate movement (bypass all intervals)
function triggerImmediateMove() {
    console.log('⚡ TRIGGERING IMMEDIATE MOVEMENT');
    moveToRandomPosition();
    showFloatingText('⚡ NOW!', petX + 24, petY - 20);
}

// Force position update test
function forcePositionUpdate() {
    console.log('📍 FORCING POSITION UPDATE');

    // Try different positioning methods
    const testX = Math.random() * (window.innerWidth - 48);
    const testY = Math.random() * (window.innerHeight - 48);

    console.log(`Testing position: (${testX.toFixed(0)}, ${testY.toFixed(0)})`);

    // Method 1: Direct style
    freePet.style.left = testX + 'px';
    freePet.style.top = testY + 'px';

    // Method 2: Transform (as backup)
    freePet.style.transform = `translate(${testX - petX}px, ${testY - petY}px)`;

    // Update variables
    petX = testX;
    petY = testY;

    // Check result
    setTimeout(() => {
        const rect = freePet.getBoundingClientRect();
        console.log(`Result: element at (${rect.left.toFixed(1)}, ${rect.top.toFixed(1)})`);

        if (Math.abs(rect.left - testX) > 5 || Math.abs(rect.top - testY) > 5) {
            console.error('❌ Position mismatch! CSS positioning not working');
        } else {
            console.log('✅ Position updated successfully');
        }
    }, 100);

    showFloatingText('📍 TEST', testX + 24, testY - 20);
}

// Reload manifest manually
async function reloadManifest() {
    console.log('🔄 Reloading pet manifest...');
    const success = await loadPetManifest();
    if (success) {
        console.log('✅ Manifest reloaded successfully');
        showFloatingText('🔄 RELOADED', petX + 24, petY - 20);
    } else {
        console.error('❌ Manifest reload failed');
        showFloatingText('❌ FAILED', petX + 24, petY - 20);
    }
}

// Debug movement status
function debugMovementStatus() {
    console.log('🔍 === MOVEMENT DEBUG STATUS ===');
    console.log(`Auto Mode: ${autoMode}`);
    console.log(`Manual Mode: ${manualMode}`);
    console.log(`Is Moving: ${isMoving}`);
    console.log(`Current State: ${currentState?.name} (speed: ${currentSpeed})`);
    console.log(`Current Position: (${petX.toFixed(0)}, ${petY.toFixed(0)})`);
    console.log(`Target Position: (${targetX?.toFixed(0)}, ${targetY?.toFixed(0)})`);
    console.log(`Movement Interval: ${movementInterval ? 'ACTIVE' : 'NONE'}`);
    console.log(`Game Loop: RUNNING`);

    // Check DOM element
    const rect = freePet.getBoundingClientRect();
    console.log(`DOM Element: left=${rect.left.toFixed(1)}, top=${rect.top.toFixed(1)}`);
    console.log(`Computed Style: left=${getComputedStyle(freePet).left}, top=${getComputedStyle(freePet).top}`);
    console.log(`CSS Position: ${getComputedStyle(freePet).position}`);
    console.log(`CSS Z-index: ${getComputedStyle(freePet).zIndex}`);

    console.log('=====================================');

    showFloatingText('🔍 DEBUG', petX + 24, petY - 20);
}

// Initialize pet
async function initFreePet() {
    // Load manifest first
    const manifestLoaded = await loadPetManifest();

    if (!manifestLoaded) {
        console.error('❌ Failed to load pet manifest, using fallback');
    }

    console.log('📋 Available states:', Object.keys(STATES));
    console.log('🎯 STATES.IDLE:', STATES.IDLE);

    updateScreenSize();

    // Set all styles inline to avoid CSS conflicts
    freePet.style.position = 'fixed';
    freePet.style.width = '48px';
    freePet.style.height = '48px';
    freePet.style.cursor = 'pointer';
    freePet.style.pointerEvents = 'auto';
    freePet.style.zIndex = '1001';
    freePet.style.transition = 'transform 0.2s ease';
    freePet.style.filter = 'drop-shadow(0 0 15px rgba(233, 69, 96, 0.6))';

    freePet.style.left = petX + 'px';
    freePet.style.top = petY + 'px';

    // Ensure STATES.IDLE exists before calling setState
    console.log('🎯 About to call setState with STATES.IDLE:', STATES.IDLE);
    if (STATES.IDLE) {
        console.log('✅ Calling setState(STATES.IDLE)...');
        setState(STATES.IDLE);
        console.log('✅ Initial state set to IDLE successfully');
    } else {
        console.error('❌ STATES.IDLE is undefined, cannot set initial state');
        console.log('🔍 STATES object:', STATES);
        console.log('🔍 Object.keys(STATES):', Object.keys(STATES));
    }

    // Start auto mode
    startAutoMode();

    console.log('🎯 Free pet initialized - Fullscreen movement enabled');
}

// Event handlers
freePet.addEventListener('click', (e) => {
    e.stopPropagation();
    if (manualMode) {
        forceRandomState();
    } else {
        createParticles(currentState.color);
        showFloatingText('🐾', petX + 24, petY - 20);
    }
});

// Click anywhere to move
document.addEventListener('click', (e) => {
    if (e.target === freePet || e.target.closest('.control-panel') || e.target.closest('.wrap-mode')) return;

    const petWidth = PET_MANIFEST?.size?.w || 48;
    const petHeight = PET_MANIFEST?.size?.h || 48;
    targetX = e.clientX - petWidth/2; // Center on click
    targetY = e.clientY - petHeight/2;
    isMoving = true;

    debugTarget.textContent = `${targetX.toFixed(0)}, ${targetY.toFixed(0)}`;
    showFloatingText('📍', e.clientX, e.clientY);
});

// Window resize
window.addEventListener('resize', () => {
    updateScreenSize();
    // Ensure pet stays within bounds if needed
    const petWidth = PET_MANIFEST?.size?.w || 48;
    const petHeight = PET_MANIFEST?.size?.h || 48;
    petX = Math.max(0, Math.min(window.innerWidth - petWidth, petX));
    petY = Math.max(0, Math.min(window.innerHeight - petHeight, petY));
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    switch(e.key.toLowerCase()) {
        case 'a': toggleAutoMode(); break;
        case 'm': toggleManualMode(); break;
        case 'r': forceRandomState(); break;
        case 'c': clearDebug(); break;
        case 'v': moveToRandomPosition(); break; // V for move
        case 't': teleportRandom(); break;
        case 'f': forceContinuousMove(); break; // F for force
        case 'd': debugMovementStatus(); break; // D for debug
        case 'n': triggerImmediateMove(); break; // N for now
        case 'p': forcePositionUpdate(); break; // P for position
        case 'l': reloadManifest(); break; // L for reload
        case 's': stopMovement(); break;
    }
});

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 DOM Content Loaded - Initial STATES check:');
    console.log('STATES.IDLE exists:', !!STATES.IDLE);
    console.log('STATES.IDLE.name:', STATES.IDLE?.name);

    await initFreePet();
    gameLoop();
});

// Utility function for clearing debug (placeholder)
function clearDebug() {
    console.clear();
    console.log('🧹 Debug console cleared');
}