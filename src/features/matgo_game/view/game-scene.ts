import { Application, Container, Graphics, Text } from 'pixi.js';
import gsap from 'gsap';
import { cardById } from '../model/cards';
import {
  AI,
  HUMAN,
  canShake,
  comboEvents,
  floorMatches,
  isBomb,
  monthOf,
  needsTargetChoice,
  other,
  type GameEvent,
  type PlayerId,
  type RoundResult,
  type SpecialKind,
} from '../model/engine';
import { initialMatchState, matchReducer } from '../model/reducer';
import type { MatchEvent, MatchState, TableView } from '../model/types';
import { HIDDEN_PREFIX, isHidden } from '../model/view';
import type { MatchGateway } from '../gateway/match-gateway';
import { scoreCards } from '../model/scoring';
import { CardView, VIEW_H } from './card/cardView';
import { Effects } from './effects/effects';
import { createBackground } from './table/background';
import {
  CAP_LABEL_X,
  CAP_ROWS,
  DECK,
  GROUPS,
  capturedRowY,
  capturedSpot,
  deckSpot,
  floorSpot,
  groupOf,
  handSpot,
  type Spot,
} from './table/layout';
import * as sfx from '../../../shared/audio/sfx';
import { shout } from '../../../shared/audio/voice';
import { hud } from './hud/hud';
import { settings } from '../../../shared/settings';
import { recordRound } from '../../../shared/stats';

type Mirror = {
  hand: [string[], string[]];
  cap: [string[], string[]];
  floor: string[];
  deck: string[];
};

const wait = (sec: number) => new Promise<void>((r) => gsap.delayedCall(sec, r));

/**
 * 맞고 판 화면. 게이트웨이 이벤트를 차례로 연출하고, 사람의 의도(패 내기·고/스톱·다음 판)만 게이트웨이에 보낸다.
 * 규칙 판정·AI·더미 순서는 모른다. 상대 손패와 더미는 가린 카드로 받아 뒷면으로만 그린다.
 */
export class GameScene {
  readonly root = new Container();
  private table = new Container();
  private cardLayer = new Container();
  readonly fx: Effects;
  private views = new Map<string, CardView>();
  /** 지금 보이는 판 (게이트웨이가 보낸 TableView의 투영) */
  private state!: TableView;
  private match: MatchState = initialMatchState;
  private gateway: MatchGateway | null = null;
  private queue: MatchEvent[] = [];
  private draining = false;
  private hiddenSeq = 0;
  private mirror!: Mirror;
  private slotOf = new Map<number, number>();
  private busy = false;
  private choosing: { card: string; targets: string[] } | null = null;
  /** 바닥 두 장 고르기 장면의 어둡게 깐 막과 이름표 */
  private chooseLayer: Container | null = null;
  private hovered: string | null = null;
  private hitStopTimer = 0;
  /** 먹은 패 줄 이름표 [플레이어][줄] */
  private capLabels: { name: Text; count: Text; bg: Graphics }[][] = [];

  constructor(app: Application) {
    this.root.addChild(this.table);
    this.table.addChild(createBackground());
    this.table.addChild(this.createCapLabels());
    this.cardLayer.sortableChildren = true;
    this.table.addChild(this.cardLayer);
    this.fx = new Effects(app, this.table);
    this.table.addChild(this.fx.layer);
    this.root.addChild(this.fx.overlay);
  }

  // ---------- 판 시작 ----------

  /** 게이트웨이에 연결한다. 돌려준 함수를 부르면 연결을 끊는다 */
  attach(gateway: MatchGateway): () => void {
    this.gateway = gateway;
    const off = gateway.subscribe((event) => {
      this.queue.push(event);
      void this.drain();
    });
    return () => {
      off();
      this.queue.length = 0;
      if (this.gateway === gateway) this.gateway = null;
    };
  }

  /** 받은 이벤트를 하나씩 끝까지 연출한다. 연출 중에는 입력을 받지 않는다 */
  private async drain() {
    if (this.draining) return;
    this.draining = true;
    this.busy = true;
    try {
      while (this.queue.length) await this.present(this.queue.shift()!);
    } finally {
      this.draining = false;
    }
    this.busy = false;
    this.afterStep();
  }

  private async present(event: MatchEvent) {
    const before = this.state;
    this.match = matchReducer(this.match, event);
    switch (event.type) {
      case 'RoundStarted':
        await this.presentRoundStart(event.events, this.match.view!);
        break;
      case 'ActionResolved': {
        // 상대 차례는 생각하는 틈을 둔다
        if (event.actor === AI) {
          const decision = event.events.some((e) => e.type === 'go' || e.type === 'stop');
          await wait(decision ? 0.4 : 0.45 + Math.random() * 0.4);
        }
        const capBefore = [before.players[0].captured.slice(), before.players[1].captured.slice()];
        this.state = this.match.view!;
        await this.playEvents(event.events, capBefore);
        break;
      }
      case 'ActionRejected':
        hud.toast('지금은 낼 수 없어요', 1200);
        if (this.state) this.layoutZones(0.2);
        break;
    }
  }

  // ---------- 판 시작 ----------

