"use client";
import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function WatchLive() {
  const { id } = useParams(); // Document ID
  const [stream, setStream] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const chatEndRef = useRef(null);

  // --- 1. FETCH STREAM ---
  const fetchStreamData = async () => {
    try {
      // Direct ID fetch (Strapi v5)
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/livestreams/${id}?populate=*`);
      setStream(res.data.data);
    } catch (err) { 
      console.error("Stream Load Error:", err);
    }
  };

  // --- 2. FETCH MESSAGES (CASE SENSITIVE FIX) ---
  const fetchMessages = async () => {
    try {
      // FIX: Used 'Livestream' (Capital L) to match your Content-Type Builder name
      const query = `filters[Livestream][documentId][$eq]=${id}&populate=User&sort=createdAt:asc`;
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/livestream-comments?${query}`);
      setMessages(res.data.data);
    } catch (err) { 
      console.error("Chat Load Error (Check Console for details):", err.response?.data || err.message); 
    }
  };

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) setCurrentUser(JSON.parse(user));
    
    if(id) {
      fetchStreamData();
      fetchMessages();
      const interval = setInterval(fetchMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- 3. SEND MESSAGE (CASE SENSITIVE FIX) ---
  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !currentUser) {
       if(!currentUser) alert("Please login to chat");
       return;
    }
    const token = localStorage.getItem('token');
    
    try {
      // FIX: Sending 'Livestream' and 'User' with Capitals
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/livestream-comments`, {
        data: {
          content: chatInput,
          Livestream: id, // <--- Capital L (Matches your Schema)
          User: currentUser.id // <--- Capital U (Matches your Schema)
        }
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      setChatInput('');
      fetchMessages(); 
    } catch (err) { 
      console.error("Send Error:", err.response?.data);
      if (err.response?.status === 403) {
        alert("Permission Error: Check Settings > Roles > Authenticated > Livestream-comment > Create");
      } else {
        alert(`Error: ${err.response?.data?.error?.message || "Failed to send"}`);
      }
    }
  };

  if (!stream) return <div style={{position:'fixed', inset:0, background:'#0f172a', color:'white', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999}}>Loading Stream...</div>;

  // --- 4. DATA NORMALIZATION ---
  const linkedItem = stream.relatedProduct || stream.relatedService;
  const itemType = stream.relatedProduct ? 'product' : 'service';
  
  const getMediaUrl = (item) => {
    if (!item) return null;
    const media = item.media?.data || item.media;
    if (!media) return null;
    const first = Array.isArray(media) ? media[0] : media;
    const url = first.url || first.attributes?.url;
    return url ? `${process.env.NEXT_PUBLIC_API_URL}${url}` : null;
  };
  const imgUrl = getMediaUrl(linkedItem);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#0f172a', color: 'white', display: 'flex', zIndex: 9999, fontFamily: 'sans-serif' }}>
      
      {/* LEFT: VIDEO */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1rem', position:'relative' }}>
        <div style={{ marginBottom:'10px' }}>
            <Link href="/" style={{color:'#cbd5e1', textDecoration:'none', fontWeight:'bold', background:'#334155', padding:'5px 10px', borderRadius:'4px'}}>← Exit</Link>
        </div>
        
        <div style={{ flex: 1, background: 'black', borderRadius: '12px', overflow: 'hidden', position: 'relative', border:'1px solid #334155', display:'flex', alignItems:'center', justifyContent:'center' }}>
          {stream.streamUrl ? (
             <iframe 
               src={stream.streamUrl.includes('youtube') && !stream.streamUrl.includes('embed') 
                 ? stream.streamUrl.replace("watch?v=", "embed/") 
                 : stream.streamUrl} 
               width="100%" height="100%" 
               frameBorder="0" allowFullScreen 
               style={{ width:'100%', height:'100%' }}
             />
          ) : (
             <h3>No Video URL provided</h3>
          )}
        </div>
        
        <div style={{ marginTop: '1rem' }}>
          <h1 style={{ margin: 0, fontSize:'1.5rem' }}>{stream.title}</h1>
          <p style={{ color: '#94a3b8' }}>
            Host: <strong style={{color:'#38bdf8'}}>
              {stream.seller?.username || 'Seller'}
            </strong>
          </p>
        </div>
      </div>

      {/* RIGHT: SIDEBAR */}
      <div style={{ width: '350px', background: '#1e293b', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #334155', boxShadow:'-5px 0 15px rgba(0,0,0,0.3)' }}>
        
        {/* ITEM CARD */}
        <div style={{ padding: '1rem', background: '#0f172a', borderBottom: '1px solid #334155' }}>
            <h4 style={{ margin: '0 0 0.8rem 0', color: '#fbbf24', fontSize:'0.9rem', textTransform:'uppercase' }}>
              ⚡ Featured Now
            </h4>
            
            {linkedItem ? (
              <div style={{ display: 'flex', gap: '10px', background: 'white', padding: '10px', borderRadius: '8px', alignItems: 'center' }}>
                 <div style={{ width: '60px', height: '60px', background: '#eee', borderRadius: '4px', overflow: 'hidden', flexShrink:0 }}>
                   {imgUrl ? <img src={imgUrl} style={{width:'100%', height:'100%', objectFit:'cover'}} /> : <div style={{width:'100%', height:'100%', background:'#ddd'}}/>}
                 </div>
                 <div style={{ flex: 1, overflow: 'hidden' }}>
                   <div style={{ color: '#0f172a', fontWeight: 'bold', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                     {linkedItem.name}
                   </div>
                   <div style={{ color: '#B12704', fontWeight: 'bold', fontSize: '1rem' }}>
                     Rp {linkedItem.price?.toLocaleString()}
                   </div>
                 </div>
                 <Link href={`/item/${linkedItem.documentId || linkedItem.id}?type=${itemType}`} target="_blank">
                   <button style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontWeight: 'bold', fontSize:'0.9rem' }}>
                     BUY
                   </button>
                 </Link>
              </div>
            ) : (
              <div style={{textAlign:'center', color:'#64748b', fontSize:'0.85rem', padding:'10px', border:'1px dashed #334155', borderRadius:'6px'}}>
                No product linked.
              </div>
            )}
        </div>

        {/* CHAT MESSAGES */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {messages.length === 0 && <div style={{color:'#64748b', textAlign:'center', marginTop:'2rem'}}>Chat is quiet...</div>}
          
          {messages.map((msg, i) => {
            // FIX: Handle User relation (Capital U might be returned in API depending on settings)
            // We check both 'User' and 'user' to be safe
            const uData = msg.User || msg.user || {}; 
            return (
              <div key={i} style={{ fontSize: '0.9rem', lineHeight:'1.4' }}>
                <span style={{ fontWeight: 'bold', color: uData.id === currentUser?.id ? '#fbbf24' : '#38bdf8', marginRight:'6px' }}>
                  {uData.username || 'Guest'}: 
                </span>
                <span style={{ color: '#e2e8f0', marginLeft:'5px' }}>{msg.content}</span>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* CHAT INPUT */}
        <form onSubmit={handleSendChat} style={{ padding: '1rem', borderTop: '1px solid #334155', display: 'flex', gap: '0.5rem', background:'#1e293b' }}>
          <input 
            value={chatInput} 
            onChange={(e) => setChatInput(e.target.value)}
            placeholder={currentUser ? "Chat here..." : "Login to chat"} 
            disabled={!currentUser}
            style={{ flex: 1, padding: '0.8rem', borderRadius: '24px', border: 'none', background: '#334155', color: 'white', outline: 'none' }}
          />
          <button type="submit" disabled={!currentUser} style={{ background: currentUser ? '#2563eb' : '#475569', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer' }}>
            ➤
          </button>
        </form>

      </div>
    </div>
  );
}