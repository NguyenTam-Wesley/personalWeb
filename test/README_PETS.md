# 🐾 Pet Test Pages

Collection of different pet implementations for testing and comparison.

## 📁 Available Pet Pages

### 🎮 `test_pet.html` - Multi-Pet System
**Features:**
- 🐱 **Cat (Sprite)**: Traditional sprite-based animation using GSAP
- 🎮 **Pixel Pet**: Canvas-rendered 8x8 pixel art with real-time animation
- 🎬 **GIF Pet**: FSM-controlled GIF animation system

**Controls:**
- Dropdown selector to switch between pet types
- All pets share the same movement and interaction logic
- Unified UI with real-time stats

---

### 🎬 `test_pet_gif.html` - FSM GIF Pet (Standalone)
**Features:**
- Finite State Machine (FSM) with IDLE → WALK → RUN states
- Speed-based state transitions with hysteresis
- Smooth acceleration/deceleration
- Advanced movement controls (follow mouse, auto mode, etc.)
- Debug UI with real-time monitoring

**FSM Logic:**
```javascript
if (speed < 0.05)      → IDLE
else if (speed < 0.8)  → WALK
else                   → RUN
```

---

### 🎯 `test_3_states.html` - 3 States Demonstration
**Purpose:** Demonstrate the 3 core FSM states simply

**Features:**
- 🟢 **IDLE**: `black_idle_8fps.gif` (speed = 0.00)
- 🟡 **WALK**: `black_walk_8fps.gif` (speed = 0.40)
- 🔴 **RUN**: `black_run_8fps.gif` (speed = 1.20)
- 🧗 **WALLCLIMB**: `black_wallclimb_8fps.gif` (speed = 0.20, edge trigger)
- 👋 **SWIPE**: `black_swipe_8fps.gif` (speed = 0.80, manual/random)
- Visual state indicators with colors
- Speed bar visualization
- Debug information panel
- Keyboard shortcuts (1/I, 2/W, 3/R)
- Click animation effects

**FSM Logic Preview:**
```javascript
if (speed < 0.05)      → IDLE
else if (speed < 0.8)  → WALK
else                   → RUN
// + WALLCLIMB & SWIPE (special triggers)
```

---

### 🎲 `test_random_states.html` - Random States on Screen
**Purpose:** Pet randomly switches between 3 states while moving around

**Features:**
- **Auto Mode**: Random state changes every 3-8 seconds
- **Manual Mode**: Click pet to manually change states
- **Movement**: Pet moves to random positions on screen
- **Visual Effects**: Particles, floating text, state indicators
- **Live Stats**: Real-time position, speed, state tracking
- **Debug Console**: Detailed logging of all state changes
- **Dual Controls**: Buttons + Keyboard shortcuts

**Random Logic:**
```javascript
// State changes every 3-8 seconds
setInterval(() => {
    const randomState = getRandomState(); // IDLE/WALK/RUN
    setState(randomState);
    // 70% chance to move when changing state
}, Math.random() * 5000 + 3000);
```

---

## 📁 File Organization

### 📄 Separated Files (test_free_pet.*)
```
test/
├── test_free_pet.html      # HTML structure
├── test_free_pet.css       # Styling
├── test_free_pet.js        # Logic & functionality
└── pets/
    └── cat/
        ├── pet.json        # Manifest configuration
        ├── black_idle_8fps.gif
        ├── black_walk_8fps.gif
        ├── black_run_8fps.gif
        ├── black_wallclimb_8fps.gif
        └── black_swipe_8fps.gif
```

### 📄 pet.json Structure

```json
{
  "type": "gif",
  "size": { "w": 48, "h": 48 },
  "states": {
    "idle": "black_idle_8fps.gif",
    "walk": "black_walk_8fps.gif",
    "run": "black_run_8fps.gif"
  },
  "speeds": {
    "idle": 0,
    "walk": 0.5,
    "run": 1.2
  },
  "colors": {
    "idle": "#2ec4b6",
    "walk": "#ffff00",
    "run": "#ff4444"
  },
  "emojis": {
    "idle": "🟢",
    "walk": "🟡",
    "run": "🔴"
  }
}
```

