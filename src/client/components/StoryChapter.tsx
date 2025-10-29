import React from 'react';
import { StoryChapter as StoryChapterType, VisualElements } from '../../shared/types/story';
import { VisualEffects } from './VisualEffects';

interface StoryChapterProps {
  chapter: StoryChapterType;
  className?: string;
}

export const StoryChapter: React.FC<StoryChapterProps> = ({ 
  chapter, 
  className = '' 
}) => {
  const { title, content, visualElements } = chapter;

  return (
    <div className={`story-chapter fade-in-animation ${className}`}>
      <VisualEffects elements={visualElements} />
      
      <div className="story-header">
        <h1 className="horror-title flicker-animation">
          {title}
        </h1>
      </div>

      <div className="story-content">
        <div className="horror-text">
          {content.split('\n').map((paragraph, index) => (
            <p key={index} className="mb-4 leading-relaxed">
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
};
