(function () {
  // Presentation only: keep the provider's document, requests, source and click handlers.
  // No ad removal, alternate endpoint, token extraction or media reload.
  function install(win) {
    try {
      if (!win.FlixMedia || win.__flixPlayerIdentity) return;
      var doc=win.document, players=new Map(), fullscreen=new WeakSet(), style;
      var providerControls=['.fluid_controls_container','.fluid_controls_progress_container','.fluid_initial_play','.fluid_initial_play_button','.fluid_video_play_pause','.jw-controlbar','.jw-display','.jw-settings-menu','.jw-rightclick','.plyr__controls','.plyr__control--overlaid','.vjs-control-bar','.vjs-big-play-button'];
      function enabled(){return win.location.hostname==='superflixapi.fun'||win.top!==win||!!doc.querySelector('[data-flix-identity-preview]');}
      function visible(node){if(!node||!node.getClientRects().length)return false;for(var depth=0;node&&depth<10;node=node.parentElement,depth++){var s=win.getComputedStyle(node);if(s.display==='none'||s.visibility==='hidden'||s.opacity==='0')return false;}return true;}
      function adVisible(scope){
        if(scope.matches('.jw-flag-ads,.vjs-ad-playing,.vjs-ad-loading,.plyr--ads')||Array.from(scope.querySelectorAll('.fluid_ad_skip,.fluid_ad_countdown,.jw-ad-skip')).some(visible))return true;
        return Array.from(doc.querySelectorAll('.jw-text-alt,.jw-text,[role="status"],[aria-live]')).slice(0,24).some(function(label){
          if(!/^loading\s+ad(?:vertisement)?[.\s…]*$/i.test(String(label.textContent||'').trim())||!label.getClientRects().length)return false;
          var node=label;for(var depth=0;node&&depth<10;node=node.parentElement,depth++){var s=win.getComputedStyle(node);if(s.display==='none'||s.visibility==='hidden'||s.opacity==='0')return false;}return true;
        });
      }
      function mountStyle(){
        if(style||!doc.documentElement)return;
        style=doc.createElement('style');
        style.textContent=providerControls.map(function(s){return '[data-flix-inline-owned] '+s;}).join(',')+'{display:none!important;visibility:hidden!important;pointer-events:none!important}'
          +'video[data-flix-inline-video]::-webkit-media-controls,video[data-flix-inline-video]::-webkit-media-controls-enclosure{display:none!important}'
          +'[data-flix-server]{box-sizing:border-box!important;position:relative!important;display:flex!important;align-items:center!important;gap:0!important;width:100%!important;min-width:0!important;min-height:88px!important;padding:18px!important;border:1px solid #f43f6255!important;border-radius:18px!important;background:linear-gradient(115deg,#2c1927,#17131c)!important;color:#fff!important;font-family:system-ui,sans-serif!important;font-size:17px!important;font-weight:700!important;letter-spacing:0!important;line-height:1.4!important;white-space:normal!important;text-align:left!important;box-shadow:0 8px 28px #0003!important;transition:transform .18s,background .18s!important;cursor:pointer!important}'
          +'[data-flix-server] *{color:#fff!important;font:inherit!important;letter-spacing:inherit!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important;min-width:0!important;max-width:100%!important}'
          +'[data-flix-server-label]{display:block!important;flex:1 1 auto!important;overflow-wrap:normal!important;word-break:normal!important}'
          +'[data-flix-server-path]{display:contents!important}[data-flix-server-decoration]{display:none!important}'
          +'[data-flix-server]:active{transform:scale(.98)!important}[data-flix-server]:before{content:"▶"!important;display:grid!important;place-items:center;flex:0 0 42px;margin-right:14px;height:42px;border-radius:14px;background:#f43f62;color:white;font-size:14px}'
          +'[data-flix-server="alternate"]:before{content:"⇄"!important;background:#ffffff12;color:#f8a1b7;font-size:23px}[data-flix-server]:after{content:none!important}'
          +'[data-flix-audio]{border-radius:12px!important;font-family:system-ui,sans-serif!important;border-color:#ffffff15!important;box-shadow:none!important}'
          +'[data-flix-audio][aria-selected="true"],[data-flix-audio].active{background:#f43f62!important}'
          // Style the original first-play hit target. Its provider listener still starts setup/ads.
          +'[data-flix-preplay] .fluid_controls_container,[data-flix-preplay] .fluid_controls_progress_container{visibility:hidden!important;pointer-events:none!important}'
          +'[data-flix-preplay] video::-webkit-media-controls,[data-flix-preplay] video::-webkit-media-controls-enclosure{display:none!important}'
          +'[data-flix-preplay] .fluid_initial_play{box-sizing:border-box!important;position:absolute!important;top:50%!important;left:50%!important;transform:translate(-50%,-50%)!important;width:76px!important;height:76px!important;margin:0!important;padding:0!important;border:1px solid #ffffff55!important;border-radius:50%!important;background:#fff!important;background-image:none!important;box-shadow:0 8px 40px #0006!important;cursor:pointer!important}'
          +'[data-flix-preplay] .fluid_initial_play_button{box-sizing:content-box!important;position:absolute!important;top:50%!important;left:50%!important;transform:translate(-35%,-50%)!important;width:0!important;height:0!important;margin:0!important;padding:0!important;border-top:12px solid transparent!important;border-bottom:12px solid transparent!important;border-left:19px solid #17131c!important;border-right:0!important;background:none!important}'
          +'[data-flix-preplay] .fluid_initial_play_button:before,[data-flix-preplay] .fluid_initial_play_button:after{content:none!important}[data-flix-preplay] .fluid_initial_play_button>*{visibility:hidden!important}'
          +'[data-flix-preplay]:before{content:"FLIX ·";position:absolute;top:18px;left:18px;z-index:10;color:#fff;font:900 19px system-ui,sans-serif;letter-spacing:-1px;pointer-events:none;text-shadow:0 2px 10px #000}'
          +'[data-flix-preplay]:after{content:"Toque para assistir";position:absolute;bottom:24px;left:18px;right:18px;z-index:10;text-align:center;color:#fff;font:600 13px system-ui,sans-serif;pointer-events:none;text-shadow:0 2px 10px #000}'
          +'[data-flix-preplay="loading"]:after{content:"Preparando sua sessão…"}';
        (doc.head||doc.documentElement).appendChild(style);
      }
      function themeServers(){
        if(win.location.hostname!=='superflixapi.fun'&&!doc.querySelector('[data-flix-identity-preview]'))return;
        // Exact visible labels only; never infer a server URL or replace a provider action.
        Array.from(doc.querySelectorAll('button,a,[role="button"],div,span')).slice(0,1000).forEach(function(node){
          var text=String(node.textContent||'').trim().replace(/\s+/g,' ');
          if(!/^(Servidor Principal|Servidor Alternativo|Dublado|Legendado)$/i.test(text))return;
          if(Array.from(node.children).some(function(child){return String(child.textContent||'').trim().replace(/\s+/g,' ')===text;}))return;
          var target=node.closest('button,a,[role="button"],[onclick]')||node;
          if(target===node&&!node.matches('button,a,[role="button"],[onclick]'))for(var depth=0;depth<4&&target.parentElement&&target.parentElement!==doc.body&&String(target.parentElement.textContent||'').trim().replace(/\s+/g,' ')===text;depth++)target=target.parentElement;
          if(/^Servidor /i.test(text)){
            target.setAttribute('data-flix-server',/Alternativo/i.test(text)?'alternate':'primary');
            // Keep the label and every original action, but remove nested decorative siblings
            // from layout. Flatten label wrappers so provider flex/ellipsis rules cannot clip it.
            if(target!==node){
              node.setAttribute('data-flix-server-label','');
              for(var branch=node;branch&&branch!==target;branch=branch.parentElement){
                if(branch!==node)branch.setAttribute('data-flix-server-path','');
                Array.from(branch.parentElement.children).forEach(function(sibling){if(sibling!==branch)sibling.setAttribute('data-flix-server-decoration','');});
              }
            }
          }
          else target.setAttribute('data-flix-audio','');
        });
      }
      function icon(name){
        var paths={volume:'<path d="m11 4-6 5H2v6h3l6 5ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>',muted:'<path d="m11 4-6 5H2v6h3l6 5ZM16 9l5 6M21 9l-5 6"/>',play:'<path d="m9 5 11 7-11 7Z" fill="currentColor"/>',pause:'<path d="M9 5v14M16 5v14" stroke-width="4"/>',back:'<path d="M5 7v5h5M5 12a7 7 0 1 1 2 5"/><text x="10" y="15" font-size="7" fill="currentColor" stroke="none">10</text>',forward:'<path d="M19 7v5h-5M19 12a7 7 0 1 0-2 5"/><text x="8" y="15" font-size="7" fill="currentColor" stroke="none">10</text>',full:'<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>'};
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[name]+'</svg>';
      }
      function clock(value){if(!isFinite(value)||value<0)return '—:—';var s=Math.floor(value);return(s>=3600?Math.floor(s/3600)+':':'')+String(Math.floor(s/60)%60).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}
      function create(video,scope){
        if(scope.hasAttribute('data-flix-inline-owned')||!win.Element.prototype.attachShadow)return null;
        var host=doc.createElement('div');host.setAttribute('data-flix-inline-ui','');
        host.style.cssText='position:absolute!important;top:0!important;right:0!important;bottom:0!important;left:0!important;width:100%!important;height:100%!important;z-index:20!important;pointer-events:auto!important';
        var shadow=host.attachShadow({mode:'open'});
        shadow.innerHTML='<style>:host{color:#fff;font-family:system-ui,sans-serif}*{box-sizing:border-box}button,input{font:inherit}button{cursor:pointer;color:inherit;border:0;pointer-events:auto;-webkit-tap-highlight-color:transparent}button:focus-visible,input:focus-visible{outline:2px solid #ff8da7;outline-offset:4px}.surface{position:absolute;top:0;right:0;bottom:0;left:0;width:100%;height:100%;background:transparent}.chrome{position:absolute;top:0;right:0;bottom:0;left:0;opacity:1;transition:opacity .2s;background:linear-gradient(0deg,#09080fe8,transparent 46%,#09080f88);pointer-events:none}.hidden .chrome{opacity:0}.hidden .chrome button,.hidden .chrome input{pointer-events:none}.brand{position:absolute;top:16px;left:18px;font-size:19px;font-weight:950;letter-spacing:-1px}.brand b{color:#f43f62}.brand small{display:block;font-size:8px;letter-spacing:2px;font-weight:600;margin-top:5px;color:#c2b5c7}.center{position:absolute;top:0;right:0;bottom:0;left:0;display:flex;align-items:center;justify-content:center;gap:0}.center .main{margin:0 22px}.round{width:44px;height:44px;border-radius:50%;background:#16131a80;border:1px solid #ffffff35;display:grid;place-items:center;backdrop-filter:blur(10px)}svg{width:23px;height:23px;display:block}.main{width:62px;height:62px;color:#15121a;background:#fff;border:0;box-shadow:0 6px 30px #0004}.main svg{width:28px;height:28px}.bottom{position:absolute;left:18px;right:18px;bottom:14px}.time{display:flex;align-items:center;gap:9px;font-size:10px;font-variant-numeric:tabular-nums;color:#d8cddd}.time span:first-child{color:#fff}.time .mute{margin-left:auto;display:grid;place-items:center;width:36px;height:36px;background:none;border-radius:11px}.time .full{margin-left:0;width:36px;height:36px;background:none;border:1px solid #ffffff25;border-radius:11px;display:grid;place-items:center}input{-webkit-appearance:none;appearance:none;display:block;pointer-events:auto;width:100%;height:25px;margin:0;padding:0;border:0;background:transparent;cursor:pointer;--flix-progress:0%}input::-webkit-slider-runnable-track{height:3px;border-radius:4px;background:linear-gradient(to right,#f43f62 0%,#f43f62 var(--flix-progress),#ffffff40 var(--flix-progress),#ffffff40 100%)}input::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;margin-top:-4.5px;border-radius:50%;background:#f43f62;border:2px solid #ff98af;box-shadow:0 0 0 3px #f43f6218}.buffer{position:absolute;top:58%;left:0;right:0;text-align:center;font-size:10px;color:#e3d6e5}.buffer:empty{display:none}.compact .brand{display:none}.compact .center{bottom:44px}.compact .round{width:40px;height:40px}.compact .main{width:48px;height:48px}.compact .main svg{width:23px;height:23px}.compact .bottom{bottom:6px;left:12px;right:12px}.compact input{height:20px}.compact .time .full,.compact .time .mute{width:30px;height:30px}@media(prefers-reduced-motion:reduce){.chrome{transition:none}}</style><div class="view"><button class="surface" aria-label="Exibir controles do Flix"></button><div class="chrome"><div class="brand">FLIX<b>·</b><small>SUA SESSÃO</small></div><div class="center"><button class="round back" aria-label="Voltar 10 segundos">'+icon('back')+'</button><button class="round main" aria-label="Reproduzir">'+icon('play')+'</button><button class="round forward" aria-label="Avançar 10 segundos">'+icon('forward')+'</button></div><div class="buffer" role="status"></div><div class="bottom"><input type="range" min="0" max="1000" value="0" aria-label="Posição do vídeo"><div class="time"><span class="position">00:00</span><span> / </span><span class="duration">—:—</span><button class="mute" aria-label="Silenciar">'+icon('volume')+'</button><button class="full" aria-label="Abrir em tela cheia">'+icon('full')+'</button></div></div></div></div>';
        var view=shadow.querySelector('.view'),toggle=shadow.querySelector('.main'),seek=shadow.querySelector('input'),timer,dragging=false,playIcon='',volumeIcon='';
        var originalControls=video.controls,originalPosition=scope.style.position;
        if(win.getComputedStyle(scope).position==='static')scope.style.position='relative';
        scope.appendChild(host);
        function show(){win.clearTimeout(timer);view.classList.remove('hidden');if(!video.paused)timer=win.setTimeout(function(){view.classList.add('hidden');},3000);}
        function update(){
          view.classList.toggle('compact',scope.clientHeight<240);
          var nextIcon=video.paused||video.ended?'play':'pause';if(nextIcon!==playIcon){toggle.innerHTML=icon(nextIcon);playIcon=nextIcon;}toggle.setAttribute('aria-label',video.paused||video.ended?'Reproduzir':'Pausar');
          var nextVolume=video.muted||video.volume===0?'muted':'volume';if(nextVolume!==volumeIcon){shadow.querySelector('.mute').innerHTML=icon(nextVolume);volumeIcon=nextVolume;}shadow.querySelector('.mute').setAttribute('aria-label',video.muted||video.volume===0?'Ativar som':'Silenciar');
          var finite=isFinite(video.duration)&&video.duration>0;
          shadow.querySelector('.position').textContent=clock(video.currentTime);
          shadow.querySelector('.duration').textContent=finite?clock(video.duration):video.duration===Infinity?'AO VIVO':'—:—';
          seek.disabled=!finite;if(finite&&!dragging)seek.value=String(Math.round(video.currentTime/video.duration*1000));seek.style.setProperty('--flix-progress',(finite?Math.max(0,Math.min(100,Number(seek.value)/10)):0)+'%');
          shadow.querySelector('.buffer').textContent=!video.paused&&video.readyState<3?'Preparando sua sessão…':'';
        }
        shadow.querySelector('.surface').onclick=show;
        shadow.querySelector('.mute').onclick=function(){video.muted=!video.muted;if(!video.muted&&video.volume===0)video.volume=1;update();show();};
        toggle.onclick=function(){if(video.paused||video.ended){var p=video.play();if(p&&p.catch)p.catch(function(){show();});}else video.pause();show();};
        [-10,10].forEach(function(seconds){shadow.querySelector(seconds<0?'.back':'.forward').onclick=function(){if(isFinite(video.duration)&&video.duration>0)video.currentTime=Math.max(0,Math.min(video.duration-.1,video.currentTime+seconds));show();};});
        seek.oninput=function(){dragging=true;seek.style.setProperty('--flix-progress',(Number(seek.value)/10)+'%');show();};seek.onchange=function(){if(isFinite(video.duration)&&video.duration>0)video.currentTime=Math.max(0,Math.min(video.duration-.1,Number(seek.value)/1000*video.duration));dragging=false;show();};
        shadow.querySelector('.full').onclick=function(){try{var p=scope.requestFullscreen?scope.requestFullscreen():video.webkitEnterFullscreen?video.webkitEnterFullscreen():null;if(p&&p.catch)p.catch(function(){});}catch(_){}show();};
        function changed(){update();if(video.paused||video.ended)show();else if(!timer)show();}
        ['timeupdate','durationchange','playing','pause','waiting','canplay','ended','volumechange'].forEach(function(name){video.addEventListener(name,changed);});
        var owned=false;
        function ownership(active,inFullscreen){
          host.style.setProperty('display',active?'block':'none','important');
          if(active){scope.setAttribute('data-flix-inline-owned','');video.setAttribute('data-flix-inline-video','');video.controls=false;}
          else {scope.removeAttribute('data-flix-inline-owned');video.removeAttribute('data-flix-inline-video');if(!inFullscreen)video.controls=originalControls;}
          owned=active;
        }
        update();show();
        return {video:video,scope:scope,refresh:function(){
          var full=doc.fullscreenElement||doc.webkitFullscreenElement;
          var inFullscreen=fullscreen.has(video)||!!(full&&(full===scope||full===video||full.contains(video)));
          ownership(!inFullscreen&&!video.error&&!adVisible(scope),inFullscreen);update();
        },remove:function(){ownership(false);win.clearTimeout(timer);host.remove();if(scope.style.position==='relative'&&originalPosition!=='relative')scope.style.position=originalPosition;['timeupdate','durationchange','playing','pause','waiting','canplay','ended','volumechange'].forEach(function(name){video.removeEventListener(name,changed);});}};
      }
      function scan(){
        if(!enabled())return;
        mountStyle();themeServers();
        players.forEach(function(player,video){if(!video.isConnected){player.remove();players.delete(video);}else player.refresh();});
        doc.querySelectorAll('video').forEach(function(video){
          var scope=video.closest('.fluid_video_wrapper,.jwplayer,.plyr,.video-js');
          var full=doc.fullscreenElement||doc.webkitFullscreenElement;
          var initial=scope&&scope.querySelector('.fluid_initial_play');
          var preplay=scope&&!players.has(video)&&!video.error&&!fullscreen.has(video)&&!(full&&full.contains(video))&&!adVisible(scope)&&scope.matches('.fluid_video_wrapper')&&initial;
          if(scope){if(preplay)scope.setAttribute('data-flix-preplay',visible(initial)?'ready':'loading');else scope.removeAttribute('data-flix-preplay');}
          // Let the provider's original first-play/ad preparation run before taking control.
          if(players.has(video)||video.readyState<3||video.paused||video.currentTime<=.1||video.error)return;
          if(!scope||scope.querySelectorAll('video').length!==1||adVisible(scope))return;
          var player=create(video,scope);if(player){scope.removeAttribute('data-flix-preplay');players.set(video,player);player.refresh();}
        });
      }
      win.__flixPlayerIdentity={scan:scan,fullscreen:function(video,active){if(active)fullscreen.add(video);else fullscreen.delete(video);var player=players.get(video);if(player)player.refresh();}};
      doc.addEventListener('fullscreenchange',scan);doc.addEventListener('webkitfullscreenchange',scan);
      doc.addEventListener('loadedmetadata',scan,true);doc.addEventListener('canplay',scan,true);
      doc.addEventListener('timeupdate',function(event){if(!players.has(event.target))scan();},true);
      ['loadstart','emptied'].forEach(function(name){doc.addEventListener(name,function(event){var player=players.get(event.target);if(player){player.remove();players.delete(event.target);}},true);});
      // Mutation delivery happens before paint, unlike the former one-second-only poll.
      // Ignore our shadow UI/style writes to avoid a self-triggered observer loop.
      new win.MutationObserver(function(records){
        if(records.some(function(record){var target=record.target;return target.nodeType!==1||(!target.closest('[data-flix-inline-ui]')&&target!==style);})){scan();}
      }).observe(doc,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden','aria-hidden']});
      doc.addEventListener('DOMContentLoaded',scan);
      win.setInterval(scan,1000);scan();
    }catch(_){}
  }
  install(window);
})();
