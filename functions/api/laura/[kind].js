// GET /api/laura/foto | /api/laura/video – obrázok a animácia Laury (vygenerované v Higgsfield), cache 1 rok.
const SRC = {
  foto: 'https://d8j0ntlcm91z4.cloudfront.net/user_3EyiaDGMz0fchKVRg7mAaQN5DXR/hf_20261009_000113_d1d0f154-e8f8-43f5-86b7-f4e36b21d1df_min.webp',
  video: 'https://d8j0ntlcm91z4.cloudfront.net/user_3EyiaDGMz0fchKVRg7mAaQN5DXR/hf_20261009_000416_c89dcd5b-11c5-43c8-bc72-aa0d59580e1b.mp4',
};

export async function onRequestGet({ params, request }) {
  const src = SRC[params.kind];
  if (!src) return new Response('Not found', { status: 404 });
  const h = {};
  const range = request.headers.get('range');
  if (range) h.range = range;
  const r = await fetch(src, { headers: h, cf: { cacheTtl: 31536000, cacheEverything: true } });
  if (!r.ok) return new Response('Not found', { status: 404 });
  const out = new Response(r.body, r);
  out.headers.set('cache-control', 'public, max-age=2592000');
  out.headers.delete('set-cookie');
  return out;
}
