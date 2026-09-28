/* LCS-102 tour pager: shared behavior for every page.
   Each page only needs <main class="tour" data-story="..."> with <section class="page"> blocks. */
(function(){
  var tour = document.querySelector('.tour'); if(!tour) return;
  var pages = Array.prototype.slice.call(tour.querySelectorAll('.page'));
  var story = tour.getAttribute('data-story') || 'fleet';
  var names = {fleet:'Fleet story', ship:'LCS-102 story', both:'Fleet story and LCS-102 story'};
  var label = tour.getAttribute('data-label') || names[story] || story;

  var body = document.createElement('div'); body.className = 't-body';
  pages.forEach(function(p){ body.appendChild(p); });

  var head = document.createElement('div'); head.className = 't-head';
  head.innerHTML = '<span class="story ' + story + '">' + label + '</span>';

  var foot = document.createElement('div'); foot.className = 't-foot';
  foot.innerHTML = '<button class="move" id="prev">‹ Back</button><div class="dots"></div><button class="move" id="next">Next ›</button>';

  tour.appendChild(head); tour.appendChild(body); tour.appendChild(foot);

  var dots = foot.querySelector('.dots'), prev = foot.querySelector('#prev'), next = foot.querySelector('#next'), i = 0;
  pages.forEach(function(_, k){
    var d = document.createElement('button'); d.className = 'dot';
    d.setAttribute('aria-label', 'Page ' + (k + 1)); d.onclick = function(){ go(k); };
    dots.appendChild(d);
  });
  if (pages.length < 2) foot.style.display = 'none';

  function go(n){
    if (n < 0 || n > pages.length - 1) return;
    i = n;
    pages.forEach(function(p, k){ p.classList.toggle('on', k === i); p.classList.remove('in'); });
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ pages[i].classList.add('in'); }); });
    dots.querySelectorAll('.dot').forEach(function(d, k){ d.classList.toggle('on', k === i); });
    prev.disabled = i === 0; next.disabled = i === pages.length - 1;
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
