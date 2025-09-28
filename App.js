// ============ SpecScout — app.js ============

// ---- Utilities ----
const $results = $("#results");
const $toastEl = document.getElementById('appToast');

function showToast(msg, type = 'danger'){
  const $t = $("#appToast");
  $t.removeClass('text-bg-danger text-bg-success text-bg-warning')
    .addClass(`text-bg-${type}`);
  $("#toastMsg").text(msg);
  new bootstrap.Toast($toastEl, { delay: 3500 }).show();
}

function escHtml(str){ return $("<div/>").text(str ?? '').html(); }
function itemQid(uri){ return (uri || '').split('/').pop(); }

function setLoading(on){
  if (on){
    $("#results").html(`
      <div class="col-12">
        <div class="d-flex align-items-center justify-content-center py-5 bg-white border rounded-3">
          <div class="spinner-border me-2" role="status" aria-hidden="true"></div>
          <span>טוען תוצאות…</span>
        </div>
      </div>`);
  }
}

// ---- Favorites (localStorage) ----
const FAV_KEY = 'specscout:favs';
function loadFavs(){ try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return []; } }
function saveFavs(list){ localStorage.setItem(FAV_KEY, JSON.stringify(list)); }
function isFav(qid){ return loadFavs().some(f => f.qid === qid); }
function addFav(qid, label){ const list = loadFavs(); if (!list.some(f => f.qid === qid)) { list.push({ qid, label }); saveFavs(list); renderFavs(); } }
function removeFav(qid){ saveFavs(loadFavs().filter(f => f.qid !== qid)); renderFavs(); }
function renderFavs(){
  const list = loadFavs();
  const $box = $("#favorites").empty();
  if (!list.length){ $box.append('<span class="opacity-75">אין מועדפים עדיין. ⭐ הוסף/י מכרטיס תוצאה.</span>'); return; }
  list.forEach(f => {
    const badge = $(`<a href="#" class="badge text-bg-light border fav-badge" data-qid="${escHtml(f.qid)}" data-label="${escHtml(f.label)}">${escHtml(f.label)}</a>`);
    $box.append(badge);
  });
}

// ---- Wikidata search (wbsearchentities) ----
function entitySearch(term, lang){
  return $.ajax({
    url: 'https://www.wikidata.org/w/api.php',
    method: 'GET',
    dataType: 'json',
    data: {
      action: 'wbsearchentities', format: 'json',
      language: lang, uselang: lang,
      search: term, limit: 12, origin: '*'
    },
    timeout: 15000
  });
}

// ---- Details SPARQL ----
function buildDetailsQuery(qids){
  const values = qids.map(q => `wd:${q}`).join(' ');
  return `
    SELECT DISTINCT ?item ?itemLabel ?itemDescription ?image ?manufacturerLabel ?cpuLabel ?cores ?threads ?ram ?inception ?instanceOf ?instanceOfLabel WHERE {
      VALUES ?item { ${values} }
      OPTIONAL { ?item wdt:P176 ?manufacturer. }
      OPTIONAL { ?item wdt:P880 ?cpu. }
      OPTIONAL { ?item wdt:P1141 ?cores. }
      OPTIONAL { ?item wdt:P7443 ?threads. }
      OPTIONAL { ?item wdt:P13525 ?ram. }
      OPTIONAL { ?item wdt:P571 ?inception. }
      OPTIONAL { ?item wdt:P18 ?image. }
      OPTIONAL { ?item wdt:P31 ?instanceOf. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "he,en". }
    }`;
}

function fetchDetails(qids){
  if (!qids.length) return $.Deferred().resolve({ results:{ bindings:[] } }).promise();
  return $.ajax({
    url: 'https://query.wikidata.org/sparql',
    method: 'GET',
    data: { query: buildDetailsQuery(qids), format: 'json' },
    headers: { 'Accept': 'application/sparql-results+json' },
    timeout: 20000
  });
}

