import { cardById, type Card } from '../../model/cards';

/** 생성 이미지가 없을 때 쓰는 화투 그림 (Canvas 2D). 월별 상징을 큼직한 도형으로 그린다. */

export const CARD_W = 256;
export const CARD_H = 410;

type Ctx = CanvasRenderingContext2D;

function roundRect(g: Ctx, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function circle(g: Ctx, x: number, y: number, r: number, fill: string, stroke = '#1a1a1a', lw = 3) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = fill;
  g.fill();
  if (stroke) {
    g.lineWidth = lw;
    g.strokeStyle = stroke;
    g.stroke();
  }
}

function blossom(g: Ctx, x: number, y: number, r: number, petal: string, center = '#f7d64a') {
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    circle(g, x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.5, petal, '#3a0a0a', 2);
  }
  circle(g, x, y, r * 0.28, center, '#3a0a0a', 2);
}

function branch(g: Ctx, pts: [number, number][], w = 10, color = '#2b1a12') {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = w;
  g.strokeStyle = color;
  g.stroke();
}

function pineCluster(g: Ctx, x: number, y: number, r: number) {
  for (let i = 0; i < 13; i++) {
    const a = Math.PI + (i / 12) * Math.PI;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8);
    g.lineWidth = 4;
    g.strokeStyle = '#0f4d2a';
    g.stroke();
  }
  g.beginPath();
  g.ellipse(x, y - r * 0.25, r * 0.95, r * 0.55, 0, Math.PI, 0);
  g.fillStyle = 'rgba(20,110,60,0.55)';
  g.fill();
}

function leaf(g: Ctx, x: number, y: number, len: number, ang: number, color: string, wid = 0.28) {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(len * 0.5, -len * wid, len, 0);
  g.quadraticCurveTo(len * 0.5, len * wid, 0, 0);
  g.fillStyle = color;
  g.fill();
  g.lineWidth = 2;
  g.strokeStyle = '#111';
  g.stroke();
  g.restore();
}

function maple(g: Ctx, x: number, y: number, r: number, color: string) {
  g.save();
  g.translate(x, y);
  g.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + ((i - 2) / 2.5) * 1.3;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    g.lineTo(Math.cos(a + 0.26) * r * 0.42, Math.sin(a + 0.26) * r * 0.42);
  }
  g.lineTo(0, r * 0.35);
  g.closePath();
  g.fillStyle = color;
  g.fill();
  g.lineWidth = 2;
  g.strokeStyle = '#3a0a0a';
  g.stroke();
  g.restore();
}

function ribbon(g: Ctx, kind: Card['ttiKind']) {
  const color = kind === 'cheong' ? '#1d4fa3' : '#c8102e';
  g.save();
  g.translate(CARD_W * 0.56, 60);
  g.rotate(0.08);
  g.beginPath();
  g.moveTo(-26, 0);
  g.lineTo(26, 0);
  g.lineTo(30, 230);
  g.lineTo(0, 210);
  g.lineTo(-22, 232);
  g.closePath();
  g.fillStyle = color;
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = '#111';
  g.stroke();
  if (kind === 'hong' || kind === 'cheong') {
    g.fillStyle = '#fff6e0';
    g.font = 'bold 34px "Noto Serif KR", serif';
    g.textAlign = 'center';
    const txt = kind === 'hong' ? '홍단' : '청단';
    g.fillText(txt[0], 2, 70);
    g.fillText(txt[1], 2, 112);
  }
  // 띠 위 광택
  g.fillStyle = 'rgba(255,255,255,0.25)';
  g.fillRect(-20, 4, 8, 200);
  g.restore();
}

function gwangMark(g: Ctx) {
  circle(g, 46, 48, 26, '#c8102e', '#5a0000', 3);
  g.fillStyle = '#fff';
  g.font = 'bold 32px "Noto Serif KR", serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('光', 46, 50);
  g.textBaseline = 'alphabetic';
}

