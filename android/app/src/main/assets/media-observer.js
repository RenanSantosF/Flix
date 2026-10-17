(function () {
  // Only media state is reported. No source URLs, cookies or page contents leave a frame.
  function install(win) {
    try {
      if (win.__flixMediaObserver || !win.FlixMedia) return;
      win.__flixMediaObserver = true;
      var ids = new WeakMap(), videos = {}, next = 0, lastTime = 0;
      var prefix = Math.random().toString(36).slice(2) + ':';
      function send(video, event) {
        if (!(video instanceof win.HTMLVideoElement)) return;
        var duration = video.duration;
        if (!isFinite(duration) || duration <= 0 || duration > 604800) return;
        var id = ids.get(video);
        if (!id) { id = prefix + (++next); ids.set(video, id); videos[id] = video; }
        var now = Date.now();
        if (event === 'timeupdate' && now - lastTime < 1000) return;
        lastTime = now;
        win.FlixMedia.postMessage(JSON.stringify({videoId:id, event:event,
          position:video.currentTime || 0, duration:duration,
          playing:!video.paused && !video.ended, ended:video.ended}));
      }
      win.FlixMedia.onmessage = function (event) {
        try {
          var data = JSON.parse(event.data), video = videos[data.videoId];
          if (!video) return;
          if (data.type === 'restore' && isFinite(data.position) && data.position > 0 && isFinite(video.duration)) {
            video.currentTime = Math.max(0, Math.min(data.position, video.duration - 1));
          } else if (data.type === 'pause') { video.pause(); send(video, 'pause'); }
        } catch (_) {}
      };
      ['loadedmetadata','durationchange','play','playing','pause','ended','seeked','timeupdate'].forEach(function (event) {
        win.document.addEventListener(event, function (e) { send(e.target, event); }, true);
      });
      function scan() {
        win.document.querySelectorAll('video').forEach(function (video) { if (!video.paused || !ids.has(video)) send(video, 'scan'); });
        // Older WebViews lack document-start scripts. Same-origin frames still work.
        win.document.querySelectorAll('iframe').forEach(function (frame) { try { install(frame.contentWindow); } catch (_) {} });
      }
      win.setInterval(scan, 1000); scan();
      win.addEventListener('pagehide', function () { win.document.querySelectorAll('video').forEach(function (video) { send(video, 'pause'); }); });
    } catch (_) {}
  }
  install(window);
})();
