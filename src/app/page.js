"use client";
import { useEffect, useState } from 'react';
import axios from 'axios';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Marketplace() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [streams, setStreams] = useState([]);
  const [search, setSearch] = useState('');
  const [user, setUser] = useState(null);

  // --- HELPER: Generate Star String (e.g. "★★★★☆") ---
  const renderStars = (rating) => {
    const rounded = Math.round(rating); // Round to nearest whole number
    return "★".repeat(rounded) + "☆".repeat(5 - rounded);
  };

  // --- NORMALIZE DATA ---
  const normalizeData = (list, type) => {
    if (!list) return [];

    const getFirstMedia = (mediaField) => {
      if (!mediaField) return null;
      const unwrapped = mediaField.data || mediaField;
      if (!unwrapped) return null;
      const firstItem = Array.isArray(unwrapped) ? unwrapped[0] : unwrapped;
      if (!firstItem) return null;
      const finalAttrs = firstItem.attributes || firstItem;
      if (!finalAttrs.url) return null;
      return { url: finalAttrs.url, mime: finalAttrs.mime };
    };

    return list.map((item) => {
      const data = item.attributes || item;
      const sellerData = data.seller?.data?.attributes || data.seller;
      const shopName = sellerData?.shopName || sellerData?.username || "Unknown Shop";
      
      const firstMedia = getFirstMedia(data.media);
      const mediaUrl = firstMedia?.url || null;
      const mimeType = firstMedia?.mime || '';

      // --- NEW: CALCULATE RATINGS ---
      // 1. Get the reviews array (safely handle Strapi v4/v5 structures)
      const reviews = data.reviews?.data || data.reviews || [];
      
      // 2. Calculate Stats
      const reviewCount = reviews.length;
      let averageRating = 0;
      
      if (reviewCount > 0) {
        const totalStars = reviews.reduce((acc, review) => {
          const rData = review.attributes || review;
          return acc + (rData.rating || 0);
        }, 0);
        averageRating = totalStars / reviewCount;
      }

      return {
        id: item.id,
        documentId: item.documentId || item.id,
        ...data,
        type: type,
        sellerName: shopName,
        mediaUrl: mediaUrl,
        isVideo: mimeType.startsWith('video/'),
        // Add stats to the object
        reviewCount: reviewCount, 
        rating: averageRating
      };
    });
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) setUser(JSON.parse(storedUser));

    const fetchData = async () => {
      try {
        // We add populate=* to ensure we get the 'reviews' relation
        const p = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/products?populate=*`);
        const s = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/services?populate=*`);
        const l = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/livestreams?populate=*`);

        const products = normalizeData(p.data.data, 'product');
        const services = normalizeData(s.data.data, 'service');
        
        const activeStreams = l.data.data
          .map(item => {
             const d = item.attributes || item;
             const sInfo = d.seller?.data?.attributes || d.seller;
             return { 
               id: item.id, 
               documentId: item.documentId || item.id, 
               title: d.title, 
               isLive: d.isLive, 
               sellerName: sInfo?.shopName || "Seller" 
             };
          })
          .filter(stream => stream.isLive === true);

        setItems([...products, ...services]);
        setStreams(activeStreams);
      } catch (e) { console.error("Fetch error", e); }
    };
    fetchData();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    router.refresh();
  };

  const filteredItems = items.filter(item => 
    (item.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (item.sellerName || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <Script src="https://app.sandbox.midtrans.com/snap/snap.js" data-client-key="YOUR_CLIENT_KEY" />
      
      {/* --- NAVBAR --- */}
      <nav className="navbar">
        <Link href="/" className="nav-logo">
           MSME<span style={{color:'#febd69'}}>.id</span>
        </Link>
        
        <div className="nav-search-container">
          <input 
            type="text" 
            className="nav-search-input" 
            placeholder="Search MSME..." 
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="nav-search-btn">🔍</button>
        </div>

        <div className="nav-links">
           {!user && (
             <Link href="/login" className="nav-item">
               <span>Hello, sign in</span>
               <span>Account & Lists</span>
             </Link>
           )}

           {user && (
             <>
               <div className="nav-item">
                 <span>Hello, {user.username}</span>
                 <span>Your Account</span>
               </div>
               
               {user.isSeller && (
                 <Link href="/seller" className="nav-item" style={{border:'1px solid white', padding:'2px 5px'}}>
                   <span>Seller</span>
                   <span>Zone</span>
                 </Link>
               )}

               <button onClick={handleLogout} style={{background:'none', border:'none', color:'white', fontWeight:'bold', cursor:'pointer'}}>
                 Sign Out
               </button>
             </>
           )}
           
           <div className="nav-item">
             <span>Returns</span>
             <span>& Orders</span>
           </div>
           
           <div className="nav-item">
             <span style={{fontSize:'1.5rem'}}>🛒</span>
           </div>
        </div>
      </nav>

      <main className="container">
        
        {/* --- LIVE SECTION --- */}
        {streams.length > 0 && (
          <div style={{ background:'white', padding:'1rem', marginBottom:'2rem', border:'1px solid #ddd' }}>
              <h3 style={{margin:'0 0 1rem 0'}}>Amazon Live | MSME Edition</h3>
              <div style={{display:'flex', gap:'1rem', overflowX:'auto'}}>
                {streams.map((stream) => (
                  <Link key={stream.id} href={`/live/${stream.documentId}`} style={{textDecoration:'none', color:'inherit', minWidth:'250px'}}>
                    <div style={{position:'relative'}}>
                      <div style={{height:'140px', background:'#232f3e', display:'flex', alignItems:'center', justifyContent:'center', color:'white'}}>
                        ▶ Watch Live
                      </div>
                      <div style={{padding:'0.5rem'}}>
                        <span style={{color:'#cc0c39', fontWeight:'bold', fontSize:'0.8rem'}}>LIVE</span>
                        <div style={{fontWeight:'bold'}}>{stream.title}</div>
                        <div style={{fontSize:'0.8rem', color:'#565959'}}>{stream.sellerName}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
          </div>
        )}

        {/* --- PRODUCT GRID --- */}
        <div className="grid-4">
          {filteredItems.map((item) => (
            <div key={`${item.type}-${item.id}`} className="card">
              
              <Link href={`/item/${item.documentId}?type=${item.type}`} style={{textDecoration:'none', color:'inherit'}}>
                <div className="card-image" style={{ cursor: 'pointer' }}>
                    {item.mediaUrl ? (
                      item.isVideo ? (
                          <video src={`${process.env.NEXT_PUBLIC_API_URL}${item.mediaUrl}`} style={{maxWidth:'100%', maxHeight:'100%'}} />
                      ) : (
                          <img src={`${process.env.NEXT_PUBLIC_API_URL}${item.mediaUrl}`} alt={item.name} style={{width:'100%', height:'100%', objectFit:'contain'}} />
                      )
                    ) : (
                      <div style={{color:'#ccc', display:'flex', alignItems:'center', justifyContent:'center', height:'100%', background:'#f3f4f6'}}>No Image</div>
                    )}
                </div>
              </Link>
              
              <div className="card-body">
                <Link href={`/item/${item.documentId}?type=${item.type}`} style={{textDecoration:'none', color:'inherit'}}>
                   <h3 style={{cursor:'pointer'}}>{item.name}</h3>
                </Link>
                
                {/* --- UPDATED RATING SECTION --- */}
                <div style={{color:'#ffa41c', fontSize:'0.9rem', margin:'0.2rem 0', display:'flex', alignItems:'center', gap:'5px'}}>
                   {/* 1. Show Stars based on Average */}
                   <span style={{fontSize:'1.1rem', letterSpacing:'-2px'}}>
                      {renderStars(item.rating || 0)}
                   </span>
                   
                   {/* 2. Show Numeric Average (optional, good for precision) */}
                   <span style={{color:'#333', fontSize:'0.8rem', fontWeight:'bold'}}>
                     {item.rating > 0 ? item.rating.toFixed(1) : ''}
                   </span>

                   {/* 3. Show Count */}
                   <span style={{color:'#007185', fontSize:'0.85rem'}}>
                      ({item.reviewCount || 0})
                   </span>
                </div>
                
                <div className="price-tag">
                   <span style={{fontSize:'0.8rem', position:'relative', top:'4px'}}>Rp</span>
                   <span style={{fontWeight:'bold'}}>{item.price?.toLocaleString()}</span>
                </div>
                
                <div className="seller-badge">
                  Sold by {item.sellerName}
                </div>
                
                <div style={{color:'#565959', fontSize:'0.8rem', marginBottom:'1rem'}}>
                   Delivery by <span style={{fontWeight:'bold'}}>Tomorrow</span>
                </div>

                <Link href={`/item/${item.documentId}?type=${item.type}`} style={{width:'100%'}}>
                   <button className="btn-primary" style={{width:'100%'}}>View Options</button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}