import React, { useState, useEffect } from 'react';

interface TransitionProps {
  children: React.ReactNode;
  type?: 'fade' | 'slide' | 'horror-fade' | 'chapter-transition';
  duration?: number;
  delay?: number;
  className?: string;
}

export const Transition: React.FC<TransitionProps> = ({
  children,
  type = 'fade',
  duration = 600,
  delay = 0,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  const getTransitionClass = () => {
    const baseClass = 'transition-element';
    const visibleClass = isVisible ? 'visible' : 'hidden';
    
    return `${baseClass} ${type}-transition ${visibleClass} ${className}`;
  };

  return (
    <div 
      className={getTransitionClass()}
      style={{ 
        '--transition-duration': `${duration}ms`,
        '--transition-delay': `${delay}ms`
      } as React.CSSProperties}
    >
      {children}

      
    </div>
  );
};

interface ChapterTransitionProps {
  isTransitioning: boolean;
  children: React.ReactNode;
  onTransitionComplete?: () => void;
}

export const ChapterTransition: React.FC<ChapterTransitionProps> = ({
  isTransitioning,
  children,
  onTransitionComplete
}) => {
  const [phase, setPhase] = useState<'idle' | 'exit' | 'enter'>('idle');

  useEffect(() => {
    if (isTransitioning) {
      setPhase('exit');
      
      const exitTimer = setTimeout(() => {
        setPhase('enter');
        
        const enterTimer = setTimeout(() => {
          setPhase('idle');
          onTransitionComplete?.();
        }, 800);

        return () => clearTimeout(enterTimer);
      }, 400);

      return () => clearTimeout(exitTimer);
    }
  }, [isTransitioning, onTransitionComplete]);

  return (
    <div className={`chapter-transition-container ${phase}`}>
      {children}

      
    </div>
  );
};