### 🔁 Simplified State Management

```javascript
// Load manifest
const manifest = await fetch('pets/cat/pet.json').then(r => r.json());

// Set state - clean & simple
function setState(state) {
  petImg.src = `pets/cat/${manifest.states[state]}`;
  // That's it! No hardcoded paths
}
```

---

### 🏠 `test_area_footer_pet.html` - Website Footer Integration
**Purpose:** Demonstrate pet integration into website footer area

**Features:**
- **Component Integration**: Imports `Components` and `themeToggle` from project
- **Footer Pet**: Random state pet running in footer area (24px size)
- **Website Layout**: Header, main content, and footer with pet
- **Real-time UI**: State display panel showing current pet status
- **Click Interaction**: Click pet to manually change states
- **Auto Movement**: Pet moves within footer boundaries

**Integration Code:**
```javascript
// Import components
import { Components } from '../public/js/components/components.js';
import { themeToggle } from '../public/js/components/themeToggle.js';

// Initialize
const components = new Components();
components.init();
```

**Footer Pet Logic:**
- Random state changes every 4-9 seconds (slower for footer)
- Movement within footer area boundaries
- Click interaction with particle effects
- State-based visual feedback

---

### 🌌 `test_free_pet.html` - Free Fullscreen Movement (Manifest-based)
**Purpose:** Pet moves freely across entire screen using manifest configuration

**Features:**
- **📄 Manifest-driven**: Uses `pets/cat/pet.json` for configuration
- **🏗️ Clean Architecture**: States, speeds, colors defined in JSON
- **🔄 Simple State Changes**: Just `petImg.src = basePath + manifest.states[state]`
- **Fullscreen Movement**: Pet can move anywhere on screen
- **Wrap/Bounce Modes**: Multiple boundary handling options
- **Wall Climbing**: Auto-triggered when hitting screen edges

**Movement Logic:**
```javascript
// Screen wrapping
if (petX < -24) petX = window.innerWidth;
if (petX > window.innerWidth) petX = -24;

// Bounce physics
if (bounceMode && (petX <= 0 || petX >= window.innerWidth - 48)) {
    velocityX *= -0.8; // Energy loss
}
```

**Control Modes:**
- **Auto**: Random states + random movement
- **Manual**: Click pet to change states
- **Click Move**: Click anywhere to move pet there
- **Teleport**: Instant random repositioning

---

### 🧪 `test_gif_only.html` - GIF Loading Test
**Purpose:** Test GIF file loading and paths

**Features:**
- Tests both local (test/) and remote (pet/) GIF paths
- Visual status indicators
- Console debugging
- Comprehensive loading verification

---

## 🎯 GIF Files Used

Located in `test/` directory:
- `black_idle_8fps.gif` - Idle animation
- `black_walk_8fps.gif` - Walking animation
- `black_run_8fps.gif` - Running animation

Source: `pet/cat_black_gif/`

---

## 🚀 Quick Start

1. **Multi-pet test:** Open `test_pet.html`
2. **FSM demo:** Open `test_pet_gif.html`
3. **Verify GIFs:** Open `test_gif_only.html`

All pages work offline and include comprehensive debugging tools.

---

## 🛠️ Technical Notes

- **Web Standards:** All implementations use standard HTML/CSS/JS
- **No External Dependencies:** GSAP is the only library used (optional)
- **Responsive:** Works on different screen sizes
- **Debug Friendly:** Extensive console logging and visual feedback

---

## 📏 Size Scaling Notes

**All pets have been scaled down to 20% of original size** for better screen fit and performance:

- **Original**: 128px-200px pets
- **Scaled**: 25.6px-40px pets (20% reduction)
- **Effects**: Floating text, particles, and boundaries scaled proportionally

---

*Generated for pet system testing and development.*