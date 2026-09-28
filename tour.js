/* LCS-102 tour: shared behavior for every stop.
   A page only needs <main class="tour" data-...> with <section class="page"> blocks.
   Optional settings on <main>:
     data-kicker   small line above the title      e.g. "Prologue · Grounding"
     data-title    title on the scene
     data-story    fleet | ship | both             (sets the colored tag)
     data-label    override the tag text
     data-ships    ship counter number              e.g. "130"
     data-fact     milestone fact line
     data-next     URL of the next stop (shows a "Next stop" button on the last page)
     data-next-label  button text (default "Next stop")                              */
(function(){
  var tour = document.querySelector('.tour'); if (!tour) return;
  function a(n){ return tour.getAttribute('data-' + n); }
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

  var pages = Array.prototype.slice.call(tour.querySelectorAll('.page'));
  var story = a('story') || '';
  var names = {fleet:'Fleet story', ship:'LCS-102 story', both:'Fleet story and LCS-102 story'};
  var label = a('label') || names[story] || story;

  // header (S-HDR brand line, kicker, title, story tag)
  var BRAND = 'USS LCS-102', BRAND_SUB = 'The last intact ship of her class, and the fleet she stands for';
  var hasHead = a('kicker') || a('title');
  var head = document.createElement('div'); head.className = 't-head';
  head.innerHTML =
    '<div class="h-main">' +
      (a('kicker') ? '<div class="kicker">' + esc(a('kicker')) + '</div>' : '') +
      (a('title')  ? '<h1 class="t-title">' + esc(a('title')) + '</h1>' : '') +
      '<span class="story"></span>' +
    '</div>' +
    '<div class="brand">' + BRAND + '<span>' + BRAND_SUB + '</span></div>';
  if (hasHead) tour.appendChild(head);
  var tagEl = head.querySelector('.story');
  function setStory(s){
    s = s || '';
    tagEl.className = 'story ' + s;
    tagEl.textContent = (s === story && a('label')) ? a('label') : (names[s] || '');
    tagEl.style.display = s ? '' : 'none';
  }
  setStory(story);

  // counter + fact strip (only if either is set)
  if (a('ships') || a('fact')) {
    var strip = document.createElement('div'); strip.className = 't-strip';
    strip.innerHTML =
      (a('ships') ? '<div class="ctr"><span class="lab">Ships of the class:</span> <span class="num">' + esc(a('ships')) + '</span><span class="sub">130 built · 1 intact today</span></div>' : '') +
      (a('fact') ? '<div class="fact"><div class="lab">Milestone fact</div><div class="factval">' + esc(a('fact')) + '</div></div>' : '');
    tour.appendChild(strip);
  }

  // top-level video (outside the pages) sits above the text
  tour.querySelectorAll(':scope > .yt').forEach(function(v){
    var m = document.createElement('div'); m.className = 't-media'; m.appendChild(v); tour.appendChild(m);
  });

  // pages that contain a video: hide title/counter while shown; video-only pages fill the frame
  pages.forEach(function(p){
    var kids = Array.prototype.filter.call(p.children, function(el){ return el.nodeType === 1; });
    if (kids.length === 1 && kids[0].classList.contains('yt')) p.classList.add('video-only');
  });

  // body
  var body = document.createElement('div'); body.className = 't-body';
  pages.forEach(function(p){ body.appendChild(p); });
  tour.appendChild(body);

  // tabs: <section class="panel" id="history" data-tab="History"> ... ; open one directly with #history
  var panels = Array.prototype.slice.call(tour.querySelectorAll('.panel'));
  if (panels.length) {
    var tabs = document.createElement('div'); tabs.className = 't-tabs';
    panels.forEach(function(p){
      body.appendChild(p);
      var t = document.createElement('button'); t.className = 'tab'; t.type = 'button';
      t.textContent = p.getAttribute('data-tab'); t.onclick = function(){ showTab(p.id); history.replaceState(null, '', '#' + p.id); };
      tabs.appendChild(t);
    });
    tour.insertBefore(tabs, body);
    function showTab(id){
      var found = panels.some(function(p){ return p.id === id; }); if (!found) id = panels[0].id;
      panels.forEach(function(p, k){
        var on = p.id === id; p.classList.toggle('on', on); tabs.children[k].classList.toggle('on', on);
        if (!on) p.querySelectorAll('.yt').forEach(function(v){ v._stop && v._stop(); });
      });
      body.scrollTop = 0;
    }
    // opened from one ThingLink icon (#history etc.): show only that category
    if (location.hash && panels.some(function(p){ return '#' + p.id === location.hash; })) tour.classList.add('single');
    showTab(location.hash.slice(1));
    window.addEventListener('hashchange', function(){ showTab(location.hash.slice(1)); });
  }
  if (!pages.length) return;

  // footer
  var foot = document.createElement('div'); foot.className = 't-foot';
  foot.innerHTML = '<button class="move" id="prev">\u2039 Back</button><div class="dots"></div><span id="nextwrap"><button class="move" id="next">Next \u203a</button></span>';
  tour.appendChild(foot);

  var dots = foot.querySelector('.dots'), prev = foot.querySelector('#prev'), next = foot.querySelector('#next'), i = 0;
  var nextStop = null;
  if (a('next')) {
    nextStop = document.createElement('a');
    nextStop.className = 'move go'; nextStop.href = a('next'); nextStop.target = '_top';
    nextStop.textContent = (a('next-label') || 'Next stop') + ' ›';
    nextStop.style.display = 'none';
    foot.querySelector('#nextwrap').appendChild(nextStop);
  }
  pages.forEach(function(_, k){
    var d = document.createElement('button'); d.className = 'dot';
    d.setAttribute('aria-label', 'Page ' + (k + 1)); d.onclick = function(){ go(k); };
    dots.appendChild(d);
  });
  if (pages.length < 2 && !nextStop) foot.style.display = 'none';

  function go(n){
    if (n < 0 || n > pages.length - 1) return;
    i = n;
    pages.forEach(function(p, k){ p.classList.toggle('on', k === i); p.classList.remove('in'); });
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ pages[i].classList.add('in'); }); });
    dots.querySelectorAll('.dot').forEach(function(d, k){ d.classList.toggle('on', k === i); });
    prev.disabled = i === 0;
    var last = i === pages.length - 1;
    next.disabled = last;
    if (nextStop) { next.style.display = last ? 'none' : ''; nextStop.style.display = last ? '' : 'none'; }
    body.scrollTop = 0;
    tour.classList.toggle('media-mode', pages[i].classList.contains('video-only'));
    setStory(pages[i].getAttribute('data-story') || story);
    pages.forEach(function(p, k){ if (k !== i) p.querySelectorAll('.yt').forEach(function(v){ v._stop && v._stop(); }); });
  }
  prev.onclick = function(){ go(i - 1); };
  next.onclick = function(){ go(i + 1); };
  document.addEventListener('keydown', function(e){
    if (e.key === 'ArrowRight') go(i + 1);
    if (e.key === 'ArrowLeft') go(i - 1);
  });
  var x0 = null;
  document.addEventListener('touchstart', function(e){ x0 = e.touches[0].clientX; }, {passive:true});
  document.addEventListener('touchend', function(e){
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 40) go(dx < 0 ? i + 1 : i - 1);
    x0 = null;
  });
  go(0);
})();

