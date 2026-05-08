// ═══════════════════════════════════════════════════════════════
// Monster World V5.1 — Evolution System
// Branching evolution modal, stat application, persistence
// ═══════════════════════════════════════════════════════════════

import { G } from '../core/gameState.js';
import { P, savePlayer, persistMonsterLevel } from '../core/playerState.js';
import { EVOLUTIONS, SKILLS, ELEM_ICONS, ELEM_COLORS } from '../core/data.js';
import { toast, addLog } from '../ui/UIHelpers.js';
import { render, renderUnitDetail } from '../ui/Renderer.js';
import { findU } from '../combat/movement.js';

/** Show the evolution branch-choice modal */
export function showEvoModal(uid) {
  const branches = EVOLUTIONS[uid];
  if (!branches) return;

  const modal = document.getElementById('evo-modal');
  const hdr   = document.getElementById('evo-modal-title');
  const wrap  = document.getElementById('evo-branches');
  if (!modal || !wrap) return;

  // Find live unit (or fallback to base)
  const u = G.units[uid];
  if (!u) { toast('Quái không có trong trận!'); return; }
  if (u.evolved) { toast('Quái đã tiến hóa rồi!'); return; }
  if (!u.evoReady) { toast('Quái chưa đạt LV10!'); return; }
  if ((P.inventory.evo_stone || 0) <= 0) { toast('Cần 1 💎 Đá Tiến Hóa!'); return; }

  if (hdr) hdr.textContent = `✨ TIẾN HÓA — ${u.e} ${u.n} LV${u.lv}`;

  wrap.innerHTML = '';
  branches.forEach(path => {
    const sk     = SKILLS[path.newSkill];
    const eClr   = path.elem ? (ELEM_COLORS[path.elem] || '#888') : '#888';
    const eIcon  = path.elem ? (ELEM_ICONS[path.elem] || '') : '';

    const card = document.createElement('div');
    card.className = 'evo-branch-card' + (path.pathId.includes('_b') ? ' path-b' : '');
    card.innerHTML = `
      <div class="ebc-label" style="color:${eClr}">${path.label}</div>
      <div class="ebc-emoji">${path.e}</div>
      <div class="ebc-name">${path.n}</div>
      <div class="ebc-desc">${path.desc}</div>
      <div class="ebc-stats">
        <div class="ebs"><span class="ebs-l">HP</span><span class="ebs-v">+${path.hp}</span></div>
        <div class="ebs"><span class="ebs-l">ATK</span><span class="ebs-v">+${path.atk}</span></div>
        <div class="ebs"><span class="ebs-l">DEF</span><span class="ebs-v">+${path.def}</span></div>
        ${path.mp  ? `<div class="ebs"><span class="ebs-l">MP</span><span class="ebs-v">+${path.mp}</span></div>` : ''}
        ${path.spd ? `<div class="ebs"><span class="ebs-l">SPD</span><span class="ebs-v">+${path.spd}</span></div>` : ''}
        <div class="ebs"><span class="ebs-l">Nguyên tố</span><span class="ebs-v" style="color:${eClr}">${eIcon}${path.elem}</span></div>
      </div>
      ${sk ? `<div class="ebc-skill">🆕 Kỹ năng mới: ${sk.i} ${sk.n}</div>` : ''}
      <button class="ebc-btn">✨ Chọn hướng này</button>`;

    card.querySelector('button').addEventListener('click', () => {
      applyEvolution(uid, path);
      modal.classList.remove('show');
    });
    wrap.appendChild(card);
  });

  modal.classList.add('show');
}

export function closeEvoModal() {
  document.getElementById('evo-modal')?.classList.remove('show');
}

/** Apply chosen evolution path to the live unit */
function applyEvolution(uid, path) {
  const u = G.units[uid];
  if (!u || u.evolved) return;

  // Consume Evo Stone
  if ((P.inventory.evo_stone || 0) <= 0) { toast('Cần 1 💎 Đá Tiến Hóa!'); return; }
  P.inventory.evo_stone--;

  // Apply stat boosts
  u.n    = path.n;
  u.e    = path.e;
  u.elem = path.elem || u.elem;
  u.hp  += path.hp;   u.curHp  = Math.min(u.curHp + path.hp, u.hp);
  u.atk += path.atk;
  u.def += path.def;
  if (path.mp)  { u.mp += path.mp;   u.curMp = Math.min(u.curMp + path.mp, u.mp); }
  if (path.spd) { u.spd = Math.max(1, u.spd + path.spd); }
  if (path.newSkill && !u.sk.includes(path.newSkill)) u.sk.push(path.newSkill);

  u.evolved   = true;
  u.evoReady  = false;
  u.evoPathId = path.pathId;

  // Persist to player state
  persistMonsterLevel(u);
  const ml = P.monsterLevels[uid];
  if (ml) { ml.evolved = true; ml.evoPathId = path.pathId; }
  savePlayer();

  // Flash evo overlay
  const ov = document.getElementById('ulti-overlay');
  const tt = document.getElementById('ulti-title');
  const sb = document.getElementById('ulti-sub');
  if (ov && tt) {
    tt.textContent = `${u.e} ${u.n}`;
    if (sb) sb.textContent = path.desc;
    ov.classList.add('show');
    setTimeout(() => ov.classList.remove('show'), 2000);
  }

  addLog(`✨ ${u.e} ${u.n} ĐÃ TIẾN HÓA theo hướng ${path.label}!`, 'lev');
  toast(`✨ TIẾN HÓA THÀNH CÔNG! ${u.e} ${u.n} — ${path.desc}`);
  renderUnitDetail(u);
  render();
}
