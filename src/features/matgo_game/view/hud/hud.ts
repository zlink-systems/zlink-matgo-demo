import { other, type GameState, type PlayerId, type RoundResult } from '../../model/engine';
import { scoreCards, settle } from '../../model/scoring';
import { MONTH_NAMES } from '../../model/cards';
import { POINT_VALUE, stats } from '../../../../shared/stats';
import { settings } from '../../../../shared/settings';
import * as sfx from '../../../../shared/audio/sfx';

/** 화면 위 정보와 창 (DOM). 1920x1080 좌표계에 맞춰 함께 확대/축소된다. */

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
const won = (n: number) => `${Math.abs(n).toLocaleString('ko-KR')}냥`;
const LEVEL = { easy: '초급', normal: '중급', hard: '고급' } as const;

let root: HTMLElement;

type MirrorLike = { cap: [string[], string[]] };

function panel(id: string, title: string) {
  return `
  <section class="panel" id="${id}">
    <div class="who"><div class="avatar">${id === 'p0' ? '나' : '컴'}</div><div><div class="name">${title}</div><div class="money"></div></div></div>
    <div class="score"><span class="num">0</span><span class="unit">점</span></div>
    <div class="chips"></div>
    <div class="counts"></div>
  </section>`;
}

export const hud = {
  mount(el: HTMLElement) {
    root = el;
    root.innerHTML = `
      ${panel('p1', '컴퓨터')}
      ${panel('p0', '나')}
      <div class="mid-left">
        <div class="deck-count"><span>남은 패</span><b>0</b></div>
        <div class="carry hidden"></div>
        <button class="btn small" id="btn-menu">⚙ 설정</button>
      </div>
      <div class="turn-banner hidden"></div>
      <div class="toast hidden"></div>
      <div class="modal hidden" id="gostop"></div>
      <div class="modal hidden" id="shake"></div>
      <div class="modal hidden" id="result"></div>
      <div class="modal hidden" id="menu"></div>
    `;
    $('#btn-menu', root).onclick = () => {
      sfx.click();
      hud.showMenu();
    };
  },

  update(s: GameState, carry: number, mirror?: MirrorLike) {
    if (!root) return;
    for (const p of [0, 1] as PlayerId[]) {
      const el = $(`#p${p}`, root);
      const ps = s.players[p];
      const cap = mirror ? mirror.cap[p] : ps.captured;
      const sc = scoreCards(cap);
      $('.num', el).textContent = String(sc.total);
      $('.name', el).textContent = p === 0 ? '나' : `컴퓨터 · ${LEVEL[settings.difficulty]}`;
      $('.money', el).textContent = p === 0 ? won(stats.money) : '';
      const chips: string[] = [];
      if (ps.goCount) chips.push(`<span class="chip go">${ps.goCount}고</span>`);
      if (ps.shakes) chips.push(`<span class="chip shake">흔들 ×${2 ** ps.shakes}</span>`);
      if (ps.ppeokCount) chips.push(`<span class="chip ppeok">뻑 ${ps.ppeokCount}</span>`);
      if (sc.godori) chips.push('<span class="chip combo">고도리</span>');
      if (sc.hongdan) chips.push('<span class="chip combo red">홍단</span>');
      if (sc.cheongdan) chips.push('<span class="chip combo blue">청단</span>');
      if (sc.chodan) chips.push('<span class="chip combo red">초단</span>');
      $('.chips', el).innerHTML = chips.join('');
      $('.counts', el).innerHTML = `
        <span><i>광</i>${sc.gwangCount}</span><span><i>열</i>${sc.yeolCount}</span>
        <span><i>띠</i>${sc.ttiCount}</span><span><i>피</i>${sc.piCount}</span>`;
    }
    $('.deck-count b', root).textContent = String(s.deck.length);
    const c = $('.carry', root);
    c.classList.toggle('hidden', carry <= 1);
    c.textContent = `이번 판 ×${carry}`;
  },

  popScore(p: PlayerId) {
    const el = $(`#p${p} .score`, root);
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  },

  setTurn(p: PlayerId | null) {
    for (const x of [0, 1]) $(`#p${x}`, root).classList.toggle('active', p === x);
    const b = $('.turn-banner', root);
    if (p === 0) {
      b.textContent = '내 차례';
      b.className = 'turn-banner mine';
    } else if (p === 1) {
      b.textContent = '상대 차례';
      b.className = 'turn-banner theirs';
    } else b.className = 'turn-banner hidden';
  },

  toast(text: string, ms = 0) {
    const t = $('.toast', root);
    if (!text) {
      t.classList.add('hidden');
      return;
    }
    t.textContent = text;
    t.classList.remove('hidden');
    t.classList.remove('show');
    void t.offsetWidth;
    t.classList.add('show');
    if (ms) setTimeout(() => t.textContent === text && t.classList.add('hidden'), ms);
  },

  confirmShake(month: number): Promise<boolean> {
    const m = $('#shake', root);
    m.innerHTML = `
      <div class="box">
        <h2>흔들까요?</h2>
        <p>${month}월(${MONTH_NAMES[month]}) 패 3장을 보여 주고<br/>이기면 점수가 <b>2배</b>가 됩니다.</p>
        <div class="row split">
          <button class="btn big go" data-v="1">✔ 흔들기</button>
          <button class="btn big plain" data-v="0">그냥 내기</button>
        </div>
      </div>`;
    m.classList.remove('hidden');
    return new Promise((resolve) => {
      m.querySelectorAll('button').forEach((b) => {
        b.onclick = () => {
          sfx.click();
          m.classList.add('hidden');
          resolve(b.dataset.v === '1');
        };
      });
    });
  },

  showGoStop(s: GameState, carry: number, cb: (go: boolean) => void) {
    const me = s.players[0],
      opp = s.players[1];
    const sc = scoreCards(me.captured);
    const now = settle({
      winnerCaptured: me.captured,
      loserCaptured: opp.captured,
      winnerGo: me.goCount,
      loserGo: opp.goCount,
      winnerShakes: me.shakes,
      carry,
    });
    const nextGo = me.goCount + 1;
    const goMul = nextGo >= 3 ? `점수 ×${2 ** (nextGo - 2)}` : `+${nextGo}점`;
    const mults = now.multipliers.map((m) => `<span class="chip">${m.label} ×${m.factor}</span>`).join('');
    const oppScore = scoreCards(opp.captured).total;
    const m = $('#gostop', root);
    m.innerHTML = `
      <div class="box gostop">
        <h2>${sc.total}점 났습니다!</h2>
        <div class="row split">
          <button class="btn huge go" id="go-btn">
            <span class="big-label">고!</span>
            <span class="sub">${nextGo}고 · ${goMul}</span>
            <span class="sub">한 장이라도 더 먹어야 다시 날 수 있어요</span>
          </button>
          <div class="preview">
            <div>지금 멈추면</div>
            <div class="final">${now.final}점</div>
            <div class="won">+${won(now.final * POINT_VALUE)}</div>
            <div class="mults">${mults}</div>
            <div class="danger ${oppScore >= 4 ? 'on' : ''}">상대 ${oppScore}점${oppScore >= 4 ? ' · 고박 주의!' : ''}</div>
          </div>
          <button class="btn huge stop" id="stop-btn">
            <span class="big-label">스톱</span>
            <span class="sub">여기서 끝내고 점수 받기</span>
          </button>
        </div>
      </div>`;
    m.classList.remove('hidden');
    const done = (go: boolean) => {
      sfx.click();
      m.classList.add('hidden');
      cb(go);
    };
    $('#go-btn', m).onclick = () => done(true);
    $('#stop-btn', m).onclick = () => done(false);
  },

  showResult(
    result: RoundResult,
    s: GameState,
    delta: number,
    again: () => void,
    onStamp: (x: number, y: number) => void,
    onCoin: () => void,
  ) {
    const m = $('#result', root);
    const win = result.winner === 0;
    const title = result.winner === null ? '나가리' : win ? '승리!' : '패배';
    const cls = result.winner === null ? 'draw' : win ? 'win' : 'lose';
    const lines: string[] = [];
    let mults: { label: string; factor: number }[] = [];
    let final = 0;
    if (result.winner !== null && result.settlement) {
      const w = result.winner;
      const sc = scoreCards(s.players[w].captured);
      const add = (label: string, v: number) => v && lines.push(`<li><span>${label}</span><b>${v}점</b></li>`);
      if (result.reason === 'chongtong') lines.push('<li><span>총통 (같은 월 4장)</span><b>7점</b></li>');
      else if (result.reason === 'samppeok') lines.push('<li><span>삼뻑</span><b>7점</b></li>');
      else {
        add(`광 ${sc.gwangCount}장`, sc.gwang);
        add(`열끗 ${sc.yeolCount}장`, sc.yeol);
        add('고도리', sc.godori);
        add(`띠 ${sc.ttiCount}장`, sc.tti);
        add('홍단', sc.hongdan);
        add('청단', sc.cheongdan);
        add('초단', sc.chodan);
        add(`피 ${sc.piCount}장`, sc.pi);
        add(`${s.players[w].goCount}고`, result.settlement.goBonus);
      }
      mults = result.settlement.multipliers;
      final = result.settlement.final;
    }
    const reason = result.winner === null ? '아무도 나지 못했습니다. 다음 판은 점수 2배!' : win ? '' : '상대가 났습니다';
    m.innerHTML = `
      <div class="box result ${cls}">
        <h1>${title}</h1>
        ${reason ? `<p class="reason">${reason}</p>` : ''}
        <ul class="lines">${lines.join('')}</ul>
        <div class="stamps"></div>
        <div class="total ${final ? '' : 'hidden'}"><span>최종</span><b class="final">0</b><span>점</span></div>
        <div class="delta ${delta >= 0 ? 'plus' : 'minus'}">${delta === 0 ? '' : (delta > 0 ? '+' : '-') + '<b class="dv">0</b>냥'}</div>
        <div class="row center"><button class="btn big go" id="again">한 판 더!</button></div>
        <p class="hint">화면을 누르면 연출을 건너뜁니다</p>
      </div>`;
    m.classList.remove('hidden');
    const stampsEl = $('.stamps', m);
    const finalEl = $('.final', m);
    const dv = m.querySelector('.dv') as HTMLElement | null;
    let skipped = false;
    const timers: number[] = [];
    const finish = () => {
      skipped = true;
      timers.forEach(clearTimeout);
      stampsEl.innerHTML = mults.map((x) => `<span class="stamp in">${x.label} ×${x.factor}</span>`).join('');
      finalEl.textContent = String(final);
      if (dv) dv.textContent = Math.abs(delta).toLocaleString('ko-KR');
    };
    let t = 500;
    mults.forEach((x) => {
      timers.push(
        window.setTimeout(() => {
          if (skipped) return;
          const sp = document.createElement('span');
          sp.className = 'stamp';
          sp.textContent = `${x.label} ×${x.factor}`;
          stampsEl.appendChild(sp);
          requestAnimationFrame(() => sp.classList.add('in'));
          onStamp(0, 0);
        }, t),
      );
      t += 420;
    });
    // 숫자 올라가기
    timers.push(
      window.setTimeout(() => {
        const start = performance.now();
        const dur = 900;
        const tick = (now: number) => {
          if (skipped) return;
          const k = Math.min(1, (now - start) / dur);
          const e = 1 - (1 - k) ** 3;
          finalEl.textContent = String(Math.round(final * e));
          if (dv) dv.textContent = Math.round(Math.abs(delta) * e).toLocaleString('ko-KR');
          if (Math.random() < 0.3) onCoin();
          if (k < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }, t),
    );
    m.onclick = (ev) => {
      if ((ev.target as HTMLElement).id === 'again') return;
      finish();
    };
    $('#again', m).onclick = () => {
      sfx.click();
      finish();
      m.classList.add('hidden');
      again();
    };
    void other;
  },

  hideResult() {
    if (root) $('#result', root).classList.add('hidden');
  },

  hideGoStop() {
    if (root) $('#gostop', root).classList.add('hidden');
  },

  menuHandlers: null as null | { apply: () => void; reset: () => void; resume?: () => void },

  showMenu() {
    const m = $('#menu', root);
    const on = (b: boolean) => (b ? 'on' : '');
    m.innerHTML = `
      <div class="box menu">
        <h2>설정</h2>
        <div class="opt"><span>상대 실력</span><div class="seg" data-k="difficulty">
          <button data-v="easy" class="${on(settings.difficulty === 'easy')}">초급</button>
          <button data-v="normal" class="${on(settings.difficulty === 'normal')}">중급</button>
          <button data-v="hard" class="${on(settings.difficulty === 'hard')}">고급</button></div></div>
        <div class="opt"><span>게임 속도</span><div class="seg" data-k="speed">
          <button data-v="1" class="${on(settings.speed === 1)}">보통</button>
          <button data-v="1.5" class="${on(settings.speed === 1.5)}">빠름</button>
          <button data-v="2" class="${on(settings.speed === 2)}">아주 빠름</button></div></div>
        <div class="opt"><span>효과음</span><button class="toggle ${on(settings.sfx)}" data-t="sfx"></button></div>
        <div class="opt"><span>배경 음악</span><button class="toggle ${on(settings.music)}" data-t="music"></button></div>
        <div class="opt"><span>음성</span><button class="toggle ${on(settings.voice)}" data-t="voice"></button></div>
        <div class="opt"><span>패에 월 숫자 표시</span><button class="toggle ${on(settings.monthBadge)}" data-t="monthBadge"></button></div>
        <div class="opt"><span>화면 흔들림·번쩍임 줄이기</span><button class="toggle ${on(settings.calmFx)}" data-t="calmFx"></button></div>
        <div class="stats">
          <div>전적 <b>${stats.wins}승 ${stats.losses}패 ${stats.nagari}나가리</b></div>
          <div>승률 <b>${stats.wins + stats.losses ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100) : 0}%</b> · 최고 점수 <b>${stats.bestWin}점</b> · 최다 <b>${stats.maxGo}고</b></div>
          <div class="fair">키보드: 숫자 1~0으로 패 내기, 바닥 두 장 중 고를 때 1·2, Esc 취소</div>
          <div class="fair">패는 매 판 컴퓨터 난수로 공정하게 섞습니다. 패 조작 없음.</div>
        </div>
        <div class="row center"><button class="btn big go" id="menu-close">닫기</button><button class="btn plain" id="menu-reset">전적 초기화</button></div>
      </div>`;
    m.classList.remove('hidden');
    m.querySelectorAll<HTMLElement>('.seg').forEach((seg) => {
      seg.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
        b.onclick = () => {
          sfx.click();
          const k = seg.dataset.k as 'difficulty' | 'speed';
          if (k === 'speed') settings.speed = Number(b.dataset.v);
          else settings.difficulty = b.dataset.v as typeof settings.difficulty;
          seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
          hud.menuHandlers?.apply();
        };
      });
    });
    m.querySelectorAll<HTMLButtonElement>('.toggle').forEach((b) => {
      b.onclick = () => {
        const k = b.dataset.t as 'sfx' | 'music' | 'voice' | 'monthBadge' | 'calmFx';
        settings[k] = !settings[k];
        b.classList.toggle('on', settings[k]);
        sfx.click();
        hud.menuHandlers?.apply();
      };
    });
    $('#menu-close', m).onclick = () => {
      sfx.click();
      m.classList.add('hidden');
    };
    $('#menu-reset', m).onclick = () => {
      hud.menuHandlers?.reset();
      m.classList.add('hidden');
    };
  },
};
