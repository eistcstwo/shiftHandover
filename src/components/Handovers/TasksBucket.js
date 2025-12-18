import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { getAllTasks } from '../../Api/HandOverApi';
import './TasksBucket.css';

// Acknowledge Timeline Component
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
      <div ref={timelineScrollRef} className="timeline-scroll-wrapper">
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

// Tasks Table Component with Expandable Rows
const AllTasksTable = ({ tasks }) => {
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
        <p>📭 No tasks found</p>
      </div>
    );
  }

  return (
    <div className="all-tasks-table-container">
      <table className="all-tasks-table">
        <thead>
          <tr>
            <th style={{ width: '50px' }}>📌</th>
            <th>Task ID</th>
            <th>Title</th>
            <th>Description</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Ack Status</th>
            <th>Acknowledgments</th>
            <th>Created Date</th>
            <th>Latest Update</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <React.Fragment key={task.Taskid}>
              <tr className="task-row">
                <td>
                  {task.acknowledgeDetails && task.acknowledgeDetails.length > 0 && (
                    <button
                      className="expand-button"
                      onClick={() => toggleRow(task.Taskid)}
                      aria-label={expandedRows[task.Taskid] ? 'Collapse' : 'Expand'}
                      title="Click to view acknowledgment details"
                    >
                      {expandedRows[task.Taskid] ? '▼' : '▶'}
                    </button>
                  )}
                </td>
                <td className="task-id-cell">#{task.Taskid}</td>
                <td className="task-title-cell">{task.taskTitle || 'Untitled'}</td>
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
                  <span className={`ack-status-badge ${(task.acknowledgeStatus || 'pending').toLowerCase()}`}>
                    {task.acknowledgeStatus || 'Pending'}
                  </span>
                </td>
                <td>
                  <span className={`ack-count-badge ${(task.acknowledgeDetails?.length || 0) > 0 ? 'has-acks' : 'no-acks'}`}>
                    {task.acknowledgeDetails?.length || 0} {(task.acknowledgeDetails?.length || 0) === 1 ? 'ack' : 'acks'}
                  </span>
                </td>
                <td className="created-date-cell">
                  {format(new Date(task.creationTime), 'MMM d, yyyy')}
                </td>
                <td className="latest-update-cell">
                  {task.acknowledgeDetails && task.acknowledgeDetails.length > 0 ? (
                    <div>
                      <div className="update-time">
                        {format(new Date(task.acknowledgeDetails[task.acknowledgeDetails.length - 1].acknowledgeTime), 'MMM d, h:mm a')}
                      </div>
                      <div className="update-user">
                        👤 User {task.acknowledgeDetails[task.acknowledgeDetails.length - 1].userAcknowleged_id}
                      </div>
                    </div>
                  ) : (
                    <span className="no-update">No updates</span>
                  )}
                </td>
              </tr>
              {expandedRows[task.Taskid] && task.acknowledgeDetails && task.acknowledgeDetails.length > 0 && (
                <tr className="expanded-row">
                  <td colSpan="10">
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

// Main TasksBucket Component
const TasksBucket = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [allTasks, setAllTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  useEffect(() => {
    handleFetchAllTasks();
  }, []);

  const handleFetchAllTasks = async () => {
  setLoading(true);
  setError('');

  try {
    console.log('Fetching all tasks from API...');
    const data = await getAllTasks();
    console.log('API Response:', data);

    if (data && data.TeamHandoverDetailsTask) {
      // Backend returns nested array structure
      const flattenedTasks = [];
      
      // Iterate through the nested arrays
      data.TeamHandoverDetailsTask.forEach(taskArray => {
        if (Array.isArray(taskArray)) {
          taskArray.forEach(task => {
            if (task && task.Taskid) {
              flattenedTasks.push(task);
            }
          });
        }
      });
      
      console.log('Flattened tasks:', flattenedTasks);
      setAllTasks(flattenedTasks);
      setFilteredTasks(flattenedTasks);
    } else {
      throw new Error('Invalid data structure - missing TeamHandoverDetailsTask');
    }
  } catch (err) {
    console.error('Error fetching tasks:', err);
    setError(err.message || 'Failed to load tasks');
    setAllTasks([]);
    setFilteredTasks([]);
  } finally {
    setLoading(false);
  }
};

  const applyFilters = (tasks, status, priority) => {
    return tasks.filter(task => {
      let matches = true;

      if (status !== 'all') {
        matches = matches && task.status?.toLowerCase() === status.toLowerCase();
      }

      if (priority !== 'all') {
        matches = matches && task.priority?.toLowerCase() === priority.toLowerCase();
      }

      return matches;
    });
  };

  const handleStatusFilterChange = (newStatus) => {
    setStatusFilter(newStatus);
    setFilteredTasks(applyFilters(allTasks, newStatus, priorityFilter));
  };

  const handlePriorityFilterChange = (newPriority) => {
    setPriorityFilter(newPriority);
    setFilteredTasks(applyFilters(allTasks, statusFilter, newPriority));
  };

  const calculateStats = (tasks) => {
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'open' || t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in progress' || t.status === 'in-progress').length,
      completed: tasks.filter(t => t.status === 'completed' || t.status === 'closed').length,
      acknowledged: tasks.filter(t => t.acknowledgeStatus === 'Acknowledged').length
    };
  };

  const stats = calculateStats(filteredTasks);

  if (loading) {
    return (
      <div className="tasks-bucket-page">
        <div className="bucket-header">
          <div className="header-content">
            <h1>📦 All Tasks Bucket</h1>
            <p>View all tasks assigned to teams across handovers</p>
          </div>
          <button
            className="back-button-header"
            onClick={() => navigate('/dashboard')}
            aria-label="Go back"
          >
            ← Back
          </button>
        </div>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tasks-bucket-page">
      {/* Header */}
      <div className="bucket-header">
        <div className="header-content">
          <h1>📦 All Tasks Bucket</h1>
          <p>View all tasks assigned to teams across handovers</p>
        </div>
        <button
          className="back-button-header"
          onClick={() => navigate('/dashboard')}
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

      {/* Key Metrics */}
      <section className="bucket-section">
        <h2 className="section-title">📈 Key Metrics</h2>
        <div className="stats-grid">
          <div className="stat-card total">
            <span className="stat-label">Total Tasks</span>
            <span className="stat-value">{stats.total}</span>
          </div>
          <div className="stat-card pending">
            <span className="stat-label">⏳ Pending</span>
            <span className="stat-value">{stats.pending}</span>
          </div>
          <div className="stat-card in-progress">
            <span className="stat-label">🔄 In Progress</span>
            <span className="stat-value">{stats.inProgress}</span>
          </div>
          <div className="stat-card completed">
            <span className="stat-label">✅ Completed</span>
            <span className="stat-value">{stats.completed}</span>
          </div>
          <div className="stat-card acknowledged">
            <span className="stat-label">✔️ Acknowledged</span>
            <span className="stat-value">{stats.acknowledged}</span>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="bucket-section">
        <div className="filters-group">
          <div className="filter-item">
            <label>Status:</label>
            <select value={statusFilter} onChange={(e) => handleStatusFilterChange(e.target.value)}>
              <option value="all">All</option>
              <option value="open">Open</option>
              <option value="in progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="filter-item">
            <label>Priority:</label>
            <select value={priorityFilter} onChange={(e) => handlePriorityFilterChange(e.target.value)}>
              <option value="all">All</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div className="filter-item">
            <button onClick={handleFetchAllTasks} className="refresh-btn">
              🔄 Refresh
            </button>
          </div>
        </div>
      </section>

      {/* Tasks Table */}
      {filteredTasks.length > 0 && (
        <section className="bucket-section">
          <h2 className="section-title">📋 All Tasks ({filteredTasks.length})</h2>
          <AllTasksTable tasks={filteredTasks} />
        </section>
      )}

      {/* No Tasks Message */}
      {filteredTasks.length === 0 && !loading && (
        <section className="bucket-section">
          <div className="no-data-container">
            <p>📭 No tasks found matching the selected filters</p>
          </div>
        </section>
      )}
    </div>
  );
};

export default TasksBucket;
