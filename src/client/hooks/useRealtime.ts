import { useEffect, useCallback, useRef, useState } from 'react';
import { connectRealtime } from '@devvit/web/client';
import { 
  RealtimeMessage, 
  VoteUpdateMessage, 
  ChapterTransitionMessage, 
  StoryResetMessage, 
  VotingEndedMessage,
  ConnectionTestMessage 
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
  onError
}: UseRealtimeProps): UseRealtimeReturn => {
  const connectionRef = useRef<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelayMs = 2000;

  // Generate channel name using the same format as server
  const channelName = `haunted_thread_${postId}`;

  const handleMessage = useCallback((data: any) => {
    try {
      // Parse the message if it's a string
      const message: RealtimeMessage = typeof data === 'string' ? JSON.parse(data) : data;
      
      console.log('Received realtime message:', message);

      switch (message.type) {
        case 'vote_update':
          onVoteUpdate?.(message as VoteUpdateMessage);
          break;
        case 'chapter_transition':
          onChapterTransition?.(message as ChapterTransitionMessage);
          break;
        case 'story_reset':
          onStoryReset?.(message as StoryResetMessage);
          break;
        case 'voting_ended':
          onVotingEnded?.(message as VotingEndedMessage);
          break;
        case 'connection_test':
          console.log('Realtime connection test received:', (message as ConnectionTestMessage).data);
          break;
        default:
          console.warn('Unknown realtime message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling realtime message:', error);
      onError?.(error instanceof Error ? error : new Error('Failed to parse realtime message'));
    }
  }, [onVoteUpdate, onChapterTransition, onStoryReset, onVotingEnded, onError]);

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

  const handleDisconnect = useCallback((channel: string) => {
    console.log(`Disconnected from realtime channel: ${channel}`);
    setIsConnected(false);
    setConnectionStatus('disconnected');
    
    // Attempt to reconnect if we haven't exceeded max attempts
    if (reconnectAttemptsRef.current < maxReconnectAttempts) {
      console.log(`Attempting to reconnect (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);
      setConnectionStatus('connecting');
      
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectAttemptsRef.current++;
        connect();
      }, reconnectDelayMs * Math.pow(2, reconnectAttemptsRef.current)); // Exponential backoff
    } else {
      console.error('Max reconnection attempts reached');
      setConnectionStatus('error');
      onError?.(new Error('Failed to maintain realtime connection after multiple attempts'));
    }
  }, [onError]);

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
      setConnectionStatus('error');
      setIsConnected(false);
      onError?.(error instanceof Error ? error : new Error('Failed to establish realtime connection'));
      
      // Attempt to reconnect if we haven't exceeded max attempts
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++;
          connect();
        }, reconnectDelayMs * Math.pow(2, reconnectAttemptsRef.current));
      }
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
    reconnect
  };
};
