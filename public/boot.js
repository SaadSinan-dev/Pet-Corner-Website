/* Initial shell only: network queries and route changes never show this screen again. */
(() => {
  const splash = document.getElementById('startup-splash');
  let finished = false;
  const fail = () => {
    if (finished || !splash) return;
    if (document.getElementById('root')?.childElementCount) { ready(); return; }
    splash.dataset.failed = 'true';
    splash.setAttribute('role', 'alert');
    splash.setAttribute('aria-label', 'تعذّر فتح المتجر');
  };
  const timer = setTimeout(fail, 8000);
  function ready() {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    window.removeEventListener('error', fail);
    window.removeEventListener('petcorner:ready', ready);
    if (!splash) return;
    splash.dataset.ready = 'true';
    splash.setAttribute('aria-hidden', 'true');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) splash.remove();
    else setTimeout(() => splash.remove(), 170);
  }
  window.addEventListener('petcorner:ready', ready);
  window.addEventListener('error', fail);
  document.getElementById('boot-retry')?.addEventListener('click', () => location.reload());
})();
