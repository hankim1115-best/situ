// Direct browser call to the Claude API. The key is stored only on this device
// and sent only to api.anthropic.com.

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
} from './prompt.js';

// Every generation carries the learner profile so callers don't have to.
function withProfile(input) {
  return { ...input, profile: input.profile || getProfile() };
}

const ENDPOINT = 'https://api.anthropic.com/v1/messages';

async function callTool({ system, tool, message, maxTokens }) {
  const { apiKey, model } = getSettings();
  if (!apiKey) {
    const err = new Error('API 키가 없습니다. 설정 탭에서 먼저 입력하세요.');
    err.code = 'NO_KEY';
    throw err;
  }

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
    res = await fetch(ENDPOINT, {
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
    if (res.status === 401) throw new Error('API 키가 거부되었습니다 (401). 설정에서 키를 확인하세요.');
    if (res.status === 429) throw new Error('요청이 많습니다 (429). 잠시 후 다시 시도하세요.');
    throw new Error(`API 오류 ${res.status}: ${detail}`);
  }

  const json = await res.json();
  const toolUse = (json.content || []).find((c) => c.type === 'tool_use' && c.name === tool.name);
  if (!toolUse || !toolUse.input) {
    throw new Error('구조화된 응답을 받지 못했습니다. 다시 시도해 주세요.');
  }
  return { data: toolUse.input, usage: json.usage || null, model: json.model };
}

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

export async function testKey(apiKey) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
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
