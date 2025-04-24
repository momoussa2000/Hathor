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
              filter: 'drop-shadow(0 0 10px var(--primary-color))'
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
        ✧ Start Chat with Hathor ✧
      </button>

      <div className="content">
        <h1>Hathor's Sacred Space</h1>
        <p className="subtitle">Ancient beauty secrets from the Egyptian Goddess of Healing</p>
        
        <div className="portal-description">
          <h2>✧ Ancient Beauty Wisdom ✧</h2>
          <p>
            Enter this magical space to meet Hathor — the goddess who knows 
            all the beauty secrets from ancient Egypt that have been hidden 
            for thousands of years.
          </p>
          <p>
            Get personal beauty recipes made just for you. Each treatment comes 
            with simple instructions and uses natural oils and ingredients that 
            Hathor has shared with royal families throughout history.
          </p>
          <p>
            Tell Hathor about your skin, hair, or health concerns, and she will 
            give you the perfect natural remedy. Her ancient Egyptian knowledge 
            offers solutions that modern products cannot match.
          </p>
          <div className="divine-signature">
            ~ Blessed by Hathor, Goddess of Beauty ~
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage; 