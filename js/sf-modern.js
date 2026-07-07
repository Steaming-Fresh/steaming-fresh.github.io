(function () {
  'use strict';

  var toastTimer = null;

  function showToast(message) {
    var toast = document.querySelector('.sf-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'sf-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 1800);
  }

  function addReadingProgress() {
    if (document.getElementById('sf-reading-progress')) return;

    var progress = document.createElement('div');
    progress.id = 'sf-reading-progress';
    progress.setAttribute('aria-hidden', 'true');
    document.body.appendChild(progress);

    var ticking = false;
    function update() {
      var scrollTop = window.scrollY || document.documentElement.scrollTop;
      var maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      progress.style.transform = 'scaleX(' + Math.min(scrollTop / maxScroll, 1) + ')';
      document.documentElement.classList.toggle('sf-scrolled', scrollTop > 24);
      ticking = false;
    }

    function requestUpdate() {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }

    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate, { passive: true });
    update();
  }

  function addHeroActions() {
    var siteInfo = document.getElementById('site-info');
    if (!siteInfo || siteInfo.querySelector('.sf-hero-actions')) return;

    var actions = document.createElement('div');
    actions.className = 'sf-hero-actions';
    actions.innerHTML = [
      '<a href="/archives/"><i class="fas fa-archive" aria-hidden="true"></i><span>Archive</span></a>',
      '<a href="/tags/"><i class="fas fa-tags" aria-hidden="true"></i><span>Tags</span></a>',
      '<a href="/atom.xml"><i class="fas fa-rss" aria-hidden="true"></i><span>RSS</span></a>'
    ].join('');
    siteInfo.appendChild(actions);
  }

  function enhanceSearchShortcuts() {
    var searchLink = document.querySelector('#search-button a, .site-page.search');
    if (!searchLink) return;

    var fallbackCloseBound = false;

    function searchParts() {
      return {
        mask: document.getElementById('search-mask'),
        dialog: document.querySelector('#local-search .search-dialog'),
        closeButton: document.querySelector('#local-search .search-close-button'),
        input: document.querySelector('#local-search-input input')
      };
    }

    function isSearchVisible() {
      var parts = searchParts();
      return parts.dialog && window.getComputedStyle(parts.dialog).display !== 'none';
    }

    function closeSearchFallback() {
      var parts = searchParts();
      document.body.style.width = '';
      document.body.style.overflow = '';
      if (parts.dialog) {
        parts.dialog.style.display = 'none';
        parts.dialog.removeAttribute('data-sf-search-fallback');
      }
      if (parts.mask) parts.mask.style.display = 'none';
    }

    function bindSearchFallbackClose() {
      if (fallbackCloseBound) return;
      var parts = searchParts();
      if (parts.closeButton) parts.closeButton.addEventListener('click', closeSearchFallback);
      if (parts.mask) parts.mask.addEventListener('click', closeSearchFallback);
      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && isSearchVisible()) closeSearchFallback();
      });
      fallbackCloseBound = true;
    }

    function openSearchFallback() {
      var parts = searchParts();
      if (!parts.dialog || !parts.mask) return;

      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      parts.mask.style.display = 'block';
      parts.dialog.style.display = 'block';
      parts.dialog.setAttribute('data-sf-search-fallback', 'true');
      bindSearchFallbackClose();
      window.setTimeout(function () {
        if (parts.input) parts.input.focus();
      }, 0);
    }

    function scheduleSearchFallback() {
      window.setTimeout(function () {
        if (!isSearchVisible()) openSearchFallback();
      }, 120);
    }

    searchLink.setAttribute('aria-label', 'Open search');
    searchLink.setAttribute('aria-keyshortcuts', 'Control+K /');
    searchLink.title = 'Search (Ctrl+K or /)';
    searchLink.addEventListener('click', scheduleSearchFallback);

    window.addEventListener('load', function () {
      var parts = searchParts();
      if (parts.dialog && parts.dialog.getAttribute('data-sf-search-fallback') === 'true') {
        searchLink.click();
      }
    }, { once: true });

    document.addEventListener('keydown', function (event) {
      var target = event.target;
      var typing = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );
      if (typing) return;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchLink.click();
        return;
      }

      if (event.key === '/') {
        event.preventDefault();
        searchLink.click();
      }
    });
  }

  function slugFromText(text) {
    return text
      .trim()
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'section';
  }

  function addHeadingCopyLinks() {
    var headings = document.querySelectorAll('#article-container h1, #article-container h2, #article-container h3, #article-container h4');
    headings.forEach(function (heading) {
      if (heading.querySelector('.sf-heading-copy')) return;
      if (!heading.id) heading.id = slugFromText(heading.textContent);

      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'sf-heading-copy';
      button.setAttribute('aria-label', 'Copy heading link');
      button.textContent = '#';
      button.addEventListener('click', function () {
        var url = new URL(window.location.href);
        url.hash = heading.id;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url.href).then(function () {
            showToast('Heading link copied');
          }, function () {
            showToast(url.href);
          });
        } else {
          showToast(url.href);
        }
      });
      heading.appendChild(button);
    });
  }

  function markContentReady() {
    var items = document.querySelectorAll([
      '#recent-posts > .recent-post-item',
      '#aside-content .card-widget',
      '#post',
      '#page',
      '#archive',
      '#tag',
      '#category'
    ].join(','));

    if (!items.length) return;

    items.forEach(function (item) {
      item.classList.add('sf-reveal');
      item.classList.add('is-visible');
    });
  }

  function hardenExternalLinks() {
    document.querySelectorAll('#article-container a[href^="http"]').forEach(function (link) {
      if (link.hostname === window.location.hostname) return;
      var rel = new Set((link.rel || '').split(/\s+/).filter(Boolean));
      rel.add('noopener');
      rel.add('noreferrer');
      link.rel = Array.from(rel).join(' ');
      link.target = '_blank';
    });
  }

  function init() {
    addReadingProgress();
    addHeroActions();
    enhanceSearchShortcuts();
    addHeadingCopyLinks();
    markContentReady();
    hardenExternalLinks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
