import type { NextRequest } from 'next/server'

export const config = {
  runtime: 'edge'
}

export default async function handler(req: NextRequest) {
  // CORS preflight (OPTIONS request)
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*', // nebo např. https://metagym.cz
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  const url = new URL(req.url)
  url.host = 'api.openai.com'
  url.pathname = url.pathname.replace(/^\/api/, '')

  const response = await fetch(url.toString(), {
    method: req.method,
    headers: req.headers,
    body: req.body,
    signal: req.signal,
  })

  const body = await response.text()

  return new Response(body, {
    status: response.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*', // CORS pro reálnou odpověď
    },
  })
}
