curl -kX POST https://10.191.171.12:5443/EISHOME_TEST/projectRoster/update_annotation/  -H "Content-Type: application/json"  -d '{"roster_id": 45429, "comment": "OK", "status": "True"}'

import React, { useState, useMemo, useEffect } from 'react';
import './BillingAnalysis.css';

const API_BASE = 'https://10.191.171.12:5443/EISHOME_TEST/projectRoster/search/';

const BillingAnalysis = () => {
  // Search / filters
  const [q, setQ] = useState('');
  const [id, setId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [teamname, setTeamname] = useState('');
  const [shift, setShift] = useState('');
  const [action, setAction] = useState(''); // '', 'count', 'low_hours'

  // data + UI state
  const [billingData, setBillingData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // New state for fetched dates and months
  const [validDates, setValidDates] = useState([]);
  const [availableMonths, setAvailableMonths] = useState([]);

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // upload modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [rosterFile, setRosterFile] = useState(null);
  const [attendance1File, setAttendance1File] = useState(null);
  const [attendance2File, setAttendance2File] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Fetch valid dates when q (name) changes
  useEffect(() => {
    if (!q) {
      setValidDates([]);
      setAvailableMonths([]);
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch valid dates
        const datesResponse = await fetch(
          `${API_BASE}?q=${encodeURIComponent(q)}&action=get_valid_dates`,
          {
            method: 'GET',
          }
        );

        if (datesResponse.ok) {
          const datesData = await datesResponse.json();
          setValidDates(Array.isArray(datesData) ? datesData : []);
        }

        // Fetch available months
        const monthsResponse = await fetch(
          `${API_BASE}?q=${encodeURIComponent(q)}&action=get_months`,
          {
            method: 'GET',
          }
        );

        if (monthsResponse.ok) {
          const monthsData = await monthsResponse.json();
          setAvailableMonths(Array.isArray(monthsData) ? monthsData : []);
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setValidDates([]);
        setAvailableMonths([]);
      }
    };

    const debounceTimer = setTimeout(() => {
      fetchData();
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [q]);

  // Function to check if a date is in the validDates array
  const isDateValid = (dateString) => {
    return validDates.includes(dateString);
  };

  // Helper to get min and max dates from validDates
  const getDateRange = () => {
    if (validDates.length === 0) return { min: '', max: '' };

    const dates = validDates.map(date => new Date(date));
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));

    return {
      min: minDate.toISOString().split('T')[0],
      max: maxDate.toISOString().split('T')[0]
    };
  };

  // Custom date input handler that validates against validDates
  const handleStartDateChange = (e) => {
    const selectedDate = e.target.value;
    if (!selectedDate || isDateValid(selectedDate)) {
      setStartDate(selectedDate);
    } else {
      alert(`Date ${selectedDate} is not available. Please select from valid dates: ${validDates.slice(0, 5).join(', ')}${validDates.length > 5 ? '...' : ''}`);
      e.target.value = startDate; // Reset to previous value
    }
  };

  const handleEndDateChange = (e) => {
    const selectedDate = e.target.value;
    if (!selectedDate || isDateValid(selectedDate)) {
      setEndDate(selectedDate);
    } else {
      alert(`Date ${selectedDate} is not available. Please select from valid dates: ${validDates.slice(0, 5).join(', ')}${validDates.length > 5 ? '...' : ''}`);
      e.target.value = endDate; // Reset to previous value
    }
  };

  // Helper to build query string
  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (q) params.append('q', q);
    if (id) params.append('id', id);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (teamname) params.append('teamname', teamname);
    if (shift) params.append('shift', shift);
    if (action) params.append('action', action);
    return params.toString();
  };

  // Flatten attendance nested object into top-level keys with attendance_ prefix.
  const flattenItem = (item) => {
    const flat = { ...item };
    if (item.attendance && typeof item.attendance === 'object') {
      Object.keys(item.attendance).forEach((k) => {
        const key = `attendance_${k}`;
        flat[key] = item.attendance[k];
      });
      delete flat.attendance;
    }
    return flat;
  };

  // Convert received raw data into flat objects and derive columns
  const flattenedData = useMemo(() => {
    if (!billingData || billingData.length === 0) return [];
    return billingData.map(flattenItem);
  }, [billingData]);

  const columns = useMemo(() => {
    const set = new Set();
    flattenedData.forEach((row) => {
      Object.keys(row).forEach((k) => set.add(k));
    });
    const preferred = [
      'date',
      'name',
      'id',
      'team',
      'teamname',
      'schedule',
      'department',
      'attendance_first_in',
      'attendance_last_out',
      'attendance_gross_time',
      'attendance_net_office_time',
      'attendance_out_of_office_time',
      'attendance_out_of_office_count',
    ];
    const ordered = preferred.filter((p) => set.has(p));
    const remaining = Array.from(set).filter((c) => !ordered.includes(c));
    return [...ordered, ...remaining];
  }, [flattenedData]);

  // pagination slicing
  const totalRows = flattenedData.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const pagedData = flattenedData.slice((page - 1) * pageSize, page * pageSize);

  // Search handler -> hits API
  const handleSearch = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setIsLoading(true);
    setError(null);
    setPage(1);

    try {
      const qs = buildQueryString();
      const url = qs ? `${API_BASE}?${qs}` : API_BASE;
      const resp = await fetch(url, {
        method: 'GET',
      });

      if (!resp.ok) {
        let msg = `${resp.status} ${resp.statusText}`;
        try {
          const errJson = await resp.json();
          msg = errJson.message || JSON.stringify(errJson);
        } catch (err) {
          // ignore
        }
        throw new Error(`Server error: ${msg}`);
      }

      const json = await resp.json();

      if (Array.isArray(json)) {
        setBillingData(json);
      } else if (Array.isArray(json.results)) {
        setBillingData(json.results);
      } else if (json.data && Array.isArray(json.data)) {
        setBillingData(json.data);
      } else if (typeof json === 'object' && json !== null) {
        const firstArray = Object.values(json).find(Array.isArray);
        if (firstArray) {
          setBillingData(firstArray);
        } else {
          setBillingData([json]);
        }
      } else {
        setBillingData([]);
      }
    } catch (err) {
      console.error('Search failed', err);
      setError(err.message || 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  // helpers
  const isEmpty = (v) => v === null || v === undefined || v === '';
  const isPlainObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

  const LABEL_ORDER = [
    'Total working days',
    'Total WFO',
    'Total WFH',
    'Total WO',
    'Total PL',
    'Total Leaves',
  ];

  const LABELS = {
    'Total working days': 'Working Days',
    'Total WFO': 'Work from Office',
    'Total WFH': 'Work from Home',
    'Total WO': 'Week Off',
    'Total PL': 'Planned Leave',
    'Total Leaves': 'Leaves',
  };

  const renderObjectKV = (obj) => {
    if (!obj || Object.keys(obj).length === 0) return '-';

    const keys = LABEL_ORDER.every(k => k in obj) ? LABEL_ORDER : Object.keys(obj);

    return (
      <dl className="kv">
        {keys.map((k) => (
          <div className="kv-row" key={k}>
            <dt className="kv-key">{LABELS[k] ?? k}</dt>
          </div>
        ))}
      </dl>
    );
  };

  const formatCell = (value) => {
    if (isEmpty(value)) return '-';
    if (Array.isArray(value)) return value.join(', ');
    if (isPlainObject(value)) return renderObjectKV(value);
    return String(value);
  };

  // Upload handling for three files
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!rosterFile && !attendance1File && !attendance2File) {
      alert('Please select at least one file to upload (roster and/or attendance sheets).');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      if (rosterFile) formData.append('roster', rosterFile);
      if (attendance1File) formData.append('attendance_sheet_1', attendance1File);
      if (attendance2File) formData.append('attendance_sheet_2', attendance2File);

      const uploadUrl = 'https://10.191.171.12:5443/EISHOME_TEST/projectRoster/upload/';
      const resp = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(errText || `${resp.status} ${resp.statusText}`);
      }

      const result = await resp.json().catch(() => null);
      alert('Files uploaded successfully.');
      setShowUploadModal(false);
      setRosterFile(null);
      setAttendance1File(null);
      setAttendance2File(null);
    } catch (err) {
      console.error('Upload failed', err);
      alert(`Upload failed: ${err.message || err}`);
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Function to convert month string to date range
  const monthToDateRange = (monthStr) => {
    const [month, year] = monthStr.split(' ');
    const monthIndex = new Date(`${month} 1, ${year}`).getMonth();
    const firstDay = new Date(year, monthIndex, 1);
    const lastDay = new Date(year, monthIndex + 1, 0);

    return {
      first: firstDay.toISOString().split('T')[0],
      last: lastDay.toISOString().split('T')[0]
    };
  };

  // Handle month selection
  const handleMonthSelect = (monthStr) => {
    const range = monthToDateRange(monthStr);

    // Find valid dates within this month range
    const monthValidDates = validDates.filter(date => {
      return date >= range.first && date <= range.last;
    });

    if (monthValidDates.length > 0) {
      // Set the min and max dates from available valid dates in this month
      const dates = monthValidDates.map(date => new Date(date));
      const minDate = new Date(Math.min(...dates)).toISOString().split('T')[0];
      const maxDate = new Date(Math.max(...dates)).toISOString().split('T')[0];

      setStartDate(minDate);
      setEndDate(maxDate);
    } else {
      alert(`No valid dates available for ${monthStr}`);
    }
  };

  const dateRange = getDateRange();

  return (
    <div className="billing-analysis">
      <div className="header-section">
        <h2>Billing Analysis</h2>
        <button
          type="button"
          onClick={() => setShowUploadModal(true)}
          className="upload-btn"
        >
          📁 Upload Roster & Attendance
        </button>
      </div>

      {/* Search / filter form */}
      <form onSubmit={handleSearch} className="search-form">
        <div className="horizontal-form-grid">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="🔍 Name"
            className="form-input"
          />
          <input
            type="text"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="👤 ID"
            className="form-input"
          />

          {/* Date inputs with validation */}
          <div className="date-input-group">
            <input
              type="date"
              value={startDate}
              onChange={handleStartDateChange}
              className="form-input"
              title="Start Date"
              min={dateRange.min}
              max={dateRange.max}
              list="validDatesList"
            />
            <datalist id="validDatesList">
              {validDates.map(date => (
                <option key={date} value={date} />
              ))}
            </datalist>
          </div>

          <div className="date-input-group">
            <input
              type="date"
              value={endDate}
              onChange={handleEndDateChange}
              className="form-input"
              title="End Date"
              min={dateRange.min}
              max={dateRange.max}
              list="validDatesList"
            />
          </div>

          <input
            type="text"
            value={teamname}
            onChange={(e) => setTeamname(e.target.value)}
            placeholder="👥 Team"
            className="form-input"
          />
          <input
            type="text"
            value={shift}
            onChange={(e) => setShift(e.target.value)}
            placeholder="🕒 Shift"
            className="form-input"
          />

          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="form-select"
          >
            <option value="">📊 All Actions</option>
            <option value="count">Count Working Days</option>
            <option value="low_hours">Low Hours Check</option>
          </select>

          <button type="submit" disabled={isLoading} className="search-btn">
            {isLoading ? '⏳ Searching...' : '🚀 Search'}
          </button>
        </div>

        {/* Available months selector */}
        {availableMonths.length > 0 && q && (
          <div className="months-selector">
            <label>Available Months for {q}:</label>
            <div className="months-buttons">
              {availableMonths.map(month => (
                <button
                  key={month}
                  type="button"
                  onClick={() => handleMonthSelect(month)}
                  className="month-btn"
                >
                  {month}
                </button>
              ))}
            </div>
          </div>
        )}

         {/* Valid dates info
        {validDates.length > 0 && q && (
          <div className="dates-info">
            <small>
              {validDates.length} valid dates available for {q}.
              {validDates.length > 5 ? ` First 5: ${validDates.slice(0, 5).join(', ')}...` : ` ${validDates.join(', ')}`}
            </small>
          </div>
        )}
        */}
      </form>

      {error && <div className="error">Error: {error}</div>}

      {/* Dynamic results table */}
      <div className="results-area">
        {flattenedData.length === 0 ? (
          <div className="no-results">No results to display.</div>
        ) : (
          <>
            <div className="table-controls">
              <div className="table-info">
                Rows: {totalRows} &nbsp;|&nbsp; Page {page} of {totalPages}
              </div>
              <div className="pagination-controls">
                <label>
                  Page size:
                  <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={totalRows}>All</option>
                  </select>
                </label>

                <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  ← Prev
                </button>
                <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  Next →
                </button>
              </div>
            </div>

            <div className="results-table">
              <table>
                <thead>
                  <tr>
                    {columns.map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedData.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {columns.map((col) => (
                        <td key={col}>
                          {formatCell(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Upload modal */}
      {showUploadModal && (
        <div className="upload-modal">
          <div className="upload-modal-content">
            <h3>Upload Roster & Attendance Sheets</h3>
            <form onSubmit={handleUploadSubmit}>
              <div className="upload-fields">
                <label>
                  Roster file (required for roster uploads):
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => setRosterFile(e.target.files && e.target.files[0])}
                  />
                  {rosterFile && <div className="file-name">{rosterFile.name}</div>}
                </label>

                <label>
                  Attendance sheet 1:
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => setAttendance1File(e.target.files && e.target.files[0])}
                  />
                  {attendance1File && <div className="file-name">{attendance1File.name}</div>}
                </label>

                <label>
                  Attendance sheet 2:
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => setAttendance2File(e.target.files && e.target.files[0])}
                  />
                  {attendance2File && <div className="file-name">{attendance2File.name}</div>}
                </label>
              </div>

              <div className="upload-actions">
                <button type="button" onClick={() => setShowUploadModal(false)} disabled={uploading}>
                  Cancel
                </button>
                <button type="submit" disabled={uploading}>
                  {uploading ? 'Uploading...' : 'Upload Files'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingAnalysis;