  private async presentRoundStart(events: GameEvent[], view: TableView) {
    hud.hideResult();
    hud.hideGoStop();
    this.endChoosing(false);
    for (const v of this.views.values()) v.destroy({ children: true });
    this.views.clear();
    this.slotOf.clear();
    this.state = view;
    const deal = events.find((e) => e.type === 'deal') as Extract<GameEvent, { type: 'deal' }>;

    // 모든 카드를 덱 위치에 뒷면으로 쌓는다. 상대 손패와 더미는 가린 카드다
    const oppHand = deal.hands[1].map(() => this.newHiddenId());
    const deckIds = Array.from({ length: deal.deckCount }, () => this.newHiddenId());
    const dealt = [...deal.hands[0], ...oppHand, ...deal.floor];
    const initial = [...deckIds, ...dealt.reverse()];
    initial.forEach((id, i) => {
      const v = this.viewFor(id);
      this.place(v, deckSpot(i, initial.length));
    });
    this.mirror = { hand: [[], []], cap: [[], []], floor: [], deck: initial.slice() };
    this.updateCapLabels(0);
    this.updateCapLabels(1);
    hud.update(this.state, this.state.carry);
    hud.setTurn(null);
    sfx.special('start');
    if (this.state.carry > 1) this.fx.stamp(`${this.state.carry}배 판!`, { fill: ['#fff6b0', '#ffb020'], size: 130, hold: 0.6 });
    await wait(0.35);

    // 나눠주기: 바닥 4 → 선 5 → 후 5 → 바닥 4 → 선 5 → 후 5
    const first = view.turn,
      second = other(first);
    const hands: [string[], string[]] = [[...deal.hands[0]], [...oppHand]];
    const floor = [...deal.floor];
    const take = (arr: string[], n: number) => arr.splice(0, n);
    const steps: { to: 'floor' | PlayerId; cards: string[] }[] = [
      { to: 'floor', cards: take(floor, 4) },
      { to: first, cards: take(hands[first], 5) },
      { to: second, cards: take(hands[second], 5) },
      { to: 'floor', cards: take(floor, 4) },
      { to: first, cards: take(hands[first], 5) },
      { to: second, cards: take(hands[second], 5) },
    ];
    for (const step of steps) {
      for (const id of step.cards) {
        this.removeFromMirror(id);
        if (step.to === 'floor') this.mirror.floor.push(id);
        else this.mirror.hand[step.to].push(id);
        sfx.deal();
        this.layoutZones(0.32, id);
        await wait(0.035);
      }
      await wait(0.08);
    }
    this.sortHand();
    this.layoutZones(0.3);
    await wait(0.35);

    // 바닥 보너스 처리, 총통
    await this.playEvents(events.filter((e) => e.type !== 'deal'));
  }

  // ---------- 가린 카드 ----------

  private newHiddenId() {
    return `${HIDDEN_PREFIX}v${++this.hiddenSeq}`;
  }

  /** 가린 카드를 실제 카드로 바꾼다. 같은 자리에 뒷면 그대로 두고, 뒤집기는 연출이 한다 */
  private reveal(hiddenId: string, realId: string) {
    const v = this.viewFor(realId);
    const old = this.views.get(hiddenId);
    if (old) {
      v.position.copyFrom(old.position);
      v.scale.copyFrom(old.scale);
      v.rotation = old.rotation;
      v.zIndex = old.zIndex;
      v.setFaceUp(false);
      old.destroy({ children: true });
      this.views.delete(hiddenId);
    }
    const m = this.mirror;
    for (const arr of [m.hand[0], m.hand[1], m.deck]) {
      const i = arr.indexOf(hiddenId);
      if (i >= 0) arr[i] = realId;
    }
  }

  /** 상대가 낸 패: 상대 손의 가린 카드 하나를 그 패로 바꾼다 */
  private revealFromHand(p: PlayerId, card: string) {
    const hand = this.mirror.hand[p];
    if (hand.includes(card)) return;
    const hidden = hand.filter(isHidden);
    if (hidden.length) this.reveal(hidden[Math.floor(Math.random() * hidden.length)], card);
  }

  /** 더미에서 나온 패: 더미 맨 위 가린 카드를 그 패로 바꾼다 */
  private revealFromDeck(card: string) {
    if (this.mirror.deck.includes(card)) return;
    const top = [...this.mirror.deck].reverse().find(isHidden);
    if (top) this.reveal(top, card);
  }

  // ---------- 입력 ----------

  private viewFor(id: string): CardView {
    let v = this.views.get(id);
    if (v) return v;
    v = new CardView(id);
    v.eventMode = 'static';
    v.cursor = 'pointer';
    v.on('pointerover', () => this.onHover(id, true));
    v.on('pointerout', () => this.onHover(id, false));
    v.on('pointertap', () => void this.onTap(id));
    this.cardLayer.addChild(v);
    this.views.set(id, v);
    return v;
  }

  private canInput() {
    return !this.busy && this.state && this.state.phase === 'play' && this.state.turn === HUMAN;
  }

  private onHover(id: string, on: boolean) {
    if (!this.canInput() || this.choosing) return;
    if (!this.mirror.hand[HUMAN].includes(id)) return;
    const v = this.views.get(id)!;
    const spot = this.handSpotOf(HUMAN, id);
    if (on) {
      this.hovered = id;
      sfx.hover();
      gsap.to(v, { y: spot.y - 34, duration: 0.14, ease: 'power2.out' });
      gsap.to(v, { lift: 0.5, duration: 0.14 });
      gsap.to(v.scale, { x: spot.scale * 1.06, y: spot.scale * 1.06, duration: 0.14 });
      for (const m of floorMatches(this.state, id)) this.views.get(m)?.setGlow(true);
    } else {
      if (this.hovered === id) this.hovered = null;
      gsap.to(v, { y: spot.y, duration: 0.16, ease: 'power2.out' });
      gsap.to(v, { lift: 0, duration: 0.16 });
      gsap.to(v.scale, { x: spot.scale, y: spot.scale, duration: 0.16 });
      for (const m of this.mirror.floor) this.views.get(m)?.setGlow(false);
    }
  }

