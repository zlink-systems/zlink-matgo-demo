// 카드 생성 배치 프롬프트를 만든다. node make-batches.mjs
import { writeFileSync } from 'node:fs';

const OUT = 'assets/cards/originals';

const STYLE = `STYLE SYSTEM (must match the attached reference cards exactly): modernized CLASSIC KOREAN plastic hwatu (화투).
Graphic screen-printed look, bold smooth black outlines of consistent thickness, flat highly saturated crimson red, near-black, dark pine green and warm ivory background; tiny warm gold accents only if essential.
Large iconic simple shapes readable at 60px width. Very subtle glossy plastic sheen. NOT a painting, NOT a landscape, no gradients-heavy rendering.
Faithful to the traditional hwatu layout of that month, simplified into confident flat shapes.
FORMAT: portrait 5:8, 1000x1600 px. The image IS the card face, artwork fills EVERY pixel edge to edge. No card object, no rounded corners, no paper, no table, no mockup, no margin, no shadow, no outer border.
TEXT: no text, letters, digits or logos anywhere (except the 光 seal on bright cards, exactly like the reference: small crimson circle, ivory 光, top-left).
AVOID: Japanese motifs (no torii, shrines, kimono, Japanese text, Japanese people). Use Korean motifs when a person or object is needed.
RIBBON CARDS (띠): one large vertical ribbon (tanzaku-like strip, slightly slanted, with a notched bottom) placed in the upper-middle over the month plants; 홍단 = crimson ribbon with a thin ivory inner line border; 청단 = deep blue ribbon with thin ivory inner line border; 초단 = plain crimson ribbon without inner border; 비 띠(December) = crimson ribbon with black zigzag stripes.
JUNK CARDS (피): only the month plant motif, simpler and emptier than the other cards of the month, ivory background showing.`;

