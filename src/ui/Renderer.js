// ═══════════════════════════════════════════════════════════════
// Monster World V5.1 Mobile — Renderer Module
// Responsive rendering: desktop panels + mobile overlays
// ═══════════════════════════════════════════════════════════════

import { G } from '../core/gameState.js';
import { P } from '../core/playerState.js';
import {
  TERRAIN, STATUS, SKILLS, EVOLUTIONS,
  ELEM_ICONS, ELEM_COLORS, ITEMS,
} from '../core/data.js';
import { findU } from '../combat/movement.js';

// ── Mobile detection ──────────────────────────────────────────
export function isMobile() {
  // visualViewport.width handles mobile browser chrome / keyboard correctly
  const w = window.visualViewport ? window.visualViewport.width : window.innerWidth;
  return w < 768;
}

// ── Log badge counter (mobile) ────────────────────────────────
let _newLogCount = 0;
let _logPanelOpen = false;

// ── Master render ─────────────────────────────────────────────
export function render() {
  renderBoard();
  renderCards();
  renderObjPanel();
  renderTurnBanner();
  renderCombo();
  renderScorePanel();
  renderItemBar();
  if (isMobile()) {
    renderMobUnitStrip();
    syncMobHud();
  }
}

// ── Board sizing ──────────────────────────────────────────────
export function calcBoardSize() {
  const bd = document.getElementById('board');
  if (!bd) return;
  if (!isMobile()) {
    // Desktop: clear any inline dimensions set by a previous mobile session
    bd.style.width    = '';
    bd.style.height   = '';
    bd.style.maxWidth = '520px';
    // Guarantee body has no bottom padding on desktop
    document.body.style.paddingBottom = '0';
    return;
  }
  // Available height = viewport - header - bottom nav - hud - strip - actions - itembar - padding
  const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  const RESERVED = 36  // g-hdr
                 + 56  // mob-nav
                 + 44  // mob-hud rows
                 + 44  // mob-unit-strip
                 + 40  // mob-actions
                 + 34  // item-bar
                 + 20; // gap / padding

  const maxH = Math.max(100, vh - RESERVED);
  const maxW = window.innerWidth * 0.98;
  const side = Math.min(maxW, maxH);
  bd.style.width  = side + 'px';
  bd.style.height = side + 'px';
}

