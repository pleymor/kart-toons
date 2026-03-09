/**
 * Gamepad UI navigation helper.
 * Polls the first connected gamepad and fires callbacks for
 * D-pad/stick navigation and button presses.
 *
 * Returns a cleanup function to stop polling.
 */
export function startGamepadNav({ onUp, onDown, onLeft, onRight, onConfirm, onBack }) {
  let rafId;
  let prevLeft = false;
  let prevRight = false;
  let prevUp = false;
  let prevDown = false;
  let prevA = false;
  let prevB = false;

  const DEAD_ZONE = 0.5;
  const REPEAT_DELAY = 220; // ms before first repeat
  const REPEAT_RATE = 140;  // ms between repeats
  const held = { up: 0, down: 0, left: 0, right: 0 };

  function poll(now) {
    const gp = getFirstGamepad();
    if (gp) {
      const axes = gp.axes;
      const buttons = gp.buttons;

      // D-pad buttons (12=up, 13=down, 14=left, 15=right) or left stick
      const left = (axes[0] < -DEAD_ZONE) || buttons[14]?.pressed;
      const right = (axes[0] > DEAD_ZONE) || buttons[15]?.pressed;
      const up = (axes[1] < -DEAD_ZONE) || buttons[12]?.pressed;
      const down = (axes[1] > DEAD_ZONE) || buttons[13]?.pressed;

      // A (confirm) = button 0, B (back) = button 1
      const a = buttons[0]?.pressed;
      const b = buttons[1]?.pressed;

      // Fire on press or repeat when held
      fireDir('left', left, prevLeft, held, now, onLeft);
      fireDir('right', right, prevRight, held, now, onRight);
      fireDir('up', up, prevUp, held, now, onUp);
      fireDir('down', down, prevDown, held, now, onDown);

      if (a && !prevA && onConfirm) onConfirm();
      if (b && !prevB && onBack) onBack();

      prevLeft = left;
      prevRight = right;
      prevUp = up;
      prevDown = down;
      prevA = a;
      prevB = b;
    }

    rafId = requestAnimationFrame(poll);
  }

  function fireDir(dir, current, prev, heldTimers, now, callback) {
    if (!callback) return;
    if (current && !prev) {
      callback();
      heldTimers[dir] = now + REPEAT_DELAY;
    } else if (current && now > heldTimers[dir]) {
      callback();
      heldTimers[dir] = now + REPEAT_RATE;
    }
    if (!current) {
      heldTimers[dir] = 0;
    }
  }

  rafId = requestAnimationFrame(poll);

  return () => cancelAnimationFrame(rafId);
}

function getFirstGamepad() {
  const gamepads = navigator.getGamepads?.();
  if (!gamepads) return null;
  for (let i = 0; i < gamepads.length; i++) {
    if (gamepads[i]) return gamepads[i];
  }
  return null;
}