  private async onTap(id: string) {
    if (!this.canInput()) return;
    // 바닥 두 장 중 고르기
    if (this.choosing) {
      const { card, targets } = this.choosing;
      if (id === card) return; // 고르는 중인 패를 다시 누르면 무시
      this.endChoosing(targets.includes(id));
      if (!targets.includes(id)) {
        // 다른 손패를 누르면 고르기를 취소하고 그 패를 낸다
        if (this.mirror.hand[HUMAN].includes(id)) void this.onTap(id);
        return;
      }
      this.humanPlay({ card, target: id });
      return;
    }
    if (!this.mirror.hand[HUMAN].includes(id)) return;
    const targets = needsTargetChoice(this.state, id);
    if (targets.length > 0) {
      this.beginChoosing(id, targets);
      return;
    }
    let shake = false;
    if (canShake(this.state, id)) {
      this.busy = true;
      shake = await hud.confirmShake(monthOf(id));
      this.busy = false;
    }
    this.humanPlay({ card: id, shake });
  }

  /** 바닥에 같은 월이 두 장일 때: 판을 어둡게 하고, 낼 패와 고를 두 장을 가운데 크게 보여 준다 */
  private beginChoosing(card: string, targets: string[]) {
    this.choosing = { card, targets };
    this.hovered = null;
    hud.setTurn(null);
    for (const m of this.mirror.floor) this.views.get(m)?.setGlow(false);
    for (const h of this.mirror.hand[HUMAN]) this.views.get(h)?.setGlow(false);

    const layer = new Container();
    layer.zIndex = 900;
    const dim = new Graphics().rect(0, 0, 1920, 1080).fill({ color: 0x000000, alpha: 0.6 });
    dim.alpha = 0;
    dim.eventMode = 'static';
    dim.cursor = 'pointer';
    dim.on('pointertap', () => this.cancelChoosing());
    gsap.to(dim, { alpha: 1, duration: 0.18 });
    layer.addChild(dim);

    const title = new Text({
      text: '어느 패를 가져올까요?',
      style: {
        fontFamily: 'Black Han Sans',
        fontSize: 54,
        fill: 0xffffff,
        dropShadow: { color: 0x000000, distance: 4, blur: 2, alpha: 0.8, angle: Math.PI / 2 },
      },
    });
    title.anchor.set(0.5);
    title.position.set(940, 190);
    layer.addChild(title);
    const hint = new Text({
      text: '빈 곳을 누르면 취소 · 키보드 1, 2 / Esc',
      style: { fontFamily: 'Noto Sans KR', fontWeight: '700', fontSize: 24, fill: 0xd8d0bc },
    });
    hint.anchor.set(0.5);
    hint.position.set(940, 760);
    layer.addChild(hint);

    // 고를 두 장: 가운데 크게, 아래에 이름과 번호
    const CX = 940,
      CY = 450,
      GAP = 150,
      SCALE = 1.6;
    targets.forEach((t, i) => {
      const v = this.views.get(t)!;
      const x = CX + (i === 0 ? -GAP : GAP);
      v.zIndex = 950 + i;
      v.setGlow(true, 0xfff1a0);
      gsap.to(v, { x, y: CY, rotation: 0, lift: 0.9, duration: 0.28, ease: 'back.out(1.4)', overwrite: 'auto' });
      gsap.to(v.scale, { x: SCALE, y: SCALE, duration: 0.28, ease: 'back.out(1.4)', overwrite: 'auto' });
      const label = new Text({
        text: `${i + 1}  ${this.kindName(t)}`,
        style: { fontFamily: 'Noto Sans KR', fontWeight: '900', fontSize: 30, fill: 0xfff1a0 },
      });
      label.anchor.set(0.5);
      label.position.set(x, CY + (VIEW_H * SCALE) / 2 + 34);
      label.alpha = 0;
      gsap.to(label, { alpha: 1, duration: 0.2, delay: 0.15 });
      layer.addChild(label);
    });

    // 낼 패: 손에서 들어 올려 그대로 보여 준다
    const hv = this.views.get(card)!;
    const hs = this.handSpotOf(HUMAN, card);
    hv.zIndex = 960;
    hv.setGlow(true, 0x7fffd4);
    gsap.to(hv, { y: hs.y - 60, lift: 0.8, duration: 0.2, ease: 'power2.out', overwrite: 'auto' });

    this.cardLayer.addChild(layer);
    this.chooseLayer = layer;
    sfx.lift();
  }

  /** 고르기 장면을 닫는다. picked=false 면 카드들을 제자리로 돌린다 */
  private endChoosing(picked: boolean) {
    if (!this.choosing) return;
    const { card, targets } = this.choosing;
    this.choosing = null;
    targets.forEach((t) => this.views.get(t)?.setGlow(false));
    this.views.get(card)?.setGlow(false);
    const layer = this.chooseLayer;
    this.chooseLayer = null;
    if (layer) gsap.to(layer, { alpha: 0, duration: 0.15, onComplete: () => layer.destroy({ children: true }) });
    if (!picked) {
      hud.setTurn(HUMAN);
      this.layoutZones(0.2);
      this.markPlayable();
    }
  }

  private cancelChoosing() {
    if (!this.choosing || !this.canInput()) return;
    sfx.click();
    this.endChoosing(false);
  }

  /** 고를 때 보여 줄 카드 이름 */
  private kindName(id: string): string {
    const c = cardById(id);
    if (c.kind === 'gwang') return c.biGwang ? '비광' : '광';
    if (c.kind === 'yeol') return c.godori ? '고도리' : c.gukjin ? '국진' : '열끗';
    if (c.kind === 'tti') return c.ttiKind === 'hong' ? '홍단' : c.ttiKind === 'cheong' ? '청단' : c.ttiKind === 'cho' ? '초단' : '띠';
    return c.piValue >= 2 ? '쌍피' : '피';
  }

  /** 사람의 패 내기 의도를 게이트웨이로 보낸다. 판은 이벤트가 와야 바뀐다 */
  private humanPlay(action: { card: string; target?: string; shake?: boolean }) {
    if (!this.gateway) return;
    this.busy = true;
    for (const m of this.mirror.floor) this.views.get(m)?.setGlow(false);
    this.gateway.requestPlay(action.card, action.target, action.shake);
    if (!this.draining) this.busy = false;
  }

