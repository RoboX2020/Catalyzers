/**
 * FitGenius — Generic Product Data Extractor
 * Fallback extractor for non-Amazon shopping sites
 * Uses schema.org, Open Graph, and common patterns
 */

const FG_GenericExtractor = (() => {

  /**
   * Check if current page looks like a product page
   */
  function isProductPage() {
    // Check for schema.org Product markup
    const ldJson = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of ldJson) {
      try {
        const data = JSON.parse(script.textContent);
        if (data['@type'] === 'Product' || (Array.isArray(data) && data.some(d => d['@type'] === 'Product'))) {
          return true;
        }
      } catch (e) {}
    }

    // Check for common product page patterns
    return !!(
      document.querySelector('[itemtype*="schema.org/Product"]') ||
      document.querySelector('meta[property="og:type"][content="product"]') ||
      document.querySelector('[data-product-id]') ||
      (document.querySelector('.product-detail, .product-page, #product-detail, .pdp-page') &&
       document.querySelector('select[name*="size"], .size-selector, [data-testid*="size"]'))
    );
  }

  /**
   * Check if product is clothing
   */
  function isClothingProduct() {
    const text = document.body.innerText.substring(0, 5000).toLowerCase();
    const title = getTitle().toLowerCase();
    
    const clothingKeywords = [
      'shirt', 'pants', 'jeans', 'dress', 'jacket', 'coat', 'sweater', 'hoodie',
      'blouse', 'skirt', 'shorts', 't-shirt', 'tee', 'polo', 'suit', 'blazer',
      'legging', 'jogger', 'sweatpant', 'cardigan', 'romper', 'jumpsuit',
      'clothing', 'apparel', 'swimwear', 'pullover'
    ];

    return clothingKeywords.some(kw => new RegExp('\\b' + kw + '\\b').test(title)) ||
           (clothingKeywords.filter(kw => new RegExp('\\b' + kw + '\\b').test(text)).length >= 3);
  }

  /**
   * Extract product data from any shopping site
   */
  function extractProductData() {
    // Try schema.org first
    const schemaData = extractSchemaOrg();
    
    return {
      title: schemaData.name || getTitle(),
      price: schemaData.price || getPrice(),
      images: schemaData.images || getImages(),
      sizes: getSizes(),
      selectedSize: getSelectedSize(),
      sizeChart: extractSizeChart(),
      material: getMaterial(),
      fitType: getFitType(),
      gender: getGender(),
      clothingType: getClothingType(),
      color: getColor(),
      brand: schemaData.brand || getBrand(),
      rating: schemaData.rating || getRating(),
      reviewCount: schemaData.reviewCount || 0,
      reviews: getReviews(),
      description: schemaData.description || getDescription(),
      url: window.location.href
    };
  }

  // ─── Schema.org Extraction ───

  function extractSchemaOrg() {
    const result = {};
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    
    for (const script of scripts) {
      try {
        let data = JSON.parse(script.textContent);
        if (Array.isArray(data)) data = data.find(d => d['@type'] === 'Product') || {};
        if (data['@type'] !== 'Product' && data['@graph']) {
          data = data['@graph'].find(d => d['@type'] === 'Product') || {};
        }
        
        if (data['@type'] === 'Product') {
          result.name = data.name;
          result.description = data.description;
          result.brand = data.brand?.name || data.brand;
          result.images = Array.isArray(data.image) ? data.image : data.image ? [data.image] : [];
          
          const offer = data.offers || (data.offers?.[0]);
          if (offer) {
            result.price = offer.price || offer.lowPrice;
          }

          const review = data.aggregateRating;
          if (review) {
            result.rating = parseFloat(review.ratingValue);
            result.reviewCount = parseInt(review.reviewCount || review.ratingCount || 0);
          }
        }
      } catch (e) {}
    }

    return result;
  }

  // ─── DOM-based Extraction ───

  function getTitle() {
    return getText('h1[itemprop="name"]') ||
           getText('h1.product-name') ||
           getText('h1.product-title') ||
           getText('.product-detail h1') ||
           document.querySelector('meta[property="og:title"]')?.content ||
           getText('h1') || '';
  }

  function getPrice() {
    return getText('[itemprop="price"]') ||
           getText('.product-price .current-price') ||
           getText('.price .current') ||
           document.querySelector('meta[property="product:price:amount"]')?.content || '';
  }

  function getImages() {
    const images = [];
    const ogImage = document.querySelector('meta[property="og:image"]')?.content;
    if (ogImage) images.push(ogImage);

    document.querySelectorAll('.product-image img, .gallery img, [itemprop="image"]').forEach(img => {
      if (img.src && !images.includes(img.src)) images.push(img.src);
    });
    return images.slice(0, 5);
  }

  function getSizes() {
    const sizes = [];
    
    // Size selectors
    document.querySelectorAll(
      'select[name*="size"] option, ' +
      '.size-selector button, .size-selector label, ' +
      '[data-testid*="size"] button, ' +
      '.size-list li, .size-options button, ' +
      '.size-picker button, .size-btn'
    ).forEach(el => {
      const val = el.textContent.trim() || el.value;
      if (val && val.length < 20 && !val.toLowerCase().includes('select')) {
        sizes.push(val);
      }
    });
    
    return [...new Set(sizes)];
  }

  function getSelectedSize() {
    const selected = document.querySelector(
      '.size-selector .active, .size-selector .selected, ' +
      '[data-testid*="size"] .selected, .size-btn.active'
    );
    return selected ? selected.textContent.trim() : null;
  }

  function extractSizeChart() {
    // Look for size chart tables
    const tables = document.querySelectorAll('.size-chart table, .sizing-chart table, [class*="size-guide"] table, table');
    
    for (const table of tables) {
      const text = table.textContent.toLowerCase();
      if (text.includes('size') && (text.includes('chest') || text.includes('waist') || text.includes('hip') || text.includes('length'))) {
        return parseTable(table);
      }
    }
    return null;
  }

  function parseTable(table) {
    const result = { sizes: [], measurements: {} };
    const rows = table.querySelectorAll('tr');
    const headers = [];
    
    rows.forEach((row, rowIdx) => {
      const cells = Array.from(row.querySelectorAll('th, td')).map(c => c.textContent.trim());
      
      if (rowIdx === 0) {
        headers.push(...cells);
        return;
      }

      if (cells.length > 1 && cells[0]) {
        const sizeName = cells[0];
        result.sizes.push(sizeName);
        result.measurements[sizeName] = {};
        for (let i = 1; i < cells.length && i < headers.length; i++) {
          const val = parseFloat(cells[i]);
          if (!isNaN(val)) {
            result.measurements[sizeName][headers[i].toLowerCase().replace(/[^a-z]/g, '')] = val;
          }
        }
      }
    });

    return result.sizes.length > 0 ? result : null;
  }

  function getMaterial() {
    const selectors = [
      '[itemprop="material"]',
      '.product-details li',
      '.product-info li',
      '.product-description li',
      '.product-attributes li'
    ];
    
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach(el => {
        const text = el.textContent.toLowerCase();
        if (text.includes('material') || text.includes('fabric') || text.includes('cotton') || text.includes('polyester')) {
          return el.textContent.trim();
        }
      });
    }
    
    const desc = getDescription().toLowerCase();
    const matMatch = desc.match(/(\d+%\s*\w+[\s,]*)+/);
    return matMatch ? matMatch[0] : null;
  }

  function getFitType() {
    const desc = (getTitle() + ' ' + getDescription()).toLowerCase();
    const fitTypes = ['slim', 'regular', 'relaxed', 'loose', 'athletic', 'oversized', 'skinny', 'tailored'];
    for (const ft of fitTypes) {
      if (desc.includes(ft + ' fit') || desc.includes(ft)) return ft;
    }
    return null;
  }

  function getGender() {
    const text = (getTitle() + ' ' + getDescription()).toLowerCase();
    return FG_SizeCharts.detectGender(text);
  }

  function getClothingType() {
    return FG_SizeCharts.detectClothingType(getTitle());
  }

  function getColor() {
    return getText('[itemprop="color"]') ||
           getText('.selected-color') ||
           getText('.color-name .selected') || null;
  }

  function getBrand() {
    return getText('[itemprop="brand"]') ||
           getText('.brand-name') ||
           document.querySelector('meta[property="og:brand"]')?.content || '';
  }

  function getRating() {
    const ratingEl = document.querySelector('[itemprop="ratingValue"]');
    return ratingEl ? parseFloat(ratingEl.content || ratingEl.textContent) : null;
  }

  function getReviews() {
    const reviews = [];
    document.querySelectorAll('.review-text, .review-body, [itemprop="reviewBody"]').forEach(el => {
      reviews.push({ text: el.textContent.trim() });
    });
    return reviews.slice(0, 20);
  }

  function getDescription() {
    return getText('[itemprop="description"]') ||
           getText('.product-description') ||
           getText('.product-details') ||
           document.querySelector('meta[property="og:description"]')?.content || '';
  }

  function getText(selector) {
    const el = document.querySelector(selector);
    return el ? el.textContent.trim() : null;
  }

  return {
    isProductPage,
    isClothingProduct,
    extractProductData,
    siteName: 'generic'
  };
})();

if (typeof window !== 'undefined') {
  window.FG_GenericExtractor = FG_GenericExtractor;
}
