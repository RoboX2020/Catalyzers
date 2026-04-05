const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#6C5CE7');
  grad.addColorStop(1, '#00cec9');
  
  const r = size * 0.18;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  
  const cx = size / 2;
  const s = size / 128;
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.moveTo(cx - 15*s, 28*s);
  ctx.lineTo(cx - 35*s, 38*s);
  ctx.lineTo(cx - 45*s, 58*s);
  ctx.lineTo(cx - 32*s, 62*s);
  ctx.lineTo(cx - 25*s, 48*s);
  ctx.lineTo(cx - 22*s, 95*s);
  ctx.lineTo(cx + 22*s, 95*s);
  ctx.lineTo(cx + 25*s, 48*s);
  ctx.lineTo(cx + 32*s, 62*s);
  ctx.lineTo(cx + 45*s, 58*s);
  ctx.lineTo(cx + 35*s, 38*s);
  ctx.lineTo(cx + 15*s, 28*s);
  ctx.closePath();
  ctx.fill();
  
  ctx.beginPath();
  ctx.arc(cx, 28*s, 10*s, 0, Math.PI, false);
  ctx.fillStyle = grad;
  ctx.fill();
  
  ctx.fillStyle = '#fdcb6e';
  const sx = cx + 28*s, sy = 30*s, ss = 6*s;
  ctx.beginPath();
  ctx.moveTo(sx, sy - ss);
  ctx.lineTo(sx + ss*0.3, sy - ss*0.3);
  ctx.lineTo(sx + ss, sy);
  ctx.lineTo(sx + ss*0.3, sy + ss*0.3);
  ctx.lineTo(sx, sy + ss);
  ctx.lineTo(sx - ss*0.3, sy + ss*0.3);
  ctx.lineTo(sx - ss, sy);
  ctx.lineTo(sx - ss*0.3, sy - ss*0.3);
  ctx.closePath();
  ctx.fill();
  
  return canvas.toBuffer('image/png');
}

const iconDir = path.join(__dirname, 'assets/icons');

[16, 48, 128].forEach(size => {
  const buffer = generateIcon(size);
  fs.writeFileSync(path.join(iconDir, `icon${size}.png`), buffer);
  console.log(`Generated icon${size}.png`);
});