  chooseGoStop(go: boolean) {
    if (!this.gateway || this.state.phase !== 'goStop' || this.state.turn !== HUMAN) return;
    this.busy = true;
    hud.hideGoStop();
    this.gateway.requestGoStop(go);
    if (!this.draining) this.busy = false;
  }

  private afterStep() {
    const s = this.state;
    if (!s) return;
    hud.update(s, s.carry);
    if (s.phase === 'over') return;
    hud.setTurn(s.turn);
    // 상대 차례: 게이트웨이가 상대 행동을 보내 줄 때까지 기다린다
    if (s.turn === AI) return;
    if (s.phase === 'goStop') {
      hud.showGoStop(s, s.carry, (go) => this.chooseGoStop(go));
      return;
    }
    // 내 차례: 먹을 수 있는 패 표시
    this.markPlayable();
  }

  private markPlayable() {
    for (const id of this.mirror.hand[HUMAN]) {
      const v = this.views.get(id)!;
      const can = id.startsWith('dummy') || floorMatches(this.state, id).length > 0 || isBomb(this.state, id);
      v.setDim(false);
      v.setGlow(can && !id.startsWith('dummy'), 0xfff1a0);
    }
  }

  // ---------- 이벤트 연출 ----------

  private async playEvents(events: GameEvent[], capBefore?: string[][]) {
    for (const v of this.mirror.hand[HUMAN]) this.views.get(v)?.setGlow(false);
    let capPrev = capBefore;
    for (const e of events) {
      switch (e.type) {
        case 'floorBonus': {
          this.revealFromDeck(e.replacement);
          await this.flyToCaptured(e.to, [e.card], 0.3);
          this.removeFromMirror(e.replacement);
          const idx = this.mirror.floor.length;
          this.mirror.floor.splice(idx, 0, e.replacement);
          await this.flipFromDeck(e.replacement, null);
          break;
        }
        case 'play':
          if (e.player === AI) this.revealFromHand(AI, e.card);
          await this.animatePlay(e.player, e.card, e.target ?? null, e.shake);
          break;
        case 'bomb':
          for (const c of e.cards) {
            if (e.player === AI) this.revealFromHand(AI, c);
            await this.animatePlay(e.player, c, e.target, false, true);
          }
          break;
        case 'dummy': {
          const v = this.views.get(e.card)!;
          this.removeFromMirror(e.card);
          gsap.to(v, { alpha: 0, y: v.y - 40, duration: 0.2, onComplete: () => v.destroy() });
          this.views.delete(e.card);
          this.layoutZones(0.2);
          await wait(0.15);
          break;
        }
        case 'bonusPlay': {
          if (e.player === AI) this.revealFromHand(AI, e.card);
          await this.animatePlay(e.player, e.card, null, false, false, true);
          await this.flyToCaptured(e.player, [e.card], 0.3);
          this.fx.stamp('보너스!', { fill: ['#fff7c0', '#ffc400'], size: 120, hold: 0.3 });
          sfx.special('combo');
          if (e.drawn && isHidden(e.drawn)) {
            // 상대가 더미에서 가져간 패는 가린 채로 손에 넣는다
            const top = [...this.mirror.deck].reverse().find(isHidden);
            if (top) {
              this.removeFromMirror(top);
              this.mirror.hand[e.player].push(top);
            }
            this.layoutZones(0.35);
            await wait(0.35);
          } else if (e.drawn) {
            this.revealFromDeck(e.drawn);
            this.removeFromMirror(e.drawn);
            this.mirror.hand[e.player].push(e.drawn);
            if (e.player === HUMAN) this.sortHand();
            this.layoutZones(0.35);
            await wait(0.35);
          }
          break;
        }
        case 'bonusFlip':
          this.revealFromDeck(e.card);
          await this.flipFromDeck(e.card, null, true);
          await this.flyToCaptured(e.player, [e.card], 0.3);
          this.fx.stamp('보너스!', { fill: ['#fff7c0', '#ffc400'], size: 120, hold: 0.3 });
          sfx.special('combo');
          break;
        case 'flip':
          this.revealFromDeck(e.card);
          await this.flipFromDeck(e.card, e.target ?? null);
          break;
        case 'capture': {
          const fresh = e.cards.filter((c) => !this.mirror.cap[e.player].includes(c));
          if (fresh.length) {
            await this.flyToCaptured(e.player, fresh);
            if (capPrev) {
              const combos = comboEvents(capPrev[e.player], this.mirror.cap[e.player]);
              for (const k of combos) await this.special(e.player, k);
              capPrev = [this.mirror.cap[0].slice(), this.mirror.cap[1].slice()];
            }
          }
          break;
        }
        case 'special':
          await this.special(e.player, e.kind);
          break;
        case 'steal':
          await this.animateSteal(e.from, e.to, e.card);
          break;
        case 'score':
          hud.update(this.state, this.state.carry, this.mirror);
          hud.popScore(e.player);
          sfx.scoreUp(Math.min(e.score, 12));
          break;
        case 'goStopPrompt':
          await wait(0.2);
          break;
        case 'go':
          await this.goStamp(e.player, e.count);
          break;
        case 'stop':
          sfx.special('stop');
          shout('stop');
          this.fx.dim(0.45, 0.5);
          await this.fx.stamp('스톱!', { fill: ['#ffffff', '#ff6b6b', '#b30000'], size: 220, hold: 0.6 });
          break;
        case 'turn':
          break;
        case 'roundOver':
          await this.roundOver(e.result);
          break;
        case 'deal':
          break;
      }
    }
    // 최종 상태로 정리
    this.syncMirror();
    if (this.state.players[HUMAN].hand.length) this.sortHand();
    this.layoutZones(0.28);
    hud.update(this.state, this.state.carry);
  }

