import { Texture } from 'pixi.js';
import { ALL_CARDS } from '../../model/cards';
import { CARD_H, CARD_W, paintCardBack, paintCardFace } from './painter';

/**
 * 카드 텍스처. public/cards/<id>.webp 가 있으면 그 그림을 쓰고(둥근 모서리로 다듬음), 없으면 코드로 그린 그림을 쓴다.
 * public/cards/manifest.json 에 준비된 id 목록이 있다.
 */

const faces = new Map<string, Texture>();
let back: Texture;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function framed(img: HTMLImageElement): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = CARD_W;
  cv.height = CARD_H;
  const g = cv.getContext('2d')!;
  const r = 22;
  g.beginPath();
  g.roundRect(0, 0, CARD_W, CARD_H, r);
  g.clip();
  // 비율을 유지하며 꽉 채움
  const s = Math.max(CARD_W / img.width, CARD_H / img.height);
  const w = img.width * s,
    h = img.height * s;
  g.drawImage(img, (CARD_W - w) / 2, (CARD_H - h) / 2, w, h);
  // 모든 카드에 같은 테두리를 둘러 화풍 차이를 줄인다
  g.lineWidth = 8;
  g.strokeStyle = '#7d1414';
  g.beginPath();
  g.roundRect(4, 4, CARD_W - 8, CARD_H - 8, r - 4);
  g.stroke();
  return cv;
}

/** 뒷면: 앞면(특히 붉은 하늘의 8월 패)과 한눈에 구분되도록 더 짙게, 금색 이중 테와 가운데 문양을 둔다 */
function framedBack(img: HTMLImageElement): HTMLCanvasElement {
  const cv = framed(img);
  const g = cv.getContext('2d')!;
  const r = 22;
  g.save();
  g.beginPath();
  g.roundRect(0, 0, CARD_W, CARD_H, r);
  g.clip();
  g.fillStyle = 'rgba(40,0,6,0.38)';
  g.fillRect(0, 0, CARD_W, CARD_H);
  g.restore();
  g.strokeStyle = '#e8b64c';
  g.lineWidth = 6;
  g.beginPath();
  g.roundRect(16, 16, CARD_W - 32, CARD_H - 32, 14);
  g.stroke();
  g.lineWidth = 2;
  g.beginPath();
  g.roundRect(26, 26, CARD_W - 52, CARD_H - 52, 10);
  g.stroke();
  // 가운데 원 문양
  const cx = CARD_W / 2,
    cy = CARD_H / 2;
  g.fillStyle = '#5a0710';
  g.beginPath();
  g.arc(cx, cy, 62, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 6;
  g.beginPath();
  g.arc(cx, cy, 62, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 2;
  g.beginPath();
  g.arc(cx, cy, 50, 0, Math.PI * 2);
  g.stroke();
  // 매화 다섯 잎
  g.fillStyle = '#e8b64c';
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    g.beginPath();
    g.arc(cx + Math.cos(a) * 20, cy + Math.sin(a) * 20, 15, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#5a0710';
  g.beginPath();
  g.arc(cx, cy, 9, 0, Math.PI * 2);
  g.fill();
  return cv;
}

export async function loadCardTextures(onProgress?: (p: number) => void) {
  let available: string[] = [];
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}cards/manifest.json`, { cache: 'no-cache' });
    if (res.ok) available = await res.json();
  } catch {
    /* 그림 없음 */
  }
  const set = new Set(available);
  const ids = ALL_CARDS.map((c) => c.id);
  let done = 0;
  const total = ids.length + 1;
  const tick = () => onProgress?.(++done / total);

  await Promise.all(
    ids.map(async (id) => {
      let canvas: HTMLCanvasElement;
      if (set.has(id)) {
        try {
          canvas = framed(await loadImage(`${import.meta.env.BASE_URL}cards/${id}.webp`));
        } catch {
          canvas = paintCardFace(id);
        }
      } else canvas = paintCardFace(id);
      faces.set(id, Texture.from(canvas));
      tick();
    }),
  );

  let backCanvas: HTMLCanvasElement;
  if (set.has('back')) {
    try {
      backCanvas = framedBack(await loadImage(`${import.meta.env.BASE_URL}cards/back.webp`));
    } catch {
      backCanvas = paintCardBack();
    }
  } else backCanvas = paintCardBack();
  back = Texture.from(backCanvas);
  tick();
}

export function faceTexture(id: string): Texture {
  return faces.get(id) ?? back;
}

export function backTexture(): Texture {
  return back;
}
