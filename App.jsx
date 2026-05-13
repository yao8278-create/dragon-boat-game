import React, { useRef, useEffect, useState, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

// 🌟 初始化雲端環境 (支援 Canvas 預覽與 Vercel 部署雙棲模式)
let app, auth, db;
let appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
try {
    if (typeof __firebase_config !== 'undefined' && __firebase_config) {
        const firebaseConfig = JSON.parse(__firebase_config);
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
    }
} catch (error) {
    console.warn("Cloud config not found, falling back to local storage.");
}

// ==========================================
// 🎵 Web Audio API 即時合成音效引擎 (音量優化版)
// ==========================================
class SynthEngine {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.mode = 'menu'; 
        this.nextNoteTime = 0;
        this.step = 0;
        this.isMuted = true;
        this.timerID = null;
    }

    init() {
        if (this.ctx) return;
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.1; 
        this.master.connect(this.ctx.destination);
        this.nextNoteTime = this.ctx.currentTime + 0.1;
        this.scheduler();
    }

    toggleMute() {
        if (!this.ctx) this.init();
        this.isMuted = !this.isMuted;
        if (!this.isMuted && this.ctx.state === 'suspended') this.ctx.resume();
        this.master.gain.value = this.isMuted ? 0 : 0.1;
        return this.isMuted;
    }

    setMode(mode) { this.mode = mode; }

    playTone(freq, type, duration, vol = 1) {
        if (this.isMuted || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type; osc.frequency.value = freq;
        osc.connect(gain); gain.connect(this.master);
        osc.start(this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.stop(this.ctx.currentTime + duration);
    }

    playDrum(time, isHeavy = false) {
        if (this.isMuted || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain); gain.connect(this.master);
        osc.frequency.setValueAtTime(isHeavy ? 120 : 180, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.3);
        gain.gain.setValueAtTime(isHeavy ? 1.5 : 0.6, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);
        osc.start(time); osc.stop(time + 0.3);
    }

    playGuzheng(freq, time) {
        if (this.isMuted || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle'; 
        osc.frequency.value = freq;
        osc.connect(gain); gain.connect(this.master);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.6, time + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 1.5);
        osc.start(time); osc.stop(time + 1.5);
    }

    playWoodblock(time) {
        if (this.isMuted || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine'; 
        osc.frequency.setValueAtTime(900, time);
        osc.frequency.exponentialRampToValueAtTime(300, time + 0.05); 
        osc.connect(gain); gain.connect(this.master);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.5, time + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
        osc.start(time); osc.stop(time + 0.1);
    }

    sfxCoin() {
        this.playTone(987.77, 'square', 0.1, 0.3); 
        setTimeout(() => this.playTone(1318.51, 'square', 0.2, 0.3), 80); 
    }
    sfxLetter(progress) {
        const baseFreq = 440 + (progress * 200); 
        this.playTone(baseFreq, 'sine', 0.1, 0.6);
        setTimeout(() => this.playTone(baseFreq * 1.25, 'sine', 0.2, 0.6), 100);
    }
    sfxHit() {
        this.playDrum(this.ctx ? this.ctx.currentTime : 0, true);
        this.playTone(50, 'sawtooth', 0.4, 0.8);
    }
    
    sfxRoar() {
        if (this.isMuted || !this.ctx) return;
        const dur = 3.5; 
        const t = this.ctx.currentTime;
        const shimmer = this.ctx.createOscillator();
        shimmer.type = 'sine';
        shimmer.frequency.setValueAtTime(440, t);
        shimmer.frequency.exponentialRampToValueAtTime(880, t + dur); 
        const shimmerGain = this.ctx.createGain();
        shimmerGain.gain.setValueAtTime(0, t);
        shimmerGain.gain.linearRampToValueAtTime(0.2, t + 0.8); 
        shimmerGain.gain.exponentialRampToValueAtTime(0.01, t + dur);
        shimmer.connect(shimmerGain); shimmerGain.connect(this.master);
        shimmer.start(t); shimmer.stop(t + dur);

        const baseFreq = 261.63;
        const intervals = [1, 1.25, 1.5, 2]; 
        intervals.forEach((interval, index) => {
            const f = baseFreq * interval;
            const osc = this.ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(f, t);
            osc.frequency.exponentialRampToValueAtTime(f * 2.2, t + 0.6); 
            osc.frequency.exponentialRampToValueAtTime(f * 2.5, t + dur); 
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass'; filter.Q.value = 10;
            filter.frequency.setValueAtTime(400, t);
            filter.frequency.exponentialRampToValueAtTime(4000, t + 0.5);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.25, t + 0.4);
            gain.gain.exponentialRampToValueAtTime(0.01, t + dur);
            osc.connect(filter); filter.connect(gain); gain.connect(this.master);
            osc.start(t); osc.stop(t + dur);
        });
        const bufferSize = this.ctx.sampleRate * 2.0;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'highpass'; noiseFilter.frequency.setValueAtTime(1000, t);
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0, t);
        noiseGain.gain.linearRampToValueAtTime(0.15, t + 0.5);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 2.0);
        noise.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(this.master);
        noise.start(t);
    }

    scheduler() {
        if (!this.ctx) return;
        while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
            this.playStep(this.nextNoteTime);
            const tempo = this.mode === 'fever' ? 180 : (this.mode === 'game' ? 140 : 160);
            const secondsPerBeat = 60.0 / tempo;
            this.nextNoteTime += secondsPerBeat / 2; 
            this.step = (this.step + 1) % 32; 
        }
        this.timerID = setTimeout(() => this.scheduler(), 25);
    }

    playStep(time) {
        if (this.isMuted || this.mode === 'stopped') return;
        if (this.mode === 'menu' || this.mode === 'shop') {
            const DO = 523.25, RE = 587.33, MI = 659.25, SOL = 783.99, LA = 880.00;
            const menuMelody = [MI, 0, MI, SOL, MI, 0, RE, 0, DO, 0, DO, RE, MI, 0, 0, 0, SOL, 0, SOL, LA, SOL, 0, MI, 0, RE, 0, MI, RE, DO, 0, 0, 0];
            const note = menuMelody[this.step];
            if (note !== 0) this.playGuzheng(note, time); 
            if (this.step % 4 === 0) this.playWoodblock(time);
            if (this.step % 8 === 0) this.playDrum(time, true); 
            else if (this.step % 8 === 4) this.playDrum(time, false); 
        } else if (this.mode === 'game') {
            if (this.step % 8 === 0 || this.step % 8 === 3) this.playDrum(time, this.step % 8 === 0);
            if (this.step % 8 === 4) this.playWoodblock(time); 
        } else if (this.mode === 'fever') {
            if (this.step % 4 === 0 || this.step % 4 === 2) this.playDrum(time, true);
            const arp = [523.25, 659.25, 783.99, 1046.50]; 
            const freq = arp[this.step % 4];
            this.playGuzheng(freq, time); 
        }
    }
}
const audio = new SynthEngine();

// --- 🌟 語音合成引擎 ---
const speakWord = (word) => {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); 
        const textToSpeak = word.toLowerCase();
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = 'en-US'; utterance.rate = 0.65; utterance.pitch = 1.0; 
        const voices = window.speechSynthesis.getVoices();
        const deepVoice = voices.find(v => (v.name.includes('Male') || v.name.includes('David') || v.name.includes('UK')) && !v.name.includes('Female'));
        if (deepVoice) utterance.voice = deepVoice;
        window.speechSynthesis.speak(utterance);
    }
};

// --- 關卡與詞庫設定 ---
const STAGE_CONFIG = {
    1: { name: "寧靜水鄉", desc: "新手村：靜止障礙", water: '#bae0ff', bank: '#95de64', line: '#91caff', speed: 4.0, obsRate: 90 },
    2: { name: "午後激流", desc: "進階：躍魚與漩渦", water: '#ffd8bf', bank: '#ffa940', line: '#ff9c6e', speed: 4.5, obsRate: 70 },
    3: { name: "奇幻夜航", desc: "極限：黑夜與幽靈船", water: '#002766', bank: '#001529', line: '#096dd9', speed: 5.0, obsRate: 50 }
};

const WORD_LIST = [
  { fullWord: 'ZONGZI', fullMeaning: '粽子', stages: [{ word: 'ZONGZI', meaning: '粽子' }] },
  { fullWord: 'DRAGON BOAT', fullMeaning: '龍舟', stages: [{ word: 'DRAGON', meaning: '龍' }, { word: 'BOAT', meaning: '船' }] },
  { fullWord: 'SACHET', fullMeaning: '香包', stages: [{ word: 'SACHET', meaning: '香包' }] },
  { fullWord: 'RICE DUMPLING', fullMeaning: '粽子', stages: [{ word: 'RICE', meaning: '米' }, { word: 'DUMPLING', meaning: '糰子' }] },
  { fullWord: 'DRUM', fullMeaning: '鼓', stages: [{ word: 'DRUM', meaning: '鼓' }] },
  { fullWord: 'RIVER', fullMeaning: '河流', stages: [{ word: 'RIVER', meaning: '河流' }] },
  { fullWord: 'STICKY RICE', fullMeaning: '糯米', stages: [{ word: 'STICKY', meaning: '黏的' }, { word: 'RICE', meaning: '米' }] },
  { fullWord: 'RACE', fullMeaning: '競賽', stages: [{ word: 'RACE', meaning: '競賽' }] },
  { fullWord: 'CULTURE', fullMeaning: '文化', stages: [{ word: 'CULTURE', meaning: '文化' }] },
  { fullWord: 'HERB', fullMeaning: '艾草', stages: [{ word: 'HERB', meaning: '艾草' }] },
  { fullWord: 'PADDLE', fullMeaning: '船槳', stages: [{ word: 'PADDLE', meaning: '船槳' }] },
  { fullWord: 'BAMBOO', fullMeaning: '竹子', stages: [{ word: 'BAMBOO', meaning: '竹子' }] }
];

const UPGRADE_COSTS = [0, 100, 300, 600, 1000, 1500];
const MAX_LEVEL = 5;

