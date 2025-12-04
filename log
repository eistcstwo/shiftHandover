import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header.jsx';
import Footer from './components/Footer';
import Menu from './components/Menu';
import Dashboard from './components/Dashboard';
import Chatbot from './components/ChatBot';
import Login from './components/Login';
import './App.css';
import { fetchLatestAnnouncement } from './api/PostApi';

// Robust function to clear all cookies (within JS limitations)
function clearAllCookies() {
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const eqPos = cookie.indexOf("=");
    const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
    // Remove cookie for root path
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    // Attempt to remove cookie for every path segment
    const pathSegments = window.location.pathname.split('/');
    let path = '';
    for (let i = 0; i < pathSegments.length; i++) {
      path += (path.endsWith('/') ? '' : '/') + pathSegments[i];
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path};`;
    }
  }
}

// Function to conditionally disable inspect element
function useDisableInspectElement(enabled) {
  useEffect(() => {
    if (!enabled) return;

    document.oncontextmenu = function() {
      return false;
    };

    const handleKeyDown = (e) => {
      // F12
      if (e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
      }
      // Ctrl+Shift+I/J/C/U, Ctrl+U (view source), Cmd+Opt+I (Mac)
      if (
        (e.ctrlKey && e.shiftKey && ['I', 'J', 'C', 'U'].includes(e.key.toUpperCase())) ||
        (e.ctrlKey && e.key.toUpperCase() === 'U') ||
        (e.metaKey && e.altKey && e.key.toUpperCase() === 'I')
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    const handleDragStart = (e) => e.preventDefault();
    document.addEventListener('dragstart', handleDragStart);

    const handleSelectStart = (e) => {
      if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('keydown', handleSelectStart);

    return () => {
      document.removeEventListener('contextmenu', document.oncontextmenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('keydown', handleSelectStart);
    };
  }, [enabled]);
}

// Logout API call
async function callLogoutAPI(username) {
  try {
    // 1. Retrieve the session ID from local storage
    const sessionId = localStorage.getItem('sessionid');

    // Check if session ID exists before proceeding
    if (!sessionId) {
      console.warn('No session ID found in local storage. Skipping API call.');
      return;
    }

    // 2. Prepare the headers object with the correct Authorization format
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionId}`
    };

    const response = await fetch('https://10.191.171.12:5443/EISHOME/awthenticationService/newLogout/',
      {
        method: 'POST',
        headers: headers,
        credentials: 'include',
        body: JSON.stringify({
          username: username,
          timestamp: new Date().toISOString()
        })
      }
    );

    if (!response.ok) {
      console.warn('Logout API call failed:', response.status, response.statusText);
    } else {
      console.log('Logout API call successful');
    }
  } catch (error) {
    console.error('Error calling logout API:', error);
  }
}

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [chatbotMinimized, setChatbotMinimized] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [username, setUsername] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [showAnnouncementPopup, setShowAnnouncementPopup] = useState(false);
  const [userLevel, setUserLevel] = useState('');
  const [appLoading, setAppLoading] = useState(true);
  const inactivityTimer = useRef(null);

  // Inactivity time limit in ms (60 minutes)
  const INACTIVITY_LIMIT = 60 * 60 * 1000;

  // Define allowed user levels for Chatbot access
  const CHATBOT_ALLOWED_LEVELS = ['ADMIN', 'L2', 'Banker','L1'];
  const CHATBOT_BLOCKED_LEVELS = ['Support'];

  // Check if current user has access to chatbot
  const hasChatbotAccess = CHATBOT_ALLOWED_LEVELS.includes(userLevel) &&
    !CHATBOT_BLOCKED_LEVELS.includes(userLevel);

  // Only disable inspect for users other than ADMIN
  useDisableInspectElement(userLevel && userLevel !== 'ADMIN');

  // Check for existing login session on app load
  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    const storedLoginTime = localStorage.getItem('loginTime');
    const storedUserLevel = localStorage.getItem('userlevel'); // Note: lowercase 'userlevel' as stored by postLogin
    const storedSessionId = localStorage.getItem('sessionid');

    console.log('App.js - Checking stored session:', {
      storedUsername,
      storedUserLevel,
      hasSessionId: !!storedSessionId,
      hasLoginTime: !!storedLoginTime
    });

    // Only restore session if we have all required data
    if (storedUsername && storedUserLevel && storedSessionId) {
      console.log('App.js - Restoring session with username:', storedUsername);
      setUsername(storedUsername);
      setUserLevel(storedUserLevel);
      setIsLoggedIn(true);

      // Set login time if not already set
      if (!storedLoginTime) {
        localStorage.setItem('loginTime', Date.now().toString());
      }

      console.log('App.js - Session restored successfully');
    } else {
      console.log('App.js - No valid session found, showing login');
    }

    setAppLoading(false);
  }, []);

  // On login from persisted session, fetch announcement
  useEffect(() => {
    if (isLoggedIn && !announcement) {
      (async () => {
        try {
          const ann = await fetchLatestAnnouncement();
          setAnnouncement(ann);
          if (ann) setShowAnnouncementPopup(true);
        } catch (err) {
          console.error('Error fetching announcement:', err);
        }
      })();
    }
  }, [isLoggedIn, announcement]);

  // Handle login from Login component (receives username and response data)
  const handleLogin = async (user, loginData = {}) => {
    try {
      console.log('App.js - handleLogin called with:', { user, loginData });

      const now = Date.now();

      // Extract userLevel from loginData, fallback to what's in localStorage
      const level = loginData.userLevel || localStorage.getItem('userlevel') || '';

      console.log('App.js - Setting username:', user, 'userLevel:', level);

      // Store all data to localStorage
      localStorage.setItem('username', user);
      localStorage.setItem('userlevel', level);
      localStorage.setItem('loginTime', now.toString());

      // Session data should already be stored by postLogin or session validation
      // But just in case, store it if provided
      if (loginData.sessionid) {
        console.log('App.js - Updating sessionid from loginData');
        localStorage.setItem('sessionid', loginData.sessionid);
      }
      if (loginData.uid) {
        console.log('App.js - Updating uid from loginData');
        localStorage.setItem('uidd', loginData.uid);
      }

      // Set local state
      setUsername(user);
      setUserLevel(level);
      setIsLoggedIn(true);

      console.log('App.js - Login successful, state updated');
      console.log('App.js - Final state - isLoggedIn: true, username:', user, 'userLevel:', level);

    } catch (err) {
      console.error('App.js - Login error:', err);
      alert('Login failed: ' + err.message);
    }
  };

  // Logout and flush session storage, local storage, cookies, and caches
  const handleLogout = async () => {
    console.log('App.js - Logout initiated for user:', username);
    await callLogoutAPI(username);

    setIsLoggedIn(false);
    setUsername('');
    setUserLevel('');
    setAnnouncement('');
    localStorage.clear();
    sessionStorage.clear();
    clearAllCookies();

    console.log('App.js - Logout successful - all data cleared');
  };

  // --- Cross-Tab Storage Listener Logic ---
  useEffect(() => {
    const handleStorageChange = (event) => {
      // Check if the session ID was removed in another tab
      if (event.key === 'sessionid' && !event.newValue) {
        console.log("Session ID removed in another tab. Triggering logout.");
        handleLogout();
      }

      // Check if username was removed in another tab
      if (event.key === 'username' && !event.newValue) {
        console.log("Username removed in another tab. Triggering logout.");
        handleLogout();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [username]);

  // Auto logout after 60 min of inactivity
  useEffect(() => {
    if (!isLoggedIn) return;

    const resetInactivityTimer = () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      inactivityTimer.current = setTimeout(() => {
        alert('You have been logged out due to 60 minutes of inactivity.');
        handleLogout();
      }, INACTIVITY_LIMIT);
    };

    // List of events indicating user activity
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];

    // Add event listeners
    events.forEach(event =>
      window.addEventListener(event, resetInactivityTimer, true)
    );

    // Start timer initially
    resetInactivityTimer();

    // Cleanup event listeners and timer on unmount or logout
    return () => {
      events.forEach(event =>
        window.removeEventListener(event, resetInactivityTimer, true)
      );
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [isLoggedIn]);

  // Show loading state while checking for existing session
  if (appLoading) {
    return (
      <div>
        <Header darkMode={darkMode} setDarkMode={setDarkMode} />
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>Loading...</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div>
      <Header
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        username={username}
        onLogout={handleLogout}
      />
      {/* Announcement Popup */}
      {showAnnouncementPopup && announcement &&
        <div className="announcement-popup-overlay">
          <div className="announcement-popup">
            <button
              className="announcement-popup-close"
              onClick={() => setShowAnnouncementPopup(false)}
              aria-label="Close announcement"
            >
              ×
            </button>
            <div className="announcement-popup-content">
              <h3>Announcement</h3>
              <div>{announcement}</div>
            </div>
          </div>
        </div>
      }
      {!chatbotMinimized && <div className="app-background" />}
      <div className={`main ${isSidebarOpen ? "sidebar-open" : "sidebar-collapsed"}`}>
        <Menu
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
        />
        <Dashboard isSidebarOpen={isSidebarOpen} />
        {/* Conditionally render Chatbot only for specific user levels */}
        {hasChatbotAccess && (
          <Chatbot setChatbotMinimized={setChatbotMinimized} username={username} />
        )}
      </div>
      <Footer />
    </div>
  );
}

export default App;
