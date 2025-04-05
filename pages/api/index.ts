import type { NextRequest } from 'next/server'

export const config = {
  runtime: 'edge',
}

//const OPENAI_API_KEY = process.env.OPENAI_API_KEY!; 
const OPENAI_API_KEY = "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";

export default async function handler(req: NextRequest) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  const url = new URL(req.url);
  url.host = 'api.openai.com';
  url.pathname = '/v1/chat/completions'; // explicitně nastavujeme cestu

  const headers = new Headers({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${OPENAI_API_KEY}`,
  });

  const openaiResponse = await fetch(url.toString(), {
    method: 'POST',
    headers,
    body: req.body,
    signal: req.signal,
  });

  const body = await openaiResponse.text();

  return new Response(body, {
    status: openaiResponse.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