// ── Board ─────────────────────────────────────────────────────
export function renderBoard() {
  const bd = document.getElementById('board');
  if (!bd) return;
  bd.innerHTML = '';
  bd.style.gridTemplateColumns = `repeat(${G.cols}, 1fr)`;
  bd.style.touchAction = 'manipulation';

  // Resize on mobile
  calcBoardSize();

  for (let r = 0; r < G.rows; r++) {
    for (let c = 0; c < G.cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';

      const t  = G.activeMap[r]?.[c] || 'plains';
      const td = TERRAIN[t] || TERRAIN.plains;
      if (td.cls) cell.classList.add(td.cls);

      if (G.sel && G.sel[0]===r && G.sel[1]===c)        cell.classList.add('sel');
      else if (G.reach.some(([a,b]) => a===r && b===c)) cell.classList.add('mv');
      else if (G.atkbl.some(([a,b]) => a===r && b===c)) cell.classList.add('atk');
      else if (G.skTgts.some(([a,b]) => a===r && b===c))cell.classList.add('sk');

      const ck = `${r},${c}`;
      if (G.captures[ck] !== undefined) {
        const f = document.createElement('div');
        f.className = 'cflag ' + G.captures[ck];
        cell.appendChild(f);
      }

      const uid = G.grid[r]?.[c];
      if (uid) {
        const u = G.units[uid];
        if (u?.alive) {
          const uw = document.createElement('div');
          uw.className = 'uw ' + (u.o==='enemy' ? 'u-enemy' : 'u-player')
                       + (u.evolved ? ' u-evolved' : '');
          const ex = (u.moved && u.attacked) || (u.o==='enemy' && G.turn==='player');
          if (ex) uw.classList.add('exhausted');

          const em = document.createElement('span');
          em.className = 'ue';
          em.textContent = u.e;
          uw.appendChild(em);

          if (u.status.length) {
            const si = document.createElement('div');
            si.className = 'cst';
            si.textContent = u.status.slice(0,2).map(s=>STATUS[s.type]?.icon||'').join('');
            uw.appendChild(si);
          }
          cell.appendChild(uw);

          const hb = document.createElement('div'); hb.className = 'chp';
          const hf = document.createElement('div'); hf.className = 'chpf';
          const hp = u.curHp / u.hp;
          hf.style.width = Math.max(0, hp*100) + '%';
          hf.style.background = hp>0.5 ? '#e03030' : hp>0.25 ? '#ff8800' : '#ff2222';
          hb.appendChild(hf); cell.appendChild(hb);

          const lv = document.createElement('div'); lv.className='clv'; lv.textContent=u.lv;
          cell.appendChild(lv);

          if (u.evoReady && !u.evolved && u.o==='player') {
            const eb = document.createElement('div'); eb.className='cevo'; eb.textContent='✨';
            cell.appendChild(eb);
            cell.classList.add('evo-ready');
          }
          if (u.elem && u.elem!=='neutral') {
            const el2 = document.createElement('div'); el2.className='celem';
            el2.textContent = ELEM_ICONS[u.elem]||''; el2.title=u.elem;
            cell.appendChild(el2);
          }
        }
      }

      cell.addEventListener('click', () => {
        import('./InputHandler.js').then(m => m.onCell(r, c));
      });
      bd.appendChild(cell);
    }
  }
}

// ── Unit cards (left/right desktop panels) ────────────────────
export function renderCards() {
  ['player','enemy'].forEach(own => {
    const el = document.getElementById(own==='player' ? 'pc' : 'ec');
    if (!el) return;
    el.innerHTML = '';

    Object.values(G.units).filter(u => u.o===own).forEach(u => {
      const card = document.createElement('div');
      card.className = 'uc' + (u.alive?'':' dead') + (u.evolved?' evolved-card':'');
      const isSel = G.sel && G.grid[G.sel[0]]?.[G.sel[1]]===u.id;
      if (isSel) card.classList.add('act');

      const si     = u.status.map(s=>STATUS[s.type]?.icon||'').join('');
      const xpPct  = Math.min(100,(u.xp/(u.lv*30))*100);
      const hasStone = (P.inventory.evo_stone||0)>0;
      const showEvo  = u.evoReady && !u.evolved && u.o==='player';

      card.innerHTML =
        '<div class="uct">' +
          `<span>${u.e}</span>` +
          `<span class="ucn">${u.n}${u.evolved?'★':''}</span>` +
          `<span class="ucl">L${u.lv}</span>` +
          `<span style="font-size:9px">${si}</span>` +
          (showEvo?'<span style="color:var(--gold);font-size:9px;animation:evo-btn-pulse .8s infinite alternate">✨</span>':'') +
        '</div>' +
        '<div class="ucb">' +
          `<div class="mb mb-hp"><div class="mbf" style="width:${Math.max(0,u.curHp/u.hp*100)}%"></div></div>` +
          `<div class="mb mb-mp"><div class="mbf" style="width:${Math.max(0,u.curMp/u.mp*100)}%"></div></div>` +
          (own==='player'?`<div class="mb mb-xp"><div class="mbf" style="width:${xpPct}%"></div></div>`:'') +
        '</div>' +
        `<div class="ucs">${u.curHp}/${u.hp}HP · ${u.curMp}/${u.mp}MP</div>`;

      if (showEvo && hasStone) {
        const evoBtn = document.createElement('button');
        evoBtn.className = 'evo-card-btn';
        evoBtn.textContent = '✨ EVO';
        const uid = u.id;
        evoBtn.addEventListener('click', e => {
          e.stopPropagation();
          import('../features/Evolution.js').then(m => m.showEvoModal(uid));
        });
        card.appendChild(evoBtn);
      }
      card.addEventListener('click', () => {
        for (let r=0; r<G.rows; r++) {
          for (let c=0; c<G.cols; c++) {
            if (G.grid[r]?.[c]===u.id && u.alive) {
              import('./InputHandler.js').then(m => m.onCell(r,c));
              return;
            }
          }
        }
      });
      el.appendChild(card);
    });
  });
}

