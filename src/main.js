// ═══════════════════════════════════════════════════════════════
// Monster World V5.1 Mobile — Main Entry Point
// Wires all modules + mobile event handlers
// ═══════════════════════════════════════════════════════════════

import { P, loadPlayer, initFreshPlayer, updateGlobalHeader } from './core/playerState.js';
import { switchTab, renderAccountTab, renderInventoryDisplay } from './ui/Tabs.js';
import { renderItemShop, openGacha, closeGachaResult } from './features/Shop.js';
import { renderRosterTab, renderPokedex } from './features/Roster.js';
import { showEvoModal, closeEvoModal } from './features/Evolution.js';
import { showModeSelect, hideModeSelect, startSession, dismissEndlessReward } from './systems/SessionManager.js';
import { endTurn, cancelAct } from './systems/TurnSystem.js';
import { activateUlti, closeMobUd, toggleMobLog, calcBoardSize, isMobile } from './ui/Renderer.js';
import { createAccount, renamePlayer } from './core/playerState.js';
import { toast } from './ui/UIHelpers.js';

// ─── Expose all functions for HTML onclick ────────────────────
window.switchTab            = switchTab;
window.openGacha            = openGacha;
window.closeGachaResult     = closeGachaResult;
window.showEvoModal         = showEvoModal;
window.closeEvoModal        = closeEvoModal;
window.showModeSelect       = showModeSelect;
window.hideModeSelect       = hideModeSelect;
window.startSession         = startSession;
window.dismissEndlessReward = dismissEndlessReward;
window.endTurn              = endTurn;
window.cancelAct            = cancelAct;
window.activateUlti         = activateUlti;
window.createAccount        = createAccount;
window.renamePlayer         = renamePlayer;
window.closeMobUd           = closeMobUd;
window.toggleMobLog         = toggleMobLog;

window.closeGameOverGoShop = () => {
  document.getElementById('go-overlay')?.classList.remove('show');
  switchTab('shop');
};
window.resetGame = () => {
  document.getElementById('go-overlay')?.classList.remove('show');
  document.getElementById('evo-modal')?.classList.remove('show');
  document.getElementById('ulti-overlay')?.classList.remove('show');
  document.getElementById('mob-ud-overlay')?.classList.remove('open');
  document.getElementById('mob-log-panel')?.classList.remove('log-open');
  const aiBar = document.getElementById('ai-bar');
  if (aiBar) aiBar.style.display = 'none';
  document.querySelectorAll('.cancel-btn-all').forEach(b => b.style.display='none');
  document.getElementById('log') && (document.getElementById('log').innerHTML = '');
  document.getElementById('mob-log-content') && (document.getElementById('mob-log-content').innerHTML='');
  showModeSelect();
};

// ─── Resize handler: recalculate board on orientation change ──
let _resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    calcBoardSize();
  }, 120);
});
window.addEventListener('orientationchange', () => {
  setTimeout(calcBoardSize, 350);
});

// ─── Mobile: swipe-down to close unit overlay ─────────────────
(function initMobileGestures() {
  const overlay = document.getElementById('mob-ud-overlay');
  if (!overlay) return;
  let startY = 0;
  overlay.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, { passive:true });
  overlay.addEventListener('touchend', e => {
    const dy = e.changedTouches[0].clientY - startY;
    if (dy > 60) closeMobUd(); // swipe down 60px to close
  }, { passive:true });
})();

// ─── Mobile: tap outside overlay to close ────────────────────
document.addEventListener('click', e => {
  const overlay = document.getElementById('mob-ud-overlay');
  if (!overlay || !overlay.classList.contains('open')) return;
  if (!overlay.contains(e.target)) closeMobUd();
}, { capture: false });

// ─── Boot ─────────────────────────────────────────────────────
(function init() {
  const hasSave = loadPlayer();

  if (hasSave) {
    updateGlobalHeader();
    renderItemShop();
    renderRosterTab();
    renderPokedex();
  } else {
    initFreshPlayer('Yugi');
    document.getElementById('name-modal')?.classList.add('show');
  }

  switchTab('battle');
  setTimeout(() => showModeSelect(), 300);

  // Initial board size calc
  calcBoardSize();
})();
