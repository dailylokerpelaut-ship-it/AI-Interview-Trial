/* Preparation runs in the visitor's browser, independently of the simulator. */
(() => {
  'use strict';
  const config = JSON.parse(document.getElementById('prep-config').textContent);
  const $ = id => document.getElementById(id);
  const groups = {
    'deck-cadet':['cadet/deck','Deck Cadet'], 'engine-cadet':['cadet/engine','Engine Cadet'],
    ab:['rating/ab','AB'], oiler:['rating/oiler','Oiler'],
    'deck-junior':['deck-officer/junior','Junior Deck Officer'], 'deck-senior':['deck-officer/senior','Senior Deck Officer'],
    'engine-junior':['marine-engineer/junior','Junior Marine Engineer'], 'engine-senior':['marine-engineer/senior','Senior Marine Engineer']
  };
  const storage = {
    read(key, fallback) { try { return JSON.parse(localStorage.getItem('dlp.prep.v1.'+key)) ?? fallback; } catch { return fallback; } },
    write(key, value) { try { localStorage.setItem('dlp.prep.v1.'+key, JSON.stringify(value)); return true; } catch { return false; } }
  };
  // Strict event vocabulary. No audio, answer text, URL query, code, user ID or form values.
  const allowed = new Set(['prep_view','prep_return','path_select','rank_select','exercise_start','discussion_open','exercise_next','product_click','exercise_complete','plan_day_complete','plan_reset']);
  const paths = new Set(['cadet','rating','deck-officer','marine-engineer',...Object.keys(groups)]);
  function track(event, extra = {}) {
    if (!allowed.has(event)) return;
    const params = {page_type:config.kind, prep_rank:config.group, exercise_id:config.question || 'none'};
    if (paths.has(extra.path)) params.selected_path = extra.path;
    if (['seafarer_book','engineer_book'].includes(extra.product)) params.product = extra.product;
    if (Number.isInteger(extra.day) && extra.day >= 1 && extra.day <= 7) params.plan_day = extra.day;
    if (typeof extra.completed === 'boolean') params.completed = extra.completed;
    const querySource = new URLSearchParams(location.search).get('utm_source');
    const sources = ['whatsapp','academy','vacancy','logbook','google'];
    if (sources.includes(querySource)) params.entry_source = querySource;
    window.dataLayer = window.dataLayer || [];
    if (config.release && typeof window.gtag === 'function') window.gtag('event', event, params);
    else window.dataLayer.push({event, ...params}); // Preview telemetry stays in memory.
  }
  if (config.release && location.origin === 'https://interview.dailylokerpelaut.com') {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function(){ window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config','G-NR05C7B09B',{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false});
    // Drop query/fragment/referrer path so they cannot leak identifiers or answers.
    let safeReferrer = '';
    try { safeReferrer = new URL(document.referrer).origin; } catch {}
    window.gtag('set',{page_location:config.canonical,page_referrer:safeReferrer});
    window.gtag('event','page_view',{page_location:config.canonical,page_referrer:safeReferrer,page_title:document.title});
    const script = document.createElement('script');script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=G-NR05C7B09B';document.head.appendChild(script);
  }
  track('prep_view');
  const seen = storage.read('seen',false);
  try {
    if (!sessionStorage.getItem('dlp.prep.v1.visit')) {
      if (seen === true) track('prep_return');
      sessionStorage.setItem('dlp.prep.v1.visit','1');
    }
  } catch { /* A blocked storage API must not block practice. */ }
  storage.write('seen',true);

  const requestedTrack = new URLSearchParams(location.search).get('track');
  const engineerTracks = new Set(['marine-engineer', 'engine-junior', 'engine-senior']);
  function setEngineerTrack(link, track) {
    const url = new URL(link.href);
    if (engineerTracks.has(track)) url.searchParams.set('track', track);
    else url.searchParams.delete('track');
    link.href = url.href;
  }
  if (config.kind === 'question' && config.group === 'common' && engineerTracks.has(requestedTrack)) {
    const book = $('question-book');
    const engineerBook = $('engineer-book-template');
    if (book && engineerBook) book.replaceChildren(engineerBook.content.cloneNode(true));

    const next = document.querySelector('[data-event="exercise_next"]');
    if (next) setEngineerTrack(next, requestedTrack);
    const trackPath = groups[requestedTrack]?.[0] ?? 'marine-engineer';
    document.querySelectorAll('[data-question-list]').forEach(link => {
      link.href = `/preparation/${trackPath}/#soal-umum`;
    });
  }
  document.querySelectorAll('[data-event]').forEach(link => link.addEventListener('click',() => track(link.dataset.event,{path:link.dataset.path,product:link.dataset.product})));

  const planTrack = $('plan-track');
  if (planTrack) {
    const prior = storage.read('track','');
    planTrack.value = Object.hasOwn(groups, requestedTrack) ? requestedTrack : Object.hasOwn(groups, prior) ? prior : '';
    const dayBoxes = [...document.querySelectorAll('[data-day]')];
    const planQuestions = document.querySelectorAll('[data-plan-question]');
    function dayKey(){ return 'days.'+(planTrack.value || 'all'); }
    function savedDays(){ const value=storage.read(dayKey(),[]); return Array.isArray(value) ? value.filter(x=>Number.isInteger(x)&&x>=1&&x<=7) : []; }
    function progress() { $('plan-progress').textContent = dayBoxes.filter(x=>x.checked).length+' dari 7 hari ditandai selesai olehmu. Ini progres latihan, bukan skor kesiapan.'; }
    function loadPlan(){
      const saved = savedDays();dayBoxes.forEach(b=>b.checked=saved.includes(Number(b.dataset.day)));progress();
      const target=$('rank-day-links'); target.replaceChildren();
      const keys=groups[planTrack.value]?[planTrack.value]:Object.keys(groups);
      keys.forEach(key=>{const a=document.createElement('a');a.href='/preparation/'+groups[key][0]+'/';a.textContent=groups[key][1]+' →';target.appendChild(a);});
      planQuestions.forEach(link => setEngineerTrack(link, planTrack.value));
    }
    planTrack.addEventListener('change',()=>{storage.write('track',planTrack.value);loadPlan();track('rank_select',{path:planTrack.value});});
    dayBoxes.forEach(box=>box.addEventListener('change',()=>{
      const days=dayBoxes.filter(x=>x.checked).map(x=>Number(x.dataset.day));
      const saved=storage.write(dayKey(),days);progress();
      if(!saved)$('plan-progress').textContent+=' Penyimpanan browser tidak tersedia; tanda hanya bertahan di halaman ini.';
      track('plan_day_complete',{day:Number(box.dataset.day),completed:box.checked});
    }));
    $('reset-progress').addEventListener('click',()=>{dayBoxes.forEach(b=>b.checked=false);const saved=storage.write(dayKey(),[]);progress();if(!saved)$('plan-progress').textContent+=' Reset tidak dapat disimpan di browser.';track('plan_reset');});
    loadPlan();
  }
  if (!$('timer')) return;
  let deadline=0, remaining=90, timerId=null, started=false;
  function beginExercise(){ if(!started){ started=true;track('exercise_start'); } }
  function renderTimer(){ $('timer').textContent=String(Math.floor(remaining/60)).padStart(2,'0')+':'+String(remaining%60).padStart(2,'0'); }
  function pauseTimer(){clearInterval(timerId);timerId=null;$('timer-start').textContent=remaining===90?'Mulai timer':'Lanjutkan timer';}
  function tick(){
    remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));renderTimer();
    if(remaining===0){pauseTimer();$('timer-start').textContent='Mulai lagi';$('timer-status').textContent='Waktu latihan selesai. Kamu tetap boleh melanjutkan atau membaca pembahasan.';stopRecording();}
  }
  function startTimer(){
    if(timerId!==null)return;beginExercise();if(remaining<=0)remaining=90;
    deadline=Date.now()+remaining*1000;timerId=setInterval(tick,200);$('timer-start').textContent='Jeda timer';$('timer-status').textContent='Timer berjalan. Rekaman tidak wajib.';renderTimer();
  }
  $('timer-start').addEventListener('click',()=>{if(timerId!==null){tick();pauseTimer();}else startTimer();});
  $('timer-reset').addEventListener('click',()=>{pauseTimer();remaining=90;renderTimer();$('timer-start').textContent='Mulai timer';$('timer-status').textContent='Timer diulang. Rekaman yang aktif memiliki batas terpisah 2 menit.';});

  let generation=0, pending=false, stream=null, recorder=null, chunks=[], objectUrl=null, limitId=null, active=false, disposed=false, discard=false;
  const audio=$('playback');
  const supported=!!(window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  const status = message => { $('record-status').textContent=message; };
  function stopTracks(media){ if(media)media.getTracks().forEach(t=>t.stop()); }
  function buttons(){
    $('record').hidden=active; $('record').disabled=pending||!supported||!!recorder;
    $('record').textContent=pending?'Menunggu izin mikrofon…':'● Rekam jawaban saya';
    $('stop-record').hidden=!active;
    $('play').hidden=!objectUrl; $('delete-record').hidden=!objectUrl&&!pending&&!active;
    audio.hidden=!objectUrl;
  }
  function removeAudio(){
    audio.pause();audio.removeAttribute('src');audio.load();
    if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=null;
  }
  function stopRecording(drop=false){
    generation++;pending=false;discard=discard||drop;clearTimeout(limitId);limitId=null;
    const current=recorder;
    if(current && current.state!=='inactive') { try{current.stop();}catch{recorder=null;} }
    stopTracks(stream);stream=null;active=false;
    if(drop){chunks=[];removeAudio();}
    buttons();
  }
  function cancelAndDelete(){stopRecording(true);status(supported?'Rekaman dihapus. Tekan Rekam jawaban saya untuk mencoba lagi.':'Rekaman tidak tersedia. Timer dan pembahasan tetap dapat digunakan.');}
  async function record(){
    if(pending||active||recorder||!supported)return;
    const ownGeneration=++generation;pending=true;discard=false;removeAudio();buttons();status('Izinkan mikrofon untuk merekam. Kamu boleh melewati rekaman kapan saja.');
    let granted=null;
    try{
      // The only microphone request. Invoked exclusively by this button's click handler.
      granted=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
      if(ownGeneration!==generation||disposed){stopTracks(granted);return;}
      stream=granted;pending=false;chunks=[];
      const candidates=['audio/webm;codecs=opus','audio/mp4','audio/webm'];
      const mime=candidates.find(m=>typeof MediaRecorder.isTypeSupported==='function'&&MediaRecorder.isTypeSupported(m));
      const localRecorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);recorder=localRecorder;
      let size=0;
      localRecorder.ondataavailable=e=>{
        if(discard||disposed||!e.data.size)return;
        size+=e.data.size;
        if(size>8*1024*1024){stopRecording(true);status('Batas ukuran rekaman tercapai. Coba jawaban lebih singkat; pembahasan tetap tersedia.');return;}
        chunks.push(e.data);
      };
      localRecorder.onerror=()=>{stopRecording(true);status('Rekaman terhenti karena kendala perangkat. Timer dan pembahasan tetap bisa digunakan.');};
      localRecorder.onstop=()=>{
        clearTimeout(limitId);stopTracks(granted);if(stream===granted)stream=null;
        if(!discard&&!disposed&&chunks.length){
          const blob=new Blob(chunks,{type:localRecorder.mimeType||chunks[0].type});
          objectUrl=URL.createObjectURL(blob);audio.src=objectUrl;
          status('Rekaman selesai. Dengarkan ulang atau hapus untuk mencoba lagi.');
        }
        chunks=[];if(recorder===localRecorder)recorder=null;active=false;buttons();
      };
      localRecorder.start(1000);active=true;beginExercise();startTimer();buttons();status('Sedang merekam di browser ini. Tekan Hentikan rekaman bila selesai.');
      limitId=setTimeout(()=>{stopRecording();},120000);
    }catch(error){
      stopTracks(granted);
      if(ownGeneration!==generation||disposed)return;
      stream=null;recorder=null;pending=false;active=false;
      status(error.name==='NotAllowedError'||error.name==='SecurityError'?'Izin mikrofon ditolak. Kamu tetap bisa memakai timer, menjawab tanpa rekaman, dan membuka pembahasan.':'Mikrofon tidak tersedia atau rekaman tidak didukung. Gunakan timer dan pembahasan tanpa rekaman.');buttons();
    }
  }
  $('record').addEventListener('click',record);
  $('stop-record').addEventListener('click',()=>stopRecording());
  $('delete-record').addEventListener('click',cancelAndDelete);
  $('play').addEventListener('click',async()=>{if(!objectUrl)return;audio.currentTime=0;try{await audio.play();}catch{status('Pemutaran belum berhasil. Gunakan kontrol audio di bawah atau coba kembali.');}});
  let discussionTracked=false;
  function openDiscussion(){
    const wasPending=pending;stopRecording();pauseTimer();$('pembahasan').open=true;
    if(wasPending)status('Permintaan rekaman dibatalkan. Pembahasan tetap tersedia.');
  }
  $('skip-record').addEventListener('click',()=>{openDiscussion();$('pembahasan').scrollIntoView({behavior:'smooth'});});
  $('open-discussion').addEventListener('click',openDiscussion);
  document.querySelectorAll('[data-open-discussion]').forEach(a=>a.addEventListener('click',openDiscussion));
  $('pembahasan').addEventListener('toggle',()=>{if($('pembahasan').open){stopRecording();pauseTimer();if(!discussionTracked){track('discussion_open');discussionTracked=true;}}});
  if(['#evaluasi','#pembahasan'].includes(location.hash))openDiscussion();
  const completionKey = 'done.' + config.question;
  let completedWithoutStorage = false;
  function isCompleted(slug) {
    return (slug === config.question && completedWithoutStorage) || storage.read('done.' + slug, false) === true;
  }
  function renderCompletion() {
    const completed = isCompleted(config.question);
    $('complete').disabled = completed;
    $('complete').textContent = completed ? 'Soal selesai ✓' : 'Tandai soal selesai';

    const bar = $('lesson-progress-bar');
    if (!bar || !Array.isArray(config.question_set)) return;
    const count = config.question_set.filter(isCompleted).length;
    bar.value = count;
    $('lesson-progress-text').textContent = `${count} dari ${config.question_set.length} soal selesai`;
    $('lesson-progress-count').hidden = false;
  }
  $('complete').addEventListener('click', () => {
    if (isCompleted(config.question)) return;
    const saved = storage.write(completionKey, true);
    completedWithoutStorage = !saved;
    $('completion-status').textContent = saved ? '' : 'Progres tidak dapat disimpan. Tanda selesai hanya bertahan selama halaman ini terbuka.';
    renderCompletion();
    track('exercise_complete');
  });
  function dispose(){disposed=true;stopRecording(true);pauseTimer();}
  window.addEventListener('pagehide',dispose);
  window.addEventListener('beforeunload',dispose);
  window.addEventListener('pageshow',()=>{disposed=false;buttons();renderCompletion();});
  window.addEventListener('storage', event => {
    if (event.key === null || event.key.startsWith('dlp.prep.v1.done.')) renderCompletion();
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stopRecording();if(timerId!==null)tick();}});
  if(!supported)status('Browser ini tidak mendukung rekaman atau koneksi belum aman. Timer dan seluruh pembahasan tetap bisa dipakai.');
  buttons();renderCompletion();
})();