// ── Mobile unit strip ─────────────────────────────────────────
export function renderMobUnitStrip() {
  const pEl = document.getElementById('mob-pc-strip');
  const eEl = document.getElementById('mob-ec-strip');
  if (!pEl || !eEl) return;

  const fill = (container, own) => {
    container.innerHTML = '';
    Object.values(G.units).filter(u => u.o===own).forEach(u => {
      const chip = document.createElement('div');
      const isSel = G.sel && G.grid[G.sel[0]]?.[G.sel[1]]===u.id;
      chip.className = 'mob-unit-chip'
        + (u.alive ? '' : ' dead-chip')
        + (isSel ? ' active-chip' : '')
        + (own==='enemy' ? ' enemy-chip' : '');

      const hp = document.createElement('div'); hp.className='mob-chip-hp';
      const hf = document.createElement('div'); hf.className='mob-chip-hpf';
      const pct = Math.max(0, u.curHp/u.hp*100);
      hf.style.width = pct+'%';
      hf.style.background = pct>50?'#e03030':pct>25?'#ff8800':'#ff2222';
      hp.appendChild(hf);

      const lv = document.createElement('span'); lv.className='mob-chip-lv'; lv.textContent=u.lv;

      chip.innerHTML = `<span class="mob-chip-emoji">${u.e}</span>`;
      chip.appendChild(hp);
      chip.appendChild(lv);

      chip.addEventListener('click', () => {
        for (let r=0; r<G.rows; r++) {
          for (let c=0; c<G.cols; c++) {
            if (G.grid[r]?.[c]===u.id && u.alive) {
              import('./InputHandler.js').then(m => m.onCell(r,c));
              return;
            }
          }
        }
        // Enemy or dead — just show detail
        renderUnitDetail(u);
      });
      container.appendChild(chip);
    });
  };

  fill(pEl, 'player');
  fill(eEl, 'enemy');
}

// ── Objective panel (desktop) ─────────────────────────────────
export function renderObjPanel() {
  const el = document.getElementById('obj');
  if (!el) return;
  const eA = Object.values(G.units).filter(u=>u.o==='enemy'&&u.alive).length;
  const pA = Object.values(G.units).filter(u=>u.o==='player'&&u.alive).length;
  const total = Object.values(G.units).filter(u=>u.o==='enemy').length;
  const modeLabel = {campaign:'📖 Campaign',endless:'♾ Endless',arena:'⚔ Arena'}[G.mode]||'';
  el.innerHTML = `
    <div style="font-size:8px;color:var(--purple);margin-bottom:3px">${modeLabel} T${G.floor}</div>
    <div class="ob ${eA===0?'ob-ok':''}"><span class="ob-icon">⚔</span>Tiêu diệt (${total-eA}/${total})</div>
    <div class="ob ${G.pCap>=G.captureGoal?'ob-ok':''}"><span class="ob-icon">⚑</span>Chiếm cứ điểm (${G.pCap}/${G.captureGoal})</div>
    <div class="ob ${pA===0?'ob-fail':''}"><span class="ob-icon">🛡</span>Bảo vệ quân (${pA})</div>
    <div class="ob ${G.ultiReady?'ob-ok':''}"><span class="ob-icon">★</span>TUYỆT CHIÊU ${G.ultiReady?'SẴN SÀNG!':'(combo×8)'}</div>`;
}

