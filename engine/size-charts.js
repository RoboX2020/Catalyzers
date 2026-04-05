/**
 * FitGenius — Standard Size Charts Reference Database
 * Fallback size charts when product-specific charts aren't available
 * All measurements in inches
 */

const FG_SizeCharts = (() => {

  // Standard US size charts — measurements in inches
  const charts = {
    // ─── MEN'S TOPS (T-shirts, Shirts, Jackets) ───
    mens_tops: {
      sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
      measurements: {
        'XS':  { chest: [32, 34], waist: [26, 28], shoulder: 16.0, sleeve: 32.0, neck: 14.0 },
        'S':   { chest: [34, 36], waist: [28, 30], shoulder: 17.0, sleeve: 33.0, neck: 14.5 },
        'M':   { chest: [38, 40], waist: [32, 34], shoulder: 18.0, sleeve: 34.0, neck: 15.5 },
        'L':   { chest: [42, 44], waist: [36, 38], shoulder: 19.0, sleeve: 35.0, neck: 16.5 },
        'XL':  { chest: [46, 48], waist: [40, 42], shoulder: 20.0, sleeve: 35.5, neck: 17.5 },
        'XXL': { chest: [50, 52], waist: [44, 46], shoulder: 21.0, sleeve: 36.0, neck: 18.5 },
        '3XL': { chest: [54, 56], waist: [48, 50], shoulder: 22.0, sleeve: 36.5, neck: 19.5 }
      }
    },

    // ─── MEN'S BOTTOMS (Pants, Jeans) ───
    mens_bottoms: {
      sizes: ['28', '30', '32', '34', '36', '38', '40', '42'],
      measurements: {
        '28': { waist: [28, 29], hip: [34, 35], inseam: 30 },
        '30': { waist: [30, 31], hip: [36, 37], inseam: 30 },
        '32': { waist: [32, 33], hip: [38, 39], inseam: 32 },
        '34': { waist: [34, 35], hip: [40, 41], inseam: 32 },
        '36': { waist: [36, 37], hip: [42, 43], inseam: 32 },
        '38': { waist: [38, 39], hip: [44, 45], inseam: 32 },
        '40': { waist: [40, 41], hip: [46, 47], inseam: 32 },
        '42': { waist: [42, 43], hip: [48, 49], inseam: 32 }
      }
    },

    // ─── WOMEN'S TOPS ───
    womens_tops: {
      sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
      numericSizes: { '0-2': 'XS', '4-6': 'S', '8-10': 'M', '12-14': 'L', '16-18': 'XL', '20-22': 'XXL' },
      measurements: {
        'XS':  { chest: [30, 32], waist: [23, 25], hip: [33, 35], shoulder: 14.0 },
        'S':   { chest: [32, 34], waist: [25, 27], hip: [35, 37], shoulder: 14.5 },
        'M':   { chest: [34, 36], waist: [27, 29], hip: [37, 39], shoulder: 15.0 },
        'L':   { chest: [38, 40], waist: [31, 33], hip: [41, 43], shoulder: 15.5 },
        'XL':  { chest: [40, 42], waist: [33, 35], hip: [43, 45], shoulder: 16.0 },
        'XXL': { chest: [44, 46], waist: [37, 39], hip: [47, 49], shoulder: 17.0 }
      }
    },

    // ─── WOMEN'S BOTTOMS ───
    womens_bottoms: {
      sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
      numericSizes: { '0-2': 'XS', '4-6': 'S', '8-10': 'M', '12-14': 'L', '16-18': 'XL', '20-22': 'XXL' },
      measurements: {
        'XS':  { waist: [23, 25], hip: [33, 35], inseam: 29 },
        'S':   { waist: [25, 27], hip: [35, 37], inseam: 30 },
        'M':   { waist: [27, 29], hip: [37, 39], inseam: 30 },
        'L':   { waist: [31, 33], hip: [41, 43], inseam: 31 },
        'XL':  { waist: [33, 35], hip: [43, 45], inseam: 31 },
        'XXL': { waist: [37, 39], hip: [47, 49], inseam: 31 }
      }
    },

    // ─── WOMEN'S DRESSES ───
    womens_dresses: {
      sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
      measurements: {
        'XS':  { chest: [30, 32], waist: [23, 25], hip: [33, 35] },
        'S':   { chest: [32, 34], waist: [25, 27], hip: [35, 37] },
        'M':   { chest: [34, 36], waist: [27, 29], hip: [37, 39] },
        'L':   { chest: [38, 40], waist: [31, 33], hip: [41, 43] },
        'XL':  { chest: [40, 42], waist: [33, 35], hip: [43, 45] },
        'XXL': { chest: [44, 46], waist: [37, 39], hip: [47, 49] }
      }
    },

    // ─── UNISEX / T-SHIRTS ───
    unisex_tops: {
      sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
      measurements: {
        'XS':  { chest: [31, 34], waist: [25, 28], shoulder: 15.5 },
        'S':   { chest: [34, 37], waist: [28, 31], shoulder: 16.5 },
        'M':   { chest: [37, 40], waist: [31, 34], shoulder: 17.5 },
        'L':   { chest: [40, 44], waist: [34, 38], shoulder: 18.5 },
        'XL':  { chest: [44, 48], waist: [38, 42], shoulder: 19.5 },
        'XXL': { chest: [48, 52], waist: [42, 46], shoulder: 20.5 },
        '3XL': { chest: [52, 56], waist: [46, 50], shoulder: 21.5 }
      }
    }
  };

  // EU <-> US <-> UK size conversion maps 
  const conversions = {
    mens_tops: {
      US_to_EU: { 'XS': '44', 'S': '46', 'M': '48-50', 'L': '52', 'XL': '54-56', 'XXL': '58', '3XL': '60-62' },
      US_to_UK: { 'XS': '34', 'S': '36', 'M': '38-40', 'L': '42', 'XL': '44-46', 'XXL': '48', '3XL': '50-52' }
    },
    womens_tops: {
      US_to_EU: { 'XS': '32-34', 'S': '36', 'M': '38', 'L': '40-42', 'XL': '44', 'XXL': '46-48' },
      US_to_UK: { 'XS': '4-6', 'S': '8', 'M': '10-12', 'L': '14', 'XL': '16-18', 'XXL': '20-22' }
    }
  };

  /**
   * Determine which chart category to use based on product info
   */
  function detectCategory(productInfo) {
    const title = (productInfo.title || '').toLowerCase();
    const gender = productInfo.gender || detectGender(title);
    const type = productInfo.clothingType || detectClothingType(title);

    if (gender === 'men' || gender === 'male') {
      if (['pants', 'jeans', 'shorts', 'trousers', 'chinos', 'joggers', 'sweatpants'].some(t => type.includes(t))) {
        return 'mens_bottoms';
      }
      return 'mens_tops';
    } else if (gender === 'women' || gender === 'female') {
      if (['dress', 'gown', 'romper', 'jumpsuit'].some(t => type.includes(t))) {
        return 'womens_dresses';
      }
      if (['pants', 'jeans', 'shorts', 'trousers', 'leggings', 'skirt'].some(t => type.includes(t))) {
        return 'womens_bottoms';
      }
      return 'womens_tops';
    }
    return 'unisex_tops';
  }

  function detectGender(text) {
    const t = text.toLowerCase();
    if (/\b(men'?s?|male|boys?|guys?)\b/i.test(t) && !/\b(women)/i.test(t)) return 'men';
    if (/\b(women'?s?|female|girls?|ladies|lady)\b/i.test(t)) return 'women';
    return 'unisex';
  }

  function detectClothingType(text) {
    const t = text.toLowerCase();
    const types = [
      'dress', 'gown', 'romper', 'jumpsuit',
      'pants', 'jeans', 'shorts', 'trousers', 'chinos', 'joggers', 'sweatpants', 'leggings', 'skirt',
      't-shirt', 'tshirt', 'tee', 'shirt', 'blouse', 'top', 'tank',
      'jacket', 'coat', 'hoodie', 'sweater', 'sweatshirt', 'cardigan', 'blazer', 
      'suit', 'vest'
    ];
    for (const type of types) {
      if (t.includes(type)) return type;
    }
    return 'top';
  }

  /**
   * Get the appropriate size chart for a product
   */
  function getChart(productInfo) {
    const category = detectCategory(productInfo);
    return charts[category] || charts.unisex_tops;
  }

  /**
   * Normalize a size label (handle variations like "Large", "large", "lg", etc.)
   */
  function normalizeSize(sizeStr) {
    const s = sizeStr.trim().toUpperCase();
    const map = {
      'EXTRA SMALL': 'XS', 'XSMALL': 'XS',
      'SMALL': 'S', 'SM': 'S',
      'MEDIUM': 'M', 'MED': 'M', 'MD': 'M',
      'LARGE': 'L', 'LG': 'L',
      'EXTRA LARGE': 'XL', 'XLARGE': 'XL',
      'XX-LARGE': 'XXL', 'XXLARGE': 'XXL', '2X': 'XXL', '2XL': 'XXL',
      'XXX-LARGE': '3XL', 'XXXLARGE': '3XL', '3X': '3XL'
    };
    return map[s] || s;
  }

  return {
    charts,
    conversions,
    detectCategory,
    detectGender,
    detectClothingType,
    getChart,
    normalizeSize
  };
})();

if (typeof window !== 'undefined') {
  window.FG_SizeCharts = FG_SizeCharts;
}
