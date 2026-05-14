import React, { useRef, useEffect, useState, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

// ==========================================
// ☁️ 專屬雲端資料庫設定
// ==========================================
const myFirebaseConfig = {
  apiKey: "AIzaSyDBGDINEB6yrmO9kn33rFfvCvwv6ToYkjc",
  authDomain: "project-4337058023593134662.firebaseapp.com",
  projectId: "project-4337058023593134662",
  storageBucket: "project-4337058023593134662.firebasestorage.app",
  messagingSenderId: "229355651540",
  appId: "1:229355651540:web:f2184f7c37875132e55641"
};

// 🌟 初始化雲端環境
let app, auth, db;
let appId = typeof __app_id !== 'undefined' ? __app_id : 'dragon-boat-game';
try {
    app = initializeApp(myFirebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
} catch (error) {
    console.warn("Firebase 初始化失敗，將使用本機暫存模式。");
}

// 🌟 翻轉設定：船 4 和船 5 朝左需要翻轉朝右
const FLIP_SIDE_BOATS = [4, 5];

// ==========================================
// 🎵 Web Audio API 即時合成音效引擎 (史詩優化版)
// ==========================================
class SynthEngine {
    constructor() {
        this.ctx = null; this.master = null; this.mode = 'menu'; 
        this.nextNoteTime = 0; this.step = 0; this.isMuted = true; this.timerID = null;
    }
    init() {
        if (this.ctx) return;
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.15; 
        this.master.connect(this.ctx.destination);
        this.nextNoteTime = this.ctx.currentTime + 0.1;
        this.scheduler();
    }
    toggleMute() {
        if (!this.ctx) this.init();
        this.isMuted = !this.isMuted;
        if (!this.isMuted && this.ctx.state === 'suspended') this.ctx.resume();
        this.master.gain.value = this.isMuted ? 0 : 0.15;
        return this.isMuted;
    }
    setMode(mode) { this.mode = mode; }
    playTone(freq, type, duration, vol = 1) {
        if (this.isMuted || !this.ctx) return;
        const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
        osc.type = type; osc.frequency.value = freq;
        osc.connect(gain); gain.connect(this.master);
        osc.start(this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.stop(this.ctx.currentTime + duration);
    }
    playDrum(time, isHeavy = false) {
        if (this.isMuted || !this.ctx) return;
        const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
        osc.connect(gain); gain.connect(this.master);
        osc.frequency.setValueAtTime(isHeavy ? 120 : 180, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.3);
        gain.gain.setValueAtTime(isHeavy ? 1.5 : 0.6, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);
        osc.start(time); osc.stop(time + 0.3);
    }
    playGuzheng(freq, time) {
        if (this.isMuted || !this.ctx) return;
        const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
        osc.type = 'triangle'; osc.frequency.value = freq;
        osc.connect(gain); gain.connect(this.master);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.6, time + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 1.5);
        osc.start(time); osc.stop(time + 1.5);
    }
    sfxCoin() { this.playTone(987.77, 'square', 0.1, 0.3); setTimeout(() => this.playTone(1318.51, 'square', 0.2, 0.3), 80); }
    sfxLetter(progress) { this.playTone(440 + (progress * 200), 'sine', 0.1, 0.6); }
    sfxHit() { this.playDrum(this.ctx ? this.ctx.currentTime : 0, true); this.playTone(50, 'sawtooth', 0.4, 0.8); }
    sfxRoar() {
        if (this.isMuted || !this.ctx) return;
        const dur = 3.5; const t = this.ctx.currentTime;
        [1, 1.25, 1.5, 2].forEach(interval => {
            const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
            osc.type = 'sawtooth'; osc.frequency.setValueAtTime(261.63 * interval, t);
            osc.frequency.exponentialRampToValueAtTime(261.63 * interval * 2.5, t + dur);
            gain.gain.setValueAtTime(0.2, t); gain.gain.exponentialRampToValueAtTime(0.01, t + dur);
            osc.connect(gain); gain.connect(this.master);
            osc.start(t); osc.stop(t + dur);
        });
    }
    scheduler() {
        if (!this.ctx) return;
        while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
            this.playStep(this.nextNoteTime);
            const tempo = this.mode === 'fever' ? 180 : (this.mode === 'game' ? 140 : 160);
            this.nextNoteTime += (60.0 / tempo) / 2;
            this.step = (this.step + 1) % 32; 
        }
        this.timerID = setTimeout(() => this.scheduler(), 25);
    }
    playStep(time) {
        if (this.isMuted || this.mode === 'stopped') return;
        if (this.step % 8 === 0) this.playDrum(time, true);
        if (this.mode === 'menu' && this.step % 4 === 0) this.playGuzheng(659.25, time);
    }
}
const audio = new SynthEngine();

// ==========================================
// ⚙️ 工具函式
// ==========================================
const speakWord = (word) => {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const ut = new SpeechSynthesisUtterance(word.toLowerCase());
        ut.lang = 'en-US'; ut.rate = 0.7; window.speechSynthesis.speak(ut);
    }
};

