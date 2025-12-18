import React, { useState, useEffect, createContext, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { getHandovers } from '../../Api/HandOverApi';
import './HandoverList.css';

// Create context to share handover count across components
export const HandoverContext = createContext({ hasMultipleHandovers: true });

const HandoverList = ({ onHandoversUpdate }) => {
  const navigate = useNavigate();
  const [backendData, setBackendData] = useState({ TeamHandoverDetails: [], Tasksdata: [] });
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchHandovers();
  }, []);

  // Auto-redirect effect when data is loaded
  useEffect(() => {
    if (!loading && backendData.TeamHandoverDetails.length === 1) {
      // If there's exactly one handover, redirect to its detail page
      const singleHandover = backendData.TeamHandoverDetails[0];
      navigate(`/handover/${singleHandover.handover_id_id}`, { 
        replace: true,
        state: { hasMultipleHandovers: false }
      });
    }
  }, [loading, backendData.TeamHandoverDetails, navigate]);

  // Call the parent callback to update handovers
  useEffect(() => {
    if (!loading && onHandoversUpdate) {
      onHandoversUpdate(backendData);
    }
  }, [backendData, loading, onHandoversUpdate]);

  const fetchHandovers = async () => {
  setLoading(true);
  setError(null);

  try {
    console.log('Fetching handovers from API...');
    const data = await getHandovers();

    console.log('API Response:', data);

    // Ensure the data has the expected structure
    if (!data) {
      throw new Error('No data received from API');
    }

    // Handle case where fields might be missing
    const teamHandoverDetails = data.TeamHandoverDetails || [];
    const tasksData = data.Tasksdata || [];

    setBackendData({
      TeamHandoverDetails: teamHandoverDetails,
      Tasksdata: tasksData
    });

    if (teamHandoverDetails.length === 0) {
      setError('No handover data available for your team');
    }
  } catch (err) {
    setError(`Failed to fetch handovers: ${err.message}`);
    console.error('Error fetching handovers:', err);
    setBackendData({ TeamHandoverDetails: [], Tasksdata: [] });
  } finally {
    setLoading(false);
  }
};

  const { TeamHandoverDetails = [], Tasksdata = [] } = backendData;

  // Group tasks by handover_id_id
  const tasksByHandover = Tasksdata.reduce((acc, task) => {
    if (!acc[task.handover_id_id]) {
      acc[task.handover_id_id] = [];
    }
    acc[task.handover_id_id].push(task);
    return acc;
  }, {});

  // Calculate task statistics
  const taskStats = {
    pending: Tasksdata.filter(t => t.status === 'open' || t.status === 'pending').length,
    'in-progress': Tasksdata.filter(t => t.status === 'in progress' || t.status === 'in-progress').length,
    completed: Tasksdata.filter(t => t.status === 'completed' || t.status === 'closed').length
  };

  // Map backend priority to display class
  const getPriorityClass = (priority) => {
    if (!priority) return 'priority-medium';
    const priorityLower = priority.toLowerCase();
    return `priority-${priorityLower}`;
  };

  // Map backend status to display format
  const getStatusDisplay = (status) => {
    if (!status) return 'pending';
    const statusMap = {
      'open': 'pending',
      'pending': 'pending',
      'in progress': 'in-progress',
      'in-progress': 'in-progress',
      'completed': 'completed',
      'closed': 'completed'
    };
    return statusMap[status.toLowerCase()] || 'pending';
  };

  // Get priority badge class
  const getPriorityBadgeClass = (priority) => {
    if (!priority) return 'priority-badge priority-medium';
    return `priority-badge priority-${priority.toLowerCase()}`;
  };

  // Get status badge class
  const getStatusBadgeClass = (status) => {
    const displayStatus = getStatusDisplay(status);
    return `status-badge ${displayStatus}`;
  };

  // Get status display text
  const getStatusText = (status) => {
    if (!status) return 'Pending';
    const statusMap = {
      'open': 'Open',
      'pending': 'Pending',
      'in progress': 'In Progress',
      'in-progress': 'In Progress',
      'completed': 'Completed',
      'closed': 'Completed'
    };
    return statusMap[status.toLowerCase()] || status;
  };

  // Filter handovers based on selected filters
  const filteredHandovers = TeamHandoverDetails.filter(handover => {
    const handoverTasks = tasksByHandover[handover.handover_id_id] || [];

    if (statusFilter !== 'all') {
      const hasMatchingStatus = handoverTasks.some(task =>
        getStatusDisplay(task.status) === statusFilter
      );
      if (!hasMatchingStatus) return false;
    }

    if (priorityFilter !== 'all') {
      const hasMatchingPriority = handoverTasks.some(task =>
        task.priority?.toLowerCase() === priorityFilter
      );
      if (!hasMatchingPriority) return false;
    }

    return true;
  });

  // Format date safely
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'MMM d, yyyy h:mm a');
    } catch (e) {
      return '-';
    }
  };

  // Don't render anything if loading or if there's only one handover (will auto-redirect)
  if (loading) {
    return (
      <div className="handover-container">
        <div className="loading-message">
          <p>Loading handovers...</p>
        </div>
      </div>
    );
  }

  // If there's only one handover, show a brief message while redirecting
  if (TeamHandoverDetails.length === 1) {
    return (
      <div className="handover-container">
        <div className="loading-message">
          <p>Redirecting to handover details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="handover-container">
      <div className="handover-header">
        <h2>Shift Handovers</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={fetchHandovers}
            disabled={loading}
            className="refresh-btn"
          >
            {loading ? 'Refreshing...' : '🔄 Refresh'}
          </button>
          <button
            onClick={() => navigate('/create')}
            className="create-handover-btn"
          >
            + Create Handover
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
          <button
            onClick={fetchHandovers}
            style={{
              marginLeft: '1rem',
              padding: '4px 12px',
              background: '#fff',
              border: '1px solid #dc3545',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      )}

      <div className="task-statistics">
        <div className="stat-card pending">
          <h3>Pending Tasks</h3>
          <span className="stat-number">{taskStats.pending || 0}</span>
        </div>
        <div className="stat-card in-progress">
          <h3>In Progress</h3>
          <span className="stat-number">{taskStats['in-progress'] || 0}</span>
        </div>
        <div className="stat-card completed">
          <h3>Completed</h3>
          <span className="stat-number">{taskStats.completed || 0}</span>
        </div>
      </div>

      <div className="filters">
        <div className="filter-group">
          <label>Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Priority:</label>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      <div className="handover-list">
        {filteredHandovers.length > 0 ? (
          filteredHandovers.map((handover) => {
            const handoverTasks = tasksByHandover[handover.handover_id_id] || [];

            // Calculate highest priority from tasks
            const highestPriority = handoverTasks.reduce((highest, task) => {
              if (!task.priority) return highest;
              const priorityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
              const taskPriority = priorityOrder[task.priority.toLowerCase()] || 0;
              const highestValue = priorityOrder[highest?.toLowerCase()] || 0;
              return taskPriority > highestValue ? task.priority : highest;
            }, 'Medium');

            return (
              <div
                key={handover.handover_id_id}
                className={`handover-item ${getPriorityClass(highestPriority)}`}
              >
                <div className="handover-header">
                  <h3>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(`/handover/${handover.handover_id_id}`);
                      }}
                    >
                      {handover.teamName} Team Handover
                    </a>
                  </h3>
                </div>

                <div className="handover-meta">
                  <div className="meta-item">
                    <span className="meta-label">Team:</span>
                    <span>{handover.teamName}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Team ID:</span>
                    <span>{handover.TeamId}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Team Lead ID:</span>
                    <span>{handover.teamLead_id}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Handover ID:</span>
                    <span>{handover.handover_id_id}</span>
                  </div>
                </div>

                {handoverTasks.length > 0 && (
                  <div className="handover-tasks">
                    <h4>Tasks ({handoverTasks.length})</h4>
                    <div className="tasks-table-wrapper">
                      <table className="tasks-table">
                        <thead>
                          <tr>
                            <th>Title</th>
                            <th>Description</th>
                            <th>Priority</th>
                            <th>Status</th>
                            <th>Acknowledge Status</th>
                            <th>Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {handoverTasks.map((task) => (
                            <tr key={task.Taskid}>
                              <td style={{ fontWeight: 600 }}>
                                {task.taskTitle || task.taskDesc || 'Untitled'}
                              </td>
                              <td>{task.taskDesc || '-'}</td>
                              <td>
                                <span className={getPriorityBadgeClass(task.priority)}>
                                  {task.priority || 'Medium'}
                                </span>
                              </td>
                              <td>
                                <span className={getStatusBadgeClass(task.status)}>
                                  {getStatusText(task.status)}
                                </span>
                              </td>
                              <td>
                                <span className={`status-badge ${task.acknowledgeStatus?.toLowerCase() === 'pending' ? 'pending' : 'completed'}`}>
                                  {task.acknowledgeStatus || 'Pending'}
                                </span>
                              </td>
                              <td>{formatDate(task.creationTime)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="handover-actions">
                  <button
                    onClick={() => navigate(`/handover/${handover.handover_id_id}`)}
                    className="view-btn"
                  >
                    View Details
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="no-handovers">
            <p>No handovers found matching the selected filters.</p>
            {TeamHandoverDetails.length === 0 && !loading && (
              <button
                onClick={() => navigate('/create')}
                style={{
                  marginTop: '1rem',
                  padding: '0.75rem 1.5rem',
                  background: '#2ecc71',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}
              >
                Create First Handover
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default HandoverList;
