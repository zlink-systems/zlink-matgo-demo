import { Sprite, Texture } from 'pixi.js';
import { DECK, SLOTS, STAGE_H, STAGE_W } from './layout';

/** 녹색 담요 + 원목 테두리 + 바닥패 방석. 한 번 그려서 텍스처로 쓴다. */
export function createBackground(): Sprite {
  const cv = document.createElement('canvas');
  cv.width = STAGE_W;
  cv.height = STAGE_H;
  const g = cv.getContext('2d')!;

  // 원목
  const wood = g.createLinearGradient(0, 0, 0, STAGE_H);
  wood.addColorStop(0, '#5a2e14');
  wood.addColorStop(0.5, '#3d1d0b');
  wood.addColorStop(1, '#5a2e14');
  g.fillStyle = wood;
  g.fillRect(0, 0, STAGE_W, STAGE_H);
  for (let i = 0; i < 260; i++) {
    g.strokeStyle = `rgba(${20 + Math.random() * 30},${8 + Math.random() * 10},0,${0.15 + Math.random() * 0.2})`;
    g.lineWidth = 1 + Math.random() * 2;
    const y = Math.random() * STAGE_H;
    g.beginPath();
    g.moveTo(0, y);
    g.bezierCurveTo(STAGE_W * 0.3, y + (Math.random() - 0.5) * 30, STAGE_W * 0.7, y + (Math.random() - 0.5) * 30, STAGE_W, y);
    g.stroke();
  }

  // 담요
  const inset = 18;
  g.save();
  g.beginPath();
  g.roundRect(inset, inset, STAGE_W - inset * 2, STAGE_H - inset * 2, 36);
  g.clip();
  const felt = g.createRadialGradient(DECK.x, DECK.y, 100, DECK.x, DECK.y, 1250);
  felt.addColorStop(0, '#1d7a43');
  felt.addColorStop(0.55, '#0f5a30');
  felt.addColorStop(1, '#062c17');
  g.fillStyle = felt;
  g.fillRect(0, 0, STAGE_W, STAGE_H);
  // 천 결
  const img = g.getImageData(0, 0, STAGE_W, STAGE_H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 18;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);

  // 바닥패 방석 (조금 밝은 원형 영역)
  const minX = Math.min(...SLOTS.map((s) => s.x)) - 95;
  const maxX = Math.max(...SLOTS.map((s) => s.x)) + 120;
  const minY = Math.min(...SLOTS.map((s) => s.y)) - 115;
  const maxY = Math.max(...SLOTS.map((s) => s.y)) + 125;
  g.fillStyle = 'rgba(255,255,255,0.05)';
  g.strokeStyle = 'rgba(255,235,170,0.22)';
  g.lineWidth = 3;
  g.setLineDash([2, 10]);
  g.beginPath();
  g.roundRect(minX, minY, maxX - minX, maxY - minY, 120);
  g.fill();
  g.stroke();
  g.setLineDash([]);

  // 패널 구분: 오른쪽 먹은 패 영역
  g.fillStyle = 'rgba(0,0,0,0.22)';
  g.beginPath();
  g.roundRect(1598, 30, 300, 470, 20);
  g.fill();
  g.beginPath();
  g.roundRect(1598, 548, 300, 510, 20);
  g.fill();
  // 왼쪽 정보 패널
  g.beginPath();
  g.roundRect(30, 30, 270, 300, 20);
  g.fill();
  g.beginPath();
  g.roundRect(30, 728, 270, 330, 20);
  g.fill();

  // 비네트
  const vig = g.createRadialGradient(STAGE_W / 2, STAGE_H / 2, 500, STAGE_W / 2, STAGE_H / 2, 1150);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.45)');
  g.fillStyle = vig;
  g.fillRect(0, 0, STAGE_W, STAGE_H);
  g.restore();

  // 담요 테두리 금색 선
  g.strokeStyle = 'rgba(232,182,76,0.55)';
  g.lineWidth = 3;
  g.beginPath();
  g.roundRect(inset + 6, inset + 6, STAGE_W - inset * 2 - 12, STAGE_H - inset * 2 - 12, 32);
  g.stroke();

  return new Sprite(Texture.from(cv));
}
