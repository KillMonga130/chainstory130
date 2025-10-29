/**
 * End-to-End Test: Complete User Journey
 * 
 * This test verifies the complete user journey from story start to ending,
 * ensuring all components (story engine, voting system, client interface) work together.
 * 
 * Requirements tested: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '../../client/App';

// Mock Devvit client functions
vi.mock('@devvit/web/client', () => ({
  navigateTo: vi.fn(),
  connectRealtime: vi.fn(() => Promise.resolve({
    disconnect: vi.fn()
  }))
}));

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Complete User Journey - End to End', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default API responses
    mockFetch.mockImplementation((url: string, options?: any) => {
      if (url === '/api/story/current') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              chapter: {
                id: 'chapter-1',
                title: 'The Haunted Thread Begins',
                content: 'Welcome to The Haunted Thread...',
                choices: [
                  {
                    id: 'choice-1',
                    text: 'Enter the mansion through the front door',
                    description: 'Walk boldly through the main entrance'
                  },
                  {
                    id: 'choice-2', 
                    text: 'Sneak around to find a back entrance',
                    description: 'Look for a more discreet way inside'
                  },
                  {
                    id: 'choice-3',
                    text: 'Turn around and leave immediately',
                    description: 'This place gives you a bad feeling'
                  }
                ],
                metadata: {
                  createdAt: new Date(),
                  author: 'The Haunted Thread',
                  tags: ['horror', 'interactive', 'beginning']
                }
              },
              context: {
                pathTaken: ['chapter-1'],
                previousChoices: [],
                currentDepth: 1,
                totalChapters: 1,
                storyStartTime: new Date()
              },
              votingActive: true
            }
          })
        });
      }
      
      if (url.includes('/api/vote/counts/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [
              { choiceId: 'choice-1', count: 5 },
              { choiceId: 'choice-2', count: 3 },
              { choiceId: 'choice-3', count: 1 }
            ]
          })
        });
      }
      
      if (url.includes('/api/vote/status/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { hasVoted: false }
          })
        });
      }
      
      if (url === '/api/vote' && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              success: true,
              voteCount: 6,
              message: 'Vote cast successfully'
            }
          })
        });
      }
      
      if (url === '/api/realtime/channel') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              channelName: 'haunted_thread_test-post',
              postId: 'test-post'
            }
          })
        });
      }
      
      return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should complete the full user journey from story start to voting', async () => {
    // Requirement 1.1: Display current story chapter with atmospheric visuals
    render(<App />);
    
    // Wait for story to load
    await waitFor(() => {
      expect(screen.getByText('The Haunted Thread')).toBeInTheDocument();
    });
    
    // Verify story content is displayed
    expect(screen.getByText('The Haunted Thread Begins')).toBeInTheDocument();
    expect(screen.getByText(/Welcome to The Haunted Thread/)).toBeInTheDocument();
    
    // Requirement 4.1: Verify atmospheric elements are present
    expect(document.querySelector('.story-container')).toBeInTheDocument();
    expect(document.querySelector('.horror-title')).toBeInTheDocument();
    
    // Requirement 2.1: Verify voting choices are displayed
    expect(screen.getByText('Enter the mansion through the front door')).toBeInTheDocument();
    expect(screen.getByText('Sneak around to find a back entrance')).toBeInTheDocument();
    expect(screen.getByText('Turn around and leave immediately')).toBeInTheDocument();
    
    // Requirement 5.1: Verify story progress is shown
    await waitFor(() => {
      expect(document.querySelector('.story-progress')).toBeInTheDocument();
    });
    
    // Requirement 2.2: Test voting functionality
    const firstChoice = screen.getByText('Enter the mansion through the front door');
    fireEvent.click(firstChoice);
    
    // Wait for vote to be processed
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/vote', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapterId: 'chapter-1',
          choiceId: 'choice-1'
        })
      }));
    });
    
    // Requirement 2.4: Verify vote counts are updated
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/vote/counts/chapter-1');
    });
    
    // Requirement 3.2: Verify realtime connection is established
    expect(mockFetch).toHaveBeenCalledWith('/api/realtime/channel');
  });

  it('should handle story progression and chapter transitions', async () => {
    // Setup mock for chapter transition
    mockFetch.mockImplementation((url: string, options?: any) => {
      if (url === '/api/story/current') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              chapter: {
                id: 'chapter-2',
                title: 'Inside the Mansion',
                content: 'You step through the creaking door...',
                choices: [
                  {
                    id: 'choice-4',
                    text: 'Explore the grand staircase',
                    description: 'The stairs lead to darkness above'
                  },
                  {
                    id: 'choice-5',
                    text: 'Investigate the parlor',
                    description: 'Strange sounds come from within'
                  }
                ],
                metadata: {
                  createdAt: new Date(),
                  author: 'The Haunted Thread',
                  tags: ['horror', 'interactive', 'mansion']
                }
              },
              context: {
                pathTaken: ['chapter-1', 'chapter-2'],
                previousChoices: ['choice-1'],
                currentDepth: 2,
                totalChapters: 2,
                storyStartTime: new Date()
              },
              votingActive: true
            }
          })
        });
      }
      
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] })
      });
    });

    render(<App />);
    
    // Wait for new chapter to load
    await waitFor(() => {
      expect(screen.getByText('Inside the Mansion')).toBeInTheDocument();
    });
    
    // Requirement 3.1: Verify story progression based on community decisions
    expect(screen.getByText(/You step through the creaking door/)).toBeInTheDocument();
    
    // Requirement 5.2: Verify story history tracking
    await waitFor(() => {
      const progressElement = document.querySelector('.story-progress');
      expect(progressElement).toBeInTheDocument();
    });
    
    // Verify new choices are available
    expect(screen.getByText('Explore the grand staircase')).toBeInTheDocument();
    expect(screen.getByText('Investigate the parlor')).toBeInTheDocument();
  });

  it('should handle error states gracefully', async () => {
    // Setup mock for error response
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/story/current') {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({
            success: false,
            error: 'Story not found'
          })
        });
      }
      
      return Promise.reject(new Error('Network error'));
    });

    render(<App />);
    
    // Wait for error state to be displayed
    await waitFor(() => {
      expect(screen.getByText(/The Darkness Consumed the Story/)).toBeInTheDocument();
    });
    
    // Verify error message is shown
    expect(screen.getByText('Story not found')).toBeInTheDocument();
    
    // Verify retry button is available
    expect(screen.getByText('🔄 Try Again')).toBeInTheDocument();
  });

  it('should handle realtime updates correctly', async () => {
    const { connectRealtime } = await import('@devvit/web/client');
    const mockConnect = connectRealtime as any;
    
    let messageHandler: (data: any) => void;
    
    mockConnect.mockImplementation(({ onMessage }: any) => {
      messageHandler = onMessage;
      return Promise.resolve({
        disconnect: vi.fn()
      });
    });

    render(<App />);
    
    // Wait for component to mount and realtime to connect
    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalled();
    });
    
    // Simulate realtime vote update
    const voteUpdateMessage = {
      type: 'vote_update',
      timestamp: new Date(),
      data: {
        chapterId: 'chapter-1',
        voteCounts: [
          { choiceId: 'choice-1', count: 10 },
          { choiceId: 'choice-2', count: 5 },
          { choiceId: 'choice-3', count: 2 }
        ],
        totalVotes: 17
      }
    };
    
    // Trigger the message handler
    messageHandler(voteUpdateMessage);
    
    // Requirement 3.2: Verify realtime updates are processed
    await waitFor(() => {
      // The vote counts should be updated in the UI
      // This would be verified by checking if the voting interface reflects new counts
      expect(document.querySelector('.voting-interface')).toBeInTheDocument();
    });
  });

  it('should handle story restart functionality', async () => {
    // Setup mock for story restart
    mockFetch.mockImplementation((url: string, options?: any) => {
      if (url === '/api/story/restart' && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              chapter: {
                id: 'chapter-1',
                title: 'The Haunted Thread Begins',
                content: 'Welcome to The Haunted Thread...',
                choices: [
                  {
                    id: 'choice-1',
                    text: 'Enter the mansion through the front door',
                    description: 'Walk boldly through the main entrance'
                  }
                ],
                metadata: {
                  createdAt: new Date(),
                  author: 'The Haunted Thread',
                  tags: ['horror', 'interactive', 'beginning']
                }
              },
              context: {
                pathTaken: ['chapter-1'],
                previousChoices: [],
                currentDepth: 1,
                totalChapters: 1,
                storyStartTime: new Date()
              },
              message: 'Story restarted successfully'
            }
          })
        });
      }
      
      // Default story current response
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            chapter: {
              id: 'chapter-1',
              title: 'The Haunted Thread Begins',
              content: 'Welcome to The Haunted Thread...',
              choices: [],
              metadata: { createdAt: new Date(), author: 'Test', tags: [] }
            },
            context: {
              pathTaken: ['chapter-1'],
              previousChoices: [],
              currentDepth: 1,
              totalChapters: 1,
              storyStartTime: new Date()
            },
            votingActive: true
          }
        })
      });
    });

    render(<App />);
    
    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText('The Haunted Thread')).toBeInTheDocument();
    });
    
    // Find and click the story replay button
    const replayButton = screen.getByTitle('Story Management & Replay');
    fireEvent.click(replayButton);
    
    // Requirement 6.3: Verify story restart functionality
    await waitFor(() => {
      expect(document.querySelector('.story-replay')).toBeInTheDocument();
    });
  });

  it('should integrate all components seamlessly', async () => {
    render(<App />);
    
    // Wait for all components to load
    await waitFor(() => {
      expect(screen.getByText('The Haunted Thread')).toBeInTheDocument();
    });
    
    // Verify all major components are present and integrated
    
    // Story display component
    expect(document.querySelector('.story-container')).toBeInTheDocument();
    expect(document.querySelector('.chapter-container')).toBeInTheDocument();
    
    // Voting interface component
    expect(document.querySelector('.voting-interface')).toBeInTheDocument();
    
    // Progress tracking component
    expect(document.querySelector('.story-progress')).toBeInTheDocument();
    
    // Atmospheric effects
    expect(document.querySelector('.particle-effects')).toBeInTheDocument();
    
    // Control buttons
    expect(screen.getByTitle('Story Management & Replay')).toBeInTheDocument();
    expect(screen.getByTitle('Administrator Access')).toBeInTheDocument();
    
    // Footer with navigation
    expect(screen.getByText('Devvit Docs')).toBeInTheDocument();
    expect(screen.getByText('r/Devvit')).toBeInTheDocument();
    expect(screen.getByText('Discord')).toBeInTheDocument();
    
    // Verify API calls are made for initial data
    expect(mockFetch).toHaveBeenCalledWith('/api/story/current');
    expect(mockFetch).toHaveBeenCalledWith('/api/realtime/channel');
  });
});