// ── Turn banner ───────────────────────────────────────────────
export function renderTurnBanner() {
  // Desktop
  const el = document.getElementById('turn-banner');
  const rl = document.getElementById('rl');
  if (el) { el.textContent = G.turn==='player'?'⚡ LƯỢT YUGI':'👺 LƯỢT BAKURA'; el.className='turn-banner '+(G.turn==='player'?'bp':'be'); }
  if (rl) rl.textContent = `Round ${G.round}`;

  // Mobile
  const mbt = document.getElementById('mob-turn-banner');
  const mrl = document.getElementById('mob-rl');
  if (mbt) { mbt.textContent=G.turn==='player'?'⚡ YUGI':'👺 BAKURA'; mbt.className='mob-tb '+(G.turn==='player'?'bp':'be'); }
  if (mrl) mrl.textContent='R'+G.round;
}

// ── Combo bar ─────────────────────────────────────────────────
export function renderCombo() {
  const pct = Math.min(100,(G.combo/G.comboMax)*100);
  // Desktop
  const fill = document.getElementById('combo-fill');
  const num  = document.getElementById('combo-num');
  const ub   = document.getElementById('ulti-btn');
  if (fill) { fill.style.width=pct+'%'; fill.className=G.combo>=G.comboMax?'maxed':''; }
  if (num)  num.textContent = '×'+G.combo;
  if (ub)   ub.style.display = (G.ultiReady&&G.turn==='player')?'inline-block':'none';

  // Mobile
  const mfill = document.getElementById('mob-combo-fill');
  const mnum  = document.getElementById('mob-combo-num');
  const mub   = document.getElementById('mob-ulti-btn');
  if (mfill) { mfill.style.width=pct+'%'; mfill.className=G.combo>=G.comboMax?'maxed':''; }
  if (mnum)  mnum.textContent = '×'+G.combo;
  if (mub)   mub.style.display = (G.ultiReady&&G.turn==='player')?'inline-block':'none';
}

// ── Score panel ───────────────────────────────────────────────
export function renderScorePanel() {
  const sc=document.getElementById('sc'); if(sc) sc.textContent=G.score;
  const wv=document.getElementById('wv'); if(wv) wv.textContent=G.round;
  const kl=document.getElementById('kl'); if(kl) kl.textContent=G.killed.p;
  // Mobile
  const msc=document.getElementById('mob-sc'); if(msc) msc.textContent='⭐'+G.score;
  const mkl=document.getElementById('mob-kl'); if(mkl) mkl.textContent='💀'+G.killed.p;
}

// ── Mobile HUD objective strip ────────────────────────────────
export function syncMobHud() {
  const objRow = document.getElementById('mob-obj-row');
  if (!objRow) return;
  const eA = Object.values(G.units).filter(u=>u.o==='enemy'&&u.alive).length;
  const pA = Object.values(G.units).filter(u=>u.o==='player'&&u.alive).length;
  const total = Object.values(G.units).filter(u=>u.o==='enemy').length;
  objRow.innerHTML =
    `<span class="mob-obj-item${eA===0?' ok':''}">⚔${total-eA}/${total}</span>` +
    `<span class="mob-obj-item${G.pCap>=G.captureGoal?' ok':''}">⚑${G.pCap}/${G.captureGoal}</span>` +
    `<span class="mob-obj-item${pA===0?' fail':''}">🛡${pA}</span>`;
}

