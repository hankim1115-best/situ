// Heuristic pronunciation check: compare what speech recognition heard against
// the target line, word by word (LCS alignment). Not phoneme scoring — but a
// word the recognizer missed is usually a word the learner mispronounced.

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function scorePronunciation(target, heard) {
  const T = norm(target);
  const H = norm(heard);
  const n = T.length;
  const m = H.length;
  if (!n) return { score: 0, words: [], missing: [], heardEmpty: !m };

  // LCS length table
  const dp = Array.from({ length: n + 1 }, () => new Int16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = T[i] === H[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const words = [];
  const missing = [];
  let i = 0;
  let j = 0;
  while (i < n) {
    if (j < m && T[i] === H[j]) {
      words.push({ w: T[i], ok: true });
      i++;
      j++;
    } else if (j < m && dp[i + 1][j] >= dp[i][j + 1]) {
      words.push({ w: T[i], ok: false });
      missing.push(T[i]);
      i++;
    } else if (j < m) {
      j++; // heard an extra/wrong word; skip it
    } else {
      words.push({ w: T[i], ok: false });
      missing.push(T[i]);
      i++;
    }
  }

  const hits = words.filter((w) => w.ok).length;
  return { score: Math.round((hits / n) * 100), words, missing, heardEmpty: !m };
}
