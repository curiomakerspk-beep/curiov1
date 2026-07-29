'use strict';

        // --- CHROMIUM WEBVIEW BLOB BUG PATCH & CORS PROXY ---
        const originalFetch = window.fetch;
        window.fetch = function() {
            if (arguments[1] && arguments[1].method === 'POST' && arguments[1].body instanceof Blob) {
                let url = arguments[0];
                const init = arguments[1];
                
                // Route K230 uploads directly to the board (Teammate's script handles CORS natively)
                // Removed Docker proxy bypass

                return new Promise((resolve, reject) => {
                    let bytesSent = 0;
                    const xhr = new XMLHttpRequest();
                    if (xhr.upload) { xhr.upload.onprogress = (e) => { bytesSent = e.loaded; }; }
                    xhr.open('POST', url, true);
                    if (init.headers) {
                        for (let k in init.headers) {
                            xhr.setRequestHeader(k, init.headers[k]);
                        }
                    }
                    xhr.onload = () => {
                        resolve({
                            ok: xhr.status >= 200 && xhr.status < 300,
                            status: xhr.status,
                            text: () => Promise.resolve(xhr.responseText)
                        });
                    };
                    xhr.onerror = () => {
                        if (url.includes(':8080/upload') && bytesSent > 0) {
                            resolve({
                                ok: true,
                                status: 200,
                                text: () => Promise.resolve("OK: K230 Drop")
                            });
                        } else {
                            reject(new TypeError('Failed to fetch'));
                        }
                    };
                    xhr.send(init.body);
                });
            }
            return originalFetch.apply(this, arguments);
        };
        // ----------------------------------------


        


const CONVERT_SERVER = localStorage.getItem('backend_url') || `http://${window.location.hostname}:5001`;

window.addEventListener('DOMContentLoaded', () => {
    const inputEl = document.getElementById('backendUrlInput');
    if (inputEl) inputEl.value = CONVERT_SERVER;
});

function getBackendUrl() {
    const input = document.getElementById('backendUrlInput');
    let url = input?.value?.trim() || CONVERT_SERVER;
    if (url.endsWith('/')) url = url.slice(0, -1);
    return url;
}

async function postToBackend(endpoint, formData) {
    const backendUrl = getBackendUrl();
    const url = `${backendUrl}/${endpoint}`;
      try {
          return await new Promise((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.open('POST', url, true);
              xhr.responseType = 'blob';
              xhr.onload = async () => {
                  const respObj = {
                      ok: xhr.status >= 200 && xhr.status < 300,
                      status: xhr.status,
                      blob: async () => xhr.response,
                      json: async () => JSON.parse(await xhr.response.text()),
                      text: async () => await xhr.response.text(),
                      headers: { get: (name) => xhr.getResponseHeader(name) }
                  };
                  if (!respObj.ok) {
                      let msg = `Server error ${xhr.status}`;
                      try {
                          const text = await respObj.text();
                          try { msg = JSON.parse(text).error || text; } catch(e){ msg = text; }
                      } catch(e) {}
                      reject(new Error(msg));
                  } else {
                      resolve(respObj);
                  }
              };
              xhr.onerror = () => reject(new Error('Failed to fetch (Network/CORS error or WebView Blob bug)'));
              xhr.send(formData);
          });
      } catch (err) {
        throw new Error(`Backend request failed: ${url} — ${err.message}`);
    }
}

const CHUNK_BYTES      = 192;
const SERIAL_SUPPORTED = 'serial' in navigator;
const SR               = 16000;
const WINDOW_SAMPLES   = 16000;
const HOP_SAMPLES      = 8000;

let MODEL_FRAMES = 43;
let MODEL_BINS   = 232;
const FFT_WIN    = 1024;

let CLIP_MS     = 1500;
let THRESH      = 0.80;
let INFER_MS    = 500;

let recognizer     = null;
let backbone       = null;
let embedExtractor = null;
let EMBED_DIM      = 0;

let headModel      = null;
let trained        = false;
let classNamesCopy = [];

let embeddings  = {};
let classAudio  = {};

let classes = [
    {id:1, name:'Word1', color:'#4ade80'},
    {id:2, name:'Word2', color:'#60a5fa'},
];
let nextClassId = 3;
const COLORS = ['#4ade80','#60a5fa','#f87171','#fbbf24','#a78bfa','#22d3ee','#fb923c','#e879f9'];

let micStream    = null;
let micAudioCtx  = null;
let micAnalyser  = null;
let activeMicIdx = null;
let isRecording  = false;
let recStartTime = 0;
let recProgTimer = null;

let micActive    = false;
let inferStream  = null;
let inferCtx     = null;
let inferAnalyser= null;
let inferBuf     = null;
let inferBufPos  = 0;
let inferTimer   = null;
let inferProc    = null;
let visFrame     = null;

const ENC=new TextEncoder(), DEC=new TextDecoder();
let port=null, portReader=null, portWriter=null, connected=false, rxBuf='';

// ── WebSerial utilities ──────────────────────────────────────────────────
function usbLog(m,c=''){const el=document.getElementById('usbLog');if(!el)return;const l=document.createElement('div');if(c)l.className=c;l.textContent=m;el.appendChild(l);el.scrollTop=el.scrollHeight;}
function usbLogClear(){const el=document.getElementById('usbLog');if(el)el.innerHTML='';}
function usbSetPct(i,p){const pv=Math.round(p*100);const pEl=document.getElementById('usbFile'+i+'Pct');const fEl=document.getElementById('usb'+i+'Fill');if(pEl)pEl.textContent=pv+'%';if(fEl)fEl.style.width=pv+'%';}
function showUsbPanel(v){document.getElementById('usbProgressPanel')?.classList.toggle('visible',v);}
function resetUsbPanel(){usbSetPct(1,0);usbSetPct(2,0);usbLogClear();showUsbPanel(false);}
async function cleanupPort(){connected=false;try{portReader&&await portReader.cancel();}catch{}try{portReader&&portReader.releaseLock();}catch{}try{portWriter&&await portWriter.close();}catch{}try{portWriter&&portWriter.releaseLock();}catch{}try{port&&await port.close();}catch{}port=portReader=portWriter=null;}
async function rxPump(){rxBuf='';try{while(connected){const{value,done}=await portReader.read();if(done)break;if(value?.length){const t=DEC.decode(value,{stream:true});rxBuf+=t;}}}catch(e){if(connected)usbLog('RX: '+e.message,'err');}}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
async function write(d){if(!portWriter)return;await portWriter.write(typeof d==='string'?ENC.encode(d):d);}
async function enterRawREPL(){usbLog('Entering REPL...','info');await write('\x03');await sleep(200);await write('\x03');await sleep(200);rxBuf='';await write('\x01');await sleep(300);let b='',t=Date.now()+4000;while(Date.now()<t){b+=rxBuf;rxBuf='';if(b.includes('raw REPL')){usbLog('REPL ready','ok');rxBuf='';return;}await sleep(50);}await write('\x01');await sleep(500);b+=rxBuf;rxBuf='';if(b.includes('raw REPL'))usbLog('REPL ready','ok');else usbLog('REPL not found - reset board','warn');rxBuf='';}
async function exitRawREPL(){await write('\x02');await sleep(200);}
async function execPy(code){rxBuf='';await write(code);await write('\x04');let full='';const dl=Date.now()+10000;while(Date.now()<dl){if(rxBuf.length){full+=rxBuf;rxBuf='';const oi=full.indexOf('OK');if(oi>=0){const a=full.slice(oi+2);const e1=a.indexOf('\x04');if(e1>=0){const e2=a.indexOf('\x04',e1+1);if(e2>=0){const se=a.slice(e1+1,e2).trim();if(se)usbLog('stderr: '+se,'warn');return a.slice(0,e1).trim();}}}if(full.includes('\r\n>')||full==='>'){await write('\x03');await sleep(100);rxBuf='';throw new Error('REPL continuation');}}await sleep(10);}throw new Error('Timeout');}
async function ensureDir(p){await execPy(`import os\r\ntry:\r\n os.mkdir('${p.replace(/\/$/,"")}')\r\nexcept:pass`);}
async function writeFileOnBoard(dest,arr,onPct){await execPy(`_f=open('${dest}','wb')`);let off=0;while(off<arr.length){const sl=arr.slice(off,off+CHUNK_BYTES);const hex=Array.from(sl).map(b=>b.toString(16).padStart(2,'0')).join('');await execPy(`_f.write(bytes.fromhex('${hex}'))`);off+=sl.length;if(onPct)onPct(off/arr.length);}await execPy(`_f.close();del _f`);}
function onDeployMethodChange(val){document.getElementById('wifiRow').style.display=val==='wifi'?'flex':'none';document.getElementById('onlineWifiRow').style.display=val==='online'?'flex':'none';document.getElementById('usbBaudRow').style.display=val==='usb'?'flex':'none';if(val!=='usb')showUsbPanel(false);}

