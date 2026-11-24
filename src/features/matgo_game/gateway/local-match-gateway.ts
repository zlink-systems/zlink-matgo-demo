import { chooseAction } from '../ai/computer';
import {
  AI,
  HUMAN,
  apply,
  defaultRng,
  floorMatches,
  newRound,
  type Action,
  type GameEvent,
  type GameState,
  type PlayerId,
  type Rng,
} from '../model/engine';
import type { MatchEvent, MatchOptions, RejectReason } from '../model/types';
import { toTableView, toViewerEvents } from '../model/view';
import type { MatchGateway } from './match-gateway';

/** 컴퓨터 차례에 행동을 내기까지의 시간(ms). 화면 연출과 무관한 판정 지연이다. */
export const COMPUTER_DELAY_MS = 300;

/**
 * 한 기기 안에서 컴퓨터와 두는 게이트웨이. 원본 판 상태, 규칙 판정, AI, 선·나가리 배수를 소유한다.
 * 사람은 0번 자리, 컴퓨터는 1번 자리다. 화면에는 0번 기준으로 가린 상태만 보낸다.
 */
export class LocalMatchGateway implements MatchGateway {
  private state: GameState | null = null;
  private options: MatchOptions = { difficulty: 'normal' };
  private round = 0;
  private first: PlayerId = HUMAN;
  private listeners = new Set<(event: MatchEvent) => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly rng: Rng;
  private readonly presetDecks: string[][];

  /** rng·presetDecks는 시험용 (presetDecks: 판마다 쓸 더미 순서) */
  constructor(rng: Rng = defaultRng, presetDecks: string[][] = []) {
    this.rng = rng;
    this.presetDecks = [...presetDecks];
  }

  subscribe(listener: (event: MatchEvent) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  start(options: MatchOptions) {
    this.cancel();
    this.options = options;
    this.round = 0;
    this.first = HUMAN;
    this.deal(1);
  }

  requestPlay(card: string, target?: string, shake?: boolean) {
    const s = this.state;
    if (!s || s.phase === 'over') return this.reject('round-over');
    if (s.phase !== 'play' || s.turn !== HUMAN) return this.reject('not-your-turn');
    if (!s.players[HUMAN].hand.includes(card)) return this.reject('illegal-action');
    if (target !== undefined && !floorMatches(s, card).includes(target)) return this.reject('illegal-action');
    this.act(HUMAN, { type: 'play', card, target, shake });
  }

  requestGoStop(go: boolean) {
    const s = this.state;
    if (!s || s.phase === 'over') return this.reject('round-over');
    if (s.phase !== 'goStop' || s.turn !== HUMAN) return this.reject('not-your-turn');
    this.act(HUMAN, { type: go ? 'go' : 'stop' });
  }

  requestNextRound() {
    const s = this.state;
    if (!s || s.phase !== 'over') return this.reject('round-in-progress');
    const result = s.result;
    // 나가리면 선을 그대로 두고 배수를 두 배로, 누가 났으면 이긴 사람이 선
    const carry = result && result.winner === null ? s.carry * 2 : 1;
    if (result && result.winner !== null) this.first = result.winner;
    this.deal(carry);
  }

  dispose() {
    this.cancel();
    this.listeners.clear();
  }

  private deal(carry: number) {
    this.cancel();
    this.round += 1;
    const { state, events } = newRound(this.first, carry, this.rng, this.presetDecks.shift());
    this.state = state;
    this.emit({
      type: 'RoundStarted',
      options: this.options,
      round: this.round,
      events: toViewerEvents(events, HUMAN),
      view: toTableView(state, HUMAN),
    });
    this.schedule();
  }

  private act(actor: PlayerId, action: Action) {
    let events: GameEvent[];
    try {
      const step = apply(this.state!, action);
      this.state = step.state;
      events = step.events;
    } catch {
      return this.reject('illegal-action');
    }
    this.emit({
      type: 'ActionResolved',
      actor: actor === HUMAN ? 0 : 1,
      events: toViewerEvents(events, HUMAN),
      view: toTableView(this.state!, HUMAN),
    });
    this.schedule();
  }

  /** 컴퓨터 차례면 잠시 뒤 행동한다 */
  private schedule() {
    const s = this.state;
    if (!s || s.phase === 'over' || s.turn !== AI) return;
    this.cancel();
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (!this.state || this.state.phase === 'over' || this.state.turn !== AI) return;
      this.act(AI, chooseAction(this.state, this.options.difficulty, this.rng));
    }, COMPUTER_DELAY_MS);
  }

  private reject(reason: RejectReason) {
    this.emit({ type: 'ActionRejected', reason });
  }

  private emit(event: MatchEvent) {
    this.listeners.forEach((listener) => listener(event));
  }

  private cancel() {
    clearTimeout(this.timer);
    this.timer = undefined;
  }
}