function bird(g: Ctx, x: number, y: number, s: number, body: string, wing: string) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.beginPath();
  g.ellipse(0, 0, 34, 22, -0.2, 0, Math.PI * 2);
  g.fillStyle = body;
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = '#111';
  g.stroke();
  g.beginPath();
  g.ellipse(6, -2, 22, 12, -0.5, 0, Math.PI * 2);
  g.fillStyle = wing;
  g.fill();
  g.stroke();
  circle(g, -28, -14, 13, body);
  circle(g, -31, -17, 3, '#111', '', 0);
  g.beginPath();
  g.moveTo(-40, -14);
  g.lineTo(-54, -10);
  g.lineTo(-40, -8);
  g.fillStyle = '#e0a020';
  g.fill();
  g.beginPath();
  g.moveTo(30, 4);
  g.lineTo(58, 16);
  g.lineTo(52, -2);
  g.fillStyle = wing;
  g.fill();
  g.stroke();
  g.restore();
}

function paintMonth(g: Ctx, card: Card) {
  const W = CARD_W,
    H = CARD_H;
  const m = card.month;
  const k = card.kind;
  switch (m) {
    case 1: {
      if (k === 'gwang') {
        circle(g, W * 0.5, 120, 70, '#d7261e', '#7a0b0b', 4);
        // 학
        g.beginPath();
        g.ellipse(W * 0.5, 290, 48, 30, 0, 0, Math.PI * 2);
        g.fillStyle = '#fff';
        g.fill();
        g.lineWidth = 3;
        g.strokeStyle = '#111';
        g.stroke();
        branch(
          g,
          [
            [W * 0.5 - 30, 280],
            [W * 0.5 - 40, 220],
            [W * 0.5 - 30, 190],
          ],
          9,
          '#111',
        );
        circle(g, W * 0.5 - 30, 186, 11, '#fff');
        circle(g, W * 0.5 - 30, 178, 6, '#d7261e', '', 0);
        branch(
          g,
          [
            [W * 0.5 - 40, 186],
            [W * 0.5 - 62, 194],
          ],
          4,
          '#c08a20',
        );
        branch(
          g,
          [
            [W * 0.5 + 10, 318],
            [W * 0.5 + 8, 370],
          ],
          4,
          '#111',
        );
        branch(
          g,
          [
            [W * 0.5 - 10, 318],
            [W * 0.5 - 14, 370],
          ],
          4,
          '#111',
        );
        g.beginPath();
        g.ellipse(W * 0.5 + 30, 290, 26, 14, 0.3, 0, Math.PI * 2);
        g.fillStyle = '#111';
        g.fill();
      }
      pineCluster(g, 60, H - 40, 70);
      pineCluster(g, W - 50, H - 20, 60);
      if (k !== 'gwang') {
        branch(
          g,
          [
            [0, H - 60],
            [W * 0.5, H * 0.55],
            [W, H * 0.3],
          ],
          12,
        );
        pineCluster(g, W * 0.45, H * 0.5, 60);
        pineCluster(g, W * 0.8, H * 0.32, 55);
      }
      break;
    }
    case 2: {
      branch(
        g,
        [
          [10, H - 20],
          [W * 0.4, H * 0.55],
          [W * 0.7, H * 0.3],
          [W - 10, H * 0.15],
        ],
        12,
      );
      branch(
        g,
        [
          [W * 0.4, H * 0.55],
          [W * 0.2, H * 0.3],
        ],
        7,
      );
      const pts: [number, number][] = [
        [W * 0.2, H * 0.3],
        [W * 0.5, H * 0.45],
        [W * 0.72, H * 0.28],
        [W * 0.9, H * 0.17],
        [W * 0.3, H * 0.7],
        [W * 0.6, H * 0.6],
      ];
      pts.forEach(([x, y]) => blossom(g, x, y, 22, '#d7263d'));
      if (k === 'yeol') bird(g, W * 0.55, H * 0.75, 1.3, '#9bb53a', '#5f7d1d');
      break;
    }
    case 3: {
      if (k === 'gwang') {
        // 장막
        g.fillStyle = '#c8102e';
        g.fillRect(14, H * 0.55, W - 28, H * 0.42);
        g.fillStyle = '#fff';
        for (let i = 0; i < 5; i++) g.fillRect(14 + i * 48, H * 0.55, 24, H * 0.42);
        g.strokeStyle = '#111';
        g.lineWidth = 3;
        g.strokeRect(14, H * 0.55, W - 28, H * 0.42);
      }
      const cnt = k === 'gwang' ? 6 : 9;
      for (let i = 0; i < cnt; i++) {
        const x = 40 + ((i * 71) % (W - 70));
        const y = 50 + ((i * 53) % (k === 'gwang' ? 160 : 300));
        blossom(g, x, y, 26, '#f4a6b8', '#d7263d');
      }
      break;
    }
    case 4: {
      // 흑싸리: 늘어진 검은 줄기
      for (let i = 0; i < 6; i++) {
        const x = 30 + i * 40;
        branch(
          g,
          [
            [x, 0],
            [x + 10, 120],
            [x - 5, 240 + (i % 2) * 40],
          ],
          5,
          '#111',
        );
        for (let j = 0; j < 6; j++) leaf(g, x + 6, 30 + j * 38, 26, Math.PI / 2 + (j % 2 ? 0.6 : -0.6), '#1b1b1b');
      }
      if (k === 'yeol') bird(g, W * 0.5, H * 0.78, 1.2, '#4a4a4a', '#222');
      break;
    }
    case 5: {
      for (let i = 0; i < 7; i++) leaf(g, W * 0.5, H - 20, 230, -Math.PI / 2 + (i - 3) * 0.18, '#1f6f3a', 0.1);
      for (let i = 0; i < 3; i++) {
        const x = W * 0.3 + i * 50,
          y = 130 + i * 30;
        circle(g, x, y, 22, '#6a3fa0', '#111', 2);
        circle(g, x, y + 10, 10, '#e6d3ff', '', 0);
      }
      if (k === 'yeol') {
        g.fillStyle = '#7a4b25';
        g.fillRect(10, H * 0.72, W - 20, 30);
        g.strokeStyle = '#111';
        g.lineWidth = 3;
        g.strokeRect(10, H * 0.72, W - 20, 30);
        for (let i = 0; i < 4; i++) g.fillRect(30 + i * 60, H * 0.72 + 30, 12, 60);
      }
      break;
    }
    case 6: {
      const pts: [number, number][] = [
        [W * 0.35, H * 0.45],
        [W * 0.7, H * 0.62],
        [W * 0.4, H * 0.8],
      ];
      for (const [x, y] of pts) {
        for (let i = 0; i < 8; i++) leaf(g, x, y, 60, (i / 8) * Math.PI * 2, '#1f5e34', 0.35);
        circle(g, x, y, 40, '#c2185b', '#4a0020', 3);
        circle(g, x, y, 24, '#e04a80', '#4a0020', 2);
        circle(g, x, y, 10, '#f7d64a', '', 0);
      }
      if (k === 'yeol') {
        for (const [x, y] of [
          [W * 0.35, H * 0.16],
          [W * 0.68, H * 0.24],
        ] as [number, number][]) {
          g.save();
          g.translate(x, y);
          for (const s of [-1, 1]) {
            g.beginPath();
            g.ellipse(s * 22, -8, 22, 16, s * 0.5, 0, Math.PI * 2);
            g.fillStyle = '#2a5fb0';
            g.fill();
            g.strokeStyle = '#111';
            g.lineWidth = 2;
            g.stroke();
            g.beginPath();
            g.ellipse(s * 16, 14, 14, 10, s * -0.4, 0, Math.PI * 2);
            g.fillStyle = '#f2c230';
            g.fill();
            g.stroke();
          }
          g.restore();
        }
      }
      break;
    }
    case 7: {
      for (let i = 0; i < 5; i++) {
        const x = 30 + i * 50;
        branch(
          g,
          [
            [x, H],
            [x + 20, H * 0.5],
            [x - 10, 30],
          ],
          4,
          '#5a2a10',
        );
        for (let j = 0; j < 7; j++) circle(g, x + 10 + (j % 2 ? 10 : -6), 40 + j * 45, 9, '#c0392b', '#3a0a0a', 1.5);
      }
      if (k === 'yeol') {
        // 멧돼지
        g.save();
        g.translate(W * 0.5, H * 0.72);
        g.beginPath();
        g.ellipse(0, 0, 80, 44, 0, 0, Math.PI * 2);
        g.fillStyle = '#4a2c1a';
        g.fill();
        g.lineWidth = 3;
        g.strokeStyle = '#111';
        g.stroke();
        circle(g, -78, -6, 26, '#4a2c1a');
        circle(g, -84, -14, 4, '#fff', '', 0);
        for (const lx of [-40, -10, 30, 55])
          branch(
            g,
            [
              [lx, 30],
              [lx, 70],
            ],
            10,
            '#2a160c',
          );
        g.restore();
      }
      break;
    }
    case 8: {
      if (k === 'gwang') {
        g.fillStyle = '#c8102e';
        g.fillRect(12, 12, W - 24, H * 0.62);
        circle(g, W * 0.5, H * 0.36, 78, '#fffbe8', '#111', 3);
      }
      // 검은 산
      g.beginPath();
      g.moveTo(12, H - 12);
      g.lineTo(12, H * 0.62);
      g.quadraticCurveTo(W * 0.5, H * 0.3, W - 12, H * 0.62);
      g.lineTo(W - 12, H - 12);
      g.closePath();
      g.fillStyle = '#121212';
      g.fill();
      for (let i = 0; i < 12; i++)
        branch(
          g,
          [
            [30 + i * 18, H * 0.66 - Math.sin(i / 2) * 20],
            [36 + i * 18, H * 0.58 - Math.sin(i / 2) * 20],
          ],
          3,
          '#e8e2d0',
        );
      if (k === 'yeol') {
        for (const [x, y] of [
          [W * 0.3, 90],
          [W * 0.55, 60],
          [W * 0.75, 120],
        ] as [number, number][]) {
          g.beginPath();
          g.moveTo(x - 30, y);
          g.quadraticCurveTo(x - 10, y - 20, x, y);
          g.quadraticCurveTo(x + 10, y - 20, x + 30, y);
          g.lineWidth = 6;
          g.strokeStyle = '#111';
          g.stroke();
        }
      }
      break;
    }
    case 9: {
      const pts: [number, number][] = [
        [W * 0.3, H * 0.3],
        [W * 0.7, H * 0.4],
        [W * 0.45, H * 0.62],
      ];
      for (const [x, y] of pts) {
        for (let i = 0; i < 14; i++) leaf(g, x, y, 42, (i / 14) * Math.PI * 2, '#f2b705', 0.22);
        circle(g, x, y, 14, '#c8102e', '#111', 2);
      }
      if (k === 'yeol') {
        // 술잔
        g.beginPath();
        g.ellipse(W * 0.5, H * 0.82, 60, 18, 0, 0, Math.PI * 2);
        g.fillStyle = '#c8102e';
        g.fill();
        g.lineWidth = 3;
        g.strokeStyle = '#111';
        g.stroke();
        g.beginPath();
        g.moveTo(W * 0.5 - 60, H * 0.82);
        g.quadraticCurveTo(W * 0.5, H * 0.96, W * 0.5 + 60, H * 0.82);
        g.fillStyle = '#9a0c22';
        g.fill();
        g.stroke();
        g.fillStyle = '#f2c230';
        g.font = 'bold 26px "Noto Serif KR", serif';
        g.textAlign = 'center';
        g.fillText('壽', W * 0.5, H * 0.89);
      }
      break;
    }
    case 10: {
      const pts: [number, number][] = [
        [W * 0.25, 70],
        [W * 0.6, 110],
        [W * 0.8, 60],
        [W * 0.4, 190],
        [W * 0.75, 230],
        [W * 0.2, 280],
      ];
      pts.forEach(([x, y], i) => maple(g, x, y, 40, i % 2 ? '#d7261e' : '#e8541c'));
      if (k === 'yeol') {
        g.save();
        g.translate(W * 0.5, H * 0.78);
        g.beginPath();
        g.ellipse(0, 0, 64, 34, 0, 0, Math.PI * 2);
        g.fillStyle = '#b5722e';
        g.fill();
        g.lineWidth = 3;
        g.strokeStyle = '#111';
        g.stroke();
        circle(g, 58, -40, 18, '#b5722e');
        branch(
          g,
          [
            [62, -56],
            [70, -86],
            [84, -96],
          ],
          4,
          '#3a220e',
        );
        for (const lx of [-40, -15, 20, 45])
          branch(
            g,
            [
              [lx, 26],
              [lx, 70],
            ],
            7,
            '#6a3d16',
          );
        for (let i = 0; i < 5; i++) circle(g, -30 + i * 14, -8 + (i % 2) * 10, 4, '#fff', '', 0);
        g.restore();
      }
      break;
    }
    case 11: {
      for (const [x, y] of [
        [W * 0.3, H * 0.45],
        [W * 0.7, H * 0.4],
        [W * 0.5, H * 0.7],
      ] as [number, number][]) {
        for (let i = 0; i < 3; i++) leaf(g, x, y, 70, -Math.PI / 2 + (i - 1) * 0.9, '#141414', 0.45);
      }
      if (k === 'gwang') {
        // 봉황 머리
        bird(g, W * 0.5, 120, 1.5, '#f2c230', '#c8102e');
      } else {
        g.fillStyle = card.piValue === 2 ? '#f2c230' : '#8a6a3a';
        g.fillRect(14, H * 0.12, W - 28, 24);
      }
      break;
    }
    case 12: {
      if (k === 'gwang') {
        // 우산 쓴 선비 (갓)
        g.fillStyle = '#c8102e';
        g.fillRect(12, 12, W - 24, H - 24);
        g.beginPath();
        g.moveTo(W * 0.25, 150);
        g.quadraticCurveTo(W * 0.5, 60, W * 0.85, 150);
        g.closePath();
        g.fillStyle = '#e9c46a';
        g.fill();
        g.lineWidth = 3;
        g.strokeStyle = '#111';
        g.stroke();
        branch(
          g,
          [
            [W * 0.55, 110],
            [W * 0.55, 260],
          ],
          4,
          '#111',
        );
        g.beginPath();
        g.moveTo(W * 0.38, 240);
        g.lineTo(W * 0.62, 240);
        g.lineTo(W * 0.7, H - 40);
        g.lineTo(W * 0.3, H - 40);
        g.closePath();
        g.fillStyle = '#f5f0e6';
        g.fill();
        g.stroke();
        circle(g, W * 0.5, 215, 22, '#f2d0a9');
        g.fillStyle = '#111';
        g.fillRect(W * 0.5 - 36, 192, 72, 6);
        g.fillRect(W * 0.5 - 14, 172, 28, 22);
      } else {
        for (let i = 0; i < 18; i++) {
          const x = (i * 37) % W,
            y = (i * 61) % (H - 60);
          branch(
            g,
            [
              [x, y],
              [x - 16, y + 46],
            ],
            3,
            '#3b6fb6',
          );
        }
        branch(
          g,
          [
            [W, 0],
            [W * 0.7, 60],
            [W * 0.5, 200],
          ],
          4,
          '#2b1a12',
        );
        for (let j = 0; j < 7; j++) leaf(g, W * 0.7 - j * 10, 40 + j * 26, 34, Math.PI / 2 + 0.4, '#2f8f4a', 0.18);
        if (k === 'yeol') bird(g, W * 0.45, H * 0.62, 1.3, '#1b1b3a', '#111');
        if (card.piValue === 2) {
          // 북
          g.save();
          g.translate(W * 0.5, H * 0.66);
          g.beginPath();
          g.ellipse(0, 0, 70, 70, 0, 0, Math.PI * 2);
          g.fillStyle = '#c8102e';
          g.fill();
          g.lineWidth = 4;
          g.strokeStyle = '#111';
          g.stroke();
          for (let i = 0; i < 3; i++) {
            g.beginPath();
            g.arc(0, 0, 50, (i * 2 * Math.PI) / 3, (i * 2 * Math.PI) / 3 + 1.6);
            g.lineWidth = 14;
            g.strokeStyle = ['#1d4fa3', '#f2c230', '#111'][i];
            g.stroke();
          }
          g.restore();
        }
      }
      break;
    }
  }
}