// ── Online Wi-Fi (board on existing router network) ──────────────────────
function onlineUrl(path){const ip=document.getElementById('onlineIpInput').value.trim();const pt=document.getElementById('onlinePortInput').value.trim()||'8080';return `http://${ip}:${pt}${path}`;}
async function pingOnlineK230(){
    const statusEl=document.getElementById('onlinePingStatus');
    const ip=document.getElementById('onlineIpInput').value.trim();
    if(!ip){statusEl.className='k230-online-status err';statusEl.textContent='Enter board IP first.';return;}
    statusEl.className='k230-online-status chk';statusEl.textContent='Pinging...';
    try{
        await fetch(onlineUrl('/'),{method:'GET',signal:AbortSignal.timeout(5000)});
        statusEl.className='k230-online-status ok';statusEl.textContent='Board reachable at '+ip;
    }catch(e){
        statusEl.className='k230-online-status err';statusEl.textContent='Not reachable. Check IP / Wi-Fi.';
    }
}
function getOnlineLocalSubnet(){
    return new Promise(resolve=>{
        try{
            const pc=new RTCPeerConnection({iceServers:[]});
            pc.createDataChannel('');
            pc.createOffer().then(o=>pc.setLocalDescription(o));
            pc.onicecandidate=e=>{
                if(!e||!e.candidate)return;
                const m=e.candidate.candidate.match(/(\d+\.\d+\.\d+)\.\d+/);
                if(m){pc.close();resolve(m[1]);}
            };
            setTimeout(()=>resolve(null),3000);
        }catch(e){resolve(null);}
    });
}
async function autoDetectOnlineK230(){
    const detectBtn=document.getElementById('onlineDetectBtn');
    const pingBtn=document.getElementById('onlinePingBtn');
    const statusEl=document.getElementById('onlinePingStatus');
    const pt=document.getElementById('onlinePortInput').value.trim()||'8080';
    detectBtn.disabled=true;pingBtn.disabled=true;detectBtn.textContent='Scanning...';
    statusEl.className='k230-online-status chk';statusEl.textContent='Detecting local subnet...';
    const subnet=await getOnlineLocalSubnet();
    if(!subnet){
        statusEl.className='k230-online-status err';statusEl.textContent='Could not detect subnet. Enter IP manually.';
        detectBtn.disabled=false;pingBtn.disabled=false;detectBtn.textContent='Auto-Detect';
        return;
    }
    statusEl.textContent=`Scanning ${subnet}.1–254 on port ${pt}...`;
    const probes=[];
    for(let i=1;i<=254;i++){
        const ip=`${subnet}.${i}`;
        probes.push(fetch(`http://${ip}:${pt}/`,{method:'GET',signal:AbortSignal.timeout(1500)}).then(r=>r.ok?ip:null).catch(()=>null));
    }
    const results=await Promise.all(probes);
    const found=results.find(r=>r!==null);
    if(found){
        document.getElementById('onlineIpInput').value=found;
        localStorage.setItem('k230_online_ip',found);
        statusEl.className='k230-online-status ok';statusEl.textContent='K230 found at '+found;
    }else{
        statusEl.className='k230-online-status err';statusEl.textContent='K230 not found on this network.';
    }
    detectBtn.disabled=false;pingBtn.disabled=false;detectBtn.textContent='Auto-Detect';
}
(function(){
    const el=document.getElementById('onlineIpInput');
    if(!el)return;
    const saved=localStorage.getItem('k230_online_ip');
    if(saved)el.value=saved;
    el.addEventListener('change',()=>localStorage.setItem('k230_online_ip',el.value.trim()));
})();
function downloadBlob(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(()=>URL.revokeObjectURL(url),1000);}

// ── Helpers ──────────────────────────────────────────────────────────────
function setStatus(msg){document.getElementById('statusBar').textContent=msg;}
function updateThresh(v){THRESH=parseInt(v)/100;const el=document.getElementById('thresholdValue');if(el)el.textContent=v+'%';}
function updateInferInterval(v){INFER_MS=parseInt(v);const e1=document.getElementById('threshDisplay2');if(e1)e1.textContent=v+'ms';const e2=document.getElementById('inferDisplay');if(e2)e2.textContent=v+'ms';if(micActive)restartInferTimer();}
function isNoise(name){const n=name.toLowerCase();return n.includes('noise')||n.includes('background')||n.includes('silence');}
function updateButtons(){const ok=trained;['deployHeaderBtn','deployCardBtn','deployK230Btn','exportBtn','exportEsp32Btn','deployEsp32Btn'].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=!ok;});const mb=document.getElementById('micBtn');if(mb)mb.disabled=!ok;}

// ── Clip length ───────────────────────────────────────────────────────────
function setClipLen(ms){
    CLIP_MS=ms;
    document.querySelectorAll('.cl-btn').forEach(b=>b.classList.toggle('active',parseInt(b.dataset.ms)===ms));
    const nW=computeNWindows(ms);
    const h=document.getElementById('clipLenHint');
    if(h)h.innerHTML=`Each clip is recorded for <b>${ms/1000}s</b>, sliced into <b>${nW}</b> overlapping 1-sec windows, each embedded -> averaged -> 1 clip vector.`;
    const a=document.getElementById('nWindows');    if(a)a.textContent=nW;
    const b=document.getElementById('pbClipLen');   if(b)b.textContent=ms/1000;
    const c2=document.getElementById('pbWindows');  if(c2)c2.textContent=nW;
}
function computeNWindows(ms){const samples=Math.ceil(SR*(ms/1000));let n=0,start=0;while(start+WINDOW_SAMPLES<=samples){n++;start+=HOP_SAMPLES;}return Math.max(1,n);}

// ── Build embedding extractor from backbone layer references ─────────────
function buildEmbedExtractor(){
    const layers=backbone.layers;
    let embedLayer=null, embedDim=0;
    for(let i=layers.length-2;i>=0;i--){
        const layer=layers[i];
        const shape=layer.outputShape;
        const flat=Array.isArray(shape[0])?shape[0]:shape;
        if(flat.length===2&&typeof flat[1]==='number'&&flat[1]>=32){embedLayer=layer;embedDim=flat[1];break;}
    }
    if(!embedLayer){embedLayer=layers[layers.length-2];const shape=embedLayer.outputShape;const flat=Array.isArray(shape[0])?shape[0]:shape;embedDim=flat[flat.length-1]||128;}
    console.log('[EmbedExtractor] using layer "'+embedLayer.name+'" dim '+embedDim);
    embedExtractor=tf.model({inputs:backbone.inputs,outputs:embedLayer.output});
    EMBED_DIM=embedDim;
    try{const inShape=backbone.inputs[0].shape;if(Array.isArray(inShape)&&inShape.length===4){if(inShape[1])MODEL_FRAMES=inShape[1];if(inShape[2])MODEL_BINS=inShape[2];}console.log('[BackboneShape]',JSON.stringify(inShape));}catch(e){console.warn('[BackboneShape]',e);}
    const nameEl=document.getElementById('embedLayerName');const dimEl=document.getElementById('embedLayerDim');
    const infoBox=document.getElementById('embedInfoBox');const pbDim=document.getElementById('pbEmbedDim');
    if(nameEl)nameEl.textContent=embedLayer.name;if(dimEl)dimEl.textContent=embedDim;
    if(infoBox)infoBox.style.display='block';if(pbDim)pbDim.textContent=embedDim;
    return embedDim;
}

// ── Load backbone ────────────────────────────────────────────────────────
async function loadBackbone(){
    const fill=document.getElementById('modelLoadFill');
    const icon=document.getElementById('modelLoadIcon');
    const title=document.getElementById('modelLoadTitle');
    const sub=document.getElementById('modelLoadStatus');
    try{
        let p=0;
        const ticker=setInterval(()=>{p=Math.min(90,p+Math.random()*10);if(fill)fill.style.width=p+'%';},300);
        
        const modelUrl = new URL('./offline_libs/models/speech_commands/model.json', window.location.href).href;
        const metadataUrl = new URL('./offline_libs/models/speech_commands/metadata.json', window.location.href).href;
        recognizer=speechCommands.create('BROWSER_FFT', null, modelUrl, metadataUrl);
        await recognizer.ensureModelLoaded();
        backbone=recognizer.model;
        clearInterval(ticker);
        buildEmbedExtractor();
        if(fill){fill.style.width='100%';fill.style.background='#10b981';}
        if(icon)icon.textContent='✅';
        if(title)title.textContent='Backbone ready — Speech Commands v2 (embed dim: '+EMBED_DIM+')';
        if(sub)sub.textContent=EMBED_DIM+'-dim embeddings. Manual pipeline active.';
        document.getElementById('modelLoadBar').style.borderLeftColor='#10b981';
        ['addClassBtn','addNoiseBtn','trainBtn'].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=false;});
        setStatus('Backbone loaded (embed dim: '+EMBED_DIM+') — add clips for each class, then train.');
        render();
    }catch(e){
        if(fill){fill.style.width='100%';fill.style.background='#ef4444';}
        if(icon)icon.textContent='❌';
        if(title)title.textContent='Failed to load backbone';
        if(sub)sub.textContent=e.message;
        setStatus('Backbone load failed: '+e.message);
        console.error(e);
    }
}

// ── Pure-JS radix-2 Cooley-Tukey FFT ────────────────────────────────────
function realFFTMagnitudes(signal){
    const n=signal.length;
    const re=new Float32Array(signal);
    const im=new Float32Array(n);
    const bits=Math.log2(n)|0;
    for(let i=1,j=0;i<n;i++){let bit=n>>1,x=i;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){let t=re[i];re[i]=re[j];re[j]=t;}}
    for(let len=2;len<=n;len<<=1){const ang=-2*Math.PI/len,wR=Math.cos(ang),wI=Math.sin(ang),half=len>>1;for(let i=0;i<n;i+=len){let cR=1,cI=0;for(let j=0;j<half;j++){const uR=re[i+j],uI=im[i+j],vR=re[i+j+half]*cR-im[i+j+half]*cI,vI=re[i+j+half]*cI+im[i+j+half]*cR;re[i+j]=uR+vR;im[i+j]=uI+vI;re[i+j+half]=uR-vR;im[i+j+half]=uI-vI;const nr=cR*wR-cI*wI;cI=cR*wI+cI*wR;cR=nr;}}}
    const mag=new Float32Array(n>>1);
    for(let i=0;i<(n>>1);i++)mag[i]=Math.sqrt(re[i]*re[i]+im[i]*im[i]);
    return mag;
}

// ── Spectrogram preprocessing ────────────────────────────────────────────
function computeSpectrogram(pcm16k){
    const n=pcm16k.length,win=FFT_WIN;
    const hop=MODEL_FRAMES>1?Math.max(1,Math.floor((n-win)/(MODEL_FRAMES-1))):n;
    const hann=new Float32Array(win);
    for(let i=0;i<win;i++)hann[i]=0.5*(1-Math.cos(2*Math.PI*i/(win-1)));
    const specData=new Float32Array(MODEL_FRAMES*MODEL_BINS);
    for(let f=0;f<MODEL_FRAMES;f++){
        const s=f*hop;
        const frame=new Float32Array(win);
        for(let i=0;i<win;i++)frame[i]=((s+i)<n?pcm16k[s+i]:0)*hann[i];
        const mag=realFFTMagnitudes(frame);
        for(let b=0;b<MODEL_BINS;b++)specData[f*MODEL_BINS+b]=Math.log(Math.max(mag[b],1e-6));
    }
    return tf.tensor4d(specData,[1,MODEL_FRAMES,MODEL_BINS,1]);
}
function computeNormalizedSpectrogram(pcm16k){
    const spec = computeSpectrogram(pcm16k);
    const data = spec.dataSync();
    spec.dispose();
    const len = data.length;
    let sum = 0, sumsq = 0;
    for (let i = 0; i < len; i++) {
        sum += data[i];
        sumsq += data[i] * data[i];
    }
    const mean = sum / len;
    const variance = Math.max(0, (sumsq / len) - mean * mean);
    const stdDev = Math.sqrt(variance) + 1e-4;
    const normalized = new Float32Array(len);
    for (let i = 0; i < len; i++) {
        normalized[i] = (data[i] - mean) / stdDev;
    }
    return tf.tensor4d(normalized, [1, MODEL_FRAMES, MODEL_BINS, 1]);
}
function prepareWindowInput(pcm16k){return computeSpectrogram(pcm16k);}