/* Then and now timeline: tap a step to highlight it (first step starts highlighted) */
document.querySelectorAll('.tl').forEach(function(tl){
  var items = Array.prototype.slice.call(tl.querySelectorAll('.tl-item'));
  function pick(k){ items.forEach(function(it, n){ it.classList.toggle('on', n === k); it.setAttribute('aria-pressed', n === k ? 'true' : 'false'); }); }
  items.forEach(function(it, k){
    it.setAttribute('tabindex', '0'); it.setAttribute('role', 'button');
    it.addEventListener('click', function(){ pick(k); });
    it.addEventListener('keydown', function(e){
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(k); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); var n = Math.min(items.length - 1, k + 1); pick(n); items[n].focus(); }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); var p = Math.max(0, k - 1); pick(p); items[p].focus(); }
    });
  });
  pick(0);
});

/* hero photos: if an image file is not uploaded yet, keep only its caption + source link */
document.querySelectorAll('.photos img').forEach(function(img){
  function miss(){ img.closest('figure').classList.add('missing'); }
  if (img.complete && !img.naturalWidth) miss(); else img.addEventListener('error', miss);
});

/* ---- YouTube clip player ----
   <div class="yt" data-id="VIDEO_ID" data-start="10" data-end="22" data-cap="Play"></div>
   - no YouTube controls / progress bar, keyboard disabled
   - stops itself at data-end (or just before the video's real end) and shows our Replay card,
     so YouTube's end screen with suggested videos never appears                               */
