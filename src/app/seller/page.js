"use client";
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SellerDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('product');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  
  // --- STATE MANAGEMENT ---
  const [myItems, setMyItems] = useState([]);
  const [editingId, setEditingId] = useState(null); 
  
  // NEW: Store all user products/services for the "Go Live" dropdown
  const [allItemsForLive, setAllItemsForLive] = useState([]); 

  // Listing Form Data (Added selectedItemId)
  const [formData, setFormData] = useState({
    name: '', price: '', category: '', description: '', stock: '', 
    title: '', streamUrl: '', 
    selectedItemId: '' // <--- NEW: Selected Product ID for Livestream
  });
  
  // Payment Settings Data
  const [settingsData, setSettingsData] = useState({
    midtransServerKey: '',
    midtransClientKey: ''
  });

  const [variants, setVariants] = useState([]);
  const [attributes, setAttributes] = useState([]);
  
  const [files, setFiles] = useState([]); 
  const [previews, setPreviews] = useState([]);

  // Temp variant state
  const [newVariantName, setNewVariantName] = useState('');
  const [newVariantOption, setNewVariantOption] = useState('');

  const PRODUCT_CATS = ["Food & Beverage", "Fashion (Men)", "Fashion (Women)", "Electronics", "Handicrafts", "Furniture", "Health & Beauty", "Toys & Hobbies", "Automotive"];
  const SERVICE_CATS = ["Electronics Repair", "House Cleaning", "Massage/Spa", "Tutoring", "Graphic Design", "Laundry", "Catering", "Consulting", "Transport"];
  const currentCategories = activeTab === 'product' ? PRODUCT_CATS : SERVICE_CATS;

  // --- 1. FETCH ITEMS (Combined Logic) ---
  const fetchMyItems = useCallback(async () => {
    if (activeTab === 'settings') return;
    
    const userStr = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (!userStr || !token) return;
    
    const user = JSON.parse(userStr);
    const endpoint = activeTab === 'product' ? 'products' : activeTab === 'service' ? 'services' : 'livestreams';
    
    try {
      // A. Fetch current tab items (for the list at the bottom)
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/${endpoint}?filters[seller][id][$eq]=${user.id}&populate=*&sort=createdAt:desc`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const normalizedItems = res.data.data.map(item => {
          const attrs = item.attributes || item;
          // CRITICAL FIX: Ensure documentId is grabbed if it exists
          return { 
            ...attrs,
            _id: item.id, 
            _documentId: item.documentId, 
            id: item.documentId || item.id 
          };
      });
      setMyItems(normalizedItems);

      // B. NEW: If in Livestream tab, fetch Products & Services for the dropdown
      if (activeTab === 'livestream') {
        const [prodRes, servRes] = await Promise.all([
           axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/products?filters[seller][id][$eq]=${user.id}`, { headers: { Authorization: `Bearer ${token}` } }),
           axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/services?filters[seller][id][$eq]=${user.id}`, { headers: { Authorization: `Bearer ${token}` } })
        ]);
        
        const prods = prodRes.data.data.map(i => ({ 
            id: i.documentId || i.id, 
            name: i.attributes?.name || i.name, 
            type: 'product' 
        }));
        const servs = servRes.data.data.map(i => ({ 
            id: i.documentId || i.id, 
            name: i.attributes?.name || i.name, 
            type: 'service' 
        }));
        
        setAllItemsForLive([...prods, ...servs]);
      }

    } catch (err) {
      console.error("Failed to fetch items", err);
    }
  }, [activeTab]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (!token || !userStr) {
      router.push('/login');
    } else {
      const user = JSON.parse(userStr);
      if (user.isSeller) {
        setIsLoading(false);
        setSettingsData({
          midtransServerKey: user.midtransServerKey || '',
          midtransClientKey: user.midtransClientKey || ''
        });
        resetForm(activeTab);
        fetchMyItems(); 
      } else {
        alert("Access Denied.");
        router.push('/');
      }
    }
  }, [router, activeTab, fetchMyItems]);

  const resetForm = (tab) => {
    setEditingId(null); 
    setFormData({
      name: '', price: '', description: '', stock: '', 
      title: '', streamUrl: '', selectedItemId: '',
      category: tab === 'livestream' ? '' : (tab === 'product' ? PRODUCT_CATS[0] : SERVICE_CATS[0])
    });
    setVariants([]);
    setAttributes([]);
    setFiles([]);
    setPreviews([]);
    setIsCustomCategory(false);
    setNewVariantName('');
    setNewVariantOption('');
  };

  // --- 2. HANDLE EDIT CLICK ---
  const handleEdit = (item) => {
    const updateId = item._documentId || item.id;
    setEditingId(updateId); 
    
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (activeTab === 'livestream') {
      setFormData({
        title: item.title,
        streamUrl: item.streamUrl,
        selectedItemId: '' // Reset selection when editing (complex to pre-fill without deep populate)
      });
    } else {
      setFormData({
        name: item.name,
        price: item.price,
        description: item.description,
        stock: item.stock || 0,
        category: item.category || currentCategories[0],
        title: '', streamUrl: '' 
      });
      
      setVariants(item.variantData || []);
      setAttributes(item.customAttributes || []);
      
      const existingMedia = item.media?.data || item.media || [];
      const mediaArray = Array.isArray(existingMedia) ? existingMedia : [existingMedia];
      
      const imageUrls = mediaArray.map(m => {
        const url = m.attributes?.url || m.url;
        return url ? `${process.env.NEXT_PUBLIC_API_URL}${url}` : null;
      }).filter(Boolean);
      
      setPreviews(imageUrls);
      setFiles([]); 
    }
  };

  // --- 3. HANDLE DELETE CLICK ---
  const handleDelete = async (id) => {
    if(!confirm("Are you sure you want to delete this listing?")) return;
    
    const token = localStorage.getItem('token');
    const endpoint = activeTab === 'product' ? 'products' : activeTab === 'service' ? 'services' : 'livestreams';
    
    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/api/${endpoint}/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("Deleted successfully");
      fetchMyItems(); 
      if(editingId === id) resetForm(activeTab); 
    } catch (err) {
      console.error(err);
      alert("Failed to delete.");
    }
  };

  // --- HELPER FUNCTIONS ---
  const addVariantType = () => { if (!newVariantName.trim()) return; setVariants([...variants, { name: newVariantName, options: [] }]); setNewVariantName(''); };
  const addVariantOption = (variantIndex) => { if (!newVariantOption.trim()) return; const updatedVariants = [...variants]; updatedVariants[variantIndex].options.push({ name: newVariantOption, file: null, previewUrl: null, image: null }); setVariants(updatedVariants); setNewVariantOption(''); };
  const handleVariantImageUpload = (e, variantIndex, optionIndex) => { const file = e.target.files[0]; if (!file) return; const updatedVariants = [...variants]; updatedVariants[variantIndex].options[optionIndex].file = file; updatedVariants[variantIndex].options[optionIndex].previewUrl = URL.createObjectURL(file); setVariants(updatedVariants); };
  const removeVariantType = (index) => setVariants(variants.filter((_, i) => i !== index));
  const removeVariantOption = (variantIndex, optionIndex) => { const updatedVariants = [...variants]; updatedVariants[variantIndex].options = updatedVariants[variantIndex].options.filter((_, i) => i !== optionIndex); setVariants(updatedVariants); };
  const addAttribute = () => setAttributes([...attributes, { key: '', value: '' }]);
  const updateAttribute = (index, field, value) => { const updatedAttrs = [...attributes]; updatedAttrs[index][field] = value; setAttributes(updatedAttrs); };
  const removeAttribute = (index) => setAttributes(attributes.filter((_, i) => i !== index));
  const handleCategoryChange = (e) => { const value = e.target.value; if (value === 'custom_option') { setIsCustomCategory(true); setFormData({ ...formData, category: '' }); } else { setIsCustomCategory(false); setFormData({ ...formData, category: value }); } };
  const handleMainMediaChange = (e) => { if (e.target.files) { const newFiles = Array.from(e.target.files); setFiles(prev => [...prev, ...newFiles]); const newPreviews = newFiles.map(file => URL.createObjectURL(file)); setPreviews(prev => [...prev, ...newPreviews]); } };
  const removeImage = (index) => { setFiles(prev => prev.filter((_, i) => i !== index)); setPreviews(prev => prev.filter((_, i) => i !== index)); };

  const handleSaveSettings = async (e) => {
    e.preventDefault(); setIsSubmitting(true);
    const token = localStorage.getItem('token'); const user = JSON.parse(localStorage.getItem('user'));
    try {
      const res = await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${user.id}`, { midtransServerKey: settingsData.midtransServerKey, midtransClientKey: settingsData.midtransClientKey }, { headers: { Authorization: `Bearer ${token}` } });
      const updatedUser = { ...user, ...res.data }; localStorage.setItem('user', JSON.stringify(updatedUser));
      alert("Payment settings saved!");
    } catch (err) { console.error(err); alert("Failed to save settings."); } finally { setIsSubmitting(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setIsSubmitting(true);
    const token = localStorage.getItem('token'); const user = JSON.parse(localStorage.getItem('user'));

    try {
      // 1. UPLOAD MAIN GALLERY FILES
      let mediaIds = []; 
      if (files.length > 0) {
        const uploadData = new FormData();
        files.forEach((f) => { uploadData.append('files', f); });
        const uploadRes = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/upload`, uploadData, { headers: { Authorization: `Bearer ${token}` } });
        mediaIds = uploadRes.data.map(file => file.id);
      }

      // 2. PROCESS VARIANTS
      const processedVariants = await Promise.all(variants.map(async (variant) => {
        const processedOptions = await Promise.all(variant.options.map(async (option) => {
          let imageData = option.image; 
          if (option.file) {
            const variantUploadData = new FormData();
            variantUploadData.append('files', option.file);
            try { const uploadRes = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/upload`, variantUploadData, { headers: { Authorization: `Bearer ${token}` } }); imageData = { id: uploadRes.data[0].id, url: uploadRes.data[0].url }; } catch (err) { console.error("Failed to upload variant image:", option.name, err); }
          }
          return { name: option.name, image: imageData };
        }));
        return { name: variant.name, options: processedOptions };
      }));

      const endpoint = activeTab === 'product' ? 'products' : activeTab === 'service' ? 'services' : 'livestreams';
      let payloadData = {};

      if (activeTab === 'livestream') {
        payloadData = { title: formData.title, streamUrl: formData.streamUrl, isLive: true, seller: user.id };
        // --- NEW: LINK PRODUCT/SERVICE ---
        if (formData.selectedItemId) {
          const selectedItem = allItemsForLive.find(i => i.id === formData.selectedItemId);
          if (selectedItem?.type === 'product') payloadData.relatedProduct = selectedItem.id;
          if (selectedItem?.type === 'service') payloadData.relatedService = selectedItem.id;
        }
      } else {
        if (!formData.category.trim()) { alert("Please enter a category!"); setIsSubmitting(false); return; }
        payloadData = { name: formData.name, price: Number(formData.price), category: formData.category, description: formData.description, stock: Number(formData.stock), variantData: processedVariants, customAttributes: attributes, seller: user.id };
        if (mediaIds.length > 0) { payloadData.media = mediaIds; }
      }

      // --- 4. CREATE OR UPDATE ---
      const url = `${process.env.NEXT_PUBLIC_API_URL}/api/${endpoint}${editingId ? `/${editingId}` : ''}`;
      console.log(`Submitting to: ${url}`); 

      if (editingId) {
        await axios.put(url, { data: payloadData }, { headers: { Authorization: `Bearer ${token}` } });
        alert('Updated successfully!');
      } else {
        await axios.post(url, { data: payloadData }, { headers: { Authorization: `Bearer ${token}` } });
        alert('Published successfully!');
      }

      resetForm(activeTab);
      fetchMyItems(); 

    } catch (err) {
      console.error("Submit Error:", err);
      const triedUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/${activeTab === 'product' ? 'products' : 'services'}/${editingId || ''}`;
      alert(`Error: ${err.message}\nFailed URL: ${triedUrl}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="container" style={{textAlign:'center', padding:'2rem'}}>Loading...</div>;

  return (
    <div>
      {/* NAVBAR */}
      <nav className="navbar" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h1 style={{ margin: 0 }}>Seller Dashboard</h1>
        <div className="nav-links" style={{display:'flex', gap:'1.5rem', alignItems:'center'}}>
           <Link href="/chat" style={{color:'white', textDecoration:'none', fontWeight:'bold', display:'flex', alignItems:'center', gap:'5px', background:'rgba(255,255,255,0.1)', padding:'5px 10px', borderRadius:'4px'}}>
             <span>💬</span> Messages
           </Link>
           <Link href="/" style={{color:'white', textDecoration:'none', fontWeight:'bold'}}>Back to Market</Link>
        </div>
      </nav>

      <div className="container">
        <div className="form-container" style={{maxWidth:'800px'}}>
          <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', color: '#111827' }}>
            {editingId ? `Edit ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}` : 'Create New Listing'}
          </h2>
          
          <div className="tab-group">
            <button onClick={() => { setActiveTab('product'); resetForm('product'); }} className={`tab-btn ${activeTab === 'product' ? 'active' : ''}`}>Product</button>
            <button onClick={() => { setActiveTab('service'); resetForm('service'); }} className={`tab-btn ${activeTab === 'service' ? 'active' : ''}`}>Service</button>
            <button onClick={() => { setActiveTab('livestream'); resetForm('livestream'); }} className={`tab-btn ${activeTab === 'livestream' ? 'active' : ''}`} style={{borderColor:'#ef4444', color: activeTab==='livestream' ? 'white' : '#ef4444', background: activeTab==='livestream' ? '#ef4444' : 'white'}}>Go Live</button>
            <button onClick={() => { setActiveTab('settings'); }} className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`} style={{background: activeTab==='settings'?'#eef2ff':'transparent'}}>⚙️ Payment Settings</button>
          </div>

          {activeTab === 'settings' ? (
            /* --- SETTINGS TAB --- */
            <div style={{animation:'fadeIn 0.3s'}}>
              <h2 style={{textAlign:'center'}}>Payment Configuration</h2>
              <form onSubmit={handleSaveSettings}>
                <div className="form-group">
                  <label>Midtrans Server Key</label>
                  <input className="input-field" type="password" value={settingsData.midtransServerKey} onChange={e => setSettingsData({...settingsData, midtransServerKey: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Midtrans Client Key</label>
                  <input className="input-field" value={settingsData.midtransClientKey} onChange={e => setSettingsData({...settingsData, midtransClientKey: e.target.value})} required />
                </div>
                <button type="submit" className="btn-primary" style={{marginTop:'1rem'}}>Save Keys</button>
              </form>
            </div>
          ) : (
            /* --- LISTING FORM --- */
            <form onSubmit={handleSubmit}>
              {editingId && (
                <div style={{background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', padding: '10px', borderRadius: '6px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                   <span>You are currently editing <strong>{formData.name || formData.title}</strong> (ID: {editingId})</span>
                   <button type="button" onClick={() => resetForm(activeTab)} style={{background:'transparent', border:'1px solid #9a3412', color:'#9a3412', borderRadius:'4px', cursor:'pointer', padding:'2px 8px'}}>Cancel Edit</button>
                </div>
              )}

              {activeTab === 'livestream' ? (
                <div style={{ animation: 'fadeIn 0.5s' }}>
                   <div className="form-group"><label>Stream Title</label><input className="input-field" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required /></div>
                   <div className="form-group"><label>YouTube Embed URL</label><input className="input-field" value={formData.streamUrl} onChange={e => setFormData({...formData, streamUrl: e.target.value})} required /></div>
                   
                   {/* --- NEW DROPDOWN: LINK PRODUCT --- */}
                   <div className="form-group" style={{marginTop:'1rem', padding:'1rem', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:'8px'}}>
                      <label style={{color:'#166534'}}>🛒 Feature a Product (Optional)</label>
                      <select 
                        className="input-field" 
                        value={formData.selectedItemId} 
                        onChange={e => setFormData({...formData, selectedItemId: e.target.value})}
                      >
                        <option value="">-- No Linked Product --</option>
                        {allItemsForLive.map(item => (
                          <option key={item.id} value={item.id}>
                            {item.type === 'product' ? '📦' : '🛠️'} {item.name}
                          </option>
                        ))}
                      </select>
                      <small style={{display:'block', marginTop:'5px', color:'#166534'}}>Viewers can buy this item directly from your stream!</small>
                   </div>
                </div>
              ) : (
                <>
                  <div className="flex-row" style={{gap:'1rem'}}>
                    <div className="form-group" style={{flex:2}}>
                      <label>Item Name</label>
                      <input className="input-field" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                    </div>
                    <div className="form-group" style={{flex:1}}>
                      <label>Price (Rp)</label>
                      <input type="number" className="input-field" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} required />
                    </div>
                    {activeTab === 'product' && (
                      <div className="form-group" style={{flex:1}}>
                        <label>Total Stock</label>
                        <input type="number" className="input-field" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} required />
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Description</label>
                    <textarea className="input-field" rows={5} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Describe your item in detail..." style={{resize:'vertical'}} />
                  </div>

                  {/* --- VARIANT BUILDER --- */}
                  <div className="form-section">
                    <h3 className="section-title">Variants (e.g., Color, Size)</h3>
                    {variants.map((variant, vIndex) => (
                      <div key={vIndex} className="variant-box">
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem'}}>
                          <strong>{variant.name}</strong>
                          <button type="button" onClick={() => removeVariantType(vIndex)} style={{color:'red', background:'none', border:'none', cursor:'pointer'}}>Remove Type</button>
                        </div>
                        
                        <div style={{display:'flex', flexWrap:'wrap', gap:'1rem', marginBottom:'1rem'}}>
                          {variant.options.map((option, oIndex) => (
                            <div key={oIndex} style={{background:'#f3f4f6', padding:'0.5rem', borderRadius:'8px', display:'flex', alignItems:'center', gap:'0.5rem', border:'1px solid #e5e7eb'}}>
                              <label style={{cursor:'pointer', position:'relative', width:'40px', height:'40px', borderRadius:'4px', overflow:'hidden', background:'#ddd', display:'flex', alignItems:'center', justifyContent:'center'}}>
                                {option.previewUrl || option.image?.url ? (
                                  <img src={option.previewUrl || (option.image?.url ? `${process.env.NEXT_PUBLIC_API_URL}${option.image.url}` : '')} alt={option.name} style={{width:'100%', height:'100%', objectFit:'cover'}} />
                                ) : (
                                  <span style={{fontSize:'1.5rem', color:'#999'}}>+</span>
                                )}
                                <input type="file" accept="image/*" style={{display:'none'}} onChange={(e) => handleVariantImageUpload(e, vIndex, oIndex)} />
                              </label>
                              <span style={{fontWeight:'500', color:'#333'}}>{option.name}</span>
                              <button type="button" onClick={() => removeVariantOption(vIndex, oIndex)} style={{border:'none', background:'none', cursor:'pointer', color:'#999', fontWeight:'bold', padding:'0 0.2rem', marginLeft:'0.2rem'}}>×</button>
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

                  {/* --- ATTRIBUTE BUILDER --- */}
                  <div className="form-section">
                    <h3 className="section-title">Product Attributes</h3>
                    {attributes.map((attr, index) => (
                      <div key={index} style={{display:'flex', gap:'0.5rem', marginBottom:'0.5rem'}}>
                        <input placeholder="Key" className="input-field" value={attr.key} onChange={e => updateAttribute(index, 'key', e.target.value)} />
                        <input placeholder="Value" className="input-field" value={attr.value} onChange={e => updateAttribute(index, 'value', e.target.value)} />
                        <button type="button" onClick={() => removeAttribute(index)} style={{color:'red', background:'none', border:'1px solid red', borderRadius:'4px', cursor:'pointer', padding:'0 0.5rem'}}>X</button>
                      </div>
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
                      <div style={{display:'flex', gap:'0.5rem'}}>
                        <input className="input-field" placeholder={`Type ${activeTab} category...`} value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} required />
                        <button type="button" onClick={() => { setIsCustomCategory(false); setFormData({...formData, category: currentCategories[0]}); }} className="btn-secondary" style={{marginTop:0, padding:'0 1rem'}}>Cancel</button>
                      </div>
                    )}
                  </div>

                  {/* --- MAIN IMAGE UPLOAD (Multiple + Preview) --- */}
                  <div className="form-group">
                    <label>Upload Main Media (Select Multiple)</label>
                    <input 
                      type="file" 
                      className="file-input" 
                      accept="image/*,video/*" 
                      multiple 
                      onChange={handleMainMediaChange} 
                      required={!editingId && files.length === 0} 
                    />
                    
                    {/* Preview Grid */}
                    <div style={{display:'flex', gap:'10px', marginTop:'10px', flexWrap:'wrap'}}>
                      {previews.map((src, index) => (
                        <div key={index} style={{position:'relative', width:'80px', height:'80px', border:'1px solid #ddd', borderRadius:'8px', overflow:'hidden'}}>
                          <img src={src} alt="preview" style={{width:'100%', height:'100%', objectFit:'cover'}} />
                          <button 
                            type="button" 
                            onClick={() => removeImage(index)}
                            style={{position:'absolute', top:0, right:0, background:'rgba(255,0,0,0.8)', color:'white', border:'none', cursor:'pointer', width:'20px', height:'20px', display:'flex', alignItems:'center', justifyContent:'center'}}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <button type="submit" className="btn-primary" style={{ marginTop: '1.5rem' }} disabled={isSubmitting}>
                  {isSubmitting ? 'Processing...' : (editingId ? 'Update Listing' : 'Publish Listing')}
              </button>
            </form>
          )}
        </div>

        {/* --- YOUR ITEMS LIST --- */}
        {activeTab !== 'settings' && (
          <div style={{ marginTop: '3rem', borderTop: '1px solid #e5e7eb', paddingTop: '2rem' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: '#111827' }}>Your {activeTab === 'product' ? 'Products' : activeTab === 'service' ? 'Services' : 'Livestreams'}</h2>
            
            {myItems.length === 0 ? (
              <p style={{ color: '#6b7280' }}>You haven't listed any {activeTab}s yet.</p>
            ) : (
              <div className="grid-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
                {myItems.map((item) => {
                  const media = item.media?.data || item.media;
                  const firstImg = Array.isArray(media) ? media[0] : media;
                  const imgUrl = firstImg?.attributes?.url || firstImg?.url ? `${process.env.NEXT_PUBLIC_API_URL}${firstImg.attributes?.url || firstImg.url}` : null;

                  return (
                    <div key={item.id} className="card" style={{ padding: '1rem' }}>
                      <div style={{ height: '150px', background: '#f9fafb', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', overflow: 'hidden' }}>
                         {imgUrl ? <img src={imgUrl} style={{width:'100%', height:'100%', objectFit:'cover'}} /> : <span style={{fontSize:'2rem'}}>📦</span>}
                      </div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>{item.name || item.title}</h3>
                      <div style={{ fontWeight: 'bold', color: '#B12704', marginBottom: '1rem' }}>
                        {item.price ? `Rp ${item.price.toLocaleString()}` : 'Live Stream'}
                      </div>
                      
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                        <button 
                          onClick={() => handleEdit(item)}
                          className="btn-secondary" 
                          style={{ flex: 1, textAlign: 'center', fontSize: '0.8rem' }}
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleDelete(item.id)}
                          style={{ flex: 1, background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
      <style jsx>{`
        .form-section { background: #f9fafb; padding: 1rem; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 1.5rem; }
        .section-title { margin: 0 0 1rem 0; font-size: 1rem; color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.5rem; }
        .variant-box { background: white; padding: 0.75rem; border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 0.5rem; }
      `}</style>
    </div>
  );
}