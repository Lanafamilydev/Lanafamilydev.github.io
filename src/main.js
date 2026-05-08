// ═══════════════════════════════════════════════════════════════
// Monster World V5.1 — Main Entry Point
// Boots the application, wires globals for HTML onclick handlers
// ═══════════════════════════════════════════════════════════════

import { P, loadPlayer, initFreshPlayer, updateGlobalHeader } from './core/playerState.js';
import { switchTab, renderAccountTab, renderInventoryDisplay } from './ui/Tabs.js';
import { renderItemShop, openGacha, closeGachaResult } from './features/Shop.js';
import { renderRosterTab, renderPokedex } from './features/Roster.js';
import { showEvoModal, closeEvoModal } from './features/Evolution.js';
import { showModeSelect, hideModeSelect, startSession, dismissEndlessReward } from './systems/SessionManager.js';
import { endTurn, cancelAct } from './systems/TurnSystem.js';
import { activateUlti } from './ui/Renderer.js';
import { createAccount, renamePlayer } from './core/playerState.js';
import { toast, addLog, addLogSep } from './ui/UIHelpers.js';

// ─── Expose all functions needed by HTML onclick attributes ───

window.switchTab       = switchTab;
window.openGacha       = openGacha;
window.closeGachaResult= closeGachaResult;
window.showEvoModal    = showEvoModal;
window.closeEvoModal   = closeEvoModal;
window.showModeSelect  = showModeSelect;
window.hideModeSelect  = hideModeSelect;
window.startSession    = startSession;
window.dismissEndlessReward = dismissEndlessReward;
window.endTurn         = endTurn;
window.cancelAct       = cancelAct;
window.activateUlti    = activateUlti;
window.createAccount   = createAccount;
window.renamePlayer    = renamePlayer;
window.closeGameOverGoShop = () => {
  document.getElementById('go-overlay')?.classList.remove('show');
  switchTab('shop');
};
window.resetGame = () => {
  document.getElementById('go-overlay')?.classList.remove('show');
  document.getElementById('evo-modal')?.classList.remove('show');
  document.getElementById('ulti-overlay')?.classList.remove('show');
  document.getElementById('ai-bar') && (document.getElementById('ai-bar').style.display = 'none');
  document.getElementById('cancel-btn') && (document.getElementById('cancel-btn').style.display = 'none');
  document.getElementById('log') && (document.getElementById('log').innerHTML = '');
  showModeSelect();
};

// ─── Boot ─────────────────────────────────────────────────────

(function init() {
  const hasSave = loadPlayer();

  if (hasSave) {
    updateGlobalHeader();
    renderItemShop();
    renderRosterTab();
  } else {
    initFreshPlayer('Yugi');
    document.getElementById('name-modal')?.classList.add('show');
  }

  // Default: show battle tab with mode selector ready
  switchTab('battle');

  // Show mode select immediately so player chooses how to play
  setTimeout(() => showModeSelect(), 300);
})();
