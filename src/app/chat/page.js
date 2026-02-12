"use client";
import { useState, useEffect, useRef, Suspense } from 'react';
import axios from 'axios';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

// --- PART 1: The Inner Component (Your Original Logic) ---
function ChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeConvId = searchParams.get('id'); 

  const [user, setUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);

  // --- HELPER: Normalize Data (Handles Flat vs Nested) ---
  const normalize = (data) => {
    if (!data) return null;
    const isArray = Array.isArray(data);
    const list = isArray ? data : [data];
    
    const cleanList = list.map(item => {
      const attributes = item.attributes || item;
      return {
        id: item.id,
        ...attributes
      };
    });

    return isArray ? cleanList : cleanList[0];
  };

  // --- HELPER: Force Array (Prevents .find crash) ---
  const ensureArray = (data) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    return [data];
  };

  // 1. Load User & Conversations
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    if (!userStr || !token) {
      router.push('/login');
      return;
    }
    
    const userData = JSON.parse(userStr);
    setUser(userData);

    const fetchConversations = async () => {
      try {
        const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/conversations?populate=*&filters[users][id][$eq]=${userData.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Handle "Flat" vs "Nested" main response
        const rawData = res.data.data;
        // Ensure conversations is always an array
        const normConvs = normalize(rawData);
        setConversations(ensureArray(normConvs)); 
        setLoading(false);
      } catch (err) {
        console.error("Error loading chats", err);
        setLoading(false);
      }
    };

    fetchConversations();
  }, [router]);

  // 2. Poll for Messages
  useEffect(() => {
    if (!activeConvId) return;

    const fetchMessages = async () => {
      const token = localStorage.getItem('token');
      try {
        const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/messages?filters[conversation][documentId][$eq]=${activeConvId}&populate=sender&sort=createdAt:asc`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const normMessages = normalize(res.data.data);
        setMessages(ensureArray(normMessages));
      } catch (err) {
        console.error(err);
      }
    };

    fetchMessages(); 
    const interval = setInterval(fetchMessages, 3000); 

    return () => clearInterval(interval);
  }, [activeConvId]);

  // 3. Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConvId) return;

    const token = localStorage.getItem('token');
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/messages`, {
        data: {
          content: newMessage,
          conversation: activeConvId, 
          sender: user.id
        }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setNewMessage('');
      
      // Force refresh immediately
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/messages?filters[conversation][documentId][$eq]=${activeConvId}&populate=sender&sort=createdAt:asc`, {
          headers: { Authorization: `Bearer ${token}` }
      });
      const normMessages = normalize(res.data.data);
      setMessages(ensureArray(normMessages));

    } catch (err) {
      console.error(err);
      alert("Failed to send");
    }
  };

  if (loading) return <div style={{padding:'2rem', textAlign:'center'}}>Loading Chats...</div>;

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f3f4f6' }}>
      
      {/* SIDEBAR */}
      <div style={{ width: '300px', background: 'white', borderRight: '1px solid #ddd', overflowY: 'auto' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid #ddd', background: '#232f3e', color: 'white' }}>
          <Link href="/" style={{color:'white', textDecoration:'none', fontSize:'0.8rem'}}>← Back to Market</Link>
          <h2 style={{margin:'0.5rem 0 0 0'}}>Messages</h2>
        </div>
        
        {conversations.length === 0 && <div style={{padding:'1rem', color:'#666'}}>No conversations yet.</div>}

        {conversations.map((conv) => {
          // --- FIX IS HERE: Guaranteed Array ---
          // 1. Get raw users data
          const rawUsers = conv.users?.data || conv.users;
          // 2. Normalize it
          const normUsers = normalize(rawUsers);
          // 3. FORCE it to be an array so .find() never crashes
          const usersList = ensureArray(normUsers);
          
          const otherUser = usersList.find(u => String(u.id) !== String(user?.id));
          const name = otherUser?.username || "Unknown User";
          const itemTitle = conv.itemTitle || "Product Inquiry";
          
          // Support both Strapi v4 (id) and v5 (documentId)
          const currentId = conv.documentId || conv.id; 
          const isActive = activeConvId === currentId;

          return (
            <div 
              key={currentId}
              onClick={() => router.push(`/chat?id=${currentId}`)}
              style={{
                padding: '1rem', 
                borderBottom: '1px solid #eee', 
                cursor: 'pointer',
                background: isActive ? '#f0f9ff' : 'white',
                borderLeft: isActive ? '4px solid #007185' : '4px solid transparent'
              }}
            >
              <div style={{fontWeight:'bold'}}>{name}</div>
              <div style={{fontSize:'0.8rem', color:'#666'}}>{itemTitle}</div>
            </div>
          );
        })}
      </div>

      {/* CHAT AREA */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {activeConvId ? (
          <>
            <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {messages.map((msg) => {
                const senderData = normalize(msg.sender?.data || msg.sender);
                const isMe = String(senderData?.id) === String(user?.id);

                return (
                  <div key={msg.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                    <div style={{
                      background: isMe ? '#007185' : 'white',
                      color: isMe ? 'white' : 'black',
                      padding: '0.8rem 1.2rem',
                      borderRadius: '12px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                      border: isMe ? 'none' : '1px solid #ddd'
                    }}>
                      {msg.content}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#999', marginTop: '4px', textAlign: isMe ? 'right' : 'left' }}>
                        {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                    </div>
                  </div>
                );
              })}
              <div ref={scrollRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} style={{ padding: '1rem', background: 'white', borderTop: '1px solid #ddd', display: 'flex', gap: '1rem' }}>
              <input 
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                style={{ flex: 1, padding: '0.8rem', borderRadius: '20px', border: '1px solid #ccc', outline: 'none' }}
              />
              <button type="submit" className="btn-primary" style={{ borderRadius: '20px', padding: '0 2rem' }}>Send</button>
            </form>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>
            Select a conversation to start chatting
          </div>
        )}
      </div>
    </div>
  );
}

// --- PART 2: The Outer Wrapper (Fixes the Build Error) ---
export default function ChatPage() {
  return (
    <Suspense fallback={<div style={{padding:'2rem', textAlign:'center'}}>Loading Chat System...</div>}>
      <ChatContent />
    </Suspense>
  );
}