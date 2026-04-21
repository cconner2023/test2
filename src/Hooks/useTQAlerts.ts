import { useState, useEffect } from 'react'
import { useTC3Store } from '../stores/useTC3Store'

export interface TQAlert {
  id: string
  location: string
  elapsedMinutes: number
  isWarning: boolean
  isCritical: boolean
}

function computeAlerts(
  tourniquets: Array<{ id: string; location: string; time: string }>,
  dateTimeOfInjury: string,
): TQAlert[] {
  const now = Date.now()
  const datePrefix = dateTimeOfInjury
    ? dateTimeOfInjury.slice(0, 10)
    : new Date().toISOString().slice(0, 10)

  return tourniquets
    .filter((tq) => tq.time.trim() !== '')
    .map((tq) => {
      let tqDate = new Date(`${datePrefix}T${tq.time}`)
      if (tqDate.getTime() > now) {
        tqDate = new Date(tqDate.getTime() - 86400000)
      }
      const elapsedMinutes = Math.floor((now - tqDate.getTime()) / 60000)
      return {
        id: tq.id,
        location: tq.location,
        elapsedMinutes,
        isWarning: elapsedMinutes >= 45,
        isCritical: elapsedMinutes >= 60,
      }
    })
    .filter((a) => a.isWarning)
}

export function useTQAlerts(): { alerts: TQAlert[] } {
  const tourniquets = useTC3Store((s) => s.card.march.massiveHemorrhage.tourniquets)
  const dateTimeOfInjury = useTC3Store((s) => s.card.casualty.dateTimeOfInjury)

  const [alerts, setAlerts] = useState<TQAlert[]>(() =>
    computeAlerts(tourniquets, dateTimeOfInjury),
  )

  useEffect(() => {
    setAlerts(computeAlerts(tourniquets, dateTimeOfInjury))

    const id = setInterval(() => {
      setAlerts(computeAlerts(tourniquets, dateTimeOfInjury))
    }, 60000)

    return () => clearInterval(id)
  }, [tourniquets, dateTimeOfInjury])

  return { alerts }
}
