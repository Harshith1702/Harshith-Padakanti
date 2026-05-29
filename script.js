// ============================================================
// STATE
// ============================================================
const STATE = {
  theme: localStorage.getItem('theme') || 'system',
  cursor: { x: 0, y: 0, vx: 0, vy: 0 },
  particles: [],
  scrollPos: 0,
  reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches
};

const trackEvent = (name, params = {}) => {
  if (typeof gtag === 'function') {
    gtag('event', name, params);
  }
};

// ============================================================
// BACKGROUND PARTICLE SYSTEM
// ============================================================
class ParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.accentColor = { r: 255, g: 23, b: 68 }; // default red
    this.resize();
    this.init();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  init() {
    for (let i = 0; i < 50; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 2 + 1,
        life: Math.random() * 200 + 100
      });
    }
  }

  setAccent(r, g, b) {
    // smooth transition
    this.targetAccent = { r, g, b };
    if (!this._accentInterval) {
      this._accentInterval = setInterval(() => {
        const lerp = (a, b) => a + (b - a) * 0.05;
        this.accentColor.r = lerp(this.accentColor.r, this.targetAccent.r);
        this.accentColor.g = lerp(this.accentColor.g, this.targetAccent.g);
        this.accentColor.b = lerp(this.accentColor.b, this.targetAccent.b);
      }, 16);
    }
  }

  update() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const { r, g, b } = this.accentColor;
    this.particles.forEach((p, idx) => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 1;
      if (p.x < 0 || p.x > this.canvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > this.canvas.height) p.vy *= -1;
      if (p.life <= 0) {
        this.particles[idx] = {
          x: Math.random() * this.canvas.width,
          y: Math.random() * this.canvas.height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          size: Math.random() * 2 + 1,
          life: Math.random() * 200 + 100
        };
      }
      const alpha = (p.life / 300) * 0.3;
      this.ctx.fillStyle = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
      this.ctx.fillRect(p.x, p.y, p.size, p.size);
    });
  }

  animate() {
    this.update();
    requestAnimationFrame(() => this.animate());
  }
}

