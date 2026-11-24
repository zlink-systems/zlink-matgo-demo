import { cardOf, type PlayerId } from '../../model/engine';
import { VIEW_H, VIEW_W } from '../card/cardView';

/** 1920x1080 기준 화면 배치 */

export const STAGE_W = 1920;
export const STAGE_H = 1080;

export interface Spot {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  faceUp: boolean;
  z: number;
}

export const DECK = { x: 940, y: 500 };
export const HAND_SCALE = [1.2, 0.6] as const;

const FLOOR_SCALE = 0.95;
const SLOT_X = [470, 625, 780, 1100, 1255, 1410];
const SLOT_Y = [345, 655];
/** 12칸: 위 6칸, 아래 6칸. 덱 가까운 칸부터 채운다 */
export const SLOTS: { x: number; y: number }[] = [];
const ORDER = [2, 3, 1, 4, 0, 5];
for (const row of [0, 1]) for (const i of ORDER) SLOTS.push({ x: SLOT_X[i], y: SLOT_Y[row] });

export function floorSpot(slot: number, stackIndex: number): Spot {
  const s = SLOTS[slot];
  return {
    x: s.x + stackIndex * 18,
    y: s.y + stackIndex * 14,
    scale: FLOOR_SCALE,
    rotation: (((slot * 37) % 7) - 3) * 0.012 + stackIndex * 0.03,
    faceUp: true,
    z: 100 + stackIndex,
  };
}

export function deckSpot(index: number, total: number): Spot {
  const fromTop = total - 1 - index;
  return {
    x: DECK.x - fromTop * 0.25,
    y: DECK.y - fromTop * 0.9 + total * 0.9,
    scale: FLOOR_SCALE,
    rotation: 0,
    faceUp: false,
    z: 50 + index,
  };
}

export function handSpot(player: PlayerId, index: number, total: number): Spot {
  if (player === 0) {
    const gap = Math.min(128, 1240 / Math.max(total, 1));
    const x = 940 + (index - (total - 1) / 2) * gap;
    return { x, y: 950, scale: HAND_SCALE[0], rotation: 0, faceUp: true, z: 300 + index };
  }
  const gap = Math.min(64, 640 / Math.max(total, 1));
  const x = 940 + (index - (total - 1) / 2) * gap;
  return { x, y: 74, scale: HAND_SCALE[1], rotation: 0, faceUp: false, z: 300 + index };
}

export type Group = 'gwang' | 'yeol' | 'tti' | 'pi';
export const GROUPS: Group[] = ['gwang', 'yeol', 'tti', 'pi'];

export function groupOf(id: string, gukjinAsPi: boolean): Group {
  const c = cardOf(id)!;
  if (c.gukjin && gukjinAsPi) return 'pi';
  return c.kind;
}

export const CAP_SCALE = 0.56;
const CAP_X0 = 1690;
const CAP_X1 = 1862;
const CAP_ROW_H = 92;
const PI_PER_ROW = 10;
/** 먹은 패 줄 수: 광, 열끗, 띠, 피, 피(11장째부터) */
export const CAP_ROWS = 5;

/** 먹은 패 패널 안 줄의 중심 y */
export function capturedRowY(player: PlayerId, row: number): number {
  return (player === 0 ? 602 : 84) + row * CAP_ROW_H;
}
export const CAP_LABEL_X = 1630;

/** 먹은 패 위치: 오른쪽 패널, 종류별 줄. 장 수가 많을수록 촘촘히 겹친다 */
export function capturedSpot(player: PlayerId, group: Group, index: number, groupTotal: number): Spot {
  let row = GROUPS.indexOf(group);
  let col = index;
  let inRow = groupTotal;
  if (group === 'pi') {
    if (index >= PI_PER_ROW) {
      row += 1;
      col = index - PI_PER_ROW;
      inRow = groupTotal - PI_PER_ROW;
    } else inRow = Math.min(groupTotal, PI_PER_ROW);
  }
  const step = inRow > 1 ? Math.min(40, (CAP_X1 - CAP_X0) / (inRow - 1)) : 0;
  return {
    x: CAP_X0 + col * step,
    y: capturedRowY(player, row),
    scale: CAP_SCALE,
    rotation: 0,
    faceUp: true,
    z: 200 + row * 30 + col,
  };
}

export const CARD_SIZE = { w: VIEW_W, h: VIEW_H };
