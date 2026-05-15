'use client'

export default function Page() {
  async function openGate() {
    const res = await fetch('/api/gate/open', {
      method: 'POST',
    })

    const data = await res.json()

    if (data.ok) {
      alert('Tornello aperto')
    } else {
      alert('Errore: ' + data.error)
    }
  }

  return (
    <main style={{ padding: 40 }}>
      <h1>Test Tornello</h1>

      <button
        onClick={openGate}
        style={{
          padding: 20,
          fontSize: 20,
          background: 'red',
          color: 'white',
          borderRadius: 12,
        }}
      >
        APRI TORNELLO
      </button>
    </main>
  )
}