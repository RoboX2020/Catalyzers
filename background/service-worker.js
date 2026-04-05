/**
 * FitGenius — Background Service Worker v4
 * Manages API routing, storage, and batch card scoring
 */

importScripts('../engine/gemini.js');

// ─── Default API Key (auto-set on install) ───
const DEFAULT_KEY = FG_Gemini.DEFAULT_API_KEY;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['profile', 'history', 'geminiApiKey'], (data) => {
    if (!data.history) chrome.storage.local.set({ history: [] });
    // Auto-set API key if not already configured
    if (!data.geminiApiKey && DEFAULT_KEY) {
      chrome.storage.local.set({ geminiApiKey: DEFAULT_KEY });
    }
  });
  console.log('[FitGenius] Extension installed — Gemini AI enabled');
});

// ─── Message Handling ───

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {

    case 'SAVE_RECOMMENDATION':
      saveToHistory(message.data).then(() => sendResponse({ success: true }));
      return true;

    case 'GET_HISTORY':
      getHistory().then(history => sendResponse({ history }));
      return true;

    case 'GET_PROFILE':
      getProfile().then(profile => sendResponse({ profile }));
      return true;

    case 'CLEAR_HISTORY':
      clearHistory().then(() => sendResponse({ success: true }));
      return true;

    case 'GET_PRODUCT_HISTORY':
      getProductHistory(message.asin || message.url).then(data => sendResponse(data));
      return true;

    case 'CHECK_PROFILE':
      checkProfile().then(hasProfile => sendResponse({ hasProfile }));
      return true;

    // ─── API Key Management ───
    case 'SAVE_API_KEY':
      chrome.storage.local.set({ geminiApiKey: message.apiKey }, () => {
        sendResponse({ success: true });
      });
      return true;

    case 'GET_API_KEY':
      chrome.storage.local.get(['geminiApiKey'], (data) => {
        sendResponse({ apiKey: data.geminiApiKey || DEFAULT_KEY });
      });
      return true;

    case 'TEST_API_KEY':
      handleTestApiKey(message.apiKey).then(r => sendResponse(r));
      return true;

    // ─── Gemini AI Handlers ───
    case 'GEMINI_ANALYZE_REVIEWS':
      handleGeminiReviews(message.reviews).then(r => sendResponse(r));
      return true;

    case 'GEMINI_EXTRACT_PRODUCT':
      handleGeminiExtract(message.pageText).then(r => sendResponse(r));
      return true;

    case 'GEMINI_COMPARE_PRODUCTS':
      handleGeminiCompare(message.userProfile, message.newProduct, message.referenceProducts)
        .then(r => sendResponse(r));
      return true;

    case 'GEMINI_BATCH_SCORE':
      handleGeminiBatchScore(message.products, message.userProfile)
        .then(r => sendResponse(r));
      return true;

    case 'GEMINI_FULL_ANALYSIS':
      handleGeminiFullAnalysis(message.product, message.userProfile)
        .then(r => sendResponse(r));
      return true;

    default:
      sendResponse({ error: 'Unknown message type' });
  }
});

// ─── Gemini Handlers ───

async function handleTestApiKey(apiKey) {
  try { return await FG_Gemini.testConnection(apiKey); }
  catch (e) { return { success: false, error: e.message }; }
}

async function handleGeminiReviews(reviews) {
  try {
    const apiKey = await getApiKey();
    const result = await FG_Gemini.analyzeReviews(reviews, apiKey);
    return { success: true, data: result };
  } catch (e) {
    console.warn('[FitGenius] Review analysis fallback:', e.message);
    return { fallback: true, reason: e.message };
  }
}

async function handleGeminiExtract(pageText) {
  try {
    const apiKey = await getApiKey();
    const result = await FG_Gemini.extractProduct(pageText, apiKey);
    return { success: true, data: result };
  } catch (e) {
    return { fallback: true, reason: e.message };
  }
}

async function handleGeminiCompare(userProfile, newProduct, referenceProducts) {
  try {
    const apiKey = await getApiKey();
    const result = await FG_Gemini.compareProducts(userProfile, newProduct, referenceProducts, apiKey);
    return { success: true, data: result };
  } catch (e) {
    return { fallback: true, reason: e.message };
  }
}

async function handleGeminiBatchScore(products, userProfile) {
  try {
    const apiKey = await getApiKey();
    const result = await FG_Gemini.batchScoreProducts(products, userProfile, apiKey);
    return { success: true, data: result };
  } catch (e) {
    console.warn('[FitGenius] Batch scoring fallback:', e.message);
    return { fallback: true, reason: e.message };
  }
}

async function handleGeminiFullAnalysis(product, userProfile) {
  try {
    const apiKey = await getApiKey();
    const result = await FG_Gemini.analyzeProductFit(product, userProfile, apiKey);
    return { success: true, data: result };
  } catch (e) {
    console.warn('[FitGenius] Full analysis fallback:', e.message);
    return { fallback: true, reason: e.message };
  }
}

// ─── Storage Helpers ───

async function getApiKey() {
  const result = await chrome.storage.local.get(['geminiApiKey']);
  return result.geminiApiKey || DEFAULT_KEY;
}

async function saveToHistory(data) {
  const result = await chrome.storage.local.get(['history']);
  const history = result.history || [];
  history.unshift({ ...data, timestamp: Date.now(), date: new Date().toISOString() });
  if (history.length > 100) history.splice(100);
  await chrome.storage.local.set({ history });
}

async function getHistory() {
  const result = await chrome.storage.local.get(['history']);
  return result.history || [];
}

async function getProductHistory(identifier) {
  const result = await chrome.storage.local.get(['history']);
  return (result.history || []).filter(item => item.asin === identifier || item.url === identifier);
}

async function clearHistory() {
  await chrome.storage.local.set({ history: [] });
}

async function getProfile() {
  const result = await chrome.storage.local.get(['profile']);
  return result.profile || null;
}

async function checkProfile() {
  const result = await chrome.storage.local.get(['profile']);
  return !!(result.profile && result.profile.measurements);
}

// ─── Badge Management ───

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const isShoppingSite = /amazon|flipkart|myntra|ajio|nordstrom|zara|hm\.com|asos|uniqlo/i.test(tab.url);
    
    if (isShoppingSite) {
      const hasProfile = await checkProfile();
      chrome.action.setBadgeBackgroundColor({ tabId, color: hasProfile ? '#00b894' : '#E17055' });
      chrome.action.setBadgeText({ tabId, text: hasProfile ? 'AI' : '!' });
    } else {
      chrome.action.setBadgeText({ tabId, text: '' });
    }
  }
});
