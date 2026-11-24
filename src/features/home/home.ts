import type { Difficulty } from '../matgo_game/model/types';
import * as sfx from '../../shared/audio/sfx';
import { initAudio } from '../../shared/audio/sfx';
import { saveSettings, settings } from '../../shared/settings';
import { stats } from '../../shared/stats';

/**
 * 타이틀 화면: 난이도를 고르고 대국을 시작한다. 시작은 onStart로 넘기고, 게이트웨이를 고르는 일은 앱 구성 지점이 한다.
 */
export function showHome(onStart: (difficulty: Difficulty) => void) {
  const title = document.getElementById('title')!;
  title.classList.remove('hidden');
  title.querySelector('.money')!.textContent = `보유 ${stats.money.toLocaleString('ko-KR')}냥 · ${stats.wins}승 ${stats.losses}패`;
  title.querySelectorAll<HTMLButtonElement>('.seg button').forEach((b) => {
    b.classList.toggle('on', b.dataset.v === settings.difficulty);
    b.onclick = () => {
      initAudio();
      sfx.click();
      settings.difficulty = b.dataset.v as Difficulty;
      title.querySelectorAll('.seg button').forEach((x) => x.classList.toggle('on', x === b));
      saveSettings();
    };
  });
  document.getElementById('start')!.onclick = () => {
    initAudio();
    sfx.click();
    title.classList.add('hidden');
    onStart(settings.difficulty);
  };
}
