# 🐾 Pet Component - Official Integration Guide

Official pet system component for website integration with complete API and customization options.

## 📦 Installation

### Files Required
```
public/
├── js/components/
│   ├── components.js    # ✅ Updated with pet integration
│   └── pet.js          # 🆕 NEW: Pet component class
├── style/
│   └── components.css   # ✅ Updated with pet styles
└── pets/
    └── cat_black_gif/   # 🆕 NEW: Pet assets
        ├── pet.json     # 📋 Manifest configuration
        └── *.gif        # 🎬 Animation assets
```

### Dependencies
- ✅ **GSAP** (already included in project)
- ✅ **Components system** (existing)

---

## 🚀 Quick Start

### Basic Integration
```javascript
import { Components } from './js/components/components.js';

const components = new Components();
components.init();

// Add pet to page
components.initPet();
```

### Advanced Configuration
```javascript
components.initPet({
    container: document.body,        // Parent element
    size: 'large',                   // small, medium, large
    theme: 'dark',                   // default, dark, light
    position: { x: 200, y: 300 },   // Initial position
    autoStart: true,                 // Start immediately
    showControls: true,              // Show control panel
    showDebug: true,                 // Show debug panel
    boundaryMode: 'bounce',          // wrap, bounce, none
    persistence: true                // Save state/position
});
```

---

## 🎮 API Reference

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `container` | Element | `document.body` | Parent element to attach pet |
| `size` | String | `'medium'` | Pet size (small/medium/large) |
| `theme` | String | `'default'` | Visual theme |
| `position` | Object | `{x: 100, y: 200}` | Initial position |
| `autoStart` | Boolean | `true` | Auto-start pet system |
| `showControls` | Boolean | `false` | Show control panel |
| `showDebug` | Boolean | `false` | Show debug panel |
| `boundaryMode` | String | `'wrap'` | Screen boundary behavior |
| `persistence` | Boolean | `true` | Save/load state |

### Public Methods

#### `setState(state)`
Set pet to specific state
```javascript
pet.setState(pet.states.RUN);  // Set to RUN state
pet.setState(pet.states.IDLE); // Set to IDLE state
```

#### `setSize(size)`
Change pet size dynamically
```javascript
pet.setSize('large');  // 64px
pet.setSize('medium'); // 48px
pet.setSize('small');  // 32px
```

#### `setTheme(theme)`
Change visual theme
```javascript
pet.setTheme('dark');
pet.setTheme('light');
```

#### `getState()`
Get current pet state
```javascript
const currentState = pet.getState();
// Returns: { name: 'idle', speed: 0, ... }
```

#### `getPosition()`
Get current position
```javascript
const pos = pet.getPosition();
// Returns: { x: 150, y: 200 }
```

#### `destroy()`
Remove pet component
```javascript
pet.destroy(); // Cleanup and remove
```

---

## 🎯 States & Behavior

### Available States
- **🟢 IDLE**: Standing still (speed: 0)
- **🟡 WALK**: Slow movement (speed: 0.5)
- **🔴 RUN**: Fast movement (speed: 1.2)
- **🧗 WALLCLIMB**: Edge climbing (speed: 0.2)
- **👋 SWIPE**: Special animation (speed: 0.8)

### Movement System
- **Click-to-Move**: Click anywhere to move pet
- **Auto-Random**: Random position changes
- **Boundary Handling**: Wrap/bounce/none modes
- **Smooth Animation**: GSAP-powered transitions

### Interaction
- **Pet Click**: Change to random state
- **Visual Feedback**: Particles and floating text
- **State Transitions**: Automatic based on movement

---

## 🎨 Customization

### Size Options
```javascript
// In manifest (pet.json)
"size": {
  "w": 48,
  "h": 48
}

// Or via API
pet.setSize('large'); // 64px
```

### Theme System
```javascript
// Future implementation
pet.setTheme('dark');   // Dark mode colors
pet.setTheme('light');  // Light mode colors
pet.setTheme('custom'); // Custom color scheme
```

### Position Control
```javascript
// Manual positioning
pet.position = { x: 300, y: 400 };
pet.updatePosition();

// Auto-positioning
pet.moveToRandomPosition();
```