// ── Embed one window ─────────────────────────────────────────────────────
async function embedWindow(pcm16k){
    if(!embedExtractor)throw new Error('Embedding extractor not built yet');
    const input=prepareWindowInput(pcm16k);
    const embedding=embedExtractor.predict(input);
    input.dispose();
    const flat=embedding.reshape([-1]);
    embedding.dispose();
    const arr=await flat.data();
    flat.dispose();
    return new Float32Array(arr);
}

// ── Embed full clip (slice into windows, embed each, average, L2-normalise) ──
async function embedClip(pcmFull){
    const totalSamples=pcmFull.length;
    const windows=[];
    let start=0;
    while(start+WINDOW_SAMPLES<=totalSamples){windows.push(pcmFull.slice(start,start+WINDOW_SAMPLES));start+=HOP_SAMPLES;}
    if(windows.length===0){const padded=new Float32Array(WINDOW_SAMPLES);padded.set(pcmFull.slice(0,WINDOW_SAMPLES));windows.push(padded);}
    const embeds=[];
    for(const win of windows){const e=await embedWindow(win);embeds.push(e);}
    const dim=embeds[0].length;
    const avg=new Float32Array(dim);
    for(const e of embeds)for(let i=0;i<dim;i++)avg[i]+=e[i];
    for(let i=0;i<dim;i++)avg[i]/=embeds.length;
    let norm=0;for(let i=0;i<dim;i++)norm+=avg[i]*avg[i];
    norm=Math.sqrt(norm)+1e-8;
    for(let i=0;i<dim;i++)avg[i]/=norm;
    return avg;
}

// ── Decode + resample ────────────────────────────────────────────────────
async function decodeAndResample(blob){
    const ab=await blob.arrayBuffer();
    const decCtx=new AudioContext();
    const decoded=await decCtx.decodeAudioData(ab);
    await decCtx.close();
    const targetLen=Math.ceil(decoded.duration*SR);
    const offCtx=new OfflineAudioContext(1,targetLen,SR);
    const src=offCtx.createBufferSource();
    src.buffer=decoded;src.connect(offCtx.destination);src.start(0);
    const rendered=await offCtx.startRendering();
    return rendered.getChannelData(0).slice();
}

// ── PCM -> WAV ────────────────────────────────────────────────────────────
function pcmToWav(pcm,sr=16000){
    const n=pcm.length,ds=n*2,buf=new ArrayBuffer(44+ds),v=new DataView(buf);
    const ws=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};
    ws(0,'RIFF');v.setUint32(4,36+ds,true);ws(8,'WAVE');ws(12,'fmt ');
    v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
    v.setUint32(24,sr,true);v.setUint32(28,sr*2,true);
    v.setUint16(32,2,true);v.setUint16(34,16,true);ws(36,'data');v.setUint32(40,ds,true);
    let o=44;for(let i=0;i<n;i++){const s=Math.max(-1,Math.min(1,pcm[i]));v.setInt16(o,s<0?s*0x8000:s*0x7FFF,true);o+=2;}
    return new Blob([buf],{type:'audio/wav'});
}

// ── Mic capture ──────────────────────────────────────────────────────────
async function openMic(classIdx){
    if(!backbone||!embedExtractor){setStatus('Backbone not loaded yet.');return;}
    if(activeMicIdx!==null)stopMic();
    try{
        micStream=await navigator.mediaDevices.getUserMedia({audio:true});
        micAudioCtx=new AudioContext({sampleRate:SR});  // Explicitly 16kHz to match ESP32-S3
        micAnalyser=micAudioCtx.createAnalyser();micAnalyser.fftSize=1024;
        micAudioCtx.createMediaStreamSource(micStream).connect(micAnalyser);
        activeMicIdx=classIdx;render();animateMicVis(classIdx);
        setStatus('Mic open — hold the button to record a clip.');
    }catch(e){alert('Mic error: '+e.message);}
}

function stopMic(){
    clearInterval(recProgTimer);recProgTimer=null;
    if(micStream){micStream.getTracks().forEach(t=>t.stop());micStream=null;}
    if(micAudioCtx){micAudioCtx.close().catch(()=>{});micAudioCtx=null;}
    micAnalyser=null;activeMicIdx=null;isRecording=false;render();setStatus('Mic stopped.');
}

function animateMicVis(classIdx){
    const canvas=document.getElementById('mic-vis-'+classIdx);
    if(!canvas||activeMicIdx!==classIdx)return;
    requestAnimationFrame(()=>animateMicVis(classIdx));
    const ctx=canvas.getContext('2d');const W=canvas.width,H=canvas.height;
    ctx.fillStyle='#060a10';ctx.fillRect(0,0,W,H);
    if(micAnalyser){
        const buf=new Uint8Array(micAnalyser.frequencyBinCount);
        micAnalyser.getByteTimeDomainData(buf);
        const cls=classes[classIdx];
        ctx.beginPath();ctx.strokeStyle=cls?.color||'#4ade80';ctx.lineWidth=1.2;
        for(let i=0;i<W;i++){const v=(buf[Math.floor(i*buf.length/W)]/128)-1;const y=H/2+v*(H/2-3);i===0?ctx.moveTo(i,y):ctx.lineTo(i,y);}
        ctx.stroke();
    }
}

async function recordClip(classIdx){
    if(!backbone||!embedExtractor||activeMicIdx!==classIdx||isRecording)return;
    const cls=classes[classIdx];
    isRecording=true;recStartTime=Date.now();
    const progFill=document.getElementById('rec-prog-'+classIdx);
    if(progFill){const total=CLIP_MS;recProgTimer=setInterval(()=>{const elapsed=Date.now()-recStartTime;const pct=Math.min(100,(elapsed/total)*100);progFill.style.width=pct+'%';if(pct>=100)clearInterval(recProgTimer);},30);}
    try{
        const chunks=[];
        const mr=new MediaRecorder(micStream);
        mr.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data);};
        mr.start(100);
        await sleep(CLIP_MS);
        await new Promise(res=>{mr.onstop=res;mr.stop();});
        clearInterval(recProgTimer);if(progFill)progFill.style.width='100%';
        setStatus('Processing clip...');
        const blob=new Blob(chunks,{type:chunks[0]?.type||'audio/webm'});
        const pcm=await decodeAndResample(blob);
        if(!classAudio[cls.name])classAudio[cls.name]=[];
        classAudio[cls.name].push(pcm.slice());
        const emb=await embedClip(pcm);
        if(!embeddings[cls.name])embeddings[cls.name]=[];
        embeddings[cls.name].push(emb);
        const count=embeddings[cls.name].length;
        const countEl=document.getElementById('cc-count-'+classIdx);if(countEl)countEl.textContent=count+' clips';
        const visCount=document.getElementById('vis-count-'+classIdx);if(visCount)visCount.textContent=count+' clips';
        rebuildVoiceThumbs(classIdx);renderStats();
        trained=false;updateButtons();
        setStatus('Clip '+count+' for "'+cls.name+'" — '+(pcm.length/SR).toFixed(2)+'s -> '+computeNWindows(CLIP_MS)+' windows -> '+EMBED_DIM+'-dim');
    }catch(e){setStatus('Record error: '+e.message);console.error(e);}
    finally{isRecording=false;clearInterval(recProgTimer);if(progFill)progFill.style.width='0%';}
}

function startHold(classIdx){recordClip(classIdx);}
function stopHold(){}

// ── Thumbnails ────────────────────────────────────────────────────────────
let playingCtx=null;

function drawWaveThumb(canvas,pcm,color){
    const ctx=canvas.getContext('2d');const W=canvas.width,H=canvas.height;
    ctx.fillStyle='#060a10';ctx.fillRect(0,0,W,H);
    const step=Math.max(1,Math.floor(pcm.length/W));
    ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=1;
    for(let i=0;i<W;i++){let sum=0;for(let j=0;j<step;j++)sum+=Math.abs(pcm[i*step+j]||0);const amp=(sum/step)*H*2.5;const y=H/2-amp/2;i===0?ctx.moveTo(i,H/2):ctx.lineTo(i,Math.max(1,Math.min(H-1,y)));}
    ctx.stroke();
}

async function playClip(classIdx,clipIdx,btnEl){
    if(playingCtx){try{playingCtx.close();}catch{}playingCtx=null;}
    document.querySelectorAll('.thumb-play.playing').forEach(b=>{b.classList.remove('playing');b.textContent='▶';});
    const cls=classes[classIdx];
    const pcm=(classAudio[cls.name]||[])[clipIdx];
    if(!pcm){setStatus('No audio stored for this clip.');return;}
    try{
        playingCtx=new AudioContext({sampleRate:SR});
        const buf=playingCtx.createBuffer(1,pcm.length,SR);buf.copyToChannel(pcm,0);
        const s=playingCtx.createBufferSource();s.buffer=buf;s.connect(playingCtx.destination);s.start(0);
        if(btnEl){btnEl.classList.add('playing');btnEl.textContent='■';}
        s.onended=()=>{if(btnEl){btnEl.classList.remove('playing');btnEl.textContent='▶';}playingCtx=null;};
    }catch(e){setStatus('Playback error: '+e.message);}
}

