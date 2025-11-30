// Orbic Intelligence v3.1 — app.js
// All audio processing is client-side. Keep code minimal and robust.

let audioCtx, analyser, dataArray, source;
let canvas = document.getElementById('orbCanvas'), ctx = canvas.getContext('2d');
let startBtn = document.getElementById('startBtn'), stopBtn = document.getElementById('stopBtn');
let createPulseBtn = document.getElementById('createPulseBtn'), shareLatestBtn = document.getElementById('shareLatestBtn');
let volBar = document.getElementById('volBar'), freqBar = document.getElementById('freqBar'), moodText = document.getElementById('moodText');
let sensitivityEl = document.getElementById('sensitivity'), calmEl = document.getElementById('calmThreshold');
let orbHueEl = document.getElementById('orbHue'), orbLifeEl = document.getElementById('orbLife');
let pulseList = document.getElementById('pulseList'), exportJSON = document.getElementById('exportJSON'), clearGallery = document.getElementById('clearGallery');
let pulses = []; const STORAGE_KEY = 'orbic_pulses_v3';

let running = false;
let fitResizeTimeout = null;
let settings = { sensitivity:1, calm:0.01, hue:150, life:1.5 };

function registerSW(){
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./service-worker.js').catch(e=>console.warn('SW failed', e));
  }
}
registerSW();

// load pulses
function loadPulses(){
  try{ const raw = localStorage.getItem(STORAGE_KEY); pulses = raw?JSON.parse(raw):[]; }catch(e){pulses=[];}
  renderGallery();
}
function savePulses(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(pulses)); }

function fit(){
  const r = Math.max(1, window.devicePixelRatio || 1);
  const cssW = canvas.clientWidth || canvas.parentElement.clientWidth;
  const cssH = canvas.clientHeight || canvas.parentElement.clientHeight;
  canvas.width = Math.round(cssW * r);
  canvas.height = Math.round(cssH * r);
  ctx.setTransform(r,0,0,r,0,0);
}
window.addEventListener('resize', ()=>{
  clearTimeout(fitResizeTimeout);
  fitResizeTimeout = setTimeout(fit, 80);
});

fit();

// draw orb
let particles = [];
function drawOrb(vol, freq){
  // adapt particle count to volume to reduce CPU
  const baseCount = 12;
  const count = Math.min(120, Math.round(baseCount + (vol>0.01 ? vol*260 : vol*60) + (freq/200)));
  if(particles.length < count){
    for(let i=particles.length;i<count;i++){
      particles.push({x:Math.random(),y:Math.random(),r:Math.random()*0.6+0.4,life:Math.random()*1});
    }
  } else if(particles.length > count){
    particles.length = count;
  }

  const w = canvas.width/ (window.devicePixelRatio||1);
  const h = canvas.height/ (window.devicePixelRatio||1);
  ctx.clearRect(0,0,w,h);

  // background subtle gradient
  const g = ctx.createLinearGradient(0,0,w,h);
  g.addColorStop(0, 'rgba(2,10,12,0.6)');
  g.addColorStop(1, 'rgba(4,10,12,0.45)');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,w,h);

  // central orb
  const cx = w*0.72, cy = h*0.65;
  const size = Math.max(38, 120 * (0.5 + vol*6));
  const hue = settings.hue;
  for(let i=5;i>0;i--){
    const a = 0.06 * Math.pow(1.6,i);
    ctx.beginPath();
    const r = size * (1 + i*0.18) * (1 + Math.sin(Date.now()/1000/settings.life)*0.03);
    ctx.arc(cx, cy, r, 0, Math.PI*2);
    ctx.fillStyle = `hsla(${hue},80%,50%,${a})`;
    ctx.fill();
  }

  // particles (rings)
  particles.forEach((p, idx)=>{
    const life = (p.life + idx*0.0001 + vol*0.3) % 1;
    const radius = size * (1 + life*3) * p.r;
    ctx.beginPath();
    ctx.arc(cx + Math.sin(idx + Date.now()/2000)*8, cy + Math.cos(idx + Date.now()/2000)*6, radius, 0, Math.PI*2);
    ctx.strokeStyle = `hsla(${(hue+ (idx%7)*6)%360},70%,55%,${0.08 + (1-life)*0.08})`;
    ctx.lineWidth = 1.6; ctx.stroke();
    p.life += 0.004 + vol*0.04;
  });
}

// analysis & UI
function updateUI(vol, freq){
  volBar.value = Math.min(volBar.max, vol);
  freqBar.value = Math.min(freqBar.max, freq);
  // mood
  let mood = 'Neutral';
  if(vol < settings.calm) mood = 'Calm';
  else if(freq > 2000 || vol > 0.08) mood = 'Active';
  else if(freq > 800) mood = 'Alert';
  else mood = 'Normal';
  moodText.textContent = mood; moodText.style.color = mood==='Calm'? 'var(--accent1)' : (mood==='Active'?'#f0b030':'var(--muted)');
}