// ==========================================
// 🎨 AI 圖像生成服務
// ==========================================
const apiKey = "AIzaSyDBGDINEB6yrmO9kn33rFfvCvwv6ToYkjc"; 
const generateAndProcessImage = async (promptText) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`;
    const payload = { instances: [{ prompt: promptText }], parameters: { sampleCount: 1 } };
    const fetchWithBackoff = async (retries = 5, delays = [1000, 2000, 4000, 8000, 16000]) => {
        try {
            const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const data = await res.json();
            if (!data.predictions || !data.predictions[0]) throw new Error("No prediction");
            return `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}`;
        } catch (err) {
            if (retries === 0) throw err;
            await new Promise(r => setTimeout(r, delays[5 - retries]));
            return fetchWithBackoff(retries - 1, delays);
        }
    };
    const b64 = await fetchWithBackoff();
    return new Promise((resolve, reject) => {
        const img = new Image(); img.crossOrigin = "Anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas'); const MAX_SIZE = 256; let w = img.width, h = img.height;
            if (w > MAX_SIZE || h > MAX_SIZE) { if (w > h) { h = Math.round(h * MAX_SIZE / w); w = MAX_SIZE; } else { w = Math.round(w * MAX_SIZE / h); h = MAX_SIZE; } }
            canvas.width = w; canvas.height = h; const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(img, 0, 0, w, h); const imageData = ctx.getImageData(0, 0, w, h); const data = imageData.data; const bgR = data[0], bgG = data[1], bgB = data[2];
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i+1], b = data[i+2]; const dist = Math.sqrt(Math.pow(r-bgR,2) + Math.pow(g-bgG,2) + Math.pow(b-bgB,2));
                if (dist < 40) data[i+3] = 0; else if (dist < 60) data[i+3] = 128; 
            }
            ctx.putImageData(imageData, 0, 0); const finalImg = new Image(); finalImg.onload = () => resolve(finalImg); finalImg.src = canvas.toDataURL('image/png');
        };
        img.onerror = reject; img.src = b64;
    });
};

const PROMPTS = {
    boat1_side: "A primitive simple small wooden log raft canoe, side profile view pointing right, 2d game sprite, flat graphic, isolated on white background",
    boat2_side: "A classic traditional red wooden Chinese dragon boat, side profile view pointing right, 2d game sprite, flat graphic, isolated on white background",
    boat3_side: "A heavy industrial steampunk ironclad dragon boat, hull covered in thick dark steel armor plates and bronze spikes. Featuring a glowing coal furnace in the center. The front is a menacing cast-iron dragon head. Side profile view pointing right, 2d game sprite, flat graphic, isolated on white background",
    boat4_side: "A MASSIVE, extremely complex, multi-deck luxurious royal jade and pure gold emperor dragon boat featuring a highly prominent, majestic golden dragon head at the front, side profile view pointing right, 2d game sprite, flat graphic, isolated on white background",
    boat5_side: "A COLOSSAL, EXTREMELY THICK and BULKY cyberpunk mechanical DREADNOUGHT dragon boat. Towering multi-layered heavy armor superstructure like a floating fortress. The front is a massive, menacing high-tech robotic mecha-dragon head. NO PADDLES, it floats using massive glowing blue plasma hover-engines underneath. Thick purple warp nacelles at the heavy rear. Pure white and silver heavy armor plating with glowing cyan neon lines. Side profile view pointing right, 2d game sprite, flat graphic, isolated on white background",
    boat1_top: "A primitive simple small wooden log raft canoe, top-down view pointing upwards, vertically aligned, 2d game sprite, isolated on white background",
    boat2_top: "A classic traditional red wooden Chinese dragon boat, top-down view pointing upwards, vertically aligned, 2d game sprite, isolated on white background",
    boat3_top: "A heavy industrial steampunk ironclad dragon boat, hull covered in thick dark steel armor plates and bronze spikes. Featuring a glowing coal furnace in the center. The front is a menacing cast-iron dragon head. Top-down view pointing upwards, vertically aligned, 2d game sprite, isolated on white background",
    boat4_top: "A MASSIVE, extremely complex, multi-deck luxurious royal jade and pure gold emperor dragon boat featuring a highly prominent, majestic golden dragon head at the front, top-down view pointing upwards, vertically aligned, 2d game sprite, isolated on white background",
    boat5_top: "A COLOSSAL, EXTREMELY WIDE and BULKY cyberpunk mechanical DREADNOUGHT dragon boat. Massive wide heavy armor superstructure like a floating fortress. The front is a massive, menacing high-tech robotic mecha-dragon head. NO PADDLES, massive glowing blue plasma hover-engines and heavy armor blocks extending outward from the sides. Thick purple warp nacelles at the extremely wide heavy rear. Pure white and silver heavy armor plating with glowing cyan neon lines. Top-down view pointing upwards, vertically aligned, 2d game sprite, isolated on white background",
    dragon: "A majestic fierce golden Chinese dragon face, front view, 2d game boss art, isolated on white background",
    fish: "A leaping orange river fish, top-down 2d game sprite, isolated on white background",
    whirlpool: "A dangerous swirling blue water whirlpool, top-down 2d game sprite, isolated on white background",
    ghost_ship: "A glowing cyan ghostly ancient ship, top-down 2d game sprite, isolated on white background",
    zongzi: "A 2D game icon of a delicious traditional Chinese Zongzi wrapped in green bamboo leaves tied with string, flat vector style, isolated on white background",
    coin: "A shiny bright gold coin with a square hole in the middle, 2D game icon, isolated on white background"
};

const checkCollision = (rect1, rect2) => (
  rect1.x < rect2.x + rect2.width && rect1.x + rect1.width > rect2.x &&
  rect1.y < rect2.y + rect2.height && rect1.height + rect1.y > rect2.y
);

const safeGetStorage = (key, defaultVal, isJson = false) => {
    try { const item = window.localStorage.getItem(key); if (!item) return defaultVal; return isJson ? JSON.parse(item) : parseInt(item, 10) || defaultVal; } catch (e) { return defaultVal; }
};

const safeSetStorage = (key, val, isJson = false) => {
    try { window.localStorage.setItem(key, isJson ? JSON.stringify(val) : val.toString()); } catch (e) {}
};

const drawDragonBall = (ctx, x, y, radius, char, isGlowing, isStone = false, extraGlow = 0) => {
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
    if (isStone) {
        ctx.fillStyle = '#8c8c8c'; ctx.fill(); ctx.strokeStyle = '#595959'; ctx.lineWidth = Math.max(1, radius*0.1); ctx.stroke();
        const grad = ctx.createRadialGradient(x - radius*0.3, y - radius*0.3, radius*0.1, x, y, radius);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.4)'); grad.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
        ctx.fillStyle = grad; ctx.fill(); ctx.fillStyle = '#434343'; 
    } else {
        if (isGlowing) { ctx.shadowBlur = radius * (1.5 + extraGlow); ctx.shadowColor = '#faad14'; }
        const grad = ctx.createRadialGradient(x - radius*0.3, y - radius*0.3, radius*0.1, x, y, radius);
        grad.addColorStop(0, '#ffec3d'); grad.addColorStop(0.5, '#fa8c16'); grad.addColorStop(1, '#ad2102');
        ctx.fillStyle = grad; ctx.fill(); ctx.strokeStyle = '#ffe58f'; ctx.lineWidth = Math.max(1, radius*0.05); ctx.stroke();
        ctx.fillStyle = '#820014'; 
    }
    ctx.font = `900 ${radius * 1.1}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(char, x, y + radius*0.05); ctx.restore();
};

