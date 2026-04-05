/**
 * FitGenius — Core Recommendation Engine v2
 * Computes size recommendations by comparing user measurements against product sizing
 * 
 * KEY FIX: Uses "usual size" as a strong anchor and supports reference product comparison
 */

const FG_Recommender = (() => {

  /**
   * Main recommendation function
   * @param {Object} userProfile - User's body measurements and preferences
   * @param {Object} productData - Extracted product information
   * @param {Object} [referenceProduct] - Optional: a product the user already owns that fits well
   * @returns {Object} Comprehensive recommendation
   */
  function generateRecommendation(userProfile, productData, referenceProduct) {
    if (!userProfile || !userProfile.measurements) {
      return { error: 'Please set up your profile first', hasProfile: false };
    }

    const material = FG_Materials.detectMaterial(productData.material || productData.description || '');
    const chart = productData.sizeChart || FG_SizeCharts.getChart(productData);
    const reviewInsights = analyzeReviews(productData.reviews || []);
    const fitPreference = userProfile.fitPreference || 'regular';

    // Calculate best size match from measurements
    const sizeMatch = calculateSizeMatch(userProfile.measurements, chart, material, fitPreference, productData);
    
    // Apply usual-size anchoring (STRONG signal)
    const anchoredMatch = applyUsualSizeAnchoring(sizeMatch, userProfile, chart);
    
    // Apply reference product comparison if available
    const refComparison = referenceProduct 
      ? compareWithReference(userProfile, productData, referenceProduct, chart)
      : null;
    
    // Combine all signals into final recommendation
    const finalMatch = combineSizeSignals(anchoredMatch, refComparison, reviewInsights, chart);
    
    // Analyze how the garment will fit
    const fitAnalysis = analyzeFit(finalMatch, material, fitPreference, userProfile);
    
    // Compute confidence score
    const confidence = computeConfidence(finalMatch, reviewInsights, productData, userProfile, refComparison);

    // Adjust recommendation based on review sentiment
    const adjustedRecommendation = adjustForReviews(finalMatch, reviewInsights);

    return {
      hasProfile: true,
      recommendedSize: adjustedRecommendation.size,
      alternativeSize: adjustedRecommendation.alternative,
      confidence: confidence,
      fitAnalysis: fitAnalysis,
      material: {
        detected: material.key,
        stretchFactor: material.stretchFactor,
        care: material.care,
        breathability: material.breathability,
        weight: material.weight
      },
      reviewInsights: reviewInsights,
      referenceComparison: refComparison,
      sizeDetails: finalMatch,
      tips: generateTips(fitAnalysis, material, reviewInsights, fitPreference, refComparison)
    };
  }

  /**
   * Apply the user's stated "usual size" as a strong anchoring signal
   * If someone says "I wear XL", the recommendation should HEAVILY favor XL
   * unless measurements clearly say otherwise
   */
  function applyUsualSizeAnchoring(sizeMatch, userProfile, chart) {
    const usualSize = userProfile.usualTopSize || userProfile.usualSize;
    if (!usualSize) return sizeMatch;

    const normalizedUsual = FG_SizeCharts.normalizeSize(usualSize);
    const sizes = chart.sizes || Object.keys(chart.measurements || {});
    
    // Check if the usual size exists in this product's chart
    const usualIndex = sizes.findIndex(s => FG_SizeCharts.normalizeSize(s) === normalizedUsual);
    if (usualIndex < 0) return sizeMatch;

    let targetIndex = usualIndex;

    // Shift target up or down based on fit preference
    if (userProfile.fitPreference === 'oversized') targetIndex += 1;
    if (userProfile.fitPreference === 'slim' || userProfile.fitPreference === 'tight') targetIndex -= 1;

    // Shift target based on body shape (broad shoulders / heavy stomach usually necessitate a size up for comfort)
    if (userProfile.bodyShape === 'inverted_triangle' || userProfile.bodyShape === 'oval') {
      targetIndex += 1; // Size up
    }

    // Mathematical clamping to ensure it stays within valid sizes array
    targetIndex = Math.max(0, Math.min(sizes.length - 1, targetIndex));

    // Boost the target size and nearby sizes significantly
    const boostedScores = { ...sizeMatch.allScores };
    
    for (let i = 0; i < sizes.length; i++) {
      const distance = Math.abs(i - targetIndex);
      if (distance === 0) {
        // Target size gets a massive boost
        boostedScores[sizes[i]] = (boostedScores[sizes[i]] || 0) + 120;
      } else if (distance === 1) {
        // Adjacent sizes get a moderate boost
        boostedScores[sizes[i]] = (boostedScores[sizes[i]] || 0) + 50;
      } else if (distance >= 2) {
        // Extreme penalty for sizes mathematically highly unlikely to fit
        boostedScores[sizes[i]] = (boostedScores[sizes[i]] || 0) - 150;
      }
    }

    // Secondary fallback guard: if weight > 180lbs but size is somehow S/XS, override it
    const m = userProfile.measurements || {};
    const lbs = parseFloat(m.weight) || 0;
    if (lbs >= 185) {
      if (boostedScores['S']) boostedScores['S'] -= 200;
      if (boostedScores['XS']) boostedScores['XS'] -= 200;
    } else if (lbs > 0 && lbs <= 120) {
      if (boostedScores['XL']) boostedScores['XL'] -= 200;
      if (boostedScores['XXL']) boostedScores['XXL'] -= 200;
    }

    // Re-sort
    const sortedSizes = Object.entries(boostedScores).sort((a, b) => b[1] - a[1]);
    const bestSize = sortedSizes[0] || [sizeMatch.bestSize, 50];
    const altSize = sortedSizes[1] || null;

    return {
      ...sizeMatch,
      bestSize: bestSize[0],
      bestScore: bestSize[1],
      alternativeSize: altSize ? altSize[0] : null,
      alternativeScore: altSize ? altSize[1] : null,
      allScores: boostedScores,
      usualSizeUsed: normalizedUsual
    };
  }

  /**
   * Compare the current product against a reference product the user already owns
   * This is the "I bought this and it fit well" feature
   */
  function compareWithReference(userProfile, newProduct, refProduct, chart) {
    const comparison = {
      hasReference: true,
      referenceTitle: refProduct.title || 'Your reference product',
      referenceSize: refProduct.size || refProduct.purchasedSize,
      sizeRecommendation: null,
      notes: []
    };

    const refMaterial = FG_Materials.detectMaterial(refProduct.material || '');
    const newMaterial = FG_Materials.detectMaterial(newProduct.material || newProduct.description || '');

    // Start with the same size they bought before
    let suggestedSize = comparison.referenceSize;

    // Compare materials — stretchier new material = might go smaller
    const stretchDiff = newMaterial.stretchFactor - refMaterial.stretchFactor;
    if (stretchDiff > 0.05) {
      comparison.notes.push(`This product is stretchier than your reference — you might fit a size smaller`);
    } else if (stretchDiff < -0.05) {
      comparison.notes.push(`This product is less stretchy than your reference — consider staying same or sizing up`);
    }

    // Compare fit types
    const fitTypes = { 'slim': -1, 'fitted': -0.5, 'regular': 0, 'classic': 0, 'relaxed': 1, 'loose': 1.5, 'oversized': 2 };
    const refFit = fitTypes[(refProduct.fitType || 'regular').toLowerCase()] || 0;
    const newFit = fitTypes[(newProduct.fitType || 'regular').toLowerCase()] || 0;
    const fitDiff = newFit - refFit;

    if (fitDiff > 0.5) {
      comparison.notes.push(`This product runs looser than your reference — same size will feel baggier`);
    } else if (fitDiff < -0.5) {
      comparison.notes.push(`This product runs tighter than your reference — consider going one size up`);
    }

    // Compare brands (some brands run small/large)
    if (refProduct.brand && newProduct.brand && refProduct.brand.toLowerCase() !== newProduct.brand.toLowerCase()) {
      comparison.notes.push(`Different brand (${newProduct.brand} vs ${refProduct.brand}) — sizing may vary`);
    }

    // Size adjustment based on product type differences
    const sizes = chart.sizes || [];
    const refIdx = sizes.findIndex(s => 
      FG_SizeCharts.normalizeSize(s) === FG_SizeCharts.normalizeSize(suggestedSize || '')
    );

    if (refIdx >= 0 && fitDiff < -0.5 && refIdx < sizes.length - 1) {
      comparison.sizeRecommendation = sizes[refIdx + 1]; // Size up
    } else if (refIdx >= 0 && stretchDiff > 0.1 && refIdx > 0) {
      comparison.sizeRecommendation = sizes[refIdx - 1]; // Size down
    } else {
      comparison.sizeRecommendation = suggestedSize;
    }

    if (comparison.notes.length === 0) {
      comparison.notes.push('This product should fit similarly to your reference');
    }

    return comparison;
  }

  /**
   * Combine measurement-based sizing with reference product and usual-size signals
   */
  function combineSizeSignals(measurementMatch, refComparison, reviewInsights, chart) {
    if (!refComparison) return measurementMatch;

    const refSize = refComparison.sizeRecommendation;
    if (!refSize) return measurementMatch;

    const sizes = chart.sizes || [];
    const refIdx = sizes.findIndex(s => FG_SizeCharts.normalizeSize(s) === FG_SizeCharts.normalizeSize(refSize));
    
    if (refIdx < 0) return measurementMatch;

    // Reference product comparison is another strong signal
    const boostedScores = { ...measurementMatch.allScores };
    
    for (let i = 0; i < sizes.length; i++) {
      const distance = Math.abs(i - refIdx);
      if (distance === 0) boostedScores[sizes[i]] = (boostedScores[sizes[i]] || 0) + 25;
      else if (distance === 1) boostedScores[sizes[i]] = (boostedScores[sizes[i]] || 0) + 10;
    }

    const sortedSizes = Object.entries(boostedScores).sort((a, b) => b[1] - a[1]);
    const bestSize = sortedSizes[0];
    const altSize = sortedSizes[1];

    return {
      ...measurementMatch,
      bestSize: bestSize[0],
      bestScore: bestSize[1],
      alternativeSize: altSize ? altSize[0] : null,
      alternativeScore: altSize ? altSize[1] : null,
      allScores: boostedScores
    };
  }

  /**
   * Calculate the best size match based on measurements
   */
  function calculateSizeMatch(userMeasurements, chart, material, fitPreference, productData) {
    const sizes = chart.sizes || Object.keys(chart.measurements || {});
    const measurements = chart.measurements || {};
    
    if (sizes.length === 0 || Object.keys(measurements).length === 0) {
      const fallbackChart = FG_SizeCharts.getChart(productData);
      return calculateSizeMatch(userMeasurements, fallbackChart, material, fitPreference, productData);
    }

    const scores = {};
    const details = {};

    for (const size of sizes) {
      const sizeMeasurements = measurements[FG_SizeCharts.normalizeSize(size)] || measurements[size];
      if (!sizeMeasurements) continue;

      let totalScore = 0;
      let measurementCount = 0;
      const sizeDetails = {};

      for (const [key, sizeRange] of Object.entries(sizeMeasurements)) {
        const userValue = getUserMeasurement(userMeasurements, key);
        if (userValue === null) continue;

        let min, max;
        if (Array.isArray(sizeRange)) {
          min = sizeRange[0];
          max = sizeRange[1];
        } else {
          // Single value: assume ±1.5" range
          min = sizeRange - 1.5;
          max = sizeRange + 1.5;
        }

        // Apply material stretch to extend the upper range
        const effectiveMax = max * material.stretchFactor;
        
        // Apply fit preference
        const fitOffset = getFitOffset(fitPreference);
        const adjustedMin = min + fitOffset;
        const adjustedMax = effectiveMax + fitOffset;

        // Score: how well does the user's measurement fit this size range?
        // 100 = perfect fit in the middle, gradually decreasing toward edges and beyond
        const center = (adjustedMin + adjustedMax) / 2;
        const range = (adjustedMax - adjustedMin) / 2;
        const diff = Math.abs(userValue - center);
        
        let score;
        if (diff <= range) {
          // Within range: 70-100
          score = 100 - (diff / range) * 30;
        } else {
          // Outside range: rapid falloff
          const overshoot = diff - range;
          score = Math.max(0, 70 - overshoot * 15);
        }

        // Determine fit status
        let fitStatus;
        if (userValue < adjustedMin - 2) fitStatus = 'too-large';      // garment WAY too big
        else if (userValue < adjustedMin) fitStatus = 'slightly-loose'; // garment a bit loose
        else if (userValue <= adjustedMax) fitStatus = 'good-fit';      // garment fits right
        else if (userValue <= adjustedMax + 2) fitStatus = 'slightly-tight'; // garment a bit snug
        else fitStatus = 'too-tight';                                   // garment WAY too small

        sizeDetails[key] = {
          userValue,
          sizeRange: [min, max],
          effectiveRange: [adjustedMin, adjustedMax],
          score,
          fitStatus,
          diff: userValue - center
        };

        const weight = getMeasurementWeight(key);
        totalScore += score * weight;
        measurementCount += weight;
      }

      scores[size] = measurementCount > 0 ? totalScore / measurementCount : 0;
      details[size] = sizeDetails;
    }

    // Find best and second-best sizes
    const sortedSizes = Object.entries(scores)
      .sort((a, b) => b[1] - a[1]);

    const bestSize = sortedSizes[0] || [sizes[Math.floor(sizes.length / 2)], 50];
    const altSize = sortedSizes[1] || null;

    return {
      bestSize: bestSize[0],
      bestScore: bestSize[1],
      alternativeSize: altSize ? altSize[0] : null,
      alternativeScore: altSize ? altSize[1] : null,
      allScores: scores,
      details: details[bestSize[0]] || {}
    };
  }

  /**
   * Map user measurement keys to size chart keys
   */
  function getUserMeasurement(measurements, chartKey) {
    const mapping = {
      'chest': ['chest', 'bust'],
      'waist': ['waist'],
      'hip': ['hip', 'hips'],
      'shoulder': ['shoulder', 'shoulders'],
      'sleeve': ['armLength', 'arm_length', 'sleeve'],
      'inseam': ['inseam'],
      'neck': ['neck']
    };

    const keys = mapping[chartKey] || [chartKey];
    for (const key of keys) {
      if (measurements[key] !== undefined && measurements[key] !== null && measurements[key] !== '') {
        return parseFloat(measurements[key]);
      }
    }
    return null;
  }

  /**
   * Get importance weight for each measurement type
   */
  function getMeasurementWeight(key) {
    const weights = {
      chest: 3,
      waist: 3,
      hip: 2.5,
      shoulder: 2,
      inseam: 2,
      sleeve: 1.5,
      neck: 1
    };
    return weights[key] || 1;
  }

  /**
   * Get fit offset based on user preference
   */
  function getFitOffset(preference) {
    switch (preference) {
      case 'slim': return -1;
      case 'regular': return 0;
      case 'relaxed': return 1.5;
      case 'oversized': return 3;
      default: return 0;
    }
  }

  /**
   * Analyze how the garment will fit across body areas
   */
  function analyzeFit(sizeMatch, material, fitPreference, userProfile) {
    const details = sizeMatch.details;
    const analysis = {
      overall: 'good',
      areas: {},
      summary: ''
    };

    let tightCount = 0;
    let looseCount = 0;
    let goodCount = 0;

    for (const [area, detail] of Object.entries(details)) {
      analysis.areas[area] = {
        status: detail.fitStatus,
        description: getFitDescription(area, detail.fitStatus, material)
      };

      if (detail.fitStatus.includes('tight')) tightCount++;
      else if (detail.fitStatus.includes('loose') || detail.fitStatus.includes('large')) looseCount++;
      else goodCount++;
    }

    // Overall assessment
    const total = Object.keys(details).length || 1;
    if (goodCount >= total * 0.7) {
      analysis.overall = 'excellent';
      analysis.summary = `Size ${sizeMatch.bestSize} should fit you well overall.`;
    } else if (tightCount > looseCount) {
      analysis.overall = 'tight';
      analysis.summary = `Size ${sizeMatch.bestSize} may feel snug in some areas. Consider ${sizeMatch.alternativeSize || 'sizing up'}.`;
    } else if (looseCount > tightCount) {
      analysis.overall = 'loose';
      analysis.summary = `Size ${sizeMatch.bestSize} may be slightly loose. ${fitPreference === 'relaxed' ? 'This matches your relaxed fit preference.' : ''}`;
    } else {
      analysis.overall = 'good';
      analysis.summary = `Size ${sizeMatch.bestSize} is a reasonable fit for your measurements.`;
    }

    if (material.stretchFactor > 1.10) {
      analysis.summary += ' The stretchy material will provide extra comfort.';
    }
    if (material.shrinkage > 0.03) {
      analysis.summary += ` Note: This material may shrink ${Math.round(material.shrinkage * 100)}% after washing.`;
    }

    return analysis;
  }

  function getFitDescription(area, status, material) {
    const descriptions = {
      'chest': {
        'good-fit': 'Chest will fit comfortably',
        'slightly-tight': 'May feel snug across the chest',
        'too-tight': 'Will be restrictive in the chest area',
        'slightly-loose': 'Slightly loose in the chest',
        'too-large': 'Will be baggy in the chest area'
      },
      'waist': {
        'good-fit': 'Waist will fit well',
        'slightly-tight': 'May feel fitted at the waist',
        'too-tight': 'Will be tight around the waist',
        'slightly-loose': 'Slightly loose at the waist',
        'too-large': 'Will be loose around the waist'
      },
      'hip': {
        'good-fit': 'Good fit through the hips',
        'slightly-tight': 'May be snug around the hips',
        'too-tight': 'Will be tight in the hip area',
        'slightly-loose': 'Relaxed fit through the hips',
        'too-large': 'Loose fit through the hips'
      },
      'shoulder': {
        'good-fit': 'Shoulders will align properly',
        'slightly-tight': 'Shoulder seams may sit tight',
        'too-tight': 'Shoulders will be restrictive',
        'slightly-loose': 'Shoulder seams may drop slightly',
        'too-large': 'Shoulders will be too wide'
      }
    };

    const areaDesc = descriptions[area] || {};
    let desc = areaDesc[status] || `${area}: ${status.replace(/-/g, ' ')}`;
    
    if (material.stretchFactor > 1.10 && status.includes('tight')) {
      desc += ' (stretch material will help)';
    }
    
    return desc;
  }

  /**
   * Analyze reviews for sizing sentiment
   */
  function analyzeReviews(reviews) {
    if (!reviews || reviews.length === 0) {
      return { sentiment: 'neutral', confidence: 'low', details: 'No reviews available for fit analysis' };
    }

    let runsSmall = 0;
    let trueTOSize = 0;
    let runsLarge = 0;
    let totalRelevant = 0;
    const fitMentions = [];

    const smallPatterns = /runs?\s*small|too\s*tight|sizing\s*up|order\s*(a\s*size\s*)?up|smaller\s*than\s*expected|snug|fitted/gi;
    const largePatterns = /runs?\s*large|runs?\s*big|too\s*(big|loose|baggy)|sizing\s*down|order\s*(a\s*size\s*)?down|larger\s*than\s*expected|oversized/gi;
    const truePatterns = /true\s*to\s*size|fits?\s*(perfectly|great|well|as\s*expected)|perfect\s*fit|accurate\s*sizing/gi;

    for (const review of reviews) {
      const text = (review.text || review).toString().toLowerCase();
      
      const smallMatches = (text.match(smallPatterns) || []).length;
      const largeMatches = (text.match(largePatterns) || []).length;
      const trueMatches = (text.match(truePatterns) || []).length;

      if (smallMatches > 0) { runsSmall += smallMatches; totalRelevant++; fitMentions.push('Runs small'); }
      if (largeMatches > 0) { runsLarge += largeMatches; totalRelevant++; fitMentions.push('Runs large'); }
      if (trueMatches > 0) { trueTOSize += trueMatches; totalRelevant++; fitMentions.push('True to size'); }
    }

    let sentiment = 'true-to-size';
    let sizeAdjustment = 0;
    let details = '';

    if (totalRelevant === 0) {
      return { sentiment: 'neutral', confidence: 'low', sizeAdjustment: 0, details: 'Reviews don\'t mention sizing' };
    }

    const total = runsSmall + trueTOSize + runsLarge;
    const smallPct = runsSmall / total;
    const largePct = runsLarge / total;

    if (smallPct > 0.4) {
      sentiment = 'runs-small';
      sizeAdjustment = 1;
      details = `${Math.round(smallPct * 100)}% of reviewers say it runs small — consider sizing up`;
    } else if (largePct > 0.4) {
      sentiment = 'runs-large';
      sizeAdjustment = -1;
      details = `${Math.round(largePct * 100)}% of reviewers say it runs large — consider sizing down`;
    } else {
      sentiment = 'true-to-size';
      sizeAdjustment = 0;
      details = `Most reviewers confirm it's true to size`;
    }

    return {
      sentiment,
      sizeAdjustment,
      confidence: totalRelevant >= 5 ? 'high' : totalRelevant >= 2 ? 'medium' : 'low',
      details,
      stats: { runsSmall, trueTOSize, runsLarge, totalReviews: reviews.length, relevantReviews: totalRelevant },
      mentions: [...new Set(fitMentions)]
    };
  }

  /**
   * Compute overall confidence in the recommendation
   */
  function computeConfidence(sizeMatch, reviewInsights, productData, userProfile, refComparison) {
    let confidence = 45; // Base

    // Score from size matching
    if (sizeMatch.bestScore > 80) confidence += 15;
    else if (sizeMatch.bestScore > 60) confidence += 8;

    // Gap between best and second best
    if (sizeMatch.alternativeScore !== null) {
      const gap = sizeMatch.bestScore - sizeMatch.alternativeScore;
      if (gap > 20) confidence += 10;
      else if (gap < 5) confidence -= 5;
    }

    // Usual size signal — if the recommendation matches their stated size, big confidence boost
    const usualSize = userProfile?.usualTopSize || userProfile?.usualSize;
    if (usualSize) {
      const normalizedUsual = FG_SizeCharts.normalizeSize(usualSize);
      if (FG_SizeCharts.normalizeSize(sizeMatch.bestSize) === normalizedUsual) {
        confidence += 20; // Matches their usual — very confident
      } else {
        confidence += 5; // We have a usual size signal, even if different
      }
    }

    // Reference product — if we compared against a known-good product
    if (refComparison?.hasReference) {
      confidence += 15;
    }

    // Review data quality
    if (reviewInsights.confidence === 'high') confidence += 10;
    else if (reviewInsights.confidence === 'medium') confidence += 5;

    // Product data quality
    if (productData.sizeChart) confidence += 8;
    if (productData.material) confidence += 3;

    return Math.min(98, Math.max(15, confidence));
  }

  /**
   * Adjust recommendation based on review insights
   */
  function adjustForReviews(sizeMatch, reviewInsights) {
    const sizes = Object.keys(sizeMatch.allScores || {});
    const currentIdx = sizes.indexOf(sizeMatch.bestSize);
    
    let recommendedSize = sizeMatch.bestSize;
    let alternative = sizeMatch.alternativeSize;

    if (reviewInsights.sizeAdjustment && reviewInsights.confidence !== 'low' && currentIdx >= 0) {
      const adjustedIdx = currentIdx + reviewInsights.sizeAdjustment;
      if (adjustedIdx >= 0 && adjustedIdx < sizes.length) {
        if (sizeMatch.bestScore - (sizeMatch.allScores[sizes[adjustedIdx]] || 0) < 15) {
          alternative = recommendedSize;
          recommendedSize = sizes[adjustedIdx];
        } else {
          alternative = sizes[adjustedIdx];
        }
      }
    }

    return { size: recommendedSize, alternative };
  }

  /**
   * Generate helpful tips including reference comparison notes
   */
  function generateTips(fitAnalysis, material, reviewInsights, fitPreference, refComparison) {
    const tips = [];

    // Reference comparison tips (highest priority)
    if (refComparison?.hasReference && refComparison.notes) {
      for (const note of refComparison.notes) {
        tips.push({ icon: '📦', text: note });
      }
    }

    // Material tips
    if (material.shrinkage > 0.03) {
      tips.push({
        icon: '🧺',
        text: `This fabric may shrink ~${Math.round(material.shrinkage * 100)}% after washing. Consider washing cold and air drying.`
      });
    }
    if (material.stretchFactor > 1.10) {
      tips.push({
        icon: '↔️',
        text: 'This material has good stretch, so it will be forgiving on fit.'
      });
    }
    if (material.breathability >= 8) {
      tips.push({ icon: '🌬️', text: 'Highly breathable fabric — great for warm weather.' });
    }
    if (material.breathability <= 3) {
      tips.push({ icon: '🔥', text: 'Low breathability — may feel warm. Good for cooler weather.' });
    }

    // Fit tips
    if (fitAnalysis.overall === 'tight' && fitPreference === 'slim') {
      tips.push({ icon: '👔', text: 'You prefer slim fit — this snug fit aligns with your preference.' });
    }

    // Review tips
    if (reviewInsights.sentiment === 'runs-small') {
      tips.push({ icon: '📏', text: reviewInsights.details });
    } else if (reviewInsights.sentiment === 'runs-large') {
      tips.push({ icon: '📐', text: reviewInsights.details });
    }

    if (tips.length === 0) {
      tips.push({ icon: '✅', text: 'This looks like a good match for your measurements and preferences!' });
    }

    return tips;
  }

  return {
    generateRecommendation,
    calculateSizeMatch,
    analyzeFit,
    analyzeReviews,
    computeConfidence,
    compareWithReference,
    applyUsualSizeAnchoring
  };
})();

if (typeof window !== 'undefined') {
  window.FG_Recommender = FG_Recommender;
}
