import { Application } from 'pixi.js';
import gsap from 'gsap';
import { showHome } from '../features/home/home';
import { LocalMatchGateway } from '../features/matgo_game/gateway/local-match-gateway';
import type { MatchGateway } from '../features/matgo_game/gateway/match-gateway';
import { setShowMonthBadge } from '../features/matgo_game/view/card/cardView';
import { loadCardTextures } from '../features/matgo_game/view/card/textures';
import { fxPrefs } from '../features/matgo_game/view/effects/effects';
import { GameScene } from '../features/matgo_game/view/game-scene';
import { hud } from '../features/matgo_game/view/hud/hud';
import { STAGE_H, STAGE_W } from '../features/matgo_game/view/table/layout';
import { audioSettings } from '../shared/audio/sfx';
import { setMusic, startMusic } from '../shared/audio/music';
import { saveSettings, settings } from '../shared/settings';
import { resetStats } from '../shared/stats';

/** 앱 구성 지점: 화면을 만들고 게이트웨이를 연결한다. 온라인 대전은 여기서 OnlineMatchGateway로 바꿔 끼운다. */
export async function startApp() {
  const app = new Application();
  await app.init({
    resizeTo: window,
    background: '#0b1f14',
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });
  document.getElementById('canvas-host')!.appendChild(app.canvas);

  const loadingBar = document.querySelector<HTMLElement>('#loading .bar i')!;
  await Promise.all([document.fonts.load('80px "Black Han Sans"'), document.fonts.load('bold 30px "Noto Sans KR"')]).catch(() => undefined);
  await loadCardTextures((p) => (loadingBar.style.width = `${Math.round(p * 100)}%`));

  const scene = new GameScene(app);
  app.stage.addChild(scene.root);
  const stage = document.getElementById('stage')!;
  hud.mount(document.getElementById('hud')!);

  const applySettings = () => {
    audioSettings.sfx = settings.sfx;
    audioSettings.voice = settings.voice;
    setMusic(settings.music);
    setShowMonthBadge(settings.monthBadge);
    fxPrefs.calm = settings.calmFx;
    scene.refreshBadges();
    gsap.globalTimeline.timeScale(settings.speed);
    saveSettings();
  };
  hud.menuHandlers = {
    apply: applySettings,
    reset: () => {
      resetStats();
      hud.toast('전적을 초기화했습니다', 1200);
    },
  };
  applySettings();

  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const s = Math.min(w / STAGE_W, h / STAGE_H);
    const ox = (w - STAGE_W * s) / 2;
    const oy = (h - STAGE_H * s) / 2;
    scene.resize(s, ox, oy);
    stage.style.transform = `translate(${ox}px, ${oy}px) scale(${s})`;
  };
  window.addEventListener('resize', resize);
  resize();

  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('.modal:not(.hidden)')) return;
    scene.handleKey(e.key);
  });

  document.getElementById('loading')!.classList.add('hidden');

  // 게이트웨이 구성: 지금은 컴퓨터와 두는 로컬 게이트웨이. 온라인 대전은 OnlineMatchGateway로 바꾼다.
  const gateway: MatchGateway = new LocalMatchGateway();
  scene.attach(gateway);
  showHome((difficulty) => {
    applySettings();
    startMusic();
    gateway.start({ difficulty });
  });

  // 개발·시험용 핸들
  Object.assign(window as object, { __game: scene, __gateway: gateway, __gsap: gsap });
}
