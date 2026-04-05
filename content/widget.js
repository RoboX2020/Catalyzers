/**
 * FitGenius — Injected Widget Component
 * Renders the recommendation UI inside a Shadow DOM on the shopping page
 */

const FG_Widget = (() => {

  let shadowRoot = null;
  let widgetEl = null;
  let toggleBtn = null;
  let isVisible = true;
  let currentRecommendation = null;
  let productData = null;
  let userProfile = null;

  /**
   * Create and inject the widget into the page
   */
  function create() {
    // Create host element
    const host = document.createElement('div');
    host.id = 'fitgenius-widget-host';
    document.body.appendChild(host);

    // Attach Shadow DOM
    shadowRoot = host.attachShadow({ mode: 'open' });

    // Load styles
    const styleLink = document.createElement('link');
    styleLink.rel = 'stylesheet';
    styleLink.href = chrome.runtime.getURL('content/widget.css');
    shadowRoot.appendChild(styleLink);

    // Create toggle button
    toggleBtn = document.createElement('button');
    toggleBtn.className = 'fg-toggle-btn';
    toggleBtn.innerHTML = '👔';
    toggleBtn.title = 'FitGenius Size Recommendations';
    toggleBtn.addEventListener('click', toggle);
    shadowRoot.appendChild(toggleBtn);

    // Create widget container
    widgetEl = document.createElement('div');
    widgetEl.className = 'fg-widget';
    shadowRoot.appendChild(widgetEl);

    // Make draggable
    makeDraggable(widgetEl);

    return { shadowRoot, widgetEl, toggleBtn };
  }

  /**
   * Show loading state
   */
  function showLoading() {
    if (!widgetEl) return;
    widgetEl.innerHTML = `
      ${renderHeader()}
      <div class="fg-content">
        <div class="fg-loading">
          <div class="fg-spinner"></div>
          <div class="fg-loading-text">Analyzing product for your perfect fit...</div>
        </div>
      </div>
    `;
    attachHeaderListeners();
  }

  /**
   * Show "no profile" state
   */
  function showNoProfile() {
    if (!widgetEl) return;
    widgetEl.innerHTML = `
      ${renderHeader()}
      <div class="fg-content">
        <div class="fg-no-profile">
          <div class="fg-no-profile-icon">📐</div>
          <h3>Set Up Your Profile</h3>
          <p>Enter your body measurements in FitGenius to get personalized size recommendations for every clothing item you browse.</p>
          <button class="fg-btn fg-btn-primary fg-btn-full" id="fg-open-profile">
            ✨ Set Up Measurements
          </button>
        </div>
      </div>
    `;
    attachHeaderListeners();
    shadowRoot.getElementById('fg-open-profile')?.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
      // Fallback: open extension popup
      alert('Click the FitGenius icon (👔) in your browser toolbar to set up your measurements.');
    });
  }

  /**
   * Show "not clothing" state
   */
  function showNotClothing() {
    if (!widgetEl) return;
    widgetEl.innerHTML = `
      ${renderHeader()}
      <div class="fg-content">
        <div class="fg-not-clothing">
          <div class="fg-not-clothing-icon">🛍️</div>
          <p>This doesn't appear to be a clothing product. Browse to a clothing item to get size recommendations!</p>
        </div>
      </div>
    `;
    attachHeaderListeners();
    
    // Auto-minimize for non-clothing
    setTimeout(() => {
      if (isVisible) toggle();
    }, 2000);
  }

  /**
   * Render full recommendation
   */
  function showRecommendation(recommendation, product, profile) {
    if (!widgetEl) return;
    
    currentRecommendation = recommendation;
    productData = product;
    userProfile = profile;

    if (recommendation.error || !recommendation.hasProfile) {
      showNoProfile();
      return;
    }

    const confClass = recommendation.confidence >= 70 ? 'high' : recommendation.confidence >= 45 ? 'medium' : 'low';
    const overallClass = recommendation.fitAnalysis?.overall || 'good';

    widgetEl.innerHTML = `
      ${renderHeader()}
      <div class="fg-content">
        
        <!-- Product Info -->
        ${product.images?.[0] ? `
        <div class="fg-product-info">
          <img class="fg-product-thumb" src="${product.images[0]}" alt="" onerror="this.style.display='none'">
          <div>
            <div class="fg-product-title">${truncate(product.title, 60)}</div>
            <div class="fg-product-meta">${product.brand || ''} ${product.price ? '· ' + product.price : ''}</div>
          </div>
        </div>
        ` : ''}

        <!-- Size Recommendation -->
        <div class="fg-rec-card ${recommendation.hasAIUpgrade ? 'fg-pulse-ai' : ''}">
          <div class="fg-rec-header">
            <span class="fg-rec-label">Recommended Size ${recommendation.hasAIUpgrade ? '<span style="color:#007185; font-size:10px; margin-left:6px; font-weight:800; border: 1px solid #007185; padding: 2px 4px; border-radius: 4px;">AI VERIFIED</span>' : ''}</span>
            <span class="fg-overall-status ${overallClass}">
              ${getOverallIcon(overallClass)} ${capitalize(overallClass)} Fit
            </span>
          </div>
          
          <div class="fg-rec-size">
            <span class="fg-size-badge">${recommendation.recommendedSize}</span>
            <div class="fg-size-info">
              ${recommendation.alternativeSize ? `
                <div class="fg-size-label">Also consider:</div>
                <span class="fg-alt-size">${recommendation.alternativeSize}</span>
              ` : `
                <div class="fg-size-label">Best match for your measurements</div>
              `}
            </div>
          </div>

          <!-- Confidence -->
          <div class="fg-confidence">
            <div class="fg-confidence-bar">
              <div class="fg-confidence-fill ${confClass}" style="width: ${recommendation.confidence}%"></div>
            </div>
            <div class="fg-confidence-text">
              <span class="fg-confidence-label">Confidence</span>
              <span class="fg-confidence-value ${confClass}">${recommendation.confidence}%</span>
            </div>
          </div>
        </div>

        <!-- Fit Analysis -->
        ${renderFitAnalysis(recommendation)}

        <!-- Material Info -->
        ${renderMaterialInfo(recommendation)}

        <!-- Tips -->
        ${renderTips(recommendation)}

        <!-- AI Reference Comparison -->
        ${renderReferenceComparison(recommendation)}

        <!-- Save button -->
        <button class="fg-btn fg-btn-secondary fg-btn-full" id="fg-save-rec" style="background:#FF9900;color:#000;">
          Save Recommendation
        </button>

      </div>
      <div class="fg-footer">
        <span class="fg-footer-text">Shop With Confidence</span>
        <span class="fg-footer-link" id="fg-view-history">History</span>
      </div>
    `;

    attachHeaderListeners();

    // Save recommendation listener
    shadowRoot.getElementById('fg-save-rec')?.addEventListener('click', () => {
      chrome.runtime.sendMessage({
        type: 'SAVE_RECOMMENDATION',
        data: {
          title: product.title,
          size: recommendation.recommendedSize,
          confidence: recommendation.confidence,
          fit: recommendation.fitAnalysis?.overall,
          asin: product.asin,
          url: product.url,
          price: product.price
        }
      });
      const btn = shadowRoot.getElementById('fg-save-rec');
      if (btn) {
        btn.innerHTML = '✅ Saved!';
        btn.style.pointerEvents = 'none';
      }
    });

    // Pulse the toggle button
    toggleBtn?.classList.add('has-rec');
  }

  // ─── Render Helpers ───

  function renderHeader() {
    return `
      <div class="fg-header" id="fg-drag-handle">
        <div class="fg-logo">
          <div class="fg-logo-text" style="text-transform:uppercase;">Shop With Confidence</div>
        </div>
        <div class="fg-header-actions">
          <button class="fg-btn-icon" id="fg-btn-refresh" title="Refresh">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 1 0 2.1-5.8L2 9"></path></svg>
          </button>
          <button class="fg-btn-icon" id="fg-btn-minimize" title="Minimize">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
          <button class="fg-btn-icon" id="fg-btn-close" title="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>
    `;
  }

  function renderFitAnalysis(rec) {
    const areas = rec.fitAnalysis?.areas || {};
    if (Object.keys(areas).length === 0) return '';

    const items = Object.entries(areas).map(([area, info]) => `
      <div class="fg-fit-item">
        <div class="fg-fit-area">${capitalize(area)}</div>
        <div class="fg-fit-status ${info.status}">
          <span class="fg-fit-dot ${info.status}"></span>
          ${info.description || capitalize(info.status.replace(/-/g, ' '))}
        </div>
      </div>
    `).join('');

    return `
      <div class="fg-fit-section">
        <div class="fg-section-title">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
          FIT ANALYSIS
        </div>
        <div class="fg-fit-grid">${items}</div>
        ${rec.fitAnalysis?.summary ? `
          <div class="fg-fit-summary">
            <p>${rec.fitAnalysis.summary}</p>
          </div>
        ` : ''}
      </div>
    `;
  }

  function renderMaterialInfo(rec) {
    if (!rec.material || rec.material.detected === 'unknown') return '';

    const breathabilityDots = Array.from({ length: 10 }, (_, i) => 
      `<span class="fg-breathability-dot ${i < rec.material.breathability ? 'active' : ''}"></span>`
    ).join('');

    return `
      <div class="fg-material-card">
        <div class="fg-section-title">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>
          MATERIAL INFO: ${capitalize(rec.material.detected.replace(/-/g, ' '))}
        </div>
        <div class="fg-material-grid">
          <div class="fg-material-stat">
            <div class="fg-material-stat-value">${Math.round((rec.material.stretchFactor - 1) * 100)}%</div>
            <div class="fg-material-stat-label">Stretch</div>
          </div>
          <div class="fg-material-stat">
            <div class="fg-material-stat-value">${capitalize(rec.material.weight)}</div>
            <div class="fg-material-stat-label">Weight</div>
          </div>
          <div class="fg-material-stat">
            <div class="fg-breathability-dots">${breathabilityDots}</div>
            <div class="fg-material-stat-label">Breathability</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderReviewInsights(rec) {
    if (!rec.reviewInsights || rec.reviewInsights.confidence === 'low') return '';

    const sentimentEmoji = {
      'runs-small': '📏⬆️',
      'runs-large': '📐⬇️',
      'true-to-size': '✅'
    };

    const stats = rec.reviewInsights.stats;
    
    return `
      <div class="fg-reviews-card">
        <div class="fg-section-title">
          <span class="fg-section-icon">💬</span>
          What Buyers Say About Fit
        </div>
        <div class="fg-review-sentiment">
          <span class="fg-review-emoji">${sentimentEmoji[rec.reviewInsights.sentiment] || '📊'}</span>
          <span class="fg-review-text">${rec.reviewInsights.details}</span>
        </div>
        ${stats ? `
          <div class="fg-review-stats">
            <span class="fg-review-stat">📏 Runs small: ${stats.runsSmall || 0}</span>
            <span class="fg-review-stat">✅ True to size: ${stats.trueTOSize || 0}</span>
            <span class="fg-review-stat">📐 Runs large: ${stats.runsLarge || 0}</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  function renderTips(rec) {
    if (!rec.tips || rec.tips.length === 0) return '';

    const tipsHtml = rec.tips.map(tip => `
      <div class="fg-tip">
        <span class="fg-tip-text" style="font-weight:600; padding-left: 4px;">• ${tip.text}</span>
      </div>
    `).join('');

    return `
      <div class="fg-tips">
        <div class="fg-section-title">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
          PRO TIPS
        </div>
        ${tipsHtml}
      </div>
    `;
  }

  function renderReferenceComparison(rec) {
    if (!rec.referenceComparison || !rec.referenceComparison.reasoning) return '';

    return `
      <div class="fg-reference-card" style="
        background: rgba(35, 47, 62, 0.4);
        border: 1px solid rgba(0, 113, 133, 0.5);
        border-radius: 10px; padding: 12px 14px; margin-bottom: 12px;
      ">
        <div class="fg-section-title" style="margin-bottom:8px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
          WARDROBE COMPARISON
        </div>
        <div style="font-size:12px;line-height:1.6;color:#f0f0f5;">
          ${rec.referenceComparison.reasoning}
        </div>
        ${rec.referenceComparison.materialDifference ? `
          <div style="font-size:11px;color:#9b9bb5;margin-top:6px;">
            <span style="font-weight:700;">Material Note:</span> ${rec.referenceComparison.materialDifference}
          </div>
        ` : ''}
      </div>
    `;
  }

  // ─── Interactions ───

  function attachHeaderListeners() {
    shadowRoot.getElementById('fg-btn-minimize')?.addEventListener('click', toggle);
    shadowRoot.getElementById('fg-btn-close')?.addEventListener('click', hide);
    shadowRoot.getElementById('fg-btn-refresh')?.addEventListener('click', () => {
      if (typeof FG_Content !== 'undefined') {
        FG_Content.analyze();
      }
    });
  }

  function toggle() {
    isVisible = !isVisible;
    if (widgetEl) {
      widgetEl.style.display = isVisible ? 'block' : 'none';
    }
  }

  function show() {
    isVisible = true;
    if (widgetEl) widgetEl.style.display = 'block';
    if (toggleBtn) toggleBtn.style.display = 'flex';
  }

  function hide() {
    isVisible = false;
    if (widgetEl) widgetEl.style.display = 'none';
    // Keep toggle button visible
  }

  function destroy() {
    const host = document.getElementById('fitgenius-widget-host');
    if (host) host.remove();
    shadowRoot = null;
    widgetEl = null;
    toggleBtn = null;
  }

  // ─── Draggable ───

  function makeDraggable(el) {
    let isDragging = false;
    let startX, startY, origX, origY;

    el.addEventListener('mousedown', (e) => {
      if (e.target.closest('.fg-header') && !e.target.closest('.fg-btn-icon')) {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = el.getBoundingClientRect();
        origX = rect.left;
        origY = rect.top;
        e.preventDefault();
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      el.style.position = 'fixed';
      el.style.left = (origX + dx) + 'px';
      el.style.top = (origY + dy) + 'px';
      el.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  // ─── Utilities ───

  function truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.substring(0, len) + '...' : str;
  }

  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function getOverallIcon(status) {
    const colors = { excellent: '#00fa9a', good: '#00e5ff', tight: '#FF9900', loose: '#ff4500' };
    const color = colors[status] || '#ffffff';
    return `<svg width="10" height="10" viewBox="0 0 10 10" style="margin-right:4px;"><circle cx="5" cy="5" r="5" fill="${color}" /></svg>`;
  }

  return {
    create,
    showLoading,
    showNoProfile,
    showNotClothing,
    showRecommendation,
    toggle,
    show,
    hide,
    destroy,
    isVisible: () => isVisible
  };
})();

if (typeof window !== 'undefined') {
  window.FG_Widget = FG_Widget;
}