// ── Item bar ──────────────────────────────────────────────────
export function renderItemBar() {
  const el = document.getElementById('item-bar-btns');
  if (!el) return;
  const inBattle = !G.gameOver && G.turn==='player';
  el.innerHTML = '';

  ['hp_potion','mp_potion'].forEach(k => {
    const it  = ITEMS[k];
    const qty = P.inventory[k] || 0;
    const btn = document.createElement('span');
    btn.className = 'ibbtn' + ((!inBattle||qty===0)?' empty':'');
    btn.textContent = k==='hp_potion' ? `${it.e}HP ×${qty}` : `${it.e}MP ×${qty}`;
    btn.title = it.desc;
    if (inBattle && qty>0)
      btn.onclick = () => import('../features/BattleItems.js').then(m => m.usePotionInBattle(k));
    el.appendChild(btn);
  });

  const stone = P.inventory.evo_stone || 0;
  const si = document.createElement('span');
  si.className = 'ibbtn empty';
  si.textContent = `💎×${stone}`;
  si.title = 'Đá Tiến Hóa';
  el.appendChild(si);
}

// ══════════════════════════════════════════════════════════════
// UNIT DETAIL — desktop panel + mobile overlay
// ══════════════════════════════════════════════════════════════

export function renderUnitDetail(u) {
  if (isMobile()) {
    renderUnitDetailMobile(u);
  } else {
    renderUnitDetailDesktop(u);
  }
}

// ── Desktop unit detail ───────────────────────────────────────
function renderUnitDetailDesktop(u) {
  const el = document.getElementById('ud');
  if (!el) return;
  if (!u) {
    el.innerHTML = '<div style="color:#333;font-size:10px;text-align:center;padding:16px 0">Chọn quân để xem</div>';
    return;
  }
  el.innerHTML = _buildDetailHTML(u, 'desktop');
  _attachDetailEvents(el, u);
}

