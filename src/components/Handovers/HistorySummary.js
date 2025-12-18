import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { getHistoryHandovers } from '../../Api/HandOverApi';
import './HistorySummary.css';

// Acknowledge Timeline Component with Horizontal Scroll
const AcknowledgeTimeline = ({ acknowledgeDetails }) => {
  const timelineScrollRef = useRef(null);

  if (!acknowledgeDetails || acknowledgeDetails.length === 0) {
    return (
      <div className="timeline-container">
        <div className="no-timeline-data">
          <p>No acknowledgment history available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="timeline-container">
      <h4 className="timeline-title">📅 Acknowledgment History</h4>
      <div
        ref={timelineScrollRef}
        className="timeline-scroll-wrapper"
      >
        <div className="timeline-horizontal">
          {acknowledgeDetails.map((ack, index) => (
            <div key={ack.ackId || index} className="timeline-item">
              <div className="timeline-marker">
                <div className="timeline-dot"></div>
                {index < acknowledgeDetails.length - 1 && (
                  <div className="timeline-connector"></div>
                )}
              </div>
              <div className="timeline-content">
                <div className="timeline-header">
                  <span className="timeline-time">
                    {format(new Date(ack.acknowledgeTime), 'MMM d, yyyy h:mm a')}
                  </span>
                  <span className="timeline-user">
                    👤 User ID: {ack.userAcknowleged_id}
                  </span>
                </div>
                <div className="timeline-description">
                  {ack.ackDesc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// History Tasks Table Component with Expandable Rows
const HistoryTasksTable = ({ tasks }) => {
  const [expandedRows, setExpandedRows] = useState({});

  const toggleRow = (taskId) => {
    setExpandedRows(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  if (!tasks || tasks.length === 0) {
    return (
      <div className="no-tasks-message">
        <p>📭 No tasks found in history</p>
      </div>
    );
  }

  return (
    <div className="history-tasks-table-container">
      <table className="history-tasks-table">
        <thead>
          <tr>
            <th style={{ width: '50px' }}>📌</th>
            <th>Task ID</th>
            <th>Description</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Acknowledgments</th>
            <th>Latest Update</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <React.Fragment key={task.taskId}>
              <tr className="task-row">
                <td>
                  {task.ackCount > 0 && (
                    <button
                      className="expand-button"
                      onClick={() => toggleRow(task.taskId)}
                      aria-label={expandedRows[task.taskId] ? 'Collapse' : 'Expand'}
                      title="Click to view acknowledgment details"
                    >
                      {expandedRows[task.taskId] ? '▼' : '▶'}
                    </button>
                  )}
                </td>
                <td className="task-id-cell">#{task.taskId}</td>
                <td className="task-desc-cell">{task.taskDesc || 'No description'}</td>
                <td>
                  <span className={`priority-badge priority-${(task.priority || 'medium').toLowerCase()}`}>
                    {task.priority || 'Medium'}
                  </span>
                </td>
                <td>
                  <span className={`status-badge status-${(task.status || 'unknown').toLowerCase()}`}>
                    {task.status || 'Unknown'}
                  </span>
                </td>
                <td>
                  <span className={`ack-count-badge ${task.ackCount > 0 ? 'has-acks' : 'no-acks'}`}>
                    {task.ackCount} {task.ackCount === 1 ? 'ack' : 'acks'}
                  </span>
                </td>
                <td className="latest-update-cell">
                  {task.latestAck ? (
                    <div>
                      <div className="update-time">
                        {format(new Date(task.latestAck.acknowledgeTime), 'MMM d, h:mm a')}
                      </div>
                      <div className="update-user">
                        👤 User {task.latestAck.userAcknowleged_id}
                      </div>
                    </div>
                  ) : (
                    <span className="no-update">No updates</span>
                  )}
                </td>
              </tr>
              {expandedRows[task.taskId] && task.acknowledgeDetails && task.acknowledgeDetails.length > 0 && (
                <tr className="expanded-row">
                  <td colSpan="7">
                    <div className="expanded-content">
                      <AcknowledgeTimeline acknowledgeDetails={task.acknowledgeDetails} />
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Main HistorySummary Component
const HistorySummary = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [historyData, setHistoryData] = useState(null);
  const [handoverId, setHandoverId] = useState(null);

  // Fetch data on page load (component mount)
  useEffect(() => {
    // Get handover ID from location state or route params
    const stateHandoverId = location.state?.handoverId;
    if (stateHandoverId) {
      setHandoverId(stateHandoverId);
    }

    handleFetchHistory();
    // eslint-disable-next-line
  }, []);

  // Function to fetch history data from API
  const handleFetchHistory = async () => {
  setLoading(true);
  setError('');

  try {
    console.log('Fetching history data from API...');
    const data = await getHistoryHandovers();
    console.log('API Response:', data);

    // Check if the response has the expected structure
    if (!data) {
      throw new Error('No data received from API');
    }

    // Handle case where TeamHandoverDetails or Tasksdata might be missing or empty
    const teamHandoverDetails = data.TeamHandoverDetails || [];
    const tasksData = data.Tasksdata || [];

    // If both are empty, show appropriate message
    if (teamHandoverDetails.length === 0 && tasksData.length === 0) {
      setHistoryData({
        TeamHandoverDetails: [],
        Tasksdata: []
      });
      setError('No history data available');
    } else {
      setHistoryData({
        TeamHandoverDetails: teamHandoverDetails,
        Tasksdata: tasksData
      });
    }
  } catch (err) {
    console.error('Error fetching history:', err);
    setError(err.message || 'Failed to load history data');
    setHistoryData(null);
  } finally {
    setLoading(false);
  }
};

  const handleBackClick = () => {
    // If we have a handover ID, navigate directly to that handover
    if (handoverId) {
      navigate(`/handover/${handoverId}`);
    } else {
      // Otherwise go back to dashboard
      navigate('/dashboard');
    }
  };

  const calculateSummary = (data) => {
  if (!data || !data.Tasksdata) {
    return {
      totalTasks: 0,
      acknowledgedTasks: 0,
      pendingTasks: 0,
      totalAcknowledgment: 0,
      teams: [],
      teamCount: 0,
      tasksBreakdown: []
    };
  }

  const tasks = data.Tasksdata || [];
  const teamHandovers = data.TeamHandoverDetails || [];

  const totalTasks = tasks.length;
  const acknowledgedTasks = tasks.filter(task =>
    task.acknowledgeDetails && task.acknowledgeDetails.length > 0
  ).length;
  const pendingTasks = totalTasks - acknowledgedTasks;

  const totalAcknowledgment = tasks.reduce((sum, task) => {
    return sum + (task.acknowledgeDetails?.length || 0);
  }, 0);

  const teams = [...new Set(teamHandovers.map(item => item.role).filter(Boolean))];

  const tasksBreakdown = tasks.map(task => ({
    taskId: task.historyTaskId || task.Taskid,
    taskDesc: task.task || task.taskDesc || 'No description',
    ackCount: task.acknowledgeDetails?.length || 0,
    latestAck: task.acknowledgeDetails && task.acknowledgeDetails.length > 0
      ? task.acknowledgeDetails[task.acknowledgeDetails.length - 1]
      : null,
    acknowledgeDetails: task.acknowledgeDetails || [],
    status: task.status || 'unknown',
    priority: task.priority || 'Medium'
  }))
    .sort((a, b) => b.ackCount - a.ackCount);

  return {
    totalTasks,
    acknowledgedTasks,
    pendingTasks,
    totalAcknowledgment,
    teams: teams.slice(0, 5),
    teamCount: teams.length,
    tasksBreakdown
  };
};

  const summary = calculateSummary(historyData);

  if (loading) {
    return (
      <div className="history-summary-page">
        <div className="history-header">
          <div className="header-content">
            <h1>Handover History Summary</h1>
            <p>Comprehensive overview of all historical handover data and acknowledgments</p>
          </div>
          <button
            className="back-button-header"
            onClick={handleBackClick}
            aria-label="Go back"
          >
            ← Back
          </button>
        </div>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading history data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="history-summary-page">
      {/* Header */}
      <div className="history-header">
        <div className="header-content">
          <h1>📊 Handover History Summary</h1>
          <p>Comprehensive overview of all historical handover data and acknowledgments</p>
        </div>
        <button
          className="back-button-header"
          onClick={handleBackClick}
          aria-label="Go back"
        >
          ← Back
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-message">
          <span>⚠️</span>
          <div>
            <strong>Error:</strong> {error}
          </div>
        </div>
      )}

      {/* Results Display */}
      {historyData ? (
        <div className="history-content">
          {/* Key Metrics */}
          <section className="summary-section">
            <h2 className="section-title">📈 Key Metrics</h2>
            <div className="summary-grid">
              <div className="summary-item total">
                <span className="summary-label">Total Tasks</span>
                <span className="summary-value">{summary.totalTasks}</span>
              </div>
              <div className="summary-item active">
                <span className="summary-label">✅ Acknowledged</span>
                <span className="summary-value">{summary.acknowledgedTasks}</span>
              </div>
              <div className="summary-item completed">
                <span className="summary-label">⏳ Pending</span>
                <span className="summary-value">{summary.pendingTasks}</span>
              </div>
              <div className="summary-item tasks">
                <span className="summary-label">Total Acks</span>
                <span className="summary-value">{summary.totalAcknowledgment}</span>
              </div>
            </div>
          </section>

          {/* Teams Overview
          {summary.teams.length > 0 && (
            <section className="summary-section">
              <h2 className="section-title">👥 Teams/Roles ({summary.teamCount} total)</h2>
              <div className="teams-overview">
                <div className="teams-list">
                  {summary.teams.map((team, index) => (
                    <div key={index} className="team-tag">
                      {team}
                    </div>
                  ))}
                  {summary.teamCount > 5 && (
                    <div className="team-tag more">
                      +{summary.teamCount - 5} more
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}
           */}
          {/* Tasks Breakdown Table */}
          {summary.tasksBreakdown && summary.tasksBreakdown.length > 0 && (
            <section className="summary-section">
              <h2 className="section-title">📋 Tasks History Details ({summary.tasksBreakdown.length} tasks)</h2>
              <HistoryTasksTable tasks={summary.tasksBreakdown} />
            </section>
          )}

          {/* No Tasks Message */}
          {summary.totalTasks === 0 && (
            <section className="summary-section">
              <div className="no-data-message">
                <p>📭 No tasks found in the history data</p>
              </div>
            </section>
          )}
        </div>
      ) : !error && (
        <div className="no-data-container">
          <p>❌ No data available</p>
        </div>
      )}
    </div>
  );
};

export default HistorySummary;
