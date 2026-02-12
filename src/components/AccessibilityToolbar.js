"use client";
import { useState, useEffect } from 'react';

export default function AccessibilityToolbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Apply classes to <html> and <body>
  useEffect(() => {
    if (highContrast) {
      document.body.classList.add('high-contrast');
    } else {
      document.body.classList.remove('high-contrast');
    }

    if (largeText) {
      document.documentElement.classList.add('large-text');
    } else {
      document.documentElement.classList.remove('large-text');
    }
  }, [highContrast, largeText]);

  // Text-to-Speech Logic
  const handleSpeak = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      // Read the 'main' content text
      const textToRead = document.querySelector('main')?.innerText || document.body.innerText;
      const utterance = new SpeechSynthesisUtterance(textToRead);
      
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999 }}>
      {/* Menu Content */}
      {isOpen && (
        <div style={{
          marginBottom: '10px',
          background: 'white',
          border: '2px solid #3b82f6',
          borderRadius: '12px',
          padding: '1rem',
          boxShadow: '0 10px 15px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          minWidth: '200px',
          animation: 'fadeInUp 0.3s ease-out'
        }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#1e3a8a' }}>Accessibility</h4>
          
          <button 
            onClick={() => setLargeText(!largeText)}
            style={btnStyle(largeText)}
          >
            <span style={{ fontSize: '1.2rem' }}>A+</span> Large Text
          </button>

          <button 
            onClick={() => setHighContrast(!highContrast)}
            style={btnStyle(highContrast)}
          >
            <span style={{ fontSize: '1.2rem' }}>◐</span> High Contrast
          </button>

          <button 
            onClick={handleSpeak}
            style={btnStyle(isSpeaking)}
          >
            <span style={{ fontSize: '1.2rem' }}>{isSpeaking ? '⏹' : '🔊'}</span> 
            {isSpeaking ? 'Stop Reading' : 'Read Page'}
          </button>
        </div>
      )}

      {/* Toggle Button (Floating Icon) */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: '#2563eb',
          color: 'white',
          border: 'none',
          boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
          cursor: 'pointer',
          fontSize: '2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        aria-label="Open Accessibility Menu"
      >
        ♿
      </button>
    </div>
  );
}

// Helper style for buttons
const btnStyle = (isActive) => ({
  padding: '0.75rem',
  border: isActive ? '2px solid #2563eb' : '1px solid #ddd',
  background: isActive ? '#eff6ff' : 'white',
  color: isActive ? '#1e3a8a' : '#374151',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 'bold',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  transition: 'all 0.2s'
});