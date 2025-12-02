HandoverDetail.js
-rwxrwxrwx 1 root root 27422 Nov  7 13:39 HandoverDetail.js_081125
-rwxrwxrwx 1 root root 20214 Nov 22 12:03 HandoverDetail.js_22112025
-rwxrwxrwx 1 root root 16283 Oct 23 12:43 HandoverDetail.js_231025
-rwxrwxrwx 1 root root 18972 Nov 27 17:50 HandoverDetail.js_27112025
-rwxrwxrwx 1 root root 17840 Oct 28 18:54 HandoverDetail.js_291025
-rwxrwxrwx 1 root root  3266 Sep 25 14:29 HandoverItem.css
-rwxrwxrwx 1 root root  3989 Oct  8 14:07 HandoverItem.js
-rwxrwxrwx 1 root root  8410 Oct 23 16:24 HandoverList.css
-rwxrwxrwx 1 root root 13817 Oct 27 18:10 HandoverList.js
-rwxrwxrwx 1 root root  5267 Oct  3 18:28 HandoverList.js_081025
-rwxrwxrwx 1 root root 13143 Oct  8 19:10 HandoverList.js_231025
-rwxrwxrwx 1 root root 14850 Nov 22 20:41 HistorySummary.css
-rwxrwxrwx 1 root root 13048 Nov 24 15:04 HistorySummary.js
[root@eispr-prt1-01 Handovers]# cat HandoverDetail.js
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import './HandoverDetail.css';
import Modal from '../UI/Modal';
import { getHandovers, createTask, updateTask } from '../../Api/HandOverApi';
import HistorySummary from './HistorySummary';

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
    setError('');
  };

  const handleAcknowledgeSubmit = async () => {
    if (!ackDescription.trim()) {
      setError('Description is required.');
      return;
    }

    const payload = {
      task_id: selectedTask.Taskid,
      taskTitle: selectedTask.taskTitle || '',
      taskDesc: selectedTask.taskDesc || '',
      status: ackStatus,
      priority: selectedTask.priority || 'Medium',
      acknowledgeStatus: 'Acknowledged',
      ackDesc: ackDescription
    };

    try {
      await updateTask(payload);

      const updatedTasks = backendData.Tasksdata.map(t =>
        t.Taskid === selectedTask.Taskid
          ? {
              ...t,
              status: ackStatus,
              acknowledgeStatus: 'Acknowledged',
              ackDesc: ackDescription,
              acknowledgeTime: new Date().toISOString(),
              statusUpdateTime: new Date().toISOString()
            }
          : t
      );

      setBackendData({
        ...backendData,
        Tasksdata: updatedTasks
      });

      setModalOpen(false);
      setSelectedTask(null);
      setAckDescription('');
      setAckStatus('in progress');
      setError('');

      window.location.reload();
    } catch (err) {
      setError('Failed to update task on server!');
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