// ── Mobile unit detail ────────────────────────────────────────
function renderUnitDetailMobile(u) {
  const overlay = document.getElementById('mob-ud-overlay');
  if (!overlay) return;

  if (!u) {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden','true');
    return;
  }

  // Populate fields
  const pos   = findU(u.id);
  const t     = pos ? (G.activeMap[pos[0]]?.[pos[1]]||'plains') : 'plains';
  const td    = TERRAIN[t] || TERRAIN.plains;
  const shld  = u.status.some(s=>s.type==='shield');
  const bsk   = u.status.some(s=>s.type==='berserk');
  const spdUp = u.status.some(s=>s.type==='speedup');
  const eAtk  = Math.floor(u.atk*(bsk?1.5:1));
  const eDef  = u.def+td.def+(shld?5:0);
  const eSpd  = Math.max(1,u.spd-td.spd+(spdUp?2:0));
  const eIcon = u.elem?(ELEM_ICONS[u.elem]||''):'';
  const eClr  = u.elem?(ELEM_COLORS[u.elem]||'#888'):'#888';
  const stHtml = u.status.map(s=>{ const sd=STATUS[s.type]; return sd?`<span style="color:${sd.color}">${sd.icon}${s.turns}t</span>`:'';}).join(' ');
  const xpNeed = u.lv*30;
  const xpPct  = Math.min(100,(u.xp/xpNeed)*100);
  const hasStone   = (P.inventory.evo_stone||0)>0;
  const hasEvoPaths = !!(EVOLUTIONS[u.id]);

  // Emoji + glow
  const emojiEl = document.getElementById('mob-ud-emoji');
  if (emojiEl) {
    emojiEl.textContent = u.e;
    emojiEl.style.filter = u.evolved
      ? 'drop-shadow(0 0 8px var(--gold)) drop-shadow(0 0 20px rgba(255,200,0,.5))'
      : u.o==='player'
        ? 'drop-shadow(0 0 5px rgba(50,140,255,.8))'
        : 'drop-shadow(0 0 5px rgba(220,40,60,.8))';
  }

  const nameEl = document.getElementById('mob-ud-name');
  if (nameEl) nameEl.textContent = `${u.n}${u.evolved?'★':''}  LV${u.lv}`;

  const elemEl = document.getElementById('mob-ud-elem-status');
  if (elemEl) elemEl.innerHTML = `<span style="color:${eClr}">${eIcon} ${u.elem}</span>` + (stHtml ? `&nbsp;${stHtml}` : '');

  const setMud = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  setMud('mob-ud-hp', `${u.curHp}/${u.hp}`);
  setMud('mob-ud-mp', `${u.curMp}/${u.mp}`);
  setMud('mob-ud-atk', eAtk+(eAtk!==u.atk?'*':''));
  setMud('mob-ud-def', eDef+(eDef!==u.def?'*':''));
  setMud('mob-ud-spd', eSpd+(eSpd!==u.spd?'*':''));
  setMud('mob-ud-lv', u.lv);

  // XP bar
  const xpRow = document.getElementById('mob-ud-xp-row');
  if (xpRow && u.o==='player') {
    xpRow.innerHTML = `<div style="display:flex;align-items:center;gap:4px">
      <span>XP ${u.xp}/${xpNeed}</span>
      <div style="flex:1;height:4px;background:#111;border-radius:2px;overflow:hidden;border:1px solid #222">
        <div style="width:${xpPct}%;height:100%;background:var(--gold);border-radius:2px"></div>
      </div></div>`;
  } else if (xpRow) xpRow.innerHTML='';

  // Evo button
  const evoRow = document.getElementById('mob-ud-evo-btn-row');
  if (evoRow) {
    if (u.o==='player' && hasEvoPaths && !u.evolved) {
      if (u.evoReady && hasStone) {
        const uid = u.id;
        evoRow.innerHTML = `<button class="evo-panel-btn" id="mob-evo-btn">✨ TIẾN HÓA! (${EVOLUTIONS[u.id].length} hướng)</button>`;
        evoRow.querySelector('#mob-evo-btn').onclick = () =>
          import('../features/Evolution.js').then(m => m.showEvoModal(uid));
      } else if (u.evoReady) {
        evoRow.innerHTML = `<div class="evo-panel-info ready">✨ Cần 1 💎 Đá Tiến Hóa</div>`;
      } else {
        evoRow.innerHTML = `<div class="evo-panel-info">🔒 Tiến hóa LV10 + 💎  (hiện LV${u.lv})</div>`;
      }
    } else evoRow.innerHTML='';
  }

  // Skills
  const skEl = document.getElementById('mob-ud-skills');
  if (skEl) {
    skEl.innerHTML='';
    u.sk.forEach(sid => {
      const sk=SKILLS[sid]; if(!sk) return;
      const canUse = u.curMp>=sk.mp && !u.usedSkill && u.alive && G.turn==='player' && u.o==='player';
      const isUlti = !!sk.ulti;
      const isActive = G.activeSk===sid;
      const seClr  = sk.elem?(ELEM_COLORS[sk.elem]||''):'#444';
      const seIcon = sk.elem?(ELEM_ICONS[sk.elem]||''):'';
      const btn = document.createElement('button');
      btn.className = `skbt${isActive?' aski':''}${canUse?'':' nomp'}${isUlti?' ulti-skill':''}`;
      btn.dataset.skid = sid;
      btn.dataset.uid  = u.id;
      btn.innerHTML =
        `<span class="ski">${sk.i}</span>` +
        `<div style="flex:1"><div class="skn">${sk.n}${isUlti?' 🌟':''} <span style="color:${seClr}">${seIcon}</span></div>` +
        `<div class="skd">${sk.d}</div></div>` +
        `<div class="skc">${isUlti?'ULTI':sk.mp+'MP'}</div>`;
      btn.addEventListener('click', () =>
        import('./InputHandler.js').then(m => m.pickSkill(u.id, sid))
      );
      skEl.appendChild(btn);
    });
  }

  // Show overlay
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden','false');
}

/** Close mobile unit detail overlay */
export function closeMobUd() {
  const overlay = document.getElementById('mob-ud-overlay');
  if (overlay) { overlay.classList.remove('open'); overlay.setAttribute('aria-hidden','true'); }
}