(function(){
  var boxes = Array.prototype.slice.call(document.querySelectorAll('.yt[data-id]'));
  if (!boxes.length) return;
  var apiReady = false, queue = [];
  window.onYouTubeIframeAPIReady = function(){ apiReady = true; queue.forEach(function(f){ f(); }); queue = []; };
  function whenReady(f){ apiReady ? f() : queue.push(f); }
  var tag = document.createElement('script'); tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);

  boxes.forEach(function(box, n){
    var id = box.getAttribute('data-id');
    var start = parseFloat(box.getAttribute('data-start')) || 0;
    var endAttr = parseFloat(box.getAttribute('data-end'));
    var cap = box.getAttribute('data-cap') || 'Play video';
    box.style.setProperty('--poster', 'url(https://i.ytimg.com/vi/' + id + '/hqdefault.jpg)');

    var cover = document.createElement('button'); cover.className = 'yt-cover'; cover.type = 'button';
    cover.innerHTML = '<span class="yt-play"></span><span class="yt-cap"></span>';
    cover.querySelector('.yt-cap').textContent = cap;
    box.appendChild(cover);

    var player = null, timer = null, stopAt = null;

    function showCover(replay){
      clearInterval(timer); timer = null;
      if (player) { try { player.destroy(); } catch(e){} player = null; }
      box.querySelectorAll('.yt-frame,.yt-shield,.yt-pause').forEach(function(el){ el.remove(); });
      box.classList.remove('paused');
      cover.classList.toggle('replay', !!replay);
      cover.querySelector('.yt-cap').textContent = replay ? 'Replay' : cap;
      cover.style.display = '';
    }
    box._stop = function(){ if (player) showCover(true); };

    cover.onclick = function(){
      cover.style.display = 'none';
      var holder = document.createElement('div'); holder.className = 'yt-frame'; holder.id = 'yt-' + n + '-' + Date.now();
      box.insertBefore(holder, cover);
      var shield = document.createElement('div'); shield.className = 'yt-shield'; box.appendChild(shield);
      var pbtn = document.createElement('button'); pbtn.className = 'yt-pause'; pbtn.type = 'button'; pbtn.textContent = 'Pause'; box.appendChild(pbtn);

      whenReady(function(){
        var vars = { autoplay:1, controls:0, disablekb:1, fs:0, rel:0, iv_load_policy:3,
                     playsinline:1, cc_load_policy:0, start: Math.floor(start) };
        if (!isNaN(endAttr)) vars.end = Math.ceil(endAttr);
        player = new YT.Player(holder.id, {
          videoId: id, host: 'https://www.youtube-nocookie.com', playerVars: vars,
          events: {
            onReady: function(e){
              if (start % 1) e.target.seekTo(start, true);
              var dur = e.target.getDuration() || 0;
              stopAt = !isNaN(endAttr) ? endAttr : (dur ? dur - 0.6 : null);
              e.target.playVideo();
              timer = setInterval(function(){
                if (!player || !player.getCurrentTime) return;
                if (stopAt && player.getCurrentTime() >= stopAt - 0.25) showCover(true);
              }, 200);
            },
            onStateChange: function(e){
              if (e.data === 0) showCover(true);                     // ended
              box.classList.toggle('paused', e.data === 2);
              pbtn.textContent = e.data === 2 ? 'Play' : 'Pause';
            }
          }
        });
      });
      function toggle(){
        if (!player || !player.getPlayerState) return;
        player.getPlayerState() === 1 ? player.pauseVideo() : player.playVideo();
      }
      shield.onclick = toggle; pbtn.onclick = toggle;
    };
  });
})();
