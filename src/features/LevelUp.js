// ═══════════════════════════════════════════════════════════════
// Monster World V5.1 — Manual Level Up (Training) System
// Players spend Gold to level up monsters outside of battle.
// State syncs to P.monsterLevels → SessionManager picks it up.
// ═══════════════════════════════════════════════════════════════

import { P, savePlayer } from '../core/playerState.js';
import { UDEFS, GACHA_POOL, EVOLUTIONS, ELEM_ICONS, ELEM_COLORS } from '../core/data.js';
import { toast } from '../ui/UIHelpers.js';

// ── Constants ─────────────────────────────────────────────────

/** Gold cost to go from currentLv → currentLv+1 */
export function lvUpCost(currentLv) {
  return currentLv * 50;          // LV1→2: 50g, LV9→10: 450g, LV15→16: 750g
}

const MAX_LV      = 20;           // hard cap
const HP_PER_LV   = 3;
const ATK_PER_LV  = 1;
const DEF_PER_LV  = 1;
const EVO_READY_LV = 10;

// ── Helpers ───────────────────────────────────────────────────

function getDefById(id) {
  return UDEFS[id] || GACHA_POOL.find(m => m.id === id) || null;
}

/** Ensure an entry exists in P.monsterLevels for this id */
function ensureML(id) {
  if (!P.monsterLevels) P.monsterLevels = {};
  if (!P.monsterLevels[id]) {
    const def = getDefById(id);
    P.monsterLevels[id] = {
      lv: def?.lv || 1, xp: 0,
      evolved: false, evoPathId: null,
    };
  }
  return P.monsterLevels[id];
}

// ── Core logic ────────────────────────────────────────────────

/**
 * Perform one manual level-up for a monster.
 * Validates gold → deducts → increments lv → updates stats → saves → refreshes UI.
 * Bound via addEventListener (no window scope needed).
 */
export function manualLevelUp(id) {
  const ml  = ensureML(id);
  const lv  = ml.lv;

  // ── Validation ──────────────────────────────────────────────
  if (lv >= MAX_LV) {
    toast(`⚠ ${getDefById(id)?.n || id} đã đạt cấp tối đa LV${MAX_LV}!`);
    return;
  }
  const cost = lvUpCost(lv);
  if (P.gold < cost) {
    toast(`💰 Không đủ Vàng! Cần ${cost}g · Có ${P.gold}g`);
    return;
  }

  // ── Apply ────────────────────────────────────────────────────
  P.gold   -= cost;
  ml.lv    += 1;
  ml.xp     = ml.xp || 0;   // preserve any battle XP

  // EVO-ready flag (persisted; SessionManager reads it on initBattle)
  if (ml.lv >= EVO_READY_LV && EVOLUTIONS[id] && !ml.evolved) {
    ml.evoReady = true;
  }

  // ── Persist & refresh ────────────────────────────────────────
  savePlayer();
  import('../core/playerState.js').then(m => m.updateGlobalHeader());

  const def  = getDefById(id);
  const name = def?.n || id;
  const emoji= def?.e || '?';

  let msg = `⬆ ${emoji} ${name} LV${lv} → LV${ml.lv} (+${HP_PER_LV}HP +${ATK_PER_LV}ATK +${DEF_PER_LV}DEF) 💰−${cost}g`;
  if (ml.evoReady && !ml.evolved)
    msg += ' ✨ EVO sẵn sàng!';
  toast(msg);

  // Re-render only the training list and Roster (lightweight)
  renderLevelUpList();
  import('./Roster.js').then(m => m.renderRosterTab());
}

// ── Render ────────────────────────────────────────────────────

