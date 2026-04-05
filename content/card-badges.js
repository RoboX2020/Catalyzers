/**
 * FitGenius — Product Card Badge System
 * Injects AI confidence badges on product cards in search/browse pages
 * Works on Amazon search results, category pages, deal pages, etc.
 */

const FG_CardBadges = (() => {

  let profile = null;
  let isScanning = false;
  const processedCards = new Set();

  // ─── Badge Styles (injected once) ───
  function injectStyles() {
    if (document.getElementById('fg-card-badge-styles')) return;
    const style = document.createElement('style');
    style.id = 'fg-card-badge-styles';
    style.textContent = `
      .fg-card-badge {
        position: absolute; top: 8px; right: 8px; z-index: 999;
        display: flex; align-items: center; gap: 4px;
        padding: 4px 10px; border-radius: 20px;
        font-family: 'Inter', -apple-system, sans-serif;
        font-size: 11px; font-weight: 700;
        backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
        box-shadow: 0 2px 12px rgba(0,0,0,0.25);
        cursor: pointer; transition: all 0.2s ease;
        pointer-events: auto;
        animation: fgBadgeFadeIn 0.4s ease-out;
      }
      .fg-card-badge:hover {
        transform: scale(1.08);
        box-shadow: 0 4px 20px rgba(0,0,0,0.35);
      }
      .fg-card-badge.fg-score-high {
        background: linear-gradient(135deg, rgba(0,184,148,0.92), rgba(0,206,201,0.92));
        color: #fff;
      }
      .fg-card-badge.fg-score-medium {
        background: linear-gradient(135deg, rgba(108,92,231,0.92), rgba(162,155,254,0.92));
        color: #fff;
      }
      .fg-card-badge.fg-score-low {
        background: linear-gradient(135deg, rgba(253,203,110,0.92), rgba(225,112,85,0.92));
        color: #fff;
      }
      .fg-card-badge.fg-score-none {
        background: rgba(100,100,130,0.8);
        color: rgba(255,255,255,0.7);
        font-size: 10px;
      }
      .fg-badge-score { font-size: 13px; font-weight: 800; }
      .fg-badge-label { font-size: 9px; font-weight: 500; opacity: 0.9; }
      .fg-badge-loading {
        position: absolute; top: 8px; right: 8px; z-index: 999;
        width: 28px; height: 28px; border-radius: 50%;
        background: rgba(108,92,231,0.85);
        backdrop-filter: blur(8px);
        display: flex; align-items: center; justify-content: center;
        animation: fgBadgeFadeIn 0.3s ease-out;
      }
      .fg-badge-spinner {
        width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3);
        border-top-color: #fff; border-radius: 50%;
        animation: fgSpin 0.8s linear infinite;
      }
      .fg-card-tooltip {
        position: absolute; top: 36px; right: 0; z-index: 1000;
        background: rgba(15,15,35,0.95); color: #f0f0f5;
        border: 1px solid rgba(108,92,231,0.4);
        border-radius: 10px; padding: 10px 14px;
        font-family: 'Inter', -apple-system, sans-serif;
        font-size: 11px; line-height: 1.5;
        min-width: 180px; max-width: 240px;
        backdrop-filter: blur(12px);
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        opacity: 0; pointer-events: none;
        transition: opacity 0.2s ease;
      }
      .fg-card-badge:hover + .fg-card-tooltip,
      .fg-card-tooltip:hover {
        opacity: 1; pointer-events: auto;
      }
      .fg-tooltip-size {
        font-size: 18px; font-weight: 800;
        background: linear-gradient(135deg, #6C5CE7, #00cec9);
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      }
      .fg-tooltip-note {
        color: rgba(255,255,255,0.6); margin-top: 4px; font-size: 10px;
      }
      @keyframes fgBadgeFadeIn {
        from { opacity: 0; transform: translateY(-6px) scale(0.9); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes fgSpin { to { transform: rotate(360deg); } }

      /* Ensure product cards have position:relative for badge positioning */
      [data-asin] .s-product-image-container,
      [data-asin] .a-section.a-spacing-small.s-padding-left-small.s-padding-right-small,
      .s-result-item .s-image-container,
      [data-component-type="s-search-result"] .s-image {
        position: relative !important;
      }
    `;
    document.head.appendChild(style);
  }

  // ─── Initialize ───
  async function init() {
    // Load user profile
    return new Promise(resolve => {
      chrome.storage.local.get(['profile'], (data) => {
        profile = data.profile || null;
        if (profile && profile.measurements) {
          injectStyles();
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }

  // ─── Scan page for product cards ───
  async function scanAndBadge() {
    if (isScanning || !profile) return;
    isScanning = true;

    try {
      const cards = findProductCards();
      const newCards = cards.filter(c => !processedCards.has(c.asin || c.element.dataset.asin || c.title));

      if (newCards.length === 0) {
        isScanning = false;
        return;
      }

      // Show loading spinners immediately
      let newlyQueued = 0;
      newCards.forEach(card => {
        const id = card.asin || card.element.dataset.asin || card.title;
        processedCards.add(id);
        showLoadingBadge(card);
        newlyQueued++;
      });
      
      // Store in outer scope so observer knows we did work
      FG_CardBadges._lastQueuedCount = newlyQueued;

      // Batch score via Gemini
      const productSummaries = newCards.map(c => ({
        title: c.title,
        rating: c.rating,
        price: c.price,
        reviewCount: c.reviewCount
      }));

      try {
        const response = await sendToBackground('GEMINI_BATCH_SCORE', {
          products: productSummaries,
          userProfile: profile
        });

        if (response?.success && response.data) {
          const scores = response.data;
          scores.forEach(score => {
            const idx = (score.index || 1) - 1;
            if (idx >= 0 && idx < newCards.length) {
              renderBadge(newCards[idx], score);
            }
          });
        } else {
          // Fallback: show offline scores
          newCards.forEach(card => renderOfflineBadge(card));
        }
      } catch (e) {
        console.warn('[FitGenius Cards] AI scoring failed:', e);
        newCards.forEach(card => renderOfflineBadge(card));
      }

    } finally {
      isScanning = false;
    }
  }

  // ─── Find product cards on Amazon ───
  function findProductCards() {
    const cards = [];
    
    // Amazon search results
    const selectors = [
      '[data-component-type="s-search-result"]',
      '[data-asin]:not([data-asin=""])',
      '.s-result-item[data-asin]'
    ];

    let elements = [];
    for (const sel of selectors) {
      elements = document.querySelectorAll(sel);
      if (elements.length > 0) break;
    }

    elements.forEach(el => {
      const asin = el.dataset.asin;
      if (!asin || asin === '') return;
      if (processedCards.has(asin)) return;

      // Extract product info from card
      const titleEl = el.querySelector('h2 a span, h2 span.a-text-normal, .a-link-normal .a-text-normal');
      const title = titleEl?.textContent?.trim() || '';
      if (!title || title.length < 5) return;

      const priceEl = el.querySelector('.a-price .a-offscreen, .a-price-whole');
      const price = priceEl?.textContent?.trim() || '';

      const ratingEl = el.querySelector('.a-icon-star-small .a-icon-alt, .a-icon-alt');
      const ratingText = ratingEl?.textContent || '';
      const rating = parseFloat(ratingText) || null;

      const reviewEl = el.querySelector('.a-size-small .a-link-normal .a-size-base, [aria-label*="stars"] + span');
      const reviewCount = reviewEl ? parseInt(reviewEl.textContent.replace(/[^0-9]/g, '')) || 0 : 0;

      // Find the image container to position badge
      const imageContainer = el.querySelector(
        '.s-product-image-container, .s-image-container, .a-section img'
      )?.closest('.s-product-image-container, .s-image-container, .a-section') || el.querySelector('.s-image')?.parentElement;

      if (imageContainer) {
        imageContainer.style.position = 'relative';
      }

      cards.push({
        element: el,
        imageContainer: imageContainer || el,
        asin, title, price, rating, reviewCount
      });
    });

    return cards.slice(0, 6); // Only first 6 visible products for speed
  }

  // ─── Show loading spinner ───
  function showLoadingBadge(card) {
    const existing = card.imageContainer.querySelector('.fg-card-badge, .fg-badge-loading');
    if (existing) existing.remove();

    const loader = document.createElement('div');
    loader.className = 'fg-badge-loading';
    loader.innerHTML = '<div class="fg-badge-spinner"></div>';
    card.imageContainer.appendChild(loader);
  }

  // ─── Render AI badge ───
  function renderBadge(card, score) {
    // Remove loader
    const loader = card.imageContainer.querySelector('.fg-badge-loading');
    if (loader) loader.remove();
    const existing = card.imageContainer.querySelector('.fg-card-badge');
    if (existing) existing.remove();
    const existingTooltip = card.imageContainer.querySelector('.fg-card-tooltip');
    if (existingTooltip) existingTooltip.remove();

    if (!score.isClothing) return; // Skip non-clothing

    const scoreVal = Math.min(100, Math.max(0, score.score || 0));
    
    // Only show top 3 tiers: Super Confident (90+), Confident (75+), Moderate (60+)
    if (scoreVal < 60) return;

    let scoreClass = '';
    let scoreLabel = '';
    
    if (scoreVal >= 90) {
      scoreClass = 'fg-score-high';
      scoreLabel = 'Super Confident';
    } else if (scoreVal >= 75) {
      scoreClass = 'fg-score-medium';
      scoreLabel = 'Confident';
    } else {
      scoreClass = 'fg-score-low';
      scoreLabel = 'Moderate';
    }

    const badge = document.createElement('div');
    badge.className = `fg-card-badge ${scoreClass}`;
    badge.innerHTML = `
      <span class="fg-badge-score">${scoreVal}%</span>
      <span class="fg-badge-label" style="font-size: 10px; margin-left: 3px;">${scoreLabel}</span>
    `;

    const tooltip = document.createElement('div');
    tooltip.className = 'fg-card-tooltip';
    tooltip.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <span class="fg-tooltip-size">${score.size || '?'}</span>
        <span style="font-size:10px;color:rgba(255,255,255,0.5);">Recommended</span>
      </div>
      <div style="font-size:11px;color:#f0f0f5;">${score.note || 'AI fit analysis'}</div>
      <div class="fg-tooltip-note">👔 FitGenius AI · Click product for full analysis</div>
    `;

    card.imageContainer.appendChild(badge);
    card.imageContainer.appendChild(tooltip);
  }

  // ─── Offline fallback badge (Disabled - users found it confusing) ───
  function renderOfflineBadge(card) {
    const loader = card.imageContainer.querySelector('.fg-badge-loading');
    if (loader) loader.remove();
  }

  // ─── Message helper ───
  function sendToBackground(type, data) {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type, ...data }, response => {
        if (chrome.runtime.lastError) {
          resolve({ fallback: true, reason: chrome.runtime.lastError.message });
        } else {
          resolve(response);
        }
      });
    });
  }

  // ─── Polling & Observation to gracefully catch dynamic cards ───
  let pollAttempts = 0;
  let pollingInterval = null;
  FG_CardBadges._lastQueuedCount = 0;

  function observe() {
    // Reset state for new navigation
    pollAttempts = 0;
    FG_CardBadges._lastQueuedCount = 0;
    if (pollingInterval) clearInterval(pollingInterval);

    // Initial strict poller
    pollingInterval = setInterval(() => {
      pollAttempts++;
      // Stop aggressive polling if we found our batch or timed out
      if (FG_CardBadges._lastQueuedCount > 0 || pollAttempts > 15) {
        clearInterval(pollingInterval);
        return;
      }
      scanAndBadge();
    }, 800);

    // Mutation observer for infinite scrolling / SPA pagination
    const observer = new MutationObserver((mutations) => {
      let shouldCheck = false;
      for (const m of mutations) {
        if (m.addedNodes.length > 0) {
          shouldCheck = true; 
          break;
        }
      }
      if (shouldCheck) {
        clearTimeout(observe._timeout);
        observe._timeout = setTimeout(scanAndBadge, 1200);
      }
    });

    const target = document.querySelector('.s-main-slot, .s-search-results, #search') || document.body;
    observer.observe(target, { childList: true, subtree: true });
  }

  return { init, scanAndBadge, observe };
})();

if (typeof window !== 'undefined') window.FG_CardBadges = FG_CardBadges;
