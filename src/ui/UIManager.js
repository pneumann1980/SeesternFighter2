export class UIManager {
  constructor(events) {
    this.events = events;

    this._screens = {
      menu:     document.getElementById('screen-menu'),
      gameover: document.getElementById('screen-gameover'),
      win:      document.getElementById('screen-win'),
      wave:     document.getElementById('screen-wave'),
    };

    this._waveTimer = null;

    this._setupButtons();
    this._setupWaveEvents();
  }

  _setupButtons() {
    // Use pointerup so it fires reliably on touch without 300ms delay conflicts
    const once = (id, event) => {
      document.getElementById(id).addEventListener('pointerup', e => {
        e.preventDefault();
        this.events.emit(event, {});
      });
    };
    once('btn-start',       'startGame');
    once('btn-restart',     'restart');
    once('btn-win-restart', 'restart');

    // Keyboard Enter on menu
    window.addEventListener('keydown', e => {
      if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        if (!this._screens.menu.classList.contains('hidden')) {
          this.events.emit('startGame', {});
        }
      }
    });
  }

  _setupWaveEvents() {
    let countdown = 3;
    let intervalId = null;

    this.events.on('waveComplete', (data) => {
      this.showWaveComplete();
      countdown = 3;
      document.getElementById('next-wave-text').textContent = `Nächste Welle in ${countdown}...`;

      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(() => {
        countdown--;
        if (countdown <= 0) {
          clearInterval(intervalId);
          intervalId = null;
          this.hideWave();
        } else {
          document.getElementById('next-wave-text').textContent = `Nächste Welle in ${countdown}...`;
        }
      }, 1000);
    });
  }

  showMenu() {
    this._hideAll();
    this._screens.menu.classList.remove('hidden');
  }

  showGameOver(score) {
    this._hideAll();
    document.getElementById('final-score').textContent = score.toLocaleString();
    this._screens.gameover.classList.remove('hidden');
  }

  showWin(score) {
    this._hideAll();
    document.getElementById('win-score').textContent = score.toLocaleString();
    this._screens.win.classList.remove('hidden');
  }

  showWaveComplete() {
    this._screens.wave.classList.remove('hidden');
  }

  hideWave() {
    this._screens.wave.classList.add('hidden');
  }

  hideAll() {
    this._hideAll();
  }

  _hideAll() {
    Object.values(this._screens).forEach(s => s.classList.add('hidden'));
  }
}
