"use client";
import { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function WatchPage() {
  const params = useParams();
  const id = params?.id; // This will now be the documentId (e.g., "fq24pu...")
  
  const [stream, setStream] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fix YouTube Links
  const getEmbedUrl = (url) => {
    if (!url) return '';
    if (url.includes('watch?v=')) return url.replace('watch?v=', 'embed/');
    if (url.includes('youtu.be/')) return url.replace('youtu.be/', 'youtube.com/embed/');
    return url;
  };

  useEffect(() => {
    const fetchStream = async () => {
      if (!id) return;
      try {
        // In Strapi v5, fetching by documentId uses the same URL structure:
        // /api/livestreams/:documentId
        const res = await axios.get(`http://localhost:1337/api/livestreams/${id}?populate=*`);
        setStream(res.data.data);
      } catch (error) {
        console.error("Error loading stream", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStream();
  }, [id]);

  if (loading) return <div className="container" style={{padding:'2rem', textAlign:'center'}}>Loading Studio...</div>;
  if (!stream) return <div className="container" style={{padding:'2rem', textAlign:'center'}}>Stream not found.</div>;

  const data = stream.attributes || stream;
  const seller = data.seller?.data?.attributes || data.seller;
  const safeUrl = getEmbedUrl(data.streamUrl);

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      <nav className="navbar">
        <h1 style={{ margin:0 }}>Live Stage 🔴</h1>
        <div className="nav-links">
           <Link href="/" style={{color:'white', textDecoration:'none', fontWeight:'bold'}}>&larr; Exit to Lobby</Link>
        </div>
      </nav>

      <main className="container" style={{ marginTop: '2rem', maxWidth: '1000px' }}>
        <div className="card" style={{ padding: '0', overflow: 'hidden', border: 'none' }}>
          {/* VIDEO PLAYER */}
          <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, background: 'black' }}>
            {safeUrl ? (
              <iframe 
                src={safeUrl} 
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
              />
            ) : (
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Invalid URL</div>
            )}
          </div>
          
          <div className="card-body" style={{ padding: '1.5rem' }}>
            <h1 style={{ margin: '0 0 0.5rem 0', color: '#111827', fontSize: '1.5rem' }}>{data.title}</h1>
            <p style={{ margin: 0, color: '#4b5563' }}>Hosted by: <strong>{seller?.shopName || seller?.username}</strong></p>
          </div>
        </div>
      </main>
    </div>
  );
}