// ---- Build card ----
function buildCard(r){
  const qid = itemQid(r.item.value);
  const label = r.itemLabel?.value || qid;
  const desc = r.itemDescription?.value || '';
  const img = r.image?.value || '';
  const manuf = r.manufacturerLabel?.value || '';
  const cpu = r.cpuLabel?.value || '';
  const cores = r.cores?.value || '';
  const threads = r.threads?.value || '';
  const ram = r.ram?.value || '';
  const inception = r.inception?.value ? new Date(r.inception.value).getFullYear() : '';
  const typeLabel = r.instanceOfLabel?.value || '';
  const favActive = isFav(qid);

  return `
  <div class="col-12 col-md-6 col-lg-4">
    <div class="card h-100 shadow-sm">
      ${img ? `<img class="card-img-top" src="${escHtml(img)}" alt="${escHtml(label)}">` : ''}
      <div class="card-body d-flex flex-column">
        <div class="d-flex align-items-start justify-content-between mb-2">
          <h5 class="card-title mb-0">${escHtml(label)}</h5>
          <button class="btn btn-sm ${favActive ? 'btn-warning' : 'btn-outline-warning'} btn-fav" data-qid="${escHtml(qid)}" data-label="${escHtml(label)}" title="הוסף/הסר ממועדפים">
            <i class="bi ${favActive ? 'bi-star-fill' : 'bi-star'}"></i>
          </button>
        </div>
        <p class="card-text muted">${escHtml(desc)}</p>
        <ul class="list-unstyled small mb-3">
          ${manuf ? `<li><strong>יצרן:</strong> ${escHtml(manuf)}</li>` : ''}
          ${cpu ? `<li><strong>מעבד:</strong> ${escHtml(cpu)}</li>` : ''}
          ${cores ? `<li><strong>ליבות:</strong> ${escHtml(cores)}</li>` : ''}
          ${threads ? `<li><strong>ת׳רדים:</strong> ${escHtml(threads)}</li>` : ''}
          ${ram ? `<li><strong>RAM:</strong> ${escHtml(ram)}</li>` : ''}
          ${inception ? `<li><strong>שנת התחלה:</strong> ${escHtml(inception)}</li>` : ''}
          ${typeLabel ? `<li><strong>סוג:</strong> ${escHtml(typeLabel)}</li>` : ''}
        </ul>
        <div class="mt-auto d-flex gap-2">
          <a class="btn btn-sm btn-outline-secondary" target="_blank" href="https://www.wikidata.org/wiki/${escHtml(qid)}">
            <i class="bi bi-box-arrow-up-right"></i> Wikidata
          </a>
          <a class="btn btn-sm btn-outline-secondary" target="_blank" href="https://www.google.com/search?q=${encodeURIComponent(label)}">
            <i class="bi bi-google"></i> Google
          </a>
        </div>
      </div>
    </div>
  </div>`;
}

// ---- Filters / Sorting state ----
let RAW_ROWS = [];
let ORDER_QIDS = [];

function getYear(r){ return r.inception?.value ? new Date(r.inception.value).getFullYear() : null; }
function getTypeQids(r){ return [r.instanceOf?.value].filter(Boolean).map(itemQid); }

function populateFilters(rows){
  const makers = [...new Set(rows.map(r => r.manufacturerLabel?.value).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b));
  const $sel = $("#filter-manufacturer").empty().append('<option value="">הכל</option>');
  makers.forEach(m => $sel.append(`<option value="${escHtml(m)}">${escHtml(m)}</option>`));
}

function filterRows(){
  const maker = $("#filter-manufacturer").val();
  const laptopsOnly = $("#filter-laptops").is(":checked");
  let rows = RAW_ROWS.slice();
  if (maker) rows = rows.filter(r => (r.manufacturerLabel?.value || '') === maker);
  if (laptopsOnly) rows = rows.filter(r => getTypeQids(r).includes('Q3962')); // Laptop
  return rows;
}