function rebuildVoiceThumbs(classIdx){
    const cls=classes[classIdx];
    const thumbsEl=document.getElementById('thumbs-'+classIdx);if(!thumbsEl)return;
    thumbsEl.innerHTML='';
    const audioClips=classAudio[cls.name]||[];
    audioClips.forEach((pcm,ci)=>{
        const wrap=document.createElement('div');wrap.className='thumb';
        const cv=document.createElement('canvas');cv.width=44;cv.height=26;
        drawWaveThumb(cv,pcm,cls.color);
        const del=document.createElement('button');del.className='thumb-del';del.textContent='X';
        del.onclick=()=>{
            if(classAudio[cls.name])classAudio[cls.name].splice(ci,1);
            if(embeddings[cls.name])embeddings[cls.name].splice(ci,1);
            const count=(embeddings[cls.name]||[]).length;
            const ce=document.getElementById('cc-count-'+classIdx);if(ce)ce.textContent=count+' clips';
            renderStats();trained=false;updateButtons();
            rebuildVoiceThumbs(classIdx);
        };
        const play=document.createElement('button');play.className='thumb-play';play.textContent='▶';play.title=(pcm.length/SR).toFixed(2)+'s @ 16kHz';
        play.onclick=()=>playClip(classIdx,ci,play);
        wrap.appendChild(cv);wrap.appendChild(del);wrap.appendChild(play);thumbsEl.appendChild(wrap);
    });
}

// ── Render ────────────────────────────────────────────────────────────────
function render(){renderClasses();renderStats();initOutputBars();}

function renderClasses(){
    const container=document.getElementById('classList');container.innerHTML='';
    classes.forEach((cls,idx)=>{
        const count=(embeddings[cls.name]||[]).length;
        const isRec=activeMicIdx===idx;
        const isNoiseCls=isNoise(cls.name);
        const card=document.createElement('div');card.className='class-card';
        card.innerHTML=`
        <div class="class-header">
            <input class="class-name" style="color:${cls.color}" value="${cls.name}"
                onchange="renameClass(${idx},this.value)" oninput="renameClass(${idx},this.value)"/>
            <span class="sample-count" id="cc-count-${idx}">${count} clips</span>
            <button class="remove-btn" onclick="removeClass(${idx})">X</button>
        </div>
        ${isNoiseCls?'<div><span class="noise-badge">🔇 NOISE CLASS</span></div>':''}
        ${isRec?`
        <div class="mic-vis-wrap">
            <canvas id="mic-vis-${idx}" class="mic-vis-canvas" width="300" height="72"></canvas>
            <div class="mic-vis-label"><span class="rec-dot"></span> RECORDING</div>
            <div class="mic-vis-count" id="vis-count-${idx}">${count} clips</div>
            <div class="rec-progress"><div class="rec-progress-fill" id="rec-prog-${idx}"></div></div>
        </div>
        <div class="cam-btns">
            <button class="hold-btn" style="background:${cls.color}"
                onmousedown="startHold(${idx})" onmouseup="stopHold()"
                onmouseleave="stopHold()" ontouchstart="startHold(${idx})" ontouchend="stopHold()">
                🎤 Hold to Record (${CLIP_MS/1000}s)
            </button>
            <button class="stop-btn" onclick="stopMic()">Stop</button>
        </div>`:`
        <div class="add-btns">
            <button class="add-btn" style="color:${cls.color};border-color:${cls.color};background:${cls.color}18" onclick="openMic(${idx})">🎤 Record</button>
            <button class="add-btn" style="color:${cls.color};border-color:${cls.color};background:${cls.color}18" onclick="uploadWav(${idx})">⬆ Upload WAV</button>
        </div>`}
        ${isNoiseCls?'<div class="noise-hint">🔇 Record silence or ambient sound — no speech</div>':''}
        <div class="thumbs" id="thumbs-${idx}"></div>
        ${count>0?`<div class="class-actions">
            <button class="extract-btn-card" style="color:${cls.color};border-color:${cls.color};background:${cls.color}10" onclick="extractClips(${idx})">
                ⧉ Extract (x2) <span style="font-size:10px;font-weight:400;color:#94a3b8">${count}->${count*2}</span>
            </button>
            <button class="download-btn-card" onclick="downloadClassClips(${idx})">⬇ Download Clips (${count} WAV)</button>
        </div>`:''}`;
        container.appendChild(card);
        rebuildVoiceThumbs(idx);
        if(isRec&&micAnalyser)animateMicVis(idx);
    });
}

function renderStats(){
    document.getElementById('statList').innerHTML=classes.map(cls=>`
        <div class="stat-row">
            <div class="stat-dot" style="background:${cls.color}"></div>
            <span class="stat-name">${cls.name}</span>
            <span class="stat-count">${(embeddings[cls.name]||[]).length} clips</span>
        </div>`).join('');
}

// ── Class management ──────────────────────────────────────────────────────
function addClass(){const id=nextClassId++;classes.push({id,name:'Word'+id,color:COLORS[(id-1)%COLORS.length]});render();}
function addNoiseClass(){if(classes.find(c=>isNoise(c.name))){alert('Noise class already exists!');return;}classes.push({id:nextClassId++,name:'Background Noise',color:'#fbbf24'});render();setStatus('Noise class added — record silence or ambient room sound.');}
function removeClass(idx){if(classes.length<=2){alert('Need at least 2 classes');return;}if(activeMicIdx===idx)stopMic();const cls=classes[idx];delete embeddings[cls.name];delete classAudio[cls.name];classes.splice(idx,1);trained=false;updateButtons();render();}
function renameClass(idx,name){const cls=classes[idx];const old=cls.name;if(old===name)return;if(embeddings[old]){embeddings[name]=embeddings[old];delete embeddings[old];}if(classAudio[old]){classAudio[name]=classAudio[old];delete classAudio[old];}cls.name=name;renderStats();const lEl=document.getElementById('output-label-'+idx);if(lEl){lEl.textContent=name;lEl.style.color=cls.color;}}

// ── Extract x2 ────────────────────────────────────────────────────────────
function extractClips(classIdx){
    const cls=classes[classIdx];const embs=embeddings[cls.name]||[];const audio=classAudio[cls.name]||[];
    if(embs.length===0){alert('No clips to extract.');return;}
    embeddings[cls.name]=[...embs,...embs.map(e=>e.slice())];
    classAudio[cls.name]=[...audio,...audio.map(p=>p.slice())];
    const newCount=embeddings[cls.name].length;
    const countEl=document.getElementById('cc-count-'+classIdx);if(countEl)countEl.textContent=newCount+' clips';
    renderStats();trained=false;updateButtons();
    rebuildVoiceThumbs(classIdx);
    setStatus('"'+cls.name+'" doubled to '+newCount+' clips. Re-train.');
}

// ── Upload WAV ────────────────────────────────────────────────────────────
function uploadWav(classIdx){
    const cls=classes[classIdx];
    const input=document.createElement('input');input.type='file';input.accept='audio/*';input.multiple=true;
    input.onchange=async e=>{
        for(const file of Array.from(e.target.files)){
            try{
                setStatus('Processing "'+file.name+'"...');
                const ab=await file.arrayBuffer();const decCtx=new AudioContext();const decoded=await decCtx.decodeAudioData(ab);await decCtx.close();
                const targetLen=Math.ceil(decoded.duration*SR);const offCtx=new OfflineAudioContext(1,targetLen,SR);const src=offCtx.createBufferSource();src.buffer=decoded;src.connect(offCtx.destination);src.start(0);const rendered=await offCtx.startRendering();const pcmFull=rendered.getChannelData(0).slice();
                const clipSamples=Math.ceil(SR*(CLIP_MS/1000));const numClips=Math.max(1,Math.floor(pcmFull.length/clipSamples));
                for(let ci=0;ci<numClips;ci++){
                    const chunk=pcmFull.slice(ci*clipSamples,(ci+1)*clipSamples);const padded=new Float32Array(clipSamples);padded.set(chunk.slice(0,clipSamples));
                    const emb=await embedClip(padded);
                    if(!embeddings[cls.name])embeddings[cls.name]=[];if(!classAudio[cls.name])classAudio[cls.name]=[];
                    embeddings[cls.name].push(emb);classAudio[cls.name].push(padded);
                    const count=embeddings[cls.name].length;const countEl=document.getElementById('cc-count-'+classIdx);if(countEl)countEl.textContent=count+' clips';
                    rebuildVoiceThumbs(classIdx);renderStats();
                    setStatus('WAV clip '+(ci+1)+'/'+numClips+' embedded for "'+cls.name+'"');
                }
                trained=false;updateButtons();setStatus('"'+file.name+'" -> '+numClips+' clips added for "'+cls.name+'"');
            }catch(err){setStatus('Upload error: '+err.message);console.error(err);}
        }
    };
    input.click();
}

// ── Download ──────────────────────────────────────────────────────────────
async function downloadClassClips(classIdx){
    const cls=classes[classIdx];const clips=classAudio[cls.name]||[];
    if(clips.length===0){alert('No clips recorded yet.');return;}
    const zip=new JSZip();const fn=cls.name.replace(/[^a-zA-Z0-9_-]/g,'_');const folder=zip.folder(fn);
    clips.forEach((pcm,i)=>folder.file(fn+'_'+String(i+1).padStart(3,'0')+'.wav',pcmToWav(pcm)));
    zip.file('labels.txt',classes.map(c=>c.name).join('\n'));
    const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE'});
    downloadBlob(blob,fn+'_clips.zip');
    setStatus('Downloaded '+clips.length+' WAV clips for "'+cls.name+'"');
}

async function downloadAllClips(){
    const total=Object.values(classAudio).reduce((s,a)=>s+a.length,0);
    if(total===0){alert('No clips recorded yet.');return;}
    const zip=new JSZip();
    classes.forEach(cls=>{const clips=classAudio[cls.name]||[];if(!clips.length)return;const fn=cls.name.replace(/[^a-zA-Z0-9_-]/g,'_');const folder=zip.folder(fn);clips.forEach((pcm,i)=>folder.file(fn+'_'+String(i+1).padStart(3,'0')+'.wav',pcmToWav(pcm)));});
    zip.file('labels.txt',classes.map(c=>c.name).join('\n'));
    const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE'});
    downloadBlob(blob,'voice_dataset.zip');
    setStatus('Downloaded all '+total+' clips as voice_dataset.zip');
}

