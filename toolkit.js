document.addEventListener('DOMContentLoaded', () => {
  // --- SCROLL REVEAL ANIMATION ---
  const revealElements = document.querySelectorAll('.reveal');
  
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
  });

  revealElements.forEach(element => {
    revealObserver.observe(element);
  });

  // --- SECTION 2: INTERACTIVE VISUAL VOCABULARY TAGS ---
  const vocabTags = document.querySelectorAll('.vocab-pin-tag');
  const briefCodeEl = document.getElementById('demoBriefCode');
  
  const briefSnippets = {
    'light': 'Warm golden hour sunlight streaming in at 45 degrees, soft amber glow, natural shadows',
    'pose': 'Seated outfit POV, relaxed fashion posture, natural leg placement, editorial styling',
    'candid': 'Candid authentic expression, caught in a genuine moment, effortless vibe',
    'crop': 'Extreme asymmetrical crop, focusing on garment silhouette and textile folds, magazine layout',
    'mood': 'Peaceful quiet luxury aesthetic, serene atmosphere, high-end lookbook feel'
  };

  vocabTags.forEach(tag => {
    tag.addEventListener('click', () => {
      vocabTags.forEach(t => t.classList.remove('active'));
      tag.classList.add('active');
      const tagType = tag.getAttribute('data-tag');
      if (briefCodeEl && briefSnippets[tagType]) {
        briefCodeEl.style.opacity = '0.4';
        setTimeout(() => {
          briefCodeEl.textContent = briefSnippets[tagType];
          briefCodeEl.style.opacity = '1';
        }, 150);
      }
    });
  });

  // --- MOBILE STICKY CTA VISIBILITY ---
  const stickyMobileCta = document.getElementById('upsellStickyMobile');
  const triggerSection = document.getElementById('visual-direction-library');
  const offerSection = document.getElementById('upgrade-offer');

  window.addEventListener('scroll', () => {
    if (!stickyMobileCta || !triggerSection) return;

    const scrollY = window.scrollY;
    const triggerOffset = triggerSection.offsetTop;
    const offerOffset = offerSection ? offerSection.offsetTop : document.body.scrollHeight;
    const windowHeight = window.innerHeight;

    // Show after scrolling past first product explanation (Visual Direction Library)
    // Hide when reaching the actual offer section
    const isPastTrigger = scrollY > (triggerOffset - 100);
    const isBeforeOffer = (scrollY + windowHeight) < (offerOffset + 150);

    if (isPastTrigger && isBeforeOffer) {
      stickyMobileCta.classList.add('is-active');
    } else {
      stickyMobileCta.classList.remove('is-active');
    }
  });

  // --- SMOOTH SCROLL TO OFFER ---
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId && targetId !== '#') {
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
          e.preventDefault();
          targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }
    });
  });
});

// Analytics tracking helper
function trackUpsellEvent(eventName, eventDetails = {}) {
  if (typeof gtag === 'function') {
    gtag('event', eventName, eventDetails);
  }
  console.log('[PFL Event]', eventName, eventDetails);
}
