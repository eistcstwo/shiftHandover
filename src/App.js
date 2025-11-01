import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { dummyShifts } from './data/dummyShifts';

// Import Components
import Header from './components/UI/Header';
import Sidebar from './components/UI/Sidebar';
import HandoverList from './components/Handovers/HandoverList';
import CreateHandover from './components/Handovers/CreateHandover';
import HandoverDetail from './components/Handovers/HandoverDetail';
import HandoverReports from './components/Reports/HandoverReports';
import DeploymentLogger from './components/DeploymentLogger/DeploymentLogger';
import BillingAnalysis from './components/BillingAnalysis/BillingAnalysis';

// Main CSS
import './App.css';

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const userLevel = localStorage.getItem('userlevel');
  
  if (!allowedRoles.includes(userLevel)) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

function App() {
  // State for handovers and shifts
  const [handovers, setHandovers] = useState([]);
  const [shifts, setShifts] = useState(dummyShifts);
  const [userLevel, setUserLevel] = useState('');

  useEffect(() => {
    // Get user level from localStorage
    const level = localStorage.getItem('userlevel') || 'L2';
    setUserLevel(level);
  }, []);

  // Function to add new handover
  const addHandover = (newHandover) => {
    setHandovers([
      {
        ...newHandover,
        id: `handover-${Date.now()}`,
        createdAt: new Date().toISOString(),
        createdBy: { name: "System User" }
      },
      ...handovers
    ]);
  };

  // Function to update handovers (including tasks)
  const updateHandovers = (updatedHandovers) => {
    setHandovers(updatedHandovers);
  };

  return (
    <Router basename="/shiftHandoverFrontend">
      <div className="app-container">
        <Header />
        <div className="main-content">
          <Sidebar userLevel={userLevel} />
          <div className="content-area">
            <Routes>
              {/* Add root route that redirects to dashboard */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              <Route
                path="/dashboard"
                element={
                  <HandoverList
                    onHandoversUpdate={updateHandovers}
                    userLevel={userLevel}
                  />
                }
              />
              <Route
                path="/create"
                element={
                  <CreateHandover
                    shifts={shifts}
                    onSubmit={addHandover}
                  />
                }
              />
              <Route
                path="/handover/:id"
                element={
                  <HandoverDetail 
                    handovers={handovers}
                    userLevel={userLevel}
                  />
                }
              />
              
              {/* Protected Routes - Only accessible by ADMIN and L1 */}
              <Route
                path="/reports"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'L1']}>
                    <HandoverReports handovers={handovers} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/billing-analysis"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'L1']}>
                    <BillingAnalysis />
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/deployment-logger"
                element={<DeploymentLogger />}
              />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}

export default App;
