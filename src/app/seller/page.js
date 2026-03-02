"use client";
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// --- DYNAMIC IMPORT FOR MAP ---
const MapPicker = dynamic(() => import('@/components/MapPicker'), { ssr: false });

export default function SellerDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('product');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [myItems, setMyItems] = useState([]);
  const [editingId, setEditingId] = useState(null); 
  const [allItemsForLive, setAllItemsForLive] = useState([]); 

  const [formData, setFormData] = useState({ name: '', price: '', category: '', description: '', stock: '', title: '', streamUrl: '', selectedItemId: '' });
  
  const [settingsData, setSettingsData] = useState({
    midtransServerKey: '', midtransClientKey: '', shopDescription: '', shopLocation: { lat: null, lng: null }
  });

  const [variants, setVariants] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [files, setFiles] = useState([]); 
  const [previews, setPreviews] = useState([]);
  const [newVariantName, setNewVariantName] = useState('');
  const [newVariantOption, setNewVariantOption] = useState('');

  const PRODUCT_CATS = ["Food & Beverage", "Fashion (Men)", "Fashion (Women)", "Electronics", "Handicrafts", "Furniture", "Health & Beauty", "Toys & Hobbies", "Automotive"];
  const SERVICE_CATS = ["Electronics Repair", "House Cleaning", "Massage/Spa", "Tutoring", "Graphic Design", "Laundry", "Catering", "Consulting", "Transport"];
  const currentCategories = activeTab === 'product' ? PRODUCT_CATS : SERVICE_CATS;

