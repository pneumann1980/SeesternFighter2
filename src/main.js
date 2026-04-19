import { Game } from './Game.js';

const game = new Game();

game.init().then(() => {
  game.start();
}).catch(err => {
  console.error('Failed to initialize game:', err);
  document.body.innerHTML = `<div style="color:#FF4444;font-size:20px;padding:20px;font-family:monospace;">
    Game init error:<br>${err.message}<br><pre>${err.stack}</pre></div>`;
});
