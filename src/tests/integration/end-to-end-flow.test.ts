/**
 * End-to-end integration test for The Haunted Thread
 * Tests complete user journey from story start to ending
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StoryStateManager } from '../../server/core/story-state-manager';
import { VotingManager } from '../../server/core/voting-manager';
import { StoryProgressionEngine } from '../../server/core/story-progression-engine';
import { RealtimeManager } from '../../server/core/realtime-manager';

// Mock Redis for testing
const mockRedis = {
  data: new Map<string, string>(),
  hashes: new Map<string, Record<string, string>>(),

  async get(key: string): Promise<string | null> {
    return this.data.get(key) || null;
  },

  async set(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  },

  async del(key: string): Promise<void> {
    this.data.delete(key);
    this.hashes.delete(key);
  },

  async expire(_key: string, _ttl: number): Promise<void> {
    // Mock implementation - in real tests we'd track expiration
  },

  async hSet(key: string, values: Record<string, string>): Promise<void> {
    this.hashes.set(key, { ...this.hashes.get(key), ...values });
  },

  async hGetAll(key: string): Promise<Record<string, string>> {
    return this.hashes.get(key) || {};
  },

  async incrBy(key: string, increment: number): Promise<void> {
    const current = parseInt(this.data.get(key) || '0');
    this.data.set(key, (current + increment).toString());
  },

  async exists(key: string): Promise<number> {
    return this.data.has(key) || this.hashes.has(key) ? 1 : 0;
  },

  async watch(_key: string): Promise<any> {
    return {
      multi: () => this,
      exec: () => Promise.resolve(),
    };
  },

  multi() {
    return this;
  },
};

// Mock the redis import
vi.mock('@devvit/web/server', () => ({
  redis: mockRedis,
  realtime: {
    send: vi.fn(),
  },
}));

describe('End-to-End Story Flow Integration', () => {
  const testPostId = 'test-post-123';
  const testUserId = 'test-user-456';

  beforeEach(async () => {
    // Clear mock Redis data
    mockRedis.data.clear();
    mockRedis.hashes.clear();
  });

  afterEach(async () => {
    // Clean up test data
    mockRedis.data.clear();
    mockRedis.hashes.clear();
  });

  it('should complete full story journey from start to ending', async () => {
    // Step 1: Initialize story
    const progressionEngine = new StoryProgressionEngine();
    const initialChapter = progressionEngine.getInitialChapter();

    expect(initialChapter).toBeDefined();
    expect(initialChapter.id).toBeTruthy();
    expect(initialChapter.choices.length).toBeGreaterThan(0);

    // Step 2: Initialize story state
    const context = await StoryStateManager.initializeStory(testPostId, initialChapter);

    expect(context).toBeDefined();
    expect(context.currentChapter).toBe(initialChapter.id);
    expect(context.pathTaken).toEqual([]);
    expect(context.previousChoices).toEqual([]);

    // Step 3: Create voting session
    await VotingManager.createVotingSession(
      testPostId,
      initialChapter.id,
      initialChapter.choices.map((choice) => ({
        choiceId: choice.id,
        text: choice.text,
      })),
      60
    );

    // Step 4: Cast votes
    const firstChoice = initialChapter.choices[0];
    const voteResult = await VotingManager.castVote(
      testPostId,
      testUserId,
      initialChapter.id,
      firstChoice.id
    );

    expect(voteResult.success).toBe(true);
    expect(voteResult.voteCount).toBe(1);

    // Step 5: Check vote counts
    const voteCounts = await VotingManager.getVoteCounts(testPostId, initialChapter.id);
    expect(voteCounts).toBeDefined();
    expect(voteCounts.length).toBe(initialChapter.choices.length);

    const firstChoiceVotes = voteCounts.find((vc) => vc.choiceId === firstChoice.id);
    expect(firstChoiceVotes?.count).toBe(1);

    // Step 6: Advance story based on winning vote
    const advanceResult = await progressionEngine.advanceStory(
      testPostId,
      initialChapter.id,
      firstChoice.id
    );

    expect(advanceResult.success).toBe(true);

    if (!advanceResult.hasEnded) {
      expect(advanceResult.newChapter).toBeDefined();
      expect(advanceResult.newChapter!.id).not.toBe(initialChapter.id);

      // Step 7: Verify story state was updated
      const updatedContext = await StoryStateManager.getStoryContext(testPostId);
      expect(updatedContext).toBeDefined();
      expect(updatedContext!.currentChapter).toBe(advanceResult.newChapter!.id);
      expect(updatedContext!.previousChoices).toContain(firstChoice.id);
      expect(updatedContext!.pathTaken).toContain(firstChoice.id);

      // Step 8: Verify history was recorded
      const history = await StoryStateManager.getStoryHistory(testPostId);
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].chapterId).toBe(initialChapter.id);
      expect(history[0].winningChoice).toBe(firstChoice.id);

      // Step 9: Verify progression was updated
      const progression = await StoryStateManager.getProgression(testPostId);
      expect(progression).toBeDefined();
      expect(progression!.totalChapters).toBeGreaterThan(1);
      expect(progression!.currentPosition).toBeGreaterThan(0);
    }
  });

  it('should handle concurrent voting correctly', async () => {
    // Initialize story
    const progressionEngine = new StoryProgressionEngine();
    const initialChapter = progressionEngine.getInitialChapter();
    await StoryStateManager.initializeStory(testPostId, initialChapter);

    await VotingManager.createVotingSession(
      testPostId,
      initialChapter.id,
      initialChapter.choices.map((choice) => ({
        choiceId: choice.id,
        text: choice.text,
      })),
      60
    );

    // Simulate concurrent votes from multiple users
    const users = ['user1', 'user2', 'user3', 'user4', 'user5'];
    const choice = initialChapter.choices[0];

    const votePromises = users.map((userId) =>
      VotingManager.castVote(testPostId, userId, initialChapter.id, choice.id)
    );

    const results = await Promise.all(votePromises);

    // All votes should succeed
    results.forEach((result) => {
      expect(result.success).toBe(true);
    });

    // Check final vote count
    const voteCounts = await VotingManager.getVoteCounts(testPostId, initialChapter.id);
    const choiceVotes = voteCounts.find((vc) => vc.choiceId === choice.id);
    expect(choiceVotes?.count).toBe(users.length);

    // Verify no duplicate votes
    for (const userId of users) {
      const userVoteStatus = await VotingManager.hasUserVoted(
        testPostId,
        userId,
        initialChapter.id
      );
      expect(userVoteStatus.hasVoted).toBe(true);
      expect(userVoteStatus.choiceId).toBe(choice.id);
    }
  });

  it('should prevent duplicate voting', async () => {
    // Initialize story
    const progressionEngine = new StoryProgressionEngine();
    const initialChapter = progressionEngine.getInitialChapter();
    await StoryStateManager.initializeStory(testPostId, initialChapter);

    await VotingManager.createVotingSession(
      testPostId,
      initialChapter.id,
      initialChapter.choices.map((choice) => ({
        choiceId: choice.id,
        text: choice.text,
      })),
      60
    );

    const choice = initialChapter.choices[0];

    // First vote should succeed
    const firstVote = await VotingManager.castVote(
      testPostId,
      testUserId,
      initialChapter.id,
      choice.id
    );
    expect(firstVote.success).toBe(true);

    // Second vote from same user should fail
    const secondVote = await VotingManager.castVote(
      testPostId,
      testUserId,
      initialChapter.id,
      choice.id
    );
    expect(secondVote.success).toBe(false);
    expect(secondVote.message).toContain('already voted');
  });

  it('should handle story reset correctly', async () => {
    // Initialize and progress story
    const progressionEngine = new StoryProgressionEngine();
    const initialChapter = progressionEngine.getInitialChapter();
    const context = await StoryStateManager.initializeStory(testPostId, initialChapter);

    // Add some history
    await StoryStateManager.addToHistory(testPostId, initialChapter.id, 'test-choice');

    // Reset story
    await StoryStateManager.resetStory(testPostId, true);

    // Verify state was reset
    const resetContext = await StoryStateManager.getStoryContext(testPostId);
    expect(resetContext).toBeNull();

    const resetChapter = await StoryStateManager.getCurrentChapter(testPostId);
    expect(resetChapter).toBeNull();

    // History should be preserved
    const history = await StoryStateManager.getStoryHistory(testPostId);
    expect(history.length).toBeGreaterThan(0);
  });

  it('should validate story state consistency', async () => {
    // Initialize story
    const progressionEngine = new StoryProgressionEngine();
    const initialChapter = progressionEngine.getInitialChapter();
    await StoryStateManager.initializeStory(testPostId, initialChapter);

    // Validate initial state
    const validation = await StoryStateManager.validateStoryState(testPostId);
    expect(validation.isValid).toBe(true);
    expect(validation.errors.length).toBe(0);
  });

  it('should handle realtime message broadcasting', async () => {
    // The realtime mock is already set up in the vi.mock above
    const mockRealtime = vi.mocked(await import('@devvit/web/server')).realtime;

    // Test vote update broadcast
    await RealtimeManager.broadcastVoteUpdate(
      testPostId,
      'chapter-1',
      [{ choiceId: 'choice-1', count: 5, percentage: 100 }],
      5
    );

    expect(mockRealtime.send).toHaveBeenCalledWith(
      `haunted_thread_${testPostId}`,
      expect.objectContaining({
        type: 'vote_update',
        data: expect.objectContaining({
          chapterId: 'chapter-1',
          totalVotes: 5,
        }),
      })
    );
  });

  it('should handle story progression with multiple paths', async () => {
    // This test would verify that different choice combinations
    // lead to different story branches and endings
    const progressionEngine = new StoryProgressionEngine();
    const initialChapter = progressionEngine.getInitialChapter();

    // Test multiple story paths by simulating different choice sequences
    const testPaths = [
      [initialChapter.choices[0].id],
      [initialChapter.choices[1].id],
      [initialChapter.choices[2]?.id].filter(Boolean),
    ];

    for (const path of testPaths) {
      const testPostIdForPath = `${testPostId}-path-${path.join('-')}`;
      await StoryStateManager.initializeStory(testPostIdForPath, initialChapter);

      for (const choiceId of path) {
        const result = await progressionEngine.advanceStory(
          testPostIdForPath,
          initialChapter.id,
          choiceId
        );

        expect(result.success).toBe(true);

        if (result.newChapter) {
          // Verify each path produces different content
          expect(result.newChapter.id).toBeTruthy();
          expect(result.newChapter.content).toBeTruthy();
        }
      }
    }
  });
});
