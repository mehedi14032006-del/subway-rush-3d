import { SubwayRushGame } from './game/game.js';

window.addEventListener('DOMContentLoaded', () => {
  const game = new SubwayRushGame();
  game.boot().catch((err) => {
    console.error('Boot error:', err);
    const el = document.getElementById('loader-status');
    if (el) el.textContent = `Startup error: ${err.message}`;
  });
});
