// ═══════════════════════════════════════════════════════════════
// Monster World V5.1 — Renderer Module
// All battle-tab rendering: board, cards, panels, overlays
// ═══════════════════════════════════════════════════════════════

import { G } from '../core/gameState.js';
import { P } from '../core/playerState.js';
import {
  TERRAIN, STATUS, SKILLS, EVOLUTIONS,
  ELEM_ICONS, ELEM_COLORS, ITEMS,
} from '../core/data.js';
import { findU } from '../combat/movement.js';

// ── Master render call ────────────────────────────────────────
export function render() {
  renderBoard();
  renderCards();
  renderObjPanel();
  renderTurnBanner();
  renderCombo();
  renderScorePanel();
  renderItemBar();
}

// ── Board ─────────────────────────────────────────────────────
export function renderBoard() {
  const bd = document.getElementById('board');
  if (!bd) return;
  bd.innerHTML = '';

  for (let r = 0; r < G.rows; r++) {
    for (let c = 0; c < G.cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';

      const t  = G.activeMap[r]?.[c] || 'plains';
      const td = TERRAIN[t] || TERRAIN.plains;
      if (td.cls) cell.classList.add(td.cls);

      // Highlight states
      if (G.sel && G.sel[0] === r && G.sel[1] === c)          cell.classList.add('sel');
      else if (G.reach.some(([a,b]) => a===r && b===c))       cell.classList.add('mv');
      else if (G.atkbl.some(([a,b]) => a===r && b===c))       cell.classList.add('atk');
      else if (G.skTgts.some(([a,b]) => a===r && b===c))      cell.classList.add('sk');

      // Capture flag
      const ck = `${r},${c}`;
      if (G.captures[ck] !== undefined) {
        const f = document.createElement('div');
        f.className = 'cflag ' + G.captures[ck];
        cell.appendChild(f);
      }

      // Unit on cell
      const uid = G.grid[r]?.[c];
      if (uid) {
        const u = G.units[uid];
        if (u?.alive) {
          const uw = document.createElement('div');
          uw.className = 'uw ' + (u.o === 'enemy' ? 'u-enemy' : 'u-player')
                       + (u.evolved ? ' u-evolved' : '');
          const ex = (u.moved && u.attacked) || (u.o === 'enemy' && G.turn === 'player');
          if (ex) uw.classList.add('exhausted');

          const em = document.createElement('span');
          em.className = 'ue';
          em.textContent = u.e;
          uw.appendChild(em);

          if (u.status.length) {
            const si = document.createElement('div');
            si.className = 'cst';
            si.textContent = u.status.slice(0,2).map(s => STATUS[s.type]?.icon || '').join('');
            uw.appendChild(si);
          }
          cell.appendChild(uw);

          // HP bar
          const hb = document.createElement('div'); hb.className = 'chp';
          const hf = document.createElement('div'); hf.className = 'chpf';
          const hp = u.curHp / u.hp;
          hf.style.width = Math.max(0, hp * 100) + '%';
          hf.style.background = hp > 0.5 ? '#e03030' : hp > 0.25 ? '#ff8800' : '#ff2222';
          hb.appendChild(hf); cell.appendChild(hb);

          // Level badge
          const lv = document.createElement('div'); lv.className = 'clv'; lv.textContent = u.lv;
          cell.appendChild(lv);

          // Evo-ready glow
          if (u.evoReady && !u.evolved && u.o === 'player') {
            const eb = document.createElement('div'); eb.className = 'cevo'; eb.textContent = '✨';
            cell.appendChild(eb);
            cell.classList.add('evo-ready');
          }

          // Element badge
          if (u.elem && u.elem !== 'neutral') {
            const el2 = document.createElement('div'); el2.className = 'celem';
            el2.textContent = ELEM_ICONS[u.elem] || ''; el2.title = u.elem;
            cell.appendChild(el2);
          }
        }
      }

      cell.addEventListener('click', () => {
        import('../ui/InputHandler.js').then(m => m.onCell(r, c));
      });
      bd.appendChild(cell);
    }
  }
}

