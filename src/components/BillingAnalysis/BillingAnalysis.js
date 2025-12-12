BillingAnalysis.js
-rw-r----- 1 root root 13937 Oct 23 16:28 BillingAnalysis.js_231025
-rw-r----- 1 root root 14038 Dec 11 15:33 newBillingAnalysis.js
[root@eispr-prt1-01 BillingAnalysis]# cat BillingAnalysis.js
import React, { useState, useMemo } from 'react';
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

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // upload modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [rosterFile, setRosterFile] = useState(null);
  const [attendance1File, setAttendance1File] = useState(null);
  const [attendance2File, setAttendance2File] = useState(null);
  const [uploading, setUploading] = useState(false);

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
      // remove original attendance object to avoid nested object rendering
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
    // Ensure some predictable order: common columns first if present
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
      // If you have trouble with TLS in browser, use a dev proxy endpoint on your server instead of API_BASE.
      const url = qs ? `${API_BASE}?${qs}` : API_BASE;
      // Example fetch. The backend must return JSON array of objects or an object with a list (adjust accordingly).
      const resp = await fetch(url, {
        method: 'GET',
        // include credentials or headers if required:
        // credentials: 'include',
        // headers: { 'Authorization': 'Bearer ...' },
      });

      if (!resp.ok) {
        // Try to extract JSON error message
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

      // The API may return different shapes:
      // - an array of items -> use it directly
      // - { results: [...], count: N } -> use results
      // - { data: [...] } -> use data
      // - else: try to find first array in payload, or show the object as a single-row summary
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
          // show the object as a single-row summary (useful for action=count etc)
          setBillingData([json]);
        }
      } else {
        // unexpected shape: set empty
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


// Optional: display order & labels for known object columns like "counts"
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

  // if it's the known "counts" shape, order keys nicely; otherwise, natural order
  const keys = LABEL_ORDER.every(k => k in obj) ? LABEL_ORDER : Object.keys(obj);

  return (
    <dl className="kv">
      {keys.map((k) => (
        <div className="kv-row" key={k}>
          <dt className="kv-key">{LABELS[k] ?? k}</dt>
          <dd className="kv-val">{String(obj[k])}</dd>
        </div>
      ))}
    </dl>
  );
};

const formatCell = (value) => {
  if (isEmpty(value)) return '-';
  if (Array.isArray(value)) return value.join(', ');
  if (isPlainObject(value)) return renderObjectKV(value);
  return String(value)

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

      // TODO: replace with your real upload endpoint and add any auth headers required.
      const uploadUrl = 'https://10.191.171.12:5443/EISHOME_TEST/projectRoster/upload/'; // <-- change me
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
      // Optionally refresh data or close modal
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
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="form-input"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="form-input"
          />
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
                       /* <td key={col}>
                          {/* show '-' for null/undefined }*/
                        /*  {row[col] === null || row[col] === undefined || row[col] === '' ? '-' : String(row[col])}
                        </td>*/


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
