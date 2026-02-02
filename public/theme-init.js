/**
 * Theme initialization - must run before first paint to prevent flash.
 * Externalized from index.html to eliminate CSP 'unsafe-inline' requirement.
 */
(function () {
  var storedTheme = localStorage.getItem('theme');
  if (storedTheme === 'dark' || !storedTheme) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
})();
