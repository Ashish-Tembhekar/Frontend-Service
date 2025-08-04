import React from 'react';
import { useIsMobile, useIsTouchDevice, useViewport } from '../../hooks/use-mobile';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  className?: string;
  showMobileOptimizations?: boolean;
}

export function ResponsiveLayout({ 
  children, 
  className = '', 
  showMobileOptimizations = true 
}: ResponsiveLayoutProps) {
  const isMobile = useIsMobile();
  const isTouchDevice = useIsTouchDevice();
  const viewport = useViewport();

  // Add mobile-specific classes
  const mobileClasses = showMobileOptimizations && isMobile ? 'touch-manipulation' : '';
  const touchClasses = isTouchDevice ? 'touch-manipulation' : '';
  
  return (
    <div 
      className={`${mobileClasses} ${touchClasses} ${className}`}
      style={{
        // Ensure proper viewport behavior on mobile
        minHeight: '100dvh', // Dynamic viewport height for mobile
      }}
    >
      {children}
    </div>
  );
}

// Hook for responsive behavior
export function useResponsive() {
  const isMobile = useIsMobile();
  const isTouchDevice = useIsTouchDevice();
  const viewport = useViewport();

  return {
    isMobile,
    isTouchDevice,
    viewport,
    isSmallScreen: viewport.width < 640,
    isMediumScreen: viewport.width >= 640 && viewport.width < 1024,
    isLargeScreen: viewport.width >= 1024,
  };
} 