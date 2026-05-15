import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const code = String(body.code || '').trim()

    if (!code) {
      return NextResponse.json({
        ok: false,
        reason: 'Codice badge mancante',
      })
    }

    const { data: credential } = await supabase
      .from('access_credentials')
      .select('*, customers(*)')
      .eq('code', code)
      .eq('status', 'active')
      .single()

    if (!credential) {
      return NextResponse.json({
        ok: false,
        reason: 'Badge non valido o non attivo',
      })
    }

    const customer = credential.customers
    const today = new Date().toISOString().split('T')[0]

    const { data: membership } = await supabase
      .from('memberships')
      .select('*')
      .eq('customer_id', customer.id)
      .eq('status', 'active')
      .lte('start_date', today)
      .gte('end_date', today)
      .order('end_date', { ascending: false })
      .limit(1)
      .single()

    if (!membership) {
      await supabase.from('access_logs').insert({
        customer_id: customer.id,
        credential_code: code,
        result: 'denied',
        reason: 'Abbonamento non valido o scaduto',
      })

      return NextResponse.json({
        ok: false,
        reason: 'Abbonamento non valido o scaduto',
        customer,
      })
    }

    const { data: certificate } = await supabase
      .from('medical_certificates')
      .select('*')
      .eq('customer_id', customer.id)
      .eq('status', 'approved')
      .gte('expiry_date', today)
      .order('expiry_date', { ascending: false })
      .limit(1)
      .single()

    if (!certificate) {
      await supabase.from('access_logs').insert({
        customer_id: customer.id,
        credential_code: code,
        result: 'denied',
        reason: 'Certificato medico mancante o scaduto',
      })

      return NextResponse.json({
        ok: false,
        reason: 'Certificato medico mancante o scaduto',
        customer,
      })
    }

    await supabase.from('access_logs').insert({
      customer_id: customer.id,
      credential_code: code,
      result: 'allowed',
      reason: 'Accesso consentito da centralina',
    })

    return NextResponse.json({
      ok: true,
      reason: 'Accesso consentito',
      customer,
      membership,
      certificate,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        reason: error.message || 'Errore verifica accesso',
      },
      { status: 500 }
    )
  }
}