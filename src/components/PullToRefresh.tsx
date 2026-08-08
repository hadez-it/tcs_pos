import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh?: () => void;
  children: React.ReactNode;
}

export default function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef<number>(0);
  const isPullingRef = useRef<boolean>(false);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (isRefreshing) return;

      let target = e.target as HTMLElement | null;
      let isAtTop = true;

      while (target && target !== document.body) {
        if (target.scrollTop > 0) {
          isAtTop = false;
          break;
        }
        target = target.parentElement;
      }

      if (isAtTop) {
        startYRef.current = e.touches[0].clientY;
        isPullingRef.current = true;
      } else {
        isPullingRef.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPullingRef.current || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const deltaY = currentY - startYRef.current;

      if (deltaY > 0) {
        const dist = Math.min(deltaY * 0.45, 120);
        setPullDistance(dist);
      } else {
        setPullDistance(0);
      }
    };

    const handleTouchEnd = () => {
      if (!isPullingRef.current || isRefreshing) return;

      if (pullDistance >= 70) {
        setIsRefreshing(true);
        setPullDistance(70);
        setTimeout(() => {
          if (onRefresh) {
            onRefresh();
          } else {
            window.location.reload();
          }
        }, 300);
      } else {
        setPullDistance(0);
      }
      isPullingRef.current = false;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullDistance, isRefreshing, onRefresh]);

  return (
    <div className="relative w-full h-full">
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="fixed top-3 left-1/2 -translate-x-1/2 z-50 transition-transform duration-75 pointer-events-none"
          style={{
            transform: `translate(-50%, ${Math.min(pullDistance, 70)}px)`
          }}
        >
          <div className="bg-black text-white px-3.5 py-2 rounded-full shadow-xl border border-slate-700 flex items-center gap-2 text-xs font-bold">
            <RefreshCw
              className={`w-4 h-4 text-white ${isRefreshing ? 'animate-spin' : ''}`}
              style={{
                transform: !isRefreshing ? `rotate(${pullDistance * 3}deg)` : undefined
              }}
            />
            <span>
              {isRefreshing
                ? 'Reloading...'
                : pullDistance >= 70
                ? 'Release to reload'
                : 'Pull down to reload'}
            </span>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
