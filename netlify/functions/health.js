export default async () =>
  new Response(JSON.stringify({ ok: true, service: 'backyard-ultra-tracker' }), {
    headers: {
      'content-type': 'application/json',
    },
  })
