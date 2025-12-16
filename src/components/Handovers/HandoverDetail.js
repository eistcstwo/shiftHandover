import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import './HandoverDetail.css';
import Modal from '../UI/Modal';
import { getHandovers, createTask, updateTask } from '../../Api/HandOverApi';
import HistorySummary from './HistorySummary';

// Team data with role and handover mapping
const TEAMS_DATA = [
  { rid: 1, role: 'Project Management', handover_id_id: 6 },
  { rid: 2, role: 'IIB Admin', handover_id_id: 3 },
  { rid: 3, role: 'Database Administration - Belapur', handover_id_id: 7 },
  { rid: 4, role: 'Linux Administration - Belapur', handover_id_id: 4 },
  { rid: 5, role: 'Windows Admin', handover_id_id: 8 },
  { rid: 6, role: 'Config Management', handover_id_id: 5 },
  { rid: 8, role: 'Monitoring', handover_id_id: 9 },
  { rid: 9, role: 'MQ Administration', handover_id_id: 1 },
  { rid: 10, role: 'EIS-Infra Development', handover_id_id: 2 }
];

// Status options for acknowledging tasks (no "open" option)
const acknowledgeStatusOptions = [
  { value: 'in progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' }
];

// Timeline Component with Horizontal Scroll - MOVED OUTSIDE HandoverDetail
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
      <h4 className="timeline-title">Acknowledgment History</h4>
      <div
        ref={timelineScrollRef}
        className="timeline-scroll-wrapper"
      >
        <div className="timeline-horizontal">
          {acknowledgeDetails.map((ack, index) => (
            <div key={ack.ackId} className="timeline-item">
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
                    User ID: {ack.userAcknowleged_id}
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

const HandoverDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Get user level from localStorage
  const [userLevel, setUserLevel] = useState('');

  const [backendData, setBackendData] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [ackDescription, setAckDescription] = useState('');
  const [ackStatus, setAckStatus] = useState('in progress');
  const [reassignTeam, setReassignTeam] = useState(''); // New state for reassign team
  const [error, setError] = useState('');
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);

  const [newTask, setNewTask] = useState({
    taskTitle: '',
    taskDesc: '',
    priority: 'Medium',
    status: 'open'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get user level from localStorage and normalize it
    const level = (localStorage.getItem('userlevel') || 'L1').toUpperCase().trim();
    console.log('User Level from localStorage:', level); // Debug log
    setUserLevel(level);
  }, []);

  useEffect(() => {
    fetchHandoverData();
    // eslint-disable-next-line
  }, [id]);

  // Check if user has admin access - ONLY for ADMIN, NOT L2
  const hasAdminAccess = userLevel === 'ADMIN';
  
  // L2 users can access dashboard and tasks but not admin features
  const canAccessDashboard = userLevel === 'ADMIN' || userLevel === 'L2' || userLevel === 'L1';
  
  // Debug log
  console.log('Current userLevel:', userLevel, 'hasAdminAccess:', hasAdminAccess, 'canAccessDashboard:', canAccessDashboard);

  const fetchHandoverData = async () => {
    setLoading(true);
    try {
      const data = await getHandovers();
      if (data && data.TeamHandoverDetails && data.Tasksdata) {
        const handoverDetail = data.TeamHandoverDetails.find(
          h => h.handover_id_id === parseInt(id)
        );
        const handoverTasks = data.Tasksdata.filter(
          t => t.handover_id_id === parseInt(id)
        );
        if (handoverDetail) {
          setBackendData({
            TeamHandoverDetails: [handoverDetail],
            Tasksdata: handoverTasks
          });
        } else {
          setBackendData(null);
        }
      } else {
        throw new Error('Invalid data structure');
      }
    } catch (err) {
      console.error('Error fetching handover:', err);
      setError('Failed to load handover details');
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'MMM d, yyyy h:mm a');
    } catch (e) {
      return '-';
    }
  };

  const handleAcknowledgeClick = (task) => {
    setSelectedTask(task);
    setModalOpen(true);
    setAckDescription(task.ackDesc || '');
    setAckStatus('in progress');
    setReassignTeam(''); // Reset reassign team
    setError('');
  };

const handleAcknowledgeSubmit = async () => {
  if (!ackDescription.trim()) {
    setError('Description is required.');
    return;
  }

  // Clear any previous errors
  setError('');

  const payload = {
    task_id: selectedTask.Taskid,
    taskTitle: selectedTask.taskTitle || '',
    taskDesc: selectedTask.taskDesc || '',
    status: ackStatus,
    priority: selectedTask.priority || 'Medium',
    acknowledgeStatus: 'Acknowledged',
    ackDesc: ackDescription
  };

  // Add handover_id_id only if a team is selected for reassignment
  if (reassignTeam) {
    const selectedTeamData = TEAMS_DATA.find(team => team.rid === parseInt(reassignTeam));
    if (selectedTeamData) {
      payload.handover_id_id = selectedTeamData.handover_id_id;
    }
  }

  try {
    console.log('Submitting acknowledgment with payload:', payload);
    
    const response = await updateTask(payload);
    
    console.log('Acknowledgment response:', response);

    // Only update state and reload if the API call was successful
    if (response) {
      const updatedTasks = backendData.Tasksdata.map(t =>
        t.Taskid === selectedTask.Taskid
          ? {
              ...t,
              status: ackStatus,
              acknowledgeStatus: 'Acknowledged',
              ackDesc: ackDescription,
              acknowledgeTime: new Date().toISOString(),
              statusUpdateTime: new Date().toISOString(),
              ...(reassignTeam && { 
                handover_id_id: TEAMS_DATA.find(team => team.rid === parseInt(reassignTeam))?.handover_id_id 
              })
            }
          : t
      );

      setBackendData({
        ...backendData,
        Tasksdata: updatedTasks
      });

      // Close modal and reset form
      setModalOpen(false);
      setSelectedTask(null);
      setAckDescription('');
      setAckStatus('in progress');
      setReassignTeam('');
      setError('');

      // Show success message before reload
      alert('Task acknowledged successfully!');
      
      // Reload to get fresh data from server
      window.location.reload();
    } else {
      throw new Error('No response received from server');
    }
  } catch (err) {
    console.error('Acknowledgment submission error:', err);
    
    // Show specific error message to user
    const errorMessage = err.response?.data?.message || err.message || 'Failed to update task on server!';
    setError(errorMessage);
    
    // Also alert the user
    alert(`Error: ${errorMessage}`);
  }
};

  const handleCreateTask = () => {
    setShowCreateTaskModal(true);
    setNewTask({
      taskTitle: '',
      taskDesc: '',
      priority: 'Medium',
      status: 'open'
    });
    setError('');
  };

  const handleCreateTaskSubmit = async (e) => {
    e.preventDefault();
    if (!newTask.taskTitle.trim() && !newTask.taskDesc.trim()) {
      setError('Please provide at least a title or description');
      return;
    }

    const payload = {
      taskTitle: newTask.taskTitle,
      taskDesc: newTask.taskDesc,
      status: 'open',
      priority: newTask.priority,
      acknowledgeStatus: 'Pending',
      ackDesc: '',
      handover_id_id: parseInt(id)
    };

    try {
      await createTask(payload);
      await fetchHandoverData();
      setShowCreateTaskModal(false);
      setError('');
    } catch (err) {
      setError('Failed to create task on server!');
    }
  };

  const getTaskStats = (tasks) => {
    return {
      pending: tasks.filter(t => t.status === 'open' || t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in progress' || t.status === 'in-progress').length,
      completed: tasks.filter(t => t.status === 'completed' || t.status === 'closed').length
    };
  };

  if (loading) {
    return (
      <div className="handover-detail-container">
        <div className="loading-message">
          <div className="loading-spinner"></div>
          <p>Loading handover details...</p>
        </div>
      </div>
    );
  }

  if (!backendData || !backendData.TeamHandoverDetails || backendData.TeamHandoverDetails.length === 0) {
    return (
      <div className="handover-detail-container">
        <div className="not-found">
          <h2>Handover not found</h2>
          <button onClick={() => navigate('/dashboard')} className="back-button">
            Back to List
          </button>
        </div>
      </div>
    );
  }

  const handover = backendData.TeamHandoverDetails[0];
  const tasks = backendData.Tasksdata || [];
  const taskStats = getTaskStats(tasks);

  return (
    <div className="handover-detail-container">
      <div className="handover-detail-header">
        <h2>{handover.role} Team Handover</h2>
        {/* Debug info - remove after testing */}
        <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
          User Level: {userLevel} | Admin Access: {hasAdminAccess ? 'Yes' : 'No'} | Dashboard Access: {canAccessDashboard ? 'Yes' : 'No'}
        </div>
      </div>

      <div className="handover-detail-content">
        {tasks.length > 0 && (
          <div className="task-stats">
            <div className="task-stat-card pending">
              <h4>Pending</h4>
              <div className="number">{taskStats.pending}</div>
            </div>
            <div className="task-stat-card in-progress">
              <h4>In Progress</h4>
              <div className="number">{taskStats.inProgress}</div>
            </div>
            <div className="task-stat-card completed">
              <h4>Completed</h4>
              <div className="number">{taskStats.completed}</div>
            </div>
          </div>
        )}

        <div className="detail-section">
          <h3>Handover Information</h3>
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">Team Role</span>
              <span className="detail-value">{handover.role}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Project ID</span>
              <span className="detail-value">{handover.pid}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Handover ID</span>
              <span className="detail-value">{handover.handover_id_id}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Record ID</span>
              <span className="detail-value">{handover.rid}</span>
            </div>
          </div>
        </div>

        <div className="detail-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <h3>Tasks ({tasks.length})</h3>
              {/* Only show History Summary button for ADMIN users (NOT L2) */}
              {hasAdminAccess && (
                <button
                  className="summary-button"
                  onClick={() => navigate('/history-summary', { state: { handoverId: id } })}
                >
                  📊 View History Summary
                </button>
              )}
            </div>
            <button className="create-task-btn" onClick={handleCreateTask}>
              + Create New Task
            </button>
          </div>

          {tasks.length > 0 ? (
            <table className="tasks-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Description</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Ack Status</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(task => (
                  <tr key={task.Taskid}>
                    <td>{task.Taskid}</td>
                    <td style={{ fontWeight: 600 }}>{task.taskTitle || 'Untitled'}</td>
                    <td>{task.taskDesc || '-'}</td>
                    <td>
                      <span className={`priority-badge priority-${(task.priority || 'medium').toLowerCase()}`}>
                        {task.priority || 'Medium'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${task.status === 'in progress' ? 'in-progress' : task.status}`}>
                        {task.status === 'in progress' ? 'In Progress' : task.status}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${task.acknowledgeStatus?.toLowerCase() === 'pending' ? 'pending' : 'completed'}`}>
                        {task.acknowledgeStatus || 'Pending'}
                      </span>
                    </td>
                    <td>{formatDate(task.creationTime)}</td>
                    <td>
                      <button className="acknowledge-btn" onClick={() => handleAcknowledgeClick(task)}>
                        Acknowledge
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="no-tasks">
              <p>No tasks found for this handover. Create your first task to get started!</p>
            </div>
          )}
        </div>

        {modalOpen && selectedTask && (
          <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
            <div className="modal-form-container">
              <div className="modal-header-container">
                <h2 className="modal-title">Acknowledge Task</h2>
              </div>

              <div className="task-info-horizontal">
                <div className="info-column">
                  <strong>Task ID</strong>
                  <span>{selectedTask.Taskid}</span>
                </div>
                <div className="info-column">
                  <strong>Title</strong>
                  <span>{selectedTask.taskTitle || 'Untitled'}</span>
                </div>
                <div className="info-column">
                  <strong>Current Status</strong>
                  <span className={`status-badge ${selectedTask.status === 'in progress' ? 'in-progress' : selectedTask.status}`}>
                    {selectedTask.status === 'in progress' ? 'In Progress' : selectedTask.status}
                  </span>
                </div>
              </div>

              <AcknowledgeTimeline acknowledgeDetails={selectedTask.acknowledgeDetails} />

              <div className="form-group">
                <label>
                  Acknowledgment Description <span className="required">*</span>
                </label>
                <textarea
                  value={ackDescription}
                  onChange={e => setAckDescription(e.target.value)}
                  rows={4}
                  placeholder="Add your acknowledgment details..."
                  className="form-textarea"
                />
              </div>

              <div className="form-group">
                <label>Update Status To</label>
                <select
                  value={ackStatus}
                  onChange={e => setAckStatus(e.target.value)}
                  className="form-select"
                  disabled={!ackDescription.trim()}
                >
                  {acknowledgeStatusOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {!ackDescription.trim() && (
                  <div className="form-hint">
                    Please fill description to enable status change.
                  </div>
                )}
              </div>

              {/* NEW: Reassign Team Field */}
              <div className="form-group">
                <label>Reassign Task to Team (Optional)</label>
                <select
                  value={reassignTeam}
                  onChange={e => setReassignTeam(e.target.value)}
                  className="form-select"
                >
                  <option value="">-- Select Team to Reassign --</option>
                  {TEAMS_DATA.map(team => (
                    <option key={team.rid} value={team.rid}>
                      {team.role}
                    </option>
                  ))}
                </select>
                <div className="form-hint">
                  {reassignTeam ? `This task will be reassigned to: ${TEAMS_DATA.find(t => t.rid === parseInt(reassignTeam))?.role}` : 'Leave empty if you do not want to reassign this task'}
                </div>
              </div>

              {error && <div className="error-message">{error}</div>}

              <div className="modal-actions">
                <button onClick={() => setModalOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button
                  onClick={handleAcknowledgeSubmit}
                  className="btn-primary"
                  disabled={!ackDescription.trim()}
                >
                  Submit Acknowledgment
                </button>
              </div>
            </div>
          </Modal>
        )}

        {showCreateTaskModal && (
          <Modal open={showCreateTaskModal} onClose={() => setShowCreateTaskModal(false)}>
            <form onSubmit={handleCreateTaskSubmit} className="modal-form-container">
              <div className="modal-header-container">
                <h2 className="modal-title">Create New Task</h2>
              </div>

              <div className="form-group">
                <label>
                  Title <span className="required">*</span>
                </label>
                <input
                  type="text"
                  value={newTask.taskTitle}
                  onChange={e => setNewTask({ ...newTask, taskTitle: e.target.value })}
                  className="form-input"
                  placeholder="Enter task title"
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={newTask.taskDesc}
                  onChange={e => setNewTask({ ...newTask, taskDesc: e.target.value })}
                  rows={3}
                  className="form-textarea"
                  placeholder="Enter task description (optional)"
                />
              </div>

              <div className="form-group">
                <label>Priority</label>
                <select
                  value={newTask.priority}
                  onChange={e => setNewTask({ ...newTask, priority: e.target.value })}
                  className="form-select"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>

              <div className="form-group">
                <label>Status</label>
                <input
                  type="text"
                  value="Open"
                  className="form-input"
                  disabled
                  style={{
                    background: 'rgba(241, 196, 15, 0.12)',
                    border: '1px solid rgba(241, 196, 15, 0.2)',
                    color: '#ffeaa7',
                    cursor: 'not-allowed'
                  }}
                />
                <div className="form-hint">
                  New tasks are always created with "Open" status
                </div>
              </div>

              {error && <div className="error-message">{error}</div>}

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowCreateTaskModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={!newTask.taskTitle.trim()}
                >
                  Create Task
                </button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    </div>
  );
};

export default HandoverDetail;
