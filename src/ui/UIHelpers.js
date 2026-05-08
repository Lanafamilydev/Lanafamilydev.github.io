// ═══════════════════════════════════════════════════════════════
// Monster World V5.1 — UI Helpers Module
// Toast notifications, battle log, floating damage text
// ═══════════════════════════════════════════════════════════════

let _toastTimer = null;

/** Show a brief toast notification */
export function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) { console.log('[Toast]', msg); return; }
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('on'), 2800);
}

/** Add a line to the battle log */
export function addLog(msg, type = 'ls') {
  const log = document.getElementById('log');
  if (!log) return;
  const e = document.createElement('div');
  e.className = 'le ' + type;
  e.textContent = msg;
  log.appendChild(e);
  if (log.children.length > 150) log.children[0].remove();
  log.scrollTop = log.scrollHeight;
}

/** Add a turn separator line to the log */
export function addLogSep(turn, round) {
  const log = document.getElementById('log');
  if (!log) return;
  const e = document.createElement('div');
  e.className = 'lsep ' + (turn === 'player' ? 'lsep-p' : 'lsep-e');
  e.textContent = turn === 'player'
    ? `── ⚡ YUGI (Round ${round}) ──`
    : `── 👺 BAKURA (Round ${round}) ──`;
  log.appendChild(e);
  if (log.children.length > 150) log.children[0].remove();
  log.scrollTop = log.scrollHeight;
}

/** Float damage/heal text over a board cell */
export function floatTxt(r, c, text, color = '#fff') {
  const bd = document.getElementById('board');
  if (!bd) return;
  const cells = bd.querySelectorAll('.cell');
  const G_cols = parseInt(bd.style.gridTemplateColumns?.match(/repeat\((\d+)/)?.[1] || '10');
  const idx = r * G_cols + c;
  if (idx >= cells.length) return;
  const cell = cells[idx];
  const rect  = cell.getBoundingClientRect();
  const brect = bd.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'df';
  el.textContent = text;
  el.style.color = color;
  el.style.left = (rect.left - brect.left + rect.width / 2 - 20) + 'px';
  el.style.top  = (rect.top  - brect.top) + 'px';
  bd.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

/** Shake the board for dramatic effect */
export function shakeBoard() {
  const bd = document.getElementById('board');
  if (!bd) return;
  bd.classList.add('shake');
  setTimeout(() => bd.classList.remove('shake'), 520);
}

/** Show/hide cancel button */
export function showCancel() {
  document.getElementById('cancel-btn')?.style && (document.getElementById('cancel-btn').style.display = 'block');
}
export function hideCancel() {
  document.getElementById('cancel-btn')?.style && (document.getElementById('cancel-btn').style.display = 'none');
}
