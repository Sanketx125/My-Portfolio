(function () {
  "use strict";

  const canvas = document.getElementById("project-map");
  const panel = document.getElementById("map-panel");
  const listEl = document.getElementById("map-list");
  const dataEl = document.getElementById("map-data");
  if (!canvas || !dataEl) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let projects = [];
  try { projects = JSON.parse(dataEl.textContent) || []; } catch (e) { projects = []; }

  const located = projects
    .map(function (p, index) { return { index: index, project: p }; })
    .filter(function (item) { return Array.isArray(item.project.coords) && item.project.coords.length === 2; });

  /* Graceful degradation: no Leaflet, or nothing to plot. */
  if (!window.L || !located.length) {
    if (panel) panel.classList.add("map-panel--fallback");
    if (canvas && !located.length) {
      canvas.insertAdjacentHTML("afterend",
        '<div class="resume-fallback"><p>Project locations are listed alongside.</p></div>');
    }
    return;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* Nudge markers that share an exact coordinate so every pin stays clickable. */
  const seen = {};
  function jitter(coords, index) {
    const key = coords[0].toFixed(3) + "," + coords[1].toFixed(3);
    const n = seen[key] = (seen[key] || 0) + 1;
    if (n === 1) return coords.slice();
    const angle = (n - 2) * 2.2;
    const radius = 0.012 * Math.ceil((n - 1) / 6);
    return [coords[0] + Math.sin(angle) * radius, coords[1] + Math.cos(angle) * radius];
  }

  const map = L.map(canvas, {
    scrollWheelZoom: false,
    zoomControl: true,
    attributionControl: true,
  });

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 19,
  }).addTo(map);

  const markers = {};
  const bounds = [];

  located.forEach(function (item) {
    const p = item.project;
    const position = jitter(p.coords, item.index);

    const icon = L.divIcon({
      className: "map-pin-wrap",
      html: '<span class="map-pin"></span>',
      iconSize: [15, 15],
      iconAnchor: [7.5, 7.5],
      popupAnchor: [0, -10],
    });

    const marker = L.marker(position, { icon: icon, title: p.title }).addTo(map);
    marker.bindPopup(
      "<strong>" + escapeHtml(p.title) + "</strong><br><span>" + escapeHtml(p.location || "") + "</span>"
    );

    marker.on("click", function () { activate(item.index, false); });
    markers[item.index] = { marker: marker, position: position };
    bounds.push(position);
  });

  if (bounds.length > 1) map.fitBounds(bounds, { padding: [48, 48] });
  else if (bounds.length === 1) map.setView(bounds[0], 9);

  function setActiveListItem(index) {
    if (!listEl) return;
    listEl.querySelectorAll(".map-list__item").forEach(function (el) {
      el.classList.toggle("is-active", Number(el.getAttribute("data-map-index")) === index);
    });
    document.querySelectorAll(".map-pin").forEach(function (pin) { pin.classList.remove("is-active"); });
    const entry = markers[index];
    if (entry) {
      const pin = entry.marker.getElement();
      if (pin) {
        const dot = pin.querySelector(".map-pin");
        if (dot) dot.classList.add("is-active");
      }
    }
  }

  function activate(index, scrollToList) {
    const entry = markers[index];
    if (!entry) return;
    setActiveListItem(index);
    map.flyTo(entry.position, Math.max(map.getZoom(), 10), {
      duration: reduceMotion ? 0 : 0.8,
    });
    entry.marker.openPopup();
    if (scrollToList && listEl) {
      const el = listEl.querySelector('[data-map-index="' + index + '"]');
      if (el) el.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
    }
  }

  if (listEl) {
    listEl.querySelectorAll(".map-list__item").forEach(function (el) {
      el.addEventListener("click", function () {
        activate(Number(el.getAttribute("data-map-index")), false);
      });
    });
  }

  /* Keep markers in sync with the Projects filter. */
  window.addEventListener("projects:filtered", function (e) {
    const filter = e.detail;
    Object.keys(markers).forEach(function (key) {
      const p = projects[key];
      const show = filter === "all" || (p && p.category === filter);
      const entry = markers[key];
      if (show) {
        if (!map.hasLayer(entry.marker)) map.addLayer(entry.marker);
      } else {
        map.removeLayer(entry.marker);
      }
    });
  });

  /* Reveal the map once its section scrolls into view (Leaflet needs a resize). */
  const mapSection = document.getElementById("map");
  if (mapSection && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        map.invalidateSize();
        obs.disconnect();
      });
    }, { threshold: 0.15 });
    io.observe(mapSection);
  }
})();
