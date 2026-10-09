// Všetko pod /admin je len pre prihlásených. Prihlasovacia stránka je /admin/login.
import { currentUser } from './_lib/auth.js';

const SEC = {
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'same-origin',
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex, nofollow',
};

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  if (!/^\/admin(\/|$)/.test(url.pathname)) return next();
  const isLogin = /^\/admin\/login(\.html)?\/?$/.test(url.pathname);
  if (!isLogin) {
    const u = await currentUser(env, request);
    if (!u) return Response.redirect(`${url.origin}/admin/login`, 302);
  }
  const res = await next();
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(SEC)) out.headers.set(k, v);
  return out;
}