// ── Unit cards (left panel) ───────────────────────────────────
export function renderCards() {
  ['player','enemy'].forEach(own => {
    const el = document.getElementById(own === 'player' ? 'pc' : 'ec');
    if (!el) return;
    el.innerHTML = '';

    Object.values(G.units).filter(u => u.o === own).forEach(u => {
      const card = document.createElement('div');
      card.className = 'uc' + (u.alive ? '' : ' dead') + (u.evolved ? ' evolved-card' : '');
      const isSel = G.sel && G.grid[G.sel[0]]?.[G.sel[1]] === u.id;
      if (isSel) card.classList.add('act');

      const si      = u.status.map(s => STATUS[s.type]?.icon || '').join('');
      const xpPct   = Math.min(100, (u.xp / (u.lv * 30)) * 100);
      const hasStone = (P.inventory.evo_stone || 0) > 0;
      const showEvo  = u.evoReady && !u.evolved && u.o === 'player';

      card.innerHTML =
        '<div class="uct">' +
          `<span>${u.e}</span>` +
          `<span class="ucn">${u.n}${u.evolved ? '★' : ''}</span>` +
          `<span class="ucl">L${u.lv}</span>` +
          `<span style="font-size:9px">${si}</span>` +
          (showEvo ? '<span style="color:var(--gold);font-size:9px;animation:evo-btn-pulse .8s infinite alternate">✨</span>' : '') +
        '</div>' +
        '<div class="ucb">' +
          `<div class="mb mb-hp"><div class="mbf" style="width:${Math.max(0, u.curHp/u.hp*100)}%"></div></div>` +
          `<div class="mb mb-mp"><div class="mbf" style="width:${Math.max(0, u.curMp/u.mp*100)}%"></div></div>` +
          (own === 'player' ? `<div class="mb mb-xp"><div class="mbf" style="width:${xpPct}%"></div></div>` : '') +
        '</div>' +
        `<div class="ucs">${u.curHp}/${u.hp}HP · ${u.curMp}/${u.mp}MP</div>`;

      if (showEvo && hasStone) {
        const evoBtn = document.createElement('button');
        evoBtn.className = 'evo-card-btn';
        evoBtn.textContent = '✨ EVO';
        evoBtn.title = 'Chọn hướng tiến hóa cho ' + u.n;
        const uid = u.id;
        evoBtn.addEventListener('click', e => {
          e.stopPropagation();
          import('../features/Evolution.js').then(m => m.showEvoModal(uid));
        });
        card.appendChild(evoBtn);
      }

      card.addEventListener('click', () => {
        for (let r = 0; r < G.rows; r++) {
          for (let c = 0; c < G.cols; c++) {
            if (G.grid[r]?.[c] === u.id && u.alive) {
              import('../ui/InputHandler.js').then(m => m.onCell(r, c));
              return;
            }
          }
        }
      });
      el.appendChild(card);
    });
  });
}

// ── Objective panel ───────────────────────────────────────────
export function renderObjPanel() {
  const el = document.getElementById('obj');
  if (!el) return;
  const eA = Object.values(G.units).filter(u => u.o === 'enemy' && u.alive).length;
  const pA = Object.values(G.units).filter(u => u.o === 'player' && u.alive).length;
  const total = Object.values(G.units).filter(u => u.o === 'enemy').length;
  const modeLabel = { campaign:'📖 Campaign', endless:'♾ Endless', arena:'⚔ Arena' }[G.mode] || '';
  el.innerHTML = `
    <div style="font-size:8px;color:var(--purple);margin-bottom:3px">${modeLabel} T${G.floor}</div>
    <div class="ob ${eA===0?'ob-ok':''}"><span class="ob-icon">⚔</span>Tiêu diệt địch (${total-eA}/${total})</div>
    <div class="ob ${G.pCap>=G.captureGoal?'ob-ok':''}"><span class="ob-icon">⚑</span>Chiếm cứ điểm (${G.pCap}/${G.captureGoal})</div>
    <div class="ob ${pA===0?'ob-fail':''}"><span class="ob-icon">🛡</span>Bảo vệ quân (${pA})</div>
    <div class="ob ${G.ultiReady?'ob-ok':''}"><span class="ob-icon">★</span>TUYỆT CHIÊU ${G.ultiReady?'SẴN SÀNG!':'(combo×8)'}</div>`;
}

// ── Turn banner ───────────────────────────────────────────────
export function renderTurnBanner() {
  const el = document.getElementById('turn-banner');
  const rl = document.getElementById('rl');
  if (!el) return;
  el.textContent = G.turn === 'player' ? '⚡ LƯỢT YUGI' : '👺 LƯỢT BAKURA';
  el.className   = 'turn-banner ' + (G.turn === 'player' ? 'bp' : 'be');
  if (rl) rl.textContent = `Round ${G.round}`;
}