const drawGeometricBoat = (ctx, x, y, width, height, levelInput) => {
    const level = parseInt(levelInput, 10) || 1; ctx.save(); ctx.translate(x, y);
    if (level <= 1) {
        ctx.fillStyle = '#613400'; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(30, 0); ctx.lineTo(35, height/2); ctx.lineTo(30, height); ctx.lineTo(10, height); ctx.lineTo(5, height/2); ctx.fill();
        ctx.strokeStyle = '#3b1c00'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#874d00'; ctx.fillRect(0, 30, 40, 4);
    } else if (level === 2) {
        ctx.fillStyle = '#cf1322'; ctx.beginPath(); ctx.moveTo(width/2, -10); ctx.lineTo(width-5, 20); ctx.lineTo(width-5, height-10); ctx.lineTo(width/2, height+10); ctx.lineTo(5, height-10); ctx.lineTo(5, 20); ctx.fill();
        ctx.strokeStyle = '#fadb14'; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = '#fadb14'; ctx.fillRect(10, -15, 20, 15); ctx.fillStyle = '#f5222d'; ctx.fillRect(12, -10, 4, 4); ctx.fillRect(24, -10, 4, 4);
        ctx.fillStyle = '#096dd9'; ctx.beginPath(); ctx.moveTo(width/2, height-20); ctx.lineTo(width/2+15, height-15); ctx.lineTo(width/2, height-10); ctx.fill();
    } else if (level === 3) {
        ctx.fillStyle = '#d4b106'; ctx.fillRect(-5, 20, 10, 40); ctx.fillRect(width-5, 20, 10, 40);
        ctx.fillStyle = '#a8071a'; ctx.beginPath(); ctx.moveTo(width/2, -15); ctx.lineTo(width, 20); ctx.lineTo(width-2, height); ctx.lineTo(width/2, height+15); ctx.lineTo(2, height); ctx.lineTo(0, 20); ctx.fill();
        ctx.strokeStyle = '#faad14'; ctx.lineWidth = 2; ctx.stroke(); ctx.strokeStyle = '#faad14'; for(let i=10; i<height-10; i+=10) { ctx.beginPath(); ctx.moveTo(10, i); ctx.lineTo(width/2, i+5); ctx.lineTo(width-10, i); ctx.stroke(); }
        ctx.fillStyle = '#faad14'; ctx.fillRect(5, -20, 30, 20); ctx.fillStyle = '#873800'; ctx.fillRect(8, -30, 4, 10); ctx.fillRect(28, -30, 4, 10);
        ctx.fillStyle = '#389e0d'; ctx.beginPath(); ctx.moveTo(5, height-20); ctx.lineTo(-10, height-15); ctx.lineTo(5, height-10); ctx.fill(); ctx.beginPath(); ctx.moveTo(width-5, height-20); ctx.lineTo(width+10, height-15); ctx.lineTo(width-5, height-10); ctx.fill();
    } else if (level === 4) {
        ctx.shadowBlur = 10; ctx.shadowColor = '#52c41a'; ctx.fillStyle = '#135200'; ctx.beginPath(); ctx.moveTo(width/2, -20); ctx.lineTo(width+10, 30); ctx.lineTo(width+5, height+10); ctx.lineTo(width/2, height+25); ctx.lineTo(-5, height+10); ctx.lineTo(-10, 30); ctx.fill();
        ctx.strokeStyle = '#fadb14'; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = '#52c41a'; ctx.fillRect(5, 20, width-10, height-20); ctx.fillStyle = '#fadb14'; ctx.beginPath(); ctx.arc(width/2, -15, 20, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#f5222d'; ctx.fillRect(width/2-10, -25, 6, 6); ctx.fillRect(width/2+4, -25, 6, 6); ctx.fillStyle = '#faad14'; ctx.fillRect(width/2-25, -15, 50, 10); 
        ctx.fillStyle = '#f5222d'; [-10, width].forEach(x => { [height-30, height-10].forEach(y => { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x+(x<0?-15:15), y+5); ctx.lineTo(x, y+10); ctx.fill(); }); });
    } else {
        ctx.shadowBlur = 25; ctx.shadowColor = '#00e5ff'; ctx.fillStyle = 'rgba(0, 229, 255, 0.8)';
        ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(-40, 10); ctx.lineTo(-20, 60); ctx.lineTo(0, height-10); ctx.fill(); ctx.beginPath(); ctx.moveTo(width, 30); ctx.lineTo(width+40, 10); ctx.lineTo(width+20, 60); ctx.lineTo(width, height-10); ctx.fill(); 
        ctx.fillStyle = '#141414'; ctx.beginPath(); ctx.moveTo(width/2, -30); ctx.lineTo(width+15, 30); ctx.lineTo(width+5, height+20); ctx.lineTo(width/2, height+40); ctx.lineTo(-5, height+20); ctx.lineTo(-15, 30); ctx.fill();
        ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 4; ctx.stroke(); ctx.fillStyle = '#096dd9'; ctx.fillRect(10, 20, width-20, height-10); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(width/2, height/2, 8, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#faad14'; ctx.beginPath(); ctx.moveTo(width/2, -40); ctx.lineTo(width/2+25, -10); ctx.lineTo(width/2-25, -10); ctx.fill(); ctx.fillStyle = '#ff4d4f'; ctx.beginPath(); ctx.arc(width/2-10, -20, 4, 0, Math.PI*2); ctx.arc(width/2+10, -20, 4, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#f5222d'; ctx.beginPath(); ctx.moveTo(0, height); ctx.lineTo(-30, height-40); ctx.lineTo(-10, height-30); ctx.fill(); ctx.beginPath(); ctx.moveTo(width, height); ctx.lineTo(width+30, height-40); ctx.lineTo(width+10, height-30); ctx.fill();
    }
    ctx.restore();
};

const drawGeometricDragon = (ctx, w, h) => {
    ctx.fillStyle = '#d48806'; ctx.beginPath(); ctx.arc(w/2, h/2, 50, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#f5222d'; ctx.fillRect(w/2-25, h/2-10, 15, 5); ctx.fillRect(w/2+10, h/2-10, 15, 5);
};

const getTargetAsset = (assets, name) => (!assets || assets === "fallback") ? null : assets[name];
const getBoatScale = (level) => ({ 1: 0.9, 2: 1.05, 3: 1.2, 4: 1.35, 5: 1.5 }[Math.min(level, 5)] || 1.0);

// 🌟 修改：BoatPreview 增加神祕遮蔽效果
const BoatPreview = ({ level, isNext, assets, onClick, isLocked }) => {
    const previewCanvasRef = useRef(null);
    useEffect(() => {
        const canvas = previewCanvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#bae0ff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        const boatImg = getTargetAsset(assets, `boat${Math.min(level, 5)}_side`);
        const targetScale = getBoatScale(level); 
        ctx.save(); ctx.translate(canvas.width / 2, canvas.height / 2);
        if (boatImg) { 
            const baseW = 280, baseH = 125; let finalScale = targetScale;
            if (baseW * finalScale > canvas.width - 20) finalScale = (canvas.width - 20) / baseW;
            ctx.drawImage(boatImg, -(baseW * finalScale) / 2, -(baseH * finalScale) / 2, baseW * finalScale, baseH * finalScale); 
        } else { ctx.rotate(Math.PI / 2); drawGeometricBoat(ctx, -30 * targetScale, -60 * targetScale, 60 * targetScale, 120 * targetScale, level); }
        ctx.restore();
    }, [level, assets]);
    return (
        <div className="flex flex-col items-center w-full cursor-pointer transform transition-transform hover:scale-105" onClick={() => onClick && onClick(level)}>
            <div className="relative w-full max-w-[320px]">
                <canvas ref={previewCanvasRef} width={320} height={140} className={`rounded-lg border-2 border-blue-300 shadow-inner block bg-blue-100 w-full h-auto transition-all ${isLocked ? 'blur-md grayscale brightness-50' : ''}`} />
                {isLocked && <div className="absolute inset-0 flex items-center justify-center text-white text-4xl drop-shadow-lg font-black">🔒</div>}
            </div>
            <span className={`text-xs mt-2 font-bold px-2 py-1 rounded-full ${isNext ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                {isNext ? `Lv.${level} (預覽)` : `Lv.${level} (目前)`}
            </span>
            <span className="text-[10px] text-blue-500 mt-1 font-bold">🔍 點擊放大</span>
        </div>
    );
};

// 🌟 修改：LargeBoatPreview 增加剪影效果
const LargeBoatPreview = ({ level, assets, viewType, isLocked }) => {
    const canvasRef = useRef(null);
    useEffect(() => {
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
        const gradient = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 10, canvas.width/2, canvas.height/2, canvas.width);
        gradient.addColorStop(0, '#e6f7ff'); gradient.addColorStop(1, isLocked ? '#262626' : '#bae0ff'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
        const boatImg = getTargetAsset(assets, `boat${Math.min(level, 5)}_${viewType}`);
        const targetScale = getBoatScale(level); ctx.save(); ctx.translate(canvas.width/2, canvas.height/2);
        
        if (boatImg) {
            let finalScale = targetScale;
            const isSide = viewType === 'side';
            const baseW = isSide ? 320 : 160, baseH = isSide ? 145 : 160;
            if (baseW * finalScale > canvas.width - 20) finalScale = (canvas.width - 20) / baseW;
            
            if (isLocked) {
                // 🌟 繪製發光剪影 (Silhouette with glow)
                ctx.shadowBlur = 40; ctx.shadowColor = '#00e5ff';
                ctx.globalCompositeOperation = 'source-over';
                // 離屏繪製剪影
                const offCanvas = document.createElement('canvas'); offCanvas.width = canvas.width; offCanvas.height = canvas.height;
                const oCtx = offCanvas.getContext('2d');
                oCtx.translate(canvas.width/2, canvas.height/2);
                oCtx.drawImage(boatImg, -(baseW * finalScale)/2, -(baseH * finalScale)/2, baseW * finalScale, baseH * finalScale);
                oCtx.globalCompositeOperation = 'source-in';
                oCtx.fillStyle = '#000000'; oCtx.fillRect(-canvas.width, -canvas.height, canvas.width*2, canvas.height*2);
                ctx.drawImage(offCanvas, -canvas.width/2, -canvas.height/2);
            } else {
                ctx.drawImage(boatImg, -(baseW * finalScale)/2, -(baseH * finalScale)/2, baseW * finalScale, baseH * finalScale);
            }
        } else {
            if (isLocked) ctx.globalAlpha = 0.3;
            if (viewType === 'side') ctx.rotate(Math.PI / 2); drawGeometricBoat(ctx, -50 * targetScale, -100 * targetScale, 100 * targetScale, 200 * targetScale, level);
        }
        ctx.restore();
        
        if (isLocked) {
            ctx.fillStyle = "white"; ctx.font = "bold 80px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText("?", canvas.width/2, canvas.height/2);
        }
    }, [level, assets, viewType, isLocked]);
    return <canvas ref={canvasRef} width={viewType === 'side' ? 360 : 220} height={viewType === 'side' ? 200 : 220} className="rounded-xl border-4 border-white shadow-2xl block max-w-full h-auto" />;
};

export default function App() {
  const canvasRef = useRef(null);
  const [currentView, setCurrentView] = useState('loading');
  const [assets, setAssets] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState("準備背景資源...");
  const [isAudioMuted, setIsAudioMuted] = useState(true);
  const [galleryLevel, setGalleryLevel] = useState(null);
  const retryQueueRef = useRef([]);

  useEffect(() => {
      const unlockAudio = () => {
          if (!audio.ctx) { audio.init(); audio.isMuted = false; audio.master.gain.value = 0.1; setIsAudioMuted(false); } 
          else if (audio.ctx.state === 'suspended') audio.ctx.resume();
          window.removeEventListener('click', unlockAudio); window.removeEventListener('touchstart', unlockAudio);
      };
      window.addEventListener('click', unlockAudio); window.addEventListener('touchstart', unlockAudio);
      return () => { window.removeEventListener('click', unlockAudio); window.removeEventListener('touchstart', unlockAudio); };
  }, []);

  const [coins, setCoins] = useState(() => safeGetStorage('db_coins', 0, false));
  const [upgrades, setUpgrades] = useState(() => safeGetStorage('db_upgrades', { lives: 1, fever: 1 }, true));
  const [maxSummons, setMaxSummons] = useState(() => safeGetStorage('db_max_summons', 0, false));
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [user, setUser] = useState(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isHidingWordUI, setIsHidingWordUI] = useState(false); 

  useEffect(() => {
      if (!auth) { setIsDataLoaded(true); return; }
      const initAuth = async () => {
          try {
              if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await signInWithCustomToken(auth, __initial_auth_token);
              else await signInAnonymously(auth);
          } catch (e) { setIsDataLoaded(true); }
      };
      initAuth();
      const unsubscribe = onAuthStateChanged(auth, (u) => { setUser(u); if (!u) setIsDataLoaded(true); });
      return () => unsubscribe();
  }, []);

  useEffect(() => {
      if (!user || !db) return;
      const userRef = doc(db, 'artifacts', appId, 'users', user.uid, 'gamedata', 'save');
      const unsubscribe = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
              const data = docSnap.data();
              if (data.coins !== undefined) setCoins(data.coins);
              if (data.upgrades !== undefined) setUpgrades(data.upgrades);
              if (data.maxSummons !== undefined) setMaxSummons(data.maxSummons);
          }
          setIsDataLoaded(true); 
      }, (error) => { setIsDataLoaded(true); });
      return () => unsubscribe();
  }, [user]);

  useEffect(() => {
      if (!isDataLoaded) return; 
      const saveData = async () => {
          if (auth && db && user) {
              try { const userRef = doc(db, 'artifacts', appId, 'users', user.uid, 'gamedata', 'save'); await setDoc(userRef, { coins, upgrades, maxSummons }, { merge: true }); } catch(e) {}
          } else {
              safeSetStorage('db_coins', coins, false); safeSetStorage('db_upgrades', upgrades, true); safeSetStorage('db_max_summons', maxSummons, false);
          }
      };
      saveData();
  }, [coins, upgrades, maxSummons, isDataLoaded, user]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [summonCount, setSummonCount] = useState(0);
  const [sessionCoins, setSessionCoins] = useState(0);
  const [lives, setLives] = useState(3);
  const wordBagRef = useRef([]);
  const [currentWordObj, setCurrentWordObj] = useState(WORD_LIST[0]);
  const [currentStageIdx, setCurrentStageIdx] = useState(0);
  const [collectedLetters, setCollectedLetters] = useState([]);
  const [isFeverTime, setIsFeverTime] = useState(false);

  const getNextWord = useCallback(() => {
      if (wordBagRef.current.length === 0) wordBagRef.current = [...WORD_LIST].sort(() => Math.random() - 0.5);
      return wordBagRef.current.pop();
  }, []);

  const gameState = useRef({
    frames: 0, speed: 4, items: [], obstacles: [], effects: [], 
    player: { x: 180, y: 500, width: 40, height: 80, dx: 0, isInvincible: false, invincibleTimer: 0 },
    feverTimer: 0, introTimer: 0, wordIntroTimer: 0, summonTimer: 0, baseSpeed: 4, sessionCoinsRef: 0,
    currentStage: 1, lastNotifiedStage: 1, completedWordsCount: 0, stageBannerTimer: 0,
    speedMultiplier: 1.0, canvasWidth: 400, canvasHeight: 600, isGreatSummon: false
  });

  const requestRef = useRef();
  const toggleSound = () => { const muted = audio.toggleMute(); setIsAudioMuted(muted); };

  useEffect(() => {
      if (currentView === 'menu' || currentView === 'shop') audio.setMode('menu');
      else if (currentView === 'game') audio.setMode((gameState.current.summonTimer > 0 || gameState.current.wordIntroTimer > 0) ? 'stopped' : (isFeverTime ? 'fever' : 'game'));
      else audio.setMode('stopped');
  }, [currentView, isFeverTime]);

  useEffect(() => {
      const initAssets = async () => {
          const currentLvl = Math.min(parseInt(safeGetStorage('db_upgrades', { lives: 1 }, true)?.lives || 1, 10), 5);
          let loadedAssets = {};
          try {
              setLoadingStatus(`優先載入核心龍舟與神龍中...`); setLoadingProgress(40);
              const coreTasks = [{ key: `boat${currentLvl}_top`, p: PROMPTS[`boat${currentLvl}_top`] }, { key: `boat${currentLvl}_side`, p: PROMPTS[`boat${currentLvl}_side`] }, { key: 'dragon', p: PROMPTS.dragon }];
              const results = await Promise.allSettled(coreTasks.map(t => generateAndProcessImage(t.p)));
              results.forEach((res, index) => { if (res.status === 'fulfilled') loadedAssets[coreTasks[index].key] = res.value; else retryQueueRef.current.push(coreTasks[index]); });
              setAssets(loadedAssets); setLoadingProgress(100); setCurrentView('menu'); 
              const extraPrompts = [{ key: 'fish', p: PROMPTS.fish }, { key: 'whirlpool', p: PROMPTS.whirlpool }, { key: 'ghost_ship', p: PROMPTS.ghost_ship }, { key: 'zongzi', p: PROMPTS.zongzi }, { key: 'coin', p: PROMPTS.coin }];
              [1, 2, 3, 4, 5].filter(l => l !== currentLvl).forEach(l => { extraPrompts.push({ key: `boat${l}_top`, p: PROMPTS[`boat${l}_top`] }); extraPrompts.push({ key: `boat${l}_side`, p: PROMPTS[`boat${l}_side`] }); });
              const loadExtraAssets = async () => {
                  const batchSize = 3;
                  for (let i = 0; i < extraPrompts.length; i += batchSize) {
                      const batch = extraPrompts.slice(i, i + batchSize);
                      await Promise.all(batch.map(async (item) => { try { const img = await generateAndProcessImage(item.p); setAssets(prev => { if (!prev) return prev; return { ...prev, [item.key]: img }; }); } catch (e) { retryQueueRef.current.push(item); } }));
                      if (i + batchSize < extraPrompts.length) await new Promise(resolve => setTimeout(resolve, 800));
                  }
              };
              loadExtraAssets();
          } catch (e) { setLoadingStatus("系統異常，啟用全備用模式..."); setLoadingProgress(100); setTimeout(() => { setAssets({}); setCurrentView('menu'); }, 1500); }
      };
      initAssets();
  }, []);

  useEffect(() => {
      let isPolling = false; let timerId = null;
      const pollQueue = async () => {
          if (!isPolling && retryQueueRef.current.length > 0) {
              isPolling = true; const batch = retryQueueRef.current.splice(0, 2);
              for (const item of batch) { try { const img = await generateAndProcessImage(item.p); setAssets(prev => { if (!prev) return prev; return { ...prev, [item.key]: img }; }); } catch (e) { retryQueueRef.current.push(item); } await new Promise(r => setTimeout(r, 1500)); }
              isPolling = false;
          }
          timerId = setTimeout(pollQueue, 30000);
      };
      timerId = setTimeout(pollQueue, 30000); return () => clearTimeout(timerId);
  }, []);

  const buyUpgrade = (type) => { const currentLevel = parseInt(upgrades[type], 10) || 1; if (currentLevel >= MAX_LEVEL) return; const cost = UPGRADE_COSTS[currentLevel]; if (coins >= cost) { setCoins(c => c - cost); setUpgrades(prev => ({ ...prev, [type]: currentLevel + 1 })); } };

  const startGame = () => {
    const maxLives = 2 + (parseInt(upgrades?.lives, 10) || 1); setCurrentView('game'); setIsPlaying(true); setGameOver(false); setSessionCoins(0); setLives(maxLives); setSummonCount(0); setCollectedLetters([]); setIsFeverTime(false); setIsNewRecord(false); setIsHidingWordUI(true); 
    const nextWord = getNextWord(); setCurrentWordObj(nextWord); setCurrentStageIdx(0); const speedMult = window.innerWidth <= 768 ? 0.6 : 1.0;
    gameState.current = {
      ...gameState.current, frames: 0, items: [], obstacles: [], effects: [], player: { x: 180, y: 480, width: 40, height: 80, dx: 0, isInvincible: false, invincibleTimer: 0 }, feverTimer: 0, introTimer: 180, wordIntroTimer: 0, summonTimer: 0, sessionCoinsRef: 0, currentStage: 1, lastNotifiedStage: 1, completedWordsCount: 0, stageBannerTimer: 120, speedMultiplier: speedMult, speed: STAGE_CONFIG[1].speed * speedMult, baseSpeed: STAGE_CONFIG[1].speed * speedMult, isGreatSummon: false
    };
  };

  const endGame = useCallback(() => { setIsPlaying(false); setGameOver(true); setCoins(c => c + gameState.current.sessionCoinsRef); audio.setMode('menu'); const finalSummons = gameState.current.completedWordsCount; setMaxSummons(prev => { if (finalSummons > prev) { setIsNewRecord(true); return finalSummons; } return prev; }); }, []);

  const handleCollectedLetter = (char, targetWord) => {
    setCollectedLetters(prev => {
      const nextIndex = prev.length;
      if (nextIndex < targetWord.length && char === targetWord[nextIndex]) {
        const newCollected = [...prev, char]; audio.sfxLetter(newCollected.length / targetWord.length);
        if (newCollected.length === targetWord.length) {
          gameState.current.completedWordsCount++; setSummonCount(gameState.current.completedWordsCount); let nextS = gameState.current.currentStage;
          if (gameState.current.completedWordsCount === 2) nextS = 2; if (gameState.current.completedWordsCount === 4) nextS = 3;
          if (nextS !== gameState.current.currentStage) { gameState.current.currentStage = nextS; gameState.current.baseSpeed = STAGE_CONFIG[nextS].speed * gameState.current.speedMultiplier; }
          setIsHidingWordUI(true); gameState.current.summonTimer = 260; gameState.current.obstacles = []; gameState.current.isGreatSummon = (currentStageIdx === currentWordObj.stages.length - 1); audio.setMode('stopped'); 
        }
        return newCollected;
      }
      return prev;
    });
  };

  const gameLoop = useCallback(() => {
    if (!isPlaying || gameOver) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); const state = gameState.current; ctx.clearRect(0, 0, state.canvasWidth, state.canvasHeight);
    const isAnimationPaused = state.wordIntroTimer > 0 || state.summonTimer > 0;
    const targetWordObj = currentWordObj?.stages[currentStageIdx] || { word: 'ZONGZI', meaning: '粽子' };
    const targetWord = targetWordObj.word; const targetMeaning = targetWordObj.meaning; const nextNeededChar = targetWord[collectedLetters.length];
    const stageConfig = STAGE_CONFIG[state.currentStage];
    ctx.fillStyle = isFeverTime ? '#fffbe6' : stageConfig.water; ctx.fillRect(0, 0, state.canvasWidth, state.canvasHeight);
    ctx.fillStyle = isFeverTime ? '#ffe58f' : stageConfig.bank; ctx.fillRect(0, 0, 20, state.canvasHeight); ctx.fillRect(state.canvasWidth - 20, 0, 20, state.canvasHeight); ctx.strokeStyle = isFeverTime ? '#ffd666' : stageConfig.line; ctx.lineWidth = 2;
    for(let i=0; i<6; i++) { const speedOffset = (state.introTimer > 0 || isAnimationPaused) ? 0 : (state.frames * state.speed); const yPos = (speedOffset + i * 120) % state.canvasHeight; ctx.beginPath(); ctx.moveTo(30, yPos); ctx.lineTo(30, yPos + 40); ctx.moveTo(state.canvasWidth - 30, yPos + 60); ctx.lineTo(state.canvasWidth - 30, yPos + 100); ctx.stroke(); }
    const currentLvl = parseInt(upgrades?.lives, 10) || 1; const boatScale = getBoatScale(currentLvl);
    if (state.introTimer > 0) {
        state.introTimer--; const progress = 1 - (state.introTimer / 180);
        if (progress < 0.6) {
            const sideImg = getTargetAsset(assets, `boat${currentLvl}_side`); const xPos = -200 + (progress / 0.6) * (state.canvasWidth + 400); const yPos = state.canvasHeight / 2; ctx.save(); ctx.translate(xPos, yPos);
            if (sideImg) { const baseW = 140, baseH = 80; ctx.drawImage(sideImg, -(baseW * boatScale)/2, -(baseH * boatScale)/2, baseW * boatScale, baseH * boatScale); } else { ctx.fillStyle = '#cf1322'; ctx.fillRect(-50 * boatScale, -15 * boatScale, 100 * boatScale, 30 * boatScale); }
            ctx.restore(); ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; ctx.font = 'bold 30px sans-serif'; ctx.textAlign = 'center'; ctx.shadowBlur = 10; ctx.shadowColor = '#096dd9'; ctx.fillText(`Lv.${currentLvl} 龍舟出發！`, state.canvasWidth/2, state.canvasHeight/2 - 80); ctx.shadowBlur = 0;
        } else {
            const p2 = (progress - 0.6) / 0.4; state.player.y = state.canvasHeight + 50 - p2 * (state.canvasHeight - 480 + 50); state.player.x = state.canvasWidth / 2 - state.player.width / 2;
            const topImg = getTargetAsset(assets, `boat${currentLvl}_top`);
            if (topImg) { ctx.save(); ctx.translate(state.player.x + state.player.width/2, state.player.y + state.player.height/2); const baseS = 90; ctx.drawImage(topImg, -(baseS * boatScale)/2, -(baseS * boatScale)/2, baseS * boatScale, baseS * boatScale); ctx.restore(); } else drawGeometricBoat(ctx, state.player.x, state.player.y, state.player.width, state.player.height, currentLvl);
        }
        if (state.introTimer === 1) state.wordIntroTimer = 150; requestRef.current = requestAnimationFrame(gameLoop); return; 
    }
    if (!isAnimationPaused) { state.player.x += state.player.dx; if (state.player.x < 25) state.player.x = 25; if (state.player.x + state.player.width > state.canvasWidth - 25) state.player.x = state.canvasWidth - 25 - state.player.width; }
    if (state.player.isInvincible && !isAnimationPaused) { state.player.invincibleTimer--; if (state.player.invincibleTimer <= 0) state.player.isInvincible = false; }
    if (!state.player.isInvincible || Math.floor(state.player.invincibleTimer / 5) % 2 === 0) {
        const boatImg = getTargetAsset(assets, `boat${currentLvl}_top`);
        if (boatImg) { ctx.save(); ctx.translate(state.player.x + state.player.width/2, state.player.y + state.player.height/2); const baseS = 90; ctx.drawImage(boatImg, -(baseS * boatScale)/2, -(baseS * boatScale)/2, baseS * boatScale, baseS * boatScale); ctx.restore(); } else drawGeometricBoat(ctx, state.player.x, state.player.y, state.player.width, state.player.height, currentLvl);
    }
    if (state.currentStage === 3 && !isFeverTime && !isAnimationPaused) {
        const gradient = ctx.createRadialGradient(state.player.x + 20, state.player.y + 40, 50, state.player.x + 20, state.player.y + 40, 250); gradient.addColorStop(0, 'rgba(0,0,0,0)'); gradient.addColorStop(1, 'rgba(0,0,0,0.85)'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, state.canvasWidth, state.canvasHeight);
    }
    if (isFeverTime) {
        if (!isAnimationPaused) state.feverTimer--; const floatY = Math.sin(state.frames * 0.1) * 5; ctx.save(); ctx.translate(state.canvasWidth/2, 30 + floatY);
        if (assets?.dragon) { ctx.shadowBlur = 30; ctx.shadowColor = '#faad14'; ctx.drawImage(assets.dragon, -60, -60, 120, 120); } ctx.restore();
        if (state.feverTimer <= 0) { setIsFeverTime(false); audio.setMode('game'); state.speed = state.baseSpeed; setIsHidingWordUI(true); state.wordIntroTimer = 150; if (state.lastNotifiedStage !== state.currentStage) { state.stageBannerTimer = 120; state.lastNotifiedStage = state.currentStage; } }
    } 
    if (!isAnimationPaused && state.frames % (isFeverTime ? 4 : 70) === 0) {
        if (isFeverTime) { state.items.push({ x: state.canvasWidth/2 - 15, y: 80, width: 30, height: 30, type: 'coin', color: '#faad14', dx: (Math.random() - 0.5) * 12, dy: state.speed + Math.random() * 5 }); } 
        else {
            let type, char, color; if (Math.random() > 0.3) { type = 'letter'; char = (Math.random() > 0.35 && nextNeededChar) ? nextNeededChar : String.fromCharCode(65 + Math.floor(Math.random() * 26)); color = '#52c41a'; } else { type = 'coin'; color = '#faad14'; }
            let xPos = 30 + Math.random() * (state.canvasWidth - 90); let attempts = 0; while(attempts < 10) { if (!state.obstacles.some(obs => Math.abs(obs.x - xPos) < 55 && Math.abs(obs.y - (-30)) < 80)) break; xPos = 30 + Math.random() * (state.canvasWidth - 90); attempts++; }
            state.items.push({ x: xPos, y: -30, width: 30, height: 30, type, char, color, dx: 0, dy: 0 });
        }
    }
    if (!isAnimationPaused && !isFeverTime && state.frames % stageConfig.obsRate === 0 && Math.random() > 0.1) {
        const rand = Math.random(); let type, dx = 0; if (state.currentStage === 1) { type = rand > 0.5 ? 'log' : 'rock'; } else if (state.currentStage === 2) { if (rand < 0.33) type = 'log'; else if (rand < 0.66) type = 'rock'; else if (rand < 0.85) { type = 'fish'; dx = Math.random() > 0.5 ? 3 : -3; } else type = 'whirlpool'; } else { if (rand < 0.3) type = 'rock'; else if (rand < 0.6) { type = 'fish'; dx = Math.random() > 0.5 ? 4 : -4; } else if (rand < 0.8) type = 'whirlpool'; else type = 'ghost_ship'; }
        const width = (type === 'log') ? 60 : (type === 'whirlpool' ? 50 : 45); const height = (type === 'log') ? 25 : (type === 'whirlpool' ? 50 : 45); const color = type === 'log' ? '#874d00' : (type === 'ghost_ship' ? '#00ffff' : '#595959');
        let xP = 30 + Math.random() * (state.canvasWidth - 110); if (type === 'fish') { xP = dx > 0 ? 25 : state.canvasWidth - 70; } else { let att = 0; while(att < 10) { if (!state.items.some(it => Math.abs(it.x - xP) < Math.max(55, width) && Math.abs(it.y - (-50)) < 80)) break; xP = 30 + Math.random() * (state.canvasWidth - 110); att++; } }
        state.obstacles.push({ x: xP, y: -50, width, height, type, color, dx, obsFrames: 0 });
    }
    for (let i = state.items.length - 1; i >= 0; i--) {
        const item = state.items[i]; if (!isAnimationPaused) { item.x += item.dx || 0; item.y += item.dy || state.speed; if (item.dx !== 0 && (item.x < 20 || item.x > state.canvasWidth - 50)) item.dx *= -1; }
        if (item.type === 'coin') { const coinImg = getTargetAsset(assets, 'coin'); if (coinImg) { ctx.save(); ctx.shadowBlur = 10; ctx.shadowColor = '#ffe58f'; ctx.drawImage(coinImg, item.x - 5, item.y - 5, 40, 40); ctx.restore(); } else { ctx.save(); ctx.shadowBlur = 10; ctx.shadowColor = '#ffe58f'; ctx.beginPath(); ctx.arc(item.x + 15, item.y + 15, 14, 0, Math.PI * 2); ctx.fillStyle = '#fadb14'; ctx.fill(); ctx.strokeStyle = '#d48806'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore(); } } else {
            const zongziImg = getTargetAsset(assets, 'zongzi'); if (zongziImg) { ctx.save(); ctx.shadowBlur = 5; ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.drawImage(zongziImg, item.x, item.y + 5, 30, 30); ctx.restore(); } else { ctx.fillStyle = '#389e0d'; ctx.beginPath(); ctx.moveTo(item.x+15, item.y+5); ctx.lineTo(item.x+30, item.y+30); ctx.lineTo(item.x, item.y+30); ctx.fill(); }
            const hoverY = Math.sin(state.frames * 0.15) * 3; drawDragonBall(ctx, item.x + 15, item.y + hoverY, 12, item.char, true, false);
        }
        if (!isAnimationPaused && checkCollision(state.player, item)) {
            if (item.type === 'letter') { 
                state.effects.push({ type: 'leaf_burst', x: item.x + 15, y: item.y + 15, frames: 0, maxFrames: 30 }); const isCorrect = item.char === nextNeededChar;
                if (isCorrect) { const n = targetWord.length; const collectedCount = collectedLetters.length; const uiX = state.canvasWidth - 20 - (n - 1 - collectedCount) * 32 - 14; const uiY = 30; state.effects.push({ type: 'letter_ascend_target', char: item.char, startX: item.x + 15, startY: item.y, targetX: uiX, targetY: uiY, frames: 0, maxFrames: 40 }); handleCollectedLetter(item.char, targetWord); } else { state.effects.push({ type: 'letter_ascend', char: item.char, x: item.x + 15, y: item.y, frames: 0, maxFrames: 45 }); }
            } else if (item.type === 'coin') { state.effects.push({ type: 'coin_burst', x: item.x + 15, y: item.y + 15, frames: 0, maxFrames: 20 }); audio.sfxCoin(); state.sessionCoinsRef += 1; setSessionCoins(state.sessionCoinsRef); }
            state.items.splice(i, 1); continue;
        }
        if (item.y > state.canvasHeight) state.items.splice(i, 1);
    }
    for (let i = state.obstacles.length - 1; i >= 0; i--) {
        const obs = state.obstacles[i]; if (!isAnimationPaused) { obs.y += state.speed; obs.x += obs.dx || 0; obs.obsFrames = (obs.obsFrames || 0) + 1; if (obs.type === 'ghost_ship') { obs.y += 1.5; obs.x += Math.sin(obs.obsFrames * 0.1) * 2; } else if (obs.type === 'fish') obs.y += 1.0; }
        const customAsset = getTargetAsset(assets, obs.type);
        if (customAsset && obs.type !== 'log' && obs.type !== 'rock') { if (obs.type === 'whirlpool') { ctx.save(); ctx.translate(obs.x + obs.width/2, obs.y + obs.height/2); ctx.rotate(obs.obsFrames * 0.06); ctx.drawImage(customAsset, -obs.width/2 - 10, -obs.height/2 - 10, obs.width + 20, obs.height + 20); ctx.restore(); } else ctx.drawImage(customAsset, obs.x - 10, obs.y - 10, obs.width + 20, obs.height + 20); } else {
            if (obs.type === 'whirlpool') { ctx.save(); ctx.translate(obs.x+25, obs.y+25); ctx.rotate(obs.obsFrames * 0.1); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0,0, 10 + (obs.obsFrames%10), 0, Math.PI*2); ctx.stroke(); ctx.restore(); } else if (obs.type === 'fish') { ctx.fillStyle = '#ff7a45'; ctx.beginPath(); ctx.ellipse(obs.x+22, obs.y+22, 20, 10, obs.dx > 0 ? 0 : Math.PI, 0, Math.PI*2); ctx.fill(); } else if (obs.type === 'ghost_ship') { ctx.fillStyle = 'rgba(0, 255, 255, 0.6)'; ctx.beginPath(); ctx.moveTo(obs.x+22, obs.y); ctx.lineTo(obs.x+45, obs.y+20); ctx.lineTo(obs.x+22, obs.y+45); ctx.lineTo(obs.x, obs.y+20); ctx.fill(); } else if (obs.type === 'log') { ctx.fillStyle = obs.color; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(obs.x, obs.y, obs.width, obs.height, 10) : ctx.fillRect(obs.x, obs.y, obs.width, obs.height); ctx.fill(); } else { ctx.fillStyle = obs.color; ctx.beginPath(); ctx.moveTo(obs.x+10, obs.y); ctx.lineTo(obs.x+obs.width-10, obs.y); ctx.lineTo(obs.x+obs.width, obs.y+20); ctx.lineTo(obs.x+obs.width-5, obs.y+obs.height); ctx.lineTo(obs.x+5, obs.y+obs.height); ctx.lineTo(obs.x, obs.y+20); ctx.closePath(); ctx.fill(); }
        }
        if (!isAnimationPaused && !state.player.isInvincible && !isFeverTime && checkCollision(state.player, obs)) { audio.sfxHit(); setLives(l => { const nL = l - 1; if (nL <= 0) endGame(); return nL; }); state.player.isInvincible = true; state.player.invincibleTimer = 90; state.obstacles.splice(i, 1); continue; }
        if (obs.y > state.canvasHeight) state.obstacles.splice(i, 1);
    }
    for (let i = state.effects.length - 1; i >= 0; i--) {
        const eff = state.effects[i]; const progress = eff.frames / eff.maxFrames; const alpha = 1 - progress; ctx.save(); ctx.globalAlpha = Math.max(0, alpha);
        if (eff.type === 'coin_burst') { ctx.fillStyle = '#fadb14'; for (let j = 0; j < 5; j++) { const angle = (Math.PI * 2 / 5) * j + (eff.frames * 0.1); const dist = eff.frames * 2.5; ctx.fillRect(eff.x + Math.cos(angle) * dist - 3, eff.y + Math.sin(angle) * dist - 3, 6, 6); } } else if (eff.type === 'leaf_burst') { ctx.fillStyle = '#389e0d'; for (let j = 0; j < 4; j++) { ctx.save(); const angle = (Math.PI * 2 / 4) * j; const dist = eff.frames * 1.5; ctx.translate(eff.x + Math.cos(angle) * dist, eff.y + Math.sin(angle) * dist + (eff.frames * 0.5)); ctx.rotate(eff.frames * 0.1); ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.fill(); ctx.restore(); } } else if (eff.type === 'letter_ascend') { const flyY = eff.y - (eff.frames * 4); ctx.globalAlpha = Math.max(0, alpha); drawDragonBall(ctx, eff.x, flyY, 15, eff.char, true, false); } else if (eff.type === 'letter_ascend_target') { const easeP = 1 - Math.pow(1 - progress, 3); const currentX = eff.startX + (eff.targetX - eff.startX) * easeP; const currentY = eff.startY + (eff.targetY - eff.startY) * easeP; const currentRadius = 15 - (easeP * 3); ctx.globalAlpha = Math.max(0, 1 - Math.pow(progress, 5)); drawDragonBall(ctx, currentX, currentY, currentRadius, eff.char, true, false); }
        ctx.restore(); eff.frames++; if (eff.frames >= eff.maxFrames) state.effects.splice(i, 1);
    }
    if (!isAnimationPaused) state.frames++; 
    
    // 🌟 修改：新單字展示防重疊優化
    if (state.wordIntroTimer > 0) {
        state.wordIntroTimer--; const t = state.wordIntroTimer; if (t === 120) speakWord(targetWord); if (t === 1) setIsHidingWordUI(false); ctx.save(); ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; ctx.fillRect(0, 0, state.canvasWidth, state.canvasHeight);
        const n = targetWord.length; 
        const ballSpacing = 50; // 🌟 加大間距確保不重疊
        const startX = state.canvasWidth / 2 - (n * ballSpacing) / 2 + (ballSpacing / 2); 
        const centerY = state.canvasHeight / 2 - 50;
        for (let i = 0; i < n; i++) {
            let x = startX + i * ballSpacing, y = centerY, r = 25; 
            const uiX = state.canvasWidth - 20 - (n - 1 - i) * 32 - 14, uiY = 30; 
            if (t > 120) { const p = (150 - t) / 30; y = -50 + p * (centerY + 50); } else if (t <= 50) { const p = 1 - (t / 50); x = x + p * (uiX - x); y = y + p * (uiY - y); r = 25 - p * 11; }
            drawDragonBall(ctx, x, y, r, targetWord[i], false, true); 
        }
        let textY = centerY + 75, textAlpha = 1, textScale = 1; if (t > 120) { const p = (150 - t) / 30; textY = -50 + 75 + p * (centerY + 50); } else if (t <= 50) { const p = 1 - (t / 50); textY = centerY + 75 - p * 30; textAlpha = Math.max(0, 1 - p * 1.5); textScale = 1 - p * 0.2; }
        if (textAlpha > 0) { ctx.globalAlpha = textAlpha; ctx.font = `900 ${36 * textScale}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 6 * textScale; ctx.strokeStyle = '#000000'; ctx.strokeText(targetMeaning, state.canvasWidth / 2, textY); const textGrad = ctx.createLinearGradient(0, textY - 20, 0, textY + 20); textGrad.addColorStop(0, '#b7eb8f'); textGrad.addColorStop(1, '#52c41a'); ctx.fillStyle = textGrad; ctx.fillText(targetMeaning, state.canvasWidth / 2, textY); }
        ctx.restore();
    }

    if (state.summonTimer > 0) {
        state.summonTimer--; const t = state.summonTimer; const maxT = 260; const isGreat = state.isGreatSummon; ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.85, (maxT - t) / 40)})`; ctx.fillRect(0, 0, state.canvasWidth, state.canvasHeight);
        const cx = state.canvasWidth / 2, cy = state.player.y - 120;
        const ritualWord = isGreat ? currentWordObj.fullWord : targetWord; const ritualMeaning = isGreat ? currentWordObj.fullMeaning : targetMeaning;
        if (t === 200) speakWord(ritualWord); if (t === 140) audio.sfxRoar(); 
        const ritualGlow = Math.abs(Math.sin(state.frames * 0.2)) * 1.2;
        const radiusInner = 120; const radiusOuter = 180; const angleSpan = 2 * Math.PI / 3; const angleStart = Math.PI/2 + angleSpan/2; 
        if (!isGreat || currentWordObj.stages.length === 1) {
            const n = targetWord.length;
            for (let i = 0; i < n; i++) {
                const uiX = state.canvasWidth - 20 - (n - 1 - i) * 32 - 14, uiY = 30;
                let angle = Math.PI / 2; if (n > 1) angle = angleStart - (i / (n - 1)) * angleSpan;
                const tx = cx + Math.cos(angle) * radiusInner, ty = cy + Math.sin(angle) * radiusInner;
                let x = tx, y = ty; if (t > 200) { const p = (260 - t) / 60; x = uiX + p * (tx - uiX); y = uiY + p * (ty - uiY); }
                drawDragonBall(ctx, x, y, 20, targetWord[i], true, false, ritualGlow);
            }
        } else {
            let prevWord = ""; for (let s = 0; s < currentStageIdx; s++) prevWord += currentWordObj.stages[s].word;
            const n1 = prevWord.length;
            for(let i = 0; i < n1; i++) {
                let angle = Math.PI / 2; if (n1 > 1) angle = angleStart - (i / (n1 - 1)) * angleSpan;
                const tx = cx + Math.cos(angle) * radiusInner, ty = cy + Math.sin(angle) * radiusInner;
                ctx.globalAlpha = t > 200 ? (260 - t) / 60 : 1; drawDragonBall(ctx, tx, ty, 20, prevWord[i], true, false, ritualGlow); ctx.globalAlpha = 1;
            }
            const n2 = targetWord.length;
            for(let i = 0; i < n2; i++) {
                const uiX = state.canvasWidth - 20 - (n2 - 1 - i) * 32 - 14, uiY = 30;
                let angle = Math.PI / 2; if (n2 > 1) angle = angleStart - (i / (n2 - 1)) * angleSpan;
                const tx = cx + Math.cos(angle) * radiusOuter, ty = cy + Math.sin(angle) * radiusOuter;
                let x = tx, y = ty; if (t > 200) { const p = (260 - t) / 60; x = uiX + p * (tx - uiX); y = uiY + p * (ty - uiY); }
                drawDragonBall(ctx, x, y, 20, targetWord[i], true, false, ritualGlow);
            }
        }
        if (isGreat && t <= 200) {
            const textAlpha = Math.min(1, (200 - t) / 20); ctx.save(); ctx.globalAlpha = textAlpha; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            const textY = 120; ctx.font = '900 36px sans-serif'; ctx.lineWidth = 6; ctx.strokeStyle = '#000000'; ctx.strokeText(`${ritualWord}`, cx, textY);
            const grad = ctx.createLinearGradient(0, textY-20, 0, textY+20); grad.addColorStop(0, '#ffe58f'); grad.addColorStop(1, '#faad14'); ctx.fillStyle = grad; ctx.fillText(`${ritualWord}`, cx, textY);
            ctx.font = '900 24px sans-serif'; ctx.strokeText(`(${ritualMeaning})`, cx, textY + 40); ctx.fillStyle = '#b7eb8f'; ctx.fillText(`(${ritualMeaning})`, cx, textY + 40); ctx.restore();
        }
        if (t <= 140 && t > 0) {
            const beamP = Math.min(1, (140 - t) / 20), beamAlpha = Math.min(1, t / 30); ctx.save(); ctx.globalAlpha = beamAlpha;
            const bw = isGreat ? 160 : 120; const grad = ctx.createLinearGradient(cx - bw/2, 0, cx + bw/2, 0); grad.addColorStop(0, 'rgba(250, 173, 20, 0)'); grad.addColorStop(0.5, 'rgba(255, 255, 255, 1)'); grad.addColorStop(1, 'rgba(250, 173, 20, 0)'); ctx.fillStyle = grad; ctx.fillRect(cx - (bw/2) * beamP, 0, bw * beamP, cy + 90); ctx.restore();
        }
        if (t <= 110) {
            let dY, scale, alpha = 1; if (t > 40) { const p = (110 - t) / 30; const startY = -150, targetY = cy + 20; dY = startY + Math.min(1, p) * (targetY - startY); scale = 1.0 + Math.min(1, p) * 0.5; if (t > 80) alpha = Math.min(1, (110 - t) / 15); } else { const p = (40 - t) / 40; const startY = cy + 20, endY = 30; const ep = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; dY = startY - ep * (startY - endY); scale = 1.5 - ep * 0.7; }
            ctx.save(); ctx.translate(cx, dY); ctx.globalAlpha = alpha; ctx.scale(scale, scale); if (assets?.dragon) { ctx.shadowBlur = 50; ctx.shadowColor = '#faad14'; ctx.drawImage(assets.dragon, -75, -75, 150, 150); } else drawGeometricDragon(ctx, state.canvasWidth, state.canvasHeight); ctx.restore();
        }
        if (t === 0) { setIsFeverTime(true); setIsHidingWordUI(false); audio.setMode('fever'); const fl = parseInt(upgrades?.fever, 10) || 1; state.feverTimer = (10 + (fl - 1) * 2) * 60; state.speed = 15 * state.speedMultiplier; state.items = []; setCollectedLetters([]); if (state.isGreatSummon) { const nextWord = getNextWord(); setCurrentWordObj(nextWord); setCurrentStageIdx(0); } else setCurrentStageIdx(prev => prev + 1); }
    }
    if (state.stageBannerTimer > 0) { state.stageBannerTimer--; ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; ctx.fillRect(0, state.canvasHeight/4 - 30, state.canvasWidth, 60); ctx.fillStyle = '#fadb14'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`Stage ${state.currentStage}: ${stageConfig.name}`, state.canvasWidth/2, state.canvasHeight/4 + 8); }
    requestRef.current = requestAnimationFrame(gameLoop);
  }, [isPlaying, gameOver, isFeverTime, collectedLetters, currentWordObj, currentStageIdx, upgrades, endGame, assets, getNextWord]);

  useEffect(() => {
    const handleKeyDown = (e) => { if (currentView !== 'game' || !isPlaying || gameOver || gameState.current.summonTimer > 0 || gameState.current.wordIntroTimer > 0) return; if (e.key === 'ArrowLeft') gameState.current.player.dx = -8; if (e.key === 'ArrowRight') gameState.current.player.dx = 8; };
    const handleKeyUp = (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') gameState.current.player.dx = 0; };
    window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp); return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
  }, [currentView, isPlaying, gameOver]);

  const handleTouchStart = (e) => { if (currentView !== 'game' || !isPlaying || gameOver || gameState.current.summonTimer > 0 || gameState.current.wordIntroTimer > 0) return; if (e.target.closest('button')) return; touchRef.current.lastX = e.touches[0].clientX; gameState.current.player.dx = 0; };
  const handleTouchMove = (e) => {
      if (currentView !== 'game' || !isPlaying || gameOver || touchRef.current.lastX === null) return;
      const cx = e.touches[0].clientX; const dx = cx - touchRef.current.lastX; const canvas = canvasRef.current;
      const sx = canvas ? (gameState.current.canvasWidth / canvas.getBoundingClientRect().width) : 1;
      gameState.current.player.x += dx * sx * 1.5; if (gameState.current.player.x < 25) gameState.current.player.x = 25; if (gameState.current.player.x + gameState.current.player.width > gameState.current.canvasWidth - 25) gameState.current.player.x = gameState.current.canvasWidth - 25 - gameState.current.player.width; touchRef.current.lastX = cx;
  };
  const touchRef = useRef({ lastX: null });
  const handleTouchEnd = () => { touchRef.current.lastX = null; if (currentView === 'game') gameState.current.player.dx = 0; };

  useEffect(() => { if (currentView === 'game' && isPlaying && !gameOver) requestRef.current = requestAnimationFrame(gameLoop); return () => { if(requestRef.current) cancelAnimationFrame(requestRef.current); }; }, [gameLoop, currentView, isPlaying, gameOver]);

  const currentLivesLvl = parseInt(upgrades?.lives, 10) || 1;
  const currentFeverLvl = parseInt(upgrades?.fever, 10) || 1;
  const SoundToggleButton = () => ( <button onClick={toggleSound} className="absolute top-4 right-4 z-50 bg-white/80 p-3 rounded-full shadow-lg text-2xl"> {isAudioMuted ? '🔇' : '🔊'} </button> );

  if (currentView === 'loading') { return ( <div className="flex flex-col items-center justify-center h-screen overflow-hidden bg-gray-900 text-white p-6 text-center"> <div className="text-8xl mb-6 animate-bounce">✨</div> <h1 className="text-3xl font-black mb-4 text-blue-300">極速載入中...</h1> <p className="text-gray-400 mb-8 max-w-md">正在為您準備高畫質遊戲素材，請稍候！</p> <div className="w-full max-w-sm h-4 bg-gray-800 rounded-full overflow-hidden mb-2"><div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300" style={{ width: `${loadingProgress}%` }}></div></div> <p className="text-purple-300 font-bold">{loadingStatus}</p> </div> ); }

  if (currentView === 'menu') { return ( <div className="flex flex-col items-center justify-center h-screen overflow-hidden bg-blue-50 p-4 relative"> <SoundToggleButton /> <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-[400px] text-center flex flex-col items-center"> <div className="text-6xl mb-4">🐉🛶</div> <h1 className="text-4xl font-black text-blue-900 mb-2">端午龍舟長征</h1> <p className="text-gray-500 mb-6">閃避險阻、收集單字、解鎖跨時代的神龍傳說！</p> <div className="flex gap-3 mb-8 w-full justify-center"> <div className="bg-yellow-100 px-4 py-2 rounded-full font-bold text-yellow-700 text-sm shadow-sm">💰 資金: {coins}</div> <div className="bg-blue-100 px-4 py-2 rounded-full font-bold text-blue-700 text-sm shadow-sm">🐉 最多召喚: {maxSummons} 次</div> </div> <div className="flex flex-col gap-4 w-full"> <button onClick={startGame} className="w-full py-4 bg-green-500 hover:bg-green-600 text-white text-xl font-bold rounded-xl shadow-md transform transition-transform hover:scale-105">▶ 開始長征</button> <button onClick={() => setCurrentView('shop')} className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white text-xl font-bold rounded-xl shadow-md transform transition-transform hover:scale-105">🛠️ 龍舟改造廠</button> </div> </div> </div> ); }

  if (currentView === 'shop') { return ( <div className="flex flex-col items-center h-screen overflow-y-auto bg-blue-50 p-4 pt-10 relative"> <SoundToggleButton /> <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-[400px]"> <div className="flex justify-between items-center mb-6 border-b pb-4"><h2 className="text-2xl font-bold text-gray-800">🛠️ 龍舟改造廠</h2><div className="bg-yellow-100 px-4 py-1 rounded-full font-bold text-yellow-700">💰 {coins}</div></div> <div className="bg-gray-50 p-4 rounded-xl mb-4 border border-gray-200"> <div className="flex justify-between items-start mb-2"> <div className="pr-2"><h3 className="font-bold text-lg text-red-600">❤️ 強化船體</h3><p className="text-sm text-gray-500">目前: {2 + currentLivesLvl} 命</p></div> <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-bold">Lv. {currentLivesLvl}/{MAX_LEVEL}</span> </div> <div className="flex flex-col items-center gap-2 my-4 py-4 bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden"> <BoatPreview level={currentLivesLvl} isNext={false} assets={assets} onClick={setGalleryLevel} isLocked={false} /> {currentLivesLvl < MAX_LEVEL && (<React.Fragment><div className="text-2xl text-gray-300 animate-pulse my-1">▼</div><BoatPreview level={currentLivesLvl + 1} isNext={true} assets={assets} onClick={setGalleryLevel} isLocked={true} /></React.Fragment>)} </div> <button onClick={() => buyUpgrade('lives')} disabled={currentLivesLvl >= MAX_LEVEL || coins < UPGRADE_COSTS[currentLivesLvl]} className={`w-full py-2 mt-2 rounded-lg font-bold transition-colors ${currentLivesLvl >= MAX_LEVEL ? 'bg-gray-300 text-gray-500' : coins < UPGRADE_COSTS[currentLivesLvl] ? 'bg-gray-200 text-gray-400' : 'bg-yellow-400 hover:bg-yellow-500 text-yellow-900 shadow-sm'}`}>{currentLivesLvl >= MAX_LEVEL ? 'MAX' : `升級花費: 💰 ${UPGRADE_COSTS[currentLivesLvl]}`}</button> </div> <div className="bg-gray-50 p-4 rounded-xl mb-6 border border-gray-200"> <div className="flex justify-between items-start mb-2"> <div className="pr-2"><h3 className="font-bold text-lg text-orange-500">🔥 神龍降臨延長</h3><p className="text-sm text-gray-500">延長神龍噴吐金幣與無敵的時間。</p></div> <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-bold">Lv. {currentFeverLvl}/{MAX_LEVEL}</span> </div> <button onClick={() => buyUpgrade('fever')} disabled={currentFeverLvl >= MAX_LEVEL || coins < UPGRADE_COSTS[currentFeverLvl]} className={`w-full py-2 mt-2 rounded-lg font-bold transition-colors ${currentFeverLvl >= MAX_LEVEL ? 'bg-gray-300 text-gray-500' : coins < UPGRADE_COSTS[currentFeverLvl] ? 'bg-gray-200 text-gray-400' : 'bg-yellow-400 hover:bg-yellow-500 text-yellow-900 shadow-sm'}`}>{currentFeverLvl >= MAX_LEVEL ? 'MAX' : `升級花費: 💰 ${UPGRADE_COSTS[currentFeverLvl]}`}</button> </div> <button onClick={() => setCurrentView('menu')} className="w-full py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-xl shadow-md">返回首頁</button> </div> {galleryLevel !== null && ( <div className="fixed inset-0 bg-black/95 z-50 overflow-y-auto animate-fadeIn"> <button onClick={() => setGalleryLevel(null)} className="fixed top-6 right-6 text-white text-5xl font-light hover:text-red-400 transition-colors z-50 leading-none">&times;</button> <div className="min-h-screen flex flex-col items-center justify-center p-6 py-16 w-full"> <h2 className="text-4xl font-black text-white mb-2 text-center">{galleryLevel > currentLivesLvl ? '??? 神祕龍舟' : `Lv.${galleryLevel} 龍舟圖鑑`}</h2> <div className="text-blue-400 mb-8 font-bold text-lg text-center">{galleryLevel > currentLivesLvl ? '🔒 尚未解鎖 (剪影預覽)' : '✨ 已解鎖'}</div> <div className="flex flex-col gap-6 items-center w-full max-w-[400px]"> <LargeBoatPreview level={galleryLevel} assets={assets} viewType="side" isLocked={galleryLevel > currentLivesLvl} /> <LargeBoatPreview level={galleryLevel} assets={assets} viewType="top" isLocked={galleryLevel > currentLivesLvl} /> </div> <div className="flex justify-between w-full max-w-[320px] mt-10"> <button onClick={() => setGalleryLevel(Math.max(1, galleryLevel - 1))} disabled={galleryLevel <= 1} className="px-6 py-3 rounded-full font-bold text-lg bg-blue-600 text-white">◀ 上一階</button> <button onClick={() => setGalleryLevel(Math.min(MAX_LEVEL, galleryLevel + 1))} disabled={galleryLevel >= MAX_LEVEL} className="px-6 py-3 rounded-full font-bold text-lg bg-blue-600 text-white">下一階 ▶</button> </div> </div> </div> )} </div> ); }

  const targetWordObj = currentWordObj?.stages[currentStageIdx] || { word: 'ZONGZI', meaning: '粽子' };
  const totalLivesCount = 2 + currentLivesLvl;

  return (
    <div className="flex flex-col items-center bg-gray-900 font-sans touch-none w-full h-screen overflow-hidden relative" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      <div className="w-full max-w-[400px] bg-white px-3 py-2 flex items-center justify-between shadow-md z-20 shrink-0 border-b-4 border-blue-900">
          <div className={`flex flex-col transition-opacity duration-300 ${isHidingWordUI ? 'opacity-0' : 'opacity-100'}`}>
              <span className="text-[10px] text-gray-500 font-bold leading-none mb-0.5">收集單字召喚神龍</span>
              <span className="text-sm font-black text-green-700 leading-none">{targetWordObj.word} <span className="text-xs text-gray-500 font-bold">({targetWordObj.meaning})</span></span>
          </div>
          <div className={`flex gap-1 transition-opacity duration-300 ${isHidingWordUI ? 'opacity-0' : 'opacity-100'}`}>
              {targetWordObj.word.split('').map((char, index) => { const isCollected = index < collectedLetters.length; return ( <div key={index} className={`relative w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold border-2 transition-all duration-300 shadow-md ${isCollected ? 'bg-gradient-to-br from-yellow-300 to-orange-500 text-red-700 border-yellow-200 transform scale-110' : 'bg-gradient-to-br from-gray-300 to-gray-500 text-gray-700 border-gray-400'}`}> <div className="absolute top-[10%] left-[15%] w-[30%] h-[30%] bg-white rounded-full opacity-40"></div> {char} </div> ); })}
          </div>
      </div>
      {isFeverTime && <div className="absolute top-16 z-30 bg-orange-500 text-white text-xs font-black px-4 py-1 rounded-full animate-bounce shadow-lg pointer-events-none">🔥 神龍降臨！狂接金幣！ 🔥</div>}
      <div className="flex-1 w-full max-w-[400px] min-h-0 relative flex flex-col items-center justify-center p-2">
          <div className="relative w-full h-full max-h-full aspect-[2/3] bg-blue-200 rounded-xl shadow-2xl border-x-4 border-b-4 border-t border-blue-900 overflow-hidden">
              <canvas ref={canvasRef} width={400} height={600} className="w-full h-full block" />
              <div className="absolute top-0 left-0 w-full p-2 flex justify-between items-start pointer-events-none bg-gradient-to-b from-black/60 to-transparent h-20 z-10">
                  <div className="flex flex-col items-start pointer-events-auto">
                      <span className="text-[10px] text-white/80 font-bold leading-none mb-1">神龍召喚</span>
                      <span className="text-2xl font-black text-white leading-none drop-shadow-md">{summonCount}</span>
                  </div>
                  <div className="flex flex-col items-center mt-1">
                      <span className="text-xl font-bold text-yellow-300 drop-shadow-md bg-black/30 px-2 py-0.5 rounded-full backdrop-blur-sm">💰 {sessionCoins}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1 pointer-events-auto">
                      <button onClick={(e) => { e.stopPropagation(); toggleSound(); }} className="bg-black/40 hover:bg-black/60 rounded-full p-1.5 backdrop-blur-sm text-sm text-white border border-white/20"> {isAudioMuted ? '🔇' : '🔊'} </button>
                      <div className="flex text-red-500 text-[10px] gap-0.5 drop-shadow-md bg-black/40 px-1.5 py-0.5 rounded-full backdrop-blur-sm"> {Array.from({ length: totalLivesCount }).map((_, i) => ( <span key={i} className={i < lives ? 'opacity-100' : 'opacity-30 grayscale'}>❤️</span> ))} </div>
                  </div>
              </div>
              {gameOver && (
                  <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center z-20 p-4 text-center animate-fadeIn pointer-events-auto">
                      <h2 className="text-3xl font-black text-white mb-2 tracking-widest">航行結束</h2>
                      <div className="bg-white/10 p-4 rounded-xl border border-white/20 w-full max-w-[85%] mb-4 backdrop-blur-sm relative">
                          {isNewRecord && <div className="absolute -top-4 -right-2 bg-red-500 text-white text-xs font-black px-3 py-1 rounded-full animate-bounce shadow-lg border-2 border-white/50 rotate-12 z-30 tracking-widest">新紀錄!</div>}
                          <div className="text-gray-300 text-xs mb-1">本次召喚</div> <div className={`text-4xl font-black mb-3 drop-shadow-lg ${isNewRecord ? 'text-yellow-400' : 'text-blue-300'}`}>{summonCount} 次</div> <div className="h-px bg-white/20 w-full my-2"></div> <div className="flex justify-between items-center text-sm mb-1"> <span className="text-gray-300">獲得金幣</span> <span className="text-yellow-400 font-bold">+ 💰 {sessionCoins}</span> </div> <div className="flex justify-between items-center text-xs mt-2 border-t border-white/10 pt-2"> <span className="text-gray-400">歷史最多</span> <span className="text-gray-300 font-bold tracking-wider">{maxSummons} 次</span> </div>
                      </div>
                      <div className="flex flex-col gap-2 w-full max-w-[85%]"> <button onClick={(e) => { e.stopPropagation(); startGame(); }} className="w-full py-2.5 bg-green-500 hover:bg-green-400 text-white text-lg font-bold rounded-lg shadow-lg">🔄 再玩一次</button> <button onClick={(e) => { e.stopPropagation(); setCurrentView('menu'); }} className="w-full py-2.5 bg-gray-600 hover:bg-gray-500 text-white text-base font-bold rounded-lg">🏠 回到首頁</button> </div>
                  </div>
              )}
          </div>
      </div>
      <div className="shrink-0 pb-2 text-gray-500 text-[10px] text-center w-full">電腦: [←][→] 方向鍵 | 手機: 左右滑動螢幕拖曳龍舟</div>
    </div>
  );
}
