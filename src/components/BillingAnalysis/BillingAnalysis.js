import React, { useState, useMemo, useEffect } from 'react';
import './BillingAnalysis.css';

const API_BASE = 'https://10.191.171.12:5443/EISHOME_TEST/projectRoster/search/';
const ANNOTATION_API = 'https://10.191.171.12:5443/EISHOME_TEST/projectRoster/update_annotation/';

const BillingAnalysis = () => {
  // Search / filters
  const [q, setQ] = useState('');
  const [id, setId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [teamname, setTeamname] = useState('');
  const [shift, setShift] = useState('');
  const [action, setAction] = useState('');

  // data + UI state
  const [billingData, setBillingData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // New state for fetched dates and months
  const [validDates, setValidDates] = useState([]);
  const [availableMonths, setAvailableMonths] = useState([]);
  
  // New state for teams and shifts dropdowns
  const [availableTeams, setAvailableTeams] = useState([]);
  const [availableShifts, setAvailableShifts] = useState([]);
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const [showShiftDropdown, setShowShiftDropdown] = useState(false);
  
  // State for annotations (comments and status)
  const [annotations, setAnnotations] = useState({});
  const [submittingAnnotations, setSubmittingAnnotations] = useState({});

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Fetch teams when team input is focused
  const fetchTeams = async () => {
    try {
      const response = await fetch(`${API_BASE}?action=get_teams`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch teams: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Teams data:', data);
      
      if (data.teams && Array.isArray(data.teams)) {
        setAvailableTeams(data.teams);
      } else if (Array.isArray(data)) {
        setAvailableTeams(data);
      }
    } catch (err) {
      console.error('Error fetching teams:', err);
    }
  };

  // Fetch shifts when shift input is focused
  const fetchShifts = async () => {
    try {
      const response = await fetch(`${API_BASE}?action=get_shifts`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch shifts: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Shifts data:', data);
      
      if (data.shifts && Array.isArray(data.shifts)) {
        setAvailableShifts(data.shifts);
      } else if (Array.isArray(data)) {
        setAvailableShifts(data);
      }
    } catch (err) {
      console.error('Error fetching shifts:', err);
    }
  };

  // Fetch months based on any provided field
  const fetchMonths = async (fieldName, fieldValue) => {
    if (!fieldValue) return;
    
    try {
      const params = new URLSearchParams({ action: 'get_months' });
      params.append(fieldName, fieldValue);

      const response = await fetch(`${API_BASE}?${params.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch months: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Months data:', data);
      
      if (data.months && Array.isArray(data.months)) {
        setAvailableMonths(data.months);
      } else if (Array.isArray(data)) {
        setAvailableMonths(data);
      }
    } catch (err) {
      console.error('Error fetching months:', err);
    }
  };

  // Fetch valid dates when any field changes
  useEffect(() => {
    if (q) {
      fetchMonths('q', q);
    } else if (id) {
      fetchMonths('id', id);
    } else if (teamname) {
      fetchMonths('teamname', teamname);
    } else if (shift) {
      fetchMonths('shift', shift);
    }
  }, [q, id, teamname, shift]);

  // Handle search
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (q) params.append('q', q);
      if (id) params.append('id', id);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (teamname) params.append('teamname', teamname);
      if (shift) params.append('shift', shift);
      if (action) params.append('action', action);

      const response = await fetch(`${API_BASE}?${params.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Search results:', data);
      
      setBillingData(Array.isArray(data) ? data : []);
      setCurrentPage(1);
      
      // Initialize annotations state for each row
      const initialAnnotations = {};
      (Array.isArray(data) ? data : []).forEach(item => {
        const rosterId = item.id || item.roster_id;
        initialAnnotations[rosterId] = {
          comment: item.comment || '',
          status: 'True'
        };
      });
      setAnnotations(initialAnnotations);
    } catch (err) {
      setError(err.message);
      setBillingData([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle annotation submission
  const handleAnnotationSubmit = async (rosterId) => {
    const annotation = annotations[rosterId];
    if (!annotation || !annotation.comment.trim()) {
      alert('Please enter a comment before submitting');
      return;
    }

    setSubmittingAnnotations(prev => ({ ...prev, [rosterId]: true }));

    try {
      const response = await fetch(ANNOTATION_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roster_id: rosterId,
          comment: annotation.comment,
          status: annotation.status
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Annotation result:', result);
      alert('Annotation submitted successfully!');
      
      // Clear the annotation for this row
      setAnnotations(prev => ({
        ...prev,
        [rosterId]: { comment: '', status: 'True' }
      }));
    } catch (err) {
      alert(`Error submitting annotation: ${err.message}`);
    } finally {
      setSubmittingAnnotations(prev => ({ ...prev, [rosterId]: false }));
    }
  };

  // Update annotation comment
  const updateAnnotationComment = (rosterId, comment) => {
    setAnnotations(prev => ({
      ...prev,
      [rosterId]: { ...prev[rosterId], comment }
    }));
  };

  // Update annotation status
  const updateAnnotationStatus = (rosterId, status) => {
    setAnnotations(prev => ({
      ...prev,
      [rosterId]: { ...prev[rosterId], status }
    }));
  };

  // Pagination calculations
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = billingData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(billingData.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div className="billing-analysis">
      <h2>Billing Analysis</h2>

      {/* Search Form */}
      <div className="search-form">
        <div className="horizontal-form-grid">
          <div className="form-field">
            <label>Search Query (Name)</label>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Enter name"
            />
          </div>

          <div className="form-field">
            <label>ID</label>
            <input
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="Enter ID"
            />
          </div>

          <div className="form-field">
            <label>Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="form-field dropdown-field" style={{ position: 'relative' }}>
            <label>Team Name</label>
            <input
              type="text"
              value={teamname}
              onChange={(e) => {
                setTeamname(e.target.value);
                if (!e.target.value) {
                  setShowTeamDropdown(false);
                }
              }}
              onFocus={() => {
                fetchTeams();
                setShowTeamDropdown(true);
              }}
              onBlur={() => {
                // Delay to allow click on dropdown item
                setTimeout(() => setShowTeamDropdown(false), 200);
              }}
              placeholder="Enter or select team"
            />
            {showTeamDropdown && availableTeams.length > 0 && (
              <div className="dropdown-menu">
                {availableTeams.map((team, idx) => (
                  <div
                    key={idx}
                    className="dropdown-item"
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevent blur
                      setTeamname(team);
                      setShowTeamDropdown(false);
                    }}
                  >
                    {team}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-field dropdown-field" style={{ position: 'relative' }}>
            <label>Shift</label>
            <input
              type="text"
              value={shift}
              onChange={(e) => {
                setShift(e.target.value);
                if (!e.target.value) {
                  setShowShiftDropdown(false);
                }
              }}
              onFocus={() => {
                fetchShifts();
                setShowShiftDropdown(true);
              }}
              onBlur={() => {
                // Delay to allow click on dropdown item
                setTimeout(() => setShowShiftDropdown(false), 200);
              }}
              placeholder="Enter or select shift"
            />
            {showShiftDropdown && availableShifts.length > 0 && (
              <div className="dropdown-menu">
                {availableShifts.map((shiftItem, idx) => (
                  <div
                    key={idx}
                    className="dropdown-item"
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevent blur
                      setShift(shiftItem);
                      setShowShiftDropdown(false);
                    }}
                  >
                    {shiftItem}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-field">
            <label>Action</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
            >
              <option value="">None</option>
              <option value="count">Count</option>
              <option value="low_hours">Low Hours</option>
            </select>
          </div>

          <div className="form-field">
            <button
              type="button"
              className="search-btn"
              disabled={isLoading}
              onClick={handleSearch}
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {/* Months selector */}
        {availableMonths.length > 0 && (
          <div className="months-selector">
            <label>Available Months:</label>
            <div className="months-buttons">
              {availableMonths.map((month, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="month-btn"
                  onClick={() => {
                    // Parse month and set start/end dates
                    const [year, monthNum] = month.split('-');
                    const startOfMonth = `${year}-${monthNum}-01`;
                    const endOfMonth = new Date(year, monthNum, 0).getDate();
                    const endOfMonthStr = `${year}-${monthNum}-${String(endOfMonth).padStart(2, '0')}`;
                    setStartDate(startOfMonth);
                    setEndDate(endOfMonthStr);
                  }}
                >
                  {month}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && <div className="error">Error: {error}</div>}

      {/* Results */}
      {billingData.length > 0 && (
        <div className="results-area">
          <div className="table-controls">
            <div className="table-info">
              Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, billingData.length)} of {billingData.length} results
            </div>
            <div className="pagination-controls">
              <label>
                Rows per page:
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </label>
              <button
                onClick={() => paginate(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span>Page {currentPage} of {totalPages}</span>
              <button
                onClick={() => paginate(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          </div>

          <div className="results-table">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Team</th>
                  <th>Date</th>
                  <th>Schedule</th>
                  <th>First In</th>
                  <th>Last Out</th>
                  <th>Net Office Time</th>
                  <th>Status</th>
                  <th>Comment</th>
                  <th>Attendance Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((item) => {
                  const rosterId = item.id || item.roster_id;
                  const annotation = annotations[rosterId] || { comment: item.comment || '', status: 'True' };
                  const isSubmitting = submittingAnnotations[rosterId];
                  const attendance = item.attendance || {};

                  return (
                    <tr key={rosterId}>
                      <td>{rosterId}</td>
                      <td>{item.name || item.employee_name || '-'}</td>
                      <td>{item.team || item.teamname || '-'}</td>
                      <td>{item.date || '-'}</td>
                      <td>{item.schedule || '-'}</td>
                      <td>{attendance.first_in || '-'}</td>
                      <td>{attendance.last_out || '-'}</td>
                      <td>{attendance.net_office_time || '-'}</td>
                      <td>{attendance.status || '-'}</td>
                      <td>
                        <input
                          type="text"
                          className="form-input"
                          value={annotation.comment}
                          onChange={(e) => updateAnnotationComment(rosterId, e.target.value)}
                          placeholder="Enter comment"
                          style={{ width: '200px' }}
                        />
                      </td>
                      <td>
                        <select
                          className="form-select"
                          value={annotation.status}
                          onChange={(e) => updateAnnotationStatus(rosterId, e.target.value)}
                          style={{ width: '120px' }}
                        >
                          <option value="True">✓ Present</option>
                          <option value="False">✗ Absent</option>
                        </select>
                      </td>
                      <td>
                        <button
                          className="search-btn"
                          onClick={() => handleAnnotationSubmit(rosterId)}
                          disabled={isSubmitting || !annotation.comment.trim()}
                          style={{ padding: '6px 12px', fontSize: '0.9rem' }}
                        >
                          {isSubmitting ? 'Submitting...' : 'Submit'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No Results */}
      {!isLoading && billingData.length === 0 && !error && (
        <div className="no-results">
          No results found. Try adjusting your search criteria.
        </div>
      )}
    </div>
  );
};

export default BillingAnalysis;
