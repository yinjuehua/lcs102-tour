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
  var story = a('story') || 'fleet';
  var names = {fleet:'Fleet story', ship:'LCS-102 story', both:'Fleet story and LCS-102 story'};
  var label = a('label') || names[story] || story;

  // header
  var head = document.createElement('div'); head.className = 't-head';
  head.innerHTML =
    (a('kicker') ? '<div class="kicker">' + esc(a('kicker')) + '</div>' : '') +
    (a('title')  ? '<h1 class="t-title">' + esc(a('title')) + '</h1>' : '') +
    '<span class="story ' + esc(story) + '">' + esc(label) + '</span>';
  tour.appendChild(head);

  // counter + fact strip (only if either is set)
  if (a('ships') || a('fact')) {
    var total = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--total-ships')) || 130;
    var strip = document.createElement('div'); strip.className = 't-strip';
    strip.innerHTML =
      (a('ships') ? '<div class="ctr"><div class="head"><span class="lab">Ships of the class</span><span class="num">' + esc(a('ships')) + '</span></div><div class="bar"><div class="fill"></div></div></div>' : '<div></div>') +
      (a('fact') ? '<div class="fact"><div class="lab">Milestone fact</div><div class="factval">' + esc(a('fact')) + '</div></div>' : '');
    tour.appendChild(strip);
    var fill = strip.querySelector('.fill');
    if (fill) setTimeout(function(){ fill.style.width = Math.min(100, parseFloat(a('ships')) / total * 100) + '%'; }, 150);
  }

  // body
  var body = document.createElement('div'); body.className = 't-body';
  pages.forEach(function(p){ body.appendChild(p); });
  tour.appendChild(body);

  // footer
  var foot = document.createElement('div'); foot.className = 't-foot';
  foot.innerHTML = '<button class="move" id="prev">‹ Back</button><div class="dots"></div><span id="nextwrap"><button class="move" id="next">Next ›</button></span>';
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
