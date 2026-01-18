import components from '../components/components.js';

// NTAM UI Flow - Detailed Implementation
// Theme: tech · green · dark · chill · art
// Concept: "Một thực thể số thức tỉnh → dẫn dắt → nhập vai → lựa chọn"

// ================= MODE DETECTION SYSTEM =================
class ModeManager {
  constructor() {
    this.mode = this.detectMode();
    this.isReducedMotion = this.checkReducedMotion();
    this.devicePerformance = this.detectPerformance();
    this.setupModeChangeListener();
  }

  detectMode() {
    // Default: PC → CINEMATIC, Mobile → LITE
    const isMobile = window.innerWidth <= 768 ||
                    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // Override: prefers-reduced-motion → LITE
    if (this.checkReducedMotion()) {
      return 'LITE';
    }

    return isMobile ? 'LITE' : 'CINEMATIC';
  }

  checkReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  detectPerformance() {
    // Check for low-end devices
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const isSlowConnection = connection && (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g');

    // Check battery status if available
    const isLowBattery = 'getBattery' in navigator &&
      navigator.getBattery().then(battery => battery.level < 0.2 && !battery.charging);

    return {
      isLowEnd: isSlowConnection || isLowBattery,
      isMobile: window.innerWidth <= 768
    };
  }

  setupModeChangeListener() {
    // Listen for orientation changes
    window.addEventListener('resize', () => {
      const newMode = this.detectMode();
      if (newMode !== this.mode) {
        this.mode = newMode;
        this.onModeChange(newMode);
      }
    });

    // Listen for reduced motion preference changes
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
      this.isReducedMotion = e.matches;
      this.mode = this.detectMode();
      this.onModeChange(this.mode);
    });
  }

  onModeChange(newMode) {
    // Dispatch custom event for components to react
    window.dispatchEvent(new CustomEvent('modeChange', {
      detail: { mode: newMode, isReducedMotion: this.isReducedMotion }
    }));
  }

  getMode() {
    return this.mode;
  }

  isCinematic() {
    return this.mode === 'CINEMATIC' && !this.isReducedMotion;
  }

  isLite() {
    return this.mode === 'LITE' || this.isReducedMotion;
  }
}

// ================= STATE MANAGEMENT =================
class StateManager {
  constructor() {
    this.states = {
      idle: 'idle',        // Page chưa load
      awakening: 'awakening', // Hero xuất hiện
      flowing: 'flowing',     // User scroll
      immersion: 'immersion', // User chậm lại
      decision: 'decision'    // CTA
    };
    this.currentState = this.states.idle;
    this.stateTimeouts = new Map();
  }

  setState(newState, duration = 0) {
    // Clear previous timeout if exists
    if (this.stateTimeouts.has(this.currentState)) {
      clearTimeout(this.stateTimeouts.get(this.currentState));
      this.stateTimeouts.delete(this.currentState);
    }

    this.currentState = newState;

    // Dispatch state change event
    window.dispatchEvent(new CustomEvent('stateChange', {
      detail: { state: newState, previousState: this.currentState }
    }));

    // Auto-transition after duration if specified
    if (duration > 0) {
      const timeout = setTimeout(() => {
        this.setState(this.getNextState(newState));
      }, duration);
      this.stateTimeouts.set(newState, timeout);
    }
  }

  getCurrentState() {
    return this.currentState;
  }

  getNextState(currentState) {
    const flow = {
      [this.states.idle]: this.states.awakening,
      [this.states.awakening]: this.states.flowing,
      [this.states.flowing]: this.states.immersion,
      [this.states.immersion]: this.states.decision,
      [this.states.decision]: this.states.flowing
    };
    return flow[currentState] || this.states.idle;
  }

  transitionToAwakening() {
    this.setState(this.states.awakening, 3000); // 3s awakening
  }

  transitionToFlowing() {
    this.setState(this.states.flowing);
  }

  transitionToImmersion() {
    this.setState(this.states.immersion, 8000); // 8s immersion
  }

  transitionToDecision() {
    this.setState(this.states.decision);
  }
}

// Initialize managers
const modeManager = new ModeManager();
const stateManager = new StateManager();

