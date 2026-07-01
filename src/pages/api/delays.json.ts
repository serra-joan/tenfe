export const prerender = false

import type { APIContext } from 'astro'

const BASE_HEADERS = {
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'interest-cohort=()'
}

export async function GET({ locals }: APIContext) {
  const kv = locals.runtime?.env?.DELAYS_KV

  if (!kv) {
    return new Response(
      JSON.stringify({ error: 'KV not available' }),
      { status: 503, headers: BASE_HEADERS }
    )
  }

  try {
    const result: DelaysResponse = {
      R1: await getLineStats(kv, 'R1'),
      R11: await getLineStats(kv, 'R11')
    }

    return new Response(JSON.stringify(result), {
      headers: {
        ...BASE_HEADERS,
        'Cache-Control': 's-maxage=300, stale-while-revalidate=300'
      }
    })
  } catch (err) {
    console.error('Error reading delay stats:', err)
    return new Response(
      JSON.stringify({ error: 'Failed to read delay stats' }),
      { status: 500, headers: BASE_HEADERS }
    )
  }
}

async function getLineStats(kv: KVNamespace, line: string): Promise<DelayStats[]> {
  const data = await kv.get<DelayData>(`delays:${line}`, 'json')

  return Array.from({ length: 24 }, (_, hour) => {
    const slot = data?.hours[hour]
    return {
      hour,
      avgDelay: slot?.n ? Math.round(slot.sum / slot.n) : 0,
      n: slot?.n ?? 0
    }
  })
}