  /** 연출이 끝난 뒤 게이트웨이가 보낸 상태에 맞춘다. 가린 카드는 이름이 아니라 장 수로 맞춘다 */
  private syncMirror() {
    const s = this.state;
    const m = this.mirror;
    m.hand[0] = s.players[0].hand.slice();
    const oppKnown = s.players[1].hand.filter((id) => !isHidden(id));
    m.hand[1] = [...oppKnown, ...this.fitHidden(m.hand[1], s.players[1].hand.length - oppKnown.length)];
    m.deck = this.fitHidden(m.deck, s.deck.length);
    m.cap = [s.players[0].captured.slice(), s.players[1].captured.slice()];
    m.floor = m.floor.filter((id) => s.floor.includes(id));
    for (const id of s.floor) if (!m.floor.includes(id)) m.floor.push(id);
    for (const id of [...m.hand[0], ...m.hand[1], ...m.floor, ...m.cap[0], ...m.cap[1]]) this.viewFor(id);
    // 남은 빈 칸 정리
    for (const mo of [...this.slotOf.keys()]) {
      if (!m.floor.some((id) => monthOf(id) === mo)) this.slotOf.delete(mo);
    }
  }

  /** 가린 카드 목록을 n장으로 맞춘다 (모자라면 더미 자리에 새로 만들고, 남으면 지운다) */
  private fitHidden(ids: string[], n: number): string[] {
    const hidden = ids.filter(isHidden);
    const kept = hidden.slice(0, Math.max(n, 0));
    for (const id of hidden.slice(kept.length)) {
      this.views.get(id)?.destroy({ children: true });
      this.views.delete(id);
    }
    while (kept.length < n) {
      const id = this.newHiddenId();
      this.place(this.viewFor(id), deckSpot(0, 1));
      kept.unshift(id);
    }
    return kept;
  }

  private sortHand() {
    const h = this.mirror.hand[HUMAN];
    h.sort((a, b) => {
      const da = a.startsWith('dummy') ? 99 : monthOf(a);
      const db = b.startsWith('dummy') ? 99 : monthOf(b);
      return da - db || a.localeCompare(b);
    });
  }

  /** 손패를 들어 바닥에 내리친다. 먹을 패가 있으면 더 세게. */
  private async animatePlay(player: PlayerId, card: string, target: string | null, shake?: boolean, bomb = false, toCapture = false) {
    const v = this.viewFor(card);
    this.removeFromMirror(card);
    let spot: Spot;
    if (toCapture) {
      spot = { x: 940, y: 520, scale: 1.1, rotation: 0, faceUp: true, z: 900 };
    } else {
      spot = this.addToFloor(card);
    }
    v.zIndex = 1000;
    if (shake) {
      // 흔들기: 같은 월 패를 보여주며 떤다
      sfx.special('shake');
      gsap.to(v, { rotation: 0.08, duration: 0.05, yoyo: true, repeat: 7 });
      await wait(0.35);
    }
    // 1) 들어 올리기
    sfx.lift();
    if (!v.faceUp) v.flipTo(true, 0.16);
    const liftY = player === HUMAN ? v.y - 90 : v.y + 70;
    await gsap
      .timeline()
      .to(v, { y: liftY, lift: 1, duration: 0.12, ease: 'power2.out' }, 0)
      .to(v.scale, { x: 1.3, y: 1.3, duration: 0.12, ease: 'power2.out' }, 0)
      .to(v, { rotation: (Math.random() - 0.5) * 0.3, duration: 0.12 }, 0)
      .then();
    // 2) 내리꽂기 (천천히 들었다가 급가속)
    sfx.swish(0.13);
    const power = bomb ? 1 : target ? 0.85 : 0.5;
    await gsap
      .timeline()
      .to(v, { x: spot.x, y: spot.y, duration: 0.16, ease: 'power3.in' }, 0)
      .to(v.scale, { x: spot.scale, y: spot.scale, duration: 0.16, ease: 'power3.in' }, 0)
      .to(v, { rotation: spot.rotation, lift: 0, duration: 0.16, ease: 'power3.in' }, 0)
      .then();
    v.zIndex = spot.z;
    // 3) 충돌: 히트스톱 + 찌그러짐 + 먼지 + 소리
    this.impact(v, power);
    this.layoutZones(0.22);
    await wait(target ? 0.12 : 0.06);
  }

  private impact(v: CardView, power: number) {
    sfx.slam(power);
    sfx.haptic(power > 0.7 ? 30 : 15);
    v.squash(power);
    this.fx.impact(v.x, v.y, power);
    if (power >= 0.85) this.fx.shake(3 + power * 3, 0.18);
    else this.fx.shake(1.2, 0.1);
    // 히트스톱: 아주 짧게 화면을 멈춘 듯한 정지
    // 연달아 걸려도 항상 설정 속도로 돌아오게 한다
    const tl = gsap.globalTimeline;
    tl.timeScale(0.05);
    clearTimeout(this.hitStopTimer);
    this.hitStopTimer = window.setTimeout(() => tl.timeScale(settings.speed), power >= 0.85 ? 55 : 30);
  }

  /** 더미에서 한 장 뒤집어 바닥에 꽂는다 */
  private async flipFromDeck(card: string, target: string | null, toCapture = false) {
    const v = this.viewFor(card);
    this.removeFromMirror(card);
    v.zIndex = 1000;
    // 덱 위로 들어 올리며 뒤집기
    sfx.flip();
    await gsap
      .timeline()
      .to(v, { y: DECK.y - 80, x: DECK.x + 20, lift: 1, duration: 0.12, ease: 'power2.out' }, 0)
      .to(v.scale, { x: 1.25, y: 1.25, duration: 0.12 }, 0)
      .add(v.flipTo(true, 0.18), 0.04)
      .then();
    await wait(target ? 0.12 : 0.05); // 무엇이 나왔는지 보는 순간
    if (toCapture) return;
    const spot = target ? this.addToFloor(card) : this.addToFloor(card);
    sfx.swish(0.12);
    await gsap
      .timeline()
      .to(v, { x: spot.x, y: spot.y, rotation: spot.rotation, lift: 0, duration: 0.15, ease: 'power3.in' }, 0)
      .to(v.scale, { x: spot.scale, y: spot.scale, duration: 0.15, ease: 'power3.in' }, 0)
      .then();
    v.zIndex = spot.z;
    this.impact(v, target ? 0.8 : 0.45);
    this.layoutZones(0.2);
    await wait(0.08);
  }

