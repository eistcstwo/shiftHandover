import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import axios from 'axios';
import './TasksList.css';

// Configure axios with base URL
const API_BASE_URL = 'https://10.191.171.12:5443/EISHOME/shiftHandover';

const TasksList = () => {
  const navigate = useNavigate();

  // State for main operator authentication
  const [operatorAuth, setOperatorAuth] = useState({
    name: '',
    id: '',
    isAuthenticated: false,
    authTime: null
  });

  // State for support acknowledgment
  const [supportAckModal, setSupportAckModal] = useState(false);
  const [supportAckData, setSupportAckData] = useState({
    name: '',
    id: '',
    setNumber: null
  });

  // State for set completion verification
  const [setCompleteModal, setSetCompleteModal] = useState(false);
  const [setCompleteData, setSetCompleteData] = useState({
    name: '',
    id: '',
    setNumber: null
  });

  // State for set start modal (Set 1)
  const [setStartModal, setSetStartModal] = useState(false);
  const [setStartData, setSetStartData] = useState({
    name: '',
    id: '',
    setNumber: null
  });

  // State for set start modal (Sets 2,3,4 - with restart ID)
  const [setStartWithIdModal, setSetStartWithIdModal] = useState(false);
  const [restartId, setRestartId] = useState(null);

  // State for current set
  const [currentSet, setCurrentSet] = useState(1);
  const [sets, setSets] = useState([
    {
      id: 1,
      name: '25 Series - Set 1',
      servers: '155, 156, 157, 173, 174, 73, 74, 55, 56, 57, 63, 64, 163, 164, 10, 11, 12, 110, 111, 112, 41, 42, 43, 141, 142, 143, 31, 32, 134, 135, 192, 196, 197, 68, 69, 168, 169',
      status: 'pending',
      restartId: null,
      supportAck: null,
      completedBy: null,
      completedTime: null
    },
    {
      id: 2,
      name: '25 Series - Set 2',
      servers: '158, 159, 160, 175, 176, 75, 58, 59, 65, 66, 67, 165, 166, 13, 14, 113, 114, 115, 44, 45, 144, 145, 146, 33, 34, 131, 132, 133, 190, 191, 194, 195, 70, 71, 170, 171',
      status: 'pending',
      restartId: null,
      supportAck: null,
      completedBy: null,
      completedTime: null
    },
    {
      id: 3,
      name: '24 Series - Set 3',
      servers: '158, 159, 160, 175, 176, 75, 58, 59, 65, 66, 67, 165, 166, 13, 14, 113, 114, 115, 44, 45, 144, 145, 146, 33, 34, 131, 132, 133, 190, 191, 194, 195, 70, 71, 170, 171',
      status: 'pending',
      restartId: null,
      supportAck: null,
      completedBy: null,
      completedTime: null
    },
    {
      id: 4,
      name: '24 Series - Set 4',
      servers: '155, 156, 157, 173, 174, 73, 74, 55, 56, 57, 63, 64, 163, 164, 10, 11, 12, 110, 111, 112, 41, 42, 43, 141, 142, 143, 31, 32, 134, 135, 192, 196, 197, 68, 69, 168, 169',
      status: 'pending',
      restartId: null,
      supportAck: null,
      completedBy: null,
      completedTime: null
    }
  ]);

  // State for checklist steps
  const [checklistSteps, setChecklistSteps] = useState([
    {
      id: 1,
      title: 'CACHE UPDATED AFTER 12:00 A.M.',
      description: 'Ensure cache is updated after midnight',
      completed: false,
      completedTime: null,
      completedBy: null,
      requiresAck: false
    },
    {
      id: 2,
      title: 'INFORM START OF ACTIVITY TO SUPPORT TEAM',
      description: 'Notify support team about activity start',
      completed: false,
      completedTime: null,
      completedBy: null,
      requiresAck: true,
      ackBy: null,
      ackTime: null
    },
    {
      id: 3,
      title: 'SETS READY FOR RESTART',
      description: 'Prepare all server sets for restart',
      completed: false,
      completedTime: null,
      completedBy: null,
      requiresAck: false
    },
    {
      id: 4,
      title: 'ISOLATOR DOWN',
      description: 'Bring isolator down for maintenance',
      completed: false,
      completedTime: null,
      completedBy: null,
      requiresAck: false
    },
    {
      id: 5,
      title: 'BROKER STOPPED',
      description: 'Stop all broker services',
      completed: false,
      completedTime: null,
      completedBy: null,
      requiresAck: false
    },
    {
      id: 6,
      title: 'HEARTBEAT & CACHE BROKER STARTED',
      description: 'Start heartbeat and cache broker services',
      completed: false,
      completedTime: null,
      completedBy: null,
      requiresAck: false
    },
    {
      id: 7,
      title: 'ALL BROKER STARTED',
      description: 'Start all broker services',
      completed: false,
      completedTime: null,
      completedBy: null,
      requiresAck: false
    },
    {
      id: 8,
      title: 'CACHE HIT & WORKLOAD DONE',
      description: 'Verify cache hits and complete workload',
      completed: false,
      completedTime: null,
      completedBy: null,
      requiresAck: false
    },
    {
      id: 9,
      title: 'UDP CHANGES (TIMEOUT & URL CHANGES)',
      description: 'Apply UDP configuration changes',
      completed: false,
      completedTime: null,
      completedBy: null,
      requiresAck: false
    },
    {
      id: 10,
      title: 'LOGS VERIFICATION DONE',
      description: 'Verify all system logs',
      completed: false,
      completedTime: null,
      completedBy: null,
      requiresAck: false
    },
    {
      id: 11,
      title: 'ISOLATOR UP',
      description: 'Bring isolator back online',
      completed: false,
      completedTime: null,
      completedBy: null,
      requiresAck: false
    }
  ]);

  const [currentStep, setCurrentStep] = useState(1);
  const [timer, setTimer] = useState(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [activityLog, setActivityLog] = useState([]);
  const [loading, setLoading] = useState(false);

  // Log activity
  const logActivity = (type, message, data = null) => {
    const logEntry = {
      timestamp: new Date(),
      type,
      message,
      data,
      operator: operatorAuth.name,
      operatorId: operatorAuth.id
    };

    console.log(`[${type}] ${message}`, data);
    setActivityLog(prev => [logEntry, ...prev].slice(0, 50)); // Keep last 50 entries
  };

  // Start timer for current step
  const startTimer = () => {
    if (timer) clearInterval(timer);
    const newTimer = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
    }, 1000);
    setTimer(newTimer);
  };

  // Handle operator authentication
  const handleOperatorAuth = (e) => {
    e.preventDefault();
    const authTime = new Date();
    setOperatorAuth({
      ...operatorAuth,
      isAuthenticated: true,
      authTime
    });

    // Log authentication
    logActivity('OPERATOR_AUTH', `Operator ${operatorAuth.name} (ID: ${operatorAuth.id}) started the task`, operatorAuth);
  };

  // API: Start broker restart task
  const startBrokerRestartTask = async (infraName, infraId, brokerRestartId = null) => {
    try {
      setLoading(true);
      
      const payload = {
        infraName,
        infraId
      };
      
      // Add brokerRestartId for sets 2,3,4
      if (brokerRestartId) {
        payload.brokerRestartId = brokerRestartId;
      }

      const url = brokerRestartId 
        ? `${API_BASE_URL}/startBrokerRestartTask/${brokerRestartId}`
        : `${API_BASE_URL}/startBrokerRestartTask`;

      const response = await axios.post(url, payload);
      
      logActivity('API_SUCCESS', `Start broker restart task successful`, response.data);
      return response.data;
    } catch (error) {
      logActivity('API_ERROR', `Failed to start broker restart task`, error.response?.data || error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // API: Get restart ID
  const getRestartId = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/getRestartId`);
      
      logActivity('API_SUCCESS', `Got restart ID: ${response.data}`, response.data);
      return response.data;
    } catch (error) {
      logActivity('API_ERROR', `Failed to get restart ID`, error.response?.data || error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Handle Set 1 start
  const handleStartSet1 = () => {
    if (currentSet !== 1) return;
    setSetStartData({
      name: '',
      id: '',
      setNumber: 1
    });
    setSetStartModal(true);
  };

  // Handle Set 1 start submission
  const handleSet1StartSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Call API to start broker restart task
      const result = await startBrokerRestartTask(setStartData.name, setStartData.id);
      
      // Update set state
      const updatedSets = [...sets];
      updatedSets[0] = {
        ...updatedSets[0],
        status: 'in-progress',
        restartId: result.restartId || 'SET1_STARTED'
      };
      setSets(updatedSets);

      // Log activity
      logActivity('SET_START', `Set 1 started by ${setStartData.name} (ID: ${setStartData.id})`, {
        setName: sets[0].name,
        startedBy: setStartData.name,
        startedById: setStartData.id,
        restartId: result.restartId
      });

      // Close modal
      setSetStartModal(false);
      setSetStartData({ name: '', id: '', setNumber: null });

      // Start timer for step 1
      setCurrentStep(1);
      setTimeElapsed(0);
      startTimer();

    } catch (error) {
      alert('Failed to start Set 1. Please try again.');
    }
  };

  // Handle Set 2,3,4 start
  const handleStartSetWithRestartId = (setNumber) => {
    if (currentSet !== setNumber) return;
    
    // First get restart ID
    const fetchRestartId = async () => {
      try {
        const restartId = await getRestartId();
        setRestartId(restartId);
        
        // Show modal with restart ID
        setSetStartData({
          name: '',
          id: '',
          setNumber: setNumber
        });
        setSetStartWithIdModal(true);
        
      } catch (error) {
        alert('Failed to get restart ID. Please try again.');
      }
    };

    fetchRestartId();
  };

  // Handle Set 2,3,4 start submission
  const handleSetWithIdStartSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Call API to start broker restart task with restart ID
      const result = await startBrokerRestartTask(
        setStartData.name, 
        setStartData.id, 
        restartId
      );
      
      // Update set state
      const setIndex = setStartData.setNumber - 1;
      const updatedSets = [...sets];
      updatedSets[setIndex] = {
        ...updatedSets[setIndex],
        status: 'in-progress',
        restartId: restartId
      };
      setSets(updatedSets);

      // Log activity
      logActivity('SET_START', `Set ${setStartData.setNumber} started by ${setStartData.name} (ID: ${setStartData.id})`, {
        setName: sets[setIndex].name,
        startedBy: setStartData.name,
        startedById: setStartData.id,
        restartId: restartId
      });

      // Close modal and reset
      setSetStartWithIdModal(false);
      setSetStartData({ name: '', id: '', setNumber: null });
      setRestartId(null);

      // If this is the first set being started, begin checklist
      if (setStartData.setNumber === currentSet) {
        setCurrentStep(1);
        setTimeElapsed(0);
        startTimer();
      }

    } catch (error) {
      alert('Failed to start set. Please try again.');
    }
  };

  // Complete step 1
  const completeStep1 = () => {
    if (currentStep !== 1) return;

    const updatedSteps = [...checklistSteps];
    updatedSteps[0] = {
      ...updatedSteps[0],
      completed: true,
      completedTime: new Date(),
      completedBy: operatorAuth.name
    };

    setChecklistSteps(updatedSteps);

    // Log step completion
    logActivity('STEP_COMPLETE', 'Step 1: CACHE UPDATED AFTER 12:00 A.M. completed', {
      completedBy: operatorAuth.name,
      time: new Date()
    });

    // Move to step 2
    setTimeout(() => {
      setCurrentStep(2);
      setTimeElapsed(0);
      startTimer();
    }, 1000);
  };

  // Complete step 2 (requires support acknowledgment)
  const completeStep2 = () => {
    if (currentStep !== 2) return;

    // Show support acknowledgment modal
    setSupportAckModal(true);
    setSupportAckData({
      name: '',
      id: '',
      setNumber: currentSet
    });
  };

  // Handle support acknowledgment submission
  const handleSupportAckSubmit = (e) => {
    e.preventDefault();

    const ackTime = new Date();

    // Update checklist step
    const updatedSteps = [...checklistSteps];
    updatedSteps[1] = {
      ...updatedSteps[1],
      completed: true,
      completedTime: ackTime,
      completedBy: operatorAuth.name,
      ackBy: supportAckData.name,
      ackTime
    };
    setChecklistSteps(updatedSteps);

    // Update current set
    const updatedSets = [...sets];
    updatedSets[currentSet - 1] = {
      ...updatedSets[currentSet - 1],
      supportAck: {
        name: supportAckData.name,
        id: supportAckData.id,
        time: ackTime
      }
    };
    setSets(updatedSets);

    // Log support acknowledgment
    logActivity('SUPPORT_ACK', `Support team acknowledged by ${supportAckData.name} (ID: ${supportAckData.id})`, {
      supportName: supportAckData.name,
      supportId: supportAckData.id,
      setNumber: currentSet,
      time: ackTime
    });

    // Close modal and reset
    setSupportAckModal(false);
    setSupportAckData({ name: '', id: '', setNumber: null });

    // Move to step 3
    setTimeout(() => {
      setCurrentStep(3);
      setTimeElapsed(0);
      startTimer();
    }, 1000);
  };

  // Complete a checklist step (for steps 3-11)
  const completeStep = (stepId) => {
    if (stepId !== currentStep || stepId <= 2) return;

    const updatedSteps = [...checklistSteps];
    const stepIndex = stepId - 1;

    updatedSteps[stepIndex] = {
      ...updatedSteps[stepIndex],
      completed: true,
      completedTime: new Date(),
      completedBy: operatorAuth.name
    };

    setChecklistSteps(updatedSteps);

    // Log step completion
    logActivity('STEP_COMPLETE', `Step ${stepId}: ${updatedSteps[stepIndex].title} completed`, {
      completedBy: operatorAuth.name,
      step: stepId,
      time: new Date()
    });

    // Move to next step after a delay
    setTimeout(() => {
      if (currentStep < checklistSteps.length) {
        setCurrentStep(currentStep + 1);
        setTimeElapsed(0);
        startTimer();
      } else {
        // All steps completed for current set
        showSetCompletionModal();
      }
    }, 1000);
  };

  // Show set completion verification modal
  const showSetCompletionModal = () => {
    setSetCompleteModal(true);
    setSetCompleteData({
      name: '',
      id: '',
      setNumber: currentSet
    });
  };

  // Handle set completion verification
  const handleSetCompleteSubmit = (e) => {
    e.preventDefault();

    const completeTime = new Date();

    // Update current set as completed
    const updatedSets = [...sets];
    updatedSets[currentSet - 1] = {
      ...updatedSets[currentSet - 1],
      status: 'completed',
      completedBy: setCompleteData.name,
      completedTime: completeTime
    };
    setSets(updatedSets);

    // Log set completion
    logActivity('SET_COMPLETE', `Set ${currentSet} completed by ${setCompleteData.name} (ID: ${setCompleteData.id})`, {
      setName: sets[currentSet - 1].name,
      completedBy: setCompleteData.name,
      completedById: setCompleteData.id,
      setNumber: currentSet,
      time: completeTime
    });

    // Close modal and reset
    setSetCompleteModal(false);
    setSetCompleteData({ name: '', id: '', setNumber: null });

    if (timer) clearInterval(timer);

    // If there are more sets, prepare for next one
    if (currentSet < sets.length) {
      // Reset checklist for next set
      const resetChecklist = checklistSteps.map(step => ({
        ...step,
        completed: false,
        completedTime: null,
        completedBy: null,
        ackBy: null,
        ackTime: null
      }));

      setTimeout(() => {
        setCurrentSet(currentSet + 1);
        setCurrentStep(1);
        setChecklistSteps(resetChecklist);
        setTimeElapsed(0);
      }, 3000);
    }
  };

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#ff7675';
      case 'in-progress': return '#74b9ff';
      case 'waiting-ack': return '#fdcb6e';
      case 'completed': return '#00b894';
      default: return '#636e72';
    }
  };

  // Get action button for each set
  const getSetActionButton = (set) => {
    if (set.status === 'pending') {
      return (
        <button
          onClick={() => {
            if (set.id === 1) {
              handleStartSet1();
            } else {
              handleStartSetWithRestartId(set.id);
            }
          }}
          className="start-set-btn"
          disabled={loading}
        >
          {loading ? 'Starting...' : 'Start Set'}
        </button>
      );
    } else if (set.status === 'in-progress') {
      return (
        <div className="set-in-progress">
          <span className="in-progress-badge">In Progress</span>
          {set.restartId && (
            <small className="restart-id">Restart ID: {set.restartId}</small>
          )}
        </div>
      );
    } else if (set.status === 'completed') {
      return (
        <div className="set-completed">
          <span className="completed-badge">Completed</span>
        </div>
      );
    }
    return null;
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [timer]);

  return (
    <div className="tasks-list-page">
      {/* Header */}
      <div className="tasks-list-header">
        <div className="header-content">
          <h1>📝 Night Broker Restart Checklist</h1>
          <p>Complete the checklist in order for each server set</p>
        </div>
        <button
          className="back-button-header"
          onClick={() => navigate('/dashboard')}
          aria-label="Go back"
        >
          ← Back
        </button>
      </div>

      {/* Operator Authentication Section */}
      {!operatorAuth.isAuthenticated ? (
        <section className="auth-section">
          <h2>🔐 Operator Authentication Required</h2>
          <div className="auth-form-container">
            <form onSubmit={handleOperatorAuth} className="auth-form">
              <div className="form-group">
                <label htmlFor="operatorName">Your Name (Operator)</label>
                <input
                  type="text"
                  id="operatorName"
                  value={operatorAuth.name}
                  onChange={(e) => setOperatorAuth({...operatorAuth, name: e.target.value})}
                  placeholder="Enter your full name"
                  required
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="operatorId">Your ADID / Employee ID</label>
                <input
                  type="text"
                  id="operatorId"
                  value={operatorAuth.id}
                  onChange={(e) => setOperatorAuth({...operatorAuth, id: e.target.value})}
                  placeholder="Enter your ADID"
                  required
                  className="form-input"
                />
              </div>
              <button type="submit" className="auth-submit-btn">
                Start Task
              </button>
            </form>
            <div className="auth-instructions">
              <h4>⚠️ Important Instructions:</h4>
              <ul>
                <li>Enter your name and ADID to start the task</li>
                <li>Each set requires individual start with API call</li>
                <li>Set 1: Start directly with name/ID</li>
                <li>Sets 2,3,4: First get Restart ID, then start</li>
                <li>Step 2 requires support team acknowledgment</li>
                <li>Each set completion requires verification</li>
              </ul>
            </div>
          </div>
        </section>
      ) : (
        <>
          {/* Operator Info Banner */}
          <div className="user-info-banner">
            <div className="user-info-content">
              <span className="user-label">👤 Current Operator:</span>
              <span className="user-name">{operatorAuth.name}</span>
              <span className="user-id">(ADID: {operatorAuth.id})</span>
              <span className="user-time">
                Started: {format(operatorAuth.authTime, 'MMM d, h:mm a')}
              </span>
            </div>
            <div className="current-timer">
              ⏱️ Current Step Time: {formatTime(timeElapsed)}
            </div>
          </div>

          {/* Server Sets Progress */}
          <section className="sets-section">
            <h2>📊 Server Sets Progress</h2>
            <div className="sets-grid">
              {sets.map((set) => (
                <div
                  key={set.id}
                  className={`set-card ${currentSet === set.id ? 'active' : ''} ${set.status}`}
                  style={{ borderLeft: `4px solid ${getStatusColor(set.status)}` }}
                >
                  <div className="set-header">
                    <h3>{set.name}</h3>
                    <span className="set-status" style={{ color: getStatusColor(set.status) }}>
                      {set.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="set-servers">
                    <strong>Servers:</strong> {set.servers}
                  </div>

                  {/* Set Action Button */}
                  <div className="set-action">
                    {getSetActionButton(set)}
                  </div>

                  {set.restartId && (
                    <div className="set-restart-id">
                      <strong>🔑 Restart ID:</strong> {set.restartId}
                    </div>
                  )}

                  {set.supportAck && (
                    <div className="set-support-ack">
                      <strong>🛡️ Support Acknowledgment:</strong>
                      <div>{set.supportAck.name} (ID: {set.supportAck.id})</div>
                      <small>{format(new Date(set.supportAck.time), 'MMM d, h:mm:ss a')}</small>
                    </div>
                  )}

                  {set.completedBy && (
                    <div className="set-completion-info">
                      <strong>✅ Completed by:</strong>
                      <div>{set.completedBy}</div>
                      <small>{format(new Date(set.completedTime), 'MMM d, h:mm:ss a')}</small>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="current-set-info">
              <h3>Currently Working On: <span className="set-highlight">{sets[currentSet - 1].name}</span></h3>
              <div className="set-progress-info">
                <span>Set {currentSet} of {sets.length}</span>
                <span>•</span>
                <span>Step {currentStep} of {checklistSteps.length}</span>
                {sets[currentSet - 1].status === 'in-progress' && sets[currentSet - 1].restartId && (
                  <>
                    <span>•</span>
                    <span>Restart ID: {sets[currentSet - 1].restartId}</span>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Set 1 Start Modal */}
          {setStartModal && (
            <div className="modal-overlay">
              <div className="modal-container">
                <div className="modal-header">
                  <h2>🚀 Start Set 1</h2>
                  <p>Enter your details to start Set 1 (25 Series - Set 1)</p>
                </div>

                <div className="modal-instructions">
                  <p>This will call the API: <code>/startBrokerRestartTask</code> with your details as payload</p>
                  <div className="api-info">
                    <strong>Payload:</strong> infraName, infraId
                  </div>
                </div>

                <form onSubmit={handleSet1StartSubmit} className="modal-form">
                  <div className="form-group">
                    <label htmlFor="set1Name">Your Name</label>
                    <input
                      type="text"
                      id="set1Name"
                      value={setStartData.name}
                      onChange={(e) => setStartData({...setStartData, name: e.target.value})}
                      placeholder="Enter your name"
                      required
                      className="form-input"
                      disabled={loading}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="set1Id">Your ADID / Employee ID</label>
                    <input
                      type="text"
                      id="set1Id"
                      value={setStartData.id}
                      onChange={(e) => setStartData({...setStartData, id: e.target.value})}
                      placeholder="Enter your ADID"
                      required
                      className="form-input"
                      disabled={loading}
                    />
                  </div>
                  <div className="modal-actions">
                    <button 
                      type="button" 
                      onClick={() => setSetStartModal(false)} 
                      className="btn-secondary"
                      disabled={loading}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary" disabled={loading}>
                      {loading ? 'Starting...' : 'Start Set 1'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Set 2,3,4 Start Modal (with Restart ID) */}
          {setStartWithIdModal && (
            <div className="modal-overlay">
              <div className="modal-container">
                <div className="modal-header">
                  <h2>🚀 Start Set {setStartData.setNumber}</h2>
                  <p>Enter your details to start Set {setStartData.setNumber}</p>
                </div>

                <div className="modal-instructions">
                  <p>Restart ID obtained: <strong>{restartId}</strong></p>
                  <p>This will call the API: <code>/startBrokerRestartTask/{restartId}</code></p>
                  <div className="api-info">
                    <strong>Payload:</strong> infraName, infraId, brokerRestartId
                  </div>
                </div>

                <form onSubmit={handleSetWithIdStartSubmit} className="modal-form">
                  <div className="form-group">
                    <label htmlFor="setWithIdName">Your Name</label>
                    <input
                      type="text"
                      id="setWithIdName"
                      value={setStartData.name}
                      onChange={(e) => setStartData({...setStartData, name: e.target.value})}
                      placeholder="Enter your name"
                      required
                      className="form-input"
                      disabled={loading}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="setWithIdId">Your ADID / Employee ID</label>
                    <input
                      type="text"
                      id="setWithIdId"
                      value={setStartData.id}
                      onChange={(e) => setStartData({...setStartData, id: e.target.value})}
                      placeholder="Enter your ADID"
                      required
                      className="form-input"
                      disabled={loading}
                    />
                  </div>
                  <div className="modal-actions">
                    <button 
                      type="button" 
                      onClick={() => setSetStartWithIdModal(false)} 
                      className="btn-secondary"
                      disabled={loading}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary" disabled={loading}>
                      {loading ? 'Starting...' : `Start Set ${setStartData.setNumber}`}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Support Acknowledgment Modal */}
          {supportAckModal && (
            <div className="modal-overlay">
              <div className="modal-container">
                <div className="modal-header">
                  <h2>🛡️ Support Team Acknowledgment Required</h2>
                  <p>Step 2 requires support team acknowledgment before proceeding</p>
                </div>

                <div className="modal-instructions">
                  <p>Please enter the support team member's details who acknowledged the activity start:</p>
                </div>

                <form onSubmit={handleSupportAckSubmit} className="modal-form">
                  <div className="form-group">
                    <label htmlFor="supportName">Support Team Member Name</label>
                    <input
                      type="text"
                      id="supportName"
                      value={supportAckData.name}
                      onChange={(e) => setSupportAckData({...supportAckData, name: e.target.value})}
                      placeholder="Enter support team member name"
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="supportId">Support Team Member ADID/Employee ID</label>
                    <input
                      type="text"
                      id="supportId"
                      value={supportAckData.id}
                      onChange={(e) => setSupportAckData({...supportAckData, id: e.target.value})}
                      placeholder="Enter support team member ID"
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="modal-actions">
                    <button type="button" onClick={() => setSupportAckModal(false)} className="btn-secondary">
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary">
                      Acknowledge & Continue
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Set Completion Verification Modal */}
          {setCompleteModal && (
            <div className="modal-overlay">
              <div className="modal-container">
                <div className="modal-header">
                  <h2>✅ Set Completion Verification</h2>
                  <p>Set {currentSet} completed. Please verify completion.</p>
                </div>

                <div className="modal-instructions">
                  <p>Enter your name and ADID to verify set completion:</p>
                  <div className="set-info">
                    <strong>Set {currentSet}:</strong> {sets[currentSet - 1].name}
                  </div>
                </div>

                <form onSubmit={handleSetCompleteSubmit} className="modal-form">
                  <div className="form-group">
                    <label htmlFor="completeName">Your Name</label>
                    <input
                      type="text"
                      id="completeName"
                      value={setCompleteData.name}
                      onChange={(e) => setSetCompleteData({...setCompleteData, name: e.target.value})}
                      placeholder="Enter your name"
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="completeId">Your ADID / Employee ID</label>
                    <input
                      type="text"
                      id="completeId"
                      value={setCompleteData.id}
                      onChange={(e) => setSetCompleteData({...setCompleteData, id: e.target.value})}
                      placeholder="Enter your ADID"
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="modal-actions">
                    <button type="button" onClick={() => setSetCompleteModal(false)} className="btn-secondary">
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary">
                      Verify & Complete Set
                    </button>
                  </div>
                </form>

                <div className="modal-note">
                  <small>💡 Note: Different operators can verify different sets. This allows multiple people to work on the same task.</small>
                </div>
              </div>
            </div>
          )}

          {/* Checklist Timeline (Only show if current set is in progress) */}
          {sets[currentSet - 1].status === 'in-progress' && (
            <section className="checklist-section">
              <h2>📋 Restart Procedure Checklist</h2>
              <div className="timeline-container">
                {checklistSteps.map((step, index) => (
                  <div
                    key={step.id}
                    className={`timeline-step ${step.completed ? 'completed' : ''} ${currentStep === step.id ? 'current' : ''}`}
                  >
                    <div className="step-marker">
                      <div className="step-number">{step.id}</div>
                      {index < checklistSteps.length - 1 && (
                        <div className="step-connector"></div>
                      )}
                    </div>
                    <div className="step-content">
                      <div className="step-header">
                        <h3>{step.title}</h3>
                        <div className="step-status">
                          {step.completed ? (
                            <span className="status-completed">✅ Completed</span>
                          ) : currentStep === step.id ? (
                            <span className="status-current">⏳ In Progress</span>
                          ) : (
                            <span className="status-pending">⏱️ Pending</span>
                          )}
                        </div>
                      </div>
                      <p className="step-description">{step.description}</p>

                      {step.completed && (
                        <div className="step-details">
                          <div className="detail-item">
                            <strong>Completed by:</strong> {step.completedBy}
                          </div>
                          <div className="detail-item">
                            <strong>Time:</strong> {format(new Date(step.completedTime), 'MMM d, h:mm:ss a')}
                          </div>
                          {step.requiresAck && step.ackBy && (
                            <div className="detail-item ack-info">
                              <strong>✅ Support Acknowledgment by:</strong> {step.ackBy}
                              <br />
                              <small>{format(new Date(step.ackTime), 'MMM d, h:mm:ss a')}</small>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Step Actions */}
                      {currentStep === step.id && !step.completed && (
                        <div className="step-actions">
                          {step.id === 1 ? (
                            <button
                              onClick={completeStep1}
                              className="complete-btn"
                            >
                              Mark as Complete
                            </button>
                          ) : step.id === 2 ? (
                            <button
                              onClick={completeStep2}
                              className="complete-btn"
                            >
                              Enter Support Acknowledgment
                            </button>
                          ) : (
                            <button
                              onClick={() => completeStep(step.id)}
                              className="complete-btn"
                            >
                              Mark as Complete
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Activity Log */}
          {activityLog.length > 0 && (
            <section className="activity-log-section">
              <h2>📜 Activity Log</h2>
              <div className="activity-log-container">
                {activityLog.slice(0, 10).map((log, index) => (
                  <div key={index} className="log-entry">
                    <div className="log-time">
                      {format(new Date(log.timestamp), 'HH:mm:ss')}
                    </div>
                    <div className="log-message">
                      {log.message}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Progress Summary */}
          <section className="progress-section">
            <h2>📈 Progress Summary</h2>
            <div className="progress-stats">
              <div className="progress-stat">
                <span className="stat-label">Current Set</span>
                <span className="stat-value">{currentSet} of {sets.length}</span>
              </div>
              <div className="progress-stat">
                <span className="stat-label">Completed Steps</span>
                <span className="stat-value">
                  {checklistSteps.filter(s => s.completed).length} of {checklistSteps.length}
                </span>
              </div>
              <div className="progress-stat">
                <span className="stat-label">Current Step Time</span>
                <span className="stat-value">{formatTime(timeElapsed)}</span>
              </div>
              <div className="progress-stat">
                <span className="stat-label">Completed Sets</span>
                <span className="stat-value">
                  {sets.filter(s => s.status === 'completed').length} of {sets.length}
                </span>
              </div>
            </div>

            {sets.every(set => set.status === 'completed') && (
              <div className="completion-message">
                <h3>🎉 All Tasks Completed Successfully!</h3>
                <p>All 4 server sets have been processed. Night Broker Restart procedure is complete.</p>

                <div className="completion-summary">
                  <h4>Completion Summary:</h4>
                  <ul>
                    {sets.map(set => (
                      <li key={set.id}>
                        <strong>{set.name}:</strong> 
                        {set.restartId && ` [Restart ID: ${set.restartId}] `}
                        Completed by {set.completedBy} at {format(new Date(set.completedTime), 'h:mm a')}
                      </li>
                    ))}
                  </ul>
                </div>

                <button onClick={() => navigate('/dashboard')} className="btn-primary">
                  Return to Dashboard
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default TasksList;
