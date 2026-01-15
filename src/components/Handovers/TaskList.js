import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import './TasksList.css';
import { getRestartId, startBrokerRestartTask } from '../../Api/HandOverApi';

const TasksList = () => {
  // State for main operator authentication
  const [operatorAuth, setOperatorAuth] = useState({
    name: '',
    id: '',
    isAuthenticated: false,
    authTime: null,
    selectedSet: null,
    loading: false
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

  // State for current set
  const [currentSet, setCurrentSet] = useState(null);
  const [sets, setSets] = useState([
    {
      id: 1,
      name: '25 Series - Set 1',
      servers: '155, 156, 157, 173, 174, 73, 74, 55, 56, 57, 63, 64, 163, 164, 10, 11, 12, 110, 111, 112, 41, 42, 43, 141, 142, 143, 31, 32, 134, 135, 192, 196, 197, 68, 69, 168, 169',
      status: 'pending',
      supportAck: null,
      completedBy: null,
      completedTime: null,
      restartId: null,
      apiCallMade: false
    },
    {
      id: 2,
      name: '25 Series - Set 2',
      servers: '158, 159, 160, 175, 176, 75, 58, 59, 65, 66, 67, 165, 166, 13, 14, 113, 114, 115, 44, 45, 144, 145, 146, 33, 34, 131, 132, 133, 190, 191, 194, 195, 70, 71, 170, 171',
      status: 'pending',
      supportAck: null,
      completedBy: null,
      completedTime: null,
      restartId: null,
      apiCallMade: false
    },
    {
      id: 3,
      name: '24 Series - Set 3',
      servers: '158, 159, 160, 175, 176, 75, 58, 59, 65, 66, 67, 165, 166, 13, 14, 113, 114, 115, 44, 45, 144, 145, 146, 33, 34, 131, 132, 133, 190, 191, 194, 195, 70, 71, 170, 171',
      status: 'pending',
      supportAck: null,
      completedBy: null,
      completedTime: null,
      restartId: null,
      apiCallMade: false
    },
    {
      id: 4,
      name: '24 Series - Set 4',
      servers: '155, 156, 157, 173, 174, 73, 74, 55, 56, 57, 63, 64, 163, 164, 10, 11, 12, 110, 111, 112, 41, 42, 43, 141, 142, 143, 31, 32, 134, 135, 192, 196, 197, 68, 69, 168, 169',
      status: 'pending',
      supportAck: null,
      completedBy: null,
      completedTime: null,
      restartId: null,
      apiCallMade: false
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

  // Handle set card click - show auth modal for that set
  const handleSetCardClick = (setId) => {
    const selectedSet = sets.find(s => s.id === setId);
    if (selectedSet.status === 'completed') return;
    
    setOperatorAuth({
      ...operatorAuth,
      selectedSet: setId
    });
  };

  // Handle operator authentication with API integration
  const handleOperatorAuth = async (e) => {
    e.preventDefault();
    
    const authTime = new Date();
    const selectedSetId = operatorAuth.selectedSet;
    
    setOperatorAuth({
      ...operatorAuth,
      loading: true
    });

    try {
      logActivity('AUTH_START', `Operator ${operatorAuth.name} (ID: ${operatorAuth.id}) attempting to start Set ${selectedSetId}`, operatorAuth);

      let restartId = null;
      
      // For Set 1: No restart ID needed
      if (selectedSetId === 1) {
        logActivity('SET_START', 'Starting Set 1 - No restart ID required');
      } 
      // For Sets 2, 3, 4: Get restart ID first
      else {
        logActivity('SET_START', `Starting Set ${selectedSetId} - Fetching restart ID...`);
        
        const restartIdResponse = await getRestartId();
        restartId = restartIdResponse.restartId;
        
        if (!restartId) {
          logActivity('API_ERROR', 'Failed to get restart ID');
          setOperatorAuth({
            ...operatorAuth,
            loading: false
          });
          return;
        }
        
        logActivity('API_SUCCESS', `Restart ID received: ${restartId}`);
        
        // Update set with restart ID
        const updatedSets = [...sets];
        updatedSets[selectedSetId - 1] = {
          ...updatedSets[selectedSetId - 1],
          restartId: restartId
        };
        setSets(updatedSets);
      }

      // Start the broker restart task via API
      await startBrokerRestartTask(operatorAuth.id, operatorAuth.name, restartId);
      
      logActivity('API_SUCCESS', 'Broker restart task started successfully');

      // Update operator auth state
      setOperatorAuth({
        ...operatorAuth,
        isAuthenticated: true,
        authTime,
        loading: false
      });

      setCurrentSet(selectedSetId);

      // Update set status to in-progress
      const updatedSets = [...sets];
      updatedSets[selectedSetId - 1] = {
        ...updatedSets[selectedSetId - 1],
        status: 'in-progress',
        apiCallMade: true
      };
      setSets(updatedSets);

      logActivity('AUTH_SUCCESS', `Operator ${operatorAuth.name} (ID: ${operatorAuth.id}) successfully started Set ${selectedSetId}`, {
        restartId,
        authTime
      });

      // Start timer for step 1
      startTimer();

    } catch (error) {
      logActivity('AUTH_FAILED', `Failed to authenticate operator for Set ${selectedSetId}: ${error.message}`);
      setOperatorAuth({
        ...operatorAuth,
        loading: false
      });
    }
  };

  // Start timer for current step
  const startTimer = () => {
    if (timer) clearInterval(timer);
    const newTimer = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
    }, 1000);
    setTimer(newTimer);
  };

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
    setActivityLog(prev => [logEntry, ...prev].slice(0, 50));
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

    logActivity('STEP_COMPLETE', 'Step 1: CACHE UPDATED AFTER 12:00 A.M. completed', {
      completedBy: operatorAuth.name,
      time: new Date()
    });

    setTimeout(() => {
      setCurrentStep(2);
      setTimeElapsed(0);
      startTimer();
    }, 1000);
  };

  // Complete step 2 (requires support acknowledgment)
  const completeStep2 = () => {
    if (currentStep !== 2) return;

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

    logActivity('SUPPORT_ACK', `Support team acknowledged by ${supportAckData.name} (ID: ${supportAckData.id})`, {
      supportName: supportAckData.name,
      supportId: supportAckData.id,
      setNumber: currentSet,
      time: ackTime
    });

    setSupportAckModal(false);
    setSupportAckData({ name: '', id: '', setNumber: null });

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

    logActivity('STEP_COMPLETE', `Step ${stepId}: ${updatedSteps[stepIndex].title} completed`, {
      completedBy: operatorAuth.name,
      step: stepId,
      time: new Date()
    });

    setTimeout(() => {
      if (currentStep < checklistSteps.length) {
        setCurrentStep(currentStep + 1);
        setTimeElapsed(0);
        startTimer();
      } else {
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

    const updatedSets = [...sets];
    updatedSets[currentSet - 1] = {
      ...updatedSets[currentSet - 1],
      status: 'completed',
      completedBy: setCompleteData.name,
      completedTime: completeTime
    };
    setSets(updatedSets);

    logActivity('SET_COMPLETE', `Set ${currentSet} completed by ${setCompleteData.name} (ID: ${setCompleteData.id})`, {
      setName: sets[currentSet - 1].name,
      completedBy: setCompleteData.name,
      completedById: setCompleteData.id,
      setNumber: currentSet,
      time: completeTime
    });

    setSetCompleteModal(false);
    setSetCompleteData({ name: '', id: '', setNumber: null });

    if (timer) clearInterval(timer);

    // Reset for next set
    const resetChecklist = checklistSteps.map(step => ({
      ...step,
      completed: false,
      completedTime: null,
      completedBy: null,
      ackBy: null,
      ackTime: null
    }));

    setChecklistSteps(resetChecklist);
    setCurrentSet(null);
    setCurrentStep(1);
    setTimeElapsed(0);
    setOperatorAuth({
      name: '',
      id: '',
      isAuthenticated: false,
      authTime: null,
      selectedSet: null,
      loading: false
    });
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
          <p>Click on a server set to begin the restart procedure</p>
        </div>
      </div>

      {/* Server Sets Progress - Always visible */}
      <section className="sets-section">
        <h2>📊 Server Sets Progress</h2>
        <div className="sets-grid">
          {sets.map((set) => (
            <button
              key={set.id}
              onClick={() => handleSetCardClick(set.id)}
              disabled={set.status === 'completed'}
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

              {set.restartId && (
                <div className="set-restart-id">
                  <strong>🔄 Restart ID:</strong> {set.restartId}
                </div>
              )}

              {set.apiCallMade && (
                <div className="api-indicator">
                  <span className="api-success">✅ API Call Made</span>
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

              {set.status === 'pending' && (
                <div className="set-start-hint">
                  👆 Click to start this set
                </div>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Operator Authentication Modal */}
      {operatorAuth.selectedSet && !operatorAuth.isAuthenticated && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h2>🔐 Operator Authentication Required</h2>
              <p>Starting work on {sets[operatorAuth.selectedSet - 1].name}</p>
            </div>

            <div className="api-info-note">
              {operatorAuth.selectedSet === 1 ? (
                <p>📝 <strong>Set 1:</strong> API call will be made with infraID and infraName only</p>
              ) : (
                <p>📝 <strong>Set {operatorAuth.selectedSet}:</strong> First get restart ID, then call API with restart ID + infraID + infraName</p>
              )}
            </div>

            <form onSubmit={handleOperatorAuth} className="modal-form">
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
                  disabled={operatorAuth.loading}
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
                  disabled={operatorAuth.loading}
                />
              </div>
              <div className="modal-actions">
                <button 
                  type="button" 
                  onClick={() => setOperatorAuth({
                    ...operatorAuth,
                    selectedSet: null,
                    loading: false
                  })}
                  className="btn-secondary"
                  disabled={operatorAuth.loading}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={operatorAuth.loading}>
                  {operatorAuth.loading ? 'Starting Task...' : 'Start Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Active Work Section - Only shown when authenticated */}
      {operatorAuth.isAuthenticated && currentSet && (
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

          <div className="current-set-info">
            <h3>Currently Working On: <span className="set-highlight">{sets[currentSet - 1].name}</span></h3>
            {sets[currentSet - 1].restartId && (
              <div className="restart-id-display">
                <strong>Restart ID:</strong> {sets[currentSet - 1].restartId}
              </div>
            )}
            <div className="set-progress-info">
              <span>Set {currentSet} of {sets.length}</span>
              <span>•</span>
              <span>Step {currentStep} of {checklistSteps.length}</span>
            </div>
          </div>

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

          {/* Checklist Timeline */}
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

            

                    {currentStep === step.id && !step.completed && (
                      <div className="step-actions">
                        {step.id === 1 ? (
                          <button onClick={completeStep1} className="complete-btn">
                            Mark as Complete
                          </button>
                        ) : step.id === 2 ? (
                          <button onClick={completeStep2} className="complete-btn">
                            Enter Support Acknowledgment
                          </button>
                        ) : (
                          <button onClick={() => completeStep(step.id)} className="complete-btn">
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
                    {log.type.includes('API') && (
                      <div className={`log-type ${log.type.includes('SUCCESS') ? 'api-success' : log.type.includes('ERROR') ? 'api-error' : 'api-call'}`}>
                        {log.type.includes('SUCCESS') ? 'SUCCESS' : log.type.includes('ERROR') ? 'ERROR' : 'API'}
                      </div>
                    )}
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
          </section>
        </>
      )}

      {/* Completion Summary */}
      {sets.every(set => set.status === 'completed') && (
        <div className="completion-message">
          <h3>🎉 All Tasks Completed Successfully!</h3>
          <p>All 4 server sets have been processed. Night Broker Restart procedure is complete.</p>
          <div className="completion-summary">
            <h4>Completion Summary:</h4>
            <ul>
              {sets.map(set => (
                <li key={set.id}>
                  <strong>{set.name}:</strong> Completed by {set.completedBy} at {format(new Date(set.completedTime), 'h:mm a')}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default TasksList;