// ── Combo bar ─────────────────────────────────────────────────
export function renderCombo() {
  const pct  = Math.min(100, (G.combo / G.comboMax) * 100);
  const fill = document.getElementById('combo-fill');
  const num  = document.getElementById('combo-num');
  const ub   = document.getElementById('ulti-btn');
  if (fill) {
    fill.style.width = pct + '%';
    fill.className   = G.combo >= G.comboMax ? 'maxed' : '';
  }
  if (num) num.textContent = '×' + G.combo;
  if (ub)  ub.style.display = (G.ultiReady && G.turn === 'player') ? 'inline-block' : 'none';
}

// ── Score panel ───────────────────────────────────────────────
export function renderScorePanel() {
  const sc = document.getElementById('sc');
  const wv = document.getElementById('wv');
  const kl = document.getElementById('kl');
  if (sc) sc.textContent = G.score;
  if (wv) wv.textContent = G.round;
  if (kl) kl.textContent = G.killed.p;
}

// ── Item bar ──────────────────────────────────────────────────
export function renderItemBar() {
  const el = document.getElementById('item-bar-btns');
  if (!el) return;
  const inBattle = !G.gameOver && G.turn === 'player';
  el.innerHTML = '';

  ['hp_potion','mp_potion'].forEach(k => {
    const it  = ITEMS[k];
    const qty = P.inventory[k] || 0;
    const btn = document.createElement('span');
    btn.className = 'ibbtn' + ((!inBattle || qty === 0) ? ' empty' : '');
    btn.textContent = k === 'hp_potion' ? `${it.e}HP ×${qty}` : `${it.e}MP ×${qty}`;
    btn.title = it.desc;
    if (inBattle && qty > 0) {
      btn.onclick = () => import('../features/BattleItems.js').then(m => m.usePotionInBattle(k));
    }
    el.appendChild(btn);
  });

  const stone = P.inventory.evo_stone || 0;
  const si = document.createElement('span');
  si.className = 'ibbtn empty';
  si.textContent = `💎×${stone}`;
  si.title = 'Đá Tiến Hóa - cần để tiến hóa quái';
  el.appendChild(si);
}

