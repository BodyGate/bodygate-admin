import type { Metadata } from "next"
import PlatinumDemo from "./PlatinumDemo"

export const metadata: Metadata = {
  title: "Platinum Foundation | BodyGate",
  description: "Laboratorio protetto per la navigazione unificata Platinum di BodyGate.",
}

export default function PlatinumPage() {
  return <PlatinumDemo />
}