// ============================================================
// SAND PHOTO EFFECT — fixed: DPR-aware, proper sizing, CORS
// ============================================================
class SandPhoto {
  constructor() {
    this.wrapper = document.querySelector('.hero-image');
    this.img = document.querySelector('.hero-img');
    if (!this.wrapper || !this.img) return;

    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 3; opacity: 0;
      transition: opacity 0.22s ease;
    `;
    this.wrapper.appendChild(this.canvas);

    this.particles = [];
    this.mouse = { x: -9999, y: -9999 };
    this.active = false;
    this.animFrame = null;
    this.imageLoaded = false;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2); // cap at 2x
    this.resizeTimer = null;

    // defer setup until after first paint so layout is stable
    const doSetup = () => {
      if (this.img.complete && this.img.naturalWidth > 0) {
        this.setup();
      } else {
        this.img.addEventListener('load', () => this.setup(), { once: true });
      }
    };

    // wait for layout to settle
    if (document.readyState === 'complete') {
      requestAnimationFrame(() => requestAnimationFrame(doSetup));
    } else {
      window.addEventListener('load', () => requestAnimationFrame(() => requestAnimationFrame(doSetup)));
    }

    window.addEventListener('resize', () => {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => this.setup(), 160);
    });

    this.wrapper.addEventListener('pointerenter', () => this.activate());
    this.wrapper.addEventListener('mouseenter', () => this.activate());
    this.wrapper.addEventListener('mouseleave', () => this.deactivate());
    document.addEventListener('mousemove', (e) => {
      const frameRect = this.wrapper.getBoundingClientRect();
      const isInside = (
        e.clientX >= frameRect.left &&
        e.clientX <= frameRect.right &&
        e.clientY >= frameRect.top &&
        e.clientY <= frameRect.bottom
      );

      if (!isInside) {
        if (this.active) this.deactivate();
        return;
      }

      this.activate();
      const rect = this.canvas.getBoundingClientRect();
      // account for dpr scaling
      this.mouse.x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      this.mouse.y = (e.clientY - rect.top) * (this.canvas.height / rect.height);

      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      this.wrapper.style.setProperty('--photo-x', `${(nx + 0.5) * 100}%`);
      this.wrapper.style.setProperty('--photo-y', `${(ny + 0.5) * 100}%`);
      this.wrapper.style.setProperty('--photo-tilt-x', `${(-ny * 8).toFixed(2)}deg`);
      this.wrapper.style.setProperty('--photo-tilt-y', `${(nx * 10).toFixed(2)}deg`);
    });
  }

  setup() {
    const sampleCanvas = document.createElement('canvas');
    const sampleCtx = sampleCanvas.getContext('2d');
    const gap = 4;

    const imgRect = this.img.getBoundingClientRect();
    // use actual pixel dimensions, not layout dimensions
    const displayW = Math.floor(imgRect.width);
    const displayH = Math.floor(imgRect.height);

    if (!displayW || !displayH) return;

    // logical canvas size = display size (CSS handles scaling)
    // but internally we work at DPR resolution for crispness
    const w = displayW * this.dpr;
    const h = displayH * this.dpr;

    sampleCanvas.width = w;
    sampleCanvas.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
    // canvas CSS size stays at display resolution, browser scales
    this.canvas.style.width = displayW + 'px';
    this.canvas.style.height = displayH + 'px';

    try {
      sampleCtx.drawImage(this.img, 0, 0, w, h);
      const data = sampleCtx.getImageData(0, 0, w, h).data;

      this.particles = [];
      const gapScaled = gap * this.dpr;
      for (let y = 0; y < h; y += gapScaled) {
        for (let x = 0; x < w; x += gapScaled) {
          const i = (y * w + x) * 4;
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 30) continue;
          this.particles.push({
            ox: x, oy: y,
            x, y,
            vx: 0, vy: 0,
            r, g, b,
            size: gapScaled * 0.96,
            alpha: 0
          });
        }
      }
      this.imageLoaded = true;
    } catch (e) {
      console.warn('SandPhoto: CORS blocked. Serve image from same origin or add crossorigin headers.', e);
    }
  }

  activate() {
    if (!this.imageLoaded) return;
    if (this.active) return;
    this.active = true;
    this.wrapper.classList.add('is-reacting');
    this.canvas.style.opacity = '1';
    this.loop();
  }

  deactivate() {
    this.active = false;
    this.wrapper.classList.remove('is-reacting');
    this.canvas.style.opacity = '0';
    this.wrapper.style.setProperty('--photo-tilt-x', '0deg');
    this.wrapper.style.setProperty('--photo-tilt-y', '0deg');
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.particles.forEach(p => { p.x = p.ox; p.y = p.oy; p.vx = 0; p.vy = 0; p.alpha = 0; });
  }

  loop() {
    if (!this.active) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const REPEL = 78 * this.dpr;
    const REPEL_STRENGTH = 5.2;
    const RETURN = 0.1;
    const FRICTION = 0.84;

    this.particles.forEach(p => {
      const dx = p.x - this.mouse.x;
      const dy = p.y - this.mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const influence = Math.max(0, 1 - dist / REPEL);

      if (dist < REPEL && dist > 0) {
        const force = influence * REPEL_STRENGTH;
        p.vx += (dx / dist) * force;
        p.vy += (dy / dist) * force;
        p.vx += (Math.random() - 0.5) * 0.9;
        p.vy += (Math.random() - 0.5) * 0.9;
        p.alpha = Math.min(0.88, p.alpha + influence * 0.22);
      }

      p.vx += (p.ox - p.x) * RETURN;
      p.vy += (p.oy - p.y) * RETURN;
      p.vx *= FRICTION;
      p.vy *= FRICTION;
      p.x += p.vx;
      p.y += p.vy;
      p.alpha *= 0.91;

      const drift = Math.hypot(p.x - p.ox, p.y - p.oy);
      const visible = Math.max(p.alpha, Math.min(0.42, drift / (32 * this.dpr)));
      if (visible < 0.025) return;

      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      const brightness = Math.min(1.28, 1 + speed * 0.035);
      const alpha = Math.min(0.78, visible + speed * 0.01);
      this.ctx.fillStyle = `rgba(${Math.min(255, p.r * brightness)}, ${Math.min(255, p.g * brightness)}, ${Math.min(255, p.b * brightness)}, ${alpha})`;
      this.ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    });

    this.animFrame = requestAnimationFrame(() => this.loop());
  }
}

// ============================================================
// MAGNETIC CURSOR
// ============================================================
class MagneticCursor {
  constructor() {
    this.dot = document.getElementById('customCursor');
    this.ring = this.createRing();
    this.x = window.innerWidth / 2;
    this.y = window.innerHeight / 2;
    this.dotX = this.x;
    this.dotY = this.y;

    document.addEventListener('mousemove', (e) => {
      this.x = e.clientX;
      this.y = e.clientY;
    });

    this.bindMagnetic();
    this.animate();
  }

  createRing() {
    const ring = document.createElement('div');
    ring.id = 'cursorRing';
    ring.style.cssText = `
      position: fixed; width: 40px; height: 40px;
      border: 1px solid rgba(255,23,68,0.4); border-radius: 50%;
      pointer-events: none; z-index: 9998; top: 0; left: 0;
      transform: translate(-50%, -50%);
      transition: width 0.3s ease, height 0.3s ease, border-color 0.3s ease, background 0.3s ease;
      mix-blend-mode: screen;
    `;
    document.body.appendChild(ring);
    return ring;
  }

  bindMagnetic() {
    const targets = document.querySelectorAll('.btn, .btn-resume, .project-links a, .cp-link, .contact-link, .skill-tag, .nav-links a');
    targets.forEach(el => {
      el.addEventListener('mouseenter', () => {
        this.ring.style.width = '60px';
        this.ring.style.height = '60px';
        this.ring.style.borderColor = 'rgba(255,23,68,0.9)';
        this.ring.style.background = 'rgba(255,23,68,0.05)';
      });
      el.addEventListener('mouseleave', () => {
        this.ring.style.width = '40px';
        this.ring.style.height = '40px';
        this.ring.style.borderColor = 'rgba(255,23,68,0.4)';
        this.ring.style.background = 'transparent';
      });
    });

    document.querySelectorAll('a, button').forEach(el => {
      el.addEventListener('mouseenter', () => {
        if (this.dot) this.dot.style.transform = 'translate(-50%, -50%) scale(1.8)';
      });
      el.addEventListener('mouseleave', () => {
        if (this.dot) this.dot.style.transform = 'translate(-50%, -50%) scale(1)';
      });
    });
  }

  animate() {
    this.dotX += (this.x - this.dotX) * 0.12;
    this.dotY += (this.y - this.dotY) * 0.12;

    if (this.dot) {
      this.dot.style.left = this.x + 'px';
      this.dot.style.top = this.y + 'px';
    }
    this.ring.style.left = this.dotX + 'px';
    this.ring.style.top = this.dotY + 'px';

    requestAnimationFrame(() => this.animate());
  }
}

// ============================================================
// GLITCH TEXT
// ============================================================
class GlitchText {
  constructor() {
    this.init();
  }

  init() {
    const titles = document.querySelectorAll('.section-title, .hero-title');
    titles.forEach(title => {
      title.setAttribute('data-text', title.textContent);
      title.style.position = 'relative';
      title.addEventListener('mouseenter', () => this.glitch(title));
    });

    // Keep the name readable on first load; glitch is hover-triggered only.
  }

  glitch(el) {
    if (el.dataset.glitching) return;
    el.dataset.glitching = 'true';

    const original = el.textContent;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*';
    let iterations = 0;

    const interval = setInterval(() => {
      el.textContent = original
        .split('')
        .map((char, idx) => {
          if (char === ' ' || char === '\n') return char;
          if (idx < iterations) return char;
          return chars[Math.floor(Math.random() * chars.length)];
        })
        .join('');

      iterations += 2;
      if (iterations >= original.length + 4) {
        el.textContent = original;
        clearInterval(interval);
        delete el.dataset.glitching;
      }
    }, 40);
  }
}

// ============================================================
// RGB CARD SHIFT
// ============================================================
class RGBCardShift {
  constructor() {
    this.init();
  }

  init() {
    const cards = document.querySelectorAll('.project-card');
    cards.forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;

        const rotateX = y * 12;
        const rotateY = -x * 12;
        const shiftX = x * 4;
        const shiftY = y * 2;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;

        const h3 = card.querySelector('h3');
        if (h3) {
          h3.style.textShadow = `${shiftX * 2}px ${shiftY}px 0 rgba(255,23,68,0.5), ${-shiftX}px ${-shiftY}px 0 rgba(0,200,255,0.3)`;
        }

        card.style.background = `radial-gradient(circle at ${(x + 0.5) * 100}% ${(y + 0.5) * 100}%, rgba(255,23,68,0.08) 0%, transparent 60%), var(--surface-dark)`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0)';
        const h3 = card.querySelector('h3');
        if (h3) h3.style.textShadow = 'none';
        card.style.background = '';
      });
    });
  }
}

// ============================================================
// SKILL TAG SCATTER
// ============================================================
class SkillScatter {
  constructor() {
    this.init();
  }

  init() {
    const groups = document.querySelectorAll('.skill-group');
    groups.forEach(group => {
      const tags = group.querySelectorAll('.skill-tag');

      group.addEventListener('mouseenter', () => {
        tags.forEach((tag, i) => {
          const angle = (Math.random() * 2 - 1) * 15;
          const tx = (Math.random() * 2 - 1) * 12;
          const ty = (Math.random() * 2 - 1) * 8;
          tag.style.transition = `transform 0.4s cubic-bezier(0.34,1.56,0.64,1) ${i * 30}ms`;
          tag.style.transform = `translate(${tx}px, ${ty}px) rotate(${angle}deg)`;
        });
      });

      group.addEventListener('mouseleave', () => {
        tags.forEach((tag, i) => {
          tag.style.transition = `transform 0.5s cubic-bezier(0.34,1.56,0.64,1) ${i * 20}ms`;
          tag.style.transform = 'translate(0,0) rotate(0deg)';
        });
      });
    });
  }
}

// ============================================================
// TYPING EFFECT
// ============================================================
class TypingEffect {
  constructor() {
    this.el = document.querySelector('.hero-tagline');
    if (!this.el) return;
    this.text = this.el.textContent;
    this.el.textContent = '';
    this.el.style.borderRight = '2px solid var(--accent)';
    this.el.style.paddingRight = '4px';
    this.type();
  }

  type() {
    let i = 0;
    const interval = setInterval(() => {
      this.el.textContent += this.text[i];
      i++;
      if (i >= this.text.length) {
        clearInterval(interval);
        let blinks = 0;
        const blink = setInterval(() => {
          this.el.style.borderRight = blinks % 2 === 0 ? '2px solid transparent' : '2px solid var(--accent)';
          blinks++;
          if (blinks > 6) {
            clearInterval(blink);
            this.el.style.borderRight = 'none';
          }
        }, 400);
      }
    }, 55);
  }
}

// ============================================================
// STAT COUNTER
// ============================================================
class StatCounter {
  constructor() {
    this.stats = document.querySelectorAll('.stat-value');
    this.init();
  }

  init() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !entry.target.hasAttribute('data-counted')) {
          this.count(entry.target);
          entry.target.setAttribute('data-counted', 'true');
        }
      });
    }, { threshold: 0.5 });
    this.stats.forEach(stat => observer.observe(stat));
  }

  count(element) {
    const target = parseFloat(element.textContent);
    const isPlus = element.textContent.includes('+');
    const duration = 1600;
    const steps = 60;
    const stepDuration = duration / steps;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      const progress = 1 - Math.pow(1 - step / steps, 2);
      const current = Math.floor(target * progress);
      element.textContent = current.toString() + (isPlus ? '+' : '');
      if (step >= steps) {
        element.textContent = target.toString() + (isPlus ? '+' : '');
        clearInterval(interval);
      }
    }, stepDuration);
  }
}

// ============================================================
// NAV MANAGER
// ============================================================
class NavManager {
  constructor() {
    this.nav = document.getElementById('navbar');
    this.links = this.nav.querySelectorAll('.nav-links a');
    this.progress = this.createProgressBar();
    this.init();
  }

  createProgressBar() {
    const bar = document.createElement('div');
    bar.style.cssText = `
      position: absolute; bottom: 0; left: 0; height: 2px;
      background: linear-gradient(90deg, var(--accent), #ff5252);
      width: 0%; transition: width 0.1s linear;
    `;
    this.nav.style.position = 'sticky';
    this.nav.appendChild(bar);
    return bar;
  }

  init() {
    window.addEventListener('scroll', () => {
      this.updateActive();
      this.updateProgress();
    });

    this.links.forEach(link => {
      link.addEventListener('click', (e) => {
        const target = link.getAttribute('href');
        if (target.startsWith('#')) {
          e.preventDefault();
          document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  }

  updateProgress() {
    const scrolled = window.scrollY;
    const total = document.body.scrollHeight - window.innerHeight;
    const pct = (scrolled / total) * 100;
    this.progress.style.width = pct + '%';
  }

  updateActive() {
    this.links.forEach(link => {
      link.classList.remove('active');
      const target = link.getAttribute('href');
      if (!target.startsWith('#')) return;
      const section = document.querySelector(target);
      if (!section) return;
      const rect = section.getBoundingClientRect();
      if (rect.top <= 100 && rect.bottom > 100) {
        link.classList.add('active');
      }
    });
  }
}

// ============================================================
// SCROLL OBSERVER
// ============================================================
class ScrollObserver {
  constructor() {
    this.observe();
  }

  observe() {
    const elements = document.querySelectorAll(
      '.hero-text-group, .hero-image-wrapper, .about-grid, .project-card, .stat-box, .skill-tag, .cp-card, .achievement-item, .section-title'
    );

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.animation = entry.target.style.animation || 'fadeInUp 0.8s ease-out';
          entry.target.style.opacity = '1';
          entry.target.style.transform = entry.target.style.transform || 'translateY(0)';
        }
      });
    }, { threshold: 0.1 });

    elements.forEach(el => observer.observe(el));
  }
}

// ============================================================
// THEME MANAGER
// ============================================================
class ThemeManager {
  constructor() {
    this.toggle = document.getElementById('themeToggle');
    this.html = document.documentElement;
    this.init();
  }

  init() {
    this.applyTheme(STATE.theme);
    this.toggle.addEventListener('click', () => this.toggleTheme());
  }

  applyTheme(theme) {
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.html.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      this.html.setAttribute('data-theme', theme);
    }
    STATE.theme = theme;
    localStorage.setItem('theme', theme);
  }

  toggleTheme() {
    const currentTheme = this.html.getAttribute('data-theme');
    this.applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
  }
}

// ============================================================
// ACHIEVEMENT ANIMATE
// ============================================================
class AchievementAnimate {
  constructor() {
    const items = document.querySelectorAll('.achievement-item');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, idx) => {
        if (entry.isIntersecting) {
          entry.target.style.transition = `transform 0.5s cubic-bezier(0.34,1.56,0.64,1) ${idx * 80}ms, opacity 0.5s ease ${idx * 80}ms`;
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateX(0)';
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });

    items.forEach(item => {
      item.style.opacity = '0';
      item.style.transform = 'translateX(-40px)';
      observer.observe(item);
    });
  }
}

// ============================================================
// GHOST TRAIL — replaces sparkle trail. hollow rings, not dots.
// more unsettling, less party.
// ============================================================
class GhostTrail {
  constructor() {
    this.ghosts = [];
    this.lastX = 0;
    this.lastY = 0;

    document.addEventListener('mousemove', (e) => {
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // only spawn if cursor moved enough (avoid spam when idle)
      if (dist < 8) return;
      if (Math.random() > 0.5) return;

      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.spawn(e.clientX, e.clientY);
    });

    this.loop();
  }

  spawn(x, y) {
    const size = Math.random() * 10 + 4;
    const ghost = document.createElement('div');
    ghost.style.cssText = `
      position: fixed; pointer-events: none; z-index: 9996;
      width: ${size}px; height: ${size}px;
      border-radius: 50%;
      border: 1px solid rgba(255,23,68,0.7);
      left: ${x}px; top: ${y}px;
      transform: translate(-50%, -50%);
    `;
    document.body.appendChild(ghost);
    this.ghosts.push({ el: ghost, x, y, life: 1, size });
  }

  loop() {
    this.ghosts = this.ghosts.filter(g => {
      g.life -= 0.05;
      const scale = 1 + (1 - g.life) * 1.2;
      g.el.style.opacity = g.life * 0.6;
      g.el.style.transform = `translate(-50%, -50%) scale(${scale})`;
      if (g.life <= 0) {
        g.el.remove();
        return false;
      }
      return true;
    });
    requestAnimationFrame(() => this.loop());
  }
}

// ============================================================
// SECTION AMBIENCE — bg particle color shifts per section
// subtle, not dramatic. just changes the vibe.
// ============================================================
class SectionAmbience {
  constructor(particleSystem) {
    this.ps = particleSystem;
    // section id -> [r, g, b]
    this.palette = {
      'hero':         [255, 23,  68],   // red (default)
      'about':        [180, 60,  255],  // purple
      'projects':     [0,   200, 255],  // cyan
      'other-projects':[0,   200, 255],  // cyan
      'skills':       [255, 160, 20],   // amber
      'cp':           [50,  220, 120],  // green
      'open-source':   [180, 60,  255],  // purple
      'achievements': [255, 23,  68],   // back to red
      'contact':      [255, 23,  68],
    };

    this.init();
  }

  init() {
    const sections = document.querySelectorAll('section[id]');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          const color = this.palette[id];
          if (color) this.ps.setAccent(...color);
        }
      });
    }, { threshold: 0.4 });

    sections.forEach(s => observer.observe(s));
  }
}

// ============================================================
// RAGE MODE — hold click for 2s. screen shakes, goes red.
// not a meltdown, just a dramatic exit from calm.
// ============================================================
class RageMode {
  constructor() {
    this.timer = null;
    this.active = false;
    this.overlay = this.createOverlay();
    this.init();
  }

  createOverlay() {
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed; inset: 0; pointer-events: none; z-index: 9990;
      background: rgba(255,23,68,0); transition: background 0.3s ease;
      mix-blend-mode: multiply;
    `;
    document.body.appendChild(el);
    return el;
  }

  shake() {
    const intensity = 6;
    document.body.style.transition = 'transform 0.05s ease';
    const id = setInterval(() => {
      const x = (Math.random() - 0.5) * intensity;
      const y = (Math.random() - 0.5) * intensity;
      document.body.style.transform = `translate(${x}px, ${y}px)`;
    }, 50);
    return id;
  }

  init() {
    let shakeId = null;

    document.addEventListener('mousedown', () => {
      this.timer = setTimeout(() => {
        this.active = true;
        this.overlay.style.background = 'rgba(255,23,68,0.12)';
        shakeId = this.shake();
      }, 2000);
    });

    document.addEventListener('mouseup', () => {
      clearTimeout(this.timer);
      if (this.active) {
        this.active = false;
        this.overlay.style.background = 'rgba(255,23,68,0)';
        if (shakeId) clearInterval(shakeId);
        document.body.style.transform = '';
      }
    });
  }
}

// ============================================================
// EASTER EGG — konami code: up up down down left right left right B A
// triggers a full-screen wednesday moment
// ============================================================
class EasterEgg {
  constructor() {
    this.code = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
    this.pos = 0;
    this.modal = this.createModal();
    this.init();
  }

