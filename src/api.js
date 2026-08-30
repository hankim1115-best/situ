// Generation calls. Runs entirely in the browser; the API key is stored only on
// this device and sent only to the chosen provider (Anthropic or Groq).

import { getSettings, getProfile } from './store.js';
import {
  SYSTEM,
  TOOL,
  buildUserMessage,
  KEYWORDS_SYSTEM,
  KEYWORDS_TOOL,
  buildKeywordsMessage,
  CONVERSE_SYSTEM,
  CONVERSE_TOOL,
  DEBRIEF_TOOL,
  buildConverseMessage,
  buildDebriefMessage,
  POLISH_SYSTEM,
  POLISH_TOOL,
  buildPolishMessage,
} from './prompt.js';

// Every generation carries the learner profile so callers don't have to.
function withProfile(input) {
  return { ...input, profile: input.profile || getProfile() };
}

const CLAUDE_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

function noKey(msg) {
  const err = new Error(msg);
  err.code = 'NO_KEY';
  return err;
}

// ---------- Claude (Anthropic) ----------
async function callClaude({ system, tool, message, maxTokens }) {
  const { apiKey, model } = getSettings();
  if (!apiKey) throw noKey('Claude API 키가 없습니다. 설정 탭에서 먼저 입력하세요.');

  const body = {
    model: model || 'claude-sonnet-5',
    max_tokens: maxTokens,
    system,
    tools: [tool],
    tool_choice: { type: 'tool', name: tool.name },
    messages: [{ role: 'user', content: message }],
  };

  let res;
  try {
    res = await fetch(CLAUDE_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error('네트워크 오류: 연결을 확인하세요. (' + e.message + ')');
  }

  if (!res.ok) {
    let detail = '';
    try {
      const j = await res.json();
      detail = j?.error?.message || JSON.stringify(j);
    } catch {
      detail = await res.text().catch(() => '');
    }
    if (res.status === 401) throw new Error('Claude API 키가 거부되었습니다 (401). 설정에서 키를 확인하세요.');
    if (res.status === 429) throw new Error('요청이 많습니다 (429). 잠시 후 다시 시도하세요.');
    throw new Error(`Claude API 오류 ${res.status}: ${detail}`);
  }

  const json = await res.json();
  const toolUse = (json.content || []).find((c) => c.type === 'tool_use' && c.name === tool.name);
  if (!toolUse || !toolUse.input) throw new Error('구조화된 응답을 받지 못했습니다. 다시 시도해 주세요.');
  return { data: toolUse.input, usage: json.usage || null, model: json.model };
}

// ---------- Groq (OpenAI-compatible, free tier) ----------
function schemaHint(tool) {
  return (
    '반드시 아래 JSON 스키마에 정확히 맞는 JSON 객체 하나로만 응답하세요. ' +
    '설명 문장이나 마크다운 코드펜스 없이 JSON만. 필드명은 스키마 그대로 사용하세요.\n' +
    JSON.stringify(tool.input_schema)
  );
}

function extractJson(text) {
  if (!text || !text.trim()) throw new Error('빈 응답');
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  if (t[0] !== '{') {
    const a = t.indexOf('{');
    const b = t.lastIndexOf('}');
    if (a !== -1 && b !== -1 && b > a) t = t.slice(a, b + 1);
  }
  return JSON.parse(t);
}

async function callGroq({ system, tool, message, maxTokens }) {
  const { groqApiKey, groqModel } = getSettings();
  if (!groqApiKey) throw noKey('Groq API 키가 없습니다. 설정 탭에서 입력하세요.');

  const body = {
    model: groqModel || 'llama-3.3-70b-versatile',
    max_tokens: maxTokens,
    temperature: 0.6,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system + '\n\n' + schemaHint(tool) },
      { role: 'user', content: message },
    ],
  };

  let res;
  try {
    res = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + groqApiKey },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error('Groq 연결에 실패했어요 (네트워크 또는 CORS 차단일 수 있음): ' + e.message);
  }

  if (!res.ok) {
    let detail = '';
    try {
      const j = await res.json();
      detail = j?.error?.message || JSON.stringify(j);
    } catch {
      detail = await res.text().catch(() => '');
    }
    if (res.status === 401) throw new Error('Groq API 키가 거부되었습니다 (401). 설정에서 키를 확인하세요.');
    if (res.status === 429) throw new Error('Groq 요청 한도를 넘었어요 (429). 잠시 후 다시 시도하세요.');
    if (res.status === 400 && /model/i.test(detail)) throw new Error('Groq 모델 이름을 확인하세요: ' + detail);
    throw new Error(`Groq 오류 ${res.status}: ${detail}`);
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  let data;
  try {
    data = extractJson(content);
  } catch {
    throw new Error('Groq 응답을 JSON으로 해석하지 못했어요. 다시 시도하거나 다른 모델을 선택해 보세요.');
  }
  return { data, usage: json.usage || null, model: json.model || groqModel };
}

// ---------- dispatch ----------
async function callTool(args) {
  return getSettings().provider === 'groq' ? callGroq(args) : callClaude(args);
}

// ---------- public generation functions ----------
export async function generatePack(input) {
  const { data, usage, model } = await callTool({
    system: SYSTEM,
    tool: TOOL,
    message: buildUserMessage(withProfile(input)),
    maxTokens: 4500,
  });
  return { pack: data, usage, model };
}

export async function generateKeywords(input) {
  const { data, usage, model } = await callTool({
    system: KEYWORDS_SYSTEM,
    tool: KEYWORDS_TOOL,
    message: buildKeywordsMessage(withProfile(input)),
    maxTokens: 2200,
  });
  return { keywords: data.keywords || [], title: data.title || '', note: data.note || '', usage, model };
}

export async function converseTurn(args) {
  const { data, usage } = await callTool({
    system: CONVERSE_SYSTEM,
    tool: CONVERSE_TOOL,
    message: buildConverseMessage({ ...args, profile: args.profile || getProfile() }),
    maxTokens: 1200,
  });
  return { turn: data, usage };
}

export async function debriefConversation(args) {
  const { data } = await callTool({
    system: CONVERSE_SYSTEM,
    tool: DEBRIEF_TOOL,
    message: buildDebriefMessage({ ...args, profile: args.profile || getProfile() }),
    maxTokens: 1400,
  });
  return data;
}

export async function polishUtterance(input) {
  const { data } = await callTool({
    system: POLISH_SYSTEM,
    tool: POLISH_TOOL,
    message: buildPolishMessage(withProfile(input)),
    maxTokens: 1500,
  });
  return data;
}

// ---------- key tests ----------
export async function testKey(key, provider = 'claude') {
  if (provider === 'groq') {
    const { groqModel } = getSettings();
    const res = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
      body: JSON.stringify({
        model: groqModel || 'llama-3.3-70b-versatile',
        max_tokens: 4,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    });
    if (res.ok) return true;
    const j = await res.json().catch(() => ({}));
    throw new Error(j?.error?.message || `HTTP ${res.status}`);
  }
  const res = await fetch(CLAUDE_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8,
      messages: [{ role: 'user', content: 'ping' }],
    }),
  });
  if (res.ok) return true;
  const j = await res.json().catch(() => ({}));
  throw new Error(j?.error?.message || `HTTP ${res.status}`);
}
