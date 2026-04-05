/**
 * FitGenius — Material/Fabric Intelligence Database
 * Provides stretch factors, shrinkage info, and comfort adjustments
 */

const FG_Materials = (() => {
  // Fabric stretch factor: 1.0 = no stretch, higher = more stretch
  // comfort_offset: how many inches to subtract from body measurement for comfort
  // shrinkage: percentage the fabric shrinks after washing
  // breathability: 1-10 scale
  // weight: 'light', 'medium', 'heavy'
  const database = {
    'cotton': {
      stretchFactor: 1.02,
      comfortOffset: 0.5,
      shrinkage: 0.03,
      breathability: 8,
      weight: 'medium',
      care: 'May shrink slightly after first wash',
      keywords: ['cotton', '100% cotton', 'pure cotton', 'organic cotton', 'pima cotton', 'supima']
    },
    'polyester': {
      stretchFactor: 1.05,
      comfortOffset: 0.3,
      shrinkage: 0.01,
      breathability: 4,
      weight: 'light',
      care: 'Maintains shape well after washing',
      keywords: ['polyester', '100% polyester', 'poly']
    },
    'cotton-poly-blend': {
      stretchFactor: 1.08,
      comfortOffset: 0.4,
      shrinkage: 0.02,
      breathability: 6,
      weight: 'medium',
      care: 'Good balance of comfort and durability',
      keywords: ['cotton polyester', 'poly cotton', 'cotton blend', 'polycotton', 'cvc']
    },
    'spandex-blend': {
      stretchFactor: 1.20,
      comfortOffset: 0.0,
      shrinkage: 0.01,
      breathability: 5,
      weight: 'light',
      care: 'Stretchy and form-fitting',
      keywords: ['spandex', 'elastane', 'lycra', 'stretch']
    },
    'denim': {
      stretchFactor: 1.03,
      comfortOffset: 0.75,
      shrinkage: 0.04,
      breathability: 5,
      weight: 'heavy',
      care: 'May shrink, wash cold and hang dry for best results',
      keywords: ['denim', 'jean', 'jeans', 'chambray']
    },
    'stretch-denim': {
      stretchFactor: 1.15,
      comfortOffset: 0.25,
      shrinkage: 0.02,
      breathability: 5,
      weight: 'heavy',
      care: 'Comfortable stretch with denim look',
      keywords: ['stretch denim', 'denim with elastane', 'flex denim', 'stretch jean']
    },
    'linen': {
      stretchFactor: 1.0,
      comfortOffset: 1.0,
      shrinkage: 0.05,
      breathability: 10,
      weight: 'light',
      care: 'May shrink significantly, buy slightly larger',
      keywords: ['linen', '100% linen', 'flax']
    },
    'silk': {
      stretchFactor: 1.02,
      comfortOffset: 0.5,
      shrinkage: 0.02,
      breathability: 7,
      weight: 'light',
      care: 'Delicate, dry clean recommended',
      keywords: ['silk', '100% silk', 'mulberry silk', 'charmeuse']
    },
    'wool': {
      stretchFactor: 1.05,
      comfortOffset: 0.75,
      shrinkage: 0.06,
      breathability: 7,
      weight: 'heavy',
      care: 'Can felt/shrink if washed incorrectly',
      keywords: ['wool', 'merino', 'cashmere', 'lambswool', 'worsted']
    },
    'nylon': {
      stretchFactor: 1.10,
      comfortOffset: 0.2,
      shrinkage: 0.01,
      breathability: 3,
      weight: 'light',
      care: 'Durable and moisture-wicking',
      keywords: ['nylon', 'polyamide', 'ripstop']
    },
    'rayon': {
      stretchFactor: 1.05,
      comfortOffset: 0.5,
      shrinkage: 0.05,
      breathability: 8,
      weight: 'light',
      care: 'May shrink, gentle wash recommended',
      keywords: ['rayon', 'viscose', 'modal', 'tencel', 'lyocell', 'bamboo']
    },
    'fleece': {
      stretchFactor: 1.10,
      comfortOffset: 0.5,
      shrinkage: 0.02,
      breathability: 4,
      weight: 'medium',
      care: 'Warm and cozy, avoid high heat',
      keywords: ['fleece', 'polar fleece', 'microfleece']
    },
    'leather': {
      stretchFactor: 1.03,
      comfortOffset: 1.0,
      shrinkage: 0.0,
      breathability: 2,
      weight: 'heavy',
      care: 'Will stretch to mold to body over time',
      keywords: ['leather', 'genuine leather', 'full grain', 'nappa', 'suede', 'faux leather', 'vegan leather', 'pu leather']
    },
    'knit': {
      stretchFactor: 1.15,
      comfortOffset: 0.25,
      shrinkage: 0.03,
      breathability: 6,
      weight: 'medium',
      care: 'Flexible and comfortable',
      keywords: ['knit', 'jersey', 'rib knit', 'interlock', 'french terry', 'terry cloth']
    }
  };

  /**
   * Detect material from product description text
   * @param {string} text - Product description or material info
   * @returns {Object} Detected material(s) with properties
   */
  function detectMaterial(text) {
    if (!text) return getDefault();
    
    const lowerText = text.toLowerCase();
    const detected = [];
    const percentages = {};

    // Try to extract percentage compositions like "60% cotton, 40% polyester"
    const percentRegex = /(\d+)\s*%\s*([\w\s-]+)/g;
    let match;
    while ((match = percentRegex.exec(lowerText)) !== null) {
      const pct = parseInt(match[1]);
      const materialName = match[2].trim();
      percentages[materialName] = pct;
    }

    // Match against database
    for (const [key, material] of Object.entries(database)) {
      for (const keyword of material.keywords) {
        if (lowerText.includes(keyword)) {
          detected.push({ key, ...material });
          break;
        }
      }
    }

    if (detected.length === 0) return getDefault();

    // If multiple materials, compute weighted properties
    if (detected.length > 1) {
      return blendMaterials(detected, percentages);
    }

    return detected[0];
  }

  /**
   * Blend multiple material properties based on composition
   */
  function blendMaterials(materials, percentages) {
    let totalStretch = 0;
    let totalComfort = 0;
    let totalShrinkage = 0;
    let totalBreathability = 0;
    let totalWeight = 0;
    let count = materials.length;

    materials.forEach(mat => {
      // Find percentage for this material
      let pct = 1 / count; // default equal weight
      for (const [name, p] of Object.entries(percentages)) {
        for (const kw of mat.keywords) {
          if (name.includes(kw) || kw.includes(name)) {
            pct = p / 100;
            break;
          }
        }
      }

      totalStretch += mat.stretchFactor * pct;
      totalComfort += mat.comfortOffset * pct;
      totalShrinkage += mat.shrinkage * pct;
      totalBreathability += mat.breathability * pct;
      const w = mat.weight === 'light' ? 1 : mat.weight === 'medium' ? 2 : 3;
      totalWeight += w * pct;
    });

    return {
      key: 'blend',
      stretchFactor: totalStretch,
      comfortOffset: totalComfort,
      shrinkage: totalShrinkage,
      breathability: Math.round(totalBreathability),
      weight: totalWeight < 1.5 ? 'light' : totalWeight < 2.5 ? 'medium' : 'heavy',
      care: materials.map(m => m.care).join('. '),
      keywords: [],
      components: materials.map(m => m.key)
    };
  }

  function getDefault() {
    return {
      key: 'unknown',
      stretchFactor: 1.05,
      comfortOffset: 0.5,
      shrinkage: 0.02,
      breathability: 5,
      weight: 'medium',
      care: 'Follow garment care label',
      keywords: []
    };
  }

  /**
   * Get adjustment factor for shrinkage after washing
   * Returns a multiplier to apply to garment measurements
   */
  function getShrinkageAdjustment(material) {
    return 1 - (material.shrinkage || 0.02);
  }

  /**
   * Get how much extra room is needed for comfort
   * based on material type
   */
  function getComfortAllowance(material) {
    return material.comfortOffset || 0.5;
  }

  return {
    detectMaterial,
    getShrinkageAdjustment,
    getComfortAllowance,
    database
  };
})();

// Make available globally
if (typeof window !== 'undefined') {
  window.FG_Materials = FG_Materials;
}
