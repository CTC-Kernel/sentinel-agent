// Applies the saved theme, or the system one, before the first paint so a
// dark-mode user never sees a light frame while the bundle loads. It lives in
// a file rather than inline in index.html so the production
// Content-Security-Policy can forbid inline scripts.
(function () {
  var theme = null;
  try { theme = localStorage.getItem("nexus:theme"); } catch (e) { /* storage blocked */ }
  if (theme !== "dark" && theme !== "light") {
    theme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
})();
