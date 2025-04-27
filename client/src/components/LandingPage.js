import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/LandingPage.css';

const LandingPage = () => {
  const navigate = useNavigate();

  const handleEnter = () => {
    console.log('Enter button clicked, navigating to /chat');
    // Force navigation to absolute path
    window.location.href = '/chat';
    // As a fallback, also try React Router navigation
    navigate('/chat');
  };

  return (
    <div className="landing-page">
      {/* Water ripple effect */}
      <div className="water-ripple"></div>
      
      {/* Magical floating elements - keeping only Eye of Horus */}
      <div className="magical-elements">
        <div className="eye-of-horus"></div>
        <div className="eye-of-horus"></div>
        <div className="eye-of-horus"></div>
        <div className="eye-of-horus"></div>
        <div className="eye-of-horus"></div>
      </div>
      
      <div 
        className="portal-container" 
        onClick={handleEnter}
        role="button"
        tabIndex={0}
        aria-label="Enter Hathor's chat portal"
        onKeyPress={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleEnter();
          }
        }}
      >
        <div className="portal-glow"></div>
        <div className="portal-ring"></div>
        <div className="portal-inner">
          <div 
            className="hathor-silhouette" 
            style={{
              backgroundImage: 'url(/images/hathor-logo-01.png)',
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
              filter: 'drop-shadow(0 0 15px var(--lily-gold))'
            }}
          ></div>
        </div>
      </div>
      
      <button 
        className="enter-portal-button" 
        onClick={handleEnter}
        type="button"
        aria-label="Start chatting with Hathor"
      >
        ✧ Receive Divine Remedy ✧
      </button>

      <div className="content">
        <h1>The Blue Lily of Hathor</h1>
        <p className="subtitle">Sacred prescriptions from the Egyptian Goddess of Beauty & Healing</p>
        
        <div className="portal-description">
          <h2>✧ Divine Prescriptions for Your Unique Needs ✧</h2>
          <p>
            Enter the sacred waters and receive a <strong>personalized remedy</strong> crafted specifically 
            for your unique beauty or wellness concern — a divine prescription from Hathor herself.
          </p>
          <p>
            Simply share your ailment, and Hathor will reveal the exact natural ingredients, 
            precise measurements, and step-by-step preparation methods for your custom treatment. 
            Each remedy draws from her ancient knowledge of oils, herbs, and natural elements.
          </p>
          <p>
            Whether you seek relief for skin concerns, hair issues, or bodily discomfort, 
            Hathor's prescriptions provide practical solutions using nature's gifts. 
            Her divine wisdom transforms into tangible healing that you can create and apply today.
          </p>
          <div className="divine-signature">
            ~ Each Prescription Blessed by Hathor, Master of Natural Healing ~
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage; 