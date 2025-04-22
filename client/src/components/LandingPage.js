import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/LandingPage.css';

const LandingPage = () => {
  const navigate = useNavigate();

  const handleEnter = () => {
    console.log('Enter button clicked, navigating to /chat');
    navigate('/chat');
  };

  return (
    <div className="landing-page">
      <div className="portal-container" onClick={handleEnter}>
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
      
      <button className="enter-portal-button" onClick={handleEnter}>
        Enter Hathor's Portal
      </button>

      <div className="content">
        <h1>Welcome to Hathor's Wisdom</h1>
        <p className="subtitle">Your guide to ancient Egyptian beauty and wellness</p>
        <div style={{background: 'red', color: 'white', padding: '20px', margin: '20px 0', fontSize: '24px', textAlign: 'center'}}>
          TEST ELEMENT - VERCEL DEPLOYMENT CHECK
        </div>
        
        <div className="portal-description">
          <h2>Discover Your Inner Radiance</h2>
          <p>
            Step into Hathor's Portal and unlock personalized beauty and wellness advice 
            inspired by the timeless wisdom of ancient Egypt. Receive guidance on natural 
            remedies, essential oil blends, and rituals tailored to your unique needs.
          </p>
          <p>
            Ask Hathor about your skin concerns, hair health, or overall well-being, 
            and let her ancient knowledge illuminate your path to natural beauty.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LandingPage; 