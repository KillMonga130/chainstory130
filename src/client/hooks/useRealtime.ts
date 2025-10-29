import { useEffect, useCallback, useRef, useState } from 'react';
import { connectRealtime } from '@devvit/web/client';
import {
  RealtimeMessage,
  VoteUpdateMessage,
  ChapterTransitionMessage,
  StoryResetMessage,
  VotingEndedMessage,
  ConnectionTestMessage,
} from '../../shared/types/api';

interface UseRealtimeProps {
  postId: string;
  onVoteUpdate?: (message: VoteUpdateMessage) => void;
  onChapterTransition?: (message: ChapterTransitionMessage) => void;
  onStoryReset?: (message: StoryResetMessage) => void;
  onVotingEnded?: (message: VotingEndedMessage) => void;
  onError?: (error: Error) => void;
}

interface UseRealtimeReturn {
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  disconnect: () => Promise<void>;
  reconnect: () => Promise<void>;
}

export const useRealtime = ({
  postId,
  onVoteUpdate,
  onChapterTransition,
  onStoryReset,
  onVotingEnded,
  onError,
}: UseRealtimeProps): UseRealtimeReturn => {
  const connectionRef = useRef<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'disconnected' | 'error'
  >('disconnected');
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3;
  const reconnectDelayMs = 5000; // Increased to reduce connection spam
  const isReconnecting = useRef(false);

  // Generate channel name using the same format as server
  const channelName = `haunted_thread_${postId}`;

  console.log('🔌 Realtime hook initialized with channel:', channelName, 'postId:', postId);

  const handleMessage = useCallback(
    (data: any) => {
      try {
        // Parse the message if it's a string
        const message: RealtimeMessage = typeof data === 'string' ? JSON.parse(data) : data;

        console.log('📨 REALTIME MESSAGE RECEIVED:', message.type, message);

        switch (message.type) {
          case 'vote_update':
            console.log('🗳️ Processing vote update message');
            onVoteUpdate?.(message as VoteUpdateMessage);
            break;
          case 'chapter_transition':
            console.log('🔄 Processing chapter transition message');
            onChapterTransition?.(message as ChapterTransitionMessage);
            break;
          case 'story_reset':
            onStoryReset?.(message as StoryResetMessage);
            break;
          case 'voting_ended':
            onVotingEnded?.(message as VotingEndedMessage);
            break;
          case 'connection_test':
            console.log(
              'Realtime connection test received:',
              (message as ConnectionTestMessage).data
            );
            break;
          default:
            console.warn('Unknown realtime message type:', message.type);
        }
      } catch (error) {
        console.error('Error handling realtime message:', error);
        onError?.(error instanceof Error ? error : new Error('Failed to parse realtime message'));
      }
    },
    [onVoteUpdate, onChapterTransition, onStoryReset, onVotingEnded, onError]
  );

  const handleConnect = useCallback((channel: string) => {
    console.log(`Connected to realtime channel: ${channel}`);
    setIsConnected(true);
    setConnectionStatus('connected');
    reconnectAttemptsRef.current = 0;

    // Clear any pending reconnection attempts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const handleDisconnect = useCallback(
    (channel: string) => {
      console.log(`Disconnected from realtime channel: ${channel}`);
      setIsConnected(false);
      setConnectionStatus('disconnected');

      // Only attempt to reconnect if we haven't exceeded max attempts and it wasn't a manual disconnect
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        console.log(
          `Attempting to reconnect (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`
        );
        setConnectionStatus('connecting');

        // Prevent reconnection storm
        if (isReconnecting.current) {
          console.log('⏸️ Reconnection already in progress, skipping...');
          return;
        }

        isReconnecting.current = true;
        reconnectTimeoutRef.current = setTimeout(
          () => {
            reconnectAttemptsRef.current++;
            isReconnecting.current = false;
            connect();
          },
          reconnectDelayMs + reconnectAttemptsRef.current * 2000 // Longer backoff to prevent resource exhaustion
        );
      } else {
        console.warn(
          '⚠️ Max reconnection attempts reached, disabling realtime. Polling fallback active.'
        );
        setConnectionStatus('disconnected');
        isReconnecting.current = false;
      }
    },
    [onError]
  );

  const connect = useCallback(async () => {
    try {
      // Disconnect existing connection if any
      if (connectionRef.current) {
        await connectionRef.current.disconnect();
      }

      setConnectionStatus('connecting');
      console.log(`Connecting to realtime channel: ${channelName}`);

      const connection = await connectRealtime({
        channel: channelName,
        onConnect: handleConnect,
        onDisconnect: handleDisconnect,
        onMessage: handleMessage,
      });

      connectionRef.current = connection;
    } catch (error) {
      console.error('Failed to connect to realtime:', error);

      // If we've exceeded max attempts, set to disconnected instead of error
      // This allows the app to function without realtime
      if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        console.warn(
          'Max reconnection attempts reached. App will function without realtime updates.'
        );
        setConnectionStatus('disconnected');
        setIsConnected(false);
        return;
      }

      setConnectionStatus('error');
      setIsConnected(false);
      onError?.(
        error instanceof Error ? error : new Error('Failed to establish realtime connection')
      );

      // Attempt to reconnect if we haven't exceeded max attempts
      reconnectTimeoutRef.current = setTimeout(
        () => {
          reconnectAttemptsRef.current++;
          connect();
        },
        reconnectDelayMs * Math.pow(2, reconnectAttemptsRef.current)
      );
    }
  }, [channelName, handleConnect, handleDisconnect, handleMessage, onError]);

  const disconnect = useCallback(async () => {
    try {
      // Clear any pending reconnection attempts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (connectionRef.current) {
        console.log('Manually disconnecting from realtime channel');
        await connectionRef.current.disconnect();
        connectionRef.current = null;
      }

      setIsConnected(false);
      setConnectionStatus('disconnected');
      reconnectAttemptsRef.current = 0;
    } catch (error) {
      console.error('Error disconnecting from realtime:', error);
      onError?.(error instanceof Error ? error : new Error('Failed to disconnect from realtime'));
    }
  }, [onError]);

  const reconnect = useCallback(async () => {
    console.log('Manual reconnection requested');
    reconnectAttemptsRef.current = 0;
    await connect();
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      // Cleanup on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (connectionRef.current) {
        connectionRef.current.disconnect().catch((error: any) => {
          console.error('Error disconnecting on cleanup:', error);
        });
      }
    };
  }, [connect]);

  return {
    isConnected,
    connectionStatus,
    disconnect,
    reconnect,
  };
};