function paintBonus(g: Ctx, card: Card) {
  const W = CARD_W,
    H = CARD_H;
  const grd = g.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, 220);
  grd.addColorStop(0, '#fff3b0');
  grd.addColorStop(1, '#e0a400');
  g.fillStyle = grd;
  roundRect(g, 12, 12, W - 24, H - 24, 14);
  g.fill();
  g.fillStyle = '#7a0b0b';
  g.textAlign = 'center';
  g.font = 'bold 54px "Black Han Sans", sans-serif';
  g.fillText('보너스', W / 2, 150);
  g.font = 'bold 120px "Black Han Sans", sans-serif';
  g.fillText(card.piValue === 3 ? '3' : '2', W / 2, 290);
  g.font = 'bold 40px "Black Han Sans", sans-serif';
  g.fillText(card.piValue === 3 ? '쓰리피' : '쌍피', W / 2, 350);
}

export function paintCardFace(id: string): HTMLCanvasElement {
  const card = cardById(id);
  const cv = document.createElement('canvas');
  cv.width = CARD_W;
  cv.height = CARD_H;
  const g = cv.getContext('2d')!;
  // 바탕: 상아색 + 붉은 테두리
  g.fillStyle = '#7d1414';
  roundRect(g, 0, 0, CARD_W, CARD_H, 22);
  g.fill();
  g.save();
  roundRect(g, 10, 10, CARD_W - 20, CARD_H - 20, 14);
  g.clip();
  g.fillStyle = '#f7f0df';
  g.fillRect(0, 0, CARD_W, CARD_H);
  if (card.bonus) paintBonus(g, card);
  else {
    paintMonth(g, card);
    if (card.kind === 'tti') ribbon(g, card.ttiKind);
    if (card.kind === 'gwang') gwangMark(g);
  }
  // 플라스틱 광택
  const gloss = g.createLinearGradient(0, 0, CARD_W, CARD_H);
  gloss.addColorStop(0, 'rgba(255,255,255,0.35)');
  gloss.addColorStop(0.35, 'rgba(255,255,255,0.0)');
  gloss.addColorStop(1, 'rgba(0,0,0,0.08)');
  g.fillStyle = gloss;
  g.fillRect(0, 0, CARD_W, CARD_H);
  g.restore();
  return cv;
}

