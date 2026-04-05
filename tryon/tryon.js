/**
 * FitGenius — Virtual Try-On Module
 * Canvas-based garment visualization overlay on user photo
 */

const FG_TryOn = (() => {

  let canvas = null;
  let ctx = null;
  let userImage = null;
  let isActive = false;

  // Clothing silhouette paths (simplified SVG-style paths)
  const silhouettes = {
    'tshirt': {
      bodyPoints: [
        [0.3, 0.15], [0.15, 0.2], [0.05, 0.35], [0.15, 0.38],
        [0.2, 0.25], [0.25, 0.25], [0.22, 0.85], [0.78, 0.85],
        [0.75, 0.25], [0.8, 0.25], [0.85, 0.38], [0.95, 0.35],
        [0.85, 0.2], [0.7, 0.15], [0.6, 0.1], [0.4, 0.1]
      ],
      neckPoints: [
        [0.4, 0.12], [0.45, 0.08], [0.5, 0.07], [0.55, 0.08], [0.6, 0.12]
      ]
    },
    'shirt': {
      bodyPoints: [
        [0.3, 0.12], [0.1, 0.25], [0.02, 0.55], [0.08, 0.57],
        [0.15, 0.3], [0.2, 0.2], [0.2, 0.9], [0.5, 0.92],
        [0.8, 0.9], [0.8, 0.2], [0.85, 0.3], [0.92, 0.57],
        [0.98, 0.55], [0.9, 0.25], [0.7, 0.12], [0.6, 0.08], [0.4, 0.08]
      ],
      neckPoints: [
        [0.4, 0.1], [0.45, 0.05], [0.5, 0.04], [0.55, 0.05], [0.6, 0.1]
      ],
      collarPoints: [
        [0.35, 0.12], [0.4, 0.06], [0.45, 0.14],
        [0.55, 0.14], [0.6, 0.06], [0.65, 0.12]
      ]
    },
    'pants': {
      bodyPoints: [
        [0.2, 0.0], [0.2, 0.45], [0.15, 1.0], [0.42, 1.0],
        [0.45, 0.5], [0.5, 0.45], [0.55, 0.5], [0.58, 1.0],
        [0.85, 1.0], [0.8, 0.45], [0.8, 0.0]
      ]
    },
    'dress': {
      bodyPoints: [
        [0.35, 0.1], [0.2, 0.15], [0.15, 0.25], [0.18, 0.25],
        [0.22, 0.2], [0.2, 0.4], [0.12, 0.95], [0.88, 0.95],
        [0.8, 0.4], [0.78, 0.2], [0.82, 0.25], [0.85, 0.25],
        [0.8, 0.15], [0.65, 0.1], [0.55, 0.07], [0.45, 0.07]
      ],
      neckPoints: [
        [0.42, 0.08], [0.47, 0.04], [0.5, 0.03], [0.53, 0.04], [0.58, 0.08]
      ]
    },
    'jacket': {
      bodyPoints: [
        [0.3, 0.08], [0.05, 0.2], [0.0, 0.6], [0.08, 0.62],
        [0.13, 0.25], [0.18, 0.15], [0.18, 0.92], [0.82, 0.92],
        [0.82, 0.15], [0.87, 0.25], [0.92, 0.62], [1.0, 0.6],
        [0.95, 0.2], [0.7, 0.08], [0.6, 0.05], [0.4, 0.05]
      ],
      neckPoints: [
        [0.38, 0.07], [0.44, 0.02], [0.5, 0.01], [0.56, 0.02], [0.62, 0.07]
      ],
      lapelPoints: [
        [0.32, 0.1], [0.42, 0.3], [0.48, 0.92],
        [0.52, 0.92], [0.58, 0.3], [0.68, 0.1]
      ]
    },
    'hoodie': {
      bodyPoints: [
        [0.3, 0.1], [0.08, 0.22], [0.0, 0.58], [0.08, 0.6],
        [0.15, 0.28], [0.18, 0.18], [0.18, 0.92], [0.82, 0.92],
        [0.82, 0.18], [0.85, 0.28], [0.92, 0.6], [1.0, 0.58],
        [0.92, 0.22], [0.7, 0.1], [0.62, 0.06], [0.38, 0.06]
      ],
      hoodPoints: [
        [0.3, 0.12], [0.28, 0.0], [0.4, -0.05], [0.5, -0.06],
        [0.6, -0.05], [0.72, 0.0], [0.7, 0.12]
      ]
    }
  };

  /**
   * Initialize try-on preview
   */
  function init(containerEl, width, height) {
    canvas = document.createElement('canvas');
    canvas.width = width || 300;
    canvas.height = height || 400;
    canvas.style.borderRadius = '12px';
    canvas.style.border = '1px solid rgba(255,255,255,0.1)';
    ctx = canvas.getContext('2d');
    containerEl.appendChild(canvas);
    return canvas;
  }

  /**
   * Load user photo
   */
  function loadUserImage(imageDataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        userImage = img;
        resolve(img);
      };
      img.onerror = reject;
      img.src = imageDataUrl;
    });
  }

  /**
   * Render try-on preview
   * @param {string} clothingType - Type of clothing (tshirt, pants, dress, etc.)
   * @param {string} color - CSS color to tint the garment
   * @param {string} productImageUrl - Product image URL for texture
   */
  function render(clothingType, color, productImageUrl) {
    if (!canvas || !ctx) return;
    
    const w = canvas.width;
    const h = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, w, h);

    // Draw user image if available
    if (userImage) {
      // Fit image maintaining aspect ratio
      const scale = Math.min(w / userImage.width, h / userImage.height);
      const imgW = userImage.width * scale;
      const imgH = userImage.height * scale;
      const x = (w - imgW) / 2;
      const y = (h - imgH) / 2;
      
      ctx.drawImage(userImage, x, y, imgW, imgH);
      
      // Slight dim to make overlay visible
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(0, 0, w, h);
    } else {
      // Draw body placeholder silhouette
      drawBodyPlaceholder(w, h);
    }

    // Draw clothing overlay
    drawClothing(clothingType, color, w, h);

    isActive = true;
  }

  /**
   * Draw a body placeholder when no photo is uploaded
   */
  function drawBodyPlaceholder(w, h) {
    ctx.save();
    
    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#1a1a2e');
    grad.addColorStop(1, '#16213e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Simple body outline
    const cx = w / 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);

    // Head
    ctx.beginPath();
    ctx.arc(cx, h * 0.1, w * 0.08, 0, Math.PI * 2);
    ctx.stroke();

    // Body
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.15, h * 0.2);
    ctx.lineTo(cx - w * 0.2, h * 0.22);
    ctx.lineTo(cx - w * 0.35, h * 0.35);
    ctx.moveTo(cx - w * 0.15, h * 0.2);
    ctx.lineTo(cx - w * 0.12, h * 0.55);
    ctx.lineTo(cx - w * 0.15, h * 0.95);
    ctx.moveTo(cx + w * 0.15, h * 0.2);
    ctx.lineTo(cx + w * 0.2, h * 0.22);
    ctx.lineTo(cx + w * 0.35, h * 0.35);
    ctx.moveTo(cx + w * 0.15, h * 0.2);
    ctx.lineTo(cx + w * 0.12, h * 0.55);
    ctx.lineTo(cx + w * 0.15, h * 0.95);
    ctx.moveTo(cx - w * 0.15, h * 0.2);
    ctx.lineTo(cx + w * 0.15, h * 0.2);
    ctx.moveTo(cx - w * 0.12, h * 0.55);
    ctx.lineTo(cx + w * 0.12, h * 0.55);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.restore();
  }

  /**
   * Draw clothing silhouette overlay
   */
  function drawClothing(type, color, w, h) {
    const silhouette = silhouettes[getNormalizedType(type)];
    if (!silhouette) return;

    ctx.save();

    // Clothing area offset (position on body)
    let offsetY = 0;
    let scaleY = 1;
    let offsetX = 0;
    let scaleX = 1;

    switch (getNormalizedType(type)) {
      case 'tshirt':
      case 'shirt':
      case 'hoodie':
      case 'jacket':
        offsetY = h * 0.15;
        scaleY = h * 0.55;
        offsetX = w * 0.1;
        scaleX = w * 0.8;
        break;
      case 'pants':
        offsetY = h * 0.42;
        scaleY = h * 0.55;
        offsetX = w * 0.15;
        scaleX = w * 0.7;
        break;
      case 'dress':
        offsetY = h * 0.15;
        scaleY = h * 0.75;
        offsetX = w * 0.1;
        scaleX = w * 0.8;
        break;
    }

    // Draw main body
    const points = silhouette.bodyPoints;
    if (points && points.length > 0) {
      ctx.beginPath();
      ctx.moveTo(points[0][0] * scaleX + offsetX, points[0][1] * scaleY + offsetY);
      
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        // Use quadratic bezier for smooth curves
        const cpx = (prev[0] + curr[0]) / 2 * scaleX + offsetX;
        const cpy = (prev[1] + curr[1]) / 2 * scaleY + offsetY;
        ctx.quadraticCurveTo(
          prev[0] * scaleX + offsetX,
          prev[1] * scaleY + offsetY,
          cpx, cpy
        );
      }
      ctx.closePath();

      // Fill with semi-transparent color
      const parsedColor = parseColor(color || '#4a90d9');
      ctx.fillStyle = `rgba(${parsedColor.r}, ${parsedColor.g}, ${parsedColor.b}, 0.6)`;
      ctx.fill();

      // Outline
      ctx.strokeStyle = `rgba(${parsedColor.r}, ${parsedColor.g}, ${parsedColor.b}, 0.9)`;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Add subtle pattern/texture
      drawFabricTexture(ctx, offsetX, offsetY, scaleX, scaleY, parsedColor);
    }

    // Draw additional features
    if (silhouette.neckPoints) {
      drawFeature(silhouette.neckPoints, scaleX, scaleY, offsetX, offsetY, 'rgba(0,0,0,0.2)');
    }
    if (silhouette.collarPoints) {
      drawFeature(silhouette.collarPoints, scaleX, scaleY, offsetX, offsetY, 'rgba(255,255,255,0.15)');
    }
    if (silhouette.lapelPoints) {
      drawFeature(silhouette.lapelPoints, scaleX, scaleY, offsetX, offsetY, 'rgba(0,0,0,0.1)');
    }
    if (silhouette.hoodPoints) {
      drawFeature(silhouette.hoodPoints, scaleX, scaleY, offsetX, offsetY, 'rgba(0,0,0,0.15)');
    }

    ctx.restore();
  }

  function drawFeature(points, scaleX, scaleY, offsetX, offsetY, fillColor) {
    ctx.beginPath();
    ctx.moveTo(points[0][0] * scaleX + offsetX, points[0][1] * scaleY + offsetY);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i][0] * scaleX + offsetX, points[i][1] * scaleY + offsetY);
    }
    ctx.fillStyle = fillColor;
    ctx.fill();
  }

  function drawFabricTexture(ctx, ox, oy, sx, sy, color) {
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.strokeStyle = `rgba(${color.r > 128 ? 0 : 255}, ${color.g > 128 ? 0 : 255}, ${color.b > 128 ? 0 : 255}, 0.3)`;
    ctx.lineWidth = 0.5;

    // Subtle horizontal lines for fabric texture
    for (let y = oy; y < oy + sy; y += 8) {
      ctx.beginPath();
      ctx.moveTo(ox, y);
      ctx.lineTo(ox + sx, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  function getNormalizedType(type) {
    const t = (type || 'tshirt').toLowerCase();
    if (t.includes('t-shirt') || t.includes('tshirt') || t.includes('tee') || t.includes('polo') || t.includes('tank')) return 'tshirt';
    if (t.includes('shirt') || t.includes('blouse') || t.includes('top')) return 'shirt';
    if (t.includes('pant') || t.includes('jean') || t.includes('trouser') || t.includes('chino') || t.includes('jogger') || t.includes('legging') || t.includes('short')) return 'pants';
    if (t.includes('dress') || t.includes('gown') || t.includes('romper') || t.includes('jumpsuit') || t.includes('skirt')) return 'dress';
    if (t.includes('jacket') || t.includes('coat') || t.includes('blazer') || t.includes('suit')) return 'jacket';
    if (t.includes('hoodie') || t.includes('sweatshirt') || t.includes('sweater') || t.includes('cardigan')) return 'hoodie';
    return 'tshirt';
  }

  function parseColor(colorStr) {
    // Handle hex colors
    if (colorStr.startsWith('#')) {
      const hex = colorStr.replace('#', '');
      return {
        r: parseInt(hex.substr(0, 2), 16),
        g: parseInt(hex.substr(2, 2), 16),
        b: parseInt(hex.substr(4, 2), 16)
      };
    }
    
    // Handle named colors with defaults
    const colorMap = {
      'black': { r: 30, g: 30, b: 30 },
      'white': { r: 240, g: 240, b: 240 },
      'red': { r: 180, g: 50, b: 50 },
      'blue': { r: 50, g: 80, b: 180 },
      'navy': { r: 20, g: 30, b: 80 },
      'green': { r: 50, g: 140, b: 80 },
      'grey': { r: 128, g: 128, b: 128 },
      'gray': { r: 128, g: 128, b: 128 },
      'pink': { r: 220, g: 120, b: 150 },
      'beige': { r: 220, g: 200, b: 170 },
      'brown': { r: 120, g: 80, b: 50 },
      'yellow': { r: 230, g: 200, b: 50 },
      'purple': { r: 120, g: 50, b: 160 },
      'orange': { r: 230, g: 140, b: 40 },
      'khaki': { r: 195, g: 176, b: 145 },
      'maroon': { r: 128, g: 0, b: 0 },
      'teal': { r: 0, g: 128, b: 128 },
      'olive': { r: 128, g: 128, b: 0 }
    };

    const lower = (colorStr || '').toLowerCase();
    for (const [name, rgb] of Object.entries(colorMap)) {
      if (lower.includes(name)) return rgb;
    }

    return { r: 74, g: 144, b: 217 }; // Default blue
  }

  /**
   * Destroy try-on preview
   */
  function destroy() {
    if (canvas && canvas.parentElement) {
      canvas.parentElement.removeChild(canvas);
    }
    canvas = null;
    ctx = null;
    userImage = null;
    isActive = false;
  }

  return {
    init,
    loadUserImage,
    render,
    destroy,
    isActive: () => isActive,
    silhouettes
  };
})();

if (typeof window !== 'undefined') {
  window.FG_TryOn = FG_TryOn;
}
