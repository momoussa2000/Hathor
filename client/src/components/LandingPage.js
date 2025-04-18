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
        
        <div className="subscription-info">
          <h2>Divine Access</h2>
          <p className="price">$9.99/month</p>
          <ul className="benefits">
            <li>Unlimited access to Hathor's wisdom</li>
            <li>Personalized beauty and wellness guidance</li>
            <li>Ancient Egyptian beauty rituals</li>
            <li>Expert advice for your specific concerns</li>
          </ul>
        </div>
        
        <p className="disclaimer">
          * Subscription required to access Hathor's wisdom. Start your journey to ancient beauty secrets today.
        </p>
      </div>
    </div>
  );
};

export default LandingPage; 