export function paintCardBack(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = CARD_W;
  cv.height = CARD_H;
  const g = cv.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, CARD_W, CARD_H);
  grd.addColorStop(0, '#b3141c');
  grd.addColorStop(1, '#6e0a10');
  g.fillStyle = grd;
  roundRect(g, 0, 0, CARD_W, CARD_H, 22);
  g.fill();
  // 문살 무늬
  g.save();
  roundRect(g, 14, 14, CARD_W - 28, CARD_H - 28, 14);
  g.clip();
  g.strokeStyle = 'rgba(255,210,120,0.18)';
  g.lineWidth = 3;
  for (let x = -CARD_H; x < CARD_W + CARD_H; x += 26) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + CARD_H, CARD_H);
    g.stroke();
    g.beginPath();
    g.moveTo(x + CARD_H, 0);
    g.lineTo(x, CARD_H);
    g.stroke();
  }
  g.restore();
  g.strokeStyle = '#e8b64c';
  g.lineWidth = 4;
  roundRect(g, 14, 14, CARD_W - 28, CARD_H - 28, 14);
  g.stroke();
  const gloss = g.createLinearGradient(0, 0, CARD_W, CARD_H * 0.6);
  gloss.addColorStop(0, 'rgba(255,255,255,0.28)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gloss;
  roundRect(g, 0, 0, CARD_W, CARD_H, 22);
  g.fill();
  return cv;
}