// ── Output bars ────────────────────────────────────────────────────────────
function initOutputBars(){
    document.getElementById('outputBars').innerHTML=classes.map((cls,i)=>`
        <div class="output-row">
            <span class="output-label" style="color:${cls.color}" id="output-label-${i}">${cls.name}</span>
            <div class="output-bar-wrap">
                <div class="output-bar-fill" id="output-bar-${i}" style="width:0%;background:${cls.color}">
                    <span class="output-bar-pct" id="output-pct-${i}"></span>
                </div>
                <span class="output-bar-pct-outside" id="output-pct-out-${i}">0%</span>
            </div>
        </div>`).join('');
}

function updateOutputBars(probs){
    const best=probs.reduce((a,b)=>a.score>b.score?a:b);
    const isAbove=best.score>=THRESH;const isNoiseCls=isNoise(best.className);const detected=isAbove&&!isNoiseCls;
    probs.forEach((p,i)=>{
        const pct=Math.round(p.score*100);const cls=classes.find(c=>c.name===p.className);const color=cls?.color||COLORS[i%COLORS.length];
        const bEl=document.getElementById('output-bar-'+i);const pEl=document.getElementById('output-pct-'+i);const oEl=document.getElementById('output-pct-out-'+i);const lEl=document.getElementById('output-label-'+i);
        if(!bEl)return;bEl.style.width=pct+'%';bEl.style.background=color;
        if(pct>20){pEl.textContent=pct+'%';oEl.textContent='';}else{pEl.textContent='';oEl.textContent=pct+'%';}
        if(lEl){lEl.textContent=p.className;lEl.style.color=color;}
    });
    const el=document.getElementById('detectStatus');const pct=(best.score*100).toFixed(1);const color=classes.find(c=>c.name===best.className)?.color||'#7c3aed';
    if(detected){
        el.style.background=color+'14';el.style.borderBottom='2px solid '+color+'30';
        el.innerHTML='<div style="width:36px;height:36px;border-radius:50%;background:'+color+';display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">🎤</div><div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:800;color:'+color+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+best.className+'</div><div style="font-size:11px;color:#64748b;margin-top:1px">Heard — '+pct+'% confidence</div></div><div style="font-size:22px;font-weight:900;color:'+color+';flex-shrink:0">'+Math.round(best.score*100)+'%</div>';
    }else if(isNoiseCls&&isAbove){
        el.style.background='#fafafa';el.style.borderBottom='2px dashed #e2e8f0';
        el.innerHTML='<div style="width:36px;height:36px;border-radius:50%;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">🔇</div><div style="flex:1"><div style="font-size:14px;font-weight:700;color:#64748b">Background Noise</div><div style="font-size:11px;color:#94a3b8;margin-top:1px">No keyword — '+pct+'%</div></div>';
    }else{
        el.style.background='#fafafa';el.style.borderBottom='1px solid #f1f5f9';
        el.innerHTML='<div style="width:36px;height:36px;border-radius:50%;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">🔍</div><div style="flex:1"><div style="font-size:14px;font-weight:700;color:#94a3b8">Listening...</div><div style="font-size:11px;color:#cbd5e1;margin-top:1px">Best: '+best.className+' at '+pct+'% (need '+Math.round(THRESH*100)+'%)</div></div>';
    }
}

// ── Train ─────────────────────────────────────────────────────────────────
function setTrainState(html){document.getElementById('trainStateBox').innerHTML=html;}

async function trainModel(){
    if(!backbone||!embedExtractor){alert('Backbone not loaded yet.');return;}
    const missing=classes.filter(c=>(embeddings[c.name]||[]).length<3);
    if(missing.length>0){alert('Need at least 3 clips per class.\n\nMissing:\n'+missing.map(c=>'  "'+c.name+'": '+(embeddings[c.name]||[]).length+' clips').join('\n'));return;}
    document.getElementById('trainBtn').disabled=true;
    trained=false;headModel=null;classNamesCopy=[];updateButtons();
    const show=(pct,msg)=>{setTrainState('<div class="state-progress"><div class="progress-pct">'+pct+'%</div><div class="progress-bar"><div class="progress-fill" style="width:'+pct+'%"></div></div><div class="progress-label">'+msg+'</div></div>');setStatus(msg);};
    try{
        show(5,'Stacking embeddings...');await tf.nextFrame();

        // ── Collect raw embeddings ────────────────────────────────────────
        const rawXs=[],rawYs=[],nc=classes.length;let featSize=0;
        for(let ci=0;ci<classes.length;ci++){
            const embs=embeddings[classes[ci].name]||[];
            for(const emb of embs){rawXs.push(Array.from(emb));rawYs.push(ci);featSize=emb.length;}
        }
        if(rawXs.length===0)throw new Error('No embeddings found');

        // ── Gaussian noise augmentation ───────────────────────────────────
        // Embeddings are L2-normalised unit vectors (magnitude=1.0)
        // sigma=0.04 → 4% perturbation (meaningful but not destructive)
        // sigma=0.08 → 8% perturbation (larger variation, more robust)
        // Each original produces 2 copies → 3x total dataset size
        function randn(){
            let u=0,v=0;
            while(u===0)u=Math.random();
            while(v===0)v=Math.random();
            return Math.sqrt(-2.0*Math.log(u))*Math.cos(2*Math.PI*v);
        }
        const xs=[...rawXs],ys=[...rawYs];
        const baseLen=rawXs.length;
        for(let i=0;i<baseLen;i++){
            const base=rawXs[i],label=rawYs[i];
            xs.push(base.map(v=>v+randn()*0.04)); ys.push(label);
            xs.push(base.map(v=>v+randn()*0.08)); ys.push(label);
        }

        show(15,'Building MLP ('+xs.length+' samples, feat:'+featSize+')...');
        await tf.nextFrame();

        // ── MLP — fixed for small datasets ───────────────────────────────
        // Fixes vs previous broken version:
        // 1. NO L2 regulariser: inputs are L2-normalised; L2 reg collapses
        //    weights to zero → bias terms dominate → always predicts class 0
        // 2. Dropout 0.1 / 0.05: small dataset needs signal flow, not masking
        // 3. batchSize = ALL samples: full-batch gradient = stable convergence
        // 4. validationSplit = 0: use every sample for training
        // 5. EPOCHS = 300: more epochs compensate for stable full-batch GD
        const xsT=tf.tensor2d(xs);
        const ysT=tf.oneHot(tf.tensor1d(ys,'int32'),nc);
        headModel=tf.sequential({layers:[
            tf.layers.dense({inputShape:[featSize],units:256,activation:'relu'}),
            tf.layers.dropout({rate:0.1}),
            tf.layers.dense({units:128,activation:'relu'}),
            tf.layers.dropout({rate:0.05}),
            tf.layers.dense({units:nc,activation:'softmax'})
        ]});
        headModel.compile({
            optimizer:tf.train.adam(0.001),
            loss:'categoricalCrossentropy',
            metrics:['accuracy']
        });

        show(20,'Training '+xs.length+' samples, 300 epochs, full batch...');
        const EPOCHS=300;
        let bestAcc=0;
        await headModel.fit(xsT,ysT,{
            epochs:EPOCHS,
            batchSize:xs.length,
            validationSplit:0,
            shuffle:true,
            callbacks:{onEpochEnd:async(epoch,logs)=>{
                const pct=20+Math.round(((epoch+1)/EPOCHS)*78);
                const acc=logs?.acc!=null?(logs.acc*100).toFixed(0)+'%':'?';
                if((logs?.acc||0)>bestAcc)bestAcc=logs.acc||0;
                if(epoch%5===0||epoch===EPOCHS-1){
                    show(pct,'Epoch '+(epoch+1)+'/'+EPOCHS
                        +' acc:'+acc
                        +' best:'+(bestAcc*100).toFixed(0)+'%');
                    await tf.nextFrame();
                }
            }}
        });
        xsT.dispose();ysT.dispose();
        classNamesCopy=classes.map(c=>c.name);trained=true;
        const total=rawXs.length;
        setStatus('Trained on '+total+' clips ('+xs.length+' augmented) — '
            +EMBED_DIM+'-dim, '+computeNWindows(CLIP_MS)+'x windows. Start mic to test.');
        setTrainState('<div class="state-done"><div class="icon">✅</div>'
            +'<h3>Model Trained!</h3>'
            +'<p>'+total+' clips · '+classes.length+' classes</p>'
            +'<p style="font-size:11px;margin-top:4px;color:#7c3aed;font-weight:700">'
            +EMBED_DIM+'-dim · '+xs.length+' augmented · best acc: '+(bestAcc*100).toFixed(0)+'%</p>'
            +'<button class="retrain-btn" onclick="resetTrain()">Retrain</button></div>');
        initOutputBars();updateButtons();
    }catch(e){
        console.error('Train error:',e);
        alert('Training failed: '+e.message);
        setStatus('Training failed: '+e.message);
        setTrainState('<div class="state-ready"><div class="icon">🧠</div><h3>Ready to train.</h3><p>Fix error and try again.</p></div>');
    }finally{document.getElementById('trainBtn').disabled=false;}
}

function resetTrain(){trained=false;headModel=null;classNamesCopy=[];updateButtons();setTrainState('<div class="state-ready"><div class="icon">🧠</div><h3>Ready to train.</h3><p>Add at least 5 clips per class<br>then press Train.</p></div>');setStatus('');initOutputBars();}

// ── Live inference ────────────────────────────────────────────────────────
function restartInferTimer(){clearInterval(inferTimer);inferTimer=setInterval(runInference,INFER_MS);}

async function runInference(){
    if(!micActive||!headModel||!embedExtractor||!inferBuf)return;
    try{
        const clipSamples=Math.ceil(SR*(CLIP_MS/1000));const clip=new Float32Array(clipSamples);const bufLen=inferBuf.length;const endPos=inferBufPos;
        for(let i=0;i<clipSamples;i++){const pos=((endPos-clipSamples+i)%bufLen+bufLen)%bufLen;clip[i]=inferBuf[pos];}
        const emb=await embedClip(clip);const embT=tf.tensor2d([Array.from(emb)]);
        const predT=headModel.predict(embT);const probs=predT.dataSync();
        predT.dispose();embT.dispose();
        const predictions=classNamesCopy.map((name,i)=>({className:name,score:probs[i]}));
        updateOutputBars(predictions);
    }catch(e){console.warn('Inference error:',e.message);}
}

