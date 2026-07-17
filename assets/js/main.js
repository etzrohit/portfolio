// ---------------------------------------------
// Theme: init + toggle with a ripple transition
// (the same interaction pattern shipped in the
// Control Plane dark-mode system — see case study)
// ---------------------------------------------

(function initTheme() {
  const stored = localStorage.getItem('theme');
  const theme = stored || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
})();

function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function applyTheme(next) {
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
}

function toggleTheme(originEvent) {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';

  if (originEvent) {
    const x = originEvent.clientX;
    const y = originEvent.clientY;
    document.documentElement.style.setProperty('--ripple-x', x + 'px');
    document.documentElement.style.setProperty('--ripple-y', y + 'px');
  }

  if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    applyTheme(next);
    return;
  }

  const transition = document.startViewTransition(() => applyTheme(next));

  // Always reveal the incoming theme as a circle growing from the click
  // point — this stays symmetric in both directions, since the "new" view
  // is already painted on top of the "old" one by default.
  transition.ready.then(() => {
    const x = originEvent ? originEvent.clientX : window.innerWidth / 2;
    const y = originEvent ? originEvent.clientY : window.innerHeight / 2;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const clipFrom = `circle(0px at ${x}px ${y}px)`;
    const clipTo = `circle(${endRadius}px at ${x}px ${y}px)`;

    document.documentElement.animate(
      { clipPath: [clipFrom, clipTo] },
      {
        duration: 500,
        easing: 'ease-in-out',
        pseudoElement: '::view-transition-new(root)',
      }
    );
  });
}

// ---------------------------------------------
// Before/after comparison slider: drag (mouse,
// touch, and pen via Pointer Events) + an
// auto-scrub intro that hints "drag me" on load
// ---------------------------------------------

function initBeforeAfterSlider(root) {
  const frame = root.querySelector('.ba-frame');
  if (!frame) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let reveal = 50;
  let dragging = false;

  const setReveal = (pct) => {
    reveal = Math.min(100, Math.max(0, pct));
    root.style.setProperty('--reveal', reveal + '%');
    root.setAttribute('aria-valuenow', String(Math.round(reveal)));
  };

  const pctFromClientX = (clientX) => {
    const rect = frame.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * 100;
  };

  const startDrag = (e) => {
    dragging = true;
    root.classList.add('is-dragging');
    frame.setPointerCapture(e.pointerId);
    setReveal(pctFromClientX(e.clientX));
  };

  const moveDrag = (e) => {
    if (!dragging) return;
    setReveal(pctFromClientX(e.clientX));
  };

  const stopDrag = () => {
    dragging = false;
    root.classList.remove('is-dragging');
  };

  frame.addEventListener('pointerdown', startDrag);
  frame.addEventListener('pointermove', moveDrag);
  frame.addEventListener('pointerup', stopDrag);
  frame.addEventListener('pointercancel', stopDrag);

  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { setReveal(reveal - 5); e.preventDefault(); }
    if (e.key === 'ArrowRight') { setReveal(reveal + 5); e.preventDefault(); }
  });

  const introScrub = () => {
    if (prefersReducedMotion) { setReveal(50); return; }

    const keyframes = [50, 26, 74, 50];
    const segmentMs = 650;
    const start = performance.now();

    const tick = (now) => {
      if (dragging) return;
      const elapsed = now - start;
      const segment = Math.min(keyframes.length - 2, Math.floor(elapsed / segmentMs));
      const segStart = keyframes[segment];
      const segEnd = keyframes[segment + 1];
      const segProgress = Math.min(1, (elapsed - segment * segmentMs) / segmentMs);
      const eased = 1 - Math.pow(1 - segProgress, 3);
      setReveal(segStart + (segEnd - segStart) * eased);

      if (elapsed < segmentMs * (keyframes.length - 1)) {
        requestAnimationFrame(tick);
      } else {
        setReveal(50);
      }
    };
    requestAnimationFrame(tick);
  };

  setReveal(50);

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          introScrub();
          io.disconnect();
        }
      });
    }, { threshold: 0.4 });
    io.observe(root);
  } else {
    introScrub();
  }
}

// ---------------------------------------------
// Before/after carousel: centers the active
// slide, lets prev/next/dots/clicking-a-peeking-
// slide switch between comparison pairs
// ---------------------------------------------

