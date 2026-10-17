(function () {
  // Reports media state. On error 4 only, the already assigned source goes to the
  // local Android decoder; no URLs, cookies or page HTML are sent to the website.
  function install(win) {
    try {
      if (win.__flixMediaObserver || !win.FlixMedia) return;
      win.__flixMediaObserver = true;
      var ids = new WeakMap(), sourceFailures = new WeakMap(), videos = {}, next = 0, lastTime = 0;
      var prefix = Math.random().toString(36).slice(2) + ':';
      function send(video, event, sourceError) {
        if (!(video instanceof win.HTMLVideoElement)) return;
        var duration = video.duration, live = duration === Infinity, error = sourceError || (video.error ? video.error.code : 0);
        if (!live && !error && (!isFinite(duration) || duration <= 0 || duration > 604800)) return;
        var id = ids.get(video);
        if (!id) { id = prefix + (++next); ids.set(video, id); videos[id] = video; }
        var now = Date.now();
        if (event === 'timeupdate' && now - lastTime < 1000) return;
        lastTime = now;
        var source = '', sourceType = '';
        // On incompatibility only, pass the URL already assigned to this video to the
        // local Android decoder. Never send URLs to the website, logs or a server.
        if (error === 4) {
          var child = video.querySelector('source[src]');
          source = video.currentSrc || video.src || (child ? child.src : '');
          sourceType = child ? (child.type || '') : '';
          if (!/^https:\/\//i.test(source) && child) source = child.src;
          if (!/^https:\/\//i.test(source) || source.length > 4096) source = '';
        }
        win.FlixMedia.postMessage(JSON.stringify({videoId:id, event:event, source:source, sourceType:sourceType.slice(0,100),
          position:video.currentTime || 0, duration:live || !isFinite(duration) ? 0 : duration, live:live, error:error,
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
      ['error','loadedmetadata','durationchange','play','playing','pause','ended','seeked','timeupdate'].forEach(function (event) {
        win.document.addEventListener(event, function (e) {
          var source = e.target;
          // A source rejected by MIME emits its own error; video.error can stay null.
          // Wait for all candidates to fail before recovering this video.
          if (event === 'error' && source instanceof win.HTMLSourceElement && source.parentElement instanceof win.HTMLVideoElement) {
            var video = source.parentElement, failedUrl = source.src;
            sourceFailures.set(source, failedUrl);
            win.setTimeout(function () {
              var candidates = Array.from(video.querySelectorAll('source[src]'));
              if (source.src === failedUrl && video.readyState === 0 && video.networkState === win.HTMLMediaElement.NETWORK_NO_SOURCE && candidates.length && candidates.every(function (s) { return sourceFailures.get(s) === s.src; })) send(video, 'error', 4);
            }, 300);
          } else send(e.target, event);
        }, true);
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