const STAGE_CONFIG = {
    1: { name: "寧靜水鄉", water: '#bae0ff', bank: '#95de64', line: '#91caff', speed: 4.0, obsRate: 90 },
    2: { name: "午後激流", water: '#ffd8bf', bank: '#ffa940', line: '#ff9c6e', speed: 4.5, obsRate: 70 },
    3: { name: "奇幻夜航", water: '#002766', bank: '#001529', line: '#096dd9', speed: 5.0, obsRate: 50 }
};

const WORD_LIST = [
  { fullWord: 'ZONGZI', fullMeaning: '粽子', stages: [{ word: 'ZONGZI', meaning: '粽子' }] },
  { fullWord: 'DRAGON BOAT', fullMeaning: '龍舟', stages: [{ word: 'DRAGON', meaning: '龍' }, { word: 'BOAT', meaning: '船' }] },
  { fullWord: 'SACHET', fullMeaning: '香包', stages: [{ word: 'SACHET', meaning: '香包' }] },
  { fullWord: 'RICE DUMPLING', fullMeaning: '粽子', stages: [{ word: 'RICE', meaning: '米' }, { word: 'DUMPLING', meaning: '糰子' }] },
  { fullWord: 'STICKY RICE', fullMeaning: '糯米', stages: [{ word: 'STICKY', meaning: '黏的' }, { word: 'RICE', meaning: '米' }] }
];

const UPGRADE_COSTS = [0, 100, 300, 600, 1000, 1500];
const MAX_LEVEL = 5;