// start/stop audio
async function startMic(){
  if(running) return;
  try{
    audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    const stream = await navigator.mediaDevices.getUserMedia({ audio:true, video:false });
    source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.85;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    source.connect(analyser);
    // set freqBar max based on sample rate
    freqBar.max = audioCtx.sampleRate/2;
    running = true;
    runLoop();
  }catch(e){
    console.warn('Mic start error', e);
    alert('Unable to access microphone. Check permission and try again.');
  }
}
function stopMic(){
  if(!running) return;
  if(source && source.mediaStream) {
    source.mediaStream.getTracks().forEach(t=>t.stop());
  }
  if(audioCtx) audioCtx.close();
  running = false;
}

// audio processing loop
function rmsFromTimeDomain(buf){
  // convert 0-255 to -1..1 and compute RMS
  let sum = 0;
  for(let i=0;i<buf.length;i++){
    const v = (buf[i] - 128)/128;
    sum += v*v;
  }
  return Math.sqrt(sum / buf.length);
}
function calcPeakFreq(){
  if(!analyser) return 0;
  analyser.getByteFrequencyData(dataArray);
  // find peak
  let maxI=0, maxV=0;
  for(let i=0;i<dataArray.length;i++){
    if(dataArray[i]>maxV){maxV=dataArray[i];maxI=i;}
  }
  // map bin to Hz
  const hz = maxI * (audioCtx.sampleRate / 2) / dataArray.length;
  return hz;
}

let animId = null;
function runLoop(){
  if(!running){ cancelAnimationFrame(animId); return; }
  // time domain for volume
  const buf = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(buf);
  const volRaw = rmsFromTimeDomain(buf) * settings.sensitivity;
  const freq = calcPeakFreq();
  // update UI & draw
  updateUI(volRaw, freq);
  drawOrb(volRaw, freq);

  animId = requestAnimationFrame(runLoop);
}

// pulses (gallery)
function createPulse(){
  const now = Date.now();
  const pulse = { ts: now, vol: volBar.value, freq: freqBar.value, mood: moodText.textContent };
  pulses.unshift(pulse);
  if(pulses.length>200) pulses.pop();
  savePulses(); renderGallery();
}
function renderGallery(){
  pulseList.innerHTML = '';
  pulses.forEach((p, i)=>{
    const li = document.createElement('li'); li.className='pulse-item';
    li.innerHTML = `<div><strong>${new Date(p.ts).toLocaleString()}</strong></div>
      <div>Vol: ${Number(p.vol).toFixed(4)} · Freq: ${Math.round(p.freq)}Hz</div>
      <div>Mood: ${p.mood}</div>
      <div style="margin-top:8px"><button class="btn" data-i="${i}">Share</button></div>`;
    pulseList.appendChild(li);
    li.querySelector('button').onclick = ()=>sharePulse(i);
  });
}
function clearAllPulses(){ if(confirm('Clear all saved pulses?')){ pulses=[]; savePulses(); renderGallery(); } }
function sharePulse(i){
  const p = pulses[i];
  const out = `Pulse ${new Date(p.ts).toLocaleString()}\nVol: ${p.vol}\nFreq: ${Math.round(p.freq)}Hz\nMood: ${p.mood}`;
  if(navigator.share) navigator.share({text:out, title:'Orb Pulse'}).catch(()=>alert(out));
  else prompt('Copy pulse data', out);
}
function exportAllJSON(){
  const blob = new Blob([JSON.stringify(pulses, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'orbic-pulses.json';
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

// controls wiring
startBtn.onclick = startMic; stopBtn.onclick = stopMic;
createPulseBtn.onclick = createPulse; shareLatestBtn.onclick = ()=>{ if(pulses[0]) sharePulse(0); else alert('No pulses yet'); };
clearGallery.onclick = clearAllPulses; exportJSON.onclick = exportAllJSON;

// settings binds
sensitivityEl.oninput = e=>{ settings.sensitivity = Number(e.target.value); };
calmEl.oninput = e=>{ settings.calm = Number(e.target.value); volBar.max = Math.max(0.08, settings.calm*10); };
orbHueEl.oninput = e=>{ settings.hue = Number(e.target.value); };
orbLifeEl.oninput = e=>{ settings.life = Number(e.target.value); };

// tabs
document.getElementById('tab-live').onclick = ()=>showTab('live');
document.getElementById('tab-gallery').onclick = ()=>showTab('gallery');
document.getElementById('tab-settings').onclick = ()=>showTab('settings');
function showTab(id){
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelector(`#tab-${id}`).classList.add('active');
  fit();
}

// initial UI
fit();
loadPulses();