const fetchMyItems = useCallback(async () => {
    if (activeTab === 'settings') return;
    const userStr = localStorage.getItem('user'); 
    const token = localStorage.getItem('token');
    if (!userStr || !token) return;
    
    const user = JSON.parse(userStr); 
    const endpoint = activeTab === 'product' ? 'products' : activeTab === 'service' ? 'services' : 'livestreams';
    
    try {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/${endpoint}?filters[seller][id][$eq]=${user.id}&populate=*&sort=createdAt:desc`, { headers: { Authorization: `Bearer ${token}` } });
      
      // FIXED: Safely extract data whether it's Strapi v4 (item.attributes) or v5 (item directly)
      const normalizedItems = res.data.data.map(item => {
        const itemData = item.attributes || item;
        return { ...itemData, _id: item.id, _documentId: item.documentId, id: item.documentId || item.id };
      });
      setMyItems(normalizedItems);

      if (activeTab === 'livestream') {
        const [prodRes, servRes] = await Promise.all([ 
          axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/products?filters[seller][id][$eq]=${user.id}`, { headers: { Authorization: `Bearer ${token}` } }), 
          axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/services?filters[seller][id][$eq]=${user.id}`, { headers: { Authorization: `Bearer ${token}` } }) 
        ]);
        
        setAllItemsForLive([
          ...prodRes.data.data.map(i => {
             const d = i.attributes || i;
             return { id: i.documentId || i.id, name: d.name, type: 'product' };
          }), 
          ...servRes.data.data.map(i => {
             const d = i.attributes || i;
             return { id: i.documentId || i.id, name: d.name, type: 'service' };
          })
        ]);
      }
    } catch (err) { 
      console.error("Failed to fetch items", err); 
    }
  }, [activeTab]);

  useEffect(() => {
    const token = localStorage.getItem('token'); const userStr = localStorage.getItem('user');
    if (!token || !userStr) { router.push('/login'); } else {
      const user = JSON.parse(userStr);
      if (user.isSeller) {
        setIsLoading(false);
        let savedLoc = { lat: null, lng: null };
        try { if(user.shopLocation) savedLoc = typeof user.shopLocation === 'string' ? JSON.parse(user.shopLocation) : user.shopLocation; } catch(e){}
        setSettingsData({ midtransServerKey: user.midtransServerKey || '', midtransClientKey: user.midtransClientKey || '', shopDescription: user.shopDescription || '', shopLocation: savedLoc });
        resetForm(activeTab); fetchMyItems(); 
      } else { alert("Access Denied."); router.push('/'); }
    }
  }, [router, activeTab, fetchMyItems]);

  const resetForm = (tab) => {
    setEditingId(null); setFormData({ name: '', price: '', description: '', stock: '', title: '', streamUrl: '', selectedItemId: '', category: tab === 'livestream' ? '' : (tab === 'product' ? PRODUCT_CATS[0] : SERVICE_CATS[0]) });
    setVariants([]); setAttributes([]); setFiles([]); setPreviews([]); setIsCustomCategory(false); setNewVariantName(''); setNewVariantOption('');
  };

  const handleEdit = (item) => {
    setEditingId(item._documentId || item.id); window.scrollTo({ top: 0, behavior: 'smooth' });
    if (activeTab === 'livestream') { setFormData({ title: item.title, streamUrl: item.streamUrl, selectedItemId: '' }); } else {
      setFormData({ name: item.name, price: item.price, description: item.description, stock: item.stock || 0, category: item.category || currentCategories[0], title: '', streamUrl: '' });
      setVariants(item.variantData || []); setAttributes(item.customAttributes || []);
      const mediaArray = Array.isArray(item.media?.data || item.media) ? (item.media?.data || item.media) : [(item.media?.data || item.media)];
      setPreviews(mediaArray.map(m => m?.attributes?.url || m?.url ? `${process.env.NEXT_PUBLIC_API_URL}${m.attributes?.url || m.url}` : null).filter(Boolean)); setFiles([]); 
    }
  };

  const handleDelete = async (id) => {
    if(!confirm("Are you sure you want to delete this listing?")) return;
    try { await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/api/${activeTab === 'product' ? 'products' : activeTab === 'service' ? 'services' : 'livestreams'}/${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }); alert("Deleted successfully"); fetchMyItems(); if(editingId === id) resetForm(activeTab); } catch (err) { alert("Failed to delete."); }
  };

  const addVariantType = () => { if (!newVariantName.trim()) return; setVariants([...variants, { name: newVariantName, options: [] }]); setNewVariantName(''); };
  const addVariantOption = (vIdx) => { if (!newVariantOption.trim()) return; const v = [...variants]; v[vIdx].options.push({ name: newVariantOption, file: null, previewUrl: null, image: null }); setVariants(v); setNewVariantOption(''); };
  const handleVariantImageUpload = (e, vIdx, oIdx) => { const file = e.target.files[0]; if (!file) return; const v = [...variants]; v[vIdx].options[oIdx].file = file; v[vIdx].options[oIdx].previewUrl = URL.createObjectURL(file); setVariants(v); };
  const removeVariantType = (idx) => setVariants(variants.filter((_, i) => i !== idx));
  const removeVariantOption = (vIdx, oIdx) => { const v = [...variants]; v[vIdx].options = v[vIdx].options.filter((_, i) => i !== oIdx); setVariants(v); };
  const addAttribute = () => setAttributes([...attributes, { key: '', value: '' }]);
  const updateAttribute = (idx, field, value) => { const a = [...attributes]; a[idx][field] = value; setAttributes(a); };
  const removeAttribute = (idx) => setAttributes(attributes.filter((_, i) => i !== idx));
  const handleCategoryChange = (e) => { const value = e.target.value; if (value === 'custom_option') { setIsCustomCategory(true); setFormData({ ...formData, category: '' }); } else { setIsCustomCategory(false); setFormData({ ...formData, category: value }); } };
  const handleMainMediaChange = (e) => { if (e.target.files) { const newFiles = Array.from(e.target.files); setFiles(prev => [...prev, ...newFiles]); setPreviews(prev => [...prev, ...newFiles.map(file => URL.createObjectURL(file))]); } };
  const removeImage = (index) => { setFiles(prev => prev.filter((_, i) => i !== index)); setPreviews(prev => prev.filter((_, i) => i !== index)); };

  const handleSaveSettings = async (e) => {
    e.preventDefault(); setIsSubmitting(true);
    const token = localStorage.getItem('token'); const user = JSON.parse(localStorage.getItem('user'));
    if(!settingsData.shopLocation.lat) { alert("Please pin your store location on the map before saving."); setIsSubmitting(false); return; }
    try {
      const res = await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${user.id}`, { midtransServerKey: settingsData.midtransServerKey, midtransClientKey: settingsData.midtransClientKey, shopDescription: settingsData.shopDescription, shopLocation: settingsData.shopLocation }, { headers: { Authorization: `Bearer ${token}` } });
      const updatedUser = { ...user, ...res.data }; localStorage.setItem('user', JSON.stringify(updatedUser)); alert("Settings successfully saved!");
    } catch (err) { alert("Failed to save settings. Please try again."); } finally { setIsSubmitting(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setIsSubmitting(true);
    const token = localStorage.getItem('token'); const user = JSON.parse(localStorage.getItem('user'));
    try {
      let mediaIds = []; 
      if (files.length > 0) {
        const uploadData = new FormData(); files.forEach((f) => { uploadData.append('files', f); });
        const uploadRes = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/upload`, uploadData, { headers: { Authorization: `Bearer ${token}` } });
        mediaIds = uploadRes.data.map(file => file.id);
      }

      const processedVariants = await Promise.all(variants.map(async (variant) => {
        const processedOptions = await Promise.all(variant.options.map(async (option) => {
          let imageData = option.image; 
          if (option.file) {
            const variantUploadData = new FormData(); variantUploadData.append('files', option.file);
            try { const uploadRes = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/upload`, variantUploadData, { headers: { Authorization: `Bearer ${token}` } }); imageData = { id: uploadRes.data[0].id, url: uploadRes.data[0].url }; } catch (err) { console.error("Failed to upload variant image:", err); }
          }
          return { name: option.name, image: imageData };
        }));
        return { name: variant.name, options: processedOptions };
      }));

      const endpoint = activeTab === 'product' ? 'products' : activeTab === 'service' ? 'services' : 'livestreams';
      let payloadData = {};

      if (activeTab === 'livestream') {
        payloadData = { title: formData.title, streamUrl: formData.streamUrl, isLive: true, seller: user.id };
        if (formData.selectedItemId) { const selectedItem = allItemsForLive.find(i => i.id === formData.selectedItemId); if (selectedItem?.type === 'product') payloadData.relatedProduct = selectedItem.id; if (selectedItem?.type === 'service') payloadData.relatedService = selectedItem.id; }
      } else {
        if (!formData.category.trim()) { alert("Please enter a category!"); setIsSubmitting(false); return; }
        payloadData = { name: formData.name, price: Number(formData.price), category: formData.category, description: formData.description, stock: Number(formData.stock), variantData: processedVariants, customAttributes: attributes, seller: user.id };
        if (mediaIds.length > 0) { payloadData.media = mediaIds; }
      }

      const url = `${process.env.NEXT_PUBLIC_API_URL}/api/${endpoint}${editingId ? `/${editingId}` : ''}`;
      if (editingId) { await axios.put(url, { data: payloadData }, { headers: { Authorization: `Bearer ${token}` } }); alert('Updated successfully!'); } else { await axios.post(url, { data: payloadData }, { headers: { Authorization: `Bearer ${token}` } }); alert('Published successfully!'); }
      resetForm(activeTab); fetchMyItems(); 
    } catch (err) { alert(`Error submitting listing.`); } finally { setIsSubmitting(false); }
  };

  if (isLoading) return <div className="container" style={{textAlign:'center', padding:'2rem'}}>Loading...</div>;

  return (
    <div>
      {/* NAVBAR */}
      <nav className="navbar" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h1 style={{ margin: 0, color: '#2563eb' }}>Seller Dashboard</h1>
        <div className="nav-links" style={{display:'flex', gap:'1.5rem', alignItems:'center'}}>
           
           <Link href="/seller/orders" style={{color:'white', textDecoration:'none', fontWeight:'bold', display:'flex', alignItems:'center', gap:'5px', background:'#e77600', padding:'8px 15px', borderRadius:'20px', transition: 'all 0.2s'}}>
             <span>📦</span> Orders
           </Link>

           <Link href="/chat" style={{color:'#2563eb', textDecoration:'none', fontWeight:'bold', display:'flex', alignItems:'center', gap:'5px', background:'#eff6ff', padding:'8px 15px', borderRadius:'20px', transition: 'all 0.2s'}}>
             <span>💬</span> Messages
           </Link>

           <Link href="/" style={{color:'#475569', textDecoration:'none', fontWeight:'bold', transition: 'all 0.2s'}}>
             Back to Market
           </Link>

        </div>
      </nav>

      <div className="container">
        <div className="form-container" style={{maxWidth:'800px'}}>
          <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', color: '#111827' }}>{editingId ? `Edit ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}` : 'Create New Listing'}</h2>
          
          <div className="tab-group">
            <button onClick={() => { setActiveTab('product'); resetForm('product'); }} className={`tab-btn ${activeTab === 'product' ? 'active' : ''}`}>Product</button>
            <button onClick={() => { setActiveTab('service'); resetForm('service'); }} className={`tab-btn ${activeTab === 'service' ? 'active' : ''}`}>Service</button>
            <button onClick={() => { setActiveTab('livestream'); resetForm('livestream'); }} className={`tab-btn ${activeTab === 'livestream' ? 'active' : ''}`} style={{borderColor:'#ef4444', color: activeTab==='livestream' ? 'white' : '#ef4444', background: activeTab==='livestream' ? '#ef4444' : 'transparent'}}>Go Live</button>
            <button onClick={() => { setActiveTab('settings'); }} className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}>⚙️ Settings</button>
          </div>

          {activeTab === 'settings' ? (
            <div style={{animation:'fadeIn 0.3s'}}>
              <h2 style={{textAlign:'center', marginBottom: '2rem'}}>Store & Payment Profile</h2>
              <form onSubmit={handleSaveSettings}>
                <div className="form-section">
                    <h3 className="section-title">Midtrans Payment Keys</h3>
                    <div className="form-group"><label>Server Key</label><input className="input-field" type="password" value={settingsData.midtransServerKey} onChange={e => setSettingsData({...settingsData, midtransServerKey: e.target.value})} required /></div>
                    <div className="form-group"><label>Client Key</label><input className="input-field" value={settingsData.midtransClientKey} onChange={e => setSettingsData({...settingsData, midtransClientKey: e.target.value})} required /></div>
                </div>
                <div className="form-section">
                    <h3 className="section-title">Store Details</h3>
                    <div className="form-group"><label>What does your store sell?</label><textarea className="input-field" rows={3} placeholder="e.g. We sell handmade clothing..." value={settingsData.shopDescription} onChange={e => setSettingsData({...settingsData, shopDescription: e.target.value})} required /></div>
                    <div className="form-group" style={{marginTop: '1.5rem'}}><label>Pin Your Physical Store Location</label><MapPicker onLocationSelect={(loc) => setSettingsData({...settingsData, shopLocation: loc})} />{settingsData.shopLocation.lat ? (<div style={{marginTop:'10px', color:'var(--success-color)', fontWeight:'bold'}}>✅ Location Pinned</div>) : (<div style={{marginTop:'10px', color:'var(--danger-color)', fontWeight:'bold'}}>❌ Please pin your location</div>)}</div>
                </div>
                <button type="submit" className="btn-primary" style={{marginTop:'1rem'}} disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save All Settings'}</button>
              </form>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {editingId && (<div style={{background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', padding: '10px', borderRadius: '6px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}><span>Editing <strong>{formData.name || formData.title}</strong> (ID: {editingId})</span><button type="button" onClick={() => resetForm(activeTab)} style={{background:'transparent', border:'1px solid #9a3412', color:'#9a3412', borderRadius:'4px', cursor:'pointer', padding:'2px 8px'}}>Cancel Edit</button></div>)}

              {activeTab === 'livestream' ? (
                <div style={{ animation: 'fadeIn 0.5s' }}>
                   <div className="form-group"><label>Stream Title</label><input className="input-field" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required /></div>
                   <div className="form-group"><label>YouTube Embed URL</label><input className="input-field" value={formData.streamUrl} onChange={e => setFormData({...formData, streamUrl: e.target.value})} required /></div>
                   <div className="form-group" style={{marginTop:'1rem', padding:'1rem', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:'8px'}}><label style={{color:'#166534'}}>🛒 Feature a Product (Optional)</label><select className="input-field" value={formData.selectedItemId} onChange={e => setFormData({...formData, selectedItemId: e.target.value})}><option value="">-- No Linked Product --</option>{allItemsForLive.map(item => (<option key={item.id} value={item.id}>{item.type === 'product' ? '📦' : '🛠️'} {item.name}</option>))}</select><small style={{display:'block', marginTop:'5px', color:'#166534'}}>Viewers can buy this item directly from your stream!</small></div>
                </div>
              ) : (
                <>
                  <div className="flex-row" style={{gap:'1rem'}}>
                    <div className="form-group" style={{flex:2}}><label>Item Name</label><input className="input-field" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required /></div>
                    <div className="form-group" style={{flex:1}}><label>Price (Rp)</label><input type="number" className="input-field" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} required /></div>
                    {activeTab === 'product' && (<div className="form-group" style={{flex:1}}><label>Total Stock</label><input type="number" className="input-field" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} required /></div>)}
                  </div>
                  <div className="form-group"><label>Description</label><textarea className="input-field" rows={5} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>

                  <div className="form-section">
                    <h3 className="section-title">Variants (e.g., Color, Size)</h3>
                    {variants.map((variant, vIndex) => (
                      <div key={vIndex} className="variant-box">
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem'}}>
                          <strong>{variant.name}</strong>
                          <button type="button" onClick={() => removeVariantType(vIndex)} style={{color:'red', background:'none', border:'none', cursor:'pointer'}}>Remove Type</button>
                        </div>
                        
                        <div style={{display:'flex', flexWrap:'wrap', gap:'1.5rem', marginBottom:'1rem'}}>
                          {variant.options.map((option, oIndex) => (
                            <div key={oIndex} style={{background:'#f3f4f6', padding:'1rem', borderRadius:'8px', display:'flex', flexDirection:'column', alignItems:'center', gap:'0.5rem', border:'1px solid #e5e7eb'}}>
                              <span style={{fontWeight:'bold', color:'#333'}}>{option.name}</span>
                              
                              <label style={{cursor:'pointer', position:'relative', width:'60px', height:'60px', borderRadius:'6px', overflow:'hidden', background:'#ddd', display:'flex', alignItems:'center', justifyContent:'center', border: '2px dashed #9ca3af'}}>
                                {option.previewUrl || option.image?.url ? (
                                  <img src={option.previewUrl || (option.image?.url ? `${process.env.NEXT_PUBLIC_API_URL}${option.image.url}` : '')} alt={option.name} style={{width:'100%', height:'100%', objectFit:'cover'}} />
                                ) : (
                                  <span style={{fontSize:'2rem', color:'#9ca3af'}}>+</span>
                                )}
                                <input type="file" accept="image/*" style={{display:'none'}} onChange={(e) => handleVariantImageUpload(e, vIndex, oIndex)} />
                              </label>
                              
                              <small style={{color:'#2563eb', fontSize:'0.75rem', textAlign:'center', maxWidth:'100px'}}>
                                (Optional) Link Image
                              </small>

                              <button type="button" onClick={() => removeVariantOption(vIndex, oIndex)} style={{border:'none', background:'#fee2e2', borderRadius:'4px', cursor:'pointer', color:'#b91c1c', fontWeight:'bold', padding:'2px 8px', marginTop:'5px'}}>Remove</button>
                            </div>
                          ))}
                        </div>
                        
                        <div style={{display:'flex', gap:'0.5rem'}}>
                          <input placeholder={`Add option for ${variant.name}...`} className="input-field" style={{padding:'0.4rem'}} value={newVariantOption} onChange={e => setNewVariantOption(e.target.value)} />
                          <button type="button" onClick={() => addVariantOption(vIndex)} className="btn-secondary" style={{marginTop:0, padding:'0.4rem 1rem'}}>Add</button>
                        </div>
                      </div>
                    ))}
                    <div style={{display:'flex', gap:'0.5rem', marginTop:'1rem'}}>
                      <input placeholder="New Variant Type (e.g., Color)" className="input-field" value={newVariantName} onChange={e => setNewVariantName(e.target.value)} />
                      <button type="button" onClick={addVariantType} className="btn-secondary" style={{marginTop:0}}>+ Add Variant Type</button>
                    </div>
                  </div>

                  <div className="form-section">
                    <h3 className="section-title">Product Attributes</h3>
                    {attributes.map((attr, index) => (
                      <div key={index} style={{display:'flex', gap:'0.5rem', marginBottom:'0.5rem'}}><input placeholder="Key" className="input-field" value={attr.key} onChange={e => updateAttribute(index, 'key', e.target.value)} /><input placeholder="Value" className="input-field" value={attr.value} onChange={e => updateAttribute(index, 'value', e.target.value)} /><button type="button" onClick={() => removeAttribute(index)} style={{color:'red', background:'none', border:'1px solid red', borderRadius:'4px', cursor:'pointer', padding:'0 0.5rem'}}>X</button></div>
                    ))}
                    <button type="button" onClick={addAttribute} className="btn-secondary" style={{width:'auto'}}>+ Add Attribute Row</button>
                  </div>

                  <div className="form-group">
                    <label>Category</label>
                    {!isCustomCategory ? (
                      <select className="input-field" onChange={handleCategoryChange} value={formData.category}>
                        {currentCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        <option value="custom_option" style={{fontWeight:'bold', color:'blue'}}>+ Add Custom Category...</option>
                      </select>
                    ) : (
                      <div style={{display:'flex', gap:'0.5rem'}}><input className="input-field" placeholder={`Type ${activeTab} category...`} value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} required /><button type="button" onClick={() => { setIsCustomCategory(false); setFormData({...formData, category: currentCategories[0]}); }} className="btn-secondary" style={{marginTop:0, padding:'0 1rem'}}>Cancel</button></div>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Upload Main Media (Select Multiple)</label>
                    <input type="file" className="file-input" accept="image/*,video/*" multiple onChange={handleMainMediaChange} required={!editingId && files.length === 0} />
                    <div style={{display:'flex', gap:'10px', marginTop:'10px', flexWrap:'wrap'}}>
                      {previews.map((src, index) => (
                        <div key={index} style={{position:'relative', width:'80px', height:'80px', border:'1px solid #ddd', borderRadius:'8px', overflow:'hidden'}}><img src={src} alt="preview" style={{width:'100%', height:'100%', objectFit:'cover'}} /><button type="button" onClick={() => removeImage(index)} style={{position:'absolute', top:0, right:0, background:'rgba(255,0,0,0.8)', color:'white', border:'none', cursor:'pointer', width:'20px', height:'20px', display:'flex', alignItems:'center', justifyContent:'center'}}>×</button></div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <button type="submit" className="btn-primary" style={{ marginTop: '1.5rem' }} disabled={isSubmitting}>{isSubmitting ? 'Processing...' : (editingId ? 'Update Listing' : 'Publish Listing')}</button>
            </form>
          )}
        </div>

  {/* --- DYNAMIC RENDER SECTION --- */}
        {activeTab !== 'settings' && (
          <div style={{ marginTop: '3rem', borderTop: '1px solid #e5e7eb', paddingTop: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '1.5rem' }}>
              Your {activeTab === 'product' ? 'Products' : activeTab === 'service' ? 'Services' : 'Livestreams'}
            </h2>
            
            {myItems.length === 0 ? (
              <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>You haven't listed any {activeTab}s yet.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.5rem' }}>
                {myItems.map((item) => {
                  const media = item.media?.data || item.media; 
                  const firstImg = Array.isArray(media) ? media[0] : media; 
                  const imgUrl = firstImg?.attributes?.url || firstImg?.url ? `${process.env.NEXT_PUBLIC_API_URL}${firstImg.attributes?.url || firstImg.url}` : null;
                  
                  // Determine badge colors based on active tab
                  const badgeColor = activeTab === 'service' ? '#15803d' : activeTab === 'livestream' ? '#dc2626' : '#374151';
                  
                  return (
                    <div key={item.id} style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                      
                      {/* Image Container */}
                      <div style={{ height: '160px', backgroundColor: '#f3f4f6', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {imgUrl ? (
                          <img src={imgUrl} alt={item.name || item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ color: '#9ca3af', fontSize: '0.875rem', fontWeight: '500' }}>No Image</span>
                        )}
                        
                        {/* Category Badge */}
                        <span style={{ position: 'absolute', top: '0.5rem', left: '0.5rem', backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(4px)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 'bold', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', color: badgeColor }}>
                          {activeTab === 'livestream' ? 'Live Stream' : (item.category || activeTab)}
                        </span>
                      </div>
                      
                      {/* Details Container */}
                      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <h3 style={{ fontWeight: '600', color: '#1f2937', margin: '0 0 0.25rem 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.name || item.title}>
                          {item.name || item.title}
                        </h3>
                        
                        {activeTab === 'livestream' ? (
                          <p style={{ color: '#ef4444', fontWeight: 'bold', margin: '0.25rem 0', fontSize: '0.875rem' }}>● LIVE NOW</p>
                        ) : (
                          <p style={{ color: '#2563eb', fontWeight: 'bold', margin: '0.25rem 0', fontSize: '1.125rem' }}>
                            Rp {item.price?.toLocaleString('id-ID')}
                          </p>
                        )}
                        
                        {activeTab === 'product' && (
                          <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: '0' }}>Stock: {item.stock || 0}</p>
                        )}
                        
                        {/* Buttons */}
                        <div style={{ marginTop: 'auto', paddingTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => handleEdit(item)} style={{ flex: 1, backgroundColor: '#f9fafb', color: '#2563eb', border: '1px solid #bfdbfe', padding: '0.375rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: '500', cursor: 'pointer' }}>
                            Edit
                          </button>
                          <button onClick={() => handleDelete(item.id)} style={{ flex: 1, backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '0.375rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: '500', cursor: 'pointer' }}>
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}