---

## 🔧 Configuration (pet.json)

```json
{
  "type": "gif",
  "size": {
    "w": 48,
    "h": 48
  },
  "states": {
    "idle": "black_idle_8fps.gif",
    "walk": "black_walk_8fps.gif",
    "run": "black_run_8fps.gif",
    "wallclimb": "black_wallclimb_8fps.gif",
    "swipe": "black_swipe_8fps.gif"
  },
  "speeds": {
    "idle": 0,
    "walk": 0.5,
    "run": 1.2,
    "wallclimb": 0.2,
    "swipe": 0.8
  },
  "colors": {
    "idle": "#2ec4b6",
    "walk": "#ffff00",
    "run": "#ff4444",
    "wallclimb": "#9b59b6",
    "swipe": "#f39c12"
  },
  "emojis": {
    "idle": "🟢",
    "walk": "🟡",
    "run": "🔴",
    "wallclimb": "🧗",
    "swipe": "👋"
  }
}
```

---

## 🎮 Demo & Testing

### Demo Page
- **File**: `public/pet_demo.html`
- **Features**: Full pet integration demo
- **Controls**: Toggle panels, test features

### Test Commands
```javascript
// Open browser console on demo page
pet.setState(pet.states.RUN);     // Force RUN state
pet.moveToRandomPosition();       // Random movement
pet.setSize('large');             // Change size
pet.destroy();                    // Remove pet
```

### Debug Tools
```javascript
pet.getState();       // Current state info
pet.getPosition();    // Current position
window.petComponent;  // Global reference
```

---

## 🔄 Page Integration Examples

### Homepage (Minimal)
```javascript
// Add subtle pet to homepage
components.initPet({
    position: { x: window.innerWidth - 120, y: window.innerHeight - 120 },
    showControls: false,
    showDebug: false,
    autoStart: true
});
```

### Game Pages (Interactive)
```javascript
// Full-featured pet for game pages
components.initPet({
    size: 'large',
    showControls: true,
    showDebug: true,
    boundaryMode: 'bounce'
});
```

### Profile Page (Customizable)
```javascript
// User-customizable pet
const userPrefs = getUserPetPreferences();
components.initPet({
    size: userPrefs.size,
    theme: userPrefs.theme,
    position: userPrefs.position,
    ...userPrefs
});
```

---

## 🛠️ Development

### Adding New States
1. Add to `pet.json` manifest
2. Add GIF file to assets folder
3. Update color/speed configuration
4. Test via demo page

### Custom Behaviors
```javascript
// Extend Pet class
class CustomPet extends Pet {
    customBehavior() {
        // Add custom logic
    }
}
```

### Performance Optimization
- **Lazy Loading**: Load assets on demand
- **Frame Rate**: Limit animation updates
- **Memory Management**: Cleanup unused resources

---

## 🐛 Troubleshooting

### Pet Not Appearing
```javascript
// Check console for errors
console.log('Pet initialized:', window.petComponent);

// Verify assets exist
fetch('pets/cat/pet.json').then(r => console.log('Manifest OK'));
```

### Movement Issues
```javascript
// Check boundary mode
console.log('Boundary mode:', pet.options.boundaryMode);

// Test manual movement
pet.moveToRandomPosition();
```

### State Problems
```javascript
// Check available states
console.log('Available states:', Object.keys(pet.states));

// Force state change
pet.setState(pet.states.IDLE);
```

---

## 📈 Future Roadmap

### Phase 2 (Advanced Features)
- [ ] Multiple pet types
- [ ] Achievement system
- [ ] XP and leveling
- [ ] Custom animations

### Phase 3 (Social Features)
- [ ] Pet sharing
- [ ] Global leaderboards
- [ ] Pet breeding/evolution

### Phase 4 (Mobile Optimization)
- [ ] Touch controls
- [ ] Battery optimization
- [ ] Responsive scaling

---

## 📞 Support

**For issues and questions:**
- Check browser console for errors
- Test with `pet_demo.html`
- Verify asset paths exist
- Check component initialization

---

*Pet Component v1.0.0 - Official Website Integration*