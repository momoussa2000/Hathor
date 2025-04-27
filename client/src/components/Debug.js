import React, { useState, useEffect } from 'react';

const BACKEND_URL = process.env.NODE_ENV === 'production' 
  ? '' // Empty string means same domain in production
  : 'http://localhost:5003';

function Debug() {
  const [healthStatus, setHealthStatus] = useState('Checking...');
  const [openaiStatus, setOpenaiStatus] = useState('Checking...');
  const [chatResponse, setChatResponse] = useState('Not tested');
  
  useEffect(() => {
    // Test health endpoint
    fetch(`${BACKEND_URL}/api/health`)
      .then(res => res.json())
      .then(data => setHealthStatus(JSON.stringify(data)))
      .catch(err => setHealthStatus(`Error: ${err.message}`));
      
    // Test OpenAI status if available
    fetch(`${BACKEND_URL}/api/check-openai-key`)
      .then(res => res.json())
      .then(data => setOpenaiStatus(JSON.stringify(data)))
      .catch(err => setOpenaiStatus(`Error: ${err.message}`));
  }, []);
  
  const testChat = async () => {
    setChatResponse('Testing...');
    try {
      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: 'Test message for API debugging'
        })
      });
      
      const data = await response.json();
      setChatResponse(JSON.stringify(data, null, 2));
    } catch (err) {
      setChatResponse(`Error: ${err.message}`);
    }
  };
  
  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>API Debug Tool</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <h2>Health Check</h2>
        <pre style={{ background: '#f4f4f4', padding: '10px' }}>{healthStatus}</pre>
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <h2>OpenAI Status</h2>
        <pre style={{ background: '#f4f4f4', padding: '10px' }}>{openaiStatus}</pre>
      </div>
      
      <div>
        <h2>Chat API Test</h2>
        <button 
          onClick={testChat}
          style={{ 
            padding: '10px 15px', 
            background: '#4A90E2', 
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginBottom: '10px'
          }}
        >
          Test Chat API
        </button>
        <pre style={{ background: '#f4f4f4', padding: '10px' }}>{chatResponse}</pre>
      </div>
    </div>
  );
}

export default Debug; 