function drawWaveVis(){
    if(!micActive)return;visFrame=requestAnimationFrame(drawWaveVis);
    const canvas=document.getElementById('waveCanvas');if(!canvas||!inferAnalyser)return;
    const ctx=canvas.getContext('2d');const W=canvas.clientWidth||600,H=canvas.clientHeight||90;
    canvas.width=W;canvas.height=H;ctx.fillStyle='#0e1320';ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='#1e2a3d';ctx.lineWidth=1;for(let i=1;i<4;i++){ctx.beginPath();ctx.moveTo(0,H/4*i);ctx.lineTo(W,H/4*i);ctx.stroke();}
    const buf=new Uint8Array(inferAnalyser.frequencyBinCount);inferAnalyser.getByteTimeDomainData(buf);
    ctx.beginPath();ctx.strokeStyle='#7c3aed';ctx.lineWidth=1.5;
    for(let i=0;i<W;i++){const v=(buf[Math.floor(i*buf.length/W)]/128)-1;const y=H/2+v*(H/2-5);i===0?ctx.moveTo(i,y):ctx.lineTo(i,y);}
    ctx.stroke();
}

async function toggleMic(){
    if(micActive){stopInference();return;}
    if(!trained||!headModel){alert('Train first!');return;}
    try{
        inferStream=await navigator.mediaDevices.getUserMedia({audio:true});
        inferCtx=new AudioContext({sampleRate:SR});inferAnalyser=inferCtx.createAnalyser();inferAnalyser.fftSize=2048;
        const src=inferCtx.createMediaStreamSource(inferStream);src.connect(inferAnalyser);
        inferBuf=new Float32Array(SR*5);inferBufPos=0;
        inferProc=inferCtx.createScriptProcessor(4096,1,1);
        inferProc.onaudioprocess=e=>{const inp=e.inputBuffer.getChannelData(0);for(let i=0;i<inp.length;i++){inferBuf[inferBufPos%inferBuf.length]=inp[i];inferBufPos++;}};
        src.connect(inferProc);inferProc.connect(inferCtx.destination);
        document.getElementById('wavePlaceholder').style.display='none';
        micActive=true;document.getElementById('micBtn').textContent='Stop';
        drawWaveVis();restartInferTimer();setStatus('Listening — speak into the mic');
    }catch(e){alert('Mic error: '+e.message);}
}

function stopInference(){
    clearInterval(inferTimer);if(visFrame){cancelAnimationFrame(visFrame);visFrame=null;}
    if(inferProc){try{inferProc.disconnect();}catch{}}
    if(inferStream){inferStream.getTracks().forEach(t=>t.stop());inferStream=null;}
    if(inferCtx){inferCtx.close().catch(()=>{});inferCtx=null;}
    inferAnalyser=null;inferBuf=null;inferBufPos=0;inferProc=null;micActive=false;
    document.getElementById('wavePlaceholder').style.display='flex';
    const canvas=document.getElementById('waveCanvas');if(canvas){const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);}
    document.getElementById('micBtn').textContent='Start Mic';setStatus('Mic stopped.');
}

// ── Reset ─────────────────────────────────────────────────────────────────
function resetAll(){
    if(!confirm('Reset everything? Clears all clips and the model.'))return;
    stopMic();stopInference();
    trained=false;headModel=null;classNamesCopy=[];embeddings={};classAudio={};
    classes=[{id:1,name:'Word1',color:'#4ade80'},{id:2,name:'Word2',color:'#60a5fa'}];
    nextClassId=3;resetUsbPanel();updateButtons();
    setStatus('Reset complete. Start fresh!');
    setTrainState('<div class="state-ready"><div class="icon">🧠</div><h3>Ready to train.</h3><p>Add at least 5 clips per class<br>then press Train.</p></div>');
    render();
}

// ── Deploy to Blockly ─────────────────────────────────────────────────────
function deployToBlockly(){
    if(!trained){alert('Train first!');return;}
    const classNames=classes.map(c=>c.name);
    const payload=JSON.stringify({type:'VOICE_MODEL_TRAINED',classes:classNames,clipMs:CLIP_MS});
    // Also save for standalone browser reload
    try{sessionStorage.setItem('curio_voice_trained',JSON.stringify(classNames));}catch(e){}
    if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(payload);}
    else if(window.parent!==window){window.parent.postMessage(payload,'*');window.opener?.postMessage(payload,'*');}
    else{window.location.href='index.html';}
    setStatus('Voice blocks deployed! Words: "'+classNames.join('", "')+'"');
    ['deployHeaderBtn','deployCardBtn'].forEach(id=>{const btn=document.getElementById(id);if(!btn)return;const orig=btn.textContent;btn.textContent='Deployed!';btn.style.background='#4ade80';setTimeout(()=>{btn.textContent=orig;btn.style.background='';},2500);});
}

// ── Deploy to K230 ────────────────────────────────────────────────────────
async function deployToK230(){
    if(!trained||!headModel){alert('Train first!');return;}
    const method=document.getElementById('deployMethodInput').value;
    const btn=document.getElementById('deployK230Btn');const orig=btn.innerHTML;
    let usbPort=null;
    if(method==='usb'){
        if(!SERIAL_SUPPORTED){alert('WebSerial requires Chrome/Edge v89+.');return;}
        const baud=parseInt(document.getElementById('usbBaudSelect').value);
        try{usbPort=await navigator.serial.requestPort();await usbPort.open({baudRate:baud,bufferSize:32768});}
        catch(e){alert('Port error: '+e.message);try{usbPort&&await usbPort.close();}catch{}return;}
    }
    btn.disabled=true;btn.innerHTML='<span class="spinner"></span>...';setStatus('Compiling model...');
    try{
        let sa=null;
        await headModel.save(tf.io.withSaveHandler(async a=>{sa=a;return{modelArtifactsInfo:{dateSaved:new Date()}};}));
        if(!sa)throw new Error('Failed to save model');
        const mj={modelTopology:sa.modelTopology,weightsManifest:[{paths:['weights.bin'],weights:sa.weightSpecs}],format:'layers-model',generatedBy:'TensorFlow.js',convertedBy:null};
        const fd=new FormData();
        fd.append('model_json',new Blob([JSON.stringify(mj)],{type:'application/json'}),'model.json');
        fd.append('weights_bin',new Blob([sa.weightData],{type:'application/octet-stream'}),'weights.bin');
        fd.append('labels',JSON.stringify(classes.map(c=>c.name)));
        
        btn.innerHTML='<span class="spinner"></span>Converting...';
        setStatus('Deploying: sending model to backend for ONNX → .kmodel conversion (1–2 min)...');
        console.log('[DEPLOY-K230] Backend URL:', getBackendUrl());
        console.log('[DEPLOY-K230] Sending to:', getBackendUrl() + '/convert-voice');
        
        const resp = await postToBackend('convert-voice', fd);
        const zip = await JSZip.loadAsync(await resp.blob());
        const kf=zip.file('model.kmodel'),lf=zip.file('labels.txt');
        if(!kf||!lf)throw new Error('Invalid zip from server');
        const kBlob=await kf.async('blob'),lBlob=await lf.async('blob');
        if(method==='wifi'){
            const ip=document.getElementById('k230IpInput').value.trim()||'192.168.4.1';
            const pt=document.getElementById('k230PortInput').value.trim()||'8080';
            const url='http://'+ip+':'+pt+'/upload';setStatus('Pushing to K230 ('+ip+')...');
            const r1=await fetch(url,{method:'POST',headers:{'X-Filename':'voice_v2_model.kmodel'},body:kBlob});if(!r1.ok)throw new Error('HTTP '+r1.status);
            await sleep(1500);
            const r2=await fetch(url,{method:'POST',headers:{'X-Filename':'voice_v2_labels.txt'},body:lBlob});if(!r2.ok)throw new Error('HTTP '+r2.status);
            setStatus('Wi-Fi deployment complete!');alert('Deployed via Wi-Fi!\n\nFiles in /sdcard/kmodel/');
        }else if(method==='online'){
            const ip=document.getElementById('onlineIpInput').value.trim();
            const pt=document.getElementById('onlinePortInput').value.trim()||'8080';
            if(!ip){alert('Enter the K230 board IP (use Auto-Detect or Ping to find it).');setStatus('Deploy failed: no IP.');return;}
            const url='http://'+ip+':'+pt+'/upload';setStatus('Pushing to K230 via Online Wi-Fi ('+ip+')...');
            try{
                const r1=await fetch(url,{method:'POST',headers:{'X-Filename':'voice_v2_model.kmodel'},body:kBlob});if(!r1.ok)throw new Error('HTTP '+r1.status);
                await sleep(1500);
                const r2=await fetch(url,{method:'POST',headers:{'X-Filename':'voice_v2_labels.txt'},body:lBlob});if(!r2.ok)throw new Error('HTTP '+r2.status);
            }catch(pushErr){
                alert('❌ Failed to connect to K230 at '+ip+':'+pt+'.\nEnsure K230 is on the same Wi-Fi network (STA mode).\nError: '+pushErr.message);
                setStatus('Deploy failed: K230 unreachable.');return;
            }
            setStatus('Online Wi-Fi deployment complete!');alert('Deployed via Online Wi-Fi ('+ip+')!\n\nFiles in /sdcard/kmodel/');
        }else{
            const baud=parseInt(document.getElementById('usbBaudSelect').value);
            resetUsbPanel();showUsbPanel(true);
            port=usbPort;portReader=usbPort.readable.getReader();portWriter=usbPort.writable.getWriter();connected=true;usbPort=null;
            rxPump();usbLog('Port @ '+baud+' baud','ok');
            try{
                await enterRawREPL();
                const kArr=new Uint8Array(await kBlob.arrayBuffer());const lArr=new Uint8Array(await lBlob.arrayBuffer());
                await ensureDir('/sdcard/kmodel/');usbLog('Dir ready','ok');
                await writeFileOnBoard('/sdcard/kmodel/voice_v2_model.kmodel',kArr,p=>{usbSetPct(1,p);setStatus('model: '+Math.round(p*100)+'%');});
                usbSetPct(1,1);usbLog('model OK','ok');
                await writeFileOnBoard('/sdcard/kmodel/voice_v2_labels.txt',lArr,p=>{usbSetPct(2,p);});
                usbSetPct(2,1);usbLog('labels OK','ok');await exitRawREPL();usbLog('Done','ok');
            }finally{await cleanupPort();}
            setStatus('USB deployment complete!');alert('Deployed via USB!\nFiles in /sdcard/kmodel/');
        }
    }catch(e){
        console.error(e);usbLog('Error: '+e.message,'err');alert('Deploy Failed: '+e.message);setStatus('Deploy failed: '+e.message);
        if(connected)await cleanupPort();if(usbPort){try{await usbPort.close();}catch{}usbPort=null;}
    }finally{btn.disabled=false;btn.innerHTML=orig;}
}

