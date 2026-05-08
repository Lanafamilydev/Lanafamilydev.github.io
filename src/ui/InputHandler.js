// ═══════════════════════════════════════════════════════════════
// Monster World V5.1 — Input Handler
// Cell click events and skill selection for player turn
// ═══════════════════════════════════════════════════════════════

import { G } from '../core/gameState.js';
import { P } from '../core/playerState.js';
import { SKILLS, EVOLUTIONS } from '../core/data.js';
import { toast, showCancel, hideCancel } from '../ui/UIHelpers.js';
import { render, renderUnitDetail } from '../ui/Renderer.js';
import { findU, getReach, getAtkbl, getSkTgts } from '../combat/movement.js';
import { doAttack, execSkill, checkCapture, checkSpecialTile } from '../combat/combat.js';

/** Handle a cell click on the battle board */
export function onCell(r, c) {
  if (G.gameOver || G.turn !== 'player') return;

  const uid = G.grid[r]?.[c];
  const u   = uid ? G.units[uid] : null;

  // ── Skill target phase ──
  if (G.activeSk && G.phase === 'sk') {
    if (G.skTgts.some(([a, b]) => a === r && b === c)) {
      execSkill(G.sel, [r, c], G.activeSk);
      return;
    }
    import('./InputHandler.js').then(() => cancelSel());
    return;
  }

  // ── Move selected unit ──
  if (G.sel && G.reach.some(([a, b]) => a === r && b === c)) {
    const [sr, sc] = G.sel;
    const mid = G.grid[sr][sc];
    const mu  = G.units[mid];
    if (mu && !mu.moved) {
      G.grid[r][c]  = mid;
      G.grid[sr][sc] = null;
      mu.moved = true;
      G.sel    = [r, c];
      G.reach  = [];
      G.atkbl  = !mu.attacked ? getAtkbl(r, c, mu.o) : [];
      G.skTgts = [];
      import('../ui/UIHelpers.js').then(m => m.addLog(`${mu.e} ${mu.n} di chuyển`, 'lm'));
      checkCapture(r, c, mid);
      checkSpecialTile(r, c, mid);
      if (mu.alive) renderUnitDetail(mu);
      render();
      showCancel();
    }
    return;
  }

  // ── Attack target ──
  if (G.sel && G.atkbl.some(([a, b]) => a === r && b === c)) {
    const [sr, sc] = G.sel;
    const aid   = G.grid[sr][sc];
    const atker = G.units[aid];
    const did   = G.grid[r][c];
    const defer = G.units[did];
    if (atker && defer && !atker.attacked && defer.o !== atker.o) {
      doAttack(atker, defer, r, c, false);
      atker.attacked = true;
      G.reach = []; G.atkbl = []; G.skTgts = [];
      render();
      hideCancel();
    }
    return;
  }

  // ── Select player unit ──
  if (u && u.alive && u.o === 'player') {
    G.activeSk = null;
    G.sel      = [r, c];
    G.phase    = 'sel';
    G.reach    = !u.moved  ? getReach(r, c, u.spd) : [];
    G.atkbl    = !u.attacked ? getAtkbl(r, c, u.o) : [];
    G.skTgts   = [];
    renderUnitDetail(u);
    render();
    showCancel();

    // Prompt evo if ready
    if (u.evoReady && !u.evolved && (P.inventory.evo_stone || 0) > 0) {
      toast(`✨ ${u.n} sẵn sàng tiến hóa! Bấm [✨ EVO] trên card.`);
    }
    return;
  }

  // ── Select enemy unit (info only) ──
  if (u && u.alive && u.o === 'enemy') {
    G.sel = null; G.reach = []; G.atkbl = []; G.skTgts = [];
    renderUnitDetail(u);
    render();
    hideCancel();
    return;
  }

  // ── Deselect ──
  cancelSel();
}

/** Cancel active selection */
function cancelSel() {
  G.sel = null; G.reach = []; G.atkbl = []; G.skTgts = [];
  G.activeSk = null; G.phase = 'sel';
  renderUnitDetail(null);
  render();
  hideCancel();
}

export function cancelAct() { cancelSel(); }

/** Called when player clicks a skill button in the right panel */
export function pickSkill(uid, sid) {
  if (G.turn !== 'player' || G.gameOver) return;
  const u  = G.units[uid];
  const sk = SKILLS[sid];
  if (!u?.alive || u.usedSkill) return;
  if (!sk.ulti && u.curMp < sk.mp) { toast('Không đủ MP!'); return; }
  if (sk.ulti && !G.ultiReady)     { toast('Combo chưa đủ ×8!'); return; }

  const pos = findU(uid);
  if (!pos) return;

  // Auto-select unit if not already selected
  if (!G.sel || G.grid[G.sel[0]]?.[G.sel[1]] !== uid) {
    G.sel   = pos;
    G.reach = !u.moved ? getReach(pos[0], pos[1], u.spd) : [];
    G.atkbl = [];
  }
  G.activeSk = sid;
  G.phase    = 'sk';
  G.skTgts   = getSkTgts(pos[0], pos[1], sid, u.o);
  render();
  renderUnitDetail(u);
  toast(`${sk.i} ${sk.n}: Chọn mục tiêu`);
  showCancel();
}
