/* You Own Nothing — everything in this file is client-side satire.
   No payments, no accounts, no tracking. The only thing collected is the joke. */
'use strict';

(function () {

  var DOMAIN = 'youownnothing.rent';
  var STORE_KEY = 'yon-state-v1';
  var ADDON_PRICE = 1.99;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var RM = false;
  try { RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { RM = false; }

  /* ============================== data ============================== */

  var OBJECTS = [
    {
      id: 'lamp', name: 'Floor lamp', thing: 'the lamp', brand: 'LumenCloud™',
      tagline: 'Light, as a service.', absurdity: 6,
      tiers: [
        { name: 'Basic', price: 2.99, blurb: 'One bulb, warm-ish.' },
        { name: 'Pro', price: 5.99, blurb: 'Dimmer access. Two moods.' },
        { name: 'Max', price: 9.99, blurb: 'Full brightness. Includes the color yellow.' }
      ],
      decline: 'keep sitting in the dark',
      fine: 'Photons remain the property of LumenCloud Inc. Unused light does not roll over.'
    },
    {
      id: 'sofa', name: 'Sofa', thing: 'the sofa', brand: 'PlushTier™',
      tagline: 'Sitting, reimagined.', absurdity: 5,
      tiers: [
        { name: 'Basic', price: 8.99, blurb: 'Two cushions. Firmness not guaranteed.' },
        { name: 'Pro', price: 14.99, blurb: 'All cushions. Naps up to 40 minutes.' },
        { name: 'Max', price: 22.99, blurb: 'Unlimited naps. Guest seating for one (1) guest.' }
      ],
      decline: 'stand indefinitely',
      fine: 'Lying down is a Pro feature. Prolonged comfort may require the Comfort+ add-on.'
    },
    {
      id: 'tv', name: 'Television', thing: 'the TV', brand: 'PixelPane™',
      tagline: 'A window to content. The window is rented.', absurdity: 4,
      tiers: [
        { name: 'Basic', price: 11.99, blurb: '720p. Ads before the ads.' },
        { name: 'Pro', price: 17.99, blurb: '4K, on weekdays.' },
        { name: 'Max', price: 24.99, blurb: '8K. Nothing is broadcast in 8K.' }
      ],
      decline: 'stare at the black rectangle',
      fine: 'Screen remains on-site property of PixelPane. Content sold separately. Remote sold separately. Buttons sold separately.'
    },
    {
      id: 'fridge', name: 'Refrigerator', thing: 'the fridge', brand: 'ColdCloud™',
      tagline: 'Refrigeration is a lifestyle.', absurdity: 5,
      tiers: [
        { name: 'Basic', price: 9.99, blurb: 'Above-freezing freshness.' },
        { name: 'Pro', price: 15.99, blurb: 'Actual cold. Crisper drawer unlocked.' },
        { name: 'Max', price: 21.99, blurb: 'Ice. The good kind.' }
      ],
      decline: 'eat it all today',
      fine: 'Temperatures below 5°C are metered. Door-open time is billed by the second after ten seconds.'
    },
    {
      id: 'coffee', name: 'Coffee machine', thing: 'the coffee machine', brand: 'DripSync™',
      tagline: 'Your morning, on a plan.', absurdity: 6,
      tiers: [
        { name: 'Basic', price: 3.99, blurb: 'One cup per day. Lukewarm tier.' },
        { name: 'Pro', price: 7.99, blurb: 'Hot coffee. Steam included.' },
        { name: 'Max', price: 12.99, blurb: 'Espresso mode. Jitters guaranteed or your month back.' }
      ],
      decline: 'be tired forever',
      fine: 'Beans not included. Water not included. Cup rental available.'
    },
    {
      id: 'window', name: 'The view', thing: 'the view outside', brand: 'ViewPass™',
      tagline: 'The outside, in stunning definition.', absurdity: 9,
      tiers: [
        { name: 'Basic', price: 4.99, blurb: 'Overcast package.' },
        { name: 'Pro', price: 8.99, blurb: 'Sunlight, weekends included.' },
        { name: 'Max', price: 14.99, blurb: 'Sunsets, birds, one (1) rainbow per quarter.' }
      ],
      decline: 'enjoy the fog',
      fine: 'View subject to regional availability. Seasons rotate on a separate plan. Opening the window requires FreshAir compatibility (see AirPure™).'
    },
    {
      id: 'radiator', name: 'Radiator', thing: 'the heat', brand: 'EmberLease™',
      tagline: 'Warmth, delivered monthly.', absurdity: 8,
      tiers: [
        { name: 'Basic', price: 6.99, blurb: 'Takes the edge off.' },
        { name: 'Pro', price: 11.99, blurb: 'Cozy. Socks optional.' },
        { name: 'Max', price: 18.99, blurb: 'Tropical. Neighbors will ask questions.' }
      ],
      decline: 'wear another sweater',
      fine: 'Heat is licensed, not owned. Residual warmth is reclaimed upon cancellation.'
    },
    {
      id: 'door', name: 'Front door', thing: 'the front door', brand: 'ThresholdPlus™',
      tagline: 'Enter and exit, seamlessly.', absurdity: 9,
      tiers: [
        { name: 'Basic', price: 12.99, blurb: 'Three exits per day.' },
        { name: 'Pro', price: 19.99, blurb: 'Unlimited exits. Re-entry included.' },
        { name: 'Max', price: 29.99, blurb: 'Priority hinge. The door opens for you.' }
      ],
      decline: "you weren't going anywhere",
      fine: 'Emergency exits billed at surge rates. The doorknob is a peripheral.'
    },
    {
      id: 'plant', name: 'Houseplant', thing: 'the plant', brand: 'Chlorofeed™',
      tagline: 'Photosynthesis, managed.', absurdity: 6,
      tiers: [
        { name: 'Basic', price: 1.99, blurb: 'Green, mostly.' },
        { name: 'Pro', price: 3.99, blurb: 'A new leaf every quarter.' },
        { name: 'Max', price: 6.99, blurb: 'It thrives. It knows you pay.' }
      ],
      decline: 'let nature take its course',
      fine: 'Wilting is a natural process and is not covered by the SLA (Service Leaf Agreement).'
    },
    {
      id: 'cat', name: 'The cat', thing: 'the cat', brand: 'WhiskerCare™',
      tagline: 'Companionship, per calendar month.', absurdity: 10,
      tiers: [
        { name: 'Basic', price: 4.99, blurb: 'She acknowledges you. Occasionally.' },
        { name: 'Premium', price: 8.99, blurb: 'Purring included.' },
        { name: 'Max', price: 13.99, blurb: 'Lap privileges, subject to her mood.' }
      ],
      decline: 'let her go',
      fine: 'Purring included in Premium only. Affection sold separately. The cat retains all rights to the cat. She is currently on a free trial and does not know this.'
    },
    {
      id: 'wifi', name: 'WiFi router', thing: 'the wifi', brand: 'SignalPatch™',
      tagline: 'Connectivity, in its natural habitat.', absurdity: 4,
      tiers: [
        { name: 'Basic', price: 7.99, blurb: 'Two bars.' },
        { name: 'Pro', price: 13.99, blurb: 'All bars. Buffered enlightenment.' },
        { name: 'Max', price: 19.99, blurb: 'Speeds we describe as "up to".' }
      ],
      decline: 'embrace the offline lifestyle',
      fine: 'Bandwidth is shaped for your wellbeing. The blinking light is decorative and billed separately.'
    },
    {
      id: 'shelf', name: 'Bookshelf', thing: 'the books', brand: 'TomeStream™',
      tagline: 'Books you can almost keep.', absurdity: 7,
      tiers: [
        { name: 'Basic', price: 5.99, blurb: 'Spines visible.' },
        { name: 'Pro', price: 9.99, blurb: 'Books may be opened.' },
        { name: 'Max', price: 15.99, blurb: 'Includes reading. Retention not included.' }
      ],
      decline: 'admire the wall instead',
      fine: 'Titles rotate monthly. Page 47 is premium content on all plans.'
    },
    {
      id: 'rug', name: 'Rug', thing: 'the rug', brand: 'WeaveWell™',
      tagline: 'Softness underfoot, on us. Billed to you.', absurdity: 7,
      tiers: [
        { name: 'Basic', price: 3.49, blurb: 'Feels like a rug.' },
        { name: 'Pro', price: 6.49, blurb: 'Pile height, generous.' },
        { name: 'Max', price: 10.49, blurb: 'Barefoot certified.' }
      ],
      decline: 'the floor is fine',
      fine: "The pattern is licensed from the pattern's original artist, who is also on a subscription."
    },
    {
      id: 'thermostat', name: 'Thermostat', thing: 'the thermostat', brand: 'SetPoint™',
      tagline: 'Temperature preferences, honored monthly.', absurdity: 7,
      tiers: [
        { name: 'Basic', price: 2.49, blurb: 'Two temperatures, 17° and 26°.' },
        { name: 'Pro', price: 4.99, blurb: 'One-degree increments.' },
        { name: 'Max', price: 8.49, blurb: 'Your exact preference, remembered.' }
      ],
      decline: 'adapt biologically',
      fine: 'Half-degrees are an enterprise feature. Contact sales.'
    },
    {
      id: 'ceiling', name: 'Ceiling lamp', thing: 'the ceiling light', brand: 'GlowGrid™',
      tagline: 'Overhead lighting for the modern tenant.', absurdity: 5,
      tiers: [
        { name: 'Basic', price: 3.99, blurb: 'Sixty watts of ambiance.' },
        { name: 'Pro', price: 6.99, blurb: 'Warm white or cool white. Not both.' },
        { name: 'Max', price: 11.99, blurb: 'Both.' }
      ],
      decline: 'the sun exists, sometimes',
      fine: 'Switch actuation counts toward your monthly toggle allowance (100).'
    },
    {
      id: 'air', name: 'Indoor air', thing: 'the air', brand: 'AirPure™',
      tagline: 'Breathe with confidence.', absurdity: 10,
      tiers: [
        { name: 'Basic', price: 5.99, blurb: 'Standard air. 78% nitrogen, as is.' },
        { name: 'Pro', price: 10.99, blurb: 'Filtered. Notes of cedar.' },
        { name: 'Max', price: 16.99, blurb: 'Mountain-grade. Oxygen-forward.' }
      ],
      decline: 'hold your breath',
      fine: 'Air is provided as-is, where-is. Exhaled air remains subject to our recapture program.'
    }
  ];

  var BY_ID = {};
  OBJECTS.forEach(function (o) { BY_ID[o.id] = o; });

  var PATTERNS = ['annual', 'rot', 'countdown', 'popular', 'scarcity', 'addon'];

  var LOGO_COLORS = ['#2563eb', '#4f46e5', '#0f766e', '#0369a1', '#7c3aed', '#334155'];

  var VERDICTS = [
    'Even the warmth was a rental.',
    'Home is where the recurring charges are.',
    'You live here. Legally, that is about it.',
    'Your deposit has been converted to a memory.',
    'The landlord thanks you for your loyalty to things.'
  ];

  var RETENTION_LINES = [
    'Before you cancel: everything will stop working. That is the entire product.',
    'Cancellation takes effect immediately. Regret follows shortly.',
    'We will keep your settings for 30 days, out of sentiment.'
  ];

  /* ============================== state ============================== */

  var state = { decisions: {}, moveIns: 0 };

  function loadState() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.v !== 1 || typeof parsed.decisions !== 'object' || parsed.decisions === null) return;
      var clean = {};
      Object.keys(parsed.decisions).forEach(function (id) {
        var d = parsed.decisions[id];
        if (!BY_ID[id] || !d) return;
        if (d.status === 'subscribed') {
          var tier = (d.tier === 0 || d.tier === 1 || d.tier === 2) ? d.tier : 1;
          clean[id] = { status: 'subscribed', tier: tier, addon: !!d.addon };
        } else if (d.status === 'declined') {
          clean[id] = { status: 'declined' };
        }
      });
      state.decisions = clean;
      state.moveIns = (typeof parsed.moveIns === 'number' && isFinite(parsed.moveIns)) ? parsed.moveIns : 0;
    } catch (e) {
      state.decisions = {};
      state.moveIns = 0;
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ v: 1, decisions: state.decisions, moveIns: state.moveIns }));
    } catch (e) { /* private mode etc. — the toy still works */ }
  }

  function objectMonthly(id) {
    var d = state.decisions[id];
    if (!d || d.status !== 'subscribed') return 0;
    return BY_ID[id].tiers[d.tier].price + (d.addon ? ADDON_PRICE : 0);
  }

  function totalMonthly() {
    return OBJECTS.reduce(function (sum, o) { return sum + objectMonthly(o.id); }, 0);
  }

  function decidedCount() {
    return Object.keys(state.decisions).length;
  }

  function money(v) {
    return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /* ============================== dom refs ============================== */

  var els = {
    scene: document.getElementById('scene'),
    chips: document.getElementById('chips'),
    odometer: document.getElementById('odometer'),
    decided: document.getElementById('decided-count'),
    leaveBtn: document.getElementById('leave-btn'),
    modalRoot: document.getElementById('modal-root'),
    modal: document.getElementById('modal'),
    checkout: document.getElementById('checkout'),
    receipt: document.getElementById('receipt'),
    btnSave: document.getElementById('btn-save'),
    btnCopy: document.getElementById('btn-copy'),
    btnAgain: document.getElementById('btn-again'),
    toast: document.getElementById('all-done'),
    toastLeave: document.getElementById('toast-leave')
  };

  /* ============================== odometer ============================== */

  var odoChars = null;

  function renderTotal(value, instant) {
    var str = money(value);
    var container = els.odometer;
    container.setAttribute('data-value', str);
    // screen readers get one clean string; the digit strips are decoration
    var sr = container.querySelector('.odo-sr');
    var visual = container.querySelector('.odo-visual');
    if (!sr) {
      container.textContent = '';
      sr = document.createElement('span');
      sr.className = 'odo-sr';
      container.appendChild(sr);
      visual = document.createElement('span');
      visual.className = 'odo-visual';
      visual.setAttribute('aria-hidden', 'true');
      container.appendChild(visual);
    }
    sr.textContent = str;
    var mustRebuild = instant || RM || !odoChars || odoChars.length !== str.length;

    if (mustRebuild) {
      visual.textContent = '';
      odoChars = [];
      for (var i = 0; i < str.length; i++) {
        var ch = str[i];
        if (ch >= '0' && ch <= '9') {
          var oc = document.createElement('span');
          oc.className = 'oc';
          var strip = document.createElement('span');
          strip.className = 'ostrip';
          strip.style.transition = 'none';
          for (var d = 0; d <= 9; d++) {
            var s = document.createElement('span');
            s.textContent = String(d);
            strip.appendChild(s);
          }
          strip.style.transform = 'translateY(' + (-Number(ch)) + 'em)';
          oc.appendChild(strip);
          visual.appendChild(oc);
          odoChars.push({ digit: true, strip: strip });
          // re-enable the transition after layout so future changes roll
          (function (el) {
            requestAnimationFrame(function () {
              requestAnimationFrame(function () { el.style.transition = ''; });
            });
          })(strip);
        } else {
          var sym = document.createElement('span');
          sym.className = 'osym';
          sym.textContent = ch;
          visual.appendChild(sym);
          odoChars.push({ digit: false });
        }
      }
      return;
    }

    for (var j = 0; j < str.length; j++) {
      if (odoChars[j].digit && str[j] >= '0' && str[j] <= '9') {
        odoChars[j].strip.style.transform = 'translateY(' + (-Number(str[j])) + 'em)';
      }
    }
  }

  /* ============================== chips (SaaS price tags on warm art) ============================== */

  function chipFor(id) {
    return els.chips.querySelector('[data-chip="' + id + '"]');
  }

  function removeChip(id) {
    var c = chipFor(id);
    if (c) c.remove();
  }

  function addChip(id) {
    removeChip(id);
    var group = els.scene.querySelector('.obj[data-id="' + id + '"]');
    if (!group) return;
    var hit = group.querySelector('.hit');
    var hx = Number(hit.getAttribute('x'));
    var hy = Number(hit.getAttribute('y'));
    var hw = Number(hit.getAttribute('width'));

    var label = money(objectMonthly(id)) + '/mo';
    var w = label.length * 7.2 + 26;
    var x = Math.min(Math.max(hx + hw - w + 6, 10), 1200 - w - 8);
    var y = Math.max(hy - 4, 40);

    var g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('data-chip', id);
    g.setAttribute('class', 'price-chip');

    var rect = document.createElementNS(SVGNS, 'rect');
    rect.setAttribute('x', x); rect.setAttribute('y', y);
    rect.setAttribute('width', w); rect.setAttribute('height', 22);
    rect.setAttribute('rx', 5);
    rect.setAttribute('fill', '#ffffff');
    rect.setAttribute('stroke', '#d1d5db');
    rect.setAttribute('stroke-width', '1.5');

    var dot = document.createElementNS(SVGNS, 'circle');
    dot.setAttribute('cx', x + 11); dot.setAttribute('cy', y + 11); dot.setAttribute('r', 3);
    dot.setAttribute('fill', '#2563eb');

    var text = document.createElementNS(SVGNS, 'text');
    text.setAttribute('x', x + 19); text.setAttribute('y', y + 15.5);
    text.setAttribute('font-size', '12');
    text.setAttribute('fill', '#111827');
    text.setAttribute('font-family', "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif");
    text.textContent = label;

    g.appendChild(rect); g.appendChild(dot); g.appendChild(text);
    els.chips.appendChild(g);
  }

  /* ============================== object state on canvas ============================== */

  function applyObjectState(id) {
    var group = els.scene.querySelector('.obj[data-id="' + id + '"]');
    if (!group) return;
    var d = state.decisions[id];
    group.classList.remove('declined');
    if (d && d.status === 'declined') {
      group.classList.add('declined');
      removeChip(id);
    } else if (d && d.status === 'subscribed') {
      addChip(id);
    } else {
      removeChip(id);
    }
  }

  function pulse(id) {
    if (RM) return;
    var group = els.scene.querySelector('.obj[data-id="' + id + '"]');
    if (!group) return;
    group.classList.remove('pulse');
    void group.getBoundingClientRect();
    group.classList.add('pulse');
    setTimeout(function () { group.classList.remove('pulse'); }, 700);
  }

  /* ============================== HUD ============================== */

  function updateHUD() {
    renderTotal(totalMonthly());
    var n = decidedCount();
    els.decided.textContent = n + ' of ' + OBJECTS.length + ' decided';
    els.leaveBtn.classList.toggle('hidden', n === 0);
    var checkoutOpen = !els.checkout.classList.contains('hidden');
    els.toast.classList.toggle('hidden', n !== OBJECTS.length || checkoutOpen);
  }

  /* ============================== modal ============================== */

  var activeModal = null; // { id, pattern, sel, billing, countdownTimer, lastFocus }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function tierCard(o, idx, selected, popularIdx) {
    var t = o.tiers[idx];
    return '<button type="button" class="tier' + (idx === selected ? ' on' : '') + '" data-tier="' + idx + '">' +
      (idx === popularIdx ? '<span class="t-badge">MOST POPULAR</span>' : '') +
      '<span class="t-name">' + esc(t.name) + '</span>' +
      '<span class="t-price">' + money(t.price) + '<span class="t-per"> /mo</span></span>' +
      '<span class="t-blurb">' + esc(t.blurb) + '</span>' +
      '</button>';
  }

  function buildModalHTML(o, status, pattern, sel) {
    var idx = OBJECTS.indexOf(o);
    var logoColor = LOGO_COLORS[idx % LOGO_COLORS.length];
    var h = '';

    h += '<button class="m-close" data-action="dismiss" aria-label="Close">&times;</button>';
    h += '<div class="m-head">';
    h += '<div class="m-logo" style="background:' + logoColor + '">' + esc(o.brand.charAt(0)) + '</div>';
    h += '<div class="m-brand" id="m-brand">' + esc(o.brand) + '</div>';
    if (status === 'subscribed') h += '<span class="m-chip">ACTIVE</span>';
    h += '</div>';
    h += '<div class="m-tagline">' + esc(o.tagline) + '</div>';

    if (status === 'subscribed') {
      var d = state.decisions[o.id];
      var t = o.tiers[d.tier];
      var retention = RETENTION_LINES[Math.floor(Math.random() * RETENTION_LINES.length)];
      h += '<div class="m-plan-summary">';
      h += 'Current plan: <strong>' + esc(t.name) + '</strong>';
      h += '<div class="p-price">' + money(objectMonthly(o.id)) + '<span style="font-size:12px;color:#9ca3af;font-weight:400"> /mo</span></div>';
      if (d.addon) h += '<div style="font-size:12px;color:#6b7280;margin-top:2px">includes Protection Plan (+' + money(ADDON_PRICE) + '/mo)</div>';
      h += '<div class="p-note">' + esc(retention) + '</div>';
      h += '</div>';
      h += '<button class="m-cta" data-action="dismiss">Keep subscription</button>';
      h += '<div class="m-cta-sub">Good choice. Statistically, you had no other kind.</div>';
      h += '<div class="m-decline-row"><button class="m-decline" data-action="decline">Cancel anyway</button></div>';
      h += '<div class="m-fine">' + esc(o.fine) + '</div>';
      return h;
    }

    // banners (dark patterns C, E; winback banner stacks above them)
    if (status === 'declined') {
      h += '<div class="m-banner winback">WIN-BACK OFFER &mdash; everything you left behind, at the same price, but warmer.</div>';
    }
    if (pattern === 'countdown') {
      h += '<div class="m-banner">Founding resident pricing ends in <span id="m-countdown">04:59</span></div>';
    } else if (pattern === 'scarcity') {
      h += '<div class="m-banner">Only 3 subscriptions left in your building</div>';
    }

    // dark pattern A: annual preselected
    if (pattern === 'annual') {
      h += '<div class="m-billing">';
      h += '<button type="button" class="bopt" data-billing="monthly">Monthly</button>';
      h += '<button type="button" class="bopt on" data-billing="annual">Annual &mdash; save 17%</button>';
      h += '<button type="button" class="bswitch" data-billing="monthly">switch to monthly</button>';
      h += '</div>';
    }

    var popularIdx = pattern === 'popular' ? 2 : -1;
    h += '<div class="m-tiers">';
    for (var i = 0; i < 3; i++) h += tierCard(o, i, sel, popularIdx);
    h += '</div>';

    // dark pattern F: pre-checked add-on
    if (pattern === 'addon') {
      h += '<label class="m-addon"><input type="checkbox" id="m-addon-input" checked> ' +
        '+' + money(ADDON_PRICE) + '/mo &mdash; Protection Plan. Protects ' + esc(o.thing) + ' from itself.</label>';
    }

    h += '<button class="m-cta" data-action="subscribe"></button>';
    h += '<div class="m-cta-sub" id="m-cta-sub"></div>';

    var declineLabel = status === 'declined' ? 'leave it in the past' : o.decline;
    var rotClass = pattern === 'rot' ? ' rot' : '';
    if (pattern === 'rot') declineLabel = 'let it rot';
    var declineAction = status === 'declined' ? 'dismiss' : 'decline';
    h += '<div class="m-decline-row"><button class="m-decline' + rotClass + '" data-action="' + declineAction + '">' + esc(declineLabel) + '</button></div>';

    h += '<div class="m-fine">' + esc(o.fine) + ' Auto-renews until canceled. Canceling is possible.</div>';
    return h;
  }

  function refreshCTA() {
    if (!activeModal) return;
    var o = BY_ID[activeModal.id];
    var cta = els.modal.querySelector('[data-action="subscribe"]');
    var sub = els.modal.querySelector('#m-cta-sub');
    if (!cta) return;
    var t = o.tiers[activeModal.sel];
    var verb = activeModal.status === 'declined' ? 'Resubscribe' : 'Subscribe';
    if (activeModal.billing === 'annual') {
      cta.textContent = verb + ' — ' + money(t.price * 10) + '/yr';
      if (sub) sub.textContent = 'Billed ' + money(t.price * 10) + ' today. Two months free. Which two is our decision.';
    } else {
      cta.textContent = verb + ' — ' + money(t.price) + '/mo';
      if (sub) sub.textContent = 'Renews automatically. Cancellation is a journey.';
    }
  }

  function openModal(id) {
    if (activeModal) return;
    var o = BY_ID[id];
    if (!o) return;
    var d = state.decisions[id];
    var status = d ? d.status : 'none';
    var pattern = status === 'subscribed' ? null : PATTERNS[Math.floor(Math.random() * PATTERNS.length)];
    var sel = pattern === 'popular' ? 2 : 1;

    activeModal = {
      id: id,
      status: status,
      pattern: pattern,
      sel: sel,
      billing: pattern === 'annual' ? 'annual' : 'monthly',
      countdownTimer: null,
      countdownLeft: 299,
      openedAt: Date.now(),
      lastFocus: document.activeElement
    };

    els.modal.innerHTML = buildModalHTML(o, status, pattern, sel);
    els.modalRoot.classList.remove('hidden');
    refreshCTA();

    if (pattern === 'countdown') {
      activeModal.countdownTimer = setInterval(function () {
        if (!activeModal) return;
        activeModal.countdownLeft -= 1;
        if (activeModal.countdownLeft < 0) activeModal.countdownLeft = 299; // the offer never ends. that is the joke.
        var el = document.getElementById('m-countdown');
        if (el) {
          var m = Math.floor(activeModal.countdownLeft / 60);
          var s = activeModal.countdownLeft % 60;
          el.textContent = '0' + m + ':' + (s < 10 ? '0' : '') + s;
        }
      }, 1000);
    }

    var cta = els.modal.querySelector('.m-cta');
    if (cta) cta.focus();
  }

  function closeModal() {
    if (!activeModal) return;
    if (activeModal.countdownTimer) clearInterval(activeModal.countdownTimer);
    var back = activeModal.lastFocus;
    activeModal = null;
    els.modalRoot.classList.add('hidden');
    els.modal.innerHTML = '';
    if (back && typeof back.focus === 'function') {
      try { back.focus(); } catch (e) { /* focus target may be gone */ }
    }
  }

  function subscribe(id, tierIdx, addon) {
    state.decisions[id] = { status: 'subscribed', tier: tierIdx, addon: !!addon };
    saveState();
    applyObjectState(id);
    updateHUD();
    pulse(id);
  }

  function decline(id) {
    state.decisions[id] = { status: 'declined' };
    saveState();
    applyObjectState(id);
    updateHUD();
  }

  els.modalRoot.addEventListener('click', function (e) {
    if (!activeModal) return;
    var tierBtn = e.target.closest('.tier');
    if (tierBtn && els.modal.contains(tierBtn)) {
      activeModal.sel = Number(tierBtn.dataset.tier);
      els.modal.querySelectorAll('.tier').forEach(function (t) {
        t.classList.toggle('on', Number(t.dataset.tier) === activeModal.sel);
      });
      refreshCTA();
      return;
    }
    var billingBtn = e.target.closest('[data-billing]');
    if (billingBtn && els.modal.contains(billingBtn)) {
      activeModal.billing = billingBtn.dataset.billing;
      els.modal.querySelectorAll('.bopt').forEach(function (b) {
        b.classList.toggle('on', b.dataset.billing === activeModal.billing);
      });
      refreshCTA();
      return;
    }
    var actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    var action = actionEl.dataset.action;
    var id = activeModal.id;
    if (action === 'dismiss') {
      // a rapid double click lands its second click on the fresh backdrop;
      // ignore backdrop dismissals in the first beat after opening
      if (actionEl.classList.contains('modal-backdrop') && Date.now() - activeModal.openedAt < 300) return;
      closeModal();
    } else if (action === 'subscribe') {
      var addonInput = els.modal.querySelector('#m-addon-input');
      subscribe(id, activeModal.sel, addonInput ? addonInput.checked : false);
      closeModal();
    } else if (action === 'decline') {
      decline(id);
      closeModal();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (!activeModal) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
      return;
    }
    // aria-modal promises the backdrop is inert; keep the tab order inside
    if (e.key === 'Tab') {
      var focusables = els.modal.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      var inside = els.modal.contains(document.activeElement);
      if (e.shiftKey && (!inside || document.activeElement === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  /* ============================== scene interaction ============================== */

  function handleObject(id) {
    if (activeModal) return;
    if (!els.checkout.classList.contains('hidden')) return;
    if (id === 'door' && state.decisions.door) {
      goCheckout();
      return;
    }
    openModal(id);
  }

  els.scene.querySelectorAll('.obj').forEach(function (g) {
    var id = g.dataset.id;
    g.addEventListener('click', function () { handleObject(id); });
    g.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleObject(id);
      }
    });
  });

  els.leaveBtn.addEventListener('click', goCheckout);
  els.toastLeave.addEventListener('click', goCheckout);

  /* ============================== receipt / checkout ============================== */

  function exitMethod() {
    var d = state.decisions.door;
    if (d && d.status === 'subscribed') return 'front door (' + BY_ID.door.tiers[d.tier].name.toLowerCase() + ' hinge)';
    if (d && d.status === 'declined') return 'window, undignified';
    return 'door left on read';
  }

  function receiptLine(name, price, cls) {
    return '<div class="r-line' + (cls ? ' ' + cls : '') + '">' +
      '<span class="n">' + esc(name) + '</span><span class="dots"></span>' +
      '<span class="p">' + esc(price) + '</span></div>';
  }

  function buildReceipt() {
    var now = new Date();
    var dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
    var timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    var h = '';
    h += '<div class="r-store">YOU OWN NOTHING</div>';
    h += '<div class="r-substore">TENANT RECEIPT</div>';
    h += '<div class="r-meta">' + esc(dateStr) + ' &middot; ' + esc(timeStr) + ' &middot; lease #' + String(state.moveIns + 1).padStart(3, '0') + '</div>';
    h += '<hr class="r-rule">';

    OBJECTS.forEach(function (o) {
      var d = state.decisions[o.id];
      if (d && d.status === 'subscribed') {
        h += receiptLine(o.brand + ' ' + o.tiers[d.tier].name, money(o.tiers[d.tier].price), '');
        if (d.addon) h += receiptLine('+ protection plan', money(ADDON_PRICE), 'sub-line');
      } else if (d && d.status === 'declined') {
        h += receiptLine(o.brand, 'declined', 'muted');
      } else {
        h += receiptLine(o.brand, 'pending', 'muted');
      }
    });

    h += '<hr class="r-rule">';
    var total = totalMonthly();
    h += '<div class="r-line r-total"><span class="n">MONTHLY TOTAL</span><span class="dots"></span><span class="p">' + money(total) + '</span></div>';
    h += receiptLine('PER YEAR', money(total * 12), '');
    h += receiptLine('EXIT METHOD', exitMethod(), '');
    h += '<hr class="r-rule">';
    h += '<div class="own-zero">Items you actually own: 0</div>';
    h += '<div class="r-verdict">' + esc(VERDICTS[Math.floor(Math.random() * VERDICTS.length)]) + '</div>';
    h += '<div class="r-barcode" id="r-barcode"></div>';
    h += '<div class="r-domain">' + esc(DOMAIN) + '</div>';
    els.receipt.innerHTML = h;

    var bc = document.getElementById('r-barcode');
    for (var i = 0; i < 42; i++) {
      var bar = document.createElement('i');
      bar.style.width = (1 + Math.floor(Math.random() * 3)) + 'px';
      bar.style.marginRight = (1 + Math.floor(Math.random() * 2)) + 'px';
      bc.appendChild(bar);
    }
  }

  function goCheckout() {
    if (activeModal) closeModal();
    buildReceipt();
    els.checkout.classList.remove('hidden');
    els.toast.classList.add('hidden');
    document.body.style.overflow = 'hidden';
    els.checkout.scrollTop = 0;
  }

  function moveInAgain() {
    state.decisions = {};
    state.moveIns += 1;
    saveState();
    OBJECTS.forEach(function (o) { applyObjectState(o.id); });
    els.checkout.classList.add('hidden');
    document.body.style.overflow = '';
    updateHUD();
  }

  els.btnAgain.addEventListener('click', moveInAgain);

  /* ============================== share: text + PNG card ============================== */

  function topAbsurd(limit) {
    return OBJECTS
      .filter(function (o) { var d = state.decisions[o.id]; return d && d.status === 'subscribed'; })
      .sort(function (a, b) { return b.absurdity - a.absurdity; })
      .slice(0, limit);
  }

  function shareText() {
    var subs = topAbsurd(5);
    var allSubs = OBJECTS.filter(function (o) {
      var d = state.decisions[o.id];
      return d && d.status === 'subscribed';
    });
    var lines = ['YOU OWN NOTHING — my apartment, itemized', ''];
    if (allSubs.length === 0) {
      lines.push('No subscriptions. The apartment is a husk.');
    } else {
      subs.forEach(function (o) {
        var d = state.decisions[o.id];
        lines.push(o.thing + ' · ' + o.brand + ' ' + o.tiers[d.tier].name + ' — ' + money(objectMonthly(o.id)) + '/mo');
      });
      if (allSubs.length > subs.length) {
        lines.push('(+' + (allSubs.length - subs.length) + ' more subscriptions)');
      }
    }
    lines.push('');
    lines.push('MONTHLY TOTAL: ' + money(totalMonthly()) + '/mo');
    lines.push('Items I actually own: 0');
    lines.push('');
    lines.push('the cat is on a free trial');
    lines.push('https://' + DOMAIN);
    return lines.join('\n');
  }

  function drawShareCard() {
    var W = 720, H = 1000;
    var canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');

    // backdrop
    ctx.fillStyle = '#241c15';
    ctx.fillRect(0, 0, W, H);

    var subs = topAbsurd(5);
    var allSubCount = OBJECTS.filter(function (o) {
      var d = state.decisions[o.id];
      return d && d.status === 'subscribed';
    }).length;
    var moreCount = allSubCount - subs.length;

    // paper hugs its content and sits centered — no dead thermal paper
    var itemsH = subs.length ? subs.length * 34 + (moreCount > 0 ? 30 : 0) + 6 : 70;
    var paperH = 176 + itemsH + 282 + 36;

    // receipt paper with torn edges
    var px = 90, pw = 540, tooth = 18, toothH = 11;
    var pt = Math.round((H - paperH) / 2), pb = pt + paperH;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;
    ctx.beginPath();
    ctx.moveTo(px, pt);
    var x;
    for (x = px; x < px + pw; x += tooth) {
      ctx.lineTo(x + tooth / 2, pt - toothH);
      ctx.lineTo(Math.min(x + tooth, px + pw), pt);
    }
    ctx.lineTo(px + pw, pb);
    for (x = px + pw; x > px; x -= tooth) {
      ctx.lineTo(x - tooth / 2, pb + toothH);
      ctx.lineTo(Math.max(x - tooth, px), pb);
    }
    ctx.closePath();
    ctx.fillStyle = '#fbfaf5';
    ctx.fill();
    ctx.restore();

    var ink = '#232323';
    var faint = '#6f6a5e';
    var mono = "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";
    var cx = W / 2;
    var y = pt + 76;

    ctx.textAlign = 'center';
    ctx.fillStyle = ink;
    ctx.font = '700 30px ' + mono;
    ctx.fillText('YOU OWN NOTHING', cx, y);
    y += 26;
    ctx.font = '13px ' + mono;
    ctx.fillStyle = faint;
    ctx.fillText('T E N A N T   R E C E I P T', cx, y);
    y += 34;

    function dashed(yy) {
      ctx.save();
      ctx.strokeStyle = '#b5b0a4';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(px + 34, yy);
      ctx.lineTo(px + pw - 34, yy);
      ctx.stroke();
      ctx.restore();
    }

    dashed(y);
    y += 40;

    var left = px + 38, right = px + pw - 38;
    ctx.font = '17px ' + mono;
    if (subs.length === 0) {
      ctx.fillStyle = faint;
      ctx.textAlign = 'center';
      ctx.fillText('nothing subscribed. nothing owned.', cx, y);
      y += 30;
      ctx.fillText('consistent.', cx, y);
      y += 40;
    } else {
      subs.forEach(function (o) {
        var name = o.thing + ' · ' + o.brand;
        if (name.length > 30) name = name.slice(0, 29) + '…';
        ctx.fillStyle = ink;
        ctx.textAlign = 'left';
        ctx.fillText(name, left, y);
        ctx.textAlign = 'right';
        ctx.fillText(money(objectMonthly(o.id)), right, y);
        y += 34;
      });
      if (moreCount > 0) {
        // the five most absurd made the card; the rest still bill
        ctx.fillStyle = faint;
        ctx.font = '15px ' + mono;
        ctx.textAlign = 'left';
        ctx.fillText('+ ' + moreCount + ' more subscription' + (moreCount === 1 ? '' : 's'), left, y);
        ctx.font = '17px ' + mono;
        y += 30;
      }
      y += 6;
    }

    dashed(y);
    y += 44;

    ctx.font = '700 22px ' + mono;
    ctx.fillStyle = ink;
    ctx.textAlign = 'left';
    ctx.fillText('MONTHLY TOTAL', left, y);
    ctx.textAlign = 'right';
    ctx.fillText(money(totalMonthly()), right, y);
    y += 28;
    ctx.font = '14px ' + mono;
    ctx.fillStyle = faint;
    ctx.textAlign = 'left';
    ctx.fillText('PER YEAR', left, y);
    ctx.textAlign = 'right';
    ctx.fillText(money(totalMonthly() * 12), right, y);
    y += 40;

    // the verdict, inverted
    ctx.fillStyle = ink;
    ctx.fillRect(left - 8, y - 26, right - left + 16, 40);
    ctx.fillStyle = '#fbfaf5';
    ctx.font = '700 17px ' + mono;
    ctx.textAlign = 'center';
    ctx.fillText('ITEMS YOU ACTUALLY OWN: 0', cx, y + 1);
    y += 52;

    ctx.fillStyle = '#55503f';
    ctx.font = 'italic 15px ' + mono;
    ctx.fillText('YOU OWN NOTHING · the cat is on a free trial', cx, y);
    y += 46;

    // barcode
    var bx = cx - 130;
    ctx.fillStyle = ink;
    while (bx < cx + 130) {
      var bw = 2 + Math.floor(Math.random() * 4);
      ctx.fillRect(bx, y, bw, 46);
      bx += bw + 2 + Math.floor(Math.random() * 4);
    }
    y += 72;

    ctx.fillStyle = faint;
    ctx.font = '14px ' + mono;
    ctx.fillText(DOMAIN, cx, y);

    return canvas;
  }

  els.btnSave.addEventListener('click', function () {
    var url = drawShareCard().toDataURL('image/png');
    var a = document.createElement('a');
    a.href = url;
    a.download = 'you-own-nothing-receipt.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  var copyResetTimer = null;
  function flashCopyLabel(label) {
    var original = 'copy text';
    els.btnCopy.textContent = label;
    if (copyResetTimer) clearTimeout(copyResetTimer);
    copyResetTimer = setTimeout(function () { els.btnCopy.textContent = original; }, 1600);
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) {
      return false;
    }
  }

  els.btnCopy.addEventListener('click', function () {
    var text = shareText();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { flashCopyLabel('copied'); },
        function () { flashCopyLabel(fallbackCopy(text) ? 'copied' : 'copy failed'); }
      );
    } else {
      flashCopyLabel(fallbackCopy(text) ? 'copied' : 'copy failed');
    }
  });

  /* ============================== init ============================== */

  loadState();
  OBJECTS.forEach(function (o) { applyObjectState(o.id); });
  renderTotal(totalMonthly(), true);
  updateHUD();

  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      document.body.classList.remove('preload');
    });
  });

  // test hooks (and a small courtesy to the curious)
  window.YON = {
    version: 1,
    state: state,
    objects: OBJECTS,
    shareText: shareText,
    shareCardDataURL: function () { return drawShareCard().toDataURL('image/png'); },
    totalMonthly: totalMonthly,
    openModal: openModal
  };

})();
