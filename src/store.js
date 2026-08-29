// Local, offline-first state. Everything lives in localStorage on the device.

const K_CFG = 'situ.settings';
const K_SETS = 'situ.sets';
const K_DRAFT = 'situ.draft';

const DEFAULT_SETTINGS = {
  apiKey: '',
  model: 'claude-sonnet-5',
  voiceURI: '',
  speakRate: 0.95,
};

const DAY = 86400000;

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('저장 실패', e);
  }
}

const state = {
  settings: { ...DEFAULT_SETTINGS, ...read(K_CFG, {}) },
  sets: read(K_SETS, []),
  draft: read(K_DRAFT, null),
};

const subs = new Set();
export function subscribe(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}
function emit() {
  for (const fn of subs) fn(state);
}

// ---------- settings ----------
export function getSettings() {
  return state.settings;
}
export function saveSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  write(K_CFG, state.settings);
  emit();
}

// ---------- draft (last generated, not yet saved) ----------
export function getDraft() {
  return state.draft;
}
export function setDraft(draft) {
  state.draft = draft;
  write(K_DRAFT, draft);
  emit();
}
export function clearDraft() {
  state.draft = null;
  localStorage.removeItem(K_DRAFT);
  emit();
}

// ---------- sets ----------
export function getSets() {
  return state.sets;
}
export function getSet(id) {
  return state.sets.find((s) => s.id === id) || null;
}
export function addSet({ situation, pack }) {
  const id = 's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const set = {
    id,
    createdAt: Date.now(),
    title: pack.title || situation.text.slice(0, 40) || '제목 없음',
    situation,
    pack,
    srs: {},
  };
  state.sets = [set, ...state.sets];
  write(K_SETS, state.sets);
  emit();
  return set;
}
export function deleteSet(id) {
  state.sets = state.sets.filter((s) => s.id !== id);
  write(K_SETS, state.sets);
  emit();
}
export function renameSet(id, title) {
  const s = getSet(id);
  if (!s) return;
  s.title = title;
  write(K_SETS, state.sets);
  emit();
}

// ---------- spaced repetition (SM-2 lite) ----------
// grade: 0 = 모름, 1 = 애매, 2 = 잘 앎
export function gradeCard(setId, cardKey, grade) {
  const s = getSet(setId);
  if (!s) return;
  const now = Date.now();
  const c = s.srs[cardKey] || { reps: 0, interval: 0, ease: 2.3, due: now };

  if (grade === 0) {
    c.reps = 0;
    c.interval = 0;
    c.ease = Math.max(1.3, c.ease - 0.2);
    c.due = now + 10 * 60 * 1000; // 10 minutes
  } else if (grade === 1) {
    c.reps = Math.max(1, c.reps);
    c.ease = Math.max(1.3, c.ease - 0.15);
    c.interval = Math.max(1, Math.round((c.interval || 1) * 1.2));
    c.due = now + c.interval * DAY;
  } else {
    c.reps += 1;
    c.ease = Math.min(2.8, c.ease + 0.05);
    if (c.reps <= 1) c.interval = 1;
    else if (c.reps === 2) c.interval = 3;
    else c.interval = Math.round((c.interval || 3) * c.ease);
    c.due = now + c.interval * DAY;
  }
  s.srs[cardKey] = c;
  write(K_SETS, state.sets);
  emit();
}

// Flatten all reviewable cards across sets, oldest-due first.
export function collectDueCards({ setId = null, limit = 20 } = {}) {
  const now = Date.now();
  const out = [];
  for (const s of state.sets) {
    if (setId && s.id !== setId) continue;
    const push = (kind, idx, front, back, speak) => {
      const key = `${kind}:${idx}`;
      const c = s.srs[key];
      out.push({
        setId: s.id,
        setTitle: s.title,
        cardKey: key,
        due: c ? c.due : 0,
        isNew: !c,
        front,
        back,
        speak,
      });
    };
    (s.pack.keywords || []).forEach((k, i) => push('kw', i, k.term, k.ko, k.term));
    (s.pack.expressions || []).forEach((e, i) => push('expr', i, e.en, e.ko, e.en));
    (s.pack.vocab || []).forEach((v, i) => push('vocab', i, v.term, v.ko, v.term));
  }
  const dueOnly = out.filter((c) => c.isNew || c.due <= now);
  dueOnly.sort((a, b) => a.due - b.due);
  return dueOnly.slice(0, limit);
}

export function countDue(setId = null) {
  return collectDueCards({ setId, limit: 9999 }).length;
}

export function exportData() {
  return JSON.stringify({ version: 1, exportedAt: Date.now(), sets: state.sets }, null, 2);
}
export function importData(json) {
  const parsed = JSON.parse(json);
  if (!parsed || !Array.isArray(parsed.sets)) throw new Error('형식이 올바르지 않습니다.');
  const byId = new Map(state.sets.map((s) => [s.id, s]));
  for (const s of parsed.sets) if (s && s.id) byId.set(s.id, s);
  state.sets = [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
  write(K_SETS, state.sets);
  emit();
  return state.sets.length;
}