  /** 먹은 패를 내 쪽으로 쓸어 담는다 */
  private async flyToCaptured(player: PlayerId, cards: string[], dur = 0.38) {
    // 먹는 패 반짝임
    for (const c of cards) {
      const v = this.views.get(c);
      if (v) this.fx.sparkleAt(v.x, v.y);
    }
    await wait(0.08);
    sfx.sweepIn(cards.length);
    for (const c of cards) {
      this.removeFromMirror(c);
      this.mirror.cap[player].push(c);
    }
    // 그룹 정렬 후 배치
    this.layoutCaptured(player, dur, cards);
    await wait(dur * 0.8);
    for (const c of cards) {
      const v = this.views.get(c);
      if (v)
        this.fx.burst(v.x, v.y, {
          count: 5,
          tex: 'star',
          tint: 0xffe680,
          speed: [40, 140],
          life: [0.3, 0.5],
          scale: [0.15, 0.3],
          additive: true,
        });
    }
    this.layoutZones(0.25);
  }

  private async animateSteal(from: PlayerId, to: PlayerId, card: string) {
    const v = this.views.get(card)!;
    sfx.special('steal');
    this.removeFromMirror(card);
    this.mirror.cap[to].push(card);
    v.zIndex = 1200;
    const tl = gsap.timeline();
    tl.to(v.scale, { x: 0.9, y: 0.9, duration: 0.15 }).to(v, { x: 940, y: 520, rotation: 0.6, duration: 0.2, ease: 'power2.out' }, 0);
    await tl.then();
    this.fx.sparkleAt(v.x, v.y, 0xff9ab8);
    hud.toast(to === HUMAN ? '피 한 장 뺏어 왔다!' : '피 한 장 뺏겼다…', 900);
    this.layoutCaptured(to, 0.35, [card]);
    this.layoutCaptured(from, 0.25);
    await wait(0.3);
    void from;
  }

  private async goStamp(player: PlayerId, count: number) {
    sfx.special('go', count);
    shout(`go${Math.min(count, 5)}`);
    const names = ['', '원 고!', '투 고!', '쓰리 고!', '포 고!', '파이브 고!'];
    const label = names[Math.min(count, 5)] ?? `${count}고!`;
    const sub = count >= 3 ? `점수 ×${2 ** (count - 2)}` : `+${count}점`;
    if (count >= 3) {
      this.fx.fire(960, 480);
      this.fx.shake(14, 0.5);
    } else this.fx.flash(0xffe9a0, 0.35);
    await this.fx.stamp(label, { fill: ['#fffbe0', '#ffd23f', '#ff7b00'], size: 200 + Math.min(count, 5) * 12, sub, hold: 0.55 }).then();
    void player;
  }

