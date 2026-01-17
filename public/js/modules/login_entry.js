import components from "../components/components.js";
import { LoginManager } from "./login_manager.js";

// Initialize components
components.init();

// Initialize pet for login page (subtle presence)
components.initPet({
  container: document.body,
  size: 'small',
  theme: 'default',
  position: { x: window.innerWidth - 120, y: window.innerHeight - 120 },
  autoStart: true, // Still enable for login page
  showControls: false,
  showDebug: false,
  boundaryMode: 'wrap',
  persistence: true
});

// Initialize page specific functionality
new LoginManager();
