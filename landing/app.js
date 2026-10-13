/* ------------------------------------------------------------------
   Landing page script.
   Pulls live numbers + latest filings from the app's public endpoint
   and fills the placeholders. If the API is unreachable the static
   fallback text in the HTML simply stays.

   Hosting on its own domain: edit config.js (APP_URL / API_URL).
   Nothing else needs to change.
------------------------------------------------------------------- */
(function () {
  "use strict";

  var CFG = window.LANDING_CONFIG || {};
  var APP_URL = (CFG.APP_URL || "").replace(/\/$/, "");   // "" = same origin as this page
  var API_BASE = (CFG.API_URL || APP_URL).replace(/\/$/, "");
  var ENDPOINT = API_BASE + "/api/public/landing";

  // ---------- helpers ----------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function num(n) { return Number(n || 0).toLocaleString("en-US"); }
  function party(p) { return !p ? "i" : /^Rep/.test(p) ? "r" : /^Dem/.test(p) ? "d" : "i"; }
  function money(a, b) {
    function f(n) { return n >= 1e6 ? "$" + (n / 1e6).toFixed(n % 1e6 ? 1 : 0) + "M" : n >= 1e3 ? "$" + Math.round(n / 1e3) + "K" : "$" + n; }
    if (a == null && b == null) return "—";
    if (a != null && b != null && a !== b) return f(a) + "–" + f(b);
    return f(a != null ? a : b);
  }
  function ago(d) {
    if (!d) return "";
    var days = Math.floor((Date.now() - new Date(d).getTime()) / 864e5);
    return days <= 0 ? "today" : days === 1 ? "yesterday" : days < 30 ? days + " days ago" : d;
  }
  function setAll(attr, value, text) {
    $$("[" + attr + (value ? '="' + value + '"' : "") + "]").forEach(function (el) { el.textContent = text; });
  }

  // ---------- render ----------
  function renderBrand(d) {
    if (!d.brand) return;
    var short = d.brand.replace(/\s*AI$/i, "");
    var b1 = $(".brand .b1"), bb = $(".brand b");
    if (b1 && bb && short.length > 6) { b1.textContent = short.slice(0, 4); bb.textContent = short.slice(4); }
    setAll("data-brand", null, d.brand);
    setAll("data-brand-short", null, short);
    setAll("data-company", null, d.company || d.brand);
    if (d.contact) { $$("[data-mail]").forEach(function (a) { a.href = "mailto:" + d.contact; a.textContent = d.contact; }); }
    document.title = d.brand + " — Congress stock trade tracker · public STOCK Act disclosures";
  }

  function renderStats(s) {
    if (!s) return;
    setAll("data-stat", "trades", num(s.trades));
    setAll("data-stat", "politicians", num(s.politicians));
    setAll("data-stat", "issuers", num(s.issuers));
    setAll("data-stat", "since", String(s.first_date || "2014").slice(0, 4));
    setAll("data-stat", "last", ago(s.last_pub) || "daily");
  }

  function renderLatest(rows) {
    var box = $("#latest"); if (!box || !rows || !rows.length) return;
    box.innerHTML = rows.map(function (t) {
      return '<div class="row">' +
        '<span class="pill ' + esc(t.tx_type) + '">' + esc(String(t.tx_type).toUpperCase()) + '</span>' +
        '<div class="who"><b><span class="tk">' + esc(t.ticker) + '</span> · ' + esc(t.issuer) + '</b>' +
        '<small><span class="dot ' + party(t.party) + '"></span>' + esc(t.politician) + (t.chamber ? ' · ' + esc(t.chamber) : '') + (t.state ? ' · ' + esc(t.state) : '') + '</small></div>' +
        '<div class="amt">' + money(t.amount_min, t.amount_max) + '<small>filed ' + esc(ago(t.published_date)) + '</small></div>' +
        '</div>';
    }).join("");
  }

  function renderActive(rows) {
    var ul = $("#active"); if (!ul || !rows || !rows.length) return;
    ul.innerHTML = rows.map(function (p) {
      return '<li><span><span class="dot ' + party(p.party) + '"></span>' + esc(p.name) +
        ' <small>' + esc(p.chamber || "") + (p.state ? " · " + esc(p.state) : "") + '</small></span><span>' + num(p.n) + ' filings</span></li>';
    }).join("");
  }

  function renderPopular(rows) {
    var ul = $("#popular"); if (!ul || !rows || !rows.length) return;
    ul.innerHTML = rows.map(function (i) {
      return '<li><span><span class="tk">' + esc(i.ticker) + '</span> ' + esc(i.name) + '</span><span>' + num(i.pols) + ' lawmakers</span></li>';
    }).join("");
  }

  function clearSkeletons() { $$(".skeleton").forEach(function (el) { el.classList.remove("skeleton"); el.style.display = "none"; }); }

  // ---------- load ----------
  function load() {
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = ctrl && setTimeout(function () { ctrl.abort(); }, 8000);
    fetch(ENDPOINT, { signal: ctrl && ctrl.signal, headers: { accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        renderBrand(d); renderStats(d.stats); renderLatest(d.latest); renderActive(d.active); renderPopular(d.popular);
      })
      .catch(function () { /* keep static fallback copy */ })
      .then(function () { if (timer) clearTimeout(timer); clearSkeletons(); });
  }

  // footer year
  setAll("data-year", null, String(new Date().getFullYear()));

  // point every app link (/signup, /login, /faq, /terms …) at APP_URL and carry
  // ?plan=pro + UTM params through to sign-up / sign-in for ad tracking
  var qs = new URLSearchParams(window.location.search);
  $$('a[href^="/"]').forEach(function (a) {
    var href = a.getAttribute("href");
    if (href === "/" ) { a.setAttribute("href", APP_URL ? APP_URL + "/" : "/"); return; }
    var url = new URL(href, APP_URL || window.location.origin);
    if (/^\/(signup|login)/.test(url.pathname)) qs.forEach(function (v, k) { if (!url.searchParams.has(k)) url.searchParams.set(k, v); });
    a.setAttribute("href", APP_URL ? url.href : url.pathname + url.search);
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load); else load();
})();