/** Render the full training list into #levelup-list */
export function renderLevelUpList() {
  const el = document.getElementById('levelup-list');
  if (!el) return;
  el.innerHTML = '';

  const collection = P.collection || [];
  if (!collection.length) {
    el.innerHTML = '<div class="lvu-empty">Chưa có quái trong bộ sưu tập.</div>';
    return;
  }

  collection.forEach(id => {
    const def = getDefById(id);
    if (!def) return;

    const ml   = ensureML(id);
    const lv   = ml.lv;
    const xp   = ml.xp || 0;
    const cost = lvUpCost(lv);

    const canAfford  = P.gold >= cost;
    const isMaxLv    = lv >= MAX_LV;
    const isEvolved  = ml.evolved || false;
    const evoReady   = ml.evoReady && !isEvolved && EVOLUTIONS[id];

    const elem  = def.elem || 'neutral';
    const eIcon = ELEM_ICONS[elem]  || '';
    const eClr  = ELEM_COLORS[elem] || '#888';
    const rarity= def.t || 'B';

    // Stats at current level (base + manual bonuses)
    const baseLv     = def.lv || 1;
    const gainedLvs  = Math.max(0, lv - baseLv);
    const currentHp  = (def.hp  || 10) + gainedLvs * HP_PER_LV;
    const currentAtk = (def.atk || 5)  + gainedLvs * ATK_PER_LV;
    const currentDef = (def.def || 3)  + gainedLvs * DEF_PER_LV;

    // XP bar (battle-accumulated)
    const xpNeed = lv * 30;
    const xpPct  = isMaxLv ? 100 : Math.min(100, Math.round((xp / xpNeed) * 100));

    // EVO badge text
    let evoBadge = '';
    if (isEvolved) {
      const path = EVOLUTIONS[id]?.find(p => p.pathId === ml.evoPathId);
      evoBadge = `<span class="lvu-evo-badge evolved">★ ${path?.n || 'Đã tiến hóa'}</span>`;
    } else if (evoReady) {
      evoBadge = `<span class="lvu-evo-badge ready">✨ EVO sẵn sàng!</span>`;
    } else if (lv >= EVO_READY_LV && EVOLUTIONS[id]) {
      evoBadge = `<span class="lvu-evo-badge need-stone">✨ Cần 💎 Đá EVO</span>`;
    } else if (EVOLUTIONS[id]) {
      evoBadge = `<span class="lvu-evo-badge locked">🔒 EVO tại LV${EVO_READY_LV}</span>`;
    }

    const card = document.createElement('div');
    card.className = 'lvu-card' + (isEvolved ? ' lvu-evolved' : '');
    card.dataset.monsterId = id;

    card.innerHTML = `
      <div class="lvu-left">
        <div class="lvu-emoji-wrap">
          <span class="lvu-emoji">${def.e}</span>
          <span class="lvu-lv" style="color:var(--gold)">LV${lv}</span>
        </div>
        <div class="lvu-meta">
          <div class="lvu-name">${def.n}${isEvolved ? ' ★' : ''}</div>
          <div class="lvu-elem" style="color:${eClr}">${eIcon} ${elem}</div>
          <div class="lvu-stats-row">
            <span class="lvu-stat">❤${currentHp}</span>
            <span class="lvu-stat">⚔${currentAtk}</span>
            <span class="lvu-stat">🛡${currentDef}</span>
          </div>
          ${evoBadge}
          <div class="lvu-xp-row">
            <span class="lvu-xp-label">XP chiến trường</span>
            <div class="lvu-xp-track">
              <div class="lvu-xp-fill" style="width:${xpPct}%"></div>
            </div>
            <span class="lvu-xp-val">${isMaxLv ? 'MAX' : xp+'/'+xpNeed}</span>
          </div>
        </div>
      </div>
      <div class="lvu-right">
        <div class="lvu-gain">⬆ +${HP_PER_LV}HP · +${ATK_PER_LV}ATK · +${DEF_PER_LV}DEF</div>
        <div class="lvu-cost ${canAfford ? '' : 'cant-afford'}">
          💰 ${isMaxLv ? '—' : cost + ' Vàng'}
        </div>
        <button class="lvu-btn ${isMaxLv ? 'lvu-maxed' : canAfford ? '' : 'lvu-broke'}"
          ${isMaxLv || !canAfford ? 'disabled' : ''}
          data-lvuid="${id}">
          ${isMaxLv ? '⭐ MAX LV' : canAfford ? '⬆ Nâng cấp' : '💰 Thiếu Vàng'}
        </button>
      </div>`;

    // ── addEventListener binding (ES6-safe, no window scope needed) ──
    const btn = card.querySelector('.lvu-btn');
    if (btn && !isMaxLv && canAfford) {
      btn.addEventListener('click', () => manualLevelUp(id));
    }

    el.appendChild(card);
  });
}
