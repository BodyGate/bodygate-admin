'use client'

import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function AccessControl() {
  const [code, setCode] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  async function openGate() {
    const res = await fetch('/api/gate/open', {
      method: 'POST',
    })

    return await res.json()
  }

  async function checkAccess(e: React.FormEvent) {
    e.preventDefault()
    setResult(null)
    setLoading(true)

    try {
      const cleanCode = code.trim()

      const { data: credential } = await supabase
        .from('access_credentials')
        .select('*, customers(*)')
        .eq('code', cleanCode)
        .eq('status', 'active')
        .single()

      if (!credential) {
        setResult({
          ok: false,
          message: 'Accesso negato',
          reason: 'Badge non valido o non attivo',
        })
        return
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
          credential_code: cleanCode,
          result: 'denied',
          reason: 'Abbonamento non valido o scaduto',
        })

        setResult({
          ok: false,
          message: 'Accesso negato',
          reason: 'Abbonamento non valido o scaduto',
          customer,
        })
        return
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
          credential_code: cleanCode,
          result: 'denied',
          reason: 'Certificato medico mancante o scaduto',
        })

        setResult({
          ok: false,
          message: 'Accesso negato',
          reason: 'Certificato medico mancante o scaduto',
          customer,
        })
        return
      }

      const gateResult = await openGate()

      if (!gateResult.ok) {
        await supabase.from('access_logs').insert({
          customer_id: customer.id,
          credential_code: cleanCode,
          result: 'denied',
          reason: 'Cliente valido ma tornello non aperto',
        })

        setResult({
          ok: false,
          message: 'Errore apertura tornello',
          reason: gateResult.error || 'Bridge non disponibile',
          customer,
        })
        return
      }

      await supabase.from('access_logs').insert({
        customer_id: customer.id,
        credential_code: cleanCode,
        result: 'allowed',
        reason: 'Accesso consentito - tornello aperto',
      })

      setResult({
        ok: true,
        message: 'Accesso consentito',
        reason: 'Abbonamento valido, certificato valido e tornello aperto',
        customer,
        membership,
        certificate,
      })

      setCode('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 p-10">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-block mb-6 text-gray-600 hover:text-black">
          ← Torna alla dashboard
        </Link>

        <div className="bg-white rounded-2xl shadow p-8 mb-8">
          <h1 className="text-4xl font-bold">Controllo accessi</h1>
          <p className="text-gray-500 mt-2">
            Lettura badge / QR con apertura reale tornello
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow p-8">
          <form onSubmit={checkAccess} className="space-y-4">
            <input
              placeholder="Scansiona o inserisci codice badge"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="border rounded-xl p-4 w-full text-xl"
              autoFocus
              required
              disabled={loading}
            />

            <button
              type="submit"
              disabled={loading}
              className="bg-black text-white rounded-xl p-4 w-full text-lg disabled:opacity-50"
            >
              {loading ? 'Verifica e apertura...' : 'Verifica accesso'}
            </button>
          </form>
        </div>

        {result && (
          <div
            className={`mt-8 rounded-2xl shadow p-8 ${
              result.ok ? 'bg-green-100' : 'bg-red-100'
            }`}
          >
            <h2
              className={`text-3xl font-bold ${
                result.ok ? 'text-green-800' : 'text-red-800'
              }`}
            >
              {result.message}
            </h2>

            <p className="mt-3 text-lg">{result.reason}</p>

            {result.customer && (
              <div className="mt-6 bg-white rounded-xl p-5">
                <p className="font-bold text-xl">
                  {result.customer.first_name} {result.customer.last_name}
                </p>
                <p className="text-gray-500">
                  {result.customer.phone || '-'} | {result.customer.email || '-'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}