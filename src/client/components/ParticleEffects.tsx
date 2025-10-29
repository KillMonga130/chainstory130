import React, { useEffect, useRef } from 'react';

interface ParticleEffectsProps {
  type?: 'fog' | 'embers' | 'shadows' | 'blood-drops';
  intensity?: 'low' | 'medium' | 'high';
  className?: string;
}

export const ParticleEffects: React.FC<ParticleEffectsProps> = ({
  type = 'fog',
  intensity = 'medium',
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const particleCount = getParticleCount(intensity);

    // Clear existing particles
    container.innerHTML = '';

    // Create particles based on type
    for (let i = 0; i < particleCount; i++) {
      const particle = createParticle(type, i);
      container.appendChild(particle);
    }

    return () => {
      container.innerHTML = '';
    };
  }, [type, intensity]);

  const getParticleCount = (intensity: string): number => {
    switch (intensity) {
      case 'low': return 5;
      case 'high': return 20;
      default: return 10;
    }
  };

  const createParticle = (type: string, _: number): HTMLElement => {
    const particle = document.createElement('div');
    particle.className = `particle particle-${type}`;
    
    // Random positioning
    const left = Math.random() * 100;
    const animationDelay = Math.random() * 5;
    const animationDuration = 3 + Math.random() * 4;
    
    particle.style.left = `${left}%`;
    particle.style.animationDelay = `${animationDelay}s`;
    particle.style.animationDuration = `${animationDuration}s`;

    // Type-specific properties
    switch (type) {
      case 'fog':
        particle.style.width = `${20 + Math.random() * 40}px`;
        particle.style.height = `${20 + Math.random() * 40}px`;
        break;
      case 'embers':
        particle.style.width = `${2 + Math.random() * 4}px`;
        particle.style.height = `${2 + Math.random() * 4}px`;
        break;
      case 'shadows':
        particle.style.width = `${10 + Math.random() * 20}px`;
        particle.style.height = `${10 + Math.random() * 20}px`;
        break;
      case 'blood-drops':
        particle.style.width = `${1 + Math.random() * 3}px`;
        particle.style.height = `${3 + Math.random() * 6}px`;
        break;
    }

    return particle;
  };

  return (
    <div 
      ref={containerRef}
      className={`particle-effects particle-effects-${type} ${className}`}
    >

    </div>
  );
};
