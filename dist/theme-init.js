// Inicialización temprana de tema y tipografía (evita FOUC antes de montar React)
(function () {
  try {
    var THEMES = {
      rojo:      ["#E10600", "#A80000", "225,6,0", "#FFF5F4"],
      burdeos:   ["#800020", "#560016", "128,0,32", "#FFF5F4"],
      naranja:   ["#FF7A1A", "#E35E00", "255,122,26"],
      ambar:     ["#FFC94D", "#F2A900", "255,201,77", null, "#805000"],
      verde:     ["#2BD06E", "#0FA84F", "43,208,110"],
      turquesa:  ["#00D1B2", "#00A28A", "0,209,178"],
      azul:      ["#3B82F6", "#1D4ED8", "59,130,246"],
      violeta:   ["#8B5CF6", "#6D28D9", "139,92,246"],
      rosa:      ["#FF2A6D", "#D6245C", "255,42,109"],
      gris:      ["#9AA5B8", "#5F6B82", "154,165,184"],
    };
    var s = JSON.parse(localStorage.getItem("malla_session") || "null");
    var u = (s && s.user) || (s && !s.token ? s : null);
    var r = document.documentElement;
    var mode = (u && u.appMode) || "light";
    var c = THEMES[(u && u.appTheme)] || THEMES.ambar;
    r.setAttribute("data-theme", mode);
    r.style.setProperty("--accent", c[0]);
    r.style.setProperty("--accent2", c[1]);
    r.style.setProperty("--accent-rgb", c[2]);
    r.style.setProperty("--accent-ink", c[3] || "#14101F");
    r.style.setProperty("--accent-text", mode === "light" ? (c[4] || c[0]) : c[0]);
    r.style.setProperty("--accent-border", mode === "light" ? (c[5] || c[4] || c[0]) : c[0]);
    if (u && u.fontBody && u.fontBody !== "DM Sans") {
      r.style.setProperty("--font-body", "'" + u.fontBody + "', system-ui, sans-serif");
    }
  } catch (e) {}

  // Limpieza del parámetro _sw de la URL si el Service Worker recargó con él
  try {
    if (location.search.indexOf("_sw") !== -1) {
      var url = new URL(location.href);
      url.searchParams.delete("_sw");
      history.replaceState(null, "", url.pathname + (url.search ? "?" + url.search : "") + url.hash);
    }
  } catch (e) {}

  // Pausar animación del fondo mesh al cambiar visibilidad
  try {
    var setupBg = function () {
      var bg = document.querySelector(".bg");
      if (!bg) return;
      var sync = function () { bg.classList.toggle("bg-paused", document.hidden); };
      document.addEventListener("visibilitychange", sync);
      sync();
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", setupBg);
    } else {
      setupBg();
    }
  } catch (e) {}
})();
