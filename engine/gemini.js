/**
 * FitGenius — Gemini AI Integration Module v4
 * Handles all communication with Google's Gemini API
 * 
 * Capabilities:
 * 1. analyzeReviews() — Deep semantic review sentiment analysis
 * 2. extractProduct() — AI-powered product data extraction
 * 3. compareProducts() — Smart comparison with user's wardrobe
 * 4. batchScoreProducts() — Score multiple product cards in one call
 * 5. testConnection() — Verify API key works
 */

const FG_Gemini = (() => {

  const MODEL = 'gemini-2.5-flash'; // High-speed capable model
  const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
  const DEFAULT_API_KEY = ''; // Insert API key or use the Extension UI
  
  const cache = new Map();
  const CACHE_TTL = 30 * 60 * 1000;

  // ─── Core API Call ───

  async function callGemini(prompt, apiKey) {
    const key = apiKey || DEFAULT_API_KEY;
    if (!key) throw new Error('NO_API_KEY');

    const url = `${API_BASE}/${MODEL}:generateContent?key=${key}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData?.error?.message || response.statusText;
      if (response.status === 429) throw new Error('RATE_LIMITED');
      throw new Error(`API_ERROR: ${response.status} ${errorMsg}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('EMPTY_RESPONSE');

    try {
      return JSON.parse(text);
    } catch (e) {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) return JSON.parse(jsonMatch[1].trim());
      return { raw: text };
    }
  }

  function getCached(key) {
    const entry = cache.get(key);
    if (entry && Date.now() - entry.time < CACHE_TTL) return entry.data;
    cache.delete(key);
    return null;
  }

  function setCache(key, data) {
    if (cache.size > 100) cache.delete(cache.keys().next().value);
    cache.set(key, { data, time: Date.now() });
  }

  // ═══════════════════════════════════════
  // 1. REVIEW ANALYSIS
  // ═══════════════════════════════════════

  async function analyzeReviews(reviews, apiKey) {
    if (!reviews || reviews.length === 0) {
      return { sentiment: 'neutral', confidence: 'low', details: 'No reviews to analyze' };
    }

    const cacheKey = 'reviews_' + reviews.map(r => (r.text || r).substring(0, 30)).join('|').substring(0, 200);
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const reviewTexts = reviews
      .map((r, i) => `${i + 1}. "${(r.text || r).toString().substring(0, 300)}"`)
      .slice(0, 25).join('\n');

    const prompt = `You are a clothing fit analyst. Analyze these customer reviews for sizing and fit information.

REVIEWS:
${reviewTexts}

Return JSON:
{
  "sentiment": "runs-small" | "true-to-size" | "runs-large",
  "sizeAdjustment": -1 | 0 | 1,
  "confidence": "high" | "medium" | "low",
  "details": "One sentence summary of what reviewers say about fit",
  "specificIssues": [{"area": "chest|waist|shoulders|sleeves|length", "issue": "tight|loose|short|long", "frequency": "many|some|few"}],
  "shrinkageWarning": true | false,
  "brandComparison": "brand comparison note or null",
  "stats": {"runsSmall": 0, "trueTOSize": 0, "runsLarge": 0, "totalReviews": ${reviews.length}, "relevantReviews": 0}
}

Be precise. Only count reviews that ACTUALLY discuss sizing/fit.`;

    try {
      const result = await callGemini(prompt, apiKey);
      const normalized = {
        sentiment: ['runs-small', 'true-to-size', 'runs-large'].includes(result.sentiment) ? result.sentiment : 'true-to-size',
        sizeAdjustment: [-1, 0, 1].includes(result.sizeAdjustment) ? result.sizeAdjustment : 0,
        confidence: ['high', 'medium', 'low'].includes(result.confidence) ? result.confidence : 'medium',
        details: result.details || 'AI analysis complete',
        specificIssues: Array.isArray(result.specificIssues) ? result.specificIssues : [],
        shrinkageWarning: !!result.shrinkageWarning,
        brandComparison: result.brandComparison || null,
        stats: result.stats || { runsSmall: 0, trueTOSize: 0, runsLarge: 0, totalReviews: reviews.length, relevantReviews: 0 },
        source: 'gemini',
        mentions: []
      };
      if (normalized.sentiment === 'runs-small') normalized.mentions.push('Runs small');
      else if (normalized.sentiment === 'runs-large') normalized.mentions.push('Runs large');
      else normalized.mentions.push('True to size');
      if (normalized.shrinkageWarning) normalized.mentions.push('May shrink after wash');
      normalized.specificIssues.forEach(issue => normalized.mentions.push(`${issue.area}: ${issue.issue}`));

      setCache(cacheKey, normalized);
      return normalized;
    } catch (error) {
      console.warn('[FitGenius] Review analysis failed:', error.message);
      throw error;
    }
  }

  // ═══════════════════════════════════════
  // 2. PRODUCT DATA EXTRACTION
  // ═══════════════════════════════════════

  async function extractProduct(pageText, apiKey) {
    if (!pageText || pageText.length < 50) throw new Error('Page text too short');
    const cacheKey = 'product_' + pageText.substring(0, 100);
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const prompt = `Extract clothing product information from this e-commerce page text.

PAGE CONTENT:
${pageText.substring(0, 4000)}

Return JSON:
{"title":"","material":"","fitType":"slim|regular|relaxed|loose|athletic|oversized","gender":"men|women|unisex","clothingType":"t-shirt|shirt|pants|jeans|jacket|hoodie|dress|shorts|sweater|coat|blazer|skirt","brand":"","sizeChart":null}
Use null for missing fields.`;

    try {
      const result = await callGemini(prompt, apiKey);
      setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.warn('[FitGenius] Product extraction failed:', error.message);
      throw error;
    }
  }

  // ═══════════════════════════════════════
  // 3. REFERENCE PRODUCT COMPARISON
  // ═══════════════════════════════════════

  async function compareProducts(userProfile, newProduct, referenceProducts, apiKey) {
    if (!referenceProducts || referenceProducts.length === 0) return null;

    const refSummaries = referenceProducts.map(rp => 
      `- "${rp.title}" | Size: ${rp.size} | Fit: ${rp.fitFeedback || 'good'} | Type: ${rp.clothingType || 'unknown'}`
    ).join('\n');

    const m = userProfile.measurements || {};
    const prompt = `Clothing fit expert. Compare and recommend size.

USER: Gender: ${userProfile.gender || '?'}, Usual size: ${userProfile.usualTopSize || '?'}, Fit: ${userProfile.fitPreference || 'regular'} | Chest: ${m.chest || '?'}", Waist: ${m.waist || '?'}", Hip: ${m.hip || '?'}"

WARDROBE:
${refSummaries}

NEW PRODUCT: ${newProduct.title || '?'} | Material: ${newProduct.material || '?'} | Fit: ${newProduct.fitType || 'Regular'} | Brand: ${newProduct.brand || '?'}

Return JSON:
{"recommendedSize":"XS|S|M|L|XL|XXL","confidence":"high|medium|low","reasoning":"2-3 sentences","adjustments":["notes"],"comparedTo":"ref name","materialDifference":"note or null"}`;

    try {
      const result = await callGemini(prompt, apiKey);
      return {
        hasReference: true, source: 'gemini',
        recommendedSize: result.recommendedSize || null,
        confidence: result.confidence || 'medium',
        reasoning: result.reasoning || '',
        adjustments: result.adjustments || [],
        comparedTo: result.comparedTo || null,
        materialDifference: result.materialDifference || null
      };
    } catch (error) {
      console.warn('[FitGenius] Comparison failed:', error.message);
      throw error;
    }
  }

  // ═══════════════════════════════════════
  // 4. BATCH SCORE PRODUCT CARDS
  // ═══════════════════════════════════════

  async function batchScoreProducts(products, userProfile, apiKey) {
    if (!products || products.length === 0) return [];

    const cacheKey = 'batch_' + products.map(p => (p.title || '').substring(0, 15)).join('|').substring(0, 200);
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const uSize = userProfile.usualTopSize || '?';
    const m = userProfile.measurements || {};
    const userInfo = `Size:${uSize}, ${m.height?m.height+'in':''}, ${m.weight?m.weight+'lbs':''}, Shape:${userProfile.bodyShape||'?'}, Pref:${userProfile.fitPreference||'?'}`;

    // Provide context for accuracy but keep strings short
    const productList = products.map((p, i) => 
      `${i+1}. "${(p.title || '').substring(0, 75)}" (Rating: ${p.rating||'?'})`
    ).join('\n');

    const prompt = `Task: Calculate accurate fit scores (0-100) for clothing items based on the user's body profile.
User Profile: ${userInfo}

Logic: 90-100 (Perfect/True to size), 70-89 (Good), 50-69 (Tight/Loose), 0-49 (Poor fit). Consider user's weight, height, and fit preference against the product type (e.g. compression, relaxed).
STRICT SIZING RULE: NEVER recommend a size that is mathematically impossible (e.g. calculating 'S' for a 200lb person, or 'XXL' for a 110lb person). If the user prefers an 'oversized' fit, or has an 'inverted_triangle' (broad shoulders) or 'oval' (stomach) body shape, you MUST mathematically bump the recommended size UP by 1 or 2 sizes above their usual. If 'slim', bump down.

Items:
${productList}

Return ONLY a JSON array, nothing else:
[{"index":1,"isClothing":true,"score":92,"size":"${uSize}","note":"Good fit for your weight"}]
If not clothing, score 0. For "note", write a descriptive lined summary (10-15 words) explaining exactly why it is a confident/moderate choice for them.`;

    try {
      const result = await callGemini(prompt, apiKey);
      const scores = Array.isArray(result) ? result : (result.products || result.scores || []);
      setCache(cacheKey, scores);
      return scores;
    } catch (error) {
      console.warn('[FitGenius] Batch scoring failed:', error.message);
      throw error;
    }
  }

  // ═══════════════════════════════════════
  // 5. TEST CONNECTION
  // ═══════════════════════════════════════

  async function testConnection(apiKey) {
    try {
      const key = apiKey || DEFAULT_API_KEY;
      const url = `${API_BASE}/${MODEL}:generateContent?key=${key}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Respond: {"status":"ok"}' }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 20, responseMimeType: 'application/json' }
        })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { success: false, error: err?.error?.message || `HTTP ${response.status}` };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ═══════════════════════════════════════
  // 6. FULL FIT ANALYSIS
  // ═══════════════════════════════════════

  async function analyzeProductFit(product, userProfile, apiKey = DEFAULT_API_KEY) {
    const userInfo = `Gender: ${userProfile.gender || 'Unknown'}, Height: ${userProfile.measurements?.height || '0'}, Weight: ${userProfile.measurements?.weight || '0'}, Shape: ${userProfile.bodyShape || 'Standard'}, Usual Size: ${userProfile.usualTopSize || '?'}, Fit Pref: ${userProfile.fitPreference || 'Regular'}`;
    const prompt = `Task: Given the user profile and product details, determine the ultimate size recommendation and a confidence score (0-100).
User Profile: ${userInfo}
Product Info: ${product.title} | ${product.material || ''} 

STRICT SIZING RULE: NEVER recommend a size mathematically impossible (e.g. S for 200lbs). If they ask for oversized or have broad shoulders/'oval' shape, go up a size from their usual.

Return ONLY a valid JSON object matching this structure nothing else:
{"recommendedSize": "L", "alternativeSize": "XL", "confidence": 92, "fitSummary": "Brief physical explanation."}`;
    
    return await callGemini(prompt, apiKey);
  }

  return {
    analyzeReviews, extractProduct, compareProducts, batchScoreProducts, analyzeProductFit,
    testConnection, MODEL, DEFAULT_API_KEY
  };
})();

if (typeof self !== 'undefined') self.FG_Gemini = FG_Gemini;
