/**
 * visual-mode.js
 * Quan ly Che do giao tiep truc quan & Tro nang (WCAG 2.2)
 * QUY TAC BAO MAT: Chi luu trang thai trong localStorage. Khong gui DB/analytics.
 */
(function initVisualCommunicationMode() {
  if (window.__visualModeInitialized) return;
  window.__visualModeInitialized = true;

  const STORAGE_KEY_MODE = 'visualCommunicationMode';
  const STORAGE_KEY_FONT = 'visualFontScale';
  const STORAGE_KEY_MOTION = 'visualReduceMotion';

  let isModeActive = localStorage.getItem(STORAGE_KEY_MODE) === 'true';
  let fontScale = localStorage.getItem(STORAGE_KEY_FONT) || (isModeActive ? 'large' : 'standard');
  let reduceMotion = localStorage.getItem(STORAGE_KEY_MOTION) === 'true';
  let announcerEl = null;
  let toastTimeout = null;

  function ensureStylesheet() {
    if (document.getElementById('visualModeStylesheet')) return;
    const root = typeof window.getAppBasePath === 'function' ? window.getAppBasePath() : '';
    const link = document.createElement('link');
    link.id = 'visualModeStylesheet';
    link.rel = 'stylesheet';
    link.href = root + 'assets/css/visual-mode.css?v=20261029-v1';
    document.head.appendChild(link);
  }

  function createAnnouncer() {
    if (announcerEl) return;
    announcerEl = document.createElement('div');
    announcerEl.id = 'visualStatusAnnouncer';
    announcerEl.className = 'visual-status-announcer';
    announcerEl.setAttribute('role', 'status');
    announcerEl.setAttribute('aria-live', 'polite');
    announcerEl.setAttribute('aria-atomic', 'true');
    document.body.appendChild(announcerEl);
  }

  function announceStatus(message, type) {
    type = type || 'info';
    if (!message) return;
    createAnnouncer();
    if (announcerEl) {
      announcerEl.textContent = '';
      setTimeout(function() { announcerEl.textContent = message; }, 50);
    }
    if (isModeActive) {
      var existingToast = document.querySelector('.visual-status-toast');
      if (existingToast) existingToast.remove();
      clearTimeout(toastTimeout);
      var toast = document.createElement('aside');
      toast.className = 'visual-status-toast toast-' + type;
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      var icon = type === 'success' ? '\u2713' : type === 'warning' ? '\u26a0' : '\u2139';
      toast.innerHTML = '<span aria-hidden="true" style="font-weight:700;font-size:1.15rem;">' + icon + '</span><span>' + escapeHTML(message) + '</span>';
      document.body.appendChild(toast);
      toastTimeout = setTimeout(function() {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.25s ease';
        setTimeout(function() { toast.remove(); }, 260);
      }, 4200);
    }
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function(m) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
    });
  }

  function applyDOMState() {
    var root = document.documentElement;
    if (isModeActive) {
      root.setAttribute('data-visual-mode', 'true');
      root.setAttribute('data-font-scale', fontScale);
      document.body.classList.add('visual-communication-mode');
    } else {
      root.removeAttribute('data-visual-mode');
      root.removeAttribute('data-font-scale');
      document.body.classList.remove('visual-communication-mode');
    }
    var marqueeGroups = document.querySelectorAll('.promotion-marquee-group');
    marqueeGroups.forEach(function(group) {
      group.style.animationPlayState = (isModeActive || reduceMotion) ? 'paused' : 'running';
    });
    syncControlUI();
    window.dispatchEvent(new CustomEvent('visualModeChanged', {
      detail: { active: isModeActive, fontScale: fontScale, reduceMotion: reduceMotion }
    }));
  }

  function syncControlUI() {
    var headerBtns = document.querySelectorAll('.visual-mode-header-btn');
    headerBtns.forEach(function(btn) {
      btn.setAttribute('aria-pressed', String(isModeActive));
      btn.classList.toggle('is-active', isModeActive);
      var copyEl = btn.querySelector('.header-action-copy strong');
      if (copyEl) copyEl.textContent = isModeActive ? 'Dang bat' : 'Truc quan';
    });
    var toggleInputs = document.querySelectorAll('.visual-mode-toggle-checkbox');
    toggleInputs.forEach(function(input) { input.checked = isModeActive; });
    var fontBtns = document.querySelectorAll('.visual-font-btn');
    fontBtns.forEach(function(btn) {
      var scale = btn.getAttribute('data-scale');
      var isSelected = scale === fontScale;
      btn.classList.toggle('is-selected', isSelected);
      btn.setAttribute('aria-pressed', String(isSelected));
    });
    var toolbarBtn = document.getElementById('visualToolbarToggleBtn');
    if (toolbarBtn) toolbarBtn.classList.toggle('is-active', isModeActive);
  }

  function setMode(active) {
    isModeActive = Boolean(active);
    localStorage.setItem(STORAGE_KEY_MODE, String(isModeActive));
    if (isModeActive && fontScale === 'standard') {
      fontScale = 'large';
      localStorage.setItem(STORAGE_KEY_FONT, fontScale);
    }
    applyDOMState();
    announceStatus(
      isModeActive
        ? 'Che do giao tiep truc quan da bat. Da tang do tuong phan, chu lon va thong bao bang chu.'
        : 'Che do giao tiep truc quan da tat. Giao dien tro ve mac dinh.',
      'info'
    );
  }

  function setFontScale(newScale) {
    if (!['standard','large','extra-large'].includes(newScale)) return;
    fontScale = newScale;
    localStorage.setItem(STORAGE_KEY_FONT, fontScale);
    if (!isModeActive) { setMode(true); } else { applyDOMState(); }
    var label = newScale === 'standard' ? 'Chuan (100%)' : newScale === 'large' ? 'Lon (115%)' : 'Rat lon (130%)';
    announceStatus('Da chuyen co chu sang muc ' + label + '.', 'info');
  }

  function toggleMode() { setMode(!isModeActive); }

  function renderFloatingToolbar() {
    if (document.getElementById('visualModeToolbar')) return;
    var toolbarWrap = document.createElement('aside');
    toolbarWrap.id = 'visualModeToolbar';
    toolbarWrap.className = 'visual-mode-toolbar-pill';
    toolbarWrap.setAttribute('aria-label', 'Cong cu ho tro tiep can va giao tiep truc quan');
    toolbarWrap.innerHTML =
      '<button type="button" class="visual-toolbar-btn ' + (isModeActive ? 'is-active' : '') + '" id="visualToolbarToggleBtn" aria-expanded="false" aria-controls="visualModePanel" aria-label="Tuy chon giao tiep truc quan va co chu">' +
        '<span class="toolbar-icon" aria-hidden="true">\uD83D\uDC41\uFE0F</span>' +
        '<span class="toolbar-label">Che do truc quan</span>' +
      '</button>' +
      '<button type="button" class="visual-toolbar-btn" id="visualToolbarGuideBtn" aria-label="Mo 4 huong dan tuong tac">' +
        '<span class="toolbar-icon" aria-hidden="true">\uD83E\uDDED</span>' +
        '<span class="toolbar-label">Huong dan</span>' +
      '</button>';

    var panel = document.createElement('section');
    panel.id = 'visualModePanel';
    panel.className = 'visual-mode-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-label', 'Cai dat che do giao tiep truc quan');
    panel.hidden = true;
    panel.innerHTML =
      '<header class="visual-panel-header">' +
        '<h2><span aria-hidden="true">\uD83D\uDC41\uFE0F</span> Che do truc quan</h2>' +
        '<button type="button" class="visual-panel-close" id="visualPanelCloseBtn" aria-label="Dong bang cai dat">&times;</button>' +
      '</header>' +
      '<div class="visual-panel-body">' +
        '<div class="visual-toggle-row">' +
          '<div>' +
            '<span class="visual-toggle-label" id="lblVisualToggle">Bat giao tiep truc quan</span>' +
            '<p class="visual-toggle-desc">Tang do net, chu lon, thong bao trang thai bang chu va tat bot hoat anh nhanh.</p>' +
          '</div>' +
          '<label class="visual-switch" for="visualModeCheckbox">' +
            '<input type="checkbox" id="visualModeCheckbox" class="visual-mode-toggle-checkbox" aria-labelledby="lblVisualToggle" ' + (isModeActive ? 'checked' : '') + '>' +
            '<span class="visual-switch-slider" aria-hidden="true"></span>' +
          '</label>' +
        '</div>' +
        '<fieldset style="margin-top:1rem;">' +
          '<legend>Kich thuoc chu doc</legend>' +
          '<div class="visual-font-scale-group" role="group" aria-label="Chon kich thuoc van ban">' +
            '<button type="button" class="visual-font-btn ' + (fontScale === 'standard' ? 'is-selected' : '') + '" data-scale="standard" aria-pressed="' + (fontScale === 'standard') + '">Chuan (100%)</button>' +
            '<button type="button" class="visual-font-btn ' + (fontScale === 'large' ? 'is-selected' : '') + '" data-scale="large" aria-pressed="' + (fontScale === 'large') + '">Lon (115%)</button>' +
            '<button type="button" class="visual-font-btn ' + (fontScale === 'extra-large' ? 'is-selected' : '') + '" data-scale="extra-large" aria-pressed="' + (fontScale === 'extra-large') + '">Rat lon (130%)</button>' +
          '</div>' +
        '</fieldset>' +
      '</div>' +
      '<footer class="visual-panel-footer">' +
        '<button type="button" class="visual-guide-hub-btn" id="visualPanelOpenGuideHub">' +
          '<span aria-hidden="true">\uD83E\uDDED</span> Mo 4 Huong dan tuong tac' +
        '</button>' +
      '</footer>';

    document.body.appendChild(toolbarWrap);
    document.body.appendChild(panel);

    var toggleBtn = toolbarWrap.querySelector('#visualToolbarToggleBtn');
    var closeBtn = panel.querySelector('#visualPanelCloseBtn');
    var checkbox = panel.querySelector('#visualModeCheckbox');
    var guideBtn = toolbarWrap.querySelector('#visualToolbarGuideBtn');
    var panelGuideBtn = panel.querySelector('#visualPanelOpenGuideHub');

    toggleBtn && toggleBtn.addEventListener('click', function() {
      var isOpen = !panel.hidden;
      panel.hidden = isOpen;
      toggleBtn.setAttribute('aria-expanded', String(!isOpen));
      if (!isOpen && checkbox) checkbox.focus();
    });

    closeBtn && closeBtn.addEventListener('click', function() {
      panel.hidden = true;
      toggleBtn && toggleBtn.setAttribute('aria-expanded', 'false');
      toggleBtn && toggleBtn.focus();
    });

    checkbox && checkbox.addEventListener('change', function(e) { setMode(e.target.checked); });

    panel.querySelectorAll('.visual-font-btn').forEach(function(btn) {
      btn.addEventListener('click', function() { setFontScale(btn.getAttribute('data-scale')); });
    });

    guideBtn && guideBtn.addEventListener('click', function() {
      if (window.InteractiveGuides && window.InteractiveGuides.openHub) window.InteractiveGuides.openHub();
    });

    panelGuideBtn && panelGuideBtn.addEventListener('click', function() {
      panel.hidden = true;
      toggleBtn && toggleBtn.setAttribute('aria-expanded', 'false');
      if (window.InteractiveGuides && window.InteractiveGuides.openHub) window.InteractiveGuides.openHub();
    });

    panel.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        panel.hidden = true;
        toggleBtn && toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn && toggleBtn.focus();
      }
    });
  }

  function boot() {
    ensureStylesheet();
    createAnnouncer();
    applyDOMState();
    renderFloatingToolbar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.VisualCommunicationMode = {
    isActive: function() { return isModeActive; },
    getFontScale: function() { return fontScale; },
    setMode: setMode,
    toggle: toggleMode,
    setFontScale: setFontScale,
    announce: announceStatus,
    getRequestContext: function() {
      return isModeActive ? { accessibilityMode: true, textPriority: true } : {};
    }
  };
})();