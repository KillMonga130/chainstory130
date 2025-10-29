/**
 * Test Setup Configuration
 * 
 * Global test setup for all test files
 * Configures mocks, test environment, and utilities
 */

import { vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';

// Mock global objects
global.console = {
  ...console,
  // Suppress console.log in tests unless explicitly needed
  log: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Mock DOM APIs
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});

// Mock fetch
global.fetch = vi.fn();

// Mock performance API
global.performance = {
  ...performance,
  now: vi.fn(() => Date.now()),
  mark: vi.fn(),
  measure: vi.fn(),
  getEntriesByName: vi.fn(() => []),
  getEntriesByType: vi.fn(() => []),
};

// Global test hooks
beforeAll(() => {
  // Global setup before all tests
  console.log('🧪 Starting Chain Story test suite...');
});

afterAll(() => {
  // Global cleanup after all tests
  console.log('✅ Chain Story test suite completed');
});

beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks();
  
  // Reset localStorage and sessionStorage
  localStorageMock.getItem.mockReturnValue(null);
  localStorageMock.setItem.mockImplementation(() => {});
  localStorageMock.removeItem.mockImplementation(() => {});
  localStorageMock.clear.mockImplementation(() => {});
  
  sessionStorageMock.getItem.mockReturnValue(null);
  sessionStorageMock.setItem.mockImplementation(() => {});
  sessionStorageMock.removeItem.mockImplementation(() => {});
  sessionStorageMock.clear.mockImplementation(() => {});
  
  // Reset fetch mock
  (global.fetch as any).mockResolvedValue({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({}),
    text: vi.fn().mockResolvedValue(''),
  });
});

afterEach(() => {
  // Cleanup after each test
  vi.restoreAllMocks();
});

// Test utilities
export const testUtils = {
  // Create mock story data
  createMockStory: (overrides = {}) => ({
    id: 'test_story_123',
    created: Date.now(),
    sentences: ['First sentence of the story.', 'Second sentence continues.'],
    roundNumber: 3,
    totalVotes: 25,
    status: 'active',
    contributors: ['user1', 'user2'],
    ...overrides,
  }),

  // Create mock round data
  createMockRound: (overrides = {}) => ({
    storyId: 'test_story_123',
    roundNumber: 1,
    startTime: Date.now() - 30 * 60 * 1000, // 30 minutes ago
    endTime: Date.now() + 30 * 60 * 1000, // 30 minutes from now
    submissions: [],
    ...overrides,
  }),

  // Create mock user contribution data
  createMockUserContribution: (overrides = {}) => ({
    userId: 'testuser',
    submissions: [
      {
        storyId: 'story_1',
        roundNumber: 1,
        sentence: 'Test submission sentence.',
        upvotes: 15,
        wasWinner: true,
      },
    ],
    totalSubmissions: 1,
    totalWins: 1,
    totalUpvotes: 15,
    ...overrides,
  }),

  // Create mock leaderboard entry
  createMockLeaderboardEntry: (overrides = {}) => ({
    rank: 1,
    storyId: 'story_123',
    sentenceCount: 100,
    totalVotes: 500,
    creator: 'user1',
    completedAt: Date.now() - 24 * 60 * 60 * 1000, // 1 day ago
    preview: 'Once upon a time in a digital realm...',
    ...overrides,
  }),

  // Wait for async operations
  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  // Mock API response
  mockApiResponse: (data: any, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
  }),

  // Mock API error
  mockApiError: (message: string, status = 500) => ({
    ok: false,
    status,
    json: vi.fn().mockRejectedValue(new Error(message)),
    text: vi.fn().mockRejectedValue(new Error(message)),
  }),
};
