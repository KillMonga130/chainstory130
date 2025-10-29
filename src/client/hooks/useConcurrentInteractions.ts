import { useState, useCallback, useRef } from 'react';

interface PendingAction {
  id: string;
  type: 'vote' | 'story_action';
  timestamp: number;
  data: any;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
}

interface ActionQueue {
  pending: Map<string, PendingAction>;
  processing: Set<string>;
}

interface UseConcurrentInteractionsReturn {
  isProcessing: boolean;
  pendingActionsCount: number;
  queueAction: <T>(
    type: 'vote' | 'story_action',
    data: any,
    executor: () => Promise<T>
  ) => Promise<T>;
  cancelAction: (actionId: string) => void;
  clearQueue: () => void;
  getQueueStatus: () => {
    pending: number;
    processing: number;
  };
}

export const useConcurrentInteractions = (): UseConcurrentInteractionsReturn => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingActionsCount, setPendingActionsCount] = useState(0);

  const queueRef = useRef<ActionQueue>({
    pending: new Map(),
    processing: new Set(),
  });

  const updateCounts = useCallback(() => {
    const queue = queueRef.current;
    setPendingActionsCount(queue.pending.size);
    setIsProcessing(queue.processing.size > 0);
  }, []);

  const generateActionId = useCallback(() => {
    return `action_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }, []);

  const queueAction = useCallback(
    <T>(type: 'vote' | 'story_action', data: any, executor: () => Promise<T>): Promise<T> => {
      return new Promise((resolve, reject) => {
        const actionId = generateActionId();
        const queue = queueRef.current;

        // Check for duplicate actions (same type and data)
        const existingAction = Array.from(queue.pending.values()).find(
          (action) => action.type === type && JSON.stringify(action.data) === JSON.stringify(data)
        );

        if (existingAction) {
          console.log(`Duplicate action detected, rejecting: ${actionId}`);
          reject(new Error('Duplicate action already in progress'));
          return;
        }

        const action: PendingAction = {
          id: actionId,
          type,
          timestamp: Date.now(),
          data,
          resolve,
          reject,
        };

        // Add to pending queue
        queue.pending.set(actionId, action);
        updateCounts();

        console.log(`Queued action: ${actionId} (${type})`);

        // Process the action immediately if it's a vote (votes should be processed quickly)
        // or if no other actions of the same type are processing
        const shouldProcessImmediately =
          type === 'vote' ||
          !Array.from(queue.processing).some((id) => {
            const processingAction = queue.pending.get(id);
            return processingAction?.type === type;
          });

        if (shouldProcessImmediately) {
          processAction(actionId, executor);
        }
      });
    },
    [generateActionId, updateCounts]
  );

  const processAction = useCallback(
    async <T>(actionId: string, executor: () => Promise<T>) => {
      const queue = queueRef.current;
      const action = queue.pending.get(actionId);

      if (!action) {
        console.warn(`Action not found in queue: ${actionId}`);
        return;
      }

      try {
        // Move from pending to processing
        queue.processing.add(actionId);
        updateCounts();

        console.log(`Processing action: ${actionId} (${action.type})`);

        // Execute the action
        const result = await executor();

        // Resolve the promise
        action.resolve(result);
        console.log(`Action completed successfully: ${actionId}`);
      } catch (error) {
        console.error(`Action failed: ${actionId}`, error);
        action.reject(error instanceof Error ? error : new Error('Unknown error'));
      } finally {
        // Clean up
        queue.pending.delete(actionId);
        queue.processing.delete(actionId);
        updateCounts();

        // Process next action of the same type if any
        const nextAction = Array.from(queue.pending.values())
          .filter((a) => a.type === action.type)
          .sort((a, b) => a.timestamp - b.timestamp)[0];

        if (nextAction) {
          // Process the next action after a short delay to prevent overwhelming the server
          setTimeout(() => {
            processAction(nextAction.id, async () => {
              // This is a placeholder - the actual executor should be stored with the action
              throw new Error('Executor not available for queued action');
            });
          }, 100);
        }
      }
    },
    [updateCounts]
  );

  const cancelAction = useCallback(
    (actionId: string) => {
      const queue = queueRef.current;
      const action = queue.pending.get(actionId);

      if (action) {
        console.log(`Cancelling action: ${actionId}`);
        action.reject(new Error('Action cancelled by user'));
        queue.pending.delete(actionId);
        queue.processing.delete(actionId);
        updateCounts();
      }
    },
    [updateCounts]
  );

  const clearQueue = useCallback(() => {
    const queue = queueRef.current;

    console.log(`Clearing ${queue.pending.size} pending actions`);

    // Reject all pending actions
    queue.pending.forEach((action) => {
      action.reject(new Error('Queue cleared'));
    });

    // Clear all queues
    queue.pending.clear();
    queue.processing.clear();
    updateCounts();
  }, [updateCounts]);

  const getQueueStatus = useCallback(() => {
    const queue = queueRef.current;
    return {
      pending: queue.pending.size,
      processing: queue.processing.size,
    };
  }, []);

  return {
    isProcessing,
    pendingActionsCount,
    queueAction,
    cancelAction,
    clearQueue,
    getQueueStatus,
  };
};
