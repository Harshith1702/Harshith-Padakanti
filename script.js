const STATE = {
  theme: localStorage.getItem('theme') || 'system',
  cursor: { x: 0, y: 0, vx: 0, vy: 0 },
  particles: [],
  scrollPos: 0,
  reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches
};

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

class CursorTrail {
  constructor() {
    this.cursor = document.getElementById('customCursor');
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;

    if (!this.cursor) return;

    document.addEventListener('mousemove', (e) => {
      this.x = e.clientX;
      this.y = e.clientY;
    });

    this.animate();
  }

  animate() {
    if (!this.cursor) return;
/*
    const friction = 0.12;
    this.vx += (this.x - this.cursor.offsetLeft - 10) * friction;
    this.vy += (this.y - this.cursor.offsetTop - 10) * friction;
*/
    this.vx *= 0.9;
    this.vy *= 0.9;

    this.x = this.x || 0;
    this.y = this.y || 0;
    this.curX = (this.curX || 0) + (this.x - (this.curX || 0)) * 0.12;
    this.curY = (this.curY || 0) + (this.y - (this.curY || 0)) * 0.12;
    this.cursor.style.left = this.curX + 'px';
    this.cursor.style.top  = this.curY + 'px';
/*
    const newX = this.cursor.offsetLeft + this.vx;
    const newY = this.cursor.offsetTop + this.vy;

    this.cursor.style.transform = `translate(${newX}px, ${newY}px)`;
*/
    requestAnimationFrame(() => this.animate());
  }
}

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
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    this.applyTheme(newTheme);
  }
}

class NavManager {
  constructor() {
    this.nav = document.getElementById('navbar');
    this.links = this.nav.querySelectorAll('.nav-links a');
    this.init();
  }

  init() {
    window.addEventListener('scroll', () => this.updateActive());
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
          entry.target.style.transform = 'translateY(0)';
        }
      });
    }, { threshold: 0.1 });

    elements.forEach(el => observer.observe(el));
  }
}

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
    const duration = 2000;
    const steps = 60;
    const stepDuration = duration / steps;
    let current = 0;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      current = (target / steps) * step;
      const display = Math.floor(current).toString() + (isPlus ? '+' : '');
      element.textContent = display;

      if (step >= steps) {
        element.textContent = target.toString() + (isPlus ? '+' : '');
        clearInterval(interval);
      }
    }, stepDuration);
  }
}

class ExternalLinks {
  constructor() {
    this.init();
  }

  init() {
    const links = document.querySelectorAll('a[href^="http"]');
    links.forEach(link => {
      link.setAttribute('rel', 'noopener noreferrer');
      link.setAttribute('target', '_blank');
    });
  }
}

class PerformanceMonitor {
  constructor() {
    this.measure();
  }

  measure() {
    if (performance.timing) {
      window.addEventListener('load', () => {
        const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
        console.log(`Page loaded in ${loadTime}ms`);
      });
    }
  }
}

class KeyboardShortcuts {
  constructor() {
    this.init();
  }

  init() {
    document.addEventListener('keydown', (e) => {
      if (e.key === '/') {
        e.preventDefault();
        document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' });
      }
      if (e.key === '?') {
        console.log('Shortcuts: / goes to contact');
      }
    });
  }
}

class SmoothScroll {
  constructor() {
    this.init();
  }

  init() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        e.preventDefault();
        const target = anchor.getAttribute('href');
        const element = document.querySelector(target);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }
}

class CardTilt {
  constructor() {
    this.init();
  }

  init() {
    const cards = document.querySelectorAll('.project-card.featured');
    
    cards.forEach(card => {
      card.addEventListener('mousemove', (e) => this.tilt(e, card));
      card.addEventListener('mouseleave', () => this.reset(card));
    });
  }

  tilt(e, card) {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = (y - centerY) / 10;
    const rotateY = (centerX - x) / 10;
    
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`;
  }

  reset(card) {
    card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
  }
}


document.addEventListener('DOMContentLoaded', () => {
  const particleCanvas = document.getElementById('particleCanvas');
  const particles = new ParticleSystem(particleCanvas);
  particles.animate();

  new CursorTrail();
  new ThemeManager();
  new NavManager();
  new ScrollObserver();
  new StatCounter();
  new CardTilt();  
  new ExternalLinks();
  new PerformanceMonitor();
  new KeyboardShortcuts();
  new SmoothScroll();

  if (STATE.reduced) {
    document.body.classList.add('reduce-motion');
  }

  document.addEventListener('scroll', () => {
    STATE.scrollPos = window.scrollY;
  });
});

document.addEventListener("DOMContentLoaded", () => {

  // Resume click
  const resumeBtn = document.getElementById("resume-btn");
  if (resumeBtn) {
    resumeBtn.addEventListener("click", () => {
      gtag('event', 'resume_click');
    });
  }

  // Project clicks
  const projects = document.querySelectorAll(".project");
  projects.forEach(p => {
    p.addEventListener("click", () => {
      gtag('event', 'project_click', {
        name: p.querySelector("h3")?.innerText || "unknown"
      });
    });
  });

  // Contact click
  const contactBtn = document.getElementById("contact-btn");
  if (contactBtn) {
    contactBtn.addEventListener("click", () => {
      gtag('event', 'contact_click');
    });
  }

  // Scroll tracking
  let sent = false;
  window.addEventListener("scroll", () => {
    let percent = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;

    if (!sent && percent > 50) {
      sent = true;
      gtag('event', 'scroll_50');
    }
  });

});




/*
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('#').catch(() => {});
}
*/
