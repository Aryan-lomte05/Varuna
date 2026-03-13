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

  // Initialize WebSocket connection to the Node API Gateway
  useEffect(() => {
    // In dev: proxy via next.config.js or direct. 
    // Here we point directly to our Gateway WebSocket endpoint
    const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_WS_URL || 'ws://localhost:4000';
    
    // Pass dev-token to bypass Gateway Auth for now
    const ws = new WebSocket(`${gatewayUrl}/ws/chat?token=dev-token`);
    
    ws.onopen = () => {
      console.log('🔗 WebSocket connected to Gateway');
      setError(null);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { type, data } = msg;
        
        // 1. Handle streaming tokens
        if (type === 'token') {
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (!last || last.role !== 'assistant') return prev;
            
            return [
              ...prev.slice(0, -1),
              { ...last, content: last.content + data }
            ];
          });
        }
        
        // 2. Handle Intent detection
        else if (type === 'intent') {
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (!last || last.role !== 'assistant') return prev;
            return [
              ...prev.slice(0, -1),
              { ...last, metadata: { ...last.metadata, intent: data } }
            ];
          });
        }

        // 3. Handle SQL
        else if (type === 'sql') {
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (!last || last.role !== 'assistant') return prev;
            return [
              ...prev.slice(0, -1),
              { ...last, metadata: { ...last.metadata, sql: data } }
            ];
          });
        }

        // 4. Handle Rows (data)
        else if (type === 'rows') {
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (!last || last.role !== 'assistant') return prev;
            return [
              ...prev.slice(0, -1),
              { ...last, metadata: { ...last.metadata, rows: data } }
            ];
          });
        }

        // 5. Handle Viz specs
        else if (type === 'viz') {
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (!last || last.role !== 'assistant') return prev;
            return [
              ...prev.slice(0, -1),
              { ...last, metadata: { ...last.metadata, viz_specs: data } }
            ];
          });
        }

        // 6. Handle Completion
        else if (type === 'done') {
          setIsTyping(false);
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (!last || last.role !== 'assistant') return prev;
            return [
              ...prev.slice(0, -1),
              { ...last, isStreaming: false, trace_id: data.trace_id }
            ];
          });
        }

        // 7. Handle Error
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
      console.log('WS Closed');
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, []);

  const sendMessage = useCallback((content: string) => {
    if (!content.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        setError("WebSocket is not connected. Is the Gateway running?");
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
