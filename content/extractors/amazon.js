/**
 * FitGenius — Amazon Product Data Extractor
 * Extracts product details from Amazon product pages using resilient DOM traversal
 */

const FG_AmazonExtractor = (() => {

  /**
   * Check if current page is an Amazon product page
   */
  function isProductPage() {
    return !!(
      document.getElementById('dp') ||
      document.getElementById('dp-container') ||
      document.getElementById('productTitle') ||
      document.querySelector('[data-asin]')
    );
  }

  /**
   * Check if product is a clothing item
   */
  function isClothingProduct() {
    const breadcrumb = getText('#wayfinding-breadcrumbs_container') || getText('.a-breadcrumb');
    const title = getTitle();
    const category = getText('#nav-subnav .nav-a:first-child') || '';
    
    const clothingKeywords = [
      'clothing', 'apparel', 'fashion', 'shirt', 'pants', 'jeans', 'dress',
      'jacket', 'coat', 'sweater', 'hoodie', 'blouse', 'skirt', 'shorts',
      't-shirt', 'tee', 'polo', 'suit', 'blazer', 'cardigan', 'legging',
      'jogger', 'sweatpant', 'tank top', 'vest', 'romper', 'jumpsuit',
      'underwear', 'boxer', 'bra', 'lingerie', 'sock', 'trouser', 'chino',
      'jeans', 'pullover', 'swimwear'
    ];

    const searchText = (breadcrumb + ' ' + title + ' ' + category).toLowerCase();
    return clothingKeywords.some(kw => new RegExp('\\b' + kw + '\\b').test(searchText));
  }

  /**
   * Extract all product data
   */
  function extractProductData() {
    return {
      title: getTitle(),
      price: getPrice(),
      images: getImages(),
      sizes: getAvailableSizes(),
      selectedSize: getSelectedSize(),
      sizeChart: extractSizeChart(),
      material: getMaterial(),
      fitType: getFitType(),
      gender: getGender(),
      clothingType: getClothingType(),
      color: getColor(),
      brand: getBrand(),
      rating: getRating(),
      reviewCount: getReviewCount(),
      reviews: getReviews(),
      description: getDescription(),
      asin: getASIN(),
      url: window.location.href
    };
  }

  // ─── Individual Extraction Functions ───

  function getTitle() {
    return getText('#productTitle') || 
           getText('#title span') || 
           getText('h1.product-title-word-break') ||
           getText('h1') || '';
  }

  function getPrice() {
    return getText('.a-price .a-offscreen') ||
           getText('#priceblock_ourprice') ||
           getText('#priceblock_dealprice') ||
           getText('.a-price-whole') || '';
  }

  function getImages() {
    const images = [];
    // Main image
    const mainImg = document.getElementById('landingImage') || 
                    document.getElementById('imgBlkFront') ||
                    document.querySelector('#main-image-container img');
    if (mainImg) {
      images.push(mainImg.src || mainImg.getAttribute('data-old-hires') || mainImg.getAttribute('data-a-dynamic-image'));
    }

    // Thumbnail images
    document.querySelectorAll('#altImages .a-button-thumbnail img, .imageThumbnail img').forEach(img => {
      const src = img.src?.replace(/\._.*_\./, '._AC_SL1500_.') || img.src;
      if (src && !images.includes(src)) images.push(src);
    });

    return images.slice(0, 5);
  }

  function getAvailableSizes() {
    const sizes = [];
    
    // Method 1: Size dropdown
    document.querySelectorAll('#native_dropdown_selected_size_name option, #size_name option').forEach(opt => {
      const val = opt.textContent.trim();
      if (val && !val.toLowerCase().includes('select') && !val.toLowerCase().includes('choose')) {
        sizes.push(val);
      }
    });

    // Method 2: Size buttons/swatches
    if (sizes.length === 0) {
      document.querySelectorAll('#variation_size_name .a-button-text, [id*="size"] .swatches-content .swatch-title-text, .swatch-title-text-display').forEach(el => {
        const val = el.textContent.trim();
        if (val && val.length < 20) sizes.push(val);
      });
    }

    // Method 3: Inline variations
    if (sizes.length === 0) {
      document.querySelectorAll('.twisterSwatchWrapper[data-dp-url*="size"], [data-defaultasin] .swatch').forEach(el => {
        const val = el.getAttribute('title') || el.textContent.trim();
        const cleaned = val.replace('Click to select ', '').trim();
        if (cleaned && cleaned.length < 20) sizes.push(cleaned);
      });
    }

    return [...new Set(sizes)];
  }

  function getSelectedSize() {
    const selected = document.querySelector('#native_dropdown_selected_size_name .a-dropdown-prompt');
    if (selected) return selected.textContent.trim();

    const activeBtn = document.querySelector('#variation_size_name .a-button-selected .a-button-text');
    if (activeBtn) return activeBtn.textContent.trim();

    return null;
  }

  function extractSizeChart() {
    // Try to find size chart data in the page
    const sizeChartData = {};

    // Method 1: Look for size chart table
    const tables = document.querySelectorAll('#productDetails_techSpec_section_1, #productDetails_detailBullets_sections1, .a-normal table, #size-chart-content table');
    
    for (const table of tables) {
      const headers = [];
      const rows = table.querySelectorAll('tr');
      
      rows.forEach((row, idx) => {
        const cells = row.querySelectorAll('th, td');
        if (idx === 0 || row.querySelector('th')) {
          cells.forEach(cell => headers.push(cell.textContent.trim().toLowerCase()));
        }
      });

      // Check if it looks like a size chart
      const sizeRelatedHeaders = ['size', 'chest', 'waist', 'hip', 'length', 'shoulder', 'sleeve'];
      const matches = headers.filter(h => sizeRelatedHeaders.some(sh => h.includes(sh)));
      
      if (matches.length >= 2) {
        // Parse the table into structured data
        return parseTable(table);
      }
    }

    // Method 2: Look for size chart in product description
    const descContent = document.getElementById('productDescription')?.innerHTML || '';
    if (descContent.includes('size') && descContent.includes('chart')) {
      const descTable = document.querySelector('#productDescription table');
      if (descTable) return parseTable(descTable);
    }

    return null;
  }

  function parseTable(table) {
    const result = { sizes: [], measurements: {} };
    const rows = table.querySelectorAll('tr');
    const headers = [];
    
    rows.forEach((row, rowIdx) => {
      const cells = Array.from(row.querySelectorAll('th, td')).map(c => c.textContent.trim());
      
      if (rowIdx === 0 && cells.length > 1) {
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
            const key = headers[i]?.toLowerCase().replace(/[^a-z]/g, '') || `dim${i}`;
            result.measurements[sizeName][key] = val;
          }
        }
      }
    });

    return result.sizes.length > 0 ? result : null;
  }

  function getMaterial() {
    // Try product details table
    const detailRows = document.querySelectorAll('#productDetails_techSpec_section_1 tr, #detailBullets_feature_div li, .a-unordered-list .a-list-item');
    
    for (const row of detailRows) {
      const text = row.textContent.toLowerCase();
      if (text.includes('fabric') || text.includes('material') || text.includes('composition')) {
        return row.textContent.replace(/[\n\r]+/g, ' ').trim();
      }
    }

    // Try feature bullets
    const bullets = document.querySelectorAll('#feature-bullets .a-list-item');
    for (const bullet of bullets) {
      const text = bullet.textContent.toLowerCase();
      if (text.includes('cotton') || text.includes('polyester') || text.includes('nylon') || 
          text.includes('spandex') || text.includes('linen') || text.includes('silk') ||
          text.includes('wool') || text.includes('denim') || text.includes('fabric')) {
        return bullet.textContent.trim();
      }
    }

    // Try the description
    const desc = getDescription();
    const materialPatterns = /(\d+%\s*\w+[\s,]*)+/gi;
    const match = desc.match(materialPatterns);
    if (match) return match[0].trim();

    return null;
  }

  function getFitType() {
    const detailRows = document.querySelectorAll('#productDetails_techSpec_section_1 tr, #detailBullets_feature_div li, .a-unordered-list .a-list-item');
    
    for (const row of detailRows) {
      const text = row.textContent.toLowerCase();
      if (text.includes('fit type') || text.includes('fit style')) {
        const fitTypes = ['slim', 'regular', 'relaxed', 'loose', 'athletic', 'classic', 'modern', 'tailored', 'oversized', 'skinny', 'straight'];
        for (const ft of fitTypes) {
          if (text.includes(ft)) return ft;
        }
      }
    }

    // Try title
    const title = getTitle().toLowerCase();
    const fitTypes = ['slim fit', 'regular fit', 'relaxed fit', 'loose fit', 'athletic fit', 'classic fit', 'oversized', 'skinny'];
    for (const ft of fitTypes) {
      if (title.includes(ft)) return ft.replace(' fit', '');
    }

    return null;
  }

  function getGender() {
    const title = getTitle();
    const breadcrumb = getText('#wayfinding-breadcrumbs_container') || '';
    const dept = getText('#nav-subnav .nav-a:first-child') || '';
    const text = (title + ' ' + breadcrumb + ' ' + dept).toLowerCase();

    return FG_SizeCharts.detectGender(text);
  }

  function getClothingType() {
    return FG_SizeCharts.detectClothingType(getTitle());
  }

  function getColor() {
    const selected = document.querySelector('#variation_color_name .selection, #variation_color_name .a-button-selected .a-button-text');
    if (selected) return selected.textContent.trim();

    const detailRows = document.querySelectorAll('#productDetails_techSpec_section_1 tr, #detailBullets_feature_div li');
    for (const row of detailRows) {
      const text = row.textContent.toLowerCase();
      if (text.includes('color') || text.includes('colour')) {
        return row.textContent.replace(/color|colour/gi, '').replace(/[\n\r:]+/g, ' ').trim();
      }
    }
    return null;
  }

  function getBrand() {
    return getText('#bylineInfo') || 
           getText('.a-link-normal[id="bylineInfo"]') || 
           getText('#brand') || '';
  }

  function getRating() {
    const ratingEl = document.querySelector('#acrPopover .a-icon-alt, [data-hook="rating-out-of-text"]');
    if (ratingEl) {
      const match = ratingEl.textContent.match(/[\d.]+/);
      return match ? parseFloat(match[0]) : null;
    }
    return null;
  }

  function getReviewCount() {
    const countEl = document.querySelector('#acrCustomerReviewText');
    if (countEl) {
      const match = countEl.textContent.match(/[\d,]+/);
      return match ? parseInt(match[0].replace(/,/g, '')) : 0;
    }
    return 0;
  }

  function getReviews() {
    const reviews = [];
    
    // Top reviews on page
    document.querySelectorAll('[data-hook="review"] .review-text-content span, .review-text .reviewText').forEach(el => {
      const text = el.textContent.trim();
      if (text.length > 10) {
        reviews.push({ text });
      }
    });

    // Also check the review summary section
    const reviewSummary = document.querySelector('#cr-dp-summarization-attributes');
    if (reviewSummary) {
      reviewSummary.querySelectorAll('.a-fixed-left-grid-col').forEach(el => {
        reviews.push({ text: el.textContent.trim(), type: 'summary' });
      });
    }

    return reviews.slice(0, 20);
  }

  function getDescription() {
    return getText('#productDescription') ||
           getText('#feature-bullets') ||
           getText('.a-section.a-spacing-medium') || '';
  }

  function getASIN() {
    // From URL
    const urlMatch = window.location.pathname.match(/\/dp\/([A-Z0-9]{10})/);
    if (urlMatch) return urlMatch[1];

    // From page
    const asinEl = document.querySelector('[data-asin]');
    if (asinEl) return asinEl.dataset.asin;

    return null;
  }

  // ─── Utility ───

  function getText(selector) {
    const el = document.querySelector(selector);
    return el ? el.textContent.trim() : null;
  }

  return {
    isProductPage,
    isClothingProduct,
    extractProductData,
    siteName: 'amazon'
  };
})();

if (typeof window !== 'undefined') {
  window.FG_AmazonExtractor = FG_AmazonExtractor;
}
