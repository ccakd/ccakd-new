/**
 * Keystatic GitHub mode: handle stale branch SHA from bot commits.
 *
 * When GitHub Actions bot pushes commits (translations, manifests) after
 * a user saves content, Keystatic's cached branch SHA becomes stale.
 * This script:
 * 1. Watches for stale data error messages and adds a "Reload" button
 * 2. After a successful save (URL changes to list view), refreshes the
 *    page state so the next operation uses the latest SHA
 */
(function () {
  'use strict';

  // 1. Watch for error toasts containing stale data messages
  const observer = new MutationObserver(function (mutations) {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        const text = (node.textContent || '').toLowerCase();
        if (
          text.includes('has been updated') ||
          text.includes('stale') ||
          text.includes('could not commit') ||
          text.includes('base tree out of date')
        ) {
          const reloadBtn = document.createElement('button');
          reloadBtn.textContent = 'Reload to get latest';
          reloadBtn.style.cssText =
            'display:block;margin-top:8px;padding:6px 16px;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;';
          reloadBtn.onclick = function () {
            window.location.reload();
          };
          // Avoid duplicates
          if (!node.querySelector('button')) {
            node.appendChild(reloadBtn);
          }
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
