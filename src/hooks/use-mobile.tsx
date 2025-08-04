import * as React from "react"

// Responsive breakpoints
const BREAKPOINTS = {
  xs: 480,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536
} as const

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < BREAKPOINTS.md)
    }

    // Initial check
    checkMobile()

    // Add event listener with passive option for better performance
    const handleResize = () => {
      checkMobile()
    }

    // Use passive listener for better performance
    window.addEventListener("resize", handleResize, { passive: true })
    
    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  return !!isMobile
}

// Hook for checking specific breakpoints
export function useBreakpoint(breakpoint: keyof typeof BREAKPOINTS) {
  const [isBelowBreakpoint, setIsBelowBreakpoint] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const checkBreakpoint = () => {
      setIsBelowBreakpoint(window.innerWidth < BREAKPOINTS[breakpoint])
    }

    // Initial check
    checkBreakpoint()

    // Add event listener with passive option for better performance
    const handleResize = () => {
      checkBreakpoint()
    }

    // Use passive listener for better performance
    window.addEventListener("resize", handleResize, { passive: true })
    
    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [breakpoint])

  return !!isBelowBreakpoint
}

// Hook for checking if device supports touch
export function useIsTouchDevice() {
  const [isTouchDevice, setIsTouchDevice] = React.useState<boolean>(false)

  React.useEffect(() => {
    // Check for touch support
    const hasTouchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    
    // Check for mobile user agent
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    
    setIsTouchDevice(hasTouchSupport || isMobileUA)
  }, [])

  return isTouchDevice
}

// Hook for checking viewport dimensions
export function useViewport() {
  const [viewport, setViewport] = React.useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0
  })

  React.useEffect(() => {
    const updateViewport = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight
      })
    }

    // Initial check
    updateViewport()

    // Add event listener with passive option for better performance
    window.addEventListener("resize", updateViewport, { passive: true })
    
    return () => {
      window.removeEventListener("resize", updateViewport)
    }
  }, [])

  return viewport
}
