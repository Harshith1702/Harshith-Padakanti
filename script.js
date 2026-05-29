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

// ============================================================
// BACKGROUND PARTICLE SYSTEM (existing, kept)
// ============================================================
class ParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
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

  update() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
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
      this.ctx.fillStyle = `rgba(255, 23, 68, ${alpha})`;
      this.ctx.fillRect(p.x, p.y, p.size, p.size);
    });
  }

  animate() {
    this.update();
    requestAnimationFrame(() => this.animate());
  }
}

// ============================================================
// SAND PHOTO EFFECT — hero image dissolves to particles on hover
// ============================================================
class SandPhoto {
  constructor() {
    this.wrapper = document.querySelector('.hero-image-wrapper');
    this.img = document.querySelector('.hero-img');
    if (!this.wrapper || !this.img) return;

    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      border-radius: 20px; pointer-events: none; z-index: 10; opacity: 0;
      transition: opacity 0.3s ease;
    `;
    this.wrapper.style.position = 'relative';
    this.wrapper.appendChild(this.canvas);

    this.particles = [];
    this.mouse = { x: -9999, y: -9999 };
    this.active = false;
    this.animFrame = null;
    this.imageLoaded = false;

    // Wait for image to be available
    if (this.img.complete && this.img.naturalWidth > 0) {
      this.setup();
    } else {
      this.img.addEventListener('load', () => this.setup());
    }

    this.wrapper.addEventListener('mouseenter', () => this.activate());
    this.wrapper.addEventListener('mouseleave', () => this.deactivate());
    this.wrapper.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      this.mouse.y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
    });
  }

  setup() {
    // Sample image pixels at low resolution for performance
    const sampleCanvas = document.createElement('canvas');
    const sampleCtx = sampleCanvas.getContext('2d');
    const gap = 4; // pixel spacing between particles

    const imgRect = this.img.getBoundingClientRect();
    const w = Math.floor(imgRect.width || 400);
    const h = Math.floor(imgRect.height || 500);

    sampleCanvas.width = w;
    sampleCanvas.height = h;
    this.canvas.width = w;
    this.canvas.height = h;

    try {
      sampleCtx.drawImage(this.img, 0, 0, w, h);
      const data = sampleCtx.getImageData(0, 0, w, h).data;

      this.particles = [];
      for (let y = 0; y < h; y += gap) {
        for (let x = 0; x < w; x += gap) {
          const i = (y * w + x) * 4;
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 30) continue;
          this.particles.push({
            ox: x, oy: y,       // origin
            x: x, y: y,         // current
            vx: 0, vy: 0,
            r, g, b,
            size: gap * 0.9
          });
        }
      }
      this.imageLoaded = true;
    } catch (e) {
      // CORS issue with local images — skip effect gracefully
      console.warn('SandPhoto: could not read image pixels (CORS). Effect disabled.');
    }
  }

  activate() {
    if (!this.imageLoaded) return;
    this.active = true;
    this.canvas.style.opacity = '1';
    this.img.style.opacity = '0';
    this.loop();
  }

  deactivate() {
    this.active = false;
    this.canvas.style.opacity = '0';
    this.img.style.opacity = '1';
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    // snap all particles back
    this.particles.forEach(p => { p.x = p.ox; p.y = p.oy; p.vx = 0; p.vy = 0; });
  }

  loop() {
    if (!this.active) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const REPEL = 80;
    const REPEL_STRENGTH = 6;
    const RETURN = 0.08;
    const FRICTION = 0.82;

    this.particles.forEach(p => {
      const dx = p.x - this.mouse.x;
      const dy = p.y - this.mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < REPEL) {
        const force = (REPEL - dist) / REPEL * REPEL_STRENGTH;
        p.vx += (dx / dist) * force;
        p.vy += (dy / dist) * force;
        // add a bit of random sand scatter
        p.vx += (Math.random() - 0.5) * 1.5;
        p.vy += (Math.random() - 0.5) * 1.5;
      }

      // spring back to origin
      p.vx += (p.ox - p.x) * RETURN;
      p.vy += (p.oy - p.y) * RETURN;

      // friction
      p.vx *= FRICTION;
      p.vy *= FRICTION;

      p.x += p.vx;
      p.y += p.vy;

      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      const brightness = Math.min(1.4, 1 + speed * 0.05);
      this.ctx.fillStyle = `rgba(${Math.min(255, p.r * brightness)}, ${Math.min(255, p.g * brightness)}, ${Math.min(255, p.b * brightness)}, 0.95)`;
      this.ctx.fillRect(p.x, p.y, p.size, p.size);
    });

    this.animFrame = requestAnimationFrame(() => this.loop());
  }
}

// ============================================================
// MAGNETIC CURSOR — elements pull/push the cursor
// ============================================================
class MagneticCursor {
  constructor() {
    this.dot = document.getElementById('customCursor');
    this.ring = this.createRing();
    this.x = window.innerWidth / 2;
    this.y = window.innerHeight / 2;
    this.dotX = this.x;
    this.dotY = this.y;
    this.scale = 1;
    this.label = '';

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

    // Cursor changes on interactive elements
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
    // Lag the ring behind the dot for a trail effect
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
// GLITCH TEXT — section titles glitch on intersection
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

    // Auto-glitch hero title on load
    const heroTitle = document.querySelector('.hero-title');
    if (heroTitle) {
      setTimeout(() => this.glitch(heroTitle), 1200);
    }
  }

  glitch(el) {
    if (el.dataset.glitching) return;
    el.dataset.glitching = 'true';

    const original = el.textContent;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*';
    let iterations = 0;
    const maxIter = 12;

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
// RGB CARD SHIFT — project cards get chromatic aberration on hover
// ============================================================
class RGBCardShift {
  constructor() {
    this.init();
  }

  init() {
    const cards = document.querySelectorAll('.project-card');
    cards.forEach(card => {
      let animating = false;

      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;

        const rotateX = y * 12;
        const rotateY = -x * 12;
        const shiftX = x * 4;
        const shiftY = y * 2;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;

        // Chromatic aberration via text-shadow on heading
        const h3 = card.querySelector('h3');
        if (h3) {
          h3.style.textShadow = `${shiftX * 2}px ${shiftY}px 0 rgba(255,23,68,0.5), ${-shiftX}px ${-shiftY}px 0 rgba(0,200,255,0.3)`;
        }

        // Glow follows cursor within card
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
// SKILL TAG SCATTER — tags scatter on hover then reform
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
// TYPING EFFECT — tagline types in on load
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
    const speed = 55;
    const interval = setInterval(() => {
      this.el.textContent += this.text[i];
      i++;
      if (i >= this.text.length) {
        clearInterval(interval);
        // blink cursor then remove
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
    }, speed);
  }
}

// ============================================================
// SCROLL COUNTER STREAK — stat boxes get a live counter cascade
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
      // Ease out quad
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
// NAVBAR MORPH — navbar compresses + gets progress bar on scroll
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
// SCROLL OBSERVER (existing, kept)
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
// THEME MANAGER (existing, kept)
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
// ACHIEVEMENT ITEMS — staggered slide-in from left
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
// EXTERNAL LINKS + KEYBOARD SHORTCUTS (existing, kept)
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
// SPARKLE TRAIL — leaves tiny accent sparks behind the cursor
// ============================================================
class SparkleTrail {
  constructor() {
    this.sparks = [];
    document.addEventListener('mousemove', (e) => {
      if (Math.random() > 0.4) return; // throttle
      this.spawn(e.clientX, e.clientY);
    });
    this.loop();
  }

  spawn(x, y) {
    const spark = document.createElement('div');
    spark.style.cssText = `
      position: fixed; pointer-events: none; z-index: 9997;
      width: ${Math.random() * 4 + 2}px; height: ${Math.random() * 4 + 2}px;
      border-radius: 50%; background: var(--accent);
      left: ${x}px; top: ${y}px;
      transform: translate(-50%, -50%);
      opacity: 0.8;
      transition: none;
    `;
    document.body.appendChild(spark);
    this.sparks.push({
      el: spark,
      x, y,
      vx: (Math.random() - 0.5) * 3,
      vy: (Math.random() - 0.5) * 3 - 1,
      life: 1
    });
  }

  loop() {
    this.sparks = this.sparks.filter(s => {
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.12; // gravity
      s.life -= 0.045;
      s.el.style.left = s.x + 'px';
      s.el.style.top = s.y + 'px';
      s.el.style.opacity = s.life;
      s.el.style.transform = `translate(-50%, -50%) scale(${s.life})`;
      if (s.life <= 0) {
        s.el.remove();
        return false;
      }
      return true;
    });
    requestAnimationFrame(() => this.loop());
  }
}

// ============================================================
// PERFORMANCE MONITOR (existing, kept)
// ============================================================
class PerformanceMonitor {
  constructor() {
    if (performance.timing) {
      window.addEventListener('load', () => {
        const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
        console.log(`Page loaded in ${loadTime}ms`);
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

  if (!STATE.reduced) {
    new SandPhoto();
    new MagneticCursor();
    new GlitchText();
    new RGBCardShift();
    new SkillScatter();
    new TypingEffect();
    new SparkleTrail();
  }

  if (STATE.reduced) {
    document.body.classList.add('reduce-motion');
  }

  document.addEventListener('scroll', () => {
    STATE.scrollPos = window.scrollY;
  });
});

// ============================================================
// ANALYTICS (existing, kept)
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  const resumeBtn = document.getElementById("resume-btn");
  if (resumeBtn) {
    resumeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      gtag('event', 'resume_click');
      setTimeout(() => { window.location.href = resumeBtn.href; }, 300);
    });
  }

  const projects = document.querySelectorAll(".project");
  projects.forEach(p => {
    p.addEventListener("click", () => {
      gtag('event', 'project_click', { name: p.querySelector("h3")?.innerText || "unknown" });
    });
  });

  const contactBtn = document.getElementById("contact-btn");
  if (contactBtn) {
    contactBtn.addEventListener("click", () => { gtag('event', 'contact_click'); });
  }

  let sent = false;
  window.addEventListener("scroll", () => {
    const percent = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
    if (!sent && percent > 50) {
      sent = true;
      gtag('event', 'scroll_50');
    }
  });
});