// ── Full voice model export helper ─────────────────────────────────────
function buildFullVoiceModel(){
    if(!backbone||!embedExtractor||!headModel){
        throw new Error('Voice backbone, embed extractor, and trained head model are required');
    }
    const embeddingOutput = Array.isArray(embedExtractor.outputs)
        ? embedExtractor.outputs[0]
        : embedExtractor.outputs;
    const fullOutput = headModel.apply(embeddingOutput);
    return tf.model({inputs: backbone.inputs, outputs: fullOutput});
}

// ── Export ────────────────────────────────────────────────────────────────
async function exportKmodel(){
    if(!trained||!headModel){alert('Train first!');return;}
    const btn=document.getElementById('exportBtn');btn.disabled=true;btn.innerHTML='<span class="spinner"></span>Building...';setStatus('Exporting: building full model...');
    try{
        const fullModel = buildFullVoiceModel();
        let sa=null;
        await fullModel.save(tf.io.withSaveHandler(async a=>{sa=a;return{modelArtifactsInfo:{dateSaved:new Date()}};}));
        // Note: Do not dispose fullModel since its layers are shared with headModel/backbone

        const mj={modelTopology:sa.modelTopology,weightsManifest:[{paths:['weights.bin'],weights:sa.weightSpecs}],format:'layers-model',generatedBy:'TensorFlow.js',convertedBy:null};
        const fd=new FormData();
        fd.append('model_json',new Blob([JSON.stringify(mj)],{type:'application/json'}),'model.json');
        fd.append('weights_bin',new Blob([sa.weightData],{type:'application/octet-stream'}),'weights.bin');
        fd.append('labels',JSON.stringify(classes.map(c=>c.name)));

        btn.innerHTML='<span class="spinner"></span>Converting...';
        setStatus('Exporting: sending to backend for ONNX → kmodel conversion (this may take 1–2 min)...');
        console.log('[EXPORT] Sending to backend:', getBackendUrl() + '/convert-voice');
        
        const resp = await postToBackend('convert-voice', fd);
        const zipBlob = await resp.blob();
        const ct = resp.headers.get('content-type')||'';
        
        console.log('[EXPORT] Backend response received. Content-Type:', ct);
        
        if(ct.includes('application/json')){
            const errJson = await JSON.parse(await zipBlob.text()).catch(()=>null);
            throw new Error(errJson?.error || 'Backend returned error');
        }

        if(ct.includes('zip')){
            console.log('[EXPORT] Unpacking zip from backend...');
            const zip = await JSZip.loadAsync(zipBlob);
            const kf = zip.file('model.kmodel');
            const lf = zip.file('labels.txt');
            if(!kf || !lf) throw new Error('Backend zip missing kmodel or labels');
            
            btn.innerHTML='<span class="spinner"></span>Downloading...';
            setStatus('Exporting: downloading model.kmodel (converted at backend)...');
            if(kf) downloadBlob(await kf.async('blob'),'voice_v2_model.kmodel');
            await sleep(400);
            if(lf) downloadBlob(await lf.async('blob'),'voice_v2_labels.txt');
        } else {
            throw new Error('Backend did not return ZIP: ' + ct);
        }

        setStatus('✅ Export complete: voice_v2_model.kmodel + voice_v2_labels.txt downloaded');
        alert('✅ Files downloaded (converted by backend).\n\nCopy to /sdcard/kmodel/ on K230.');
    }catch(e){
        console.error('[EXPORT] Error:', e.message);
        alert('❌ Export failed:\n\n' + e.message + '\n\nMake sure backend is running at:\n' + getBackendUrl());
        setStatus('Export failed: ' + e.message);
    }
    finally{btn.disabled=false;btn.innerHTML='Export .kmodel (Local)';}
}

function _buildVoiceMicroCnn(nc) {
    const m = tf.sequential();
    m.add(tf.layers.conv2d({ inputShape: [43, 232, 1], filters: 8, kernelSize: [5, 5], strides: [2, 2], padding: 'same', activation: 'relu' }));
    m.add(tf.layers.maxPooling2d({ poolSize: [2, 2] }));
    m.add(tf.layers.conv2d({ filters: 12, kernelSize: [3, 3], strides: [2, 2], padding: 'same', activation: 'relu' }));
    m.add(tf.layers.maxPooling2d({ poolSize: [2, 2] }));
    m.add(tf.layers.flatten());
    m.add(tf.layers.dense({ units: 24, activation: 'relu' }));
    m.add(tf.layers.dense({ units: nc, activation: 'softmax' }));
    return m;
}

async function exportVoiceTflite() {
    await exportVoiceTfliteCore(false);
}

async function deployVoiceToEsp32() {
    await exportVoiceTfliteCore(true);
}

