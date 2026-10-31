/** Asemic manuscript text rendered into the page text block. */
import * as G from './geom.js';
import * as Markov from './markov.js';

function clean(s) {
  return s.replace(/\s+/g, ' ').trim();
}

function truncateToWord(s) {
  s = s.trim();
  if (!s) return s;
  const end = s[s.length - 1];
  if ('.!?;,;'.indexOf(end) >= 0) return s;
  const idx = s.lastIndexOf(' ');
  return idx > 0 ? s.slice(0, idx) : s;
}

function sentence(rng) {
  let s = truncateToWord(clean(Markov.sentence(rng, 50 + rng.int(20, 60))));
  if (!s) return '';
  s = s[0].toUpperCase() + s.slice(1);
  const end = s[s.length - 1];
  if ('.!?'.indexOf(end) < 0) s += '.';
  return s;
}

function paragraph(rng) {
  const sents = [];
  const n = rng.int(2, 4);
  for (let i = 0; i < n; i++) sents.push(sentence(rng));
  return sents.join(' ');
}

function title(rng) {
  let s = truncateToWord(clean(Markov.title(rng, 12 + rng.int(6, 18))));
  return s ? s[0].toUpperCase() + s.slice(1) : '';
}

function rubric(rng) {
  let s = truncateToWord(clean(Markov.rubric(rng, 20 + rng.int(10, 30))));
  if (!s) return '';
  s = s[0].toUpperCase() + s.slice(1);
  const end = s[s.length - 1];
  if ('.!?;'.indexOf(end) < 0) s += ';';
  return s;
}

function measure(ctx, text, font) {
  ctx.font = font;
  return ctx.measureText(text).width;
}

export function drawFragment(ctx, f) {
  ctx.save();
  ctx.textBaseline = 'top';
  ctx.font = f.font;
  ctx.fillStyle = f.color;
  ctx.globalAlpha = f.alpha;
  ctx.fillText(f.text, f.x, f.y);
  ctx.restore();
}

// Build a list of word fragments. Each fragment carries everything needed to draw it.
export function layout(ctx, spec, rng) {
  const t = spec.text;
  const H = spec.height;
  const offX = spec.page ? spec.page.x : 0;
  const offY = spec.page ? spec.page.y : 0;
  const x0 = t.x0 + 6 + offX;
  const x1 = t.x1 - 6 + offX;
  const yTop = H - t.y1 + 8 + offY;
  const yBot = H - t.y0 - 8 + offY;
  const w = x1 - x0;
  const h = yBot - yTop;
  if (w < 80 || h < 80) return [];

  const titleH = Math.min(80, h * 0.20);
  const bodyH = Math.min(34, h * 0.095);
  const rubricH = Math.min(26, h * 0.075);
  const lineH = bodyH * 1.7;
  const fragments = [];

  const titleFont = `${titleH}px UnifrakturMaguntia, serif`;
  const rubricFont = `${rubricH}px UnifrakturMaguntia, serif`;
  const bodyFont = `${bodyH}px UnifrakturMaguntia, serif`;
  const dropCapFont = `${bodyH * 3.2}px UnifrakturMaguntia, serif`;

  // Title, letter by letter, centred.
  const ti = title(rng.fork('title'));
  let totalTitleW = 0;
  const titleCharWs = [];
  for (const ch of ti) {
    const cw = measure(ctx, ch === ' ' ? ' ' : ch, titleFont);
    titleCharWs.push(cw);
    totalTitleW += cw + titleH * 0.04;
  }
  totalTitleW -= titleH * 0.04;
  let tx = x0 + (w - totalTitleW) / 2;
  for (let i = 0; i < ti.length; i++) {
    const ch = ti[i];
    if (ch !== ' ') fragments.push({ text: ch, x: tx, y: yTop, font: titleFont, color: '#2e2118', alpha: 0.88 });
    tx += titleCharWs[i] + titleH * 0.04;
  }
  let y = yTop + titleH + lineH * 0.6;

  // Decorative rule (returned separately as a line command, not a fragment).
  fragments._rule = [x0 + w * 0.15, y - lineH * 0.25, x1 - w * 0.15, y - lineH * 0.25];

  // Rubric, letter by letter.
  const ru = rubric(rng.fork('rubric'));
  let rx = x0;
  for (const ch of ru) {
    if (ch !== ' ') fragments.push({ text: ch, x: rx, y, font: rubricFont, color: '#9e2a1e', alpha: 0.90 });
    rx += measure(ctx, ch, rubricFont) + rubricH * 0.04;
  }
  y += rubricH * 1.8;

  // Body paragraphs, letter by letter.
  const np = 3;
  const capW = bodyH * 2.3;
  const capBottom = bodyH * 2.6; // vertical extent of the drop cap
  for (let pi = 0; pi < np; pi++) {
    if (y + lineH * 2 > yBot) break;
    const words = paragraph(rng.fork('p' + pi)).split(' ');
    let lineWords = [];
    let lineW = 0;
    let lineCount = 0;
    const flush = () => {
      if (!lineWords.length) return;
      const indented = lineCount < 2;
      const startX = indented ? x0 + capW : x0;
      if (lineCount === 0) {
        const firstWord = lineWords[0];
        const cap = firstWord[0].toUpperCase();
        fragments.push({ text: cap, x: x0, y: y - bodyH * 0.2, font: dropCapFont, color: '#33241a', alpha: 0.86 });
      }
      let wx = startX;
      for (let i = 0; i < lineWords.length; i++) {
        const w = lineWords[i];
        const start = (lineCount === 0 && i === 0) ? 1 : 0;
        for (let k = start; k < w.length; k++) {
          const ch = w[k];
          fragments.push({ text: ch, x: wx, y, font: bodyFont, color: '#3d2d20', alpha: 0.82 });
          wx += measure(ctx, ch, bodyFont) + bodyH * 0.02;
        }
        wx += bodyH * 0.12; // word gap
      }
      y += lineH;
      lineWords = [];
      lineW = 0;
      lineCount++;
    };
    for (const wd of words) {
      const indented = lineCount < 2;
      const lineStart = indented ? capW + bodyH * 0.3 : 0;
      const ww = measure(ctx, wd, bodyFont) + (wd.length - 1) * bodyH * 0.02;
      const extra = lineWords.length ? bodyH * 0.12 : 0;
      if (lineW + ww + extra + lineStart > w && lineWords.length) {
        flush();
      }
      lineWords.push(wd);
      lineW += ww + extra;
    }
    flush();
    y += lineH * 1.2;
  }

  return fragments;
}

export function render(ctx, spec, rng) {
  const fragments = layout(ctx, spec, rng);
  if (fragments._rule) {
    const [x0, y0, x1, y1] = fragments._rule;
    ctx.save();
    ctx.strokeStyle = '#8b4513';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.restore();
  }
  for (const f of fragments) drawFragment(ctx, f);
}

// Return the rectangular text region in page (y-up) coordinates so the flora
// can treat it as exclusion space.
export function region(spec) {
  return spec.text;
}
