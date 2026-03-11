"use client";
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AccountPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('profile');
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({ username: '', email: '' });
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

const fetchOrders = useCallback(async (username, token) => {
    try {
      // FIXED: Now filtering by the 'buyer_name' varchar field from your ERD
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/orders?filters[buyer_name][$eq]=${username}&sort=createdAt:desc`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(res.data.data);
    } catch (error) {
      console.error("Failed to fetch orders:", error);
    }
  }, []);

useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (!token || !userStr) {
      router.push('/login');
    } else {
      const parsedUser = JSON.parse(userStr);
      setUser(parsedUser);
      setFormData({ username: parsedUser.username, email: parsedUser.email });
      
      // FIXED: Pass the username instead of the id
      fetchOrders(parsedUser.username, token); 
      
      setIsLoading(false);
    }
  }, [router, fetchOrders]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const token = localStorage.getItem('token');
    
    try {
      const res = await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${user.id}`, {
        username: formData.username,
        email: formData.email,
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      const updatedUser = { ...user, ...res.data };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      alert("Profile updated successfully!");
    } catch (err) {
      alert("Failed to update profile. Email or username might already be taken.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert("New passwords do not match!");
      return;
    }
    setIsSubmitting(true);
    const token = localStorage.getItem('token');

    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/change-password`, {
        currentPassword: passwordData.currentPassword,
        password: passwordData.newPassword,
        passwordConfirmation: passwordData.confirmPassword,
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      alert("Password updated successfully!");
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      alert("Failed to update password. Please check your current password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmDelete = confirm("DANGER: Are you absolutely sure you want to delete your account? This cannot be undone.");
    if (!confirmDelete) return;

    const token = localStorage.getItem('token');
    try {
      // Note: Strapi requires custom backend logic to allow users to delete themselves, 
      // but this is the standard endpoint if permissions are enabled.
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      alert("Account deleted.");
      router.push('/');
    } catch (err) {
      alert("Failed to delete account. Please contact an administrator.");
    }
  };

  if (isLoading) return <div className="container" style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div>;

  return (
    <div className="container" style={{ maxWidth: '900px', padding: '2rem 1rem' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem' }}>
        <h1 style={{ color: 'var(--action-primary)', fontSize: '2.4rem', margin: 0, fontWeight: '800', letterSpacing: '-1px' }}>
          Your Account
        </h1>
        <Link href="/" className="btn-secondary" style={{ textDecoration: 'none' }}>
          Back to Market
        </Link>
      </div>

      {/* TABS */}
      <div className="tab-group">
        <button 
          className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`} 
          onClick={() => setActiveTab('profile')}
        >
          👤 Profile Settings
        </button>
        <button 
          className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`} 
          onClick={() => setActiveTab('orders')}
        >
          📦 Order History
        </button>
      </div>

      {/* PROFILE TAB */}
      {activeTab === 'profile' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* General Info */}
          <div className="form-section">
            <h2 className="section-title">General Information</h2>
            <form onSubmit={handleUpdateProfile}>
              <div className="form-group">
                <label>Username</label>
                <input type="text" className="input-field" value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input type="email" className="input-field" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
              </div>
              <button type="submit" className="btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : '💾 Save Changes'}
              </button>
            </form>
          </div>

          {/* Security */}
          <div className="form-section">
            <h2 className="section-title">Security & Password</h2>
            <form onSubmit={handleUpdatePassword}>
              <div className="form-group">
                <label>Current Password</label>
                <input type="password" className="input-field" value={passwordData.currentPassword} onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>New Password</label>
                <input type="password" className="input-field" value={passwordData.newPassword} onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <input type="password" className="input-field" value={passwordData.confirmPassword} onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})} required />
              </div>
              <button type="submit" className="btn-primary" disabled={isSubmitting}>
                🔒 Update Password
              </button>
            </form>
          </div>

          {/* Danger Zone */}
          <div className="form-section" style={{ border: '1px solid var(--danger-color)' }}>
            <h2 className="section-title" style={{ color: 'var(--danger-color)' }}>Danger Zone</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Once you delete your account, there is no going back. Please be certain.
            </p>
            <button type="button" onClick={handleDeleteAccount} className="btn-primary" style={{ background: 'var(--danger-bg)', color: 'var(--danger-color)', boxShadow: 'none' }}>
              🗑️ Delete My Account
            </button>
          </div>

        </div>
      )}

      {/* ORDERS TAB */}
      {activeTab === 'orders' && (
        <div className="form-section" style={{ background: 'transparent', padding: 0, boxShadow: 'none', border: 'none' }}>
          <h2 className="section-title" style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '1rem' }}>
            Your Previous Orders
          </h2>
          
          {orders.length === 0 ? (
            <div style={{ background: 'var(--bg-element)', padding: '3rem', textAlign: 'center', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-strong)' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', margin: 0 }}>You haven't placed any orders yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {orders.map((order, idx) => {
                const o = order.attributes || order;
                return (
                  <div key={idx} style={{ padding: '1.5rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--bg-element)', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Order #{o.order_id || order.id}</h3>
                      <span style={{ 
                        background: o.order_status === 'Pending' ? '#fef3c7' : o.order_status === 'Shipped' ? '#dbeafe' : '#d1fae5', 
                        color: o.order_status === 'Pending' ? '#d97706' : o.order_status === 'Shipped' ? '#2563eb' : '#059669', 
                        padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-pill)', fontSize: '0.85rem', fontWeight: 'bold' 
                      }}>
                        {o.order_status || 'Processing'}
                      </span>
                    </div>
                    <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)' }}>Total: <strong style={{ color: 'var(--action-primary)' }}>Rp {(o.total_price || 0).toLocaleString('id-ID')}</strong></p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}