async function exportVoiceTfliteCore(isSerialUpload) {
    if (classes.length < 2) { alert('Need at least 2 classes!'); return; }
    const emptyClass = classes.filter(c => (classAudio[c.name] || []).length < 3);
    if (emptyClass.length > 0) { alert(`"${emptyClass[0].name}" needs at least 3 clips.`); return; }

    const btn = document.getElementById(isSerialUpload ? 'deployEsp32Btn' : 'exportEsp32Btn');
    btn.disabled = true;

    if (CLIP_MS !== 1000) {
        alert('Voice model export requires exactly 1.0 second clip length. Please set Clip Length to 1.0s, re-record/upload your clips, train, and then export.');
        btn.disabled = false;
        btn.innerHTML = isSerialUpload ? '🔌 Deploy to ESP32 (WebSerial)' : 'Export .tflite (ESP32-S3)';
        return;
    }

    let _serialReady = false;
    btn.innerHTML = '<span class="spinner"></span>Preparing spectrograms...';

    try {
        const nc = classes.length;
        const labels = classes.map(c => c.name);

        function encodeWAV(samples, sampleRate) {
            const buffer = new ArrayBuffer(44 + samples.length * 2);
            const view = new DataView(buffer);
            function writeString(view, offset, string) {
                for (let i = 0; i < string.length; i++) {
                    view.setUint8(offset + i, string.charCodeAt(i));
                }
            }
            writeString(view, 0, 'RIFF');
            view.setUint32(4, 36 + samples.length * 2, true);
            writeString(view, 8, 'WAVE');
            writeString(view, 12, 'fmt ');
            view.setUint32(16, 16, true);
            view.setUint16(20, 1, true);
            view.setUint16(22, 1, true);
            view.setUint32(24, sampleRate, true);
            view.setUint32(28, sampleRate * 2, true);
            view.setUint16(32, 2, true);
            view.setUint16(34, 16, true);
            writeString(view, 36, 'data');
            view.setUint32(40, samples.length * 2, true);
            let offset = 44;
            for (let i = 0; i < samples.length; i++, offset += 2) {
                let s = Math.max(-1, Math.min(1, samples[i]));
                view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            }
            return new Blob([view], { type: 'audio/wav' });
        }

        const zip = new JSZip();
        for (const cls of classes) {
            const classFolder = zip.folder(cls.name);
            const clips = classAudio[cls.name] || [];
            for (let i = 0; i < clips.length; i++) {
                const wavBlob = encodeWAV(clips[i], 16000);
                classFolder.file(`clip_${i}.wav`, wavBlob);
            }
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' });

        const formData = new FormData();
        formData.append('dataset_zip', zipBlob, 'dataset.zip');
        formData.append('labels', JSON.stringify(labels));
        formData.append('epochs', "60");

        btn.innerHTML = '<span class="spinner"></span>Training on Server (~1-2m)...';
        setStatus('Backend: training server-side model and exporting INT8 TFLite (~1-2 min)...');

        const resp = await postToBackend('convert-tiny', formData);

        // ── Step 5: unpack .tflite from backend response ─────────────────
        btn.innerHTML = '<span class="spinner"></span>Generating files...';
        const respBlob = await resp.blob();
        
        if (!isSerialUpload) {
            // User requested to download the ZIP file directly
            downloadBlob(respBlob, 'tiny_voice_esp32_model.zip');
            setStatus(`✅ Export complete: tiny_voice_esp32_model.zip downloaded.`);
            alert(`✅ ZIP file downloaded successfully.`);
            return;
        }

        let tfliteBytes = null;
        const ct = resp.headers.get('content-type') || '';
        if (ct.includes('zip') || respBlob.type.includes('zip')) {
            const rz = await JSZip.loadAsync(respBlob);
            let tf_ = rz.file('model.tflite') || rz.file('tiny_voice_esp32_model/soundclassifier_int8.tflite') || rz.file('tiny_voice_esp32_model/model.tflite');
            if (!tf_) {
                const files = Object.keys(rz.files);
                const match = files.find(f => f.endsWith('model.tflite') || f.endsWith('.tflite'));
                if (match) tf_ = rz.file(match);
            }
            if (!tf_) throw new Error('model.tflite not found in backend response');
            tfliteBytes = await tf_.async('uint8array');
        } else {
            tfliteBytes = new Uint8Array(await respBlob.arrayBuffer());
        }

        const sizeKb = (tfliteBytes.length / 1024).toFixed(1);


        // ── Auto-upload via WebSerial if port was pre-connected ──────
        _dfr1154.labelsText = labels.map((l, i) => i + ' ' + l).join('\n') + '\n';

        if (isSerialUpload) {
            const modal = document.getElementById('rstModal');
            const modalBtn = document.getElementById('rstModalBtn');
            const cancelBtn = document.getElementById('rstCancelBtn');
            
            // Customize modal paragraph for Voice
            const pText = modal.querySelector('p');
            if (pText) {
                pText.innerHTML = `Your ${sizeKb} KB voice model is trained and ready! To prevent the board from starting its old model and locking the connection, please follow these steps:
                <br><br>
                1. <strong>Press and release</strong> the physical <strong>RST (Reset)</strong> button on your board now.
                <br>
                2. Click <strong>Connect & Upload</strong> below immediately!`;
            }

            modal.style.display = 'flex';

            await new Promise((resolve, reject) => {
                modalBtn.onclick = async () => {
                    try {
                        btn.innerHTML = '<span class="spinner"></span>Connecting to port…';
                        try { _dfr1154.reader?.cancel(); }      catch (_) {}
                        try { _dfr1154.writer?.releaseLock(); } catch (_) {}
                        try { _dfr1154.reader?.releaseLock(); } catch (_) {}
                        try { await _dfr1154.port?.close(); }   catch (_) {}
                        _dfr1154.rxBuf  = '';
                        _dfr1154.port   = await navigator.serial.requestPort();
                        await _dfr1154.port.open({ baudRate: 115200, bufferSize: 8192 });
                        try { await _dfr1154.port.setSignals({ dataTerminalReady: false, requestToSend: false }); } catch (_) {}
                        _dfr1154.reader = _dfr1154.port.readable.getReader();
                        _dfr1154.writer = _dfr1154.port.writable.getWriter();
                        _serialReady    = true;
                        document.getElementById('serialPanel').classList.add('active');
                        dfr1154SetStatus('Serial connected — uploading…', true);
                        dfr1154Log('Port opened. Uploading model...');
                        modal.style.display = 'none';
                        resolve();
                    } catch (e) {
                        modal.style.display = 'none';
                        reject(e);
                    }
                };
                cancelBtn.onclick = () => {
                    modal.style.display = 'none';
                    reject(new Error('Upload cancelled by user.'));
                };
            });
        }

        if (_serialReady) {
            btn.innerHTML = '<span class="spinner"></span>Waiting for DFR1154 firmware…';
            dfr1154SetStatus('Handshaking with DFR1154 firmware…', true);
            dfr1154Log('Starting DFR1154 upload protocol…');
            await dfr1154WaitReady();

            btn.innerHTML = '<span class="spinner"></span>Uploading labels…';
            const labelBytes = new TextEncoder().encode(_dfr1154.labelsText);
            dfr1154Log('→ LABELS ' + labelBytes.length);
            await dfr1154Write('LABELS ' + labelBytes.length + '\n');
            await _dfr1154.writer.write(labelBytes);
            await dfr1154Expect(l => l.includes('SERIAL OK LABELS') || l.includes('Serial labels uploaded'), 10000);
            dfr1154Log('Labels sent ✓');

            await dfr1154SendCommand('MODEL_BEGIN ' + tfliteBytes.length, 'MODEL_BEGIN', 15000);
            const chunkSize = 2048;
            for (let offset = 0; offset < tfliteBytes.length; offset += chunkSize) {
                const chunk = tfliteBytes.slice(offset, Math.min(offset + chunkSize, tfliteBytes.length));
                const pct   = Math.round(((offset + chunk.length) / tfliteBytes.length) * 100);
                btn.innerHTML = `<span class="spinner"></span>Uploading to DFR1154… ${pct}%`;
                dfr1154Log('→ MODEL_CHUNK ' + offset + ' ' + chunk.length);
                await dfr1154Write('MODEL_CHUNK ' + offset + ' ' + chunk.length + '\n');
                await _dfr1154.writer.write(chunk);
                await dfr1154Expect(l => l.includes('SERIAL OK MODEL_CHUNK'), 15000);
            }
            await dfr1154SendCommand('MODEL_END ' + tfliteBytes.length, 'MODEL_END', 15000);
            await dfr1154SendCommand('LOAD', 'LOAD', 10000);

            const kb = (tfliteBytes.length / 1024).toFixed(1);
            dfr1154Log(`✅ Model loaded (${kb} KB)! Inference running on DFR1154.`);
            dfr1154SetStatus(`✅ Loaded ${kb} KB — inference running on board.`, true);
            setStatus(`DFR1154 model loaded (${kb} KB).`);
        } else {
            if (isSerialUpload) {
                alert(
                    `🔌 WebSerial connection was not established or was cancelled.\n\n` +
                    `No files were sent to the board and no TFLite files were downloaded.\n\n` +
                    `If you want to manually download the TFLite model, click the "Export .tflite (ESP32-S3)" button instead.`
                );
            }
        }

    } catch (e) {
        console.error('ESP32 deployment error:', e);
        if (isSerialUpload) {
            if (e.message.includes('Inference already started') || e.message.includes('reset board')) {
                alert(
                    `⚠️ ESP32 Upload Locked!\n\n` +
                    `The board has already started running its previous model, which locks the upload channel.\n\n` +
                    `👉 How to solve this:\n` +
                    `1. Press the physical "RST" (Reset) button on your DFR1154 board.\n` +
                    `2. Immediately click the yellow "Deploy to ESP32 (WebSerial)" button in your browser within 5 seconds!\n\n` +
                    `This will catch the board during its initial startup handshake before it starts running the old model.`
                );
            } else {
                alert('🔌 ESP32 Serial Upload Failed:\n\n' + e.message + '\n\nTip: Close other applications (like Arduino IDE Serial Monitor) that might be using the COM port, reset the board, and try again.');
            }
            setStatus('ESP32 WebSerial upload failed: ' + e.message);
        } else {
            alert('TFLite Export Failed: ' + e.message);
            setStatus('TFLite export failed: ' + e.message);
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = isSerialUpload ? '🔌 Deploy to ESP32 (WebSerial)' : 'Export .tflite (ESP32-S3)';
    }
}

// ══════════════════════════════════════════════════════════════
// DFR1154 WebSerial Upload
// Protocol: PING → LABELS → MODEL_BEGIN → MODEL_CHUNKs → MODEL_END → LOAD
// ══════════════════════════════════════════════════════════════

const _dfr1154 = {
    bytes: null,       // Uint8Array — last exported TFLite model
    labelsText: '',    // "0 Class1\n1 Class2\n"
    port: null,
    reader: null,
    writer: null,
    rxBuf: '',
};

function dfr1154SetStatus(msg, connected) {
    const dot = document.getElementById('serialDot');
    const st  = document.getElementById('serialStatusMsg');
    if (dot) dot.className = 'serial-dot' + (connected ? ' connected' : '');
    if (st)  st.textContent = msg;
}

function dfr1154Log(s) {
    const box = document.getElementById('serialLog');
    if (!box) return;
    box.classList.add('active');
    box.textContent = '[' + new Date().toLocaleTimeString() + '] ' + s + '\n' + box.textContent;
}

async function dfr1154ReadLine(timeoutMs = 10000) {
    const deadline = Date.now() + timeoutMs;
    const dec = new TextDecoder();
    while (true) {
        const nl = _dfr1154.rxBuf.indexOf('\n');
        if (nl >= 0) {
            const line = _dfr1154.rxBuf.slice(0, nl).replace(/\r/g, '');
            _dfr1154.rxBuf = _dfr1154.rxBuf.slice(nl + 1);
            if (line) dfr1154Log('← ' + line);
            return line;
        }
        const remaining = deadline - Date.now();
        if (remaining <= 0) throw new Error('Serial timeout');
        const result = await Promise.race([
            _dfr1154.reader.read(),
            new Promise(r => setTimeout(() => r({ timeout: true }), remaining))
        ]);
        if (result.timeout)     throw new Error('Serial timeout');
        if (result.done)        throw new Error('Serial disconnected');
        _dfr1154.rxBuf += dec.decode(result.value, { stream: true });
    }
}

async function dfr1154Expect(matchFn, timeoutMs = 10000) {
    while (true) {
        const line = await dfr1154ReadLine(timeoutMs);
        if (line.startsWith('SERIAL ERR')) throw new Error(line);
        if (matchFn(line)) return line;
    }
}

async function dfr1154Write(text) {
    await _dfr1154.writer.write(new TextEncoder().encode(text));
}

async function dfr1154SendCommand(cmd, okToken, timeoutMs = 10000) {
    dfr1154Log('→ ' + cmd);
    await dfr1154Write(cmd + '\n');
    return dfr1154Expect(l => l.includes('SERIAL OK ' + okToken), timeoutMs);
}

async function dfr1154WaitReady() {
    const deadline = Date.now() + 12000;
    while (Date.now() < deadline) {
        await dfr1154Write('PING\n');
        try {
            const line = await dfr1154Expect(
                l => l.includes('SERIAL OK PONG') || l.includes('SERIAL READY'),
                1200
            );
            if (line.includes('SERIAL READY')) {
                await dfr1154SendCommand('PING', 'PONG', 3000);
            }
            return;
        } catch (e) {
            if (!e.message.includes('timeout')) throw e;
            await new Promise(r => setTimeout(r, 500));
        }
    }
    throw new Error('No firmware response. Flash DFR1154 firmware, reset board, then retry.');
}

// ── Go Back ───────────────────────────────────────────────────────────────
function goBack(){
    stopMic();stopInference();
    const payload=JSON.stringify({type:'CLOSE_VOICE_TRAIN_V2'});
    if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(payload);}
    else if(window.parent!==window){window.parent.postMessage(payload,'*');window.opener?.postMessage(payload,'*');}
    else{
        let board='k230';
        try{board=localStorage.getItem('blockly_active_train_board')||'k230';}catch(e){}
        window.location.href = board==='s3' ? 's3_picker.html' : 'train_picker.html';
    }
}

// ── Init ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
    if (tf.wasm && tf.wasm.setWasmPaths) {
        tf.wasm.setWasmPaths('./offline_libs/js/');
    }
    (async () => {
        try {
            await tf.setBackend('webgl');
            console.log('WebGL backend initialized');
        } catch (_) {
            try {
                await tf.setBackend('wasm');
                console.log('WASM backend initialized');
            } catch (err) {
                console.warn('WebGL/WASM backends failed to load, falling back to CPU:', err);
            }
        }
    })();
    classes.forEach(c=>{embeddings[c.name]=[];classAudio[c.name]=[];});
    setClipLen(1500);
    render();
    loadBackbone();
});
