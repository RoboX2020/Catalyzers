/**
 * FitGenius — Main Content Script Orchestrator v4
 * 
 * Two modes:
 * A) SEARCH/BROWSE PAGE: Inject AI confidence badges on product cards
 * B) PRODUCT PAGE: Full recommendation widget (instant offline → AI-enhanced)
 */

const FG_Content = (() => {

  let initialized = false;
  let currentExtractor = null;
  let analyzeTimeout = null;

  /**
   * Initialize FitGenius on the current page
   */
  function init() {
    if (initialized) return;
    initialized = true;

    console.log('[FitGenius] Initializing on', window.location.hostname);

    currentExtractor = selectExtractor();

    // ─── MODE A: Search/Browse page → badge product cards ───
    if (isSearchPage()) {
      console.log('[FitGenius] Search/browse page detected — starting card badges');
      initCardBadges();
      watchForNavigation();
      return;
    }

    // ─── MODE B: Product page → full recommendation ───
    if (currentExtractor.isProductPage()) {
      if (!currentExtractor.isClothingProduct()) {
        const existing = document.getElementById('fitgenius-widget-host');
        if (existing) existing.remove();
        return;
      }
      
      FG_Widget.create();
      analyze();
      return;
    }

    // Neither — watch for navigation
    console.log('[FitGenius] Not a product or search page, watching...');
    watchForNavigation();
  }

  /**
   * Detect if this is a search/browse/category page
   */
  function isSearchPage() {
    const url = window.location.href.toLowerCase();
    const hostname = window.location.hostname.toLowerCase();

    if (hostname.includes('amazon')) {
      return (
        url.includes('/s?') ||          // Search results
        url.includes('/s/') ||           // Search path
        url.includes('/b/') ||           // Browse node
        url.includes('/gp/browse') ||    // Browse
        url.includes('/deals') ||        // Deals
        url.includes('/wishlist') ||     // Wishlist
        document.querySelector('.s-main-slot, .s-search-results, [data-component-type="s-search-result"]') !== null
      );
    }
    return false;
  }

  /**
   * Initialize card badges on search page
   */
  async function initCardBadges() {
    if (typeof FG_CardBadges === 'undefined') {
      console.warn('[FitGenius] Card badge module not loaded');
      return;
    }

    const hasProfile = await FG_CardBadges.init();
    if (!hasProfile) {
      console.log('[FitGenius] No profile set — skipping card badges');
      return;
    }

    // Initial scan
    setTimeout(() => FG_CardBadges.scanAndBadge(), 1500);

    // Watch for new cards (infinite scroll, etc.)
    FG_CardBadges.observe();
  }

  /**
   * Two-phase analysis for product pages
   */
  async function analyze() {
    FG_Widget.showLoading();

    try {
      const [profileData, refProducts] = await Promise.all([
        getProfile(),
        getReferenceProducts()
      ]);
      
      if (!profileData || !profileData.measurements) {
        FG_Widget.showNoProfile();
        return;
      }

      const product = currentExtractor.extractProductData();
      console.log('[FitGenius] Product data:', product);

      if (!product.title) {
        const existing = document.getElementById('fitgenius-widget-host');
        if (existing) existing.remove();
        return;
      }

      // ─── Phase 1: INSTANT offline recommendation ───
      const refProduct = findBestReference(refProducts, product);
      const offlineRec = FG_Recommender.generateRecommendation(profileData, product, refProduct);
      console.log('[FitGenius] Offline recommendation:', offlineRec);

      FG_Widget.showRecommendation(offlineRec, product, profileData);

      // ─── Phase 2: AI UPGRADE ───
      upgradeWithAI(profileData, product, refProducts, offlineRec);

    } catch (error) {
      console.error('[FitGenius] Analysis error:', error);
      FG_Widget.showNoProfile();
    }
  }

  /**
   * Asynchronously enhance with Gemini AI
   */
  async function upgradeWithAI(profileData, product, refProducts, offlineRec) {
    try {
      const [reviewResult, compareResult, fullAnalysisResult] = await Promise.all([
        sendToBackground('GEMINI_ANALYZE_REVIEWS', { reviews: product.reviews || [] }),
        refProducts.length > 0 
          ? sendToBackground('GEMINI_COMPARE_PRODUCTS', {
              userProfile: profileData,
              newProduct: product,
              referenceProducts: refProducts
            })
          : Promise.resolve({ fallback: true }),
        sendToBackground('GEMINI_FULL_ANALYSIS', { product, userProfile: profileData })
      ]);

      let aiReviewInsights = null;
      let aiComparison = null;
      let aiFullFit = null;
      let hasAIUpgrade = false;

      if (reviewResult?.success && reviewResult.data) {
        aiReviewInsights = reviewResult.data;
        hasAIUpgrade = true;
      }

      if (compareResult?.success && compareResult.data) {
        aiComparison = compareResult.data;
        hasAIUpgrade = true;
      }
      
      if (fullAnalysisResult?.success && fullAnalysisResult.data && fullAnalysisResult.data.recommendedSize) {
        aiFullFit = fullAnalysisResult.data;
        hasAIUpgrade = true;
      }

      if (!hasAIUpgrade) return;

      // Merge AI upgrades into recommendation
      let enhancedRec = enhanceRecommendation(offlineRec, aiReviewInsights, aiComparison, profileData);
      
      // Override exact size and score metrics if the full AI model succeeded
      if (aiFullFit) {
        enhancedRec.recommendedSize = aiFullFit.recommendedSize;
        enhancedRec.alternativeSize = aiFullFit.alternativeSize || enhancedRec.alternativeSize;
        enhancedRec.confidence = aiFullFit.confidence || enhancedRec.confidence;
        
        if (aiFullFit.fitSummary) {
          if (!enhancedRec.fitAnalysis) enhancedRec.fitAnalysis = {};
          enhancedRec.fitAnalysis.summary = aiFullFit.fitSummary;
        }
      }

      FG_Widget.showRecommendation(enhancedRec, product, profileData);
      
      // Inject inline AI summary directly into the product page
      injectInlineBanner(enhancedRec, aiReviewInsights);
      
      console.log('[FitGenius] ✨ Widget upgraded with AI insights');

    } catch (error) {
      console.warn('[FitGenius] AI upgrade failed:', error.message);
    }
  }

  /**
   * Inject a compact AI recommendation banner directly into the product page
   * so the user sees it right next to the size/buy section
   */
  function injectInlineBanner(rec, aiReviews) {
    // Don't double-inject
    if (document.getElementById('fg-inline-banner')) return;

    // Find an anchor point on the page
    const anchorSelectors = [
      '#variation_size_name',    // Amazon size selector
      '#twister_feature_div',    // Amazon variations area
      '#centerCol .a-section',   // Amazon center column section  
      '#buybox',                 // Buy box
      '#ppd',                    // Product page details
      '#dp-container'            // Alternate DP
    ];

    let anchor = null;
    for (const sel of anchorSelectors) {
      anchor = document.querySelector(sel);
      if (anchor) break;
    }
    if (!anchor) return;

    const size = rec.recommendedSize || '?';
    const confidence = parseInt(rec.confidence) || 0;
    
    let confTag = '';
    let confColor = '';
    let buyDecision = '';

    if (confidence >= 90) {
      confTag = 'Super Confident';
      confColor = '#00b894'; // Green
      buyDecision = 'YES — High probability of great fit.';
    } else if (confidence >= 75) {
      confTag = 'Confident';
      confColor = '#0984e3'; // Blue
      buyDecision = 'YES — Good fit match.';
    } else if (confidence >= 60) {
      confTag = 'Moderate';
      confColor = '#fdcb6e'; // Orange
      buyDecision = 'MAYBE — Check the sizing notes.';
    } else {
      confTag = 'Low Confidence';
      confColor = '#e17055'; // Red
      buyDecision = 'NO — High risk of poor fit.';
    }

    const reviewNote = (aiReviews?.details && aiReviews.details !== 'AI analysis complete') 
      ? aiReviews.details 
      : (aiReviews?.sentiment === 'runs-small' ? '⚠️ Reviewers say this runs small' 
        : aiReviews?.sentiment === 'runs-large' ? '⚠️ Reviewers say this runs large' 
        : '✅ Generally true to size');

    const banner = document.createElement('div');
    banner.id = 'fg-inline-banner';
    banner.innerHTML = `
      <div style="
        background: linear-gradient(135deg, rgba(26,26,46,0.95), rgba(22,33,62,0.95));
        border: 1px solid rgba(108,92,231,0.5);
        border-radius: 12px; padding: 16px; margin: 12px 0;
        font-family: 'Segoe UI', -apple-system, sans-serif;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        display: flex; align-items: flex-start; gap: 16px;
        cursor: pointer; transition: all 0.2s ease;
      " onclick="document.querySelector('.fg-widget')?.scrollIntoView({behavior:'smooth'})"
         onmouseover="this.style.boxShadow='0 6px 24px rgba(108,92,231,0.3)'"
         onmouseout="this.style.boxShadow='0 4px 20px rgba(0,0,0,0.2)'"
         title="Click for full AI analysis">
        
        <div style="
          min-width: 60px; height: 60px; border-radius: 12px;
          background: linear-gradient(135deg, #6C5CE7, #00cec9);
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          box-shadow: 0 4px 12px rgba(108,92,231,0.4);
        ">
          <div style="font-size: 24px; font-weight: 800; color: #fff; line-height: 1;">${size}</div>
          <div style="font-size: 9px; color: rgba(255,255,255,0.8); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; margin-top:2px;">Size</div>
        </div>

        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            <span style="font-size: 14px; font-weight: 700; color: #f0f0f5;">
              🤖 Buy Decision: <span style="color: ${confColor};">${buyDecision.split(' — ')[0]}</span>
            </span>
            <span style="
              font-size: 10px; font-weight: 700; color: #fff;
              background: ${confColor}; padding: 3px 8px; border-radius: 12px;
            ">${confTag} (${confidence}%)</span>
          </div>
          <div style="font-size: 12px; color: #b2bec3; line-height: 1.4; margin-bottom: 4px;">
            ${buyDecision.split(' — ')[1]}
          </div>
          <div style="font-size: 11px; color: #8F8FA6; line-height: 1.3; font-style: italic;">
            ${reviewNote}
          </div>
        </div>

        <div style="font-size: 11px; font-weight: 600; color: #a29bfe; white-space: nowrap; align-self: center;">
          Full analysis →
        </div>
      </div>
    `;

    anchor.insertAdjacentElement('afterend', banner);
  }

  /**
   * Merge AI insights into the recommendation
   */
  function enhanceRecommendation(offlineRec, aiReviews, aiComparison, profile) {
    const enhanced = { ...offlineRec };

    if (aiReviews) {
      enhanced.reviewInsights = aiReviews;
      enhanced.aiPowered = true;

      if (aiReviews.specificIssues && aiReviews.specificIssues.length > 0) {
        enhanced.aiSpecificIssues = aiReviews.specificIssues;
      }
    }

    if (aiComparison) {
      enhanced.referenceComparison = aiComparison;
      
      if (aiComparison.adjustments && aiComparison.adjustments.length > 0) {
        enhanced.tips = enhanced.tips || [];
        aiComparison.adjustments.forEach(adj => {
          enhanced.tips.unshift({ icon: '🤖', text: adj });
        });
      }
    }

    return enhanced;
  }

  function sendToBackground(type, data) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type, ...data }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ fallback: true, reason: chrome.runtime.lastError.message });
        } else {
          resolve(response);
        }
      });
    });
  }

  function selectExtractor() {
    const hostname = window.location.hostname.toLowerCase();
    if (hostname.includes('amazon')) return FG_AmazonExtractor;
    return FG_GenericExtractor;
  }

  function getProfile() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['profile'], (data) => resolve(data.profile || null));
    });
  }

  function getReferenceProducts() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['referenceProducts'], (data) => resolve(data.referenceProducts || []));
    });
  }

  function findBestReference(refProducts, currentProduct) {
    if (!refProducts || refProducts.length === 0) return null;

    const currentType = (currentProduct.clothingType || '').toLowerCase();
    const topTypes = ['t-shirt', 'shirt', 'tee', 'blouse', 'top', 'hoodie', 'sweater', 'jacket', 'coat'];
    const isTop = topTypes.includes(currentType);

    // Same type first
    let match = refProducts.find(rp => (rp.clothingType || '').toLowerCase() === currentType);
    if (match) return match;

    // Same category
    match = refProducts.find(rp => topTypes.includes((rp.clothingType || '').toLowerCase()) === isTop);
    if (match) return match;

    return refProducts[0];
  }

  function watchForNavigation() {
    let lastUrl = window.location.href;

    const observer = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        handleNavigation();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('popstate', handleNavigation);
  }

  function handleNavigation() {
    clearTimeout(analyzeTimeout);
    analyzeTimeout = setTimeout(() => {
      if (!currentExtractor) currentExtractor = selectExtractor();

      // Check if navigated to search page
      if (isSearchPage()) {
        initCardBadges();
        return;
      }

      // Check if navigated to product page
      if (currentExtractor.isProductPage()) {
        if (currentExtractor.isClothingProduct()) {
          if (!document.getElementById('fitgenius-widget-host')) {
            FG_Widget.create();
          }
          analyze();
        } else {
          const existing = document.getElementById('fitgenius-widget-host');
          if (existing) existing.remove();
        }
      }
    }, 1000);
  }

  // Listen for profile updates
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.profile) {
      if (currentExtractor?.isProductPage() && currentExtractor?.isClothingProduct()) {
        analyze();
      }
    }
  });

  return { init, analyze, selectExtractor };
})();

// ─── Bootstrap ───
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => FG_Content.init());
} else {
  setTimeout(() => FG_Content.init(), 1500);
}

if (typeof window !== 'undefined') window.FG_Content = FG_Content;
