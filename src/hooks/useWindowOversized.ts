/**
 * Whether the window has grown past the footprint its mode asks for — i.e.
 * whether there is anything for the reset-size button to fix.
 *
 * Main owns the answer (it is the only side that sees maximize/full-screen
 * state), so we hydrate once and then follow the `window:oversized` push.
 */

import { useEffect, useState } from 'react'

export function useWindowOversized(): boolean {
  const [oversized, setOversized] = useState(false)

  useEffect(() => {
    let alive = true
    void window.api.invoke('window:is-oversized').then((value) => {
      if (alive) setOversized(value)
    })
    const off = window.api.on('window:oversized', setOversized)
    return () => {
      alive = false
      off()
    }
  }, [])

  return oversized
}
