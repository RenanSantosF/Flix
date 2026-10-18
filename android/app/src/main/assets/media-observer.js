(function () {
  // Reports media state and assigned sources only to the local Android bridge.
  // State uses the source for in-memory correlation; only error 4 can invoke the
  // decoder. No URLs, cookies or page HTML are sent to the website.
  function install(win) {
    try {
      if (win.__flixMediaObserver || !win.FlixMedia) return;
      win.__flixMediaObserver = true;
      var ids = new WeakMap(), sourceFailures = new WeakMap(), failedVideos = new WeakMap(), videos = {}, next = 0, lastTime = 0;
      var manifests = [], observer, epochs = new WeakMap(), pending = new WeakMap(), stateTimes = new WeakMap();
      var recoveryDelay = 5000, lastAdTime = 0;
      var wantedPlayback = new WeakMap(), browserRetried = new WeakSet(), startedVideos = new WeakSet();
      function retryWanted(video) { return !startedVideos.has(video)&&(wantedPlayback.get(video)===true||!video.paused); }
      function identity(video) {
        var id=ids.get(video);
        if(!id){id=prefix+(++next);ids.set(video,id);videos[id]=video;}
        return id;
      }
      var prefix = Math.random().toString(36).slice(2) + ':';
      // Resource Timing describes requests already made by this frame. Do not fetch,
      // guess URLs or inspect provider internals. Only an unambiguous, recent manifest
      // in a single-video frame can recover a MediaSource blob.
      function remember(entries) {
        entries.forEach(function (entry) {
          try {
            var url = new win.URL(entry.name);
            if (url.protocol !== 'https:' || entry.name.length > 4096 ||
                !/\.(m3u8|mpd)$/i.test(url.pathname) ||
                !/^(fetch|xmlhttprequest)$/.test(entry.initiatorType)) return;
            manifests.push({url:entry.name, time:entry.startTime});
          } catch (_) {}
        });
        manifests = manifests.filter(function (entry) { return win.performance.now() - entry.time <= 30000; }).slice(-32);
      }
      try {
        remember(win.performance.getEntriesByType('resource'));
        if (win.PerformanceObserver) {
          observer = new win.PerformanceObserver(function (list) { remember(list.getEntries()); });
          observer.observe({entryTypes:['resource']});
        }
      } catch (_) {}
      function mediaSource(video) {
        var child = video.querySelector('source[src]');
        var raw = video.currentSrc || video.src || (child ? child.src : '');
        if (!/^https:\/\//i.test(raw) && child && /^https:\/\//i.test(child.src)) raw = child.src;
        var kind = /^https:\/\//i.test(raw) ? 'https' : /^blob:/i.test(raw) ? 'blob' : /^http:/i.test(raw) ? 'http' : raw ? 'other' : 'missing';
        var result = {source:'', sourceType:'', sourceKind:kind, sourceReason:'no-https-source'};
        if (/^https:\/\//i.test(raw)) {
          result.source = raw; result.sourceType = child ? child.type || '' : ''; result.sourceReason = 'direct';
        } else if (kind === 'blob') {
          // Multiple videos or manifests cannot be reliably attributed to this video.
          var unique = [], now = win.performance.now();
          manifests.forEach(function (entry) { if (now - entry.time <= 30000 && entry.time >= (epochs.get(video) || 0) && unique.indexOf(entry.url) < 0) unique.push(entry.url); });
          if (win.document.querySelectorAll('video').length !== 1 || unique.length > 1) result.sourceReason = 'ambiguous-manifest';
          else if (unique.length === 1) {
            result.source = unique[0]; result.sourceType = /\.mpd(?:[?#]|$)/i.test(unique[0]) ? 'application/dash+xml' : 'application/vnd.apple.mpegurl';
            result.sourceReason = 'observed-manifest';
          } else result.sourceReason = 'blob-without-manifest';
        }
        if (result.source.length > 4096) { result.source = ''; result.sourceReason = 'source-too-long'; }
        return result;
      }
      function cancelRecovery(video) {
        var attempt = pending.get(video);
        if (attempt) { win.clearTimeout(attempt.timer); pending.delete(video); }
      }
      function queueRecovery(video, event, sourceError) {
        var signature = video.currentSrc || video.src || Array.from(video.querySelectorAll('source[src]')).map(function (s) { return s.src; }).join('|');
        var old = pending.get(video);
        if (old && old.signature === signature) return;
        cancelRecovery(video);
        var attempt = {signature:signature, timer:0};
        pending.set(video, attempt);
        attempt.timer = win.setTimeout(function () {
          if (pending.get(video) !== attempt) return;
          pending.delete(video);
          var current = video.currentSrc || video.src || Array.from(video.querySelectorAll('source[src]')).map(function (s) { return s.src; }).join('|');
          if (video.isConnected === false || current !== signature || video.readyState > 0 || video.ended) return;
          var candidates = Array.from(video.querySelectorAll('source[src]'));
          var failedSources = sourceError === 4 && video.networkState === win.HTMLMediaElement.NETWORK_NO_SOURCE && candidates.length && candidates.every(function (s) { return sourceFailures.get(s) === s.src; });
          if ((video.error && video.error.code === 4) || failedSources) send(video, event, sourceError, true);
        }, recoveryDelay);
      }
      function loadingAdVisible() {
        // Read only the visible, exact status the user reported; never player internals.
        try {
          var labels=win.document.querySelectorAll('.jw-text-alt,.jw-text,[role="status"],[aria-live]');
          for(var i=0;i<Math.min(labels.length,24);i++) {
            var label=labels[i],text=String(label.textContent||'').trim();
            if(text.length>64||!/^loading\s+ad(?:vertisement)?[.\s…]*$/i.test(text))continue;
            var visible=label.getClientRects().length>0,node=label;
            for(var depth=0;visible&&win.getComputedStyle&&node&&depth<10;depth++,node=node.parentElement) {
              var style=win.getComputedStyle(node);
              if(style.display==='none'||style.visibility==='hidden'||style.opacity==='0')visible=false;
            }
            if(visible)return true;
          }
        } catch(_) {}
        return false;
      }
      function reportState(video) {
        var raw = video.currentSrc || video.src || (video.querySelector('source[src]') || {}).src || '';
        var adLoading=loadingAdVisible();
        if ((raw || adLoading) && Date.now() - (stateTimes.get(video) || 0) >= 3000) {
          stateTimes.set(video,Date.now());
          win.FlixMedia.postMessage(JSON.stringify({videoId:identity(video),event:'state',retryWanted:retryWanted(video),source:/^https?:\/\//i.test(raw)&&raw.length<=4096?raw:'',sourceKind:!raw?'missing':/^https:/i.test(raw)?'https':/^http:/i.test(raw)?'http':/^blob:/i.test(raw)?'blob':'other',adLoading:adLoading,
            readyState:video.readyState,networkState:video.networkState,position:0,duration:0,error:0}));
        }
      }
      function send(video, event, sourceError, settled) {
        if (!(video instanceof win.HTMLVideoElement)) return;
        var duration = video.duration, live = duration === Infinity, error = sourceError || (video.error ? video.error.code : 0);
        if (loadingAdVisible()) {cancelRecovery(video);reportState(video);return;}
        if(video.readyState>=3&&(video.currentTime>0.1||event==='playing'))startedVideos.add(video);
        if (!error && video.readyState < 3) reportState(video);
        if (!live && !error && (!isFinite(duration) || duration <= 0 || duration > 604800)) return;
        // Give the provider's own error handlers time to replace a temporary source.
        // Never unload its document while that recovery can still complete.
        if (error === 4 && !settled && event !== 'recovery-scan') { queueRecovery(video, event, sourceError); return; }
        var id = identity(video);
        var now = Date.now();
        if (event === 'timeupdate' && now - lastTime < 1000) return;
        lastTime = now;
        var source = {source:'', sourceType:'', sourceKind:'', sourceReason:''};
        if (error === 4) source = mediaSource(video);
        if (error) failedVideos.set(video, {until:event === 'recovery-scan' ? (failedVideos.get(video) || {until:now}).until : now + 5000, signature:source.source + ':' + source.sourceReason, error:error});
        win.FlixMedia.postMessage(JSON.stringify({videoId:id, event:event, retryWanted:retryWanted(video), source:source.source, sourceType:source.sourceType.slice(0,100),
          sourceKind:source.sourceKind, sourceReason:source.sourceReason,
          frameUrl:error === 4 && win.location ? String(win.location.href).slice(0,4096) : '',
          referrerPolicy:error === 4 ? String(win.document.referrerPolicy || '').slice(0,64) : '',
          corsMode:error === 4 && video.hasAttribute && video.hasAttribute('crossorigin') ? (video.crossOrigin === 'use-credentials' ? 'use-credentials' : 'anonymous') : 'none',
          position:video.currentTime || 0, duration:live || !isFinite(duration) ? 0 : duration, live:live, error:error,
          playing:!video.paused && !video.ended, ended:video.ended}));
      }
      win.FlixMedia.onmessage = function (event) {
        try {
          var data = JSON.parse(event.data), video = videos[data.videoId];
          if (!video) return;
          if (data.type === 'cast-source' && typeof data.token==='string' && data.token.length<=64) {
            var selected=mediaSource(video),assigned=video.currentSrc||video.src||(video.querySelector('source[src]')||{}).src||'';
            if(/^http:\/\//i.test(assigned))selected={source:assigned,sourceType:(video.querySelector('source[src]')||{}).type||''};
            if(loadingAdVisible()||video.readyState<2)selected={source:'',sourceType:''};
            win.FlixMedia.postMessage(JSON.stringify({event:'cast-source',token:data.token,videoId:identity(video),source:selected.source,sourceType:selected.sourceType,position:video.currentTime||0,duration:isFinite(video.duration)?video.duration:0}));
          } else if (data.type === 'retry-source') {
            // Retry the assigned URL in its original document/cookie context only.
            var assigned=video.currentSrc||video.src||(video.querySelector('source[src]')||{}).src||'';
            if(browserRetried.has(video)||video.isConnected===false||assigned!==data.source||!/^https:\/\//i.test(assigned)||video.readyState!==0||video.ended||loadingAdVisible()||!retryWanted(video))return;
            browserRetried.add(video);cancelRecovery(video);failedVideos.delete(video);
            video.load();
            var playing=video.play();if(playing&&playing.catch)playing.catch(function(){reportState(video);});
          } else if (data.type === 'restore' && isFinite(data.position) && data.position > 0 && isFinite(video.duration)) {
            video.currentTime = Math.max(0, Math.min(data.position, video.duration - 1));
          } else if (data.type === 'toggle') {
            if(video.paused){var play=video.play();if(play&&play.catch)play.catch(function(){});}else video.pause();
          } else if (data.type === 'seek' && isFinite(video.duration) && video.duration>0 && (data.seconds===10||data.seconds===-10)) {
            video.currentTime=Math.max(0,Math.min(video.duration-0.1,video.currentTime+data.seconds));
          } else if (data.type === 'pause') { wantedPlayback.set(video,false);video.pause(); send(video, 'pause'); }
        } catch (_) {}
      };
      ['loadstart','emptied','error','loadedmetadata','durationchange','play','playing','pause','ended','seeked','timeupdate'].forEach(function (event) {
        win.document.addEventListener(event, function (e) {
          var source = e.target;
          if(source instanceof win.HTMLVideoElement) {
            if(event==='play'||event==='playing')wantedPlayback.set(source,true);
            if(event==='ended'||(event==='pause'&&!source.error&&source.networkState!==win.HTMLMediaElement.NETWORK_NO_SOURCE))wantedPlayback.set(source,false);
          }
          if (event === 'emptied' || event === 'loadstart') {
            if (source instanceof win.HTMLVideoElement) { cancelRecovery(source); failedVideos.delete(source); epochs.set(source, Math.max(0, win.performance.now() - 250)); }
            return;
          }
          if ((event === 'loadedmetadata' || event === 'playing' || event === 'ended') && source instanceof win.HTMLVideoElement) cancelRecovery(source);
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
        var frameVideos=win.document.querySelectorAll('video');
        if(!frameVideos.length && loadingAdVisible() && Date.now()-lastAdTime>=3000) {
          lastAdTime=Date.now();
          win.FlixMedia.postMessage(JSON.stringify({videoId:prefix+'state',event:'state',sourceKind:'missing',adLoading:true,readyState:-1,networkState:-1,position:0,duration:0,error:0}));
        }
        frameVideos.forEach(function (video) {
          var failure = failedVideos.get(video);
          if (failure && Date.now() < failure.until) {
            var source = mediaSource(video);
            if (source.source + ':' + source.sourceReason !== failure.signature) send(video, 'recovery-scan', failure.error);
          } else if (!video.paused || !ids.has(video) || video.readyState === 0) send(video, 'scan');
        });
        // Older WebViews lack document-start scripts. Same-origin frames still work.
        win.document.querySelectorAll('iframe').forEach(function (frame) { try { install(frame.contentWindow); } catch (_) {} });
      }
      win.setInterval(scan, 1000); scan();
      win.addEventListener('pagehide', function () { win.document.querySelectorAll('video').forEach(function (video) { send(video, 'pause'); }); });
    } catch (_) {}
  }
  install(window);
})();
