const corsHeaders = {
  'access-control-allow-headers': 'content-type',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-origin': '*',
  'content-type': 'application/json',
}

// Replace in-memory queue with Upstash Redis or Fauna if persistence across function instances is needed in production.
const eventQueue = []

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: corsHeaders,
    status,
  })

export default async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    })
  }

  if (request.method === 'GET') {
    const events = eventQueue.splice(0, eventQueue.length)
    return jsonResponse({ events })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405)
  }

  try {
    const payload = await request.json()
    const tagId = String(payload.tag_id ?? '').trim()

    if (!tagId) {
      return jsonResponse({ ok: false, error: 'tag_id is required' }, 400)
    }

    eventQueue.push({
      tag_id: tagId,
      timestamp: payload.timestamp || new Date().toISOString(),
    })

    if (eventQueue.length > 50) {
      eventQueue.splice(0, eventQueue.length - 50)
    }

    return jsonResponse({ ok: true })
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400)
  }
}
