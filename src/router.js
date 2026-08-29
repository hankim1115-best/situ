// Minimal hash router with :params and ?query.

const routes = [];

export function route(pattern, handler) {
  routes.push({ parts: pattern.split('/').filter(Boolean), handler });
}

export function navigate(path) {
  const target = path.startsWith('#') ? path : '#' + path;
  if (location.hash === target) resolve();
  else location.hash = target;
}

export function currentPath() {
  return location.hash.slice(1) || '/';
}

function resolve() {
  const raw = currentPath();
  const qIdx = raw.indexOf('?');
  const pathPart = qIdx === -1 ? raw : raw.slice(0, qIdx);
  const queryPart = qIdx === -1 ? '' : raw.slice(qIdx + 1);
  const segs = pathPart.split('/').filter(Boolean);

  for (const r of routes) {
    if (r.parts.length !== segs.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < r.parts.length; i++) {
      const p = r.parts[i];
      if (p.startsWith(':')) params[p.slice(1)] = decodeURIComponent(segs[i]);
      else if (p !== segs[i]) { ok = false; break; }
    }
    if (!ok) continue;
    const query = Object.fromEntries(new URLSearchParams(queryPart));
    return r.handler({ params, query });
  }
  if (routes.length) navigate('/');
}

export function startRouter() {
  window.addEventListener('hashchange', resolve);
  resolve();
}
