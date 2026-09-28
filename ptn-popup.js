/*!
 * ResinTech periodic table — native popup (#pt-popup) controller.
 *
 * Takes over window.openDetail() from periodic-table.min.js and shows the
 * Webflow-built popup instead of the old JS-rendered one.
 *   - Left/middle cards: filled from window.PTDATA (exposed by periodic-table.min.js).
 *   - Products card: built from the hidden CMS Collection List inside #pt-popup
 *     (Test Contaminants Lists Copy → Related Products), grouped by Product Category.
 *   - Table tiles: "RT" badges are recalculated from the same CMS data.
 *
 * SAFE ROLLOUT: only active when the URL has ?ptn=1 (or localStorage "ptn" = "1").
 * Everyone else keeps the old popup. Set PTN_DEFAULT_ON = true to go live.
 */
(function () {
  "use strict";

  var PTN_DEFAULT_ON = false; // flip to true at go-live
  var SHOW_FILTERS = false;   // Related Filters is empty in the CMS for now
  var VISIBLE_PILLS = 5;      // pills shown before "View all"

  // Element symbol → CMS slugs (Test Contaminants Lists Copy).
  // Elements not listed fall back to their name in lowercase (e.g. "magnesium").
  var SLUGS = {
    Ag: ["silver"], Al: ["aluminum"], As: ["arsenic"], Au: ["gold", "gold-chloride-or-cyanide"],
    B: ["boron", "borate"], Ba: ["barium"], Br: ["bromine"], C: ["carbon-dioxide"], Ca: ["calcium"],
    Cd: ["cadmium"], Cl: ["chlorine", "chloride", "perchlorate", "chloramine", "chlorate"],
    Co: ["cobalt"], Cr: ["chromate", "chromium-trichrome"], Cs: ["cesium"], Cu: ["copper", "copper-oxides"],
    F: ["fluoride"], Fe: ["iron", "ferrous-iron", "ferric", "iron-oxides"], Hg: ["mercury"],
    I: ["iodine", "iodide", "iodate"], Ir: ["iridium"], K: ["potassium"], Mg: ["magnesium"],
    Mn: ["manganese"], Mo: ["molybdenum", "molybdenum-molybdate", "molybdate"], N: ["nitrate", "ammonia"],
    Na: ["sodium"], Nb: ["niobium"], Ni: ["nickel"], O: ["oxygen"], Os: ["osmium"],
    P: ["phosphate", "phosphorous"], Pb: ["lead"], Pd: ["palladium"], Pt: ["platinum", "chloroplatinate"],
    Ra: ["radium"], Rh: ["rhodium"], Ru: ["ruthenium"], S: ["sulfate", "hydrogen-sulfide", "sulfur"],
    Se: ["selenium", "selenium-selenate", "selenate"], Si: ["silica", "silicon"], Sr: ["strontium"],
    Tc: ["technitium-pertechnetate", "pertechnetate"], U: ["uranium", "uranium-oxide"],
    W: ["tungsten", "tungsten-tungstate", "tungstate"], Zn: ["zinc"], Li: ["lithium"],
    V: ["vanadium", "vanadium-vanadate"], Ga: ["gallium-arsenide"], Zr: ["zirconium-zirconate"],
    Sb: ["antimony", "antimony-antimonate"], Gd: ["gadolinium", "gadolinium-gadolinium-sulfate"],
    Tl: ["thallium"], Th: ["thorium"], Pu: ["plutonium"], Am: ["americium"]
  };

  var GROUPS = [
    { key: "specialty", title: "Specialty Media" },
    { key: "standard", title: "Standard Resins" },
    { key: "carbon", title: "Carbon" },
    { key: "filters", title: "Filters" }
  ];

  var THREATS = {
    limited: "Limited Availability - Future risk to supply",
    rising: "Rising Threat - From increased use",
    serious: "Serious Threat - In the next 100 years"
  };

  function enabled() {
    if (PTN_DEFAULT_ON) return true;
    if (/[?&]ptn=1\b/.test(location.search)) return true;
    try { return localStorage.getItem("ptn") === "1"; } catch (e) { return false; }
  }

  // ---------- helpers ----------
  function $(root, sel) { return root.querySelector(sel); }
  function slot(root, name) { return $(root, '[data-pt="' + name + '"]'); }
  function titleCase(s) { return s.replace(/-/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // Same ordering as the old popup: CN before CG, then natural (number-aware) order.
  function compareNames(a, b) {
    var aCN = /^CN/i.test(a), bCN = /^CN/i.test(b), aCG = /^CG/i.test(a), bCG = /^CG/i.test(b);
    if (aCN && bCG) return -1;
    if (aCG && bCN) return 1;
    var pa = a.match(/(\D+|\d+)/g) || [], pb = b.match(/(\D+|\d+)/g) || [];
    for (var i = 0; i < Math.max(pa.length, pb.length); i++) {
      if (i >= pa.length) return -1;
      if (i >= pb.length) return 1;
      var na = parseInt(pa[i], 10), nb = parseInt(pb[i], 10);
      if (isNaN(na) || isNaN(nb)) {
        var c = pa[i].localeCompare(pb[i]);
        if (c !== 0) return c;
      } else if (na !== nb) return na - nb;
    }
    return 0;
  }

  // Webflow hides conditionally-invisible items with this class.
  function isVisible(node) { return !node.closest(".w-condition-invisible"); }

  // ---------- left + middle cards ----------
  function setRow(root, key, value, asHTML) {
    var target = slot(root, key);
    if (!target) return;
    var row = target.closest("[data-pt-row]") || target;
    if (value) {
      if (asHTML) target.innerHTML = value; else target.textContent = value;
      row.style.display = "";
    } else {
      row.style.display = "none";
    }
  }

  function fillSummary(root, elData, extra) {
    var s = elData.summary || {}, d = elData.detail || {}, g = d.general || {}, p = d.physical || {};

    var tile = slot(root, "tile");
    if (tile) tile.className = "ptn-tile ptn-cat-" + elData.category;
    setRow(root, "number", String(elData.atomicNumber));
    setRow(root, "symbol", elData.symbol);
    setRow(root, "name", elData.name);
    setRow(root, "mass", elData.isSynthetic ? "[" + elData.atomicMass + "]" : String(elData.atomicMass));

    setRow(root, "atomicMass", s.atomicMass);
    setRow(root, "electronConfig", s.electronConfiguration, true); // contains <sup>
    setRow(root, "electronegativity", s.electronegativity);
    setRow(root, "standardState", extra.standardState ? titleCase(extra.standardState) : null);
    setRow(root, "occurrence", extra.naturalOccurrence ? titleCase(extra.naturalOccurrence) : null);

    // Badges: the Designer badge is the template; extra badges are clones.
    var badge = slot(root, "badge");
    if (badge) {
      Array.prototype.forEach.call(root.querySelectorAll('[data-pt="badge-extra"]'), function (n) { n.remove(); });
      var badges = [];
      if (elData.threatLevel && THREATS[elData.threatLevel]) {
        badges.push({ cls: "ptn-badge-" + elData.threatLevel, text: "⚠ " + THREATS[elData.threatLevel] });
      }
      if (extra.radioactive) badges.push({ cls: "ptn-badge-radioactive", text: "☢ Radioactive - All isotopes unstable" });
      if (!badges.length) {
        badge.style.display = "none";
      } else {
        badge.style.display = "";
        badge.className = "ptn-badge " + badges[0].cls;
        badge.textContent = badges[0].text;
        var after = badge;
        badges.slice(1).forEach(function (b) {
          var c = badge.cloneNode(false);
          c.setAttribute("data-pt", "badge-extra");
          c.className = "ptn-badge " + b.cls;
          c.textContent = b.text;
          after.parentNode.insertBefore(c, after.nextSibling);
          after = c;
        });
      }
    }

    setRow(root, "appearance", g.appearance);
    setRow(root, "phase", p.phase);
    setRow(root, "meltingPoint", p.meltingPoint);
    setRow(root, "boilingPoint", p.boilingPoint);
    var physical = slot(root, "physical");
    if (physical) physical.style.display = (g.appearance || p.phase || p.meltingPoint || p.boilingPoint) ? "" : "none";

    var desc = slot(root, "description");
    if (desc) {
      Array.prototype.forEach.call(desc.querySelectorAll(".ptn-desc-text"), function (n) { n.remove(); });
      var paras = Array.isArray(d.description) ? d.description : (d.description ? [d.description] : []);
      paras.forEach(function (t) { desc.appendChild(el("p", "ptn-desc-text", t)); });
    }
  }

  // ---------- products card ----------
  function collectProducts(root, symbol, name) {
    var slugs = SLUGS[symbol] || [name.toLowerCase()];
    var groups = { specialty: [], standard: [], carbon: [], filters: [] };
    var seen = {};

    Array.prototype.forEach.call(root.querySelectorAll(".ptn-prod-entry"), function (entry) {
      var key = $(entry, '[data-pt="slug"]');
      if (!key || slugs.indexOf(key.textContent.trim()) === -1) return;

      // Resins & media: read the Specialty list (it carries the hidden category label).
      var media = $(entry, '[data-group="specialty"]');
      if (media) {
        Array.prototype.forEach.call(media.querySelectorAll(".w-dyn-item"), function (item) {
          var a = $(item, "a.ptn-prod-pill");
          if (!a || !isVisible(item)) return;
          var label = a.textContent.trim();
          var href = a.getAttribute("href") || "#";
          var id = href !== "#" ? href : label;
          if (!label || seen[id]) return;
          seen[id] = true;
          var catNode = $(item, '[data-pt="category"]');
          var cat = catNode ? catNode.textContent.trim() : "";
          var g = cat === "Specialty Media" ? "specialty" : cat === "Granular Activated Carbon" ? "carbon" : "standard";
          groups[g].push({ label: label, href: href });
        });
      }

      if (SHOW_FILTERS) {
        var filt = $(entry, '[data-group="filters"]');
        if (filt) {
          Array.prototype.forEach.call(filt.querySelectorAll("a.ptn-prod-pill"), function (a) {
            var label = a.textContent.trim();
            if (!label || seen["f:" + label]) return;
            seen["f:" + label] = true;
            groups.filters.push({ label: label, href: a.getAttribute("href") || "#" });
          });
        }
      }
    });

    Object.keys(groups).forEach(function (k) {
      groups[k].sort(function (x, y) { return compareNames(x.label, y.label); });
    });
    return groups;
  }

  function renderGroup(g, items) {
    var wrap = el("div", "ptn-prod-group");
    wrap.setAttribute("data-group", g.key);
    // The embed CSS hides .ptn-prod-group without CMS items; rendered groups must stay visible.
    wrap.style.display = "block";
    var h = el("h5", "ptn-prod-group-title", g.title + " ");
    h.appendChild(el("span", "ptn-prod-count", "(" + items.length + ")"));
    wrap.appendChild(h);

    var list = el("div", "ptn-prod-list");
    items.forEach(function (it, i) {
      var a = el("a", "ptn-prod-pill", it.label);
      a.href = it.href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      // .ptn-prod-pill sets display, so the hidden attribute alone would not hide it.
      if (i >= VISIBLE_PILLS) { a.style.display = "none"; a.setAttribute("data-ptn-extra", ""); }
      list.appendChild(a);
    });
    wrap.appendChild(list);

    if (items.length > VISIBLE_PILLS) {
      var btn = el("button", "ptn-prod-more", "View all " + items.length + " products");
      btn.type = "button";
      btn.addEventListener("click", function () {
        var open = btn.getAttribute("aria-expanded") === "true";
        Array.prototype.forEach.call(list.querySelectorAll("[data-ptn-extra]"), function (n) { n.style.display = open ? "none" : ""; });
        btn.setAttribute("aria-expanded", String(!open));
        btn.textContent = open ? "View all " + items.length + " products" : "Show less";
      });
      wrap.appendChild(btn);
    }
    return wrap;
  }

  function fillProducts(root, elData) {
    var card = $(root, ".ptn-card-products");
    var out = slot(root, "groups");
    if (!card || !out) return;
    out.innerHTML = "";

    var groups = collectProducts(root, elData.symbol, elData.name);
    var total = 0;
    GROUPS.forEach(function (g) {
      if (!groups[g.key].length) return;
      total += groups[g.key].length;
      out.appendChild(renderGroup(g, groups[g.key]));
    });

    var intro = slot(root, "intro");
    if (intro) intro.textContent = "Resins, media, and filters for " + elData.name.toLowerCase() + " removal";
    card.style.display = total ? "" : "none";
  }

  // ---------- "RT" badges on the table tiles ----------   // NEW
  // The old script draws badges from its hardcoded list; replace them with CMS counts.
  // The grid is re-rendered (innerHTML) whenever a filter changes, so re-apply on each redraw.
  var badgeCounts = null;

  function countsFromCms() {
    var counts = {};
    window.PTDATA.elements.forEach(function (e) {
      var g = collectProducts(overlay, e.symbol, e.name), n = 0;
      Object.keys(g).forEach(function (k) { n += g[k].length; });
      if (n) counts[e.atomicNumber] = n;
    });
    return counts;
  }

  function syncBadges(grid) {
    if (!badgeCounts) badgeCounts = countsFromCms();
    Array.prototype.forEach.call(grid.querySelectorAll(".cell[data-atomic]"), function (cell) {
      var n = badgeCounts[cell.getAttribute("data-atomic")];
      var badge = $(cell, ".rt-badge");
      if (!n) { if (badge) badge.remove(); return; }
      if (!badge) {
        badge = el("div", "rt-badge", "RT");
        cell.appendChild(badge);
      }
      badge.title = "ResinTech: " + n + " products - click for details";
    });
  }

  function watchGrid() {
    var grid = document.getElementById("periodic-grid");
    if (!grid) return;
    var pending = false;
    var observer = new MutationObserver(function () {
      if (pending) return;
      pending = true;
      // Wait for the redraw to finish; our own edits then trigger at most one no-op pass.
      requestAnimationFrame(function () {
        observer.disconnect();
        syncBadges(grid);
        observer.observe(grid, { childList: true });
        pending = false;
      });
    });
    syncBadges(grid);
    observer.observe(grid, { childList: true });
  }

  // ---------- open / close ----------
  var overlay, lastFocus;

  function close() {
    if (!overlay || !overlay.classList.contains("ptn-open")) return;
    overlay.classList.remove("ptn-open");
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function open(atomicNumber) {
    var data = window.PTDATA;
    var elData = data && data.elements.filter(function (x) { return x.atomicNumber === atomicNumber; })[0];
    if (!elData) return false;

    fillSummary(overlay, elData, (data.extra && data.extra[elData.symbol]) || {});
    fillProducts(overlay, elData);

    lastFocus = document.activeElement;
    overlay.classList.add("ptn-open");
    document.body.style.overflow = "hidden";
    var modal = $(overlay, ".ptn-modal");
    if (modal) modal.scrollTop = 0;
    var x = slot(overlay, "close");
    if (x) x.focus();
    return true;
  }

  function init() {
    overlay = document.getElementById("pt-popup");
    if (!overlay || !enabled() || !window.PTDATA || typeof window.openDetail !== "function") return false;

    var oldOpen = window.openDetail;
    window.openDetail = function (n) {
      try {
        if (open(Number(n))) return;
      } catch (err) {
        if (window.console) console.error("PTN popup error, falling back:", err);
      }
      oldOpen(n); // anything unexpected → old popup still works
    };

    var x = slot(overlay, "close");
    if (x) {
      x.addEventListener("click", close);
      x.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); close(); }
      });
    }
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    try { watchGrid(); } catch (err) { if (window.console) console.error("PTN badges:", err); } // NEW
    return true;
  }

  // The periodic-table script(s) load with defer; wait until openDetail + PTDATA exist.
  if (!enabled()) return;
  var tries = 0;
  (function boot() {
    if (init() || ++tries > 40) return;
    setTimeout(boot, 250);
  })();
})();
