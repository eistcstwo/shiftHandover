import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { getKDB, createKDB, updateKDB } from '../../Api/HandOverApi';
import * as XLSX from 'xlsx';
import './KnowledgeBase.css';

// ── Create / Edit Modal ────────────────────────────────────────────────────
const EntryModal = ({ onClose, onSuccess, editEntry = null }) => {
  const isEdit = !!editEntry;

  const [form, setForm] = useState({
    applicaion: editEntry?.applicaion || editEntry?.application || '',
    description: editEntry?.description || '',
    dateOfOccurence: editEntry?.dateOfOccurence || editEntry?.dateOfOccurrence || '',
    resolution: editEntry?.resolution || '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.applicaion.trim()) { setError('Application name is required.'); return; }
    if (!form.description.trim()) { setError('Description is required.'); return; }
    if (!form.dateOfOccurence) { setError('Date of occurrence is required.'); return; }
    if (!form.resolution.trim()) { setError('Resolution is required.'); return; }

    setSubmitting(true);
    setError('');
    try {
      if (isEdit) {
        const kId = editEntry.kId || editEntry.id || editEntry.kdb_id || editEntry.kdbId;
        await updateKDB({ ...form, kId });
      } else {
        await createKDB(form);
      }
      onSuccess();
    } catch (err) {
      setError(err.message || `Failed to ${isEdit ? 'update' : 'create'} entry. Please try again.`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="kdb-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="kdb-modal">
        <div className="kdb-modal-header">
          <h2 className="kdb-modal-title">
            {isEdit ? '✏️ Edit Knowledge Entry' : '📝 New Knowledge Entry'}
          </h2>
          <p className="kdb-modal-subtitle">
            {isEdit
              ? 'Update the issue description or resolution'
              : 'Document an issue and its resolution for the team'}
          </p>
        </div>

        <div className="kdb-modal-body">
          {error && (
            <div className="kdb-error">
              <span>⚠️</span> {error}
            </div>
          )}

          <form id="kdb-entry-form" onSubmit={handleSubmit} className="kdb-form">
            <div className="kdb-form-row">
              <div className="kdb-form-group">
                <label>
                  Application <span className="required">*</span>
                </label>
                <input
                  type="text"
                  name="applicaion"
                  value={form.applicaion}
                  onChange={handleChange}
                  placeholder="e.g. IIB, MQ, Linux, Oracle"
                  className="kdb-form-input"
                  required
                />
                <span className="kdb-form-hint">System or application affected</span>
              </div>

              <div className="kdb-form-group">
                <label>
                  Date of Occurrence <span className="required">*</span>
                </label>
                <input
                  type="date"
                  name="dateOfOccurence"
                  value={form.dateOfOccurence}
                  onChange={handleChange}
                  className="kdb-form-input"
                  required
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            <div className="kdb-form-group">
              <label>
                Issue Description <span className="required">*</span>
              </label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Describe the issue in detail — symptoms, error messages, affected services..."
                className="kdb-form-textarea"
                required
                rows={5}
              />
            </div>

            <div className="kdb-form-group">
              <label>
                Resolution <span className="required">*</span>
              </label>
              <textarea
                name="resolution"
                value={form.resolution}
                onChange={handleChange}
                placeholder="Explain the steps taken to resolve the issue — commands run, configurations changed, workarounds applied..."
                className="kdb-form-textarea"
                required
                rows={5}
              />
            </div>
          </form>
        </div>

        <div className="kdb-modal-footer">
          <button type="button" onClick={onClose} className="btn-kdb-secondary" disabled={submitting}>
            Cancel
          </button>
          <button
            type="submit"
            form="kdb-entry-form"
            className="btn-kdb-primary"
            disabled={submitting}
          >
            {submitting
              ? '⏳ Saving...'
              : isEdit
              ? '✅ Update Entry'
              : '✅ Save Entry'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Entry Card ─────────────────────────────────────────────────────────────
const EntryCard = ({ entry, onEdit }) => {
  const [expanded, setExpanded] = useState(false);

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return format(new Date(dateStr), 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className={`kdb-entry-card ${expanded ? 'expanded' : ''}`}>
      <div className="kdb-entry-header">
        <div className="kdb-entry-title-group">
          <div className="kdb-entry-app">
            🖥️ {entry.applicaion || entry.application || 'Unknown App'}
          </div>
          <p className={`kdb-entry-description-preview ${expanded ? 'expanded-text' : ''}`}>
            {entry.description || 'No description provided'}
          </p>
        </div>

        <div className="kdb-entry-meta">
          <span className="kdb-entry-date">
            📅 {formatDate(entry.dateOfOccurence || entry.dateOfOccurrence)}
          </span>
          <div className="kdb-entry-actions">
            <button
              className="kdb-edit-btn"
              onClick={(e) => { e.stopPropagation(); onEdit(entry); }}
              aria-label="Edit entry"
              title="Edit this entry"
            >
              ✏️ Edit
            </button>
            <button
              className="kdb-expand-btn"
              onClick={() => setExpanded((p) => !p)}
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? '▲ Collapse' : '▼ Details'}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="kdb-entry-expanded">
          <div className="kdb-detail-grid">
            <div className="kdb-detail-block">
              <span className="kdb-detail-label">Application</span>
              <span className="kdb-detail-value">
                {entry.applicaion || entry.application || '—'}
              </span>
            </div>

            <div className="kdb-detail-block">
              <span className="kdb-detail-label">Date of Occurrence</span>
              <span className="kdb-detail-value">
                {formatDate(entry.dateOfOccurence || entry.dateOfOccurrence)}
              </span>
            </div>

            <div className="kdb-detail-block full-width">
              <span className="kdb-detail-label">Issue Description</span>
              <span className="kdb-detail-value">
                {entry.description || '—'}
              </span>
            </div>

            <div className="kdb-detail-block full-width resolution-block">
              <span className="kdb-detail-label">✅ Resolution</span>
              <span className="kdb-detail-value">
                {entry.resolution || '—'}
              </span>
            </div>

            {entry.userCreated_id && (
              <div className="kdb-detail-block">
                <span className="kdb-detail-label">Logged By</span>
                <span className="kdb-detail-value">User ID: {entry.userCreated_id}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────
const KnowledgeBase = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editEntry, setEditEntry] = useState(null); // entry being edited
  const [downloading, setDownloading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [appFilter, setAppFilter] = useState('all');

  // ── Fetch entries ────────────────────────────────────────────────────────
  const fetchEntries = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getKDB();
      console.log('KDB data:', data);

      let list = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data && Array.isArray(data.data)) {
        list = data.data;
      } else if (data && Array.isArray(data.entries)) {
        list = data.entries;
      } else if (data && Array.isArray(data.kdbEntries)) {
        list = data.kdbEntries;
      } else if (data && typeof data === 'object') {
        const arrayKey = Object.keys(data).find((k) => Array.isArray(data[k]));
        if (arrayKey) list = data[arrayKey];
      }

      setEntries(list);
    } catch (err) {
      console.error('fetchKDB error:', err);
      setError(err.message || 'Failed to fetch knowledge base entries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  // ── Derived data ─────────────────────────────────────────────────────────
  const uniqueApps = useMemo(() => {
    const apps = new Set(
      entries.map((e) => e.applicaion || e.application).filter(Boolean)
    );
    return [...apps].sort();
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const app = (entry.applicaion || entry.application || '').toLowerCase();
      const desc = (entry.description || '').toLowerCase();
      const res = (entry.resolution || '').toLowerCase();
      const term = search.toLowerCase();

      const matchSearch =
        !term || app.includes(term) || desc.includes(term) || res.includes(term);

      const matchApp =
        appFilter === 'all' || app === appFilter.toLowerCase();

      return matchSearch && matchApp;
    });
  }, [entries, search, appFilter]);

  // Recent: entries added in the last 7 days
  const recentCount = useMemo(() => {
    const week = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return entries.filter((e) => {
      const d = new Date(e.dateOfOccurence || e.dateOfOccurrence || 0);
      return d.getTime() >= week;
    }).length;
  }, [entries]);

  // ── Excel Download Function ──────────────────────────────────────────────
  const downloadExcel = async () => {
    if (filteredEntries.length === 0) {
      setError('No entries to download.');
      setTimeout(() => setError(''), 3000);
      return;
    }

    setDownloading(true);
    try {
      // Prepare data for Excel
      const excelData = filteredEntries.map((entry, index) => ({
        'S.No': index + 1,
        'Application': entry.applicaion || entry.application || 'N/A',
        'Date of Occurrence': entry.dateOfOccurence || entry.dateOfOccurrence || 'N/A',
        'Issue Description': entry.description || 'N/A',
        'Resolution': entry.resolution || 'N/A',
        'Logged By (User ID)': entry.userCreated_id || 'N/A',
        'Entry ID': entry.id || entry.kdbId || entry.kdb_id || entry.kId || 'N/A'
      }));

      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      const colWidths = [
        { wch: 5 },  // S.No
        { wch: 20 }, // Application
        { wch: 15 }, // Date
        { wch: 50 }, // Description
        { wch: 50 }, // Resolution
        { wch: 15 }, // Logged By
        { wch: 15 }  // Entry ID
      ];
      ws['!cols'] = colWidths;

      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Knowledge Base');

      // Generate filename with current date
      const date = format(new Date(), 'yyyy-MM-dd');
      const filename = `knowledge-base_${date}.xlsx`;

      // Download file
      XLSX.writeFile(wb, filename);

      setSuccess(`✅ Excel file downloaded successfully! (${filteredEntries.length} entries)`);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      console.error('Excel download error:', err);
      setError('Failed to generate Excel file. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  // ── Download All Entries (without filters) ───────────────────────────────
  const downloadAllEntries = async () => {
    if (entries.length === 0) {
      setError('No entries to download.');
      setTimeout(() => setError(''), 3000);
      return;
    }

    setDownloading(true);
    try {
      const excelData = entries.map((entry, index) => ({
        'S.No': index + 1,
        'Application': entry.applicaion || entry.application || 'N/A',
        'Date of Occurrence': entry.dateOfOccurence || entry.dateOfOccurrence || 'N/A',
        'Issue Description': entry.description || 'N/A',
        'Resolution': entry.resolution || 'N/A',
        'Logged By (User ID)': entry.userCreated_id || 'N/A',
        'Entry ID': entry.id || entry.kdbId || entry.kdb_id || entry.kId || 'N/A'
      }));

      const ws = XLSX.utils.json_to_sheet(excelData);
      ws['!cols'] = [
        { wch: 5 },  // S.No
        { wch: 20 }, // Application
        { wch: 15 }, // Date
        { wch: 50 }, // Description
        { wch: 50 }, // Resolution
        { wch: 15 }, // Logged By
        { wch: 15 }  // Entry ID
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Knowledge Base');

      const date = format(new Date(), 'yyyy-MM-dd');
      const filename = `knowledge-base_all_${date}.xlsx`;

      XLSX.writeFile(wb, filename);

      setSuccess(`✅ All entries downloaded successfully! (${entries.length} entries)`);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      console.error('Excel download error:', err);
      setError('Failed to generate Excel file. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  // ── Handle modal success ─────────────────────────────────────────────────
  const handleModalSuccess = (isEdit) => {
    setShowCreateModal(false);
    setEditEntry(null);
    setSuccess(isEdit ? '✅ Entry updated successfully!' : '✅ Knowledge entry saved successfully!');
    fetchEntries();
    setTimeout(() => setSuccess(''), 4000);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="kdb-page">
      {/* Header */}
      <div className="kdb-header">
        <div className="kdb-header-content">
          <h1>📚 Knowledge Database</h1>
          <p>EIS Department — Issue registry &amp; resolution reference</p>
        </div>
        <div className="kdb-header-actions">
          <button
            className="btn-kdb-refresh"
            onClick={fetchEntries}
            disabled={loading}
          >
            {loading ? '⏳ Loading...' : '🔄 Refresh'}
          </button>
          
          {/* Excel Download Dropdown */}
          <div className="kdb-download-dropdown">
            <button
              className="btn-kdb-download"
              disabled={downloading || entries.length === 0}
            >
              {downloading ? '⏳ Downloading...' : '📥 Download Excel'}
            </button>
            <div className="kdb-download-dropdown-content">
              <button 
                onClick={downloadExcel}
                disabled={downloading || filteredEntries.length === 0}
              >
                📊 Download Current View ({filteredEntries.length})
              </button>
              <button 
                onClick={downloadAllEntries}
                disabled={downloading || entries.length === 0}
              >
                📋 Download All Entries ({entries.length})
              </button>
            </div>
          </div>

          <button
            className="btn-kdb-primary"
            onClick={() => setShowCreateModal(true)}
          >
            ＋ Add Entry
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="kdb-stats">
        <div className="kdb-stat-card total">
          <span className="kdb-stat-label">Total Issues</span>
          <span className="kdb-stat-value">{entries.length}</span>
        </div>
        <div className="kdb-stat-card apps">
          <span className="kdb-stat-label">Applications</span>
          <span className="kdb-stat-value">{uniqueApps.length}</span>
        </div>
        <div className="kdb-stat-card recent">
          <span className="kdb-stat-label">Last 7 Days</span>
          <span className="kdb-stat-value">{recentCount}</span>
        </div>
      </div>

      {/* Alerts */}
      {success && (
        <div className="kdb-success">
          <span>✅</span> {success}
        </div>
      )}
      {error && (
        <div className="kdb-error">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* Search & Filter */}
      <div className="kdb-controls">
        <div className="kdb-search-group">
          <label>Search</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by application, issue, or resolution..."
            className="kdb-search-input"
          />
        </div>
        <div className="kdb-filter-group">
          <label>Application</label>
          <select
            value={appFilter}
            onChange={(e) => setAppFilter(e.target.value)}
            className="kdb-filter-select"
          >
            <option value="all">All Applications</option>
            {uniqueApps.map((app) => (
              <option key={app} value={app}>
                {app}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Entries */}
      <div className="kdb-content">
        {loading ? (
          <div className="kdb-loading">
            <div className="kdb-loading-spinner"></div>
            <p>Loading knowledge base...</p>
          </div>
        ) : (
          <div className="kdb-entries-section">
            <h2 className="kdb-section-title">
              📋 Issues &amp; Resolutions ({filteredEntries.length})
            </h2>

            {filteredEntries.length > 0 ? (
              filteredEntries.map((entry, idx) => (
                <EntryCard
                  key={entry.id || entry.kdbId || entry.kdb_id || entry.kId || idx}
                  entry={entry}
                  onEdit={(e) => setEditEntry(e)}
                />
              ))
            ) : (
              <div className="kdb-no-data">
                <p>
                  {entries.length === 0
                    ? '📭 No entries yet. Add the first knowledge base entry!'
                    : '🔍 No entries match your search or filter criteria.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <EntryModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => handleModalSuccess(false)}
        />
      )}

      {/* Edit Modal */}
      {editEntry && (
        <EntryModal
          editEntry={editEntry}
          onClose={() => setEditEntry(null)}
          onSuccess={() => handleModalSuccess(true)}
        />
      )}
    </div>
  );
};

export default KnowledgeBase;
