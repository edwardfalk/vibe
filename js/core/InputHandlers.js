function onKeyDown(e) {
  switch (e.code) {
    case 'Space':
      window.playerIsShooting = true;
      e.preventDefault();
      break;
    case 'ArrowUp':
      window.arrowUpPressed = true;
      e.preventDefault();
      break;
    case 'ArrowDown':
      window.arrowDownPressed = true;
      e.preventDefault();
      break;
    case 'ArrowLeft':
      window.arrowLeftPressed = true;
      e.preventDefault();
      break;
    case 'ArrowRight':
      window.arrowRightPressed = true;
      e.preventDefault();
      break;
  }
}

function onKeyUp(e) {
  switch (e.code) {
    case 'Space':
      window.playerIsShooting = false;
      e.preventDefault();
      break;
    case 'ArrowUp':
      window.arrowUpPressed = false;
      e.preventDefault();
      break;
    case 'ArrowDown':
      window.arrowDownPressed = false;
      e.preventDefault();
      break;
    case 'ArrowLeft':
      window.arrowLeftPressed = false;
      e.preventDefault();
      break;
    case 'ArrowRight':
      window.arrowRightPressed = false;
      e.preventDefault();
      break;
  }
}

export function initializeInputHandlers() {
  if (!window.inputListenersAdded) {
    window.addEventListener('mousedown', () => {
      window.playerIsShooting = true;
    });
    window.addEventListener('mouseup', () => {
      window.playerIsShooting = false;
    });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.inputListenersAdded = true;
  }

  if (!window.uiKeyListenersAdded) {
    window.addEventListener('keydown', (event) => {
      if (!event.repeat) {
        const singleActionKeys = [
          'r',
          'R',
          'p',
          'P',
          'm',
          'M',
          't',
          'T',
          'e',
          'E',
          ' ',
        ];
        if (singleActionKeys.includes(event.key) && window.uiRenderer) {
          window.uiRenderer.handleKeyPress(event.key);
        }
      }
    });
    window.uiKeyListenersAdded = true;
  }
}
