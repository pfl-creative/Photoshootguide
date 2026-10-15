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
  // Ensure all Stripe checkout buttons trigger InitiateCheckout
  document.querySelectorAll('a[href*="buy.stripe.com"]').forEach(button => {
    button.addEventListener('click', function() {
      const href = this.getAttribute('href') || '';
      if (href.includes('4gMfZhbAt0z7f735NtcIE05')) {
        trackMetaInitiateCheckout('guide');
      } else if (href.includes('5kQ9ATgUN2Hf3olgs7cIE06')) {
        trackMetaInitiateCheckout('toolkit');
      }
    });
  });
});

// Debounce helper to prevent duplicate InitiateCheckout events on double clicks
let lastCheckoutTracked = 0;
function trackMetaInitiateCheckout(packageType) {
  const now = Date.now();
  if (now - lastCheckoutTracked < 800) return;
  lastCheckoutTracked = now;

  if (typeof fbq === 'function') {
    if (packageType === 'guide') {
      fbq('track', 'InitiateCheckout', {
        content_name: 'AI Photoshoot Guide',
        content_category: 'Ebook',
        content_ids: ['guide_99'],
        content_type: 'product',
        value: 99.00,
        currency: 'THB',
        num_items: 1
      });
      console.log('[Meta Pixel] InitiateCheckout tracked: AI Photoshoot Guide (99 THB)');
    } else {
      fbq('track', 'InitiateCheckout', {
        content_name: 'Complete AI Photoshoot Toolkit',
        content_category: 'Ebook & Toolkit',
        content_ids: ['toolkit_349'],
        content_type: 'product',
        value: 349.00,
        currency: 'THB',
        num_items: 1
      });
      console.log('[Meta Pixel] InitiateCheckout tracked: Complete AI Photoshoot Toolkit (349 THB)');
    }
  }
}

// Analytics tracking helper called by button onclick handlers
function trackUpsellEvent(eventName, eventDetails = {}) {
  if (typeof gtag === 'function') {
    gtag('event', eventName, eventDetails);
  }
  console.log('[PFL Event]', eventName, eventDetails);

  if (eventName.includes('guide_only')) {
    trackMetaInitiateCheckout('guide');
  } else if (eventName.includes('upgrade') || eventName.includes('toolkit')) {
    trackMetaInitiateCheckout('toolkit');
  }
}
