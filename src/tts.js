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

export function ttsSupported() {
  return 'speechSynthesis' in window;
}

function pickVoice() {
  const { voiceURI } = getSettings();
  if (voiceURI) {
    const exact = voices.find((v) => v.voiceURI === voiceURI);
    if (exact) return exact;
  }
  const en = englishVoices();
  return (
    en.find((v) => /en-CA/i.test(v.lang)) ||
    en.find((v) => /en-US/i.test(v.lang)) ||
    en.find((v) => /en-GB/i.test(v.lang)) ||
    en[0] ||
    null
  );
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
