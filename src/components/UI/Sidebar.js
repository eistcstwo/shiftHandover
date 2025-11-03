import React from 'react';
import { NavLink } from 'react-router-dom';
import { FiHome, FiBarChart2, FiFileText } from 'react-icons/fi';
import './Sidebar.css';

const Sidebar = ({ userLevel }) => {
  // Check if user is ADMIN or L2 (not L1)
  const canAccessRestricted = userLevel === 'ADMIN' || userLevel === 'L2';

  return (
    <nav className="app-sidebar">
      <ul className="sidebar-nav">
        <li>
          <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            <FiHome className="nav-icon" />
            <span>Dashboard</span>
          </NavLink>
        </li>
        
        {/* Only show Reports if user is ADMIN or L2 */}
        {canAccessRestricted && (
          <li>
            <NavLink to="/reports" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <FiBarChart2 className="nav-icon" />
              <span>Reports</span>
            </NavLink>
          </li>
        )}
        
        {/* Only show Billing Analysis if user is ADMIN or L2 */}
        {canAccessRestricted && (
          <li>
            <NavLink to="/billing-analysis" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <FiFileText className="nav-icon" />
              <span>Billing Portal</span>
            </NavLink>
          </li>
        )}
      </ul>
    </nav>
  );
};

export default Sidebar;