// Page-specific pet configuration
const pageConfigs = {
  'index': {  // Homepage
    size: 'small',
    position: { x: window.innerWidth - 120, y: window.innerHeight - 120 },
    showControls: false,
    showDebug: false,
    boundaryMode: 'wrap',
    theme: 'default'
  },
  'games': {  // Games page
    size: 'medium',
    position: { x: window.innerWidth - 150, y: window.innerHeight - 150 },
    showControls: true,
    showDebug: false,
    boundaryMode: 'bounce',
    theme: 'dark'
  },
  'music': {  // Music page
    size: 'small',
    position: { x: 100, y: window.innerHeight - 120 },
    showControls: false,
    showDebug: false,
    boundaryMode: 'wrap',
    theme: 'default'
  }
};

// Get current page config
const currentPath = window.location.pathname;
const pageName = currentPath.split('/').pop().replace('.html', '') || 'index';
const pageConfig = pageConfigs[pageName] || pageConfigs['index'];

// Add pet with page-specific configuration
components.initPet({
  container: document.body,
  autoStart: true,
  persistence: true,
  ...pageConfig
});

// Home page specific functionality
class HomePage {
  constructor() {
    this.heroSection = document.querySelector('.hero');
    this.heroTitle = document.querySelector('.hero-title');
    this.heroSubtitle = document.querySelector('.hero-subtitle');
    this.scrollHint = document.querySelector('.scroll-hint');
    this.lightLayer = document.querySelector('.hero-light-layer');
    this.glowLayer = document.querySelector('.hero-glow-layer');

    // Additional elements
    this.introSection = document.querySelector('.intro');
    this.introLines = document.querySelectorAll('.intro-line');
    this.featuresSection = document.querySelector('.features');
    this.featureCards = document.querySelectorAll('.feature-card');
    this.immersionSection = document.querySelector('.immersion');
    this.immersionText = document.querySelector('.immersion-text');
    this.timelineSection = document.querySelector('.timeline');
    this.timelineItems = document.querySelectorAll('.timeline-item');
    this.ctaSection = document.querySelector('.cta-section');
    this.ctaButton = document.querySelector('.cta-button.primary');

    // Animation state
    this.mouseX = 0;
    this.mouseY = 0;
    this.lastScrollY = 0;
    this.scrollVelocity = 0;
    this.scrollTimeout = null;
    this.isInitialized = false;

    // Bind methods
    this.handleModeChange = this.handleModeChange.bind(this);
    this.handleStateChange = this.handleStateChange.bind(this);

    this.init();
  }

  init() {
    // Listen for mode and state changes
    window.addEventListener('modeChange', this.handleModeChange);
    window.addEventListener('stateChange', this.handleStateChange);

    // Start awakening flow
    this.startAwakeningFlow();

    // Setup interactions based on current mode
    this.setupModeBasedFeatures();

    // Setup scroll detection for state transitions
    this.setupScrollStateDetection();
  }

  handleModeChange(event) {
    const { mode } = event.detail;
    console.log(`Mode changed to: ${mode}`);
    // Re-setup features based on new mode
    this.setupModeBasedFeatures();
  }

  handleStateChange(event) {
    const { state } = event.detail;
    console.log(`State changed to: ${state}`);
    // Handle state-specific behaviors
    this.handleStateTransition(state);
  }