  private async special(player: PlayerId, kind: SpecialKind) {
    const p = player === HUMAN ? '' : '상대 ';
    const y = player === HUMAN ? 560 : 430;
    switch (kind) {
      case 'jjok':
        sfx.special('jjok');
        shout('jjok');
        this.fx.hearts(960, y);
        await this.fx.stamp('쪽!', { fill: ['#ffe3ef', '#ff5c8a', '#d6004c'], size: 230, y, sub: `${p}피 한 장!` }).then();
        break;
      case 'ppeok':
      case 'firstPpeok':
        sfx.special('ppeok');
        shout(kind);
        this.fx.dim(0.5, 0.6);
        this.fx.shake(9, 0.35);
        await this.fx
          .stamp(kind === 'firstPpeok' ? '첫뻑!' : '뻑!', {
            fill: ['#d9d9d9', '#7a7a7a', '#2b2b2b'],
            stroke: '#000',
            size: 240,
            y,
            sub: kind === 'firstPpeok' ? '피 한 장!' : undefined,
          })
          .then();
        break;
      case 'ttadak':
        sfx.special('ttadak');
        shout('ttadak');
        this.fx.lightning(900, y);
        setTimeout(() => this.fx.lightning(1020, y), 110);
        this.fx.shake(10, 0.3);
        await this.fx.stamp('따닥!', { fill: ['#e9f6ff', '#58b4ff', '#0a4dbb'], size: 230, y, sub: `${p}피 한 장!` }).then();
        break;
      case 'sweep':
        sfx.special('sweep');
        shout('sweep');
        this.fx.wind(500);
        this.fx.flash(0xffffff, 0.4, 0.5);
        await this.fx.stamp('싹쓸이!', { fill: ['#ffffff', '#9cf7c4', '#0d9e5a'], size: 220, y, sub: `${p}피 한 장!` }).then();
        break;
      case 'bomb':
        sfx.special('bomb');
        shout('bomb');
        this.fx.fire(960, 500);
        this.fx.shake(22, 0.6);
        sfx.haptic([40, 30, 80]);
        await this.fx.stamp('폭탄!', { fill: ['#fff3c4', '#ff8a00', '#c40000'], size: 250, y, sub: '흔들기 ×2 · 피 한 장!' }).then();
        break;
      case 'shake':
        shout('shake');
        await this.fx.stamp('흔들기!', { fill: ['#fffbe0', '#ffd23f', '#ff7b00'], size: 190, y, sub: '점수 ×2', hold: 0.45 }).then();
        break;
      case 'ppeokEat':
      case 'jappeok':
        sfx.special('ppeokEat');
        shout(kind);
        this.fx.sparkleAt(960, y);
        await this.fx
          .stamp(kind === 'jappeok' ? '자뻑!' : '뻑 먹기!', {
            fill: ['#fffbe0', '#ffd23f', '#c98a00'],
            size: 200,
            y,
            sub: kind === 'jappeok' ? '피 두 장!' : '피 한 장!',
          })
          .then();
        break;
      case 'chongtong':
        sfx.special('win');
        shout('chongtong');
        this.fx.fire(960, 500);
        await this.fx.stamp('총통!', { fill: ['#fffbe0', '#ffd23f', '#ff7b00'], size: 250, y }).then();
        break;
      case 'samppeok':
        sfx.special('bomb');
        shout('samppeok');
        this.fx.shake(20, 0.6);
        await this.fx.stamp('삼뻑!', { fill: ['#ffffff', '#ff6b6b', '#8b0000'], size: 250, y, sub: '즉시 승리' }).then();
        break;
      case 'godori':
        sfx.special('combo');
        shout('godori');
        this.fx.burst(960, y, {
          count: 30,
          tex: 'leaf',
          tint: [0xfff1a8, 0xffffff],
          speed: [200, 700],
          life: [0.6, 1.1],
          scale: [0.4, 0.9],
        });
        await this.fx.stamp('고도리!', { fill: ['#fffbe0', '#9de07a', '#2e7d1a'], size: 210, y, sub: '+5점' }).then();
        break;
      case 'hongdan':
      case 'cheongdan':
      case 'chodan': {
        sfx.special('combo');
        shout(kind);
        const label = kind === 'hongdan' ? '홍단!' : kind === 'cheongdan' ? '청단!' : '초단!';
        const fill = kind === 'cheongdan' ? ['#e9f6ff', '#58b4ff', '#0a4dbb'] : ['#ffe3e3', '#ff4d4d', '#a80000'];
        await this.fx.stamp(label, { fill, size: 210, y, sub: '+3점' }).then();
        break;
      }
      case 'samgwang':
      case 'sagwang':
      case 'ogwang': {
        sfx.special('gwang');
        shout(kind);
        this.fx.flash(0xfff0b0, 0.5, 0.6);
        this.fx.burst(960, y, {
          count: 50,
          tex: 'star',
          tint: [0xfff2a0, 0xffffff, 0xffc94a],
          speed: [300, 1100],
          life: [0.6, 1.2],
          scale: [0.3, 0.9],
          additive: true,
        });
        const label = kind === 'samgwang' ? '삼광!' : kind === 'sagwang' ? '사광!' : '오광!';
        await this.fx.stamp(label, { fill: ['#ffffff', '#ffe066', '#e0a000'], size: 220, y }).then();
        break;
      }
    }
  }

  private async roundOver(result: RoundResult) {
    hud.setTurn(null);
    await wait(0.3);
    const human = result.winner === HUMAN;
    if (result.winner === null) {
      sfx.special('nagari');
      shout('nagari');
      await this.fx.stamp('나가리', { fill: ['#ffffff', '#c0c0c0', '#707070'], size: 200, sub: '다음 판 점수 2배' }).then();
    } else {
      if (human) {
        sfx.special('win');
        this.fx.coins(960, 700, 70);
        this.fx.flash(0xfff0b0, 0.4, 0.6);
      } else {
        sfx.special('lose');
      }
    }
    const money = recordRound(result, this.state);
    hud.showResult(
      result,
      this.state,
      money,
      () => this.gateway?.requestNextRound(),
      (x, y) => {
        sfx.special('stamp');
        this.fx.shake(6, 0.2);
        void x;
        void y;
      },
      () => {
        if (human) {
          sfx.special('coin');
          this.fx.coins(960, 900, 6);
        }
      },
    );
  }

  // ---------- 배치 ----------

  private removeFromMirror(id: string) {
    const m = this.mirror;
    for (const arr of [m.hand[0], m.hand[1], m.cap[0], m.cap[1], m.floor, m.deck]) {
      const i = arr.indexOf(id);
      if (i >= 0) arr.splice(i, 1);
    }
  }

  /** 바닥에 놓고 위치를 돌려준다 (같은 월은 같은 칸에 겹침) */
  private addToFloor(id: string): Spot {
    const m = monthOf(id);
    const stack = this.mirror.floor.filter((x) => monthOf(x) === m).length;
    if (!this.slotOf.has(m)) this.slotOf.set(m, this.freeSlot());
    this.mirror.floor.push(id);
    return floorSpot(this.slotOf.get(m)!, stack);
  }

  private freeSlot(): number {
    const used = new Set(this.slotOf.values());
    for (let i = 0; i < 12; i++) if (!used.has(i)) return i;
    return 0;
  }

  private handSpotOf(p: PlayerId, id: string): Spot {
    const h = this.mirror.hand[p];
    return handSpot(p, h.indexOf(id), h.length);
  }

  private place(v: CardView, s: Spot) {
    v.x = s.x;
    v.y = s.y;
    v.scale.set(s.scale);
    v.rotation = s.rotation;
    v.zIndex = s.z;
    v.setFaceUp(s.faceUp);
  }

  private moveTo(v: CardView, s: Spot, dur: number) {
    v.zIndex = s.z;
    if (Math.abs(v.x - s.x) < 0.5 && Math.abs(v.y - s.y) < 0.5 && Math.abs(v.scale.x - s.scale) < 0.01 && v.faceUp === s.faceUp) return;
    gsap.to(v, { x: s.x, y: s.y, rotation: s.rotation, lift: 0, duration: dur, ease: 'power3.out', overwrite: 'auto' });
    gsap.to(v.scale, { x: s.scale, y: s.scale, duration: dur, ease: 'power3.out', overwrite: 'auto' });
    if (v.faceUp !== s.faceUp) v.flipTo(s.faceUp, Math.min(0.2, dur));
  }