// ── Ultimate overlay ──────────────────────────────────────────
export function showUltiOverlay(u, sk) {
  const ov=document.getElementById('ulti-overlay');
  const tt=document.getElementById('ulti-title');
  const sb=document.getElementById('ulti-sub');
  if (!ov||!tt) return;
  tt.textContent=`${u.e} ${sk.n}`;
  if(sb) sb.textContent=sk.d;
  ov.classList.add('show');
  setTimeout(()=>ov.classList.remove('show'),1800);
}

export function activateUlti() {
  if (!G.ultiReady||G.turn!=='player'||G.gameOver) return;
  const ultiUnit = Object.values(G.units).find(u=>u.o==='player'&&u.alive&&u.sk.some(sid=>SKILLS[sid]?.ulti));
  if (!ultiUnit) return;
  const ultiSkId = ultiUnit.sk.find(sid=>SKILLS[sid]?.ulti);
  const pos = findU(ultiUnit.id);
  if (!pos) return;
  import('../combat/combat.js').then(m=>m.execSkill(pos,pos,ultiSkId));
}

// ══════════════════════════════════════════════════════════════
// MOBILE LOG SYNC
// ══════════════════════════════════════════════════════════════

/** Mirror entries from #log to #mob-log-content */
export function syncMobLog() {
  const src  = document.getElementById('log');
  const dest = document.getElementById('mob-log-content');
  if (!src||!dest) return;
  dest.innerHTML = src.innerHTML;
  dest.scrollTop = dest.scrollHeight;
  if (!_logPanelOpen) {
    _newLogCount++;
    const badge = document.getElementById('mob-log-badge');
    if (badge) badge.classList.add('has-new');
  }
}

/** Toggle mobile log panel open/close */
export function toggleMobLog() {
  const panel = document.getElementById('mob-log-panel');
  if (!panel) return;
  _logPanelOpen = !panel.classList.contains('log-open');
  if (_logPanelOpen) {
    syncMobLog();
    _newLogCount=0;
    const badge=document.getElementById('mob-log-badge');
    if(badge) badge.classList.remove('has-new');
    panel.classList.add('log-open');
  } else {
    panel.classList.remove('log-open');
  }
}

// ══════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ══════════════════════════════════════════════════════════════