function initBeforeAfterCarousel(root) {
  const viewport = root.querySelector('.ba-viewport');
  const track = root.querySelector('[data-ba-track]');
  const slides = Array.from(root.querySelectorAll('[data-ba-slide]'));
  if (!viewport || !track || !slides.length) return;

  const dots = Array.from(root.querySelectorAll('[data-ba-dots] .ba-dot'));
  const prevBtn = root.querySelector('[data-ba-prev]');
  const nextBtn = root.querySelector('[data-ba-next]');

  let activeIndex = Math.max(0, slides.findIndex((s) => s.classList.contains('is-active')));

  const center = () => {
    const slide = slides[activeIndex];
    const target = viewport.clientWidth / 2 - (slide.offsetLeft + slide.offsetWidth / 2);
    track.style.transform = `translateX(${target}px)`;
  };

  const setActive = (index) => {
    activeIndex = (index + slides.length) % slides.length;
    slides.forEach((s, i) => s.classList.toggle('is-active', i === activeIndex));
    dots.forEach((d, i) => d.classList.toggle('is-active', i === activeIndex));
    center();
  };

  slides.forEach((slide, i) => {
    slide.addEventListener('click', () => {
      if (i !== activeIndex) setActive(i);
    });
  });

  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => setActive(i));
  });

  prevBtn?.addEventListener('click', () => setActive(activeIndex - 1));
  nextBtn?.addEventListener('click', () => setActive(activeIndex + 1));

  window.addEventListener('resize', center);
  requestAnimationFrame(center);
}

// ---------------------------------------------
// Process filmstrip: JS-driven auto-scroll so
// hovering can ease the speed down without the
// position-jump a CSS animation-duration change
// causes (progress = elapsedTime / duration, so
// changing duration mid-flight snaps position)
// ---------------------------------------------

