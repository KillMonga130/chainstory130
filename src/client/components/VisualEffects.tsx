import React, { useEffect, useState } from 'react';
import { VisualElements, AnimationEffect } from '../../shared/types/story';

interface VisualEffectsProps {
  elements: VisualElements;
  className?: string;
}

export const VisualEffects: React.FC<VisualEffectsProps> = ({ elements, className = '' }) => {
  const [activeEffects, setActiveEffects] = useState<string[]>([]);

  useEffect(() => {
    // Apply atmospheric effects
    const effects = elements.atmosphericEffects || [];
    setActiveEffects(effects);

    // Apply color scheme to CSS variables
    if (elements.colorScheme) {
      const root = document.documentElement;
      root.style.setProperty('--story-primary', elements.colorScheme.primary);
      root.style.setProperty('--story-secondary', elements.colorScheme.secondary);
      root.style.setProperty('--story-background', elements.colorScheme.background);
      root.style.setProperty('--story-text', elements.colorScheme.text);
      root.style.setProperty('--story-accent', elements.colorScheme.accent);
      root.style.setProperty('--story-danger', elements.colorScheme.danger);
    }

    // Apply typography
    if (elements.typography) {
      const root = document.documentElement;
      root.style.setProperty('--story-font-family', elements.typography.fontFamily);
      root.style.setProperty('--story-heading-font', elements.typography.headingFont);
      root.style.setProperty('--story-body-font', elements.typography.bodyFont);
    }
  }, [elements]);

  const getEffectClasses = () => {
    const classes: string[] = [];

    activeEffects.forEach((effect) => {
      switch (effect) {
        case 'fog':
          classes.push('atmospheric-fog');
          break;
        case 'shadows':
          classes.push('atmospheric-shadows');
          break;
        case 'flicker':
          classes.push('flicker-animation');
          break;
        case 'glow':
          classes.push('glow-animation');
          break;
        case 'shake':
          classes.push('shake-animation');
          break;
        default:
          break;
      }
    });

    return classes.join(' ');
  };

  const renderAnimations = () => {
    return elements.animations?.map((animation: AnimationEffect, index: number) => (
      <div
        key={index}
        className={`animation-effect animation-${animation.type} intensity-${animation.intensity}`}
        style={{
          animationDuration: `${animation.duration}ms`,
        }}
      />
    ));
  };

  return (
    <>
      {/* Background image if provided */}
      {elements.backgroundImage && (
        <div
          className="story-background-image"
          style={{
            backgroundImage: `url(${elements.backgroundImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: -2,
            opacity: 0.3,
          }}
        />
      )}

      {/* Atmospheric effects overlay */}
      <div className={`visual-effects-overlay ${getEffectClasses()} ${className}`}>
        {renderAnimations()}
      </div>
    </>
  );
};
