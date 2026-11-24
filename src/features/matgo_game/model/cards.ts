/** 화투 카드 정의. 48장 + 보너스피 2장. */

export type CardKind = 'gwang' | 'yeol' | 'tti' | 'pi';
export type TtiKind = 'hong' | 'cheong' | 'cho' | 'none';

export interface Card {
  /** 고유 id. 예: "01-gwang", "12-pi", "bonus-2" */
  id: string;
  /** 1~12, 보너스는 0 */
  month: number;
  kind: CardKind;
  /** 피 장수(피=1, 쌍피=2, 보너스 쓰리피=3). 피가 아니면 0 */
  piValue: number;
  ttiKind?: TtiKind;
  /** 고도리 새 (2·4·8월 열끗) */
  godori?: boolean;
  /** 비광 (12월 광) */
  biGwang?: boolean;
  /** 국진 (9월 열끗, 쌍피로도 쓸 수 있음) */
  gukjin?: boolean;
  bonus?: boolean;
  /** 화면에 보일 이름 */
  name: string;
}

export const MONTH_NAMES = ['', '송학', '매조', '벚꽃', '흑싸리', '난초', '모란', '홍싸리', '공산', '국화', '단풍', '오동', '비'];

function c(month: number, kind: CardKind, suffix: string, name: string, extra: Partial<Card> = {}): Card {
  const mm = String(month).padStart(2, '0');
  return {
    id: `${mm}-${suffix}`,
    month,
    kind,
    piValue: kind === 'pi' ? 1 : 0,
    name,
    ...extra,
  };
}

export const ALL_CARDS: readonly Card[] = [
  // 1월 송학
  c(1, 'gwang', 'gwang', '송학 광'),
  c(1, 'tti', 'tti', '송학 홍단', { ttiKind: 'hong' }),
  c(1, 'pi', 'pi1', '송학 피'),
  c(1, 'pi', 'pi2', '송학 피'),
  // 2월 매조
  c(2, 'yeol', 'yeol', '매조 꾀꼬리', { godori: true }),
  c(2, 'tti', 'tti', '매조 홍단', { ttiKind: 'hong' }),
  c(2, 'pi', 'pi1', '매조 피'),
  c(2, 'pi', 'pi2', '매조 피'),
  // 3월 벚꽃
  c(3, 'gwang', 'gwang', '벚꽃 광'),
  c(3, 'tti', 'tti', '벚꽃 홍단', { ttiKind: 'hong' }),
  c(3, 'pi', 'pi1', '벚꽃 피'),
  c(3, 'pi', 'pi2', '벚꽃 피'),
  // 4월 흑싸리
  c(4, 'yeol', 'yeol', '흑싸리 두견새', { godori: true }),
  c(4, 'tti', 'tti', '흑싸리 초단', { ttiKind: 'cho' }),
  c(4, 'pi', 'pi1', '흑싸리 피'),
  c(4, 'pi', 'pi2', '흑싸리 피'),
  // 5월 난초
  c(5, 'yeol', 'yeol', '난초 다리'),
  c(5, 'tti', 'tti', '난초 초단', { ttiKind: 'cho' }),
  c(5, 'pi', 'pi1', '난초 피'),
  c(5, 'pi', 'pi2', '난초 피'),
  // 6월 모란
  c(6, 'yeol', 'yeol', '모란 나비'),
  c(6, 'tti', 'tti', '모란 청단', { ttiKind: 'cheong' }),
  c(6, 'pi', 'pi1', '모란 피'),
  c(6, 'pi', 'pi2', '모란 피'),
  // 7월 홍싸리
  c(7, 'yeol', 'yeol', '홍싸리 멧돼지'),
  c(7, 'tti', 'tti', '홍싸리 초단', { ttiKind: 'cho' }),
  c(7, 'pi', 'pi1', '홍싸리 피'),
  c(7, 'pi', 'pi2', '홍싸리 피'),
  // 8월 공산
  c(8, 'gwang', 'gwang', '공산 광'),
  c(8, 'yeol', 'yeol', '공산 기러기', { godori: true }),
  c(8, 'pi', 'pi1', '공산 피'),
  c(8, 'pi', 'pi2', '공산 피'),
  // 9월 국화
  c(9, 'yeol', 'yeol', '국화 술잔', { gukjin: true }),
  c(9, 'tti', 'tti', '국화 청단', { ttiKind: 'cheong' }),
  c(9, 'pi', 'pi1', '국화 피'),
  c(9, 'pi', 'pi2', '국화 피'),
  // 10월 단풍
  c(10, 'yeol', 'yeol', '단풍 사슴'),
  c(10, 'tti', 'tti', '단풍 청단', { ttiKind: 'cheong' }),
  c(10, 'pi', 'pi1', '단풍 피'),
  c(10, 'pi', 'pi2', '단풍 피'),
  // 11월 오동
  c(11, 'gwang', 'gwang', '오동 광'),
  c(11, 'pi', 'ssangpi', '오동 쌍피', { piValue: 2 }),
  c(11, 'pi', 'pi1', '오동 피'),
  c(11, 'pi', 'pi2', '오동 피'),
  // 12월 비
  c(12, 'gwang', 'gwang', '비광', { biGwang: true }),
  c(12, 'yeol', 'yeol', '비 제비'),
  c(12, 'tti', 'tti', '비 띠', { ttiKind: 'none' }),
  c(12, 'pi', 'ssangpi', '비 쌍피', { piValue: 2 }),
  // 보너스피
  { id: 'bonus-2', month: 0, kind: 'pi', piValue: 2, bonus: true, name: '보너스 쌍피' },
  { id: 'bonus-3', month: 0, kind: 'pi', piValue: 3, bonus: true, name: '보너스 쓰리피' },
];

const BY_ID = new Map(ALL_CARDS.map((card) => [card.id, card]));

export function cardById(id: string): Card {
  const card = BY_ID.get(id);
  if (!card) throw new Error(`unknown card ${id}`);
  return card;
}