const loadImage = (srcUrl) => {
    return new Promise((resolve) => {
        const img = new Image(); img.crossOrigin = "Anonymous";
        img.onload = () => resolve(img); img.onerror = () => resolve(null);
        const githubBaseUrl = "https://raw.githubusercontent.com/yao8278-create/dragon-boat-game/main/";
        img.src = githubBaseUrl + srcUrl; 
    });
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

// ==========================================
// 🎨 渲染與圖形
// ==========================================
const drawDragonBall = (ctx, x, y, radius, char, isGlowing, isStone = false, extraGlow = 0) => {
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
    if (isStone) {
        ctx.fillStyle = '#8c8c8c'; ctx.fill(); ctx.strokeStyle = '#595959'; ctx.lineWidth = 2; ctx.stroke();
        const grad = ctx.createRadialGradient(x - radius*0.3, y - radius*0.3, radius*0.1, x, y, radius);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.4)'); grad.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
        ctx.fillStyle = grad; ctx.fill();
    } else {
        if (isGlowing) { ctx.shadowBlur = radius * (1.5 + extraGlow); ctx.shadowColor = '#faad14'; }
        const grad = ctx.createRadialGradient(x - radius*0.3, y - radius*0.3, radius*0.1, x, y, radius);
        grad.addColorStop(0, '#ffec3d'); grad.addColorStop(0.5, '#fa8c16'); grad.addColorStop(1, '#ad2102');
        ctx.fillStyle = grad; ctx.fill(); ctx.strokeStyle = '#ffe58f'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.fillStyle = isStone ? '#434343' : '#820014';
    ctx.font = `900 ${radius * 1.1}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(char, x, y + radius*0.05); ctx.restore();
};

const drawGeometricBoat = (ctx, x, y, width, height, levelInput) => {
    const level = parseInt(levelInput, 10) || 1; ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = level > 1 ? '#cf1322' : '#613400';
    ctx.beginPath(); ctx.moveTo(width/2, -10); ctx.lineTo(width, 20); ctx.lineTo(width, height); ctx.lineTo(0, height); ctx.lineTo(0, 20); ctx.closePath(); ctx.fill();
    ctx.restore();
};

const getTargetAsset = (assets, name) => assets[name] || null;
const getBoatScale = (level) => ({ 1: 0.9, 2: 1.05, 3: 1.2, 4: 1.35, 5: 1.5 }[Math.min(level, 5)] || 1.0);

const BoatPreview = ({ level, assets, isLocked, onClick }) => {
    const previewCanvasRef = useRef(null);
    useEffect(() => {
        const canvas = previewCanvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#bae0ff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        const boatImg = getTargetAsset(assets, `boat${Math.min(level, 5)}_side`);
        const targetScale = getBoatScale(level); 
        ctx.save(); ctx.translate(canvas.width / 2, canvas.height / 2);
        if (boatImg) { 
            const baseW = 280, baseH = 140; 
            if (FLIP_SIDE_BOATS.includes(level)) ctx.scale(-1, 1); 
            ctx.drawImage(boatImg, -(baseW * targetScale) / 4, -(baseH * targetScale) / 4, (baseW * targetScale)/2, (baseH * targetScale)/2); 
        } else { ctx.rotate(Math.PI / 2); drawGeometricBoat(ctx, -15, -30, 30, 60, level); }
        ctx.restore();
    }, [level, assets]);
    return (
        <div className="flex flex-col items-center w-full cursor-pointer transform transition-transform hover:scale-105" onClick={() => onClick && onClick(level)}>
            <div className="relative w-full max-w-[150px]">
                <canvas ref={previewCanvasRef} width={150} height={100} className={`rounded-lg border-2 border-blue-300 ${isLocked ? 'blur-sm grayscale brightness-50' : ''}`} />
                {isLocked && <div className="absolute inset-0 flex items-center justify-center text-white text-2xl drop-shadow-lg font-black">🔒</div>}
            </div>
            <span className="text-xs mt-1 font-bold">{isLocked ? '待解鎖' : '目前'} Lv.{level}</span>
        </div>
    );
};

const LargeBoatPreview = ({ level, assets, viewType, isLocked }) => {
    const canvasRef = useRef(null);
    useEffect(() => {
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = isLocked ? '#262626' : '#bae0ff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        const boatImg = getTargetAsset(assets, `boat${Math.min(level, 5)}_${viewType}`);
        const targetScale = getBoatScale(level) * 1.5;
        ctx.save(); ctx.translate(canvas.width/2, canvas.height/2);
        if (boatImg) {
            const baseW = viewType === 'side' ? 280 : 80, baseH = viewType === 'side' ? 140 : 140;
            if (isLocked) {
                ctx.globalAlpha = 0.2; ctx.filter = 'brightness(0) invert(1)';
                if (FLIP_SIDE_BOATS.includes(level) && viewType === 'side') ctx.scale(-1, 1);
                ctx.drawImage(boatImg, -(baseW * targetScale)/2.5, -(baseH * targetScale)/2.5, (baseW * targetScale)/1.2, (baseH * targetScale)/1.2);
            } else {
                if (FLIP_SIDE_BOATS.includes(level) && viewType === 'side') ctx.scale(-1, 1);
                ctx.drawImage(boatImg, -(baseW * targetScale)/2.5, -(baseH * targetScale)/2.5, (baseW * targetScale)/1.2, (baseH * targetScale)/1.2);
            }
        }
        ctx.restore();
        if (isLocked) { ctx.fillStyle = "white"; ctx.font = "bold 60px sans-serif"; ctx.textAlign = "center"; ctx.fillText("?", canvas.width/2, canvas.height/2 + 20); }
    }, [level, assets, viewType, isLocked]);
    return <canvas ref={canvasRef} width={300} height={200} className="rounded-xl border-4 border-white shadow-2xl block" />;
};

// ==========================================
// 🚀 遊戲主組件
// ==========================================
export default function App() {
  const canvasRef = useRef(null);
  const [currentView, setCurrentView] = useState('loading');
  const [assets, setAssets] = useState({});
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState("正在讀取遊戲資源...");
  const [isAudioMuted, setIsAudioMuted] = useState(true);
  const [galleryLevel, setGalleryLevel] = useState(null);

  const [playerName, setPlayerName] = useState('');
  const [inputName, setInputName] = useState(() => safeGetStorage('last_login_name', '', false));

  const [coins, setCoins] = useState(0);
  const [upgrades, setUpgrades] = useState({ lives: 1, fever: 1 });
  const [maxSummons, setMaxSummons] = useState(0);
  
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [user, setUser] = useState(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isHidingWordUI, setIsHidingWordUI] = useState(false); 

  const lastTimeRef = useRef(performance.now());
  const requestRef = useRef();
  const wordBagRef = useRef([]);

  useEffect(() => {
      const unlockAudio = () => {
          if (!audio.ctx) { audio.init(); audio.isMuted = false; audio.master.gain.value = 0.15; setIsAudioMuted(false); } 
          else if (audio.ctx.state === 'suspended') audio.ctx.resume();
          window.removeEventListener('click', unlockAudio); window.removeEventListener('touchstart', unlockAudio);
      };
      window.addEventListener('click', unlockAudio); window.addEventListener('touchstart', unlockAudio);
      return () => { window.removeEventListener('click', unlockAudio); window.removeEventListener('touchstart', unlockAudio); };
  }, []);

  // Firebase Auth
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

  // Firebase Data Sync (核心邏輯：用 playerName 作為 ID)
  useEffect(() => {
      if (!user || !db || !playerName) return;
      const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'playerSaves', playerName);
      const unsubscribe = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
              const data = docSnap.data();
              if (data.coins !== undefined) setCoins(data.coins);
              if (data.upgrades !== undefined) setUpgrades(data.upgrades);
              if (data.maxSummons !== undefined) setMaxSummons(data.maxSummons);
          } else { setCoins(0); setUpgrades({ lives: 1, fever: 1 }); setMaxSummons(0); }
          setIsDataLoaded(true); 
      }, (error) => { setIsDataLoaded(true); });
      return () => unsubscribe();
  }, [user, db, playerName]);

  // Firebase Data Save
  useEffect(() => {
      if (!isDataLoaded || !playerName) return; 
      const saveData = async () => {
          if (auth && db && user) {
              try { 
                  const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'playerSaves', playerName); 
                  await setDoc(userRef, { coins, upgrades, maxSummons }, { merge: true }); 
              } catch(e) {}
          } else {
              safeSetStorage(`db_coins_${playerName}`, coins, false); 
              safeSetStorage(`db_upgrades_${playerName}`, upgrades, true); 
              safeSetStorage(`db_max_summons_${playerName}`, maxSummons, false);
          }
      };
      saveData();
  }, [coins, upgrades, maxSummons, isDataLoaded, user, db, playerName]);

  const handleLogin = (name) => {
      const trimmed = name.trim().replace(/[\/\\]/g, '_');
      if (!trimmed) return;
      setIsDataLoaded(false); setPlayerName(trimmed); safeSetStorage('last_login_name', trimmed, false);
      if (!db) {
          setCoins(safeGetStorage(`db_coins_${trimmed}`, 0, false));
          setUpgrades(safeGetStorage(`db_upgrades_${trimmed}`, { lives: 1, fever: 1 }, true));
          setMaxSummons(safeGetStorage(`db_max_summons_${trimmed}`, 0, false));
          setIsDataLoaded(true);
      }
      setCurrentView('menu');
  };

  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [summonCount, setSummonCount] = useState(0);
  const [sessionCoins, setSessionCoins] = useState(0);
  const [lives, setLives] = useState(3);
  const [currentWordObj, setCurrentWordObj] = useState(WORD_LIST[0]);
  const [currentStageIdx, setCurrentStageIdx] = useState(0);
  const [collectedLetters, setCollectedLetters] = useState([]);
  const [isFeverTime, setIsFeverTime] = useState(false);

  const gameState = useRef({
    frames: 0, speed: 4, items: [], obstacles: [], effects: [], 
    player: { x: 180, y: 500, width: 40, height: 80, dx: 0, isInvincible: false, invincibleTimer: 0 },
    feverTimer: 0, wordIntroTimer: 0, summonTimer: 0, baseSpeed: 4, sessionCoinsRef: 0,
    currentStage: 1, completedWordsCount: 0, speedMultiplier: 1.0, isGreatSummon: false,
    canvasWidth: 400, canvasHeight: 600
  });

  const getNextWord = useCallback(() => {
      if (wordBagRef.current.length === 0) wordBagRef.current = [...WORD_LIST].sort(() => Math.random() - 0.5);
      return wordBagRef.current.pop();
  }, []);

  const toggleSound = () => { const muted = audio.toggleMute(); setIsAudioMuted(muted); };

  useEffect(() => {
      const initAssets = async () => {
          let loadedAssets = {};
          const list = [
              'boat1_side', 'boat1_top', 'boat2_side', 'boat2_top', 'boat3_side', 'boat3_top', 
              'boat4_side', 'boat4_top', 'boat5_side', 'boat5_top', 'dragon', 'fish', 
              'whirlpool', 'ghost_ship', 'zongzi', 'coin'
          ];
          for (let i = 0; i < list.length; i++) {
              const img = await loadImage(`${list[i]}.png`);
              if (img) loadedAssets[list[i]] = img;
              setLoadingProgress(Math.floor(((i + 1) / list.length) * 100));
          }
          setAssets(loadedAssets); setCurrentView('login');
      };
      initAssets();
  }, []);

  const buyUpgrade = (type) => {
      const curLvl = upgrades[type] || 1; if (curLvl >= MAX_LEVEL) return;
      const cost = UPGRADE_COSTS[curLvl];
      if (coins >= cost) { setCoins(c => c - cost); setUpgrades(prev => ({ ...prev, [type]: curLvl + 1 })); }
  };

  const startGame = () => {
    const ml = 2 + (upgrades.lives || 1); 
    const speedMult = window.innerWidth <= 768 ? 0.6 : 1.0;
    setCurrentView('game'); setIsPlaying(true); setGameOver(false); setSessionCoins(0); setLives(ml); setSummonCount(0); setCollectedLetters([]); setIsFeverTime(false); setIsHidingWordUI(true); 
    const nextWord = getNextWord(); setCurrentWordObj(nextWord); setCurrentStageIdx(0);
    gameState.current = { ...gameState.current, frames: 0, items: [], obstacles: [], effects: [], introTimer: 260, wordIntroTimer: 0, summonTimer: 0, sessionCoinsRef: 0, currentStage: 1, completedWordsCount: 0, speedMultiplier: speedMult, speed: STAGE_CONFIG[1].speed * speedMult, baseSpeed: STAGE_CONFIG[1].speed * speedMult, player: { x: 180, y: 480, width: 40, height: 80, dx: 0, isInvincible: false, invincibleTimer: 0 } };
    lastTimeRef.current = performance.now(); 
  };

  const endGame = useCallback(() => {
    setIsPlaying(false); setGameOver(true); setCoins(c => c + gameState.current.sessionCoinsRef); audio.setMode('menu');
    if (gameState.current.completedWordsCount > maxSummons) { setIsNewRecord(true); setMaxSummons(gameState.current.completedWordsCount); }
  }, [maxSummons]);

  const handleCollectedLetter = (char, targetWord) => {
    setCollectedLetters(prev => {
      const nextIndex = prev.length;
      if (nextIndex < targetWord.length && char === targetWord[nextIndex]) {
        const newCollected = [...prev, char]; audio.sfxLetter(newCollected.length / targetWord.length);
        if (newCollected.length === targetWord.length) {
          gameState.current.completedWordsCount++; setSummonCount(gameState.current.completedWordsCount);
          gameState.current.summonTimer = 260; gameState.current.obstacles = [];
          gameState.current.isGreatSummon = (currentStageIdx === currentWordObj.stages.length - 1);
          setIsHidingWordUI(true); audio.setMode('stopped');
        }
        return newCollected;
      }
      return prev;
    });
  };

  const gameLoop = useCallback((currentTime) => {
    if (!isPlaying || gameOver) return;
    const dt = (currentTime - lastTimeRef.current) / (1000 / 60);
    lastTimeRef.current = currentTime;
    const sDt = Math.min(dt, 2.5); // 🌟 Delta Time 同步硬體速度

    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); const s = gameState.current; ctx.clearRect(0, 0, 400, 600);
    const stageConfig = STAGE_CONFIG[s.currentStage];
    const isAnimationPaused = s.wordIntroTimer > 0 || s.summonTimer > 0;

    ctx.fillStyle = isFeverTime ? '#fffbe6' : stageConfig.water; ctx.fillRect(0, 0, 400, 600);
    
    // 🌟 1. 開場動畫 (放大的 200% 側面龍舟)
    if (s.introTimer > 0) {
        s.introTimer -= sDt; const p = 1 - (s.introTimer / 260);
        if (p < 0.7) {
            const sideImg = assets[`boat${upgrades.lives}_side`]; const xPos = -400 + (p / 0.7) * 1200; ctx.save(); ctx.translate(xPos, 300);
            if (sideImg) { 
                const bW = 280, bH = 140; if (FLIP_SIDE_BOATS.includes(upgrades.lives)) ctx.scale(-1, 1); 
                ctx.drawImage(sideImg, -bW/2, -bH/2, bW, bH); 
            }
            ctx.restore(); ctx.fillStyle = 'white'; ctx.font = 'bold 30px Arial'; ctx.textAlign = 'center'; ctx.fillText(`Lv.${upgrades.lives} 龍舟出發！`, 200, 180);
        } else {
            const p2 = (p - 0.7) / 0.3; s.player.y = 650 - p2 * (state.canvasHeight - 480 + 170); s.player.x = 180;
            const topImg = assets[`boat${upgrades.lives}_top`]; if (topImg) ctx.drawImage(topImg, 180-45, s.player.y-45, 90, 90);
        }
        if (s.introTimer <= 1) s.wordIntroTimer = 150; requestRef.current = requestAnimationFrame(gameLoop); return;
    }

    // 🌟 2. 玩家控制 (dt 同步)
    if (!isAnimationPaused) { 
        s.player.x += s.player.dx * sDt; 
        s.player.x = Math.max(25, Math.min(335, s.player.x)); 
    }
    if (s.player.isInvincible && !isAnimationPaused) { 
        s.player.invincibleTimer -= sDt; if (s.player.invincibleTimer <= 0) s.player.isInvincible = false; 
    }
    if (!s.player.isInvincible || Math.floor(s.player.invincibleTimer / 5) % 2 === 0) {
        const topImg = assets[`boat${upgrades.lives}_top`];
        if (topImg) { ctx.save(); ctx.translate(s.player.x + 20, s.player.y + 40); ctx.drawImage(topImg, -45, -45, 90, 90); ctx.restore(); }
        else drawGeometricBoat(ctx, s.player.x, s.player.y, 40, 80, upgrades.lives);
    }

    // 🌟 3. Fever Time
    if (isFeverTime) {
        if (!isAnimationPaused) s.feverTimer -= sDt;
        const hY = Math.sin(s.frames * 0.1) * 5;
        if (assets.dragon) ctx.drawImage(assets.dragon, 125, 20 + hY, 150, 150);
        if (s.feverTimer <= 0) { setIsFeverTime(false); s.speed = s.baseSpeed; s.wordIntroTimer = 150; audio.setMode('game'); }
    }

    // 🌟 4. 生成與渲染：選項 A (繩子綁粽子)
    const targetWord = currentWordObj.stages[currentStageIdx].word;
    if (!isAnimationPaused && s.frames % Math.floor(70/sDt) === 0) {
        let type = Math.random() > 0.3 ? 'letter' : 'coin'; if (isFeverTime) type = 'coin';
        s.items.push({ x: Math.random()*300+50, y: -100, char: targetWord[collectedLetters.length] || 'X', type });
    }
    if (!isAnimationPaused && !isFeverTime && s.frames % Math.floor(stageConfig.obsRate/sDt) === 0) {
        s.obstacles.push({ x: Math.random()*300+50, y: -50, type: 'rock' });
    }

    for (let i = s.items.length - 1; i >= 0; i--) {
        const item = s.items[i]; if (!isAnimationPaused) item.y += s.speed * sDt;
        if (item.type === 'coin') {
            if (assets.coin) ctx.drawImage(assets.coin, item.x-20, item.y-20, 40, 40);
        } else {
            const hY = Math.sin(s.frames * 0.15) * 4; const orbY = item.y - 45 + hY;
            ctx.save(); ctx.beginPath(); ctx.moveTo(item.x, orbY); ctx.lineTo(item.x, item.y + 5);
            ctx.strokeStyle = '#d48806'; ctx.setLineDash([4, 2]); ctx.stroke(); ctx.restore();
            if (assets.zongzi) ctx.drawImage(assets.zongzi, item.x-20, item.y-20, 40, 40);
            drawDragonBall(ctx, item.x, orbY, 22, item.char, true, false);
        }
        // 選項 A 碰撞：只檢查底部 40x40 (粽子區)
        if (!isAnimationPaused && checkCollision(s.player, { x: item.x-20, y: item.y-20, width: 40, height: 40 })) {
            if (item.type === 'letter') {
                if (item.char === targetWord[collectedLetters.length]) handleCollectedLetter(item.char, targetWord);
                else s.effects.push({ type: 'letter_ascend', char: item.char, x: item.x, y: item.y-45, frames: 0, maxFrames: 45 });
            } else { s.sessionCoinsRef++; setSessionCoins(s.sessionCoinsRef); audio.sfxCoin(); }
            s.items.splice(i, 1);
        } else if (item.y > 650) s.items.splice(i, 1);
    }

    // 🌟 5. 障礙物
    for (let i = s.obstacles.length - 1; i >= 0; i--) {
        const obs = s.obstacles[i]; if (!isAnimationPaused) obs.y += s.speed * sDt;
        ctx.fillStyle = '#595959'; ctx.fillRect(obs.x-20, obs.y-20, 40, 40);
        if (!isAnimationPaused && !s.player.isInvincible && !isFeverTime && checkCollision(s.player, { x: obs.x-20, y: obs.y-20, width: 40, height: 40 })) {
            audio.sfxHit(); setLives(l => { if (l <= 1) endGame(); return l - 1; });
            s.player.isInvincible = true; s.player.invincibleTimer = 90; s.obstacles.splice(i, 1);
        } else if (obs.y > 650) s.obstacles.splice(i, 1);
    }

    // 🌟 6. 史詩召喚動畫 (修正光束空隙、直線緊貼排列)
    if (s.summonTimer > 0) {
        s.summonTimer -= sDt; const t = s.summonTimer; ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0,0,400,600);
        const cx = 200, cy = s.player.y - 120;
        const isSingleRow = !s.isGreatSummon || currentWordObj.stages.length === 1;

        // A. 光柱 (背後層，延伸到龍珠中心)
        if (t <= 140 && t > 0) {
            const bAlpha = Math.min(1, t / 30); ctx.save(); ctx.globalAlpha = bAlpha;
            const bW = s.isGreatSummon ? 160 : 120;
            const grad = ctx.createLinearGradient(cx - bW/2, 0, cx + bW/2, 0); 
            grad.addColorStop(0, 'rgba(255,255,255,0)'); grad.addColorStop(0.5, 'white'); grad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = grad;
            const beamBottom = isSingleRow ? cy + 120 : cy + 140; 
            ctx.fillRect(cx - (bW/2) * Math.min(1, (140-t)/20), 0, bW * Math.min(1, (140-t)/20), beamBottom); 
            ctx.restore();
        }

        // B. 神龍 (中層)
        if (t <= 130) {
            let dY, sc; if (t > 70) { const p = (130-t)/60; sc = 0.5+p*1.5; dY = cy+20-p*80; }
            else if (t > 40) { sc = 2.0; dY = cy-60; }
            else { const p = (40-t)/40; sc = 2.0-p*0.5; dY = (cy-60)-p*(cy-90); }
            if (assets.dragon) { ctx.save(); ctx.translate(cx, dY); ctx.scale(sc, sc); ctx.drawImage(assets.dragon, -75, -75, 150, 150); ctx.restore(); }
        }

        // C. 龍珠陣法 (前層，直線緊貼)
        const isG = t <= 200; const n = targetWord.length; const stX = cx - (n * 40) / 2 + 20;
        if (isSingleRow) {
            for (let i = 0; i < n; i++) {
                let x = stX + i * 40, y = cy + 120;
                if (t > 200) { const p = (260 - t) / 60; const uiX = 400 - 20 - (n - 1 - i) * 32 - 14, uiY = 30; x = uiX + p * (x - uiX); y = uiY + p * (y - uiY); }
                let gl = 0; if (isG) { if (t > 140) gl = Math.pow(1-((t-140)/60), 4)*35; else gl = 1.2; }
                drawDragonBall(ctx, x, y, 20, targetWord[i], isG, false, gl);
            }
        } else {
            let pw = ""; for (let ss = 0; ss < currentStageIdx; ss++) pw += currentWordObj.stages[ss].word;
            const n1 = pw.length; const stX1 = cx - (n1 * 40) / 2 + 20;
            for(let i = 0; i < n1; i++) { drawDragonBall(ctx, stX1 + i * 40, cy + 90, 20, pw[i], isG, false, isG?1:0); }
            for(let i = 0; i < n; i++) {
                let x = stX + i * 40, y = cy + 140;
                if (t > 200) { const p = (260 - t) / 60; const uiX = 400 - 20 - (n - 1 - i) * 32 - 14, uiY = 30; x = uiX + p * (x - uiX); y = uiY + p * (y - uiY); }
                drawDragonBall(ctx, x, y, 20, targetWord[i], isG, false, isG?1:0);
            }
        }

        // D. 全螢幕白光爆發
        if (t <= 145 && t > 130) {
            ctx.save(); ctx.globalAlpha = Math.min(1, (145-t)/8); ctx.fillStyle = 'white'; ctx.fillRect(0,0,400,600); ctx.restore();
            if (Math.abs(t-140) < 1) audio.sfxRoar();
        }

        if (t <= 0) { 
            setIsFeverTime(true); s.feverTimer = (10 + (upgrades.fever-1)*2)*60; s.speed = 15 * s.speedMultiplier; setCollectedLetters([]); audio.setMode('fever');
            if (s.isGreatSummon) { setCurrentWordObj(getNextWord()); setCurrentStageIdx(0); } else setCurrentStageIdx(p => p+1); 
        }
    }

    // 🌟 7. 單字介紹
    if (s.wordIntroTimer > 0) {
        s.wordIntroTimer -= sDt; const t = s.wordIntroTimer; ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0,0,400,600);
        if (Math.abs(t-120) < 1) speakWord(currentWordObj.stages[currentStageIdx].word);
        const n = targetWord.length; for(let i=0; i<n; i++) drawDragonBall(ctx, 200-(n*25)+i*50+25, 250, 22, targetWord[i], false, true);
        ctx.fillStyle = 'white'; ctx.font = 'bold 36px Arial'; ctx.textAlign = 'center'; ctx.fillText(currentWordObj.stages[currentStageIdx].meaning, 200, 320);
        if (t <= 1) setIsHidingWordUI(false);
    }

    s.frames++; requestRef.current = requestAnimationFrame(gameLoop);
  }, [isPlaying, gameOver, isFeverTime, collectedLetters, currentWordObj, upgrades, assets, getNextWord]);

  useEffect(() => { if (isPlaying) requestRef.current = requestAnimationFrame(gameLoop); return () => cancelAnimationFrame(requestRef.current); }, [isPlaying, gameLoop]);

  const touchRef = useRef({ lastX: null });
  const handleTouchStart = (e) => { if (isAnimationPaused) return; touchRef.current.lastX = e.touches[0].clientX; };
  const handleTouchMove = (e) => {
      if (!isPlaying || touchRef.current.lastX === null) return;
      const dx = e.touches[0].clientX - touchRef.current.lastX;
      gameState.current.player.x += dx * 1.5; touchRef.current.lastX = e.touches[0].clientX;
  };
  const handleTouchEnd = () => { touchRef.current.lastX = null; };

  if (currentView === 'loading') return <div className="h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6 text-center animate-pulse"><h1 className="text-3xl font-black mb-4 text-blue-300">極速載入中...</h1><div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{width:`${loadingProgress}%`}}></div></div><p className="mt-2 text-blue-400 font-bold">{loadingStatus}</p></div>;

  if (currentView === 'login') return (
    <div className="h-screen bg-blue-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-[400px] text-center">
            <h1 className="text-3xl font-black text-blue-900 mb-2">龍舟通行證</h1>
            <p className="text-gray-400 text-sm mb-6">輸入名號，跨設備同步您的長征紀錄！</p>
            <input type="text" value={inputName} onChange={e => setInputName(e.target.value)} placeholder="例如: 阿龍" className="w-full border-2 border-blue-200 rounded-xl p-4 mb-6 text-center text-xl font-bold text-gray-700 focus:outline-none focus:border-blue-500 shadow-inner" maxLength={15} onKeyDown={e => e.key === 'Enter' && handleLogin(inputName)} />
            <button onClick={() => handleLogin(inputName)} disabled={!inputName.trim()} className={`w-full py-4 text-white text-xl font-bold rounded-xl shadow-md transition-all ${inputName.trim() ? 'bg-blue-500 hover:bg-blue-600 scale-105' : 'bg-gray-300'}`}>確認登入</button>
        </div>
    </div>
  );

  return (
    <div className="h-screen bg-gray-900 flex flex-col items-center overflow-hidden font-sans touch-none" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      <div className={`w-full max-w-[400px] bg-white p-2 flex justify-between items-center shadow-xl z-10 transition-opacity ${isHidingWordUI ? 'opacity-0' : 'opacity-100'}`}>
          <div className="flex flex-col"><span className="text-[10px] text-gray-500 font-bold leading-none">召喚目標</span><span className="font-black text-green-700 leading-none">{currentWordObj.stages[currentStageIdx].word} ({currentWordObj.stages[currentStageIdx].meaning})</span></div>
          <div className="flex gap-1"> {currentWordObj.stages[currentStageIdx].word.split('').map((c, i) => <div key={i} className={`w-7 h-7 rounded-full flex items-center justify-center font-bold border-2 transition-all ${i < collectedLetters.length ? 'bg-orange-500 border-yellow-300 text-white scale-110' : 'bg-gray-200 text-gray-300'}`}>{c}</div>)} </div>
      </div>
      <div className="flex-1 relative w-full max-w-[400px] bg-blue-200 shadow-2xl">
          <canvas ref={canvasRef} width={400} height={600} className="w-full h-full block" />
          <div className="absolute top-4 left-4 flex flex-col"><span className="text-[10px] text-white/70 font-bold">歷史最高</span><span className="text-2xl font-black text-white drop-shadow-md">{maxSummons} 次</span></div>
          <div className="absolute top-4 right-4 bg-yellow-500/90 px-4 py-1 rounded-full text-black font-black shadow-lg">💰 {coins}</div>
          <button onClick={toggleSound} className="absolute top-16 right-4 bg-black/30 p-2 rounded-full text-white text-xl shadow-md">{isAudioMuted ? '🔇' : '🔊'}</button>
          
          {currentView === 'menu' && (
              <div className="absolute inset-0 bg-blue-900/95 flex flex-col items-center justify-center p-8 text-center animate-fadeIn z-20">
                  <div className="text-6xl mb-4 animate-bounce">🛶</div>
                  <h1 className="text-4xl font-black text-white mb-2">端午龍舟長征</h1>
                  <p className="text-blue-400 font-bold text-sm mb-8">當前船長：{playerName} <button onClick={() => setCurrentView('login')} className="text-white/40 underline ml-2 text-xs">切換</button></p>
                  <button onClick={startGame} className="w-full py-5 bg-green-500 hover:bg-green-400 text-white text-2xl font-black rounded-2xl shadow-2xl mb-4 transform transition hover:scale-105">▶ 開始長征</button>
                  <button onClick={() => setCurrentView('shop')} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white text-xl font-bold rounded-2xl transition hover:scale-105">🛠️ 龍舟改造廠</button>
              </div>
          )}
          
          {currentView === 'shop' && (
              <div className="absolute inset-0 bg-gray-50 flex flex-col p-6 z-20 overflow-y-auto">
                  <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-4">🛠️ 改造廠 - 資金: 💰 {coins}</h2>
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-4 text-center">
                    <h3 className="font-bold text-red-600 mb-4">❤️ 船體強化 (Lv.{upgrades.lives})</h3>
                    <BoatPreview level={upgrades.lives} assets={assets} isLocked={false} onClick={setGalleryLevel} />
                    {upgrades.lives < 5 && ( <><div className="text-xl text-gray-300 my-2">▼</div><BoatPreview level={upgrades.lives+1} assets={assets} isLocked={true} onClick={setGalleryLevel} /></> )}
                    <button onClick={() => buyUpgrade('lives')} className="w-full py-3 mt-4 bg-yellow-400 rounded-xl font-bold shadow-md">升級: 💰 {UPGRADE_COSTS[upgrades.lives] || 'MAX'}</button>
                  </div>
                  <button onClick={() => setCurrentView('menu')} className="w-full py-3 bg-gray-600 text-white font-bold rounded-xl mt-auto">返回首頁</button>
              </div>
          )}

          {galleryLevel && (
              <div className="absolute inset-0 bg-black/95 z-40 flex flex-col items-center justify-center p-6 animate-fadeIn" onClick={() => setGalleryLevel(null)}>
                  <h2 className="text-white text-2xl font-black mb-8">Lv.{galleryLevel} 龍舟圖鑑</h2>
                  <LargeBoatPreview level={galleryLevel} assets={assets} viewType="side" isLocked={galleryLevel > upgrades.lives} />
                  <div className="h-4"></div>
                  <LargeBoatPreview level={galleryLevel} assets={assets} viewType="top" isLocked={galleryLevel > upgrades.lives} />
                  <p className="text-gray-500 mt-8 text-sm">點擊任意處返回</p>
              </div>
          )}
          
          {gameOver && (
              <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-8 text-center z-50">
                  <h2 className="text-4xl font-black text-red-500 mb-4 tracking-tighter">航行結束</h2>
                  <div className="bg-white/10 p-6 rounded-2xl w-full mb-6 border border-white/10">
                      {isNewRecord && <div className="text-yellow-400 font-bold animate-bounce mb-2">✨ 新紀錄！ ✨</div>}
                      <div className="text-gray-400 text-sm">成功召喚</div><div className="text-4xl font-black text-white">{summonCount} 次</div>
                      <div className="text-gray-400 text-sm mt-4">賺取金幣</div><div className="text-2xl font-black text-yellow-400">+ 💰 {sessionCoins}</div>
                  </div>
                  <button onClick={startGame} className="w-full py-4 bg-green-500 text-white font-black rounded-xl mb-3 shadow-lg">🔄 再來一次</button>
                  <button onClick={() => setCurrentView('menu')} className="w-full py-3 bg-gray-600 text-white font-bold rounded-xl shadow-md">🏠 回首頁</button>
              </div>
          )}
      </div>
      <div className="shrink-0 pb-1 text-gray-500 text-[10px]">電腦: [←][→] | 手機: 左右滑動螢幕拖曳</div>
    </div>
  );
}
