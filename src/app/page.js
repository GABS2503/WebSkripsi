"use client";
import { useEffect, useState } from 'react';
import axios from 'axios';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// --- DYNAMIC IMPORT FOR STORE MAP ---
const StoreMap = dynamic(() => import('@/components/StoreMap'), { ssr: false });

// --- SMART IMAGE HELPER ---
const getImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('//')) return url;
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:1337';
  return `${baseUrl}${url}`;
};

export default function Marketplace() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [streams, setStreams] = useState([]);
  const [sellersMapLocations, setSellersMapLocations] = useState([]); 
  const [search, setSearch] = useState('');
  const [user, setUser] = useState(null);

  // --- MAP TOGGLE STATE ---
  const [showMap, setShowMap] = useState(false);

  // --- STATE FOR RANDOM MOVING IMAGES ---
  const [featuredItems, setFeaturedItems] = useState([]);

  // --- FILTERS & SORTING STATE ---
  const [typeFilter, setTypeFilter] = useState('all'); 
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortPrice, setSortPrice] = useState('none'); 

  // --- HELPER: Generate Star String ---
  const renderStars = (rating) => {
    const rounded = Math.round(rating); 
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
      const mediaUrl = getImageUrl(firstMedia?.url);
      const mimeType = firstMedia?.mime || '';

      const reviews = data.reviews?.data || data.reviews || [];
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
        seller: sellerData,
        sellerName: shopName,
        mediaUrl: mediaUrl, 
        isVideo: mimeType.startsWith('video/'),
        reviewCount: reviewCount, 
        rating: averageRating,
        isPromo: data.isPromo || false,
        promoPrice: data.promoPrice || null
      };
    });
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) setUser(JSON.parse(storedUser));

    const fetchData = async () => {
      try {
        const p = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/products?populate=*`);
        const s = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/services?populate=*`);
        const l = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/livestreams?populate=*`);

        const products = normalizeData(p.data.data, 'product');
        const services = normalizeData(s.data.data, 'service');
        const allItems = [...products, ...services];
        setItems(allItems);

        // --- EXTRACT RANDOM ITEMS FOR THE MOVING MARQUEE ---
        const itemsWithImages = allItems.filter(i => i.mediaUrl && !i.isVideo);
        const shuffled = itemsWithImages.sort(() => 0.5 - Math.random()).slice(0, 8);
        setFeaturedItems(shuffled);

        // --- EXTRACT SELLER MAP LOCATIONS ---
        const uniqueSellersMap = new Map();
        allItems.forEach(item => {
            const seller = item.seller;
            if (seller && seller.shopLocation && !uniqueSellersMap.has(seller.id)) {
                let loc = seller.shopLocation;
                try { if(typeof loc === 'string') loc = JSON.parse(loc); } catch(e){}
                if (loc && loc.lat && loc.lng) {
                    uniqueSellersMap.set(seller.id, {
                        id: seller.id,
                        shopName: seller.shopName || seller.username,
                        shopDescription: seller.shopDescription,
                        lat: loc.lat,
                        lng: loc.lng
                    });
                }
            }
        });
        setSellersMapLocations(Array.from(uniqueSellersMap.values()));

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

  // --- APPLY FILTERS & SORTING ---
  let processedItems = items.filter(item => 
    (item.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (item.sellerName || '').toLowerCase().includes(search.toLowerCase())
  );

  if (typeFilter !== 'all') {
      processedItems = processedItems.filter(item => item.type === typeFilter);
  }

  if (categoryFilter !== 'all') {
      processedItems = processedItems.filter(item => item.category === categoryFilter);
  }

  const getActivePrice = (item) => item.isPromo && item.promoPrice ? item.promoPrice : item.price;

  if (sortPrice === 'low_to_high') {
      processedItems.sort((a, b) => getActivePrice(a) - getActivePrice(b));
  } else if (sortPrice === 'high_to_low') {
      processedItems.sort((a, b) => getActivePrice(b) - getActivePrice(a));
  }

  const availableCategories = Array.from(new Set(items.map(i => i.category).filter(Boolean)));

  const isMemeActive = search.trim() === '67';

  return (
    <div className={isMemeActive ? 'meme-67-active' : ''}>
      <Script src="https://app.sandbox.midtrans.com/snap/snap.js" data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY} strategy="lazyOnload"/>
      
      {/* --- NAVBAR --- */}
      <nav className="navbar">
        <Link href="/" className="nav-logo">
           MSME<span style={{color:'#2563eb'}}>.id</span>
        </Link>
        
        <div className="nav-search-container">
          <input 
            type="text" 
            className="nav-search-input" 
            placeholder="Search A Product or Service" 
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
                <Link href="/account" className="nav-item" style={{ textDecoration: 'none' }}>
                  <span>Hello, {user.username}</span>
                  <span>Your Account</span>
                </Link>
               
               <Link href="/cart" className="nav-item" style={{background:'#fef3c7', padding:'8px 12px', borderRadius:'12px', color:'#92400e', fontWeight:'bold', display:'flex', alignItems:'center', gap:'5px', textDecoration:'none'}}>
                 🛒 Cart
               </Link>

               {!user.isSeller && (
                 <Link href="/orders" className="nav-item" style={{background:'#e5e7eb', padding:'8px 12px', borderRadius:'12px', color:'#374151', fontWeight:'bold', display:'flex', alignItems:'center', gap:'5px', textDecoration:'none'}}>
                   📦 My Orders
                 </Link>
               )}

               {user.isSeller && (
                 <Link href="/seller" className="nav-item" style={{background:'#eff6ff', padding:'8px 12px', borderRadius:'12px', display:'flex', alignItems:'center', textDecoration:'none'}}>
                   <span style={{color: '#2563eb', fontWeight:'bold'}}>Seller Zone</span>
                 </Link>
               )}

               <button onClick={handleLogout} style={{background:'none', border:'none', color:'var(--danger-color)', fontWeight:'bold', cursor:'pointer', fontSize: '0.95rem'}}>
                 Sign Out
               </button>
             </>
           )}
        </div>
      </nav>

      <main className="container">
        
        {/* --- THE NEW ANIMATED MARQUEE CAROUSEL --- */}
        {featuredItems.length > 0 && (
          <div style={{ marginBottom: '3rem' }}>
            <h2 style={{ fontSize: '1.8rem', color: '#0f172a', marginBottom: '0.5rem' }}>Discover Random Finds</h2>
            <div className="marquee-container">
              <div className="marquee-content">
                {[...featuredItems, ...featuredItems].map((item, idx) => (
                  <Link key={idx} href={`/item/${item.documentId}?type=${item.type}`} style={{ textDecoration: 'none' }}>
                    <div className="marquee-item">
                      <div className="marquee-img-wrap">
                        <img src={item.mediaUrl} alt={item.name} loading="lazy" />
                      </div>
                      <div className="marquee-text-wrap">
                        <div className="marquee-title">{item.name}</div>
                        <div className="marquee-price">
                          {item.isPromo && item.promoPrice ? (
                            <span style={{ color: '#ef4444', fontWeight: 'bold' }}>Rp {item.promoPrice?.toLocaleString('id-ID')}</span>
                          ) : (
                            <span>Rp {item.price?.toLocaleString('id-ID')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- GLOBAL STORE MAP WITH TOGGLE --- */}
        <div style={{marginBottom:'3rem'}}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{fontSize:'1.8rem', color:'#0f172a', margin: 0}}>Explore Local Stores</h2>
              <button 
                onClick={() => setShowMap(!showMap)}
                style={{
                  padding: '0.6rem 1.2rem',
                  background: showMap ? '#f1f5f9' : '#2563eb',
                  color: showMap ? '#333' : '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                {showMap ? 'Hide Map 🗺️' : 'Show Map 🗺️'}
              </button>
            </div>
            
            {showMap && (
              <StoreMap sellers={sellersMapLocations} />
            )}
        </div>

        {/* --- LIVE SECTION --- */}
        {streams.length > 0 && (
          <div style={{ background:'white', padding:'1.5rem', marginBottom:'3rem', borderRadius:'16px', boxShadow:'var(--shadow-sm)', border: '1px solid #e2e8f0' }}>
              <h3 style={{margin:'0 0 1.5rem 0', color:'#e11d48'}}>🔴 Live Stream | MSME Edition</h3>
              <div style={{display:'flex', gap:'1.5rem', overflowX:'auto', paddingBottom: '1rem'}}>
                {streams.map((stream) => (
                  <Link key={stream.id} href={`/live/${stream.documentId}`} style={{textDecoration:'none', color:'inherit', minWidth:'280px'}}>
                    <div style={{position:'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', transition: 'all 0.2s'}} className="card-hover-effect">
                      <div style={{height:'150px', background:'#0f172a', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight: 'bold', fontSize: '1.1rem'}}>
                        ▶ Watch Live
                      </div>
                      <div style={{padding:'1rem', background: 'white'}}>
                        <span style={{color:'#e11d48', fontWeight:'bold', fontSize:'0.85rem'}}>LIVE</span>
                        <div style={{fontWeight:'bold', fontSize: '1.1rem', marginTop: '5px'}}>{stream.title}</div>
                        <div style={{fontSize:'0.9rem', color:'#64748b', marginTop: '5px'}}>{stream.sellerName}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
          </div>
        )}

        {/* --- FILTER & SORT BAR --- */}
        <div style={{display:'flex', flexWrap:'wrap', gap:'1.5rem', marginBottom:'2rem', padding:'1rem 1.5rem', background:'white', borderRadius:'16px', boxShadow:'var(--shadow-sm)', border: '1px solid #e2e8f0', alignItems:'center'}}>
            <strong style={{color: '#0f172a'}}>Filters:</strong>
            
            <select className="input-field" style={{width:'auto', padding:'0.6rem 1rem'}} value={typeFilter} onChange={(e) => {setTypeFilter(e.target.value); setCategoryFilter('all');}}>
                <option value="all">All Types</option>
                <option value="product">Products</option>
                <option value="service">Services</option>
            </select>

            <select className="input-field" style={{width:'auto', padding:'0.6rem 1rem'}} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">All Categories</option>
                {availableCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>

            <div style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:'10px'}}>
                <strong style={{color: '#0f172a'}}>Sort By:</strong>
                <select className="input-field" style={{width:'auto', padding:'0.6rem 1rem'}} value={sortPrice} onChange={(e) => setSortPrice(e.target.value)}>
                    <option value="none">Relevance</option>
                    <option value="low_to_high">Price: Low to High</option>
                    <option value="high_to_low">Price: High to Low</option>
                </select>
            </div>
        </div>

        {/* --- PRODUCT GRID --- */}
        <div className="grid-4">
          {processedItems.length === 0 && (
            <div style={{gridColumn:'1 / -1', textAlign:'center', padding:'4rem', color:'#64748b', fontSize: '1.2rem'}}>
              No items found matching your filters.
            </div>
          )}

          {processedItems.map((item) => (
            <div key={`${item.type}-${item.id}`} className="card">
              
              <Link href={`/item/${item.documentId}?type=${item.type}`} style={{textDecoration:'none', color:'inherit'}}>
                <div className="card-image" style={{ cursor: 'pointer' }}>
                    {item.mediaUrl ? (
                      item.isVideo ? (
                          <video src={item.mediaUrl} style={{maxWidth:'100%', maxHeight:'100%'}} />
                      ) : (
                          <img src={item.mediaUrl} alt={item.name} style={{width:'100%', height:'100%', objectFit:'contain'}} />
                      )
                    ) : (
                      <div style={{color:'#ccc', display:'flex', alignItems:'center', justifyContent:'center', height:'100%'}}>No Image</div>
                    )}
                </div>
              </Link>
              
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <Link href={`/item/${item.documentId}?type=${item.type}`} style={{textDecoration:'none', color:'inherit'}}>
                   <h3 style={{cursor:'pointer', marginBottom: '8px'}}>{item.name}</h3>
                </Link>

                <div>
                  <span style={{fontSize:'0.8rem', background:'#e0e7ff', padding:'4px 10px', borderRadius:'12px', display:'inline-block', marginBottom:'8px', color:'#2563eb', fontWeight: 'bold'}}>
                    {item.category || item.type.toUpperCase()}
                  </span>
                </div>
                
                <div style={{color:'#f59e0b', fontSize:'1rem', margin:'0.5rem 0', display:'flex', alignItems:'center', gap:'5px'}}>
                   <span style={{letterSpacing:'-2px'}}>
                      {renderStars(item.rating || 0)}
                   </span>
                   <span style={{color:'#333', fontSize:'0.9rem', fontWeight:'bold'}}>
                     {item.rating > 0 ? item.rating.toFixed(1) : ''}
                   </span>
                   <span style={{color:'#64748b', fontSize:'0.9rem'}}>
                      ({item.reviewCount || 0})
                   </span>
                </div>
                
                <div className="price-tag" style={{ display: 'flex', flexDirection: 'column', marginBottom: '10px' }}>
                   {item.isPromo && item.promoPrice ? (
                     <>
                       <span style={{ textDecoration: 'line-through', color: '#9ca3af', fontSize: '0.85rem', fontWeight: 'normal' }}>
                         Rp {item.price?.toLocaleString('id-ID')}
                       </span>
                       <div style={{ color: '#ef4444', fontWeight: '800', fontSize: '1.2rem', marginTop: '-2px' }}>
                         <span style={{fontSize:'0.9rem', position:'relative', top:'-2px'}}>Rp </span>
                         {item.promoPrice?.toLocaleString('id-ID')}
                       </div>
                     </>
                   ) : (
                     <div style={{ color: '#2563eb', fontWeight: '800', fontSize: '1.2rem' }}>
                       <span style={{fontSize:'0.9rem', position:'relative', top:'-2px'}}>Rp </span>
                       {item.price?.toLocaleString('id-ID')}
                     </div>
                   )}
                </div>
                
                <div className="seller-badge" style={{ marginTop: 'auto', marginBottom: '10px' }}>
                  Sold by <strong>{item.sellerName}</strong>
                </div>

                <Link href={`/item/${item.documentId}?type=${item.type}`} style={{width:'100%'}}>
                   <button className="btn-primary" style={{width:'100%'}}>View Details</button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}