// ── Unit detail (right panel) ─────────────────────────────────
export function renderUnitDetail(u) {
  const el = document.getElementById('ud');
  if (!el) return;
  if (!u) {
    el.innerHTML = '<div style="color:#333;font-size:10px;text-align:center;padding:16px 0">Chọn quân để xem</div>';
    return;
  }

  const pos   = findU(u.id);
  const t     = pos ? (G.activeMap[pos[0]]?.[pos[1]] || 'plains') : 'plains';
  const td    = TERRAIN[t] || TERRAIN.plains;
  const shld  = u.status.some(s => s.type === 'shield');
  const bsk   = u.status.some(s => s.type === 'berserk');
  const spdUp = u.status.some(s => s.type === 'speedup');
  const eAtk  = Math.floor(u.atk * (bsk ? 1.5 : 1));
  const eDef  = u.def + td.def + (shld ? 5 : 0);
  const eSpd  = Math.max(1, u.spd - td.spd + (spdUp ? 2 : 0));
  const stHtml = u.status.map(s => {
    const sd = STATUS[s.type]; if (!sd) return '';
    return `<span style="color:${sd.color}" title="${sd.desc}">${sd.icon}${s.turns}t</span>`;
  }).join(' ');

  const xpNeed = u.lv * 30;
  const xpPct  = Math.min(100, (u.xp / xpNeed) * 100);
  const hasStone   = (P.inventory.evo_stone || 0) > 0;
  const hasEvoPaths = !!(EVOLUTIONS[u.id]);
  const eIcon = u.elem ? (ELEM_ICONS[u.elem] || '') : '';
  const eClr  = u.elem ? (ELEM_COLORS[u.elem] || '#888') : '#888';

  let html = '';
  html += `<div class="dp ${u.evolved ? 'dp-evolved' : ''}">${u.e}</div>`;
  html += `<div class="dn">${u.n}${u.evolved ? ' ★' : ''}</div>`;
  html += `<div style="text-align:center;margin-bottom:2px;font-size:10px;color:${eClr}">${eIcon} ${u.elem}</div>`;
  if (stHtml) html += `<div style="text-align:center;margin-bottom:3px;font-size:11px">${stHtml}</div>`;

  html += '<div class="dsg">';
  html += `<div class="dsi"><div class="dsil">HP</div><div class="dsiv" style="color:#ff6666">${u.curHp}/${u.hp}</div></div>`;
  html += `<div class="dsi"><div class="dsil">MP</div><div class="dsiv" style="color:#6699ff">${u.curMp}/${u.mp}</div></div>`;
  html += `<div class="dsi"><div class="dsil">ATK</div><div class="dsiv">${eAtk}${eAtk!==u.atk?'*':''}</div></div>`;
  html += `<div class="dsi"><div class="dsil">DEF</div><div class="dsiv">${eDef}${eDef!==u.def?'*':''}</div></div>`;
  html += `<div class="dsi"><div class="dsil">SPD</div><div class="dsiv">${eSpd}${eSpd!==u.spd?'*':''}</div></div>`;
  html += `<div class="dsi"><div class="dsil">LV</div><div class="dsiv" style="color:var(--gold)">${u.lv}</div></div>`;
  html += '</div>';

  if (u.o === 'player') {
    html += `<div style="font-size:8px;color:#444;margin-bottom:1px">XP: ${u.xp}/${xpNeed}</div>`;
    html += `<div class="mb mb-xp" style="margin-bottom:6px"><div class="mbf" style="width:${xpPct}%"></div></div>`;
  }

  // Evo section
  if (u.o === 'player' && hasEvoPaths && !u.evolved) {
    if (u.evoReady && hasStone) {
      html += `<button class="evo-panel-btn" id="evo-detail-btn">✨ TIẾN HÓA! (${EVOLUTIONS[u.id].length} hướng)</button>`;
    } else if (u.evoReady && !hasStone) {
      html += `<div class="evo-panel-info ready">✨ Sẵn sàng tiến hóa!<br>⚠ Cần 1 💎 Đá Tiến Hóa</div>`;
    } else {
      html += `<div class="evo-panel-info">🔒 Tiến hóa: LV10 + 1 💎<br>LV hiện tại: ${u.lv}/10</div>`;
    }
  }

  // Skills
  html += '<div style="font-size:9px;color:#444;margin-bottom:3px;letter-spacing:1px">✦ KỸ NĂNG</div>';
  u.sk.forEach(sid => {
    const sk = SKILLS[sid]; if (!sk) return;
    const canUse = u.curMp >= sk.mp && !u.usedSkill && u.alive && G.turn === 'player' && u.o === 'player';
    const isUlti = !!sk.ulti;
    const isActive = G.activeSk === sid;
    const seClr  = sk.elem ? (ELEM_COLORS[sk.elem] || '') : '#444';
    const seIcon = sk.elem ? (ELEM_ICONS[sk.elem] || '') : '';
    html += `<button class="skbt${isActive?' aski':''}${canUse?'':' nomp'}${isUlti?' ulti-skill':''}"
      data-skid="${sid}" data-uid="${u.id}">
      <span class="ski">${sk.i}</span>
      <div style="flex:1">
        <div class="skn">${sk.n}${isUlti?' 🌟':''} <span style="color:${seClr}">${seIcon}</span></div>
        <div class="skd">${sk.d}</div>
      </div>
      <div class="skc">${isUlti ? 'ULTI' : sk.mp+'MP'}</div>
    </button>`;
  });

  el.innerHTML = html;

  // Attach event listeners
  const evoBtn = el.querySelector('#evo-detail-btn');
  if (evoBtn) {
    const uid = u.id;
    evoBtn.addEventListener('click', () => {
      import('../features/Evolution.js').then(m => m.showEvoModal(uid));
    });
  }
  el.querySelectorAll('.skbt[data-skid]').forEach(btn => {
    const sid  = btn.dataset.skid;
    const uid2 = btn.dataset.uid;
    btn.addEventListener('click', () => {
      import('../ui/InputHandler.js').then(m => m.pickSkill(uid2, sid));
    });
  });
}

// ── Ultimate overlay ──────────────────────────────────────────
export function showUltiOverlay(u, sk) {
  const ov = document.getElementById('ulti-overlay');
  const tt = document.getElementById('ulti-title');
  const sb = document.getElementById('ulti-sub');
  if (!ov || !tt) return;
  tt.textContent = `${u.e} ${sk.n}`;
  if (sb) sb.textContent = sk.d;
  ov.classList.add('show');
  setTimeout(() => ov.classList.remove('show'), 1800);
}

// ── Activate ultimate from button ─────────────────────────────
export function activateUlti() {
  if (!G.ultiReady || G.turn !== 'player' || G.gameOver) return;
  // Find player unit with an ulti skill
  const ultiUnit = Object.values(G.units).find(u =>
    u.o === 'player' && u.alive && u.sk.some(sid => SKILLS[sid]?.ulti)
  );
  if (!ultiUnit) return;
  const ultiSkId = ultiUnit.sk.find(sid => SKILLS[sid]?.ulti);
  const pos = findU(ultiUnit.id);
  if (!pos) return;
  import('../combat/combat.js').then(m => m.execSkill(pos, pos, ultiSkId));
}
