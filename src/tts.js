// Text-to-speech (speak English lines) and optional speech recognition for
// practice. Both are progressive enhancements — absent on some browsers.

import { getSettings } from './store.js';

let voices = [];
function loadVoices() {
  if (!('speechSynthesis' in window)) return;
  voices = speechSynthesis.getVoices();
}
if ('speechSynthesis' in window) {
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;
}

export function englishVoices() {
  return voices.filter((v) => /^en(-|_)/i.test(v.lang));
}

// Rough quality ranking: cloud/neural voices sound far less robotic than the
// bundled desktop SAPI ones (David/Zira/eSpeak).
export function voiceScore(v) {
  const n = (v.name || '').toLowerCase();
  let s = 0;
  if (v.localService === false) s += 6; // network / cloud voice
  if (/google|natural|neural|siri|premium|enhanced|wavenet|online/.test(n)) s += 5;
  if (/en-ca/i.test(v.lang)) s += 3;
  else if (/en-us/i.test(v.lang)) s += 2;
  else if (/en-gb|en-au/i.test(v.lang)) s += 1;
  if (/david|zira|mark|hazel|desktop|espeak|compact|pico/.test(n)) s -= 4; // robotic
  if (v.default) s += 0.5;
  return s;
}

export function rankedEnglishVoices() {
  return englishVoices()
    .slice()
    .sort((a, b) => voiceScore(b) - voiceScore(a));
}

export function ttsSupported() {
  return 'speechSynthesis' in window;
}

function pickVoice() {
  const { voiceURI } = getSettings();
  if (voiceURI) {
    const exact = voices.find((v) => v.voiceURI === voiceURI);
    if (exact) return exact;
  }
  return rankedEnglishVoices()[0] || null;
}

export function speak(text) {
  if (!ttsSupported() || !text) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) u.voice = v;
    u.lang = (v && v.lang) || 'en-US';
    u.rate = getSettings().speakRate || 0.95;
    speechSynthesis.speak(u);
  } catch (e) {
    console.warn('TTS 실패', e);
  }
}

export function stopSpeaking() {
  if (ttsSupported()) speechSynthesis.cancel();
}

// ---- Speech recognition ----
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export function sttSupported() {
  return !!SR;
}

export function listenOnce({ onResult, onEnd, onError } = {}) {
  if (!SR) {
    onError && onError(new Error('이 브라우저는 음성 인식을 지원하지 않습니다.'));
    return () => {};
  }
  const rec = new SR();
  rec.lang = 'en-US';
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  let finalText = '';
  rec.onresult = (ev) => {
    let interim = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    onResult && onResult((finalText + ' ' + interim).trim(), !!finalText);
  };
  rec.onerror = (ev) => onError && onError(new Error(ev.error || '음성 인식 오류'));
  rec.onend = () => onEnd && onEnd(finalText.trim());
  try {
    rec.start();
  } catch (e) {
    onError && onError(e);
  }
  return () => {
    try { rec.stop(); } catch {}
  };
}