  /** 먹은 패 패널의 줄 이름표 (광·열끗·띠·피 + 장 수) */
  private createCapLabels(): Container {
    const layer = new Container();
    const names = ['광', '열끗', '띠', '피', ''];
    for (const p of [0, 1] as PlayerId[]) {
      const rows: { name: Text; count: Text; bg: Graphics }[] = [];
      for (let r = 0; r < CAP_ROWS; r++) {
        const y = capturedRowY(p, r);
        const bg = new Graphics().roundRect(CAP_LABEL_X - 22, y - 40, 44, 80, 12).fill({ color: 0x000000, alpha: 0.32 });
        const name = new Text({
          text: names[r],
          style: { fontFamily: 'Noto Sans KR', fontWeight: '900', fontSize: names[r].length > 1 ? 15 : 20, fill: 0xe9dcc0 },
        });
        name.anchor.set(0.5);
        name.position.set(CAP_LABEL_X, y - 14);
        const count = new Text({ text: '0', style: { fontFamily: 'Black Han Sans', fontSize: 28, fill: 0xffffff } });
        count.anchor.set(0.5);
        count.position.set(CAP_LABEL_X, y + 16);
        if (r === CAP_ROWS - 1) bg.visible = false;
        layer.addChild(bg, name, count);
        rows.push({ name, count, bg });
      }
      this.capLabels.push(rows);
    }
    return layer;
  }

  private updateCapLabels(p: PlayerId) {
    const sc = scoreCards(this.mirror.cap[p]);
    const counts = [sc.gwangCount, sc.yeolCount, sc.ttiCount, sc.piCount, 0];
    this.capLabels[p].forEach((l, r) => {
      if (r === CAP_ROWS - 1) {
        l.count.text = '';
        return;
      }
      l.count.text = String(counts[r]);
      const empty = counts[r] === 0;
      l.name.alpha = l.count.alpha = empty ? 0.35 : 1;
    });
  }

  private layoutCaptured(p: PlayerId, dur: number, highlight: string[] = []) {
    const cap = this.mirror.cap[p];
    const gukjinAsPi = scoreCards(cap).gukjinAsPi;
    const counters: Record<string, number> = { gwang: 0, yeol: 0, tti: 0, pi: 0 };
    const totals: Record<string, number> = { gwang: 0, yeol: 0, tti: 0, pi: 0 };
    for (const id of cap) totals[groupOf(id, gukjinAsPi)]++;
    const order = [...cap].sort((a, b) => GROUPS.indexOf(groupOf(a, gukjinAsPi)) - GROUPS.indexOf(groupOf(b, gukjinAsPi)));
    for (const id of order) {
      const g = groupOf(id, gukjinAsPi);
      const spot = capturedSpot(p, g, counters[g]++, totals[g]);
      const v = this.viewFor(id);
      v.setGlow(false);
      if (highlight.includes(id)) {
        v.zIndex = 1100;
        gsap.to(v, {
          x: spot.x,
          y: spot.y,
          rotation: 0,
          lift: 0,
          duration: dur,
          ease: 'power2.inOut',
          onComplete: () => {
            v.zIndex = spot.z;
          },
        });
        gsap.to(v.scale, { x: spot.scale, y: spot.scale, duration: dur, ease: 'power2.inOut' });
        if (!v.faceUp) v.flipTo(true, 0.15);
      } else this.moveTo(v, spot, 0.25);
    }
    this.updateCapLabels(p);
  }

  /** 모든 영역을 거울 상태대로 정렬 (skip: 지금 날아가는 카드는 건드리지 않음) */
  private layoutZones(dur: number, onlyId?: string) {
    const m = this.mirror;
    const move = (id: string, s: Spot) => {
      if (onlyId && id !== onlyId) return;
      this.moveTo(this.viewFor(id), s, dur);
    };
    for (const p of [0, 1] as PlayerId[]) {
      m.hand[p].forEach((id, i) => {
        const s = handSpot(p, i, m.hand[p].length);
        move(id, s);
      });
    }
    // 바닥: 칸별로 다시 쌓기
    const stacks = new Map<number, number>();
    for (const id of m.floor) {
      const mo = monthOf(id);
      if (!this.slotOf.has(mo)) this.slotOf.set(mo, this.freeSlot());
      const slot = this.slotOf.get(mo)!;
      const k = stacks.get(slot) ?? 0;
      stacks.set(slot, k + 1);
      move(id, floorSpot(slot, k));
    }
    m.deck.forEach((id, i) => move(id, deckSpot(i, m.deck.length)));
    if (!onlyId) {
      this.layoutCaptured(0, dur);
      this.layoutCaptured(1, dur);
    }
  }

  /** 키보드: 1~0 = 손패 순서대로, 고르는 중에는 1·2 = 바닥 패, Esc = 취소 */
  handleKey(key: string) {
    if (!this.canInput()) return;
    if (this.choosing) {
      if (key === 'Escape') {
        this.cancelChoosing();
        return;
      }
      const t = this.choosing.targets[Number(key) - 1];
      if (t) void this.onTap(t);
      return;
    }
    if (!/^[0-9]$/.test(key)) return;
    const i = key === '0' ? 9 : Number(key) - 1;
    const id = this.mirror.hand[HUMAN][i];
    if (id) void this.onTap(id);
  }

  /** 월 숫자 표시 설정을 화면의 카드에 바로 반영 */
  refreshBadges() {
    for (const v of this.views.values()) v.setFaceUp(v.faceUp);
  }

  resize(scale: number, offX: number, offY: number) {
    this.root.scale.set(scale);
    this.root.x = offX;
    this.root.y = offY;
  }
}