function _buildDetailHTML(u, mode) {
  const pos   = findU(u.id);
  const t     = pos?(G.activeMap[pos[0]]?.[pos[1]]||'plains'):'plains';
  const td    = TERRAIN[t]||TERRAIN.plains;
  const shld  = u.status.some(s=>s.type==='shield');
  const bsk   = u.status.some(s=>s.type==='berserk');
  const spdUp = u.status.some(s=>s.type==='speedup');
  const eAtk  = Math.floor(u.atk*(bsk?1.5:1));
  const eDef  = u.def+td.def+(shld?5:0);
  const eSpd  = Math.max(1,u.spd-td.spd+(spdUp?2:0));
  const stHtml = u.status.map(s=>{const sd=STATUS[s.type];return sd?`<span style="color:${sd.color}" title="${sd.desc}">${sd.icon}${s.turns}t</span>`:''}).join(' ');
  const xpNeed = u.lv*30;
  const xpPct  = Math.min(100,(u.xp/xpNeed)*100);
  const hasStone   = (P.inventory.evo_stone||0)>0;
  const hasEvoPaths = !!(EVOLUTIONS[u.id]);
  const eIcon = u.elem?(ELEM_ICONS[u.elem]||''):'';
  const eClr  = u.elem?(ELEM_COLORS[u.elem]||'#888'):'#888';

  let html='';
  html+=`<div class="dp ${u.evolved?'dp-evolved':''}">${u.e}</div>`;
  html+=`<div class="dn">${u.n}${u.evolved?' ★':''}</div>`;
  html+=`<div style="text-align:center;margin-bottom:2px;font-size:10px;color:${eClr}">${eIcon} ${u.elem}</div>`;
  if(stHtml) html+=`<div style="text-align:center;margin-bottom:3px;font-size:11px">${stHtml}</div>`;
  html+='<div class="dsg">';
  html+=`<div class="dsi"><div class="dsil">HP</div><div class="dsiv" style="color:#ff6666">${u.curHp}/${u.hp}</div></div>`;
  html+=`<div class="dsi"><div class="dsil">MP</div><div class="dsiv" style="color:#6699ff">${u.curMp}/${u.mp}</div></div>`;
  html+=`<div class="dsi"><div class="dsil">ATK</div><div class="dsiv">${eAtk}${eAtk!==u.atk?'*':''}</div></div>`;
  html+=`<div class="dsi"><div class="dsil">DEF</div><div class="dsiv">${eDef}${eDef!==u.def?'*':''}</div></div>`;
  html+=`<div class="dsi"><div class="dsil">SPD</div><div class="dsiv">${eSpd}${eSpd!==u.spd?'*':''}</div></div>`;
  html+=`<div class="dsi"><div class="dsil">LV</div><div class="dsiv" style="color:var(--gold)">${u.lv}</div></div>`;
  html+='</div>';
  if(u.o==='player'){
    html+=`<div style="font-size:8px;color:#444;margin-bottom:1px">XP: ${u.xp}/${xpNeed}</div>`;
    html+=`<div class="mb mb-xp" style="margin-bottom:6px"><div class="mbf" style="width:${xpPct}%"></div></div>`;
  }
  if(u.o==='player'&&hasEvoPaths&&!u.evolved){
    if(u.evoReady&&hasStone)
      html+=`<button class="evo-panel-btn" id="evo-detail-btn">✨ TIẾN HÓA! (${EVOLUTIONS[u.id].length} hướng)</button>`;
    else if(u.evoReady&&!hasStone)
      html+=`<div class="evo-panel-info ready">✨ Sẵn sàng!<br>⚠ Cần 1 💎 Đá Tiến Hóa</div>`;
    else
      html+=`<div class="evo-panel-info">🔒 Tiến hóa: LV10+💎 (${u.lv}/10)</div>`;
  }
  html+='<div style="font-size:9px;color:#444;margin-bottom:3px;letter-spacing:1px">✦ KỸ NĂNG</div>';
  u.sk.forEach(sid=>{
    const sk=SKILLS[sid]; if(!sk) return;
    const canUse=u.curMp>=sk.mp&&!u.usedSkill&&u.alive&&G.turn==='player'&&u.o==='player';
    const isUlti=!!sk.ulti; const isActive=G.activeSk===sid;
    const seClr=sk.elem?(ELEM_COLORS[sk.elem]||''):'#444';
    const seIcon=sk.elem?(ELEM_ICONS[sk.elem]||''):'';
    html+=`<button class="skbt${isActive?' aski':''}${canUse?'':' nomp'}${isUlti?' ulti-skill':''}"
      data-skid="${sid}" data-uid="${u.id}">
      <span class="ski">${sk.i}</span>
      <div style="flex:1"><div class="skn">${sk.n}${isUlti?' 🌟':''} <span style="color:${seClr}">${seIcon}</span></div>
      <div class="skd">${sk.d}</div></div>
      <div class="skc">${isUlti?'ULTI':sk.mp+'MP'}</div>
    </button>`;
  });
  return html;
}

function _attachDetailEvents(el, u) {
  const evoBtn = el.querySelector('#evo-detail-btn');
  if (evoBtn) {
    const uid=u.id;
    evoBtn.addEventListener('click', ()=>import('../features/Evolution.js').then(m=>m.showEvoModal(uid)));
  }
  el.querySelectorAll('.skbt[data-skid]').forEach(btn=>{
    const sid=btn.dataset.skid, uid2=btn.dataset.uid;
    btn.addEventListener('click',()=>import('./InputHandler.js').then(m=>m.pickSkill(uid2,sid)));
  });
}
