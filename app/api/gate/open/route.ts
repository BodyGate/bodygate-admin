import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const gateUrl = process.env.GATEBOX_OPEN_URL

    if (!gateUrl) {
      return NextResponse.json(
        { ok: false, error: 'GATEBOX_OPEN_URL non configurato' },
        { status: 500 }
      )
    }

    const response = await fetch(gateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BodyGate-Secret': process.env.GATEBOX_SECRET || '',
      },
      body: JSON.stringify({
        source: 'BodyGate',
        action: 'open',
        timestamp: new Date().toISOString(),
      }),
    })

    const bridgeText = await response.text()

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Bridge non ha risposto correttamente',
          bridgeResponse: bridgeText,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      message: 'Tornello aperto',
      bridgeResponse: bridgeText,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'Errore apertura tornello',
      },
      { status: 500 }
    )
  }
}