import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PLATINUM_SCREENS, getPlatinumScreen } from "@/architecture/platinum-screen-registry"
import PlatinumScreenPreview from "../../PlatinumScreenPreview"

export function generateStaticParams() { return PLATINUM_SCREENS.map(({ id }) => ({ screen: id })) }
export async function generateMetadata({ params }: { params: Promise<{ screen: string }> }): Promise<Metadata> {
  const item = getPlatinumScreen((await params).screen)
  return { title: item ? `${item.label} | Platinum Lab` : "Schermata non trovata" }
}
export default async function ScreenPage({ params }: { params: Promise<{ screen: string }> }) {
  const item = getPlatinumScreen((await params).screen)
  if (!item) notFound()
  return <PlatinumScreenPreview screen={item} />
}
