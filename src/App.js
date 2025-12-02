import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import { dummyShifts } from "./data/dummyShifts";

// Components
import Header from "./components/UI/Header";
import Sidebar from "./components/UI/Sidebar";
import HandoverList from "./components/Handovers/HandoverList";
import CreateHandover from "./components/Handovers/CreateHandover";
import HandoverDetail from "./components/Handovers/HandoverDetail";
import HandoverReports from "./components/Reports/HandoverReports";
import BillingAnalysis from "./components/BillingAnalysis/BillingAnalysis";
import HistorySummary from "./components/Handovers/HistorySummary";

import "./App.css";

/* -------------------------------------------------------
    REQUIRE AUTH WRAPPER (GLOBAL CHECK BEFORE APP LOADS)
---------------------------------------------------------*/
const RequireAuth = ({ children }) => {
  const username = localStorage.getItem("username");
  const sessionId = localStorage.getItem("sessionid");
  const userlevel = localStorage.getItem("userlevel");

  // If not logged in → redirect to SSO login
  if (!username || !sessionId || !userlevel) {
    const currentUrl = encodeURIComponent(window.location.href);

    window.location.href = `https://10.191.171.12:5443/EISHOME/?return_url=${currentUrl}`;
    return null; // stop rendering React
  }

  return children;
};

/* -------------------------------------------------------
    PROTECTED ROUTE FOR ROLE-BASED ACCESS
---------------------------------------------------------*/
const ProtectedRoute = ({ children, allowedRoles }) => {
  const userLevel = localStorage.getItem("userlevel");

  if (!allowedRoles.includes(userLevel)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

/* -------------------------------------------------------
                    MAIN APP COMPONENT
---------------------------------------------------------*/
function App() {
  const [handovers, setHandovers] = useState([]);
  const [shifts, setShifts] = useState(dummyShifts);
  const [userLevel, setUserLevel] = useState("");

  useEffect(() => {
    const level = localStorage.getItem("userlevel") || "L2";
    setUserLevel(level);
  }, []);

  // Add new handover
  const addHandover = (newHandover) => {
    setHandovers([
      {
        ...newHandover,
        id: `handover-${Date.now()}`,
        createdAt: new Date().toISOString(),
        createdBy: { name: "System User" },
      },
      ...handovers,
    ]);
  };

  // Update existing handovers
  const updateHandovers = (updatedHandovers) => {
    setHandovers(updatedHandovers);
  };

  return (
    <Router basename="/shiftHandoverFrontend">

      {/* 🔐 Wrap the entire app with RequireAuth */}
      <RequireAuth>
        <div className="app-container">
          <Header />

          <div className="main-content">
            <Sidebar userLevel={userLevel} />

            <div className="content-area">
              <Routes>
                {/* Redirect root → dashboard */}
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
                  element={<CreateHandover shifts={shifts} onSubmit={addHandover} />}
                />

                <Route
                  path="/handover/:id"
                  element={<HandoverDetail handovers={handovers} userLevel={userLevel} />}
                />

                {/* Admin & L2 Restricted Routes */}
                <Route
                  path="/reports"
                  element={
                    <ProtectedRoute allowedRoles={["ADMIN", "L2"]}>
                      <HandoverReports handovers={handovers} />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/billing-analysis"
                  element={
                    <ProtectedRoute allowedRoles={["ADMIN", "L2"]}>
                      <BillingAnalysis />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/history-summary"
                  element={
                    <ProtectedRoute allowedRoles={["ADMIN", "L2"]}>
                      <HistorySummary />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </div>
          </div>
        </div>
      </RequireAuth>
    </Router>
  );
}

export default App;
