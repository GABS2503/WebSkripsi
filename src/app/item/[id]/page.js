"use client";
import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import ProductReviews from '@/components/ProductReviews';
import { useCart } from '@/context/CartContext';
import dynamic from 'next/dynamic';

const MapPicker = dynamic(() => import('@/components/MapPicker'), { ssr: false });

const getImageUrl = (url) => {
  if (!url) return '/placeholder.png';
  if (url.startsWith('http') || url.startsWith('//')) {
    return url;
  }
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:1337';
  return `${baseUrl}${url}`;
};

export default function ItemDetails() {
  const { addToCart } = useCart(); 
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  
  const id = params?.id; 
  const type = searchParams.get('type') || 'product'; 

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [quantity, setQuantity] = useState(1);
  const [selectedVariants, setSelectedVariants] = useState({}); 
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [activeVariantImage, setActiveVariantImage] = useState(null);

  const [deliveryType, setDeliveryType] = useState(''); 
  const [customerInfo, setCustomerInfo] = useState({ name: '', address: '', lat: null, lng: null });

useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        const endpoint = type === 'product' ? 'products' : 'services';
        const token = localStorage.getItem('token');
        
        // Add cache-busting headers
        const config = {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Expires': '0',
          }
        };
        
        // Add a timestamp to the URL so the browser thinks it's a brand new request every time
        const timestamp = new Date().getTime();
        const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/${endpoint}/${id}?populate=*&t=${timestamp}`, config);
        
        setItem(res.data.data);
      } catch (error) {
        console.error("Error loading item", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, type]);

  const handleVariantSelect = (variantName, optionName, optionImage) => {
    setSelectedVariants(prev => ({ ...prev, [variantName]: optionName }));
    if (optionImage && optionImage.url) {
      setActiveVariantImage(getImageUrl(optionImage.url));
    }
  };

  const handleGalleryClick = (index) => {
    setActiveImageIndex(index);
    setActiveVariantImage(null); 
  };

  // --- FIXED 1: SAFELY STORE MAP LOCATION WITHOUT INFINITE LOOPS ---
  const handleLocationSelect = useCallback((loc) => {
    setCustomerInfo(prev => ({ ...prev, lat: loc.lat, lng: loc.lng }));
  }, []);

  // --- FIXED 2: ALLOW CHAT BUTTON TO READ STRAPI V5 IDS ---
  const handleChat = async () => {
    const userStr = localStorage.getItem('user');
    if (!userStr) { alert("Please login to chat."); router.push('/login'); return; }
    const currentUser = JSON.parse(userStr);
    const token = localStorage.getItem('token');
    
    let sellerId = null; 
    let itemName = "Item";
    
    // Looks for documentId first, then falls back to regular id
    const extractId = (obj) => obj?.data?.documentId || obj?.data?.id || obj?.documentId || obj?.id;
    
    if (item) {
      const dataObj = item.attributes || item;
      if (dataObj.seller) { 
          sellerId = extractId(dataObj.seller); 
          itemName = dataObj.name || dataObj.title; 
      }
    }
    
    if (!sellerId) { 
        alert("Error: Could not identify the seller of this item."); 
        return; 
    }
    
    if (String(currentUser.id) === String(sellerId) || String(currentUser.documentId) === String(sellerId)) { 
        alert("This is your own item!"); 
        return; 
    }
    
    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/conversations`, { 
          data: { users: [currentUser.id, sellerId], itemTitle: itemName } 
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      router.push(`/chat?id=${res.data.data.documentId || res.data.data.id}`);
    } catch (err) { alert("Could not start chat."); }
  };

  const handleAddToCart = () => {
    const name = item?.name || item?.attributes?.name;
    const variantData = item?.variantData || item?.attributes?.variantData || [];

    if (variantData.length > 0) {
      const missing = variantData.find(v => !selectedVariants[v.name]);
      if (missing) { alert(`Please select a ${missing.name}`); return; }
    }
    if (!deliveryType) { alert("Please select a delivery/service option."); return; }
    if (!customerInfo.name) { alert("Please enter your name."); return; }
    
    if ((deliveryType === 'shipping' || deliveryType === 'home_service')) {
        if (!customerInfo.lat || !customerInfo.lng) { alert("Please pin your location on the map."); return; }
        if (!customerInfo.address) { alert("Please provide address details."); return; }
    }

    const data = item.attributes || item;
    const price = data.price;
    const media = data.media?.data || data.media || [];
    const finalImageUrl = activeVariantImage || getImageUrl(media[0]?.attributes?.url || media[0]?.url);
    const seller = data.seller?.data?.attributes || data.seller;

    const cartPayload = { id: item.documentId || item.id, name: name, price: price, image: finalImageUrl, seller: seller, type: type, quantity: quantity };
    const options = { variants: selectedVariants, deliveryType: deliveryType };
    addToCart(cartPayload, options, customerInfo);
  };

  if (loading) return <div className="container" style={{padding:'2rem', textAlign:'center', color: '#000', fontSize: '1.2rem'}}>Loading...</div>;
  if (!item) return <div className="container" style={{padding:'2rem', textAlign:'center', color: '#000', fontSize: '1.2rem'}}>Item not found.</div>;

  const data = item.attributes || item;
  const sellerRaw = data.seller?.data?.attributes || data.seller || {};
  const sellerName = sellerRaw.shopName || sellerRaw.username || "Unknown Seller";
  const sellerClientKey = sellerRaw.midtransClientKey || sellerRaw.midtrans_client_key || "";
  const variants = data.variantData || [];
  const attributes = data.customAttributes || [];
  const maxStock = data.stock || 999;
  const isOutOfStock = type === 'product' && maxStock < 1;

  const getMediaList = (mediaField) => {
    if (!mediaField) return [];
    const unwrapped = mediaField.data || mediaField;
    const items = Array.isArray(unwrapped) ? unwrapped : [unwrapped];
    return items.map(item => {
      const finalData = item?.attributes || item;
      if (!finalData?.url) return null;
      return { id: item.id, url: getImageUrl(finalData.url), isVideo: finalData.mime?.startsWith('video/') };
    }).filter(Boolean);
  };

  const mediaList = getMediaList(data.media);
  
  let displayMedia = null;
  if (activeVariantImage) {
      displayMedia = { url: activeVariantImage, isVideo: false };
  } else {
      displayMedia = mediaList[activeImageIndex] || mediaList[0] || null;
  }

  return (
    <div style={{ background: '#f3f4f6', minHeight: '100vh', color: '#000' }}>
      <nav className="navbar">
        <h1 style={{ margin:0, color: '#2563eb' }}>MSME Market</h1>
        <div style={{display:'flex', gap:'20px'}}>
            <Link href="/cart" style={{color:'#000', fontWeight:'bold', textDecoration:'none', fontSize: '1.1rem'}}>🛒 Cart</Link>
            <Link href="/" style={{color:'#000', textDecoration:'none', fontWeight:'bold', fontSize: '1.1rem'}}>&larr; Back</Link>
        </div>
      </nav>

      <main className="container" style={{ marginTop: '2rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3rem', background: 'white', padding: '2.5rem', borderRadius: '12px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
          
          <div style={{ flex: '1 1 450px' }}>
            <div style={{ width: '100%', height: '450px', background: '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: '1rem', transition: 'all 0.3s ease' }}>
              {displayMedia ? (
                 displayMedia.isVideo ? (
                   <video controls src={displayMedia.url} style={{maxWidth:'100%', maxHeight:'100%'}} />
                 ) : (
                   <img src={displayMedia.url} alt={data.name} style={{maxWidth:'100%', maxHeight:'100%', objectFit:'contain', transition: 'all 0.3s ease'}} />
                 )
              ) : (
                 <div style={{width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#000', flexDirection:'column'}}>
                   <span style={{fontSize:'3rem'}}>📷</span>
                   <span style={{fontSize: '1.2rem', marginTop: '10px'}}>No Media</span>
                 </div>
              )}
            </div>

            {mediaList.length > 1 && (
              <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                {mediaList.map((media, index) => (
                  <div key={index} onClick={() => handleGalleryClick(index)} style={{width: '70px', height: '70px', borderRadius: '6px', border: (!activeVariantImage && activeImageIndex === index) ? '3px solid #2563eb' : '1px solid #ddd', cursor: 'pointer', overflow: 'hidden', flexShrink: 0}}>
                    {media.isVideo ? <div style={{width:'100%', height:'100%', background:'#000', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.8rem'}}>VID</div> : <img src={media.url} alt="thumb" style={{width:'100%', height:'100%', objectFit:'cover'}} />}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ flex: '1 1 450px' }}>
            <h1 style={{ marginTop: 0, color: '#000', fontSize: '2.2rem', fontWeight: '800' }}>{data.name}</h1>
            <p style={{ color: '#000', fontSize: '1.1rem', marginBottom: '1.5rem' }}>
              Sold by: <strong style={{color: '#2563eb'}}>{sellerName}</strong>
            </p>

            <hr style={{ margin: '1.5rem 0', borderColor: '#e5e7eb' }} />

            <div style={{ fontSize: '2rem', fontWeight: '900', color: '#000', marginBottom: '1.5rem' }}>
              Rp {data.price?.toLocaleString()}
            </div>

            <p style={{ lineHeight: '1.8', color: '#000', whiteSpace: 'pre-line', fontSize: '1.15rem', marginBottom: '2rem' }}>
              {data.description || "No description provided."}
            </p>

            {attributes.length > 0 && (
              <div style={{ margin: '2rem 0' }}>
                <h4 style={{ marginBottom: '1rem', fontSize: '1.2rem', color: '#000' }}>Specifications:</h4>
                <table style={{ width: '100%', fontSize: '1.1rem', borderCollapse: 'collapse', color: '#000' }}>
                  <tbody>
                    {attributes.map((attr, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '12px 0', fontWeight: 'bold', width: '40%', color: '#000' }}>{attr.key}</td>
                        <td style={{ padding: '12px 0', color: '#000' }}>{attr.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {variants.map((variant, i) => (
              <div key={i} style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '0.8rem', fontSize: '1.1rem', color: '#000' }}>
                  {variant.name}: <span style={{fontWeight:'normal'}}>{selectedVariants[variant.name]}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
                  {variant.options.map((option, idx) => {
                    const isObject = typeof option === 'object' && option !== null;
                    const name = isObject ? option.name : option;
                    const image = isObject ? option.image : null;
                    const isSelected = selectedVariants[variant.name] === name;
                    return (
                      <button 
                        key={idx} 
                        onClick={() => handleVariantSelect(variant.name, name, image)} 
                        style={{padding: '0.6rem 1.2rem', fontSize: '1.05rem', color: '#000', border: isSelected ? '2px solid #2563eb' : '1px solid #d1d5db', background: isSelected ? '#eff6ff' : 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: isSelected ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'}}
                      >
                        {image && <img src={getImageUrl(image.url)} alt={name} style={{width:'28px', height:'28px', objectFit:'cover', borderRadius:'4px', border:'1px solid #eee'}} />}
                        {name}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            <div style={{ marginTop: '2.5rem', padding: '2rem', border: '1px solid #d1d5db', borderRadius: '12px', background: '#fafafa' }}>
              {isOutOfStock ? (
                <h3 style={{ color: '#ef4444', marginTop:0, fontSize: '1.5rem' }}>Currently Unavailable</h3>
              ) : (
                <>
                 {/* --- STOCK DISPLAY --- */}
{type === 'product' && (
  <div style={{ marginBottom: '1rem', color: maxStock < 5 ? '#ef4444' : '#16a34a', fontWeight: 'bold' }}>
    {maxStock > 0 ? `Stock Available: ${maxStock}` : 'Out of Stock'}
  </div>
)}

<div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
  <span style={{ fontWeight: 'bold', fontSize: '1.15rem', color: '#000' }}>Quantity:</span>
  <select value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} style={{ padding: '0.6rem 1rem', borderRadius: '6px', border: '1px solid #ccc', fontSize: '1.1rem', color: '#000', background: '#fff', cursor: 'pointer' }}>
    {[...Array(Math.min(10, type === 'product' ? maxStock : 10)).keys()].map(n => <option key={n+1} value={n+1}>{n+1}</option>)}
  </select>
</div>

                  <hr style={{margin:'2rem 0', borderColor:'#d1d5db'}}/>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{fontWeight:'bold', display:'block', marginBottom:'1rem', fontSize: '1.15rem', color: '#000'}}>
                        {type === 'product' ? 'Collection Method:' : 'Service Location:'}
                    </label>
                    <div style={{display:'flex', gap:'15px', flexDirection:'column'}}>
                        {type === 'product' ? (
                            <>
                                <label style={{cursor:'pointer', display:'flex', gap:'10px', alignItems:'center', fontSize: '1.1rem', color: '#000'}}><input type="radio" name="del_opt" value="pickup" onChange={(e)=>setDeliveryType(e.target.value)} style={{width: '20px', height: '20px'}} /> 🏪 Buy in Place (Pickup)</label>
                                <label style={{cursor:'pointer', display:'flex', gap:'10px', alignItems:'center', fontSize: '1.1rem', color: '#000'}}><input type="radio" name="del_opt" value="shipping" onChange={(e)=>setDeliveryType(e.target.value)} style={{width: '20px', height: '20px'}} /> 🚚 Take Away (Delivery)</label>
                            </>
                        ) : (
                            <>
                                <label style={{cursor:'pointer', display:'flex', gap:'10px', alignItems:'center', fontSize: '1.1rem', color: '#000'}}><input type="radio" name="del_opt" value="onsite" onChange={(e)=>setDeliveryType(e.target.value)} style={{width: '20px', height: '20px'}} /> 🚶 I go to Seller</label>
                                <label style={{cursor:'pointer', display:'flex', gap:'10px', alignItems:'center', fontSize: '1.1rem', color: '#000'}}><input type="radio" name="del_opt" value="home_service" onChange={(e)=>setDeliveryType(e.target.value)} style={{width: '20px', height: '20px'}} /> 🏠 Seller comes to Me</label>
                            </>
                        )}
                    </div>
                  </div>

                  {deliveryType && (
                    <div style={{ background:'white', padding:'20px', borderRadius:'8px', marginBottom:'2rem', border:'1px solid #d1d5db' }}>
                        <div style={{marginBottom:'15px'}}>
                            <label style={{fontSize:'1.1rem', fontWeight:'bold', color: '#000', display: 'block', marginBottom: '8px'}}>Your Name</label>
                            <input type="text" placeholder="Enter your full name" style={{width:'100%', padding:'12px', border:'1px solid #9ca3af', borderRadius:'6px', fontSize: '1.05rem', color: '#000'}} value={customerInfo.name} onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})} />
                        </div>

                        {(deliveryType === 'shipping' || deliveryType === 'home_service') && (
                            <div>
                                <label style={{fontSize:'1.1rem', fontWeight:'bold', display:'block', marginBottom:'8px', color: '#000'}}>Pin Location</label>
                                
                                {/* FIXED 1 APPLIED HERE */}
                                <MapPicker onLocationSelect={handleLocationSelect} />
                                
                                <label style={{fontSize:'1.1rem', fontWeight:'bold', display:'block', marginTop:'15px', marginBottom: '8px', color: '#000'}}>Detail Address</label>
                                <textarea placeholder="e.g. White fence, Unit 4B" style={{width:'100%', padding:'12px', border:'1px solid #9ca3af', borderRadius:'6px', fontSize: '1.05rem', color: '#000'}} rows={3} value={customerInfo.address} onChange={(e) => setCustomerInfo({...customerInfo, address: e.target.value})} />
                            </div>
                        )}
                    </div>
                  )}

                  <button onClick={handleChat} style={{ width: '100%', borderRadius: '50px', padding: '1rem', background: 'white', border: '2px solid #000', marginBottom: '1rem', cursor: 'pointer', fontWeight: 'bold', color: '#000', fontSize: '1.1rem', transition: 'all 0.2s' }}>
                    Chat with Seller
                  </button>
                  <button onClick={handleAddToCart} className="btn-primary" style={{ width: '100%', borderRadius: '50px', padding: '1rem', fontSize: '1.15rem' }}>
                    Add to Cart
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
        <ProductReviews itemId={item.documentId || item.id} itemType={type} />
      </main>

      {sellerClientKey && <Script src="https://app.sandbox.midtrans.com/snap/snap.js" data-client-key={sellerClientKey} strategy="lazyOnload" />}
    </div>
  );
}
