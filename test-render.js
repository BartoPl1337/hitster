import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const FONTS_DIR = '/Users/bartek/Desktop/Projekty/hister/fonts';
const playfair = path.join(FONTS_DIR, 'PlayfairDisplay-Variable.ttf');

// TEN SAM rozmiar, różne wagi
async function go(weight, out) {
  const buf = await sharp({
    text: {
      text: `<span foreground="#f1ece1" weight="${weight}">1969</span>`,
      font: 'Playfair Display 240',
      fontfile: playfair,
      rgba: true,
      dpi: 72,
    },
  }).png().toBuffer();
  fs.writeFileSync(out, buf);
}

await go(400, '/tmp/same-w400.png');
await go(900, '/tmp/same-w900.png');

// Bez fontfile — czyli system fallback
const buf = await sharp({
  text: {
    text: `<span foreground="#f1ece1" weight="900">1969</span>`,
    font: 'NonexistentXyzFamily 240',
    rgba: true,
    dpi: 72,
  },
}).png().toBuffer();
fs.writeFileSync('/tmp/same-fallback.png', buf);

console.log('done');