const cards = [
  ['01-tti', 'January ribbon (송학 홍단): dark green pine boughs with black trunk, 홍단 crimson ribbon.'],
  ['01-pi', 'January junk (송학 피): pine boughs only, low hill of pine at the bottom.'],
  [
    '02-yeol',
    'February animal (매조 열끗): a small yellow-green bush warbler (꾀꼬리) perched on a dark plum branch with crimson 5-petal plum blossoms.',
  ],
  ['02-tti', 'February ribbon (매조 홍단): plum branch with crimson blossoms, 홍단 crimson ribbon.'],
  ['02-pi', 'February junk (매조 피): plum branch with crimson blossoms only.'],
  [
    '03-gwang',
    'March bright (벚꽃 광): ivory field covered in pink-crimson cherry blossom clusters at top, a large traditional Korean festival curtain (crimson and white vertical stripes, gold rope) across the lower half. 光 seal top-left.',
  ],
  ['03-tti', 'March ribbon (벚꽃 홍단): cherry blossom clusters, 홍단 crimson ribbon.'],
  ['03-pi', 'March junk (벚꽃 피): cherry blossom clusters only.'],
  [
    '04-yeol',
    'April animal (흑싸리 열끗): black hanging wisteria/bush-clover stems drooping from top, a small dark cuckoo bird flying, a small crimson crescent moon.',
  ],
  ['04-tti', 'April ribbon (흑싸리 초단): black hanging stems, plain crimson 초단 ribbon.'],
  ['04-pi', 'April junk (흑싸리 피): black hanging stems with small leaves only.'],
  [
    '05-yeol',
    'May animal (난초 열끗): purple iris flowers with long green blade leaves, a simple brown wooden plank bridge across the lower part.',
  ],
  ['05-tti', 'May ribbon (난초 초단): iris flowers and leaves, plain crimson 초단 ribbon.'],
  ['05-pi', 'May junk (난초 피): iris flowers and green leaves only.'],
  ['06-yeol', 'June animal (모란 열끗): big crimson peony flowers with dark green leaves, two butterflies (blue and gold) above.'],
  ['06-tti', 'June ribbon (모란 청단): crimson peonies with leaves, 청단 deep blue ribbon.'],
  ['06-pi', 'June junk (모란 피): one big crimson peony with leaves only.'],
  ['07-yeol', 'July animal (홍싸리 열끗): crimson bush-clover stems from top, a dark brown wild boar running across the lower half.'],
  ['07-tti', 'July ribbon (홍싸리 초단): crimson bush-clover stems, plain crimson 초단 ribbon.'],
  ['07-pi', 'July junk (홍싸리 피): crimson bush-clover stems only.'],
  [
    '08-yeol',
    'August animal (공산 열끗): ivory/pale sky, three black wild geese flying in a V formation, large black rounded hill with white grass blades in the bottom half (same hill as the reference 공산 광).',
  ],
  [
    '08-pi',
    'August junk (공산 피): crimson sky top, large black rounded hill with white grass blades (like the reference 공산 광 but without the moon and without 光).',
  ],
  [
    '09-yeol',
    'September animal (국화 열끗, 국진): yellow and crimson chrysanthemum flowers, a large crimson lacquered Korean wine cup (술잔) with a gold 壽-like ornamental pattern drawn as abstract shape (not a readable character) in the lower half.',
  ],
  ['09-tti', 'September ribbon (국화 청단): chrysanthemum flowers, 청단 deep blue ribbon.'],
  ['09-pi', 'September junk (국화 피): chrysanthemum flowers only.'],
  [
    '10-yeol',
    'October animal (단풍 열끗): crimson and orange maple leaves at the top, a brown spotted deer standing and looking back in the lower half.',
  ],
  ['10-tti', 'October ribbon (단풍 청단): crimson maple leaves, 청단 deep blue ribbon.'],
  ['10-pi', 'October junk (단풍 피): crimson maple leaves only.'],
  [
    '11-gwang',
    'November bright (오동 광): large black paulownia leaves at the bottom, a majestic Korean phoenix (봉황) with crimson, gold and green plumage at the top. 光 seal top-left.',
  ],
  [
    '11-ssangpi',
    'November DOUBLE junk (오동 쌍피): black paulownia leaves with a crimson band across the top third; add a small gold paulownia flower cluster. Must look more decorated than the normal 11 junk.',
  ],
  ['11-pi', 'November junk (오동 피): black paulownia leaves with ivory background, plain.'],
  [
    '12-gwang',
    'December bright (비광): crimson background, a Korean scholar (선비) wearing a black gat hat and white hanbok holding a yellow oil-paper umbrella, a small green frog at his feet, willow branch, rain streaks. 光 seal top-left.',
  ],
  ['12-yeol', 'December animal (비 열끗): willow branches with rain streaks, a black swallow flying.'],
  ['12-tti', 'December ribbon (비 띠): willow branches with rain streaks, crimson ribbon with black zigzag stripes.'],
  [
    'bonus-2',
    'BONUS card (보너스 쌍피): festive gold and crimson card: big gold lucky pouch (복주머니) in the center with crimson knot tassel, two small white dots/stars indicating double. Ivory background with gold rays.',
  ],
  [
    'bonus-3',
    'BONUS card (보너스 쓰리피): festive gold and crimson card: three gold coins (엽전, round with square hole) stacked in the center with crimson ribbon, gold rays background. Must differ clearly from the lucky-pouch bonus card.',
  ],
];

const N = 4;
const batches = Array.from({ length: N }, () => []);
cards.forEach((c, i) => batches[i % N].push(c));

batches.forEach((b, i) => {
  const list = b.map(([id, desc]) => `- ${OUT}/${id}.png : ${desc}`).join('\n');
  const prompt = `Use your built-in image generation tool to create ${b.length} Korean Go-Stop (맞고) hwatu card faces, ONE image per card, and save each as PNG at the exact path given (resample to exactly 1000x1600 if needed, never add margins).
The attached images are approved STYLE REFERENCES from the same deck (January bright, August bright, December double junk). Match their line weight, palette, flatness and level of detail exactly.

${STYLE}

CARDS:
${list}

Work through all cards. Do not edit any other files. When finished, print the saved paths.`;
  writeFileSync(`assets/cards/prompts/batch-${i + 1}.md`, prompt);
});
console.log(batches.map((b) => b.length));
