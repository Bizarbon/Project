/**
 * interactive-guides.js
 * Bo 4 Tour huong dan tuong tac truc quan tren giao dien thuc te TechEcommerce
 * WCAG 2.2 - 100% Semantic HTML5
 */
(function initInteractiveGuides() {
  if (window.__interactiveGuidesLoaded) return;
  window.__interactiveGuidesLoaded = true;

  var root = typeof window.getAppBasePath === 'function' ? window.getAppBasePath() : '';

  function ensureStylesheet() {
    if (document.getElementById('interactiveGuidesStylesheet')) return;
    var link = document.createElement('link');
    link.id = 'interactiveGuidesStylesheet';
    link.rel = 'stylesheet';
    link.href = root + 'assets/css/interactive-guides.css?v=20261029-v1';
    document.head.appendChild(link);
  }

  var TOURS = [
    {
      id: 'tour-search-filter',
      name: 'Tim kiem va loc san pham',
      desc: 'Huong dan tim kiem nhanh san pham, goi y tu khoa va loc danh muc thiet bi.',
      steps: [
        {
          title: 'O tim kiem san pham',
          selector: '#headerSearchInput, #sharedStorefrontSearch, [data-guide="search-input"]',
          desc: 'Nhap ten thiet bi ban muon tim (vi du: iPhone 16, Laptop Dell, May tro thinh). Goi y san pham tuc thi se hien thi ngay khi ban nhap chu.',
          fallback: 'O tim kiem luon nam o vi tri trung tam tren thanh menu tren cung cua website.'
        },
        {
          title: 'Duyet theo danh muc chuyen biet',
          selector: '.header-category-list, .header-categories, [data-guide="category-list"]',
          desc: 'Bam chon danh muc nhu Dien thoai, Laptop, Tablet, Tai nghe hoac May tro thinh de loc toan bo san pham cung loai tren trang.',
          fallback: 'Thanh danh muc nam ngay ben duoi thanh tim kiem chinh.'
        },
        {
          title: 'Sap xep va loc chi tiet',
          selector: '#shopSortSelect, .product-filter-section, [data-guide="product-filters"]',
          desc: 'Tai trang san pham, ban co the loc theo thuong hieu chinh hang, sap xep gia tu thap den cao va chon muc gia phu hop voi ngan sach.',
          fallback: 'Khu vuc bo loc nam o cot ben trai hoac ngay dau danh sach san pham.'
        }
      ]
    },
    {
      id: 'tour-cart-checkout',
      name: 'Them vao gio va thanh toan',
      desc: 'Huong dan chon san pham, them vao gio hang va dat hang an toan truc tuyen khong can goi dien.',
      steps: [
        {
          title: 'Xem the san pham tren ke hang',
          selector: '.product-card, .card-tech, [data-guide="product-card"]',
          desc: 'Moi the san pham hien thi hinh anh ro net, gia ban chinh hang, muc giam gia va thong so ky thuat cot loi.',
          fallback: 'Danh sach san pham duoc trinh bay duoi dang the chu to ro rang tren trang chu va danh muc.'
        },
        {
          title: 'Thao tac Them vao gio hang',
          selector: '.btn-add-cart, .btn-buy-now, [data-guide="btn-add-cart"]',
          desc: 'Bam nut "Them vao gio" de dua san pham vao don hang. Mot thong bao xac nhan bang chu se xuat hien ngay tren man hinh.',
          fallback: 'Nut them gio hang duoc bo tri truc tiep tren tung the san pham.'
        },
        {
          title: 'Kiem tra gio hang',
          selector: '#headerCartButton, .header-cart-btn, [data-guide="cart-button"]',
          desc: 'Bam bieu tuong Gio hang o goc tren ben phai de xem lai cac mon da chon, so luong va tong tien thanh toan.',
          fallback: 'Bieu tuong xe day hang kem so luong hien thi o goc tren ben phai thanh menu.'
        },
        {
          title: 'Thanh toan truc tuyen an toan',
          selector: '#cartCheckoutBtn, .btn-checkout, [data-guide="checkout-btn"]',
          desc: 'Dien dia chi nhan hang va chon phuong thuc thanh toan: quet ma QR ngan hang, VNPay, MoMo hoac duyet tra gop online 100%. Thong bao xac nhan don se hien thi tren man hinh va gui ve email.',
          fallback: 'Nut tien hanh thanh toan nam o cuoi khung xem gio hang.'
        }
      ]
    },
    {
      id: 'tour-ai-chatbot',
      name: 'Su dung chatbot bang van ban',
      desc: 'Huong dan tro chuyen voi Tro ly AI bang chu, chon cau hoi nhanh va bao ve quyen rieng tu suc khoe.',
      steps: [
        {
          title: 'Mo Tro ly AI tu van',
          selector: '.ai-chat-toggle, [data-guide="chat-toggle"]',
          desc: 'Bam nut "Tu van AI" o goc phai duoi man hinh de mo cua so tro chuyen. Tro ly san sang giai dap 24/7 hoan toan bang van ban.',
          fallback: 'Nut tu van AI hinh tron noi co dinh o goc duoi cung ben phai man hinh.'
        },
        {
          title: 'Nhap cau hoi bang van ban',
          selector: '#aiChatInput, [data-guide="chat-input"]',
          desc: 'Go noi dung ban can ho tro (vi du: "laptop van phong duoi 15 trieu", "may tro thinh ket noi bluetooth"). Tro ly se hien thi cau tra loi bang chu va the san pham.',
          fallback: 'Khung nhap chu nam o duoi day cua so chat.'
        },
        {
          title: 'Goi y cau hoi nhanh',
          selector: '#aiChatSuggestions, [data-guide="chat-suggestions"]',
          desc: 'Bam vao cac nut goi y co san nhu "Ma giam gia hom nay", "Tinh tra gop 0%", "Tu van san pham" de nhan cau tra loi ngay ma khong can go phim.',
          fallback: 'Thanh goi y nam ngay phia tren o nhap tin nhan.'
        },
        {
          title: 'Bao ve rieng tu & Lam moi cuoc tro chuyen',
          selector: '.ai-chat-reset, .ai-chat-privacy-banner, [data-guide="chat-reset"]',
          desc: 'Cua hang khong luu du lieu suc khoe hay benh ly ca nhan. Bam nut la moi o goc tren cua so chat de xoa lich su tro chuyen bat ky luc nao.',
          fallback: 'Nut lam moi hinh mui ten xoay tron o goc tren ben phai khung chat.'
        }
      ]
    },
    {
      id: 'tour-order-history',
      name: 'Xem trang thai va lich su don hang',
      desc: 'Huong dan tra cuu tien do kien hang va gui yeu cau doi tra / ho tro bang chu khong qua dien thoai.',
      steps: [
        {
          title: 'Muc Don hang cua toi',
          selector: 'a[href*="orders.html"], [data-guide="orders-nav"]',
          desc: 'Bam vao muc "Don hang cua toi" tren thanh menu hoac chan trang de xem danh sach cac don hang ban da dat.',
          fallback: 'Muc Don hang nam trong menu tai khoan hoac nhom Chuc nang o chan trang.'
        },
        {
          title: 'Tra cuu theo ma don hang',
          selector: '#orderSearchInput, #orderTrackingCodeInput, [data-guide="order-search"]',
          desc: 'Nhap ma don hang (vi du: TECH...) hoac so dien thoai de xem truc tiep hanh trinh don hang tren man hinh ma khong can goi dien thoai.',
          fallback: 'O tra cuu don hang hien thi tai trang Quan ly don hang hoac muc Tra cuu don.'
        },
        {
          title: 'Tien do giao van truc quan',
          selector: '.order-tracking-timeline, .order-status-badge, [data-guide="order-status"]',
          desc: 'Theo doi kien hang qua 4 buoc: Da tiep nhan, Dang chuan bi hang, Dang giao va Giao thanh cong kem ma van don doi soat.',
          fallback: 'Thanh tien do gom cac moc thoi gian va trang thai ro rang tren tung don.'
        },
        {
          title: 'Ho tro doi tra & Bao hanh bang van ban',
          selector: '.order-support-actions, [data-guide="order-support"]',
          desc: 'Neu can doi tra, bao hanh hoac ho tro ky thuat, ban co the nhan tin truc tiep qua chatbox, Zalo 0842331606 hoac email vuphilong@techecommerce.vn.',
          fallback: 'Cac kenh ho tro bang chu duoc tich hop ngay duoi chi tiet tung don hang va o chan trang.'
        }
      ]
    }
  ];

  var activeTour = null;
  var activeStepIndex = 0;
  var isPaused = false;
  var dialogEl = null;
  var currentTargetEl = null;
  var previousFocusedEl = null;

  function announce(msg) {
    if (window.VisualCommunicationMode && window.VisualCommunicationMode.announce) {
      window.VisualCommunicationMode.announce(msg, 'info');
    }
  }

  function clearHighlight() {
    if (currentTargetEl) {
      currentTargetEl.classList.remove('guide-target-highlight');
      currentTargetEl = null;
    }
  }

  function destroyDialog() {
    clearHighlight();
    if (dialogEl) { dialogEl.remove(); dialogEl = null; }
    activeTour = null;
    activeStepIndex = 0;
    isPaused = false;
    if (previousFocusedEl && typeof previousFocusedEl.focus === 'function') {
      previousFocusedEl.focus();
      previousFocusedEl = null;
    }
  }

  function positionDialog(dialog, target) {
    if (!dialog) return;
    var isMobile = window.innerWidth <= 640;
    if (isMobile || !target) {
      dialog.style.left = '1rem'; dialog.style.right = '1rem';
      dialog.style.bottom = '1rem'; dialog.style.top = 'auto';
      dialog.style.maxWidth = 'none'; return;
    }
    var rect = target.getBoundingClientRect();
    var dialogHeight = dialog.offsetHeight || 280;
    var dialogWidth = dialog.offsetWidth || 420;
    var padding = 16;
    var top = rect.bottom + padding;
    var left = rect.left;
    if (top + dialogHeight > window.innerHeight - 20) top = Math.max(rect.top - dialogHeight - padding, 20);
    if (left + dialogWidth > window.innerWidth - 20) left = Math.max(window.innerWidth - dialogWidth - 20, 20);
    dialog.style.top = Math.round(top) + 'px';
    dialog.style.left = Math.round(left) + 'px';
    dialog.style.bottom = 'auto'; dialog.style.right = 'auto';
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function(m) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
    });
  }

  function renderStep(tour, stepIndex) {
    ensureStylesheet();
    clearHighlight();
    var step = tour.steps[stepIndex];
    if (!step) { finishTour(tour); return; }
    activeStepIndex = stepIndex;
    var target = null;
    if (step.selector) {
      try { target = document.querySelector(step.selector); } catch(e) { target = null; }
    }
    if (target && target.offsetParent !== null) {
      currentTargetEl = target;
      target.classList.add('guide-target-highlight');
      var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'center', inline: 'nearest' });
    }
    if (!dialogEl) {
      dialogEl = document.createElement('aside');
      dialogEl.className = 'interactive-guide-dialog';
      dialogEl.setAttribute('role', 'dialog');
      dialogEl.setAttribute('aria-modal', 'true');
      dialogEl.setAttribute('aria-labelledby', 'guideStepTitle');
      dialogEl.setAttribute('aria-describedby', 'guideStepDesc');
      document.body.appendChild(dialogEl);
    }
    var totalSteps = tour.steps.length;
    var isFirst = stepIndex === 0;
    var isLast = stepIndex === totalSteps - 1;
    dialogEl.innerHTML =
      '<header class="guide-dialog-header">' +
        '<div class="guide-dialog-meta">' +
          '<span class="guide-tour-badge">' + escapeHTML(tour.name) + '</span>' +
          '<span class="guide-step-counter" role="status">Buoc ' + (stepIndex+1) + ' / ' + totalSteps + '</span>' +
        '</div>' +
        '<h2 class="guide-step-title" id="guideStepTitle">' + escapeHTML(step.title) + '</h2>' +
        '<button type="button" class="guide-btn-close" id="guideCloseBtn" aria-label="Dong huong dan">&times;</button>' +
      '</header>' +
      '<main class="guide-dialog-body">' +
        '<p id="guideStepDesc">' + escapeHTML(step.desc) + '</p>' +
        '<div class="guide-fallback-note" role="note"><strong>Vi tri tren trang:</strong> ' + escapeHTML(step.fallback) + '</div>' +
      '</main>' +
      '<footer class="guide-dialog-footer">' +
        '<button type="button" class="guide-btn guide-btn-skip" id="guideSkipBtn">Bo qua tour</button>' +
        '<div class="guide-nav-group">' +
          (!isFirst ? '<button type="button" class="guide-btn guide-btn-prev" id="guidePrevBtn">&#8249; Quay lai</button>' : '') +
          '<button type="button" class="guide-btn guide-btn-pause ' + (isPaused ? 'is-paused' : '') + '" id="guidePauseBtn" aria-label="' + (isPaused ? 'Tiep tuc huong dan' : 'Tam dung huong dan') + '">' +
            (isPaused ? '&#9654; Tiep tuc' : '&#9208; Tam dung') +
          '</button>' +
          '<button type="button" class="guide-btn guide-btn-next" id="guideNextBtn">' +
            (isLast ? 'Hoan tat &#10003;' : 'Tiep theo &#8250;') +
          '</button>' +
        '</div>' +
      '</footer>';

    positionDialog(dialogEl, target);

    var nextBtn = dialogEl.querySelector('#guideNextBtn');
    var prevBtn = dialogEl.querySelector('#guidePrevBtn');
    var skipBtn = dialogEl.querySelector('#guideSkipBtn');
    var pauseBtn = dialogEl.querySelector('#guidePauseBtn');
    var closeBtn = dialogEl.querySelector('#guideCloseBtn');

    nextBtn && nextBtn.addEventListener('click', function() {
      if (isLast) { finishTour(tour); } else { renderStep(tour, stepIndex + 1); }
    });
    prevBtn && prevBtn.addEventListener('click', function() { if (stepIndex > 0) renderStep(tour, stepIndex - 1); });
    skipBtn && skipBtn.addEventListener('click', function() { announce('Da dung huong dan ' + tour.name + '.'); destroyDialog(); });
    closeBtn && closeBtn.addEventListener('click', function() { announce('Da dong huong dan.'); destroyDialog(); });
    pauseBtn && pauseBtn.addEventListener('click', function() {
      isPaused = !isPaused;
      pauseBtn.classList.toggle('is-paused', isPaused);
      pauseBtn.innerHTML = isPaused ? '&#9654; Tiep tuc' : '&#9208; Tam dung';
      pauseBtn.setAttribute('aria-label', isPaused ? 'Tiep tuc huong dan' : 'Tam dung huong dan');
      announce(isPaused ? 'Da tam dung huong dan.' : 'Tiep tuc huong dan.');
    });

    dialogEl.onkeydown = function(e) {
      if (e.key === 'Escape') { e.preventDefault(); destroyDialog(); }
      else if (e.key === 'ArrowRight' && !isLast && document.activeElement !== closeBtn) { e.preventDefault(); renderStep(tour, stepIndex + 1); }
      else if (e.key === 'ArrowLeft' && !isFirst && document.activeElement !== closeBtn) { e.preventDefault(); renderStep(tour, stepIndex - 1); }
    };

    setTimeout(function() { nextBtn && nextBtn.focus(); }, 60);
    announce('Buoc ' + (stepIndex+1) + ' tren ' + totalSteps + ': ' + step.title + '.');
  }

  function startTour(tourId) {
    var tour = null;
    for (var i = 0; i < TOURS.length; i++) { if (TOURS[i].id === tourId) { tour = TOURS[i]; break; } }
    if (!tour) tour = TOURS[0];
    previousFocusedEl = document.activeElement;
    activeTour = tour;
    activeStepIndex = 0;
    isPaused = false;
    closeHub();
    renderStep(tour, 0);
  }

  function finishTour(tour) {
    destroyDialog();
    announce('Chuc mung ban da hoan thanh huong dan: ' + tour.name + '!');
    if (window.VisualCommunicationMode && window.VisualCommunicationMode.announce) {
      window.VisualCommunicationMode.announce('Hoan tat huong dan ' + tour.name + '! Ban co the mo lai bat cu luc nao.', 'success');
    }
  }

  var hubEl = null;

  function openHub() {
    ensureStylesheet();
    if (hubEl) hubEl.remove();
    previousFocusedEl = document.activeElement;
    var backdrop = document.createElement('aside');
    backdrop.className = 'interactive-guides-hub-backdrop';
    backdrop.id = 'interactiveGuidesHubBackdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-labelledby', 'guideHubTitle');
    var cardsHTML = TOURS.map(function(tour, idx) {
      return '<li class="guide-card-item">' +
        '<div class="guide-card-top">' +
          '<span class="guide-card-num">Huong dan ' + (idx+1) + '/4</span>' +
          '<h3 class="guide-card-title">' + escapeHTML(tour.name) + '</h3>' +
          '<p class="guide-card-desc">' + escapeHTML(tour.desc) + '</p>' +
        '</div>' +
        '<button type="button" class="guide-card-start-btn" data-start-tour="' + tour.id + '">' +
          '<span aria-hidden="true">&#9654;</span> Bat dau huong dan (' + tour.steps.length + ' buoc)' +
        '</button>' +
      '</li>';
    }).join('');
    backdrop.innerHTML =
      '<section class="interactive-guides-hub">' +
        '<header class="guide-hub-header">' +
          '<div>' +
            '<h2 id="guideHubTitle"><span aria-hidden="true">\uD83E\uDDED</span> Bon Huong Dan Tuong Tac Truc Quan</h2>' +
            '<p>Trai nghiem tung buoc thao tac thuc te ngay tren man hinh cua hang TechEcommerce ma khong can xem video hay nghe am thanh.</p>' +
          '</div>' +
          '<button type="button" class="guide-hub-close" id="guideHubCloseBtn" aria-label="Dong cua so huong dan">&times;</button>' +
        '</header>' +
        '<ol class="guide-hub-grid">' + cardsHTML + '</ol>' +
      '</section>';
    document.body.appendChild(backdrop);
    hubEl = backdrop;
    var closeBtn = backdrop.querySelector('#guideHubCloseBtn');
    closeBtn && closeBtn.addEventListener('click', closeHub);
    backdrop.addEventListener('click', function(e) { if (e.target === backdrop) closeHub(); });
    backdrop.querySelectorAll('[data-start-tour]').forEach(function(btn) {
      btn.addEventListener('click', function() { startTour(btn.getAttribute('data-start-tour')); });
    });
    backdrop.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeHub(); });
    setTimeout(function() { closeBtn && closeBtn.focus(); }, 60);
    announce('Da mo bang chon 4 huong dan tuong tac truc quan.');
  }

  function closeHub() {
    if (hubEl) { hubEl.remove(); hubEl = null; }
    if (previousFocusedEl && typeof previousFocusedEl.focus === 'function') {
      previousFocusedEl.focus(); previousFocusedEl = null;
    }
  }

  function boot() {
    ensureStylesheet();
    window.addEventListener('resize', function() {
      if (dialogEl && currentTargetEl) positionDialog(dialogEl, currentTargetEl);
    });
    var urlParams = new URLSearchParams(window.location.search);
    var tourParam = urlParams.get('tour');
    if (tourParam) setTimeout(function() { startTour(tourParam); }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.InteractiveGuides = {
    getTours: function() { return TOURS; },
    startTour: startTour,
    openHub: openHub,
    closeHub: closeHub,
    nextStep: function() { if (activeTour) renderStep(activeTour, activeStepIndex + 1); },
    prevStep: function() { if (activeTour && activeStepIndex > 0) renderStep(activeTour, activeStepIndex - 1); },
    closeTour: destroyDialog
  };
})();