  createModal() {
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed; inset: 0; z-index: 99999;
      background: #000; display: none; align-items: center; justify-content: center;
      flex-direction: column; cursor: pointer;
      font-family: 'Courier New', monospace;
    `;
    el.innerHTML = `
      <div style="text-align:center; padding: 40px; max-width: 600px;">
        <div style="font-size: clamp(60px,12vw,120px); margin-bottom: 20px; filter: drop-shadow(0 0 20px #ff1744);">🖤</div>
        <h2 style="color:#ff1744; font-size:clamp(18px,4vw,28px); letter-spacing:4px; text-transform:uppercase; margin:0 0 20px;">
          you found it
        </h2>
        <p style="color:#555; font-size:14px; line-height:1.8; max-width:400px; margin:0 auto 30px;">
          normal people don't type konami codes on dev portfolios at 2am.<br>
          i respect that.
        </p>
        <p style="color:#ff1744; font-size:12px; letter-spacing:2px; opacity:0.6;">
          click anywhere to leave
        </p>
      </div>
    `;
    el.addEventListener('click', () => {
      el.style.display = 'none';
    });
    document.body.appendChild(el);
    return el;
  }

  init() {
    document.addEventListener('keydown', (e) => {
      if (e.key === this.code[this.pos]) {
        this.pos++;
        if (this.pos === this.code.length) {
          this.pos = 0;
          this.trigger();
        }
      } else {
        this.pos = 0;
      }
    });
  }

  trigger() {
    this.modal.style.display = 'flex';
    // brief screen flash
    this.modal.style.background = '#ff1744';
    setTimeout(() => { this.modal.style.background = '#000'; }, 80);
  }
}

// ============================================================
// EXTERNAL LINKS + KEYBOARD SHORTCUTS + SMOOTH SCROLL
// ============================================================
class ExternalLinks {
  constructor() {
    document.querySelectorAll('a[href^="http"]').forEach(link => {
      link.setAttribute('rel', 'noopener noreferrer');
      link.setAttribute('target', '_blank');
    });
  }
}

class KeyboardShortcuts {
  constructor() {
    document.addEventListener('keydown', (e) => {
      if (e.key === '/') {
        e.preventDefault();
        document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }
}

class SmoothScroll {
  constructor() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        e.preventDefault();
        const element = document.querySelector(anchor.getAttribute('href'));
        if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }
}

// ============================================================
// REACTIVE SPOTLIGHT
// ============================================================
class ReactiveSpotlight {
  constructor() {
    this.targets = document.querySelectorAll('.project-card, .cp-card, .stat-box, .program-card, .achievement-item, .oss-card');
    this.buttons = document.querySelectorAll('.btn, .btn-resume, .contact-link, .project-links a, .cp-link');
    this.init();
  }

  init() {
    document.addEventListener('mousemove', (e) => {
      document.body.style.setProperty('--cursor-x', `${e.clientX}px`);
      document.body.style.setProperty('--cursor-y', `${e.clientY}px`);
    });

    this.targets.forEach(target => {
      target.addEventListener('mousemove', (e) => {
        const rect = target.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        target.style.setProperty('--card-x', `${x}%`);
        target.style.setProperty('--card-y', `${y}%`);
      });
    });

    this.buttons.forEach(button => {
      button.addEventListener('mousemove', (e) => {
        const rect = button.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        button.style.setProperty('--btn-x', `${x}%`);
        button.style.setProperty('--btn-y', `${y}%`);
      });
    });
  }
}

// ============================================================
// LIVING PAGE MOTION
// ============================================================
class LivingPageMotion {
  constructor() {
    this.sections = document.querySelectorAll('section');
    this.hero = document.querySelector('.hero');
    this.init();
  }

  init() {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        }
      });
    }, { threshold: 0.16 });

    this.sections.forEach(section => revealObserver.observe(section));

    window.addEventListener('scroll', () => {
      const depth = Math.min(1, window.scrollY / Math.max(1, window.innerHeight));
      document.body.style.setProperty('--scroll-depth', depth.toFixed(3));
    }, { passive: true });

    if (this.hero) {
      this.hero.addEventListener('mousemove', (e) => {
        const rect = this.hero.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        this.hero.style.setProperty('--hero-drift-x', `${(x * 18).toFixed(2)}px`);
        this.hero.style.setProperty('--hero-drift-y', `${(y * 14).toFixed(2)}px`);
      });

      this.hero.addEventListener('mouseleave', () => {
        this.hero.style.setProperty('--hero-drift-x', '0px');
        this.hero.style.setProperty('--hero-drift-y', '0px');
      });
    }
  }
}

// ============================================================
// PERFORMANCE MONITOR
// ============================================================
class PerformanceMonitor {
  constructor() {
    if (performance.timing) {
      window.addEventListener('load', () => {
        const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
        console.log(`%cloaded in ${loadTime}ms`, 'color:#ff1744; font-family:monospace;');
      });
    }
  }
}

// ============================================================
// BOOT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  const particleCanvas = document.getElementById('particleCanvas');
  const particles = new ParticleSystem(particleCanvas);
  particles.animate();

  new ThemeManager();
  new NavManager();
  new ScrollObserver();
  new StatCounter();
  new ExternalLinks();
  new PerformanceMonitor();
  new KeyboardShortcuts();
  new SmoothScroll();
  new AchievementAnimate();
  new EasterEgg(); // always on, it's keyboard-only
  new ReactiveSpotlight();
  new LivingPageMotion();

  if (!STATE.reduced) {
    new SandPhoto();
    new MagneticCursor();
    new GlitchText();
    new RGBCardShift();
    new SkillScatter();
    new TypingEffect();
    new GhostTrail();           // replaces SparkleTrail
    new RageMode();             // hold click 2s
    new SectionAmbience(particles); // bg color shifts per section
  }

  if (STATE.reduced) {
    document.body.classList.add('reduce-motion');
  }

  document.addEventListener('scroll', () => {
    STATE.scrollPos = window.scrollY;
  });
});

// ============================================================
// ANALYTICS
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  const resumeBtn = document.getElementById("resume-btn");
  if (resumeBtn) {
    resumeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      trackEvent('resume_click');
      setTimeout(() => { window.location.href = resumeBtn.href; }, 300);
    });
  }

  const projects = document.querySelectorAll(".project");
  projects.forEach(p => {
    p.addEventListener("click", () => {
      trackEvent('project_click', { name: p.querySelector("h3")?.innerText || "unknown" });
    });
  });

  const contactBtn = document.getElementById("contact-btn");
  if (contactBtn) {
    contactBtn.addEventListener("click", () => { trackEvent('contact_click'); });
  }

  let sent = false;
  window.addEventListener("scroll", () => {
    const percent = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
    if (!sent && percent > 50) {
      sent = true;
      trackEvent('scroll_50');
    }
  });
});
