// Simple client-side orb visualization + WebAudio analyser
// Minimal, privacy-first: NO audio upload. All processing local.

(() => {
  // elements
  const startBtn = document.getElementById('startMic');
  const stopBtn = document.getElementById('stopMic');
  const createPulseBtn = document.getElementById('createPulse');
  const shareLatestBtn = document.getElementById('shareLatest');
  const volBar = document.getElementById('volBar');
  const volValue = document.getElementById('volValue');
  const freqBar = document.getElementById('freqBar');
  const freqValue = document.getElementById('freqValue');
  const moodEl = document.getElementById('mood');
  const pulseList = document.getElementById('pulseList');

  const sensitivityInput = document.getElementById('sensitivity');
  const calmInput = document.getElementById('calmThreshold');
  const orbHueInput = document.getElementById('orbHue');
  const orbLifeInput = document.getElementById('orbLife');

  // nav
  const navBtns = document.querySelectorAll('.nav-btn');
  navBtns.forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      const section = b.dataset.section;
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      document.getElementById(section).classList.add('active');
    });
  });

  // canvas orb
  const canvas = document.getElementById('orbCanvas');
  const ctx = canvas.getContext('2d');

  // Keep canvas resolution crisp
  function resizeCanvas() {
    const ratio = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.floor(w * ratio);
    canvas.height = Math.floor(h * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // audio setup
  let audioCtx, analyser, source, mediaStream;
  let freqData, timeData;
  let raf = null;

  // gallery
  const pulses = [];

  function startAudio() {
    if (audioCtx) return;
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then(stream => {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.8;

        source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        freqData = new Uint8Array(analyser.frequencyBinCount);
        timeData = new Uint8Array(analyser.frequencyBinCount);
        mediaStream = stream;

        startBtn.disabled = true;
        stopBtn.disabled = false;
        loop();
      })
      .catch(err => {
        alert('Microphone access denied or not available: '+err.message);
      });
  }

  function stopAudio() {
    if (!audioCtx) return;
    if (mediaStream) {
      mediaStream.getTracks().forEach(t=>t.stop());
    }
    cancelAnimationFrame(raf);
    audioCtx.close();
    audioCtx = null;
    analyser = null;
    source = null;
    mediaStream = null;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    clearVis();
  }

  // compute RMS and primary frequency estimate
  function analyze() {
    analyser.getByteTimeDomainData(timeData);
    analyser.getByteFrequencyData(freqData);

    // rms: convert to -1..1 baseline
    let sum = 0;
    for (let i=0;i<timeData.length;i++){
      const v = (timeData[i]-128)/128;
      sum += v*v;
    }
    const rms = Math.sqrt(sum / timeData.length);

    // frequency: find max bin
    let maxIndex = 0;
    let maxVal = -Infinity;
    for (let i=0;i<freqData.length;i++){
      if (freqData[i] > maxVal) { maxVal = freqData[i]; maxIndex = i; }
    }
    const nyquist = audioCtx.sampleRate / 2;
    const freq = Math.round(maxIndex * nyquist / freqData.length);

    return { rms, freq, spectrumMaxValue: maxVal };
  }

  // mood mapping
  function computeMood(rms, freq) {
    const calmTh = parseFloat(calmInput.value);
    if (rms < calmTh) return 'Calm';
    if (freq > 2000 || rms > 0.12) return 'Active';
    if (freq > 800) return 'Alert';
    return 'Normal';
  }

  // draw orb visuals
  let lifePhase = 0;
  function drawOrb(rms, freq) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0,0,w,h);

    // background subtle
    const g = ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0, '#031619');
    g.addColorStop(1, '#031214');
    ctx.fillStyle = g;
    roundRect(ctx, 0, 0, w, h, 12);
    ctx.fill();

    // parameters
    const hue = parseInt(orbHueInput.value,10);
    const life = parseFloat(orbLifeInput.value);
    lifePhase += 0.02 * life;
    const breath = (Math.sin(lifePhase)+1)*0.5* (0.02 + rms*2.5); // size breathing
    const baseR = Math.min(w,h) * 0.12;
    const r = baseR * (1 + breath);

    // center
    const cx = w/2;
    const cy = h/2;

    // rings
    for (let i=4;i>0;i--){
      const alpha = 0.06 * (i);
      ctx.beginPath();
      ctx.arc(cx,cy, r + i*18 + (rms*80), 0, Math.PI*2);
      ctx.strokeStyle = `hsla(${hue},85%,50%,${alpha})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // core glow radial
    const rg = ctx.createRadialGradient(cx - r*0.25, cy - r*0.25, r*0.15, cx, cy, r*1.6);
    rg.addColorStop(0, `hsla(${hue},95%,65%,0.95)`);
    rg.addColorStop(0.25, `hsla(${hue},85%,55%,0.6)`);
    rg.addColorStop(1, `hsla(${hue},60%,25%,0)`);

    ctx.beginPath();
    ctx.arc(cx,cy, r*1.6, 0, Math.PI*2);
    ctx.fillStyle = rg;
    ctx.fill();

    // inner sphere
    const innerG = ctx.createRadialGradient(cx - r*0.3, cy - r*0.3, 1, cx, cy, r*0.9);
    innerG.addColorStop(0, `hsla(${hue},95%,80%,1)`);
    innerG.addColorStop(0.15, `hsla(${hue},90%,65%,0.95)`);
    innerG.addColorStop(0.6, `hsla(${hue},80%,48%,0.9)`);
    innerG.addColorStop(1, `hsla(${hue},70%,30%,0.9)`);

    ctx.beginPath();
    ctx.arc(cx,cy, r*0.95, 0, Math.PI*2);
    ctx.fillStyle = innerG;
    ctx.fill();

    // small highlights (randomized but consistent)
    for (let i=0;i<6;i++){
      const a = lifePhase*0.6 + i*0.9;
      const px = cx + Math.cos(a) * r*0.45;
      const py = cy + Math.sin(a) * r*0.25;
      ctx.beginPath();
      ctx.arc(px,py, Math.max(1, r*0.05), 0, Math.PI*2);
      ctx.fillStyle = `hsla(${hue+20},95%,90%,0.25)`;
      ctx.fill();
    }
  }

  // helper: rounded rect
  function roundRect(ctx,x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
  }

  function clearVis(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
  }

  // animation loop
  function loop(){
    if (!analyser) return;
    const { rms, freq } = analyze();

    // UI
    const sens = parseFloat(sensitivityInput.value);
    const scaledRms = Math.min(1, rms * (1 + sens*4));
    volBar.style.width = `${Math.min(100, scaledRms*400)}%`; // exaggerate for visibility
    volValue.textContent = scaledRms.toFixed(4);

    // freq bar: map 0..8000Hz to 0..100%
    const fPct = Math.min(1, freq / 4000);
    freqBar.style.width = `${Math.round(fPct*100)}%`;
    freqValue.textContent = freq;

    const mood = computeMood(scaledRms, freq);
    moodEl.textContent = mood;

    drawOrb(scaledRms, freq);

    raf = requestAnimationFrame(loop);
  }

  // pulses
  function createPulse() {
    const time = new Date().toISOString();
    const item = {
      time,
      vol: volValue.textContent,
      freq: freqValue.textContent,
      mood: moodEl.textContent
    };
    pulses.unshift(item);
    renderPulses();
  }

  function renderPulses(){
    pulseList.innerHTML = '';
    pulses.forEach(p => {
      const div = document.createElement('div');
      div.className = 'pulse-item';
      div.innerHTML = `<div><strong>${p.mood}</strong> <small>${new Date(p.time).toLocaleString()}</small></div>
                       <div style="color:var(--muted)">${p.vol} · ${p.freq}Hz</div>`;
      pulseList.appendChild(div);
    });
  }

  // share/export
  function exportJSON(){
    const blob = new Blob([JSON.stringify(pulses, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'omnikosmos-pulses.json'; document.body.appendChild(a);
    a.click(); a.remove();
  }

  function clearGallery(){
    pulses.length = 0;
    renderPulses();
  }

  // events
  startBtn.addEventListener('click', startAudio);
  stopBtn.addEventListener('click', stopAudio);
  createPulseBtn.addEventListener('click', createPulse);
  shareLatestBtn.addEventListener('click', () => {
    if (!pulses[0]) { alert('No pulses yet'); return; }
    navigator.clipboard?.writeText(JSON.stringify(pulses[0],null,2)).then(()=>alert('Latest pulse copied to clipboard'));
  });

  document.getElementById('exportJSON').addEventListener('click', exportJSON);
  document.getElementById('clearGallery').addEventListener('click', clearGallery);

  // init: small preview
  drawOrb(0.002, 120);
})();
