// /api/index.ts (Next.js route handler)
// Vercel Edge + SSE proxy na OpenAI Chat Completions (stream)
import type { NextRequest } from 'next/server'

export const runtime = 'edge';            // Edge runtime
export const maxDuration = 60;            // prodluž timeout na 60s (Pro / Enterprise)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!; 

export default async function handler(req: NextRequest) {
  // --- CORS preflight ---
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

  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: 'Missing OPENAI_API_KEY' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }

  // --- Načti payload a vynucuj stream: true ---
  let payload: any
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
  payload.stream = true
  if (!payload.model) payload.model = 'gpt-4o'

  // --- Zavoláme OpenAI ---
  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(payload),
  })

  // Když OpenAI vrátí chybu, vrať ji hned (ne stream)
  if (!openaiRes.ok || !openaiRes.body) {
    const msg = await openaiRes.text().catch(() => '')
    return new Response(msg || JSON.stringify({ error: 'OpenAI request failed' }), {
      status: openaiRes.status || 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }

  // --- Přeposlat SSE stream 1:1 + heartbeaty ---
  const encoder = new TextEncoder()
  const reader = openaiRes.body.getReader()

  const stream = new ReadableStream({
    start(controller) {
      // Heartbeat každých 15s (SSE comment) – drží spojení „živé“
      const hb = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`))
      }, 15000)

      ;(async () => {
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            controller.enqueue(value) // OpenAI už posílá "data: {...}\n\n"
          }
        } catch (e) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`))
        } finally {
          clearInterval(hb)
          controller.close()
        }
      })()
    },
  })

  // HNED vrátíme response se správnými SSE hlavičkami
  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