function sortRows(rows){
  const how = $("#sort-by").val();
  if (how === 'year-desc' || how === 'year-asc'){
    rows.sort((a,b)=>{
      const ya = getYear(a) ?? -Infinity;
      const yb = getYear(b) ?? -Infinity;
      return how === 'year-desc' ? (yb - ya) : (ya - yb);
    });
  } else if (how === 'name-asc'){
    rows.sort((a,b)=> (a.itemLabel?.value||'').localeCompare(b.itemLabel?.value||''));
  } else if (how === 'manufacturer-asc'){
    rows.sort((a,b)=> (a.manufacturerLabel?.value||'').localeCompare(b.manufacturerLabel?.value||''));
  } else if (how === 'rank' && ORDER_QIDS.length){
    rows.sort((a,b)=> ORDER_QIDS.indexOf(itemQid(a.item.value)) - ORDER_QIDS.indexOf(itemQid(b.item.value)));
  }
  return rows;
}

function renderFiltered(){
  const rows = sortRows(filterRows());
  const $grid = $("#results").empty();
  if (!rows.length){
    $grid.html(`<div class="col-12"><div class="alert alert-warning">לא נמצאו תוצאות אחרי סינון. נסו להסיר מסננים.</div></div>`);
    return;
  }
  rows.forEach(r => $grid.append(buildCard(r)));
}

function setData(rows, orderQids){
  RAW_ROWS = rows || [];
  ORDER_QIDS = orderQids || [];
  populateFilters(RAW_ROWS);
  $("#controls").removeClass("d-none");
  renderFiltered();
}

function renderResults(rows, orderQids = []){ setData(rows, orderQids); }

// ---- Search flow ----
function search(term){
  setLoading(true);

  function run(lang){ return entitySearch(term, lang).then(res => res?.search || []); }

  run('en').then(list => list.length ? list : run('he'))
  .then(list => {
    const qids = (list || []).map(x => x.id).filter(Boolean);
    return fetchDetails(qids).then(res => {
      const rows = res?.results?.bindings || [];
      renderResults(rows, qids);
    });
  })
  .fail((xhr, status) => {
    if (xhr?.status === 429) {
      showToast('יותר מדי בקשות (429). המתן/י דקה ונסו שוב.');
    } else if (status === 'timeout') {
      showToast('תם הזמן לבקשה. נסו שוב.', 'warning');
    } else {
      showToast('שגיאת רשת בעת שליפת נתונים');
    }
  });
}

// ---- Events ----
$(function(){
  renderFavs();

  // Submit search
  $("#search-form").on("submit", function(e){
    e.preventDefault();
    const q = $("#model-input").val().trim();
    if (!q){ return; }
    if (q.length < 3){ showToast('הקלד/י לפחות 3 תווים לחיפוש', 'warning'); return; }
    $("#results").hide();
    search(q);
    $("#results").slideDown(160);
  });

  // Favorites button on card
  $(document).on('click', '.btn-fav', function(){
    const qid = $(this).data('qid');
    const label = $(this).data('label');
    if (isFav(qid)) { removeFav(qid); } else { addFav(qid, label); }
    $(this).toggleClass('btn-warning btn-outline-warning');
    $(this).find('i').toggleClass('bi-star bi-star-fill');
  });

  // Favorite badge click → re-search
  $(document).on('click', '.fav-badge', function(e){
    e.preventDefault();
    const label = $(this).data('label');
    $("#model-input").val(label);
    $("#search-form").trigger('submit');
  });

  // Clear favorites
  $("#clearFavs").on('click', function(){
    saveFavs([]); renderFavs(); showToast('המועדפים נוקו', 'success');
  });

  // Filters / sorting
  $('#filter-manufacturer, #filter-laptops, #sort-by').on('change', renderFiltered);
});