  startAwakeningFlow() {
    // DOMContentLoaded trigger - start awakening
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        stateManager.transitionToAwakening();
      });
    } else {
      stateManager.transitionToAwakening();
    }
  }

  handleStateTransition(state) {
    switch(state) {
      case 'awakening':
        this.playHeroAwakening();
        break;
      case 'flowing':
        this.enableScrollFlow();
        break;
      case 'immersion':
        this.playImmersionSequence();
        break;
      case 'decision':
        this.enableDecisionMode();
        break;
    }
  }

  setupModeBasedFeatures() {
    if (modeManager.isCinematic()) {
      this.setupCinematicFeatures();
    } else {
      this.setupLiteFeatures();
    }
  }

  setupScrollStateDetection() {
    let scrollTimeout;

    const handleScroll = () => {
      clearTimeout(scrollTimeout);

      // User is scrolling - transition to flowing
      if (stateManager.getCurrentState() === 'awakening') {
        stateManager.transitionToFlowing();
      }

      // Detect when user stops scrolling
      scrollTimeout = setTimeout(() => {
        const currentState = stateManager.getCurrentState();
        if (currentState === 'flowing') {
          stateManager.transitionToImmersion();
        }
      }, 150); // Wait 150ms after scroll stops
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
  }

  setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(anchor.getAttribute('href'));
        if (target) {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      });
    });
  }

  setupEnergyScroll() {
    let ticking = false;
    let currentSectionIndex = 0;

    const updateScrollEnergy = () => {
      const scrolled = window.pageYOffset;
      const windowHeight = window.innerHeight;
      const sections = document.querySelectorAll('section');

      // L2 - Mid Background: Parallax layers
      sections.forEach((section, index) => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.offsetHeight;
        const sectionCenter = sectionTop + sectionHeight / 2;
        const viewportCenter = scrolled + windowHeight / 2;

        // Distance from viewport center
        const distance = sectionCenter - viewportCenter;
        const normalizedDistance = distance / windowHeight;

        // Progressive parallax based on section depth
        const parallaxMultiplier = 0.05 + (index * 0.02); // Deeper sections move more
        const parallaxOffset = normalizedDistance * parallaxMultiplier * windowHeight;

        // Section transition effects (60% threshold)
        const transitionThreshold = sectionHeight * 0.6;
        const distanceFromView = Math.abs(distance);

        let opacity = 1;
        let blur = 0;
        let transform = `translateY(${parallaxOffset}px)`;

        if (distanceFromView < transitionThreshold) {
          // Section in transition zone
          const transitionProgress = distanceFromView / transitionThreshold;

          if (distance > 0) {
            // Section coming from bottom
            opacity = Math.max(0.6, 1 - transitionProgress * 0.4);
            blur = transitionProgress * 1.5;
            transform = `translateY(${parallaxOffset + transitionProgress * 20}px)`;
          } else {
            // Section going to top
            opacity = Math.max(0.7, 1 - transitionProgress * 0.3);
            blur = transitionProgress * 1;
            transform = `translateY(${parallaxOffset - transitionProgress * 15}px)`;
          }
        }

        // Apply with smooth transitions
        section.style.transform = transform;
        section.style.opacity = opacity;
        section.style.filter = `blur(${blur}px)`;
        section.style.transition = 'all 0.8s ease-out';
      });

      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateScrollEnergy);
        ticking = true;
      }
    }, { passive: true });
  }

  // Space glide methods removed - using parallax in setupEnergyScroll instead

  setupHeroScrollTransition() {
    let ticking = false;

    const updateHeroOnScroll = () => {
      const scrolled = window.pageYOffset;
      const windowHeight = window.innerHeight;

      // Space glide transition (0-30% of viewport height)
      const transitionProgress = Math.min(scrolled / (windowHeight * 0.3), 1);

      if (transitionProgress > 0) {
        // Hero section: gentle fade + subtle blur
        const heroFade = Math.max(0, 1 - transitionProgress * 0.7);
        const heroBlur = transitionProgress * 2;
        const heroOffset = transitionProgress * -5;

        this.heroSection.style.opacity = heroFade;
        this.heroSection.style.filter = `blur(${heroBlur}px)`;
        this.heroSection.style.transform = `translateY(${heroOffset}px)`;

        // Text elements: fade earlier
        const textFade = Math.max(0, 1 - transitionProgress * 1.2);
        this.heroTitle.style.opacity = textFade;
        this.heroSubtitle.style.opacity = textFade;
        this.scrollHint.style.opacity = textFade;

        // Intro section: rise up slowly (parallax effect)
        const intro = document.querySelector('.intro');
        if (intro) {
          const introOffset = Math.min(0, -40 + transitionProgress * 40);
          const introOpacity = Math.min(1, transitionProgress * 1.5);
          const introBlur = Math.max(0, 1 - transitionProgress) * 1;

          intro.style.transform = `translateY(${introOffset}px)`;
          intro.style.opacity = introOpacity;
          intro.style.filter = `blur(${introBlur}px)`;
        }
      } else {
        // Reset to initial state
        this.heroSection.style.opacity = '1';
        this.heroSection.style.filter = 'blur(0px)';
        this.heroSection.style.transform = 'translateY(0)';
        this.heroTitle.style.opacity = '1';
        this.heroSubtitle.style.opacity = '1';
        this.scrollHint.style.opacity = '1';

        const intro = document.querySelector('.intro');
        if (intro) {
          intro.style.transform = 'translateY(-40px)';
          intro.style.opacity = '0';
          intro.style.filter = 'blur(1px)';
        }
      }

      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateHeroOnScroll);
        ticking = true;
      }
    }, { passive: true });
  }

  setupTimelineReveal() {
    const timelineItems = document.querySelectorAll('.timeline-item');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal');
        }
      });
    }, {
      threshold: 0.3,
      rootMargin: '0px 0px -10px 0px'
    });

    timelineItems.forEach(item => observer.observe(item));
  }

  setupImmersionZone() {
    const immersion = document.querySelector('.immersion');

    // Subtle breathing effect when user stops scrolling
    let scrollTimeout;

    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);

      // Smooth scroll effect
      if (immersion) {
        immersion.style.transition = 'none';
      }

      scrollTimeout = setTimeout(() => {
        // Gentle breathing when stopped
        if (immersion) {
          immersion.style.transition = 'transform 4s ease-in-out';
          immersion.style.transform = 'scale(1.002)';
          setTimeout(() => {
            immersion.style.transform = 'scale(1)';
          }, 2000);
        }
      }, 200);
    });
  }


  setupCursorRecognition() {
    // Create cursor trail system
    this.cursorTrail = [];
    this.cursorPositions = [];
    this.maxTrailLength = 8;
    this.lerpFactor = 0.1;

    // Create trail dots
    for (let i = 0; i < this.maxTrailLength; i++) {
      const trailDot = document.createElement('div');
      trailDot.className = `cursor-trail trail-${i}`;
      trailDot.style.cssText = `
        position: fixed;
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: rgba(0, 255, 255, ${0.8 - i * 0.1});
        pointer-events: none;
        z-index: 9997;
        opacity: 0;
        transform: translate(-50%, -50%);
        filter: blur(${1 + i * 0.5}px);
        transition: opacity 0.8s ease-out;
      `;
      document.body.appendChild(trailDot);
      this.cursorTrail.push(trailDot);
      this.cursorPositions.push({ x: 0, y: 0, vx: 0, vy: 0 });
    }

    let lastMouseX = 0;
    let lastMouseY = 0;
    let lastTime = Date.now();
    let isMoving = false;
    let moveTimeout;

    // Track cursor position and create trail
    document.addEventListener('mousemove', (e) => {
      const currentTime = Date.now();
      const mouseX = e.clientX;
      const mouseY = e.clientY;
      const deltaTime = currentTime - lastTime;

      // Calculate velocity
      const velocity = Math.sqrt(
        Math.pow(mouseX - lastMouseX, 2) + Math.pow(mouseY - lastMouseY, 2)
      ) / Math.max(deltaTime, 1);

      this.mouseX = mouseX / window.innerWidth;
      this.mouseY = mouseY / window.innerHeight;

      // Update trail positions with lerp
      this.cursorPositions.unshift({
        x: mouseX,
        y: mouseY,
        vx: velocity,
        vy: velocity
      });

      if (this.cursorPositions.length > this.maxTrailLength) {
        this.cursorPositions.pop();
      }

      // Check if hovering over interactive elements for halo effect
      const interactiveElements = document.querySelectorAll('.feature-card');
      const ctaButton = document.querySelector('.cta-button.primary');
      const isHoveringInteractive = Array.from(interactiveElements).some(el => {
        const rect = el.getBoundingClientRect();
        return mouseX >= rect.left && mouseX <= rect.right &&
               mouseY >= rect.top && mouseY <= rect.bottom;
      });
      const isHoveringCTA = ctaButton && (() => {
        const rect = ctaButton.getBoundingClientRect();
        return mouseX >= rect.left && mouseX <= rect.right &&
               mouseY >= rect.top && mouseY <= rect.bottom;
      })();

      // Update trail dots with special CTA effect
      this.cursorTrail.forEach((dot, index) => {
        if (this.cursorPositions[index]) {
          const pos = this.cursorPositions[index];
          const trailOpacity = Math.max(0, (this.maxTrailLength - index) / this.maxTrailLength * 0.6);
          const speedMultiplier = Math.min(pos.vx / 50, 1);
          const interactiveBonus = isHoveringInteractive ? 0.3 : 0;

          let finalOpacity, finalScale, specialEffect = false;

          if (isHoveringCTA) {
            // CTA hover: condense trail into single bright point
            if (index === 0) {
              finalOpacity = 1;
              finalScale = 1.5;
              specialEffect = true;
            } else {
              finalOpacity = 0;
              finalScale = 0;
            }
          } else {
            finalOpacity = Math.min(1, trailOpacity * (0.3 + speedMultiplier * 0.7) + interactiveBonus);
            finalScale = 0.5 + speedMultiplier * 0.5 + interactiveBonus * 0.5;
          }

          dot.style.left = `${pos.x}px`;
          dot.style.top = `${pos.y}px`;
          dot.style.opacity = finalOpacity;
          dot.style.transform = `translate(-50%, -50%) scale(${finalScale})`;

          // Special effects
          if (specialEffect) {
            dot.style.boxShadow = '0 0 15px rgba(0, 255, 255, 0.8), 0 0 30px rgba(0, 255, 255, 0.4)';
            dot.style.background = 'rgba(0, 255, 255, 1)';
          } else if (isHoveringInteractive && index === 0) {
            dot.style.boxShadow = '0 0 8px rgba(0, 255, 255, 0.4)';
            dot.style.background = 'rgba(0, 255, 255, 0.9)';
          } else {
            dot.style.boxShadow = 'none';
            dot.style.background = 'rgba(0, 255, 255, 0.8)';
          }
        } else {
          dot.style.opacity = '0';
        }
      });

      // Handle movement state
      if (velocity > 1) {
        isMoving = true;
        clearTimeout(moveTimeout);
        moveTimeout = setTimeout(() => {
          isMoving = false;
        }, 100);
      }

      lastMouseX = mouseX;
      lastMouseY = mouseY;
      lastTime = currentTime;

      // Light layer follows cursor subtly - reduced intensity
      if (this.lightLayer) {
        const offsetX = (this.mouseX - 0.5) * 15;
        const offsetY = (this.mouseY - 0.5) * 12;
        this.lightLayer.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
      }

      // Glow layer - very subtle ambient response
      if (this.glowLayer) {
        const distanceFromCenter = Math.sqrt(
          Math.pow(this.mouseX - 0.5, 2) + Math.pow(this.mouseY - 0.5, 2)
        );
        const ambientIntensity = Math.max(0, 1 - distanceFromCenter * 3) * 0.01;
        this.glowLayer.style.opacity = 0.02 + ambientIntensity;
      }

      // Background parallax - very subtle
      const parallaxX = (mouseX - window.innerWidth / 2) * 0.005;
      const parallaxY = (mouseY - window.innerHeight / 2) * 0.005;

      document.querySelector('.hero-background').style.transform =
        `translate(${parallaxX}px, ${parallaxY}px)`;
    });

    // Fade trail when mouse leaves
    document.addEventListener('mouseleave', () => {
      this.cursorTrail.forEach(dot => {
        dot.style.opacity = '0';
      });
    });
  }

  setupLivingFeatures() {
    const featureCards = document.querySelectorAll('.feature-card');

    featureCards.forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const mouseX = e.clientX - centerX;
        const mouseY = e.clientY - centerY;

        // Calculate rotation based on mouse position - more responsive
        const rotateX = (mouseY / (rect.height / 2)) * -10; // Max 10deg for more tilt
        const rotateY = (mouseX / (rect.width / 2)) * 10;   // Max 10deg for more tilt

        // Calculate shadow offset based on mouse position - dynamic shadow casting
        const shadowX = (mouseX / rect.width) * 25;
        const shadowY = (mouseY / rect.height) * 25;

        // Apply 3D transform with more pronounced effect
        card.style.transform = `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(15px)`;

        // Dynamic shadow with multiple layers for depth
        card.style.boxShadow = `
          ${shadowX}px ${shadowY}px 50px rgba(0, 255, 255, 0.25),
          0 0 80px rgba(0, 255, 255, 0.15),
          inset 0 0 30px rgba(0, 255, 255, 0.05)
        `;

        // Focused glow follows cursor precisely
        const glowX = ((mouseX / rect.width) * 100) + 50; // Center offset
        const glowY = ((mouseY / rect.height) * 100) + 50; // Center offset
        card.style.setProperty('--glow-x', `${glowX}%`);
        card.style.setProperty('--glow-y', `${glowY}%`);

        // Stop breathing animation during interaction
        card.style.animationPlayState = 'paused';
      });

      card.addEventListener('mouseleave', () => {
        // Reset to normal state with smooth transition
        card.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg) translateZ(0px)';
        card.style.boxShadow = '0 4px 15px rgba(0, 255, 255, 0.1)';
        card.style.animationPlayState = 'running'; // Resume breathing
      });
    });
  }

  setupCtaReaction() {
    const ctaButton = document.querySelector('.cta-button.primary');
    const ctaSection = document.querySelector('.cta-section');

    if (!ctaButton || !ctaSection) return;

    let isHovering = false;
    let heartbeatInterval;

    // Start idle heartbeat pulse
    const startHeartbeat = () => {
      ctaButton.style.animation = 'ctaHeartbeat 3s ease-in-out infinite';
    };

    // Stop heartbeat and prepare for interaction
    const stopHeartbeat = () => {
      ctaButton.style.animation = 'none';
      clearInterval(heartbeatInterval);
    };

    // Initialize idle heartbeat
    startHeartbeat();

    // Enhanced hover effects - heart racing
    ctaButton.addEventListener('mouseenter', () => {
      isHovering = true;
      stopHeartbeat();

      // Immediate glow burst
      ctaButton.style.boxShadow = '0 0 60px rgba(0, 255, 255, 0.9), 0 0 120px rgba(0, 255, 255, 0.5), 0 0 180px rgba(0, 255, 255, 0.2)';
      ctaButton.style.animation = 'ctaGlowBurst 1.5s ease-out infinite';

      // Background intense vibration
      ctaSection.style.animation = 'backgroundVibration 0.08s ease-in-out infinite';

      // Button attracts cursor with subtle scale and glow
      ctaButton.style.transform = 'scale(1.05) translateY(-3px)';
      ctaButton.style.borderColor = 'rgba(0, 255, 255, 0.8)';
    });

    ctaButton.addEventListener('mouseleave', () => {
      isHovering = false;

      // Return to idle state
      ctaButton.style.boxShadow = '0 4px 15px rgba(0, 255, 255, 0.3)';
      ctaButton.style.animation = 'none';
      ctaButton.style.transform = 'scale(1) translateY(0)';
      ctaButton.style.borderColor = 'rgba(0, 255, 255, 0.3)';
      ctaSection.style.animation = 'none';

      // Resume heartbeat after brief pause
      setTimeout(() => {
        if (!isHovering) {
          startHeartbeat();
        }
      }, 500);
    });

    // Enhanced click effect - shockwave light explosion
    ctaButton.addEventListener('click', (e) => {
      const rect = ctaButton.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Stop all animations temporarily
      stopHeartbeat();
      ctaButton.style.animation = 'none';

      // Create multiple shockwave rings
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          const shockwave = document.createElement('div');
          shockwave.style.position = 'fixed';
          shockwave.style.left = `${centerX}px`;
          shockwave.style.top = `${centerY}px`;
          shockwave.style.width = '0px';
          shockwave.style.height = '0px';
          shockwave.style.borderRadius = '50%';
          shockwave.style.border = `2px solid rgba(0, 255, 255, ${0.8 - i * 0.2})`;
          shockwave.style.transform = 'translate(-50%, -50%)';
          shockwave.style.zIndex = '9999';
          shockwave.style.pointerEvents = 'none';
          shockwave.style.animation = `shockwaveExpand 1.2s ease-out forwards`;

          document.body.appendChild(shockwave);

          // Remove shockwave after animation
          setTimeout(() => {
            shockwave.remove();
          }, 1200);
        }, i * 100);
      }

      // Create central light burst
      const lightBurst = document.createElement('div');
      lightBurst.style.position = 'fixed';
      lightBurst.style.left = `${centerX}px`;
      lightBurst.style.top = `${centerY}px`;
      lightBurst.style.width = '0px';
      lightBurst.style.height = '0px';
      lightBurst.style.borderRadius = '50%';
      lightBurst.style.background = 'radial-gradient(circle, rgba(0, 255, 255, 1) 0%, rgba(0, 255, 255, 0.6) 30%, rgba(0, 255, 255, 0.2) 60%, transparent 100%)';
      lightBurst.style.transform = 'translate(-50%, -50%)';
      lightBurst.style.zIndex = '9999';
      lightBurst.style.pointerEvents = 'none';
      lightBurst.style.animation = 'lightBurst 1s ease-out forwards';

      document.body.appendChild(lightBurst);

      // Button reaction to click
      ctaButton.style.transform = 'scale(0.98) translateY(-1px)';
      setTimeout(() => {
        ctaButton.style.transform = 'scale(1.02) translateY(-2px)';
        setTimeout(() => {
          ctaButton.style.transform = 'scale(1) translateY(0)';
        }, 150);
      }, 100);

      // Remove light burst after animation
      setTimeout(() => {
        lightBurst.remove();
      }, 1000);

      // Resume heartbeat after shockwave
      setTimeout(() => {
        if (!isHovering) {
          startHeartbeat();
        }
      }, 1500);
    });
  }
}

// Initialize components and home page
components.init();
new HomePage();

export default HomePage;