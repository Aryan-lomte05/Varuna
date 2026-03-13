import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Interface matching the Python backend's output stream structure
 */
export interface ChatMessage {
  id: string; // Internal ID for tracking
  role: 'user' | 'assistant' | 'system';
  content: string; // The streaming text content
  trace_id?: string;
  isStreaming?: boolean;
  metadata?: {
    intent?: string;
    sql?: string;
    rows?: any[]; // Raw data returned from PostgreSQL
    viz_specs?: any; // The auto-generated Plotly JSON Spec
    float_ids?: string[]; // E.g. [ "1902303" ]
  };
}

export function useChatStream() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const currentMessageIdRef = useRef<string | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const wsUrl = apiUrl.replace('http', 'ws');
    
    try {
      const ws = new WebSocket(`${wsUrl}/ws/chat?token=dev-token`);
      
      ws.onopen = () => {
        console.log('🔗 WebSocket connected to Backend');
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const { type, data } = msg;
          
          if (type === 'token') {
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (!last || last.role !== 'assistant') return prev;
              return [ ...prev.slice(0, -1), { ...last, content: last.content + data } ];
            });
          }
          else if (type === 'intent') {
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (!last || last.role !== 'assistant') return prev;
              return [ ...prev.slice(0, -1), { ...last, metadata: { ...last.metadata, intent: data } } ];
            });
          }
          else if (type === 'sql') {
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (!last || last.role !== 'assistant') return prev;
              return [ ...prev.slice(0, -1), { ...last, metadata: { ...last.metadata, sql: data } } ];
            });
          }
          else if (type === 'rows') {
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (!last || last.role !== 'assistant') return prev;
              return [ ...prev.slice(0, -1), { ...last, metadata: { ...last.metadata, rows: data } } ];
            });
          }
          else if (type === 'viz') {
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (!last || last.role !== 'assistant') return prev;
              return [ ...prev.slice(0, -1), { ...last, metadata: { ...last.metadata, viz_specs: data } } ];
            });
          }
          else if (type === 'done') {
            setIsTyping(false);
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (!last || last.role !== 'assistant') return prev;
              return [ ...prev.slice(0, -1), { ...last, isStreaming: false, trace_id: data.trace_id } ];
            });
          }
          else if (type === 'error') {
            setIsTyping(false);
            setError(data);
          }
        } catch (e) {
          console.error('Failed to parse WS message', e, event.data);
        }
      };

      ws.onerror = (err) => {
        console.error('WS Error:', err);
        setError('Connection to intelligence core lost.');
        setIsTyping(false);
      };

      ws.onclose = () => {
        console.log('WS Closed. Reconnecting in 3s...');
        wsRef.current = null;
        setTimeout(() => connect(), 3000);
      };

      wsRef.current = ws;
    } catch (e) {
      console.error("Failed to initialize WebSocket:", e);
      setTimeout(() => connect(), 3000);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnect loop on unmount
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((content: string) => {
    if (!content.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        setError("WebSocket is not connected. Is the Python Backend running?");
      }
      return;
    }

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content
    };

    // Add user message and a blank assistant message that will be populated via stream
    setMessages(prev => [
      ...prev, 
      newMessage,
      {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        isStreaming: true
      }
    ]);
    
    setInput('');
    setIsTyping(true);
    setError(null);

    // Send to Gateway -> Python Backend
    wsRef.current.send(JSON.stringify({
      question: content,
      session: "default" // TODO: dynamic session
    }));
  }, [messages]);

  return {
    messages,
    input,
    setInput,
    sendMessage,
    isTyping,
    error
  };
}
