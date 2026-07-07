(function () {
  'use strict';

  function readOptions(element) {
    var raw = element.getAttribute('data-sf-aplayer');
    if (!raw) return null;

    try {
      return JSON.parse(decodeURIComponent(raw));
    } catch (error) {
      console.error('[SteamedFresh] Invalid APlayer options', error);
      return null;
    }
  }

  function withVerifiedCover(options, callback) {
    if (!options || !options.music) {
      callback(options);
      return;
    }

    var music = options.music;
    var fallback = music.fallbackPic || '';
    var primary = music.pic || fallback;
    music.pic = primary || fallback;

    if (!primary || primary === fallback) {
      callback(options);
      return;
    }

    var settled = false;
    var image = new Image();

    function finish(cover) {
      if (settled) return;
      settled = true;
      music.pic = cover || fallback || primary;
      callback(options);
    }

    image.onload = function () {
      finish(primary);
    };
    image.onerror = function () {
      finish(fallback);
    };
    image.src = primary;

    window.setTimeout(function () {
      finish(primary);
    }, 3000);
  }

  function getPlayableDuration(player) {
    var duration = player.duration || (player.audio && player.audio.duration);
    return Number.isFinite(duration) && duration > 0 ? duration : 0;
  }

  function eventClientX(event) {
    var touch = event.changedTouches && event.changedTouches[0]
      ? event.changedTouches[0]
      : event.touches && event.touches[0];
    return touch ? touch.clientX : event.clientX;
  }

  function clampRatio(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value));
  }

  function secondToTime(seconds) {
    var totalSeconds = Math.max(0, Math.floor(seconds || 0));
    var hours = Math.floor(totalSeconds / 3600);
    var minutes = Math.floor((totalSeconds - hours * 3600) / 60);
    var restSeconds = totalSeconds - hours * 3600 - minutes * 60;
    var parts = hours > 0 ? [hours, minutes, restSeconds] : [minutes, restSeconds];
    return parts.map(function (value) {
      return value < 10 ? '0' + value : String(value);
    }).join(':');
  }

  function getSeekRatio(event, element) {
    var rect = element.getBoundingClientRect();
    if (!rect.width) return 0;
    return clampRatio((eventClientX(event) - rect.left) / rect.width);
  }

  function updateSeekPreview(player, ratio) {
    var duration = getPlayableDuration(player);
    if (player.bar && typeof player.bar.set === 'function') {
      player.bar.set('played', ratio, 'width');
    } else if (player.template && player.template.played) {
      player.template.played.style.width = (ratio * 100) + '%';
    }

    if (duration && player.template && player.template.ptime) {
      player.template.ptime.textContent = secondToTime(ratio * duration);
    }
  }

  function seekWhenReady(player, ratio) {
    var duration = getPlayableDuration(player);
    if (duration) {
      player.seek(ratio * duration);
      return;
    }

    if (!player.audio) return;
    player.audio.preload = 'metadata';
    player.audio.addEventListener('loadedmetadata', function handleLoadedMetadata() {
      var readyDuration = getPlayableDuration(player);
      if (readyDuration) player.seek(ratio * readyDuration);
    }, { once: true });
    player.audio.load();
  }

  function installSeekPatch(player) {
    if (!player || player.__sfSeekPatchInstalled || !player.template || !player.template.barWrap) return;
    player.__sfSeekPatchInstalled = true;

    var barWrap = player.template.barWrap;
    var dragging = false;
    var targetRatio = 0;

    function stopOriginalHandler(event) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }

    function beginSeek(event) {
      if (!barWrap.contains(event.target)) return;
      stopOriginalHandler(event);
      dragging = true;
      player.disableTimeupdate = true;
      targetRatio = getSeekRatio(event, barWrap);
      updateSeekPreview(player, targetRatio);
    }

    function moveSeek(event) {
      if (!dragging) return;
      stopOriginalHandler(event);
      targetRatio = getSeekRatio(event, barWrap);
      updateSeekPreview(player, targetRatio);
    }

    function endSeek(event) {
      if (!dragging) return;
      stopOriginalHandler(event);
      dragging = false;
      targetRatio = getSeekRatio(event, barWrap);
      updateSeekPreview(player, targetRatio);
      seekWhenReady(player, targetRatio);
      player.disableTimeupdate = false;
    }

    barWrap.addEventListener('mousedown', beginSeek, true);
    document.addEventListener('mousemove', moveSeek, true);
    document.addEventListener('mouseup', endSeek, true);
    barWrap.addEventListener('touchstart', beginSeek, { capture: true, passive: false });
    document.addEventListener('touchmove', moveSeek, { capture: true, passive: false });
    document.addEventListener('touchend', endSeek, { capture: true, passive: false });
  }

  function initPlayers() {
    if (typeof window.APlayer !== 'function') {
      console.error('[SteamedFresh] APlayer library was not loaded.');
      return;
    }

    window.aplayers = window.aplayers || [];

    document.querySelectorAll('[data-sf-aplayer]:not([data-sf-aplayer-ready])').forEach(function (element) {
      var options = readOptions(element);
      if (!options) return;

      element.setAttribute('data-sf-aplayer-ready', 'loading');
      withVerifiedCover(options, function (verifiedOptions) {
        verifiedOptions.element = element;
        verifiedOptions.container = element;
        if (verifiedOptions.music && !verifiedOptions.audio) {
          verifiedOptions.audio = [{
            name: verifiedOptions.music.title || '',
            artist: verifiedOptions.music.author || '',
            url: verifiedOptions.music.url || '',
            cover: verifiedOptions.music.pic || verifiedOptions.music.fallbackPic || '',
            lrc: verifiedOptions.music.lrc || ''
          }];
        }
        element.setAttribute('data-sf-aplayer-ready', 'true');
        var player = new window.APlayer(verifiedOptions);
        installSeekPatch(player);
        window.aplayers.push(player);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPlayers, { once: true });
  } else {
    initPlayers();
  }

  window.SteamedFreshAPlayerInit = initPlayers;
})();
