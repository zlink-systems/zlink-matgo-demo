import { cardById, type Card } from './cards';

export interface ScoreBreakdown {
  gwang: number;
  yeol: number;
  tti: number;
  pi: number;
  godori: number;
  hongdan: number;
  cheongdan: number;
  chodan: number;
  total: number;
  /** 장 수 */
  gwangCount: number;
  yeolCount: number;
  ttiCount: number;
  piCount: number;
  /** 국진을 쌍피로 쓴 경우 true */
  gukjinAsPi: boolean;
}

function scoreWith(cards: Card[], gukjinAsPi: boolean): ScoreBreakdown {
  const gwangs = cards.filter((c) => c.kind === 'gwang');
  const yeols = cards.filter((c) => c.kind === 'yeol' && !(gukjinAsPi && c.gukjin));
  const ttis = cards.filter((c) => c.kind === 'tti');
  let piCount = cards.filter((c) => c.kind === 'pi').reduce((s, c) => s + c.piValue, 0);
  if (gukjinAsPi && cards.some((c) => c.gukjin)) piCount += 2;

  let gwang = 0;
  if (gwangs.length === 5) gwang = 15;
  else if (gwangs.length === 4) gwang = 4;
  else if (gwangs.length === 3) gwang = gwangs.some((c) => c.biGwang) ? 2 : 3;

  const yeol = yeols.length >= 5 ? yeols.length - 4 : 0;
  const godori = yeols.filter((c) => c.godori).length === 3 ? 5 : 0;

  const tti = ttis.length >= 5 ? ttis.length - 4 : 0;
  const count = (k: string) => ttis.filter((c) => c.ttiKind === k).length;
  const hongdan = count('hong') === 3 ? 3 : 0;
  const cheongdan = count('cheong') === 3 ? 3 : 0;
  const chodan = count('cho') === 3 ? 3 : 0;

  const pi = piCount >= 10 ? piCount - 9 : 0;

  return {
    gwang,
    yeol,
    tti,
    pi,
    godori,
    hongdan,
    cheongdan,
    chodan,
    total: gwang + yeol + tti + pi + godori + hongdan + cheongdan + chodan,
    gwangCount: gwangs.length,
    yeolCount: yeols.length,
    ttiCount: ttis.length,
    piCount,
    gukjinAsPi,
  };
}

/** 먹은 패의 점수. 국진은 점수가 높아지는 쪽으로 자동 판정한다. */
export function scoreCards(ids: readonly string[]): ScoreBreakdown {
  const cards = ids.map(cardById);
  const asYeol = scoreWith(cards, false);
  if (!cards.some((c) => c.gukjin)) return asYeol;
  const asPi = scoreWith(cards, true);
  return asPi.total > asYeol.total ? asPi : asYeol;
}

/** 패자 입장에서 피박을 피하기 위한 피 장수 (국진을 피로 쓸 수 있으면 쓴다) */
export function maxPiCount(ids: readonly string[]): number {
  const cards = ids.map(cardById);
  return scoreWith(
    cards,
    cards.some((c) => c.gukjin),
  ).piCount;
}

export interface Settlement {
  base: number;
  goBonus: number;
  multipliers: { label: string; factor: number }[];
  final: number;
}

export interface SettleInput {
  winnerCaptured: readonly string[];
  loserCaptured: readonly string[];
  winnerGo: number;
  loserGo: number;
  winnerShakes: number;
  carry: number;
}

/** 승자 점수 정산: 고 보너스, 흔들기, 박, 나가리 배수 */
export function settle(input: SettleInput): Settlement {
  const w = scoreCards(input.winnerCaptured);
  const loser = scoreCards(input.loserCaptured);
  const goBonus = input.winnerGo;
  const multipliers: { label: string; factor: number }[] = [];
  if (input.winnerGo >= 3) multipliers.push({ label: `${input.winnerGo}고`, factor: 2 ** (input.winnerGo - 2) });
  for (let i = 0; i < input.winnerShakes; i++) multipliers.push({ label: '흔들기', factor: 2 });
  if (w.pi > 0 && maxPiCount(input.loserCaptured) <= 7) multipliers.push({ label: '피박', factor: 2 });
  if (w.gwang > 0 && loser.gwangCount === 0) multipliers.push({ label: '광박', factor: 2 });
  if (w.yeolCount >= 7) multipliers.push({ label: '멍박', factor: 2 });
  if (input.loserGo > 0) multipliers.push({ label: '고박', factor: 2 });
  if (input.carry > 1) multipliers.push({ label: '나가리', factor: input.carry });
  const factor = multipliers.reduce((m, x) => m * x.factor, 1);
  return { base: w.total, goBonus, multipliers, final: (w.total + goBonus) * factor };
}
