import { useEffect, useRef, useState } from 'react'

interface AnimatedCounterProps {
  value: number
  duration?: number
}

export function AnimatedCounter({ value, duration = 500 }: AnimatedCounterProps) {
  const [displayed, setDisplayed] = useState(value)
  const prevRef = useRef(value)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const start = prevRef.current
    const end = value
    const startTime = performance.now()

    const animate = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayed(Math.round(start + (end - start) * eased))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        prevRef.current = end
      }
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value, duration])

  return <>{displayed}</>
}
