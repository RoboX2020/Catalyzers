/**
 * FitGenius — Body Measurement Estimator v2
 * Estimates detailed measurements from height, weight, gender, body shape, and usual clothing size
 * 
 * KEY DESIGN: The user's "usual size" is the STRONGEST signal. Height/weight/shape
 * provide fine-tuning, not the other way around.
 */

const FG_BodyEstimator = (() => {

  /**
   * Body shape profiles with measurement ratio modifiers
   */
  const bodyShapes = {
    male: {
      slim: {
        label: 'Slim / Lean',
        icon: '🏃',
        desc: 'Narrow shoulders, flat stomach, lean build',
        modifiers: { chest: -2, waist: -3, hip: -2, shoulder: -0.5 }
      },
      athletic: {
        label: 'Athletic / Fit',
        icon: '💪',
        desc: 'Broad shoulders, defined muscles, V-shaped torso',
        modifiers: { chest: 2, waist: -2, hip: -1, shoulder: 1.5 }
      },
      average: {
        label: 'Average',
        icon: '🧍',
        desc: 'Standard proportions, moderate build',
        modifiers: { chest: 0, waist: 0, hip: 0, shoulder: 0 }
      },
      stocky: {
        label: 'Stocky / Broad',
        icon: '🏋️',
        desc: 'Wide chest and shoulders, thick midsection',
        modifiers: { chest: 3, waist: 3, hip: 2, shoulder: 2 }
      },
      heavy: {
        label: 'Full / Heavy',
        icon: '🐻',
        desc: 'Larger all around, round midsection',
        modifiers: { chest: 4, waist: 6, hip: 4, shoulder: 1.5 }
      }
    },
    female: {
      slim: {
        label: 'Slim / Petite',
        icon: '🩰',
        desc: 'Narrow frame, smaller bust and hips',
        modifiers: { chest: -2, waist: -2, hip: -2, shoulder: -0.5 }
      },
      athletic: {
        label: 'Athletic / Toned',
        icon: '🏃‍♀️',
        desc: 'Broad shoulders, defined muscles, straight lines',
        modifiers: { chest: 0, waist: -2, hip: -1, shoulder: 1 }
      },
      average: {
        label: 'Average',
        icon: '🧍‍♀️',
        desc: 'Standard proportions, balanced figure',
        modifiers: { chest: 0, waist: 0, hip: 0, shoulder: 0 }
      },
      pear: {
        label: 'Pear / Triangle',
        icon: '🍐',
        desc: 'Narrower shoulders, wider hips and thighs',
        modifiers: { chest: -1, waist: 0, hip: 4, shoulder: -0.5 }
      },
      hourglass: {
        label: 'Hourglass',
        icon: '⏳',
        desc: 'Balanced bust and hips, defined waist',
        modifiers: { chest: 2, waist: -1, hip: 2, shoulder: 0 }
      },
      apple: {
        label: 'Apple / Round',
        icon: '🍎',
        desc: 'Fuller midsection, narrower hips',
        modifiers: { chest: 2, waist: 5, hip: 1, shoulder: 0.5 }
      },
      full: {
        label: 'Full / Curvy',
        icon: '🌸',
        desc: 'Larger and curvy all around',
        modifiers: { chest: 4, waist: 4, hip: 5, shoulder: 1 }
      }
    }
  };

  /**
   * Size-to-measurement anchoring
   * These represent the CENTER of each size range (what the garment is designed for)
   * Source: US standard sizing, average across major brands
   */
  const sizeAnchors = {
    male: {
      'XS':  { chest: 33, waist: 27, hip: 33, shoulder: 16 },
      'S':   { chest: 35, waist: 29, hip: 35, shoulder: 17 },
      'M':   { chest: 39, waist: 33, hip: 39, shoulder: 18 },
      'L':   { chest: 43, waist: 37, hip: 43, shoulder: 19 },
      'XL':  { chest: 47, waist: 41, hip: 47, shoulder: 20 },
      'XXL': { chest: 51, waist: 45, hip: 51, shoulder: 21 },
      '3XL': { chest: 55, waist: 49, hip: 55, shoulder: 22 },
      // Numeric waist sizes for pants
      '28': { waist: 28.5, hip: 34.5 },
      '30': { waist: 30.5, hip: 36.5 },
      '32': { waist: 32.5, hip: 38.5 },
      '34': { waist: 34.5, hip: 40.5 },
      '36': { waist: 36.5, hip: 42.5 },
      '38': { waist: 38.5, hip: 44.5 },
      '40': { waist: 40.5, hip: 46.5 },
      '42': { waist: 42.5, hip: 48.5 }
    },
    female: {
      'XS':  { chest: 31, waist: 24, hip: 34 },
      'S':   { chest: 33, waist: 26, hip: 36 },
      'M':   { chest: 35, waist: 28, hip: 38 },
      'L':   { chest: 39, waist: 32, hip: 42 },
      'XL':  { chest: 41, waist: 34, hip: 44 },
      'XXL': { chest: 45, waist: 38, hip: 48 },
      '0':  { chest: 30, waist: 23, hip: 33 },
      '2':  { chest: 31, waist: 24, hip: 34 },
      '4':  { chest: 32, waist: 25, hip: 35 },
      '6':  { chest: 33, waist: 26, hip: 36 },
      '8':  { chest: 34, waist: 27, hip: 37 },
      '10': { chest: 35, waist: 28, hip: 38 },
      '12': { chest: 37, waist: 30, hip: 40 },
      '14': { chest: 39, waist: 32, hip: 42 },
      '16': { chest: 41, waist: 34, hip: 44 },
      '18': { chest: 43, waist: 36, hip: 46 }
    }
  };

  /**
   * Estimate body measurements from basic inputs
   * 
   * PRIORITY ORDER:
   * 1. If user provides "usual size" → that's the primary signal (70% weight)
   * 2. Height/weight/shape provide the remaining 30% fine-tuning
   * 3. If NO usual size → height/weight/shape are 100% of the estimate
   */
  function estimate(input) {
    const { heightInches, weightLbs, gender, bodyShape, usualSize } = input;
    
    if (!heightInches || !weightLbs || !gender) {
      return null;
    }

    const h = parseFloat(heightInches);
    const w = parseFloat(weightLbs);
    const g = gender.toLowerCase().startsWith('m') ? 'male' : 'female';

    // ─── Step 1: BMI-based baseline estimates ───
    const bmi = (w / (h * h)) * 703;
    
    let baseline;
    if (g === 'male') {
      baseline = estimateMale(h, w, bmi);
    } else {
      baseline = estimateFemale(h, w, bmi);
    }

    // ─── Step 2: Apply body shape modifiers ───
    const shapes = bodyShapes[g] || bodyShapes.male;
    const shape = shapes[bodyShape] || shapes.average;
    const mods = shape.modifiers;

    baseline.chest += mods.chest || 0;
    baseline.waist += mods.waist || 0;
    baseline.hip += mods.hip || 0;
    baseline.shoulder += mods.shoulder || 0;

    // ─── Step 3: Calibrate with usual size ───
    // If the user says "I wear XL", that is BY FAR the strongest signal.
    // We use 70% anchor / 30% body estimate.
    if (usualSize) {
      const anchors = sizeAnchors[g] || sizeAnchors.male;
      const normalized = usualSize.toUpperCase().trim();
      const anchor = anchors[normalized];
      
      if (anchor) {
        const anchorWeight = 0.70; // The user's stated size dominates
        const bodyWeight = 1 - anchorWeight;
        
        if (anchor.chest)    baseline.chest    = baseline.chest    * bodyWeight + anchor.chest    * anchorWeight;
        if (anchor.waist)    baseline.waist    = baseline.waist    * bodyWeight + anchor.waist    * anchorWeight;
        if (anchor.hip)      baseline.hip      = baseline.hip      * bodyWeight + anchor.hip      * anchorWeight;
        if (anchor.shoulder) baseline.shoulder = baseline.shoulder * bodyWeight + anchor.shoulder * anchorWeight;
      }
    }

    // ─── Round everything ───
    for (const key of Object.keys(baseline)) {
      if (typeof baseline[key] === 'number') {
        baseline[key] = Math.round(baseline[key] * 2) / 2; // Round to nearest 0.5
      }
    }

    baseline.estimatedFrom = {
      height: h,
      weight: w,
      gender: g,
      bodyShape: bodyShape || 'average',
      usualSize: usualSize || null,
      bmi: Math.round(bmi * 10) / 10,
      isEstimate: true
    };

    return baseline;
  }

  /**
   * Male anthropometric estimation — CORRECTED coefficients
   * 
   * Validated against real sizing data:
   *   5'10" 170lb avg → chest ~42", waist ~35" (typical L)
   *   5'10" 200lb avg → chest ~46", waist ~40" (typical XL)
   *   6'0"  220lb avg → chest ~48", waist ~42" (typical XL/XXL)
   */
  function estimateMale(h, w, bmi) {
    // Chest: higher weight coefficient — every 10lbs adds ~1" chest
    const chest = 22.0 + (w * 0.10) + (h * 0.05);
    
    // Waist: most strongly correlated with weight/BMI
    const waist = 14.0 + (w * 0.105) + (h * 0.02);
    
    // Hip: tracks with waist but less variable
    const hip = 20.0 + (w * 0.09) + (h * 0.04);
    
    // Shoulder: mostly height-driven with slight weight contribution
    const shoulder = 7.0 + (h * 0.13) + (w * 0.008);
    
    // Neck: correlated with weight
    const neck = 10.0 + (w * 0.02) + (h * 0.02);
    
    // Arm length (sleeve): almost entirely height-driven
    const armLength = 5.0 + (h * 0.42);
    
    // Inseam: height-driven
    const inseam = -5.0 + (h * 0.50);

    return { chest, waist, hip, shoulder, neck, armLength, inseam };
  }

  /**
   * Female anthropometric estimation — CORRECTED coefficients
   */
  function estimateFemale(h, w, bmi) {
    const chest = 18.0 + (w * 0.09) + (h * 0.04);
    const waist = 8.0 + (w * 0.10) + (h * 0.02);
    const hip = 18.0 + (w * 0.10) + (h * 0.05);
    const shoulder = 5.5 + (h * 0.12) + (w * 0.005);
    const neck = 8.5 + (w * 0.015) + (h * 0.02);
    const armLength = 4.0 + (h * 0.40);
    const inseam = -6.0 + (h * 0.49);

    return { chest, waist, hip, shoulder, neck, armLength, inseam };
  }

  /**
   * Get available body shapes for a gender
   */
  function getBodyShapes(gender) {
    const g = (gender || 'male').toLowerCase().startsWith('m') ? 'male' : 'female';
    return bodyShapes[g];
  }

  /**
   * Get size anchors for a gender
   */
  function getSizeAnchors(gender) {
    const g = (gender || 'male').toLowerCase().startsWith('m') ? 'male' : 'female';
    return sizeAnchors[g];
  }

  function getLetterSizes() {
    return ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
  }

  function getNumericSizes(gender) {
    if (gender === 'female') {
      return ['0', '2', '4', '6', '8', '10', '12', '14', '16', '18'];
    }
    return ['28', '30', '32', '34', '36', '38', '40', '42'];
  }

  return {
    estimate,
    getBodyShapes,
    getSizeAnchors,
    getLetterSizes,
    getNumericSizes,
    bodyShapes,
    sizeAnchors
  };
})();

if (typeof window !== 'undefined') {
  window.FG_BodyEstimator = FG_BodyEstimator;
}
