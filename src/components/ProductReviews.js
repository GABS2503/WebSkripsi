"use client";
import { useState, useEffect } from 'react';
import axios from 'axios';

export default function ProductReviews({ itemId, itemType }) {
  const [reviews, setReviews] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [rating, setRating] = useState(5);
  const [media, setMedia] = useState(null);
  const [preview, setPreview] = useState(null);
  const [replyContent, setReplyContent] = useState({}); // Map of reviewId -> content
  const [activeReplyId, setActiveReplyId] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) setUser(JSON.parse(u));
    fetchReviews();
  }, [itemId]);

  const fetchReviews = async () => {
    try {
      // Filter by product OR service depending on type
      const filterField = itemType === 'product' ? 'product' : 'service';
      
      // We fetch top-level reviews (where parent is null)
      const query = new URLSearchParams({
        [`filters[${filterField}][documentId][$eq]`]: itemId,
        'filters[parent][$null]': 'true', 
        'populate[0]': 'user',
        'populate[1]': 'media',
        'populate[2]': 'replies.user', // Nested populate for replies
        'sort': 'createdAt:desc'
      }).toString();

      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}api/reviews?${query}`);
      setReviews(res.data.data);
    } catch (err) {
      console.error("Error fetching reviews:", err);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setMedia(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e, parentId = null) => {
    e.preventDefault();
    if (!user) { alert("Please login to review"); return; }

    const content = parentId ? replyContent[parentId] : newComment;
    if (!content?.trim()) return;

    try {
      const token = localStorage.getItem('token');
      let mediaId = null;

      // 1. Upload Image (only for top-level reviews in this example)
      if (!parentId && media) {
        const formData = new FormData();
        formData.append('files', media);
        const uploadRes = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}api/upload`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        mediaId = uploadRes.data[0].id;
      }

      // 2. Create Review
      const payload = {
        data: {
          content: content,
          rating: parentId ? null : rating, // Replies don't have ratings usually
          user: user.id,
          [itemType === 'product' ? 'product' : 'service']: itemId,
          parent: parentId, // Link to parent if it's a reply
          media: mediaId
        }
      };

      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}api/reviews`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Reset Form
      if (parentId) {
        setReplyContent({ ...replyContent, [parentId]: '' });
        setActiveReplyId(null);
      } else {
        setNewComment('');
        setMedia(null);
        setPreview(null);
        setRating(5);
      }
      
      fetchReviews(); // Refresh list
    } catch (err) {
      console.error(err);
      alert("Failed to submit review");
    }
  };

  const renderStars = (count) => {
    return "★".repeat(count) + "☆".repeat(5 - count);
  };

  return (
    <div style={{ marginTop: '3rem', background: 'white', padding: '2rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
      <h3 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Customer Reviews</h3>

      {/* --- WRITE REVIEW FORM --- */}
      {user ? (
        <form onSubmit={(e) => handleSubmit(e)} style={{ marginBottom: '2rem', background: '#f9fafb', padding: '1.5rem', borderRadius: '8px' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Rating</label>
            <div style={{ display: 'flex', gap: '5px' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button 
                  key={star} 
                  type="button" 
                  onClick={() => setRating(star)}
                  style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: star <= rating ? '#fbbf24' : '#d1d5db' }}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <textarea 
              className="input-field" 
              rows={3} 
              placeholder="Write your review..." 
              value={newComment} 
              onChange={(e) => setNewComment(e.target.value)} 
              style={{ width: '100%', padding: '0.8rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem', fontSize:'0.9rem' }}>Add Photo (Optional)</label>
            <input type="file" accept="image/*" onChange={handleImageChange} />
            {preview && <img src={preview} alt="Preview" style={{ height: '60px', marginTop: '10px', borderRadius: '4px' }} />}
          </div>

          <button type="submit" className="btn-primary" style={{ background: '#2563eb', color: 'white', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
            Submit Review
          </button>
        </form>
      ) : (
        <div style={{ padding: '1rem', background: '#eff6ff', color: '#1e40af', borderRadius: '6px', marginBottom: '2rem' }}>
          Please <a href="/login" style={{ fontWeight: 'bold', textDecoration: 'underline' }}>log in</a> to write a review.
        </div>
      )}

      {/* --- REVIEWS LIST --- */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {reviews.length === 0 && <p style={{ color: '#6b7280' }}>No reviews yet. Be the first!</p>}
        
        {reviews.map((review) => {
          const rData = review.attributes || review;
          const rUser = rData.user?.data?.attributes || rData.user || {};
          const rMedia = rData.media?.data?.attributes || rData.media;
          const replies = rData.replies?.data || rData.replies || [];

          return (
            <div key={review.id} style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '35px', height: '35px', background: '#3b82f6', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                    {rUser.username?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{rUser.username || 'Anonymous'}</div>
                    <div style={{ color: '#fbbf24', fontSize: '0.9rem' }}>{renderStars(rData.rating || 0)}</div>
                  </div>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                  {new Date(rData.createdAt).toLocaleDateString()}
                </div>
              </div>

              <p style={{ color: '#374151', lineHeight: '1.5', margin: '0.5rem 0' }}>{rData.content}</p>

              {rMedia && (
                <img 
                  src={`${process.env.NEXT_PUBLIC_API_URL}${rMedia.url}`} 
                  alt="Review attachment" 
                  style={{ maxWidth: '150px', borderRadius: '6px', marginTop: '0.5rem', border: '1px solid #eee' }} 
                />
              )}

              {/* --- REPLY BUTTON --- */}
              <div style={{ marginTop: '0.5rem' }}>
                <button 
                  onClick={() => setActiveReplyId(activeReplyId === review.id ? null : review.id)}
                  style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.85rem', cursor: 'pointer', padding: 0 }}
                >
                  {activeReplyId === review.id ? 'Cancel Reply' : 'Reply'}
                </button>
              </div>

              {/* --- REPLY FORM --- */}
              {activeReplyId === review.id && user && (
                <div style={{ marginTop: '10px', marginLeft: '2rem', display: 'flex', gap: '10px' }}>
                  <input 
                    className="input-field"
                    placeholder="Write a reply..." 
                    value={replyContent[review.id] || ''}
                    onChange={(e) => setReplyContent({ ...replyContent, [review.id]: e.target.value })}
                    style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px' }}
                  />
                  <button 
                    onClick={(e) => handleSubmit(e, review.id)}
                    style={{ background: '#2563eb', color: 'white', border: 'none', padding: '0 1rem', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Post
                  </button>
                </div>
              )}

              {/* --- NESTED REPLIES DISPLAY --- */}
              {replies.length > 0 && (
                <div style={{ marginTop: '1rem', marginLeft: '2rem', paddingLeft: '1rem', borderLeft: '3px solid #f3f4f6' }}>
                  {replies.map((reply) => {
                    const repData = reply.attributes || reply;
                    const repUser = repData.user?.data?.attributes || repData.user || {};
                    return (
                      <div key={reply.id} style={{ marginBottom: '0.8rem' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#111827' }}>
                          {repUser.username || 'User'} 
                          <span style={{ fontWeight: 'normal', color: '#6b7280', marginLeft: '5px', fontSize: '0.75rem' }}>
                            • {new Date(repData.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p style={{ margin: '2px 0', fontSize: '0.9rem', color: '#4b5563' }}>{repData.content}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}