function initProcessStrip(strip) {
  const track = strip.querySelector('.process-track');
  if (!track) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const BASE_SPEED = 63; // px/s
  const HOVER_SPEED = BASE_SPEED / 4;
  const EASE = 0.05;

  let halfWidth = track.scrollWidth / 2;
  let position = 0;
  let speed = BASE_SPEED;
  let targetSpeed = BASE_SPEED;
  let lastTime = null;

  const updateHalfWidth = () => {
    halfWidth = track.scrollWidth / 2;
  };

  strip.addEventListener('mouseenter', () => { targetSpeed = HOVER_SPEED; });
  strip.addEventListener('mouseleave', () => { targetSpeed = BASE_SPEED; });
  window.addEventListener('resize', updateHalfWidth);

  const tick = (now) => {
    if (lastTime !== null) {
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      speed += (targetSpeed - speed) * EASE;
      position = (position + speed * dt) % halfWidth;
      track.style.transform = `translateX(${-position}px)`;
    }
    lastTime = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    btn.addEventListener('click', (e) => toggleTheme(e));
  });

  // ---------------------------------------------
  // TL;DR toggle
  // ---------------------------------------------
  document.querySelectorAll('.tldr-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.closest('.tldr').classList.toggle('is-open');
    });
  });

  // ---------------------------------------------
  // Detail modals ("Go in depth")
  // ---------------------------------------------
  const modalTriggers = document.querySelectorAll('[data-modal]');

  if (modalTriggers.length) {
    let lastFocused = null;

    const openModal = (modal, trigger) => {
      lastFocused = trigger || null;
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('modal-open');
      const closer = modal.querySelector('.cs-modal-close');
      if (closer) closer.focus();
      // Render any Mermaid diagrams now that the modal is on screen. Rendering
      // while the modal is display:none breaks text measurement.
      if (typeof window.renderCaseDiagrams === 'function') window.renderCaseDiagrams();
    };

    const closeModal = (modal) => {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      if (!document.querySelector('.cs-modal.is-open')) {
        document.body.classList.remove('modal-open');
      }
      if (lastFocused) {
        lastFocused.focus();
        lastFocused = null;
      }
    };

    modalTriggers.forEach((trigger) => {
      trigger.addEventListener('click', () => {
        const modal = document.getElementById('modal-' + trigger.dataset.modal);
        if (modal) openModal(modal, trigger);
      });
    });

    document.querySelectorAll('[data-modal-close]').forEach((el) => {
      el.addEventListener('click', () => {
        const modal = el.closest('.cs-modal');
        if (modal) closeModal(modal);
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const open = document.querySelector('.cs-modal.is-open');
        if (open) closeModal(open);
      }
    });
  }

  // ---------------------------------------------
  // Scroll reveal
  // ---------------------------------------------
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealEls.forEach((el) => observer.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }

  // ---------------------------------------------
  // "Go in depth" modals: skimmable page, detail on demand
  // ---------------------------------------------
  const modalOpeners = document.querySelectorAll('[data-modal-open]');
  if (modalOpeners.length) {
    let lastFocused = null;

    const closeModal = (modal) => {
      if (!modal) return;
      modal.classList.remove('is-open');
      document.body.classList.remove('modal-open');
      if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
      lastFocused = null;
    };

    const openModal = (modal, trigger) => {
      if (!modal) return;
      lastFocused = trigger || null;
      modal.classList.add('is-open');
      document.body.classList.add('modal-open');
      modal.scrollTop = 0;
      const closeBtn = modal.querySelector('[data-modal-close]');
      if (closeBtn) closeBtn.focus();
    };

    modalOpeners.forEach((btn) => {
      btn.addEventListener('click', () => {
        openModal(document.getElementById(btn.getAttribute('data-modal-open')), btn);
      });
    });

    document.querySelectorAll('.cs-modal').forEach((modal) => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.closest('[data-modal-close]')) closeModal(modal);
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const open = document.querySelector('.cs-modal.is-open');
      if (open) closeModal(open);
    });
  }

  // ---------------------------------------------
  // Before/after comparison slider + carousel
  // ---------------------------------------------
  document.querySelectorAll('[data-ba-slider]').forEach(initBeforeAfterSlider);
  document.querySelectorAll('[data-ba-carousel]').forEach(initBeforeAfterCarousel);
  document.querySelectorAll('.process-strip').forEach(initProcessStrip);

  // ---------------------------------------------
  // Pinned categories: scroll-linked crossfade + dots
  // ---------------------------------------------
  const pinSections = document.querySelectorAll('.outcome-pin');

  if (pinSections.length) {
    const STICKY_TOP = 84;

    const updatePinSections = () => {
      pinSections.forEach((pin) => {
        const subtotal = Number(pin.dataset.subtotal || 1);
        const frame = pin.querySelector('.is-pin-frame');
        if (!frame) return;

        const pinRect = pin.getBoundingClientRect();
        const frameHeight = frame.getBoundingClientRect().height;
        const scrollable = pinRect.height - frameHeight;
        if (scrollable <= 0) return;

        const progressPx = STICKY_TOP - pinRect.top;
        const progress = Math.min(1, Math.max(0, progressPx / scrollable));
        const activeIndex = Math.min(subtotal - 1, Math.floor(progress * subtotal));

        pin.querySelectorAll('.pin-slide').forEach((el, i) => el.classList.toggle('is-active', i === activeIndex));
        pin.querySelectorAll('.pin-layer').forEach((el, i) => el.classList.toggle('is-active', i === activeIndex));
        pin.querySelectorAll('.stack-dot').forEach((el, i) => el.classList.toggle('is-active', i === activeIndex));
      });
    };

    window.addEventListener('scroll', () => requestAnimationFrame(updatePinSections), { passive: true });
    window.addEventListener('resize', updatePinSections);
    updatePinSections();

    // On small screens the sticky crossfade is disabled and every slide
    // and every video renders in normal flow. Move each video to sit
    // directly under its own slide instead of leaving all the text
    // stacked first and all the videos stacked afterward.
    const pinMobileQuery = window.matchMedia('(max-width: 900px)');

    const layoutPinnedMediaForViewport = () => {
      pinSections.forEach((pin) => {
        const media = pin.querySelector('.outcome-media');
        const slides = Array.from(pin.querySelectorAll('.pin-slide'));
        const layers = Array.from(pin.querySelectorAll('.pin-layer'));
        if (!media || !slides.length || slides.length !== layers.length) return;

        if (pinMobileQuery.matches) {
          slides.forEach((slide, i) => slide.after(layers[i]));
          media.classList.add('is-emptied');
        } else {
          layers.forEach((layer) => media.appendChild(layer));
          media.classList.remove('is-emptied');
        }
      });
    };

    pinMobileQuery.addEventListener('change', layoutPinnedMediaForViewport);
    layoutPinnedMediaForViewport();
  }

  // ---------------------------------------------
  // Outcome media: click a video to view it full screen
  // ---------------------------------------------
  const outcomeVideos = document.querySelectorAll('.outcome-media-photo video');

  if (outcomeVideos.length) {
    const lightbox = document.createElement('div');
    lightbox.className = 'video-lightbox';
    lightbox.innerHTML = `
      <button class="video-lightbox-close" type="button" aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
      <div class="video-lightbox-stage"></div>
    `;
    document.body.appendChild(lightbox);

    const stage = lightbox.querySelector('.video-lightbox-stage');
    const closeBtn = lightbox.querySelector('.video-lightbox-close');
    let activeVideo = null;
    let activeVideoHome = null;

    const closeLightbox = () => {
      if (!activeVideo) return;
      activeVideo.removeAttribute('controls');
      activeVideoHome.appendChild(activeVideo);
      lightbox.classList.remove('is-open');
      document.body.classList.remove('lightbox-open');
      activeVideo = null;
      activeVideoHome = null;
    };

    const openLightbox = (video) => {
      activeVideo = video;
      activeVideoHome = video.parentElement;
      video.setAttribute('controls', '');
      stage.appendChild(video);
      lightbox.classList.add('is-open');
      document.body.classList.add('lightbox-open');
    };

    outcomeVideos.forEach((video) => {
      video.addEventListener('click', () => openLightbox(video));
    });

    closeBtn.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox || e.target === stage) closeLightbox();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeLightbox();
    });
  }
});
