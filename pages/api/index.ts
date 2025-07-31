import type { NextRequest } from 'next/server'

export const config = { runtime: 'edge' } as const

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!

export default async function handler(req: NextRequest) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Only POST is allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }

  let payload: any
  try {
    payload = await req.json()
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }

  payload.stream = true
  // (volitelně můžeš přidat default model)
  if (!payload.model) payload.model = 'gpt-4o'

  // Volání OpenAI se streamem (SSE)
  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(payload),
  })

  if (!openaiRes.ok || !openaiRes.body) {
    const text = await openaiRes.text().catch(() => '')
    return new Response(text || JSON.stringify({ error: 'OpenAI request failed' }), {
      status: openaiRes.status || 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }

  const encoder = new TextEncoder()
  const reader = openaiRes.body.getReader()

  const stream = new ReadableStream({
    start(controller) {
      const hb = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`)) // SSE comment (neviditelné pro klienta)
      }, 15000)

      const pump = async () => {
        try {
          while (true) {
            const { value, done } = await reader.read()
            if (done) break
            controller.enqueue(value)
          }
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`))
        } finally {
          clearInterval(hb)
          controller.close()
        }
      }

      pump()
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
