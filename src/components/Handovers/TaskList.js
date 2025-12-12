// TasksList.js - Updated with better support acknowledgment
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import './TasksList.css';

const TasksList = () => {
  const navigate = useNavigate();
  
  // State for user authentication
  const [userAuth, setUserAuth] = useState({
    name: '',
    id: '',
    isAuthenticated: false,
    authTime: null
  });
  
  // State for support acknowledgment
  const [supportAckPending, setSupportAckPending] = useState(false);
  const [generatedAckCode, setGeneratedAckCode] = useState('');
  const [supportAckInput, setSupportAckInput] = useState('');
  const [supportAckDetails, setSupportAckDetails] = useState(null);
  
  // State for current set
  const [currentSet, setCurrentSet] = useState(1);
  const [sets, setSets] = useState([
    { 
      id: 1, 
      name: '25 Series - Set 1',
      servers: '155, 156, 157, 173, 174, 73, 74, 55, 56, 57, 63, 64, 163, 164, 10, 11, 12, 110, 111, 112, 41, 42, 43, 141, 142, 143, 31, 32, 134, 135, 192, 196, 197, 68, 69, 168, 169',
      status: 'pending',
      supportAck: null,
      ackCode: ''
    },
    { 
      id: 2, 
      name: '25 Series - Set 2',
      servers: '158, 159, 160, 175, 176, 75, 58, 59, 65, 66, 67, 165, 166, 13, 14, 113, 114, 115, 44, 45, 144, 145, 146, 33, 34, 131, 132, 133, 190, 191, 194, 195, 70, 71, 170, 171',
      status: 'pending',
      supportAck: null,
      ackCode: ''
    },
    { 
      id: 3, 
      name: '24 Series - Set 3',
      servers: '158, 159, 160, 175, 176, 75, 58, 59, 65, 66, 67, 165, 166, 13, 14, 113, 114, 115, 44, 45, 144, 145, 146, 33, 34, 131, 132, 133, 190, 191, 194, 195, 70, 71, 170, 171',
      status: 'pending',
      supportAck: null,
      ackCode: ''
    },
    { 
      id: 4, 
      name: '24 Series - Set 4',
      servers: '155, 156, 157, 173, 174, 73, 74, 55, 56, 57, 63, 64, 163, 164, 10, 11, 12, 110, 111, 112, 41, 42, 43, 141, 142, 143, 31, 32, 134, 135, 192, 196, 197, 68, 69, 168, 169',
      status: 'pending',
      supportAck: null,
      ackCode: ''
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
      ackCode: '',
      ackBy: null,
      ackTime: null,
      ackMethod: 'support' // 'support' or 'operator'
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

  // Handle user authentication
  const handleUserAuth = (e) => {
    e.preventDefault();
    const authTime = new Date();
    setUserAuth({
      ...userAuth,
      isAuthenticated: true,
      authTime
    });
    
    console.log('User Authentication:', {
      name: userAuth.name,
      id: userAuth.id,
      authTime: format(authTime, 'MMM d, yyyy h:mm:ss a')
    });
    
    // Start timer for step 1
    startTimer();
  };

  // Start timer for current step
  const startTimer = () => {
    if (timer) clearInterval(timer);
    const newTimer = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
    }, 1000);
    setTimer(newTimer);
  };

  // Generate acknowledgment code
  const generateAckCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `ACK-${code}`;
  };

  // Complete step 1 and initiate support notification
  const completeStep1 = () => {
    if (currentStep !== 1) return;
    
    const updatedSteps = [...checklistSteps];
    updatedSteps[0] = {
      ...updatedSteps[0],
      completed: true,
      completedTime: new Date(),
      completedBy: userAuth.name
    };
    
    setChecklistSteps(updatedSteps);
    
    // Generate acknowledgment code for support team
    const ackCode = generateAckCode();
    setGeneratedAckCode(ackCode);
    
    // Update step 2 with acknowledgment code
    updatedSteps[1].ackCode = ackCode;
    setChecklistSteps(updatedSteps);
    
    // Update current set with acknowledgment code
    const updatedSets = [...sets];
    updatedSets[currentSet - 1].ackCode = ackCode;
    updatedSets[currentSet - 1].status = 'waiting-ack';
    setSets(updatedSets);
    
    // Set support acknowledgment as pending
    setSupportAckPending(true);
    
    // Show notification to inform support team
    console.log('INFORM SUPPORT TEAM:', {
      message: `Night Broker Restart Activity Started for ${sets[currentSet - 1].name}`,
      ackCode: ackCode,
      operator: userAuth.name,
      operatorId: userAuth.id,
      time: format(new Date(), 'MMM d, yyyy h:mm:ss a'),
      servers: sets[currentSet - 1].servers
    });
    
    alert(`✅ Step 1 completed!\n\n📞 Please inform support team with this code:\n\n🔑 ${ackCode}\n\nSupport team should acknowledge using this code to proceed.`);
    
    // Stay on step 2 (waiting for support acknowledgment)
    setCurrentStep(2);
    setTimeElapsed(0);
    startTimer();
  };

  // Complete step 2 (when support acknowledges)
  const completeStep2 = () => {
    if (currentStep !== 2) return;
    
    // In real implementation, this would be called by support team
    // For simulation, we'll show a modal for support acknowledgment
    
    setSupportAckPending(true);
  };

  // Simulate support team acknowledgment (for demo purposes)
  const simulateSupportAck = () => {
    const supportName = `Support-${Math.floor(Math.random() * 1000)}`;
    const supportId = `SID${Math.floor(Math.random() * 10000)}`;
    const ackTime = new Date();
    
    const ackDetails = {
      name: supportName,
      id: supportId,
      ackTime,
      code: generatedAckCode,
      set: sets[currentSet - 1].name
    };
    
    setSupportAckDetails(ackDetails);
    
    // Update checklist steps
    const updatedSteps = [...checklistSteps];
    updatedSteps[1] = {
      ...updatedSteps[1],
      completed: true,
      completedTime: ackTime,
      completedBy: userAuth.name,
      ackBy: supportName,
      ackTime
    };
    setChecklistSteps(updatedSteps);
    
    // Update current set
    const updatedSets = [...sets];
    updatedSets[currentSet - 1] = {
      ...updatedSets[currentSet - 1],
      status: 'in-progress',
      supportAck: ackDetails
    };
    setSets(updatedSets);
    
    // Reset support acknowledgment state
    setSupportAckPending(false);
    setGeneratedAckCode('');
    setSupportAckInput('');
    
    // Log support acknowledgment
    console.log('SUPPORT TEAM ACKNOWLEDGMENT:', ackDetails);
    
    // Move to next step
    setTimeout(() => {
      setCurrentStep(3);
      setTimeElapsed(0);
      startTimer();
    }, 2000);
  };

  // Complete a checklist step (for steps other than 1 and 2)
  const completeStep = (stepId) => {
    if (stepId !== currentStep || stepId <= 2) return;
    
    const updatedSteps = [...checklistSteps];
    const stepIndex = stepId - 1;
    
    updatedSteps[stepIndex] = {
      ...updatedSteps[stepIndex],
      completed: true,
      completedTime: new Date(),
      completedBy: userAuth.name
    };
    
    setChecklistSteps(updatedSteps);
    
    // Move to next step after a delay
    setTimeout(() => {
      if (currentStep < checklistSteps.length) {
        setCurrentStep(currentStep + 1);
        setTimeElapsed(0);
        startTimer();
      } else {
        // All steps completed for current set
        completeCurrentSet();
      }
    }, 2000);
  };

  // Complete current set
  const completeCurrentSet = () => {
    const updatedSets = [...sets];
    updatedSets[currentSet - 1].status = 'completed';
    setSets(updatedSets);
    
    if (timer) clearInterval(timer);
    
    // If there are more sets, prepare for next one
    if (currentSet < sets.length) {
      setTimeout(() => {
        setCurrentSet(currentSet + 1);
        setCurrentStep(1);
        setChecklistSteps(checklistSteps.map(step => ({
          ...step,
          completed: false,
          completedTime: null,
          completedBy: null,
          ackBy: null,
          ackTime: null,
          ackCode: ''
        })));
        setSupportAckDetails(null);
        setTimeElapsed(0);
        startTimer();
      }, 5000);
    }
  };

  // Handle support acknowledgment code input
  const handleSupportAckSubmit = (e) => {
    e.preventDefault();
    
    if (supportAckInput === generatedAckCode) {
      simulateSupportAck();
    } else {
      alert('❌ Invalid acknowledgment code. Please check with support team.');
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

      {/* User Authentication Section */}
      {!userAuth.isAuthenticated ? (
        <section className="auth-section">
          <h2>🔐 User Authentication Required</h2>
          <div className="auth-form-container">
            <form onSubmit={handleUserAuth} className="auth-form">
              <div className="form-group">
                <label htmlFor="userName">Your Name</label>
                <input
                  type="text"
                  id="userName"
                  value={userAuth.name}
                  onChange={(e) => setUserAuth({...userAuth, name: e.target.value})}
                  placeholder="Enter your full name"
                  required
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="userId">User ID / ADID</label>
                <input
                  type="text"
                  id="userId"
                  value={userAuth.id}
                  onChange={(e) => setUserAuth({...userAuth, id: e.target.value})}
                  placeholder="Enter your user ID"
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
                <li>Enter your name and ID to start the task</li>
                <li>Complete steps in sequential order</li>
                <li>Step 2 requires support team acknowledgment</li>
                <li>Do not skip any steps</li>
              </ul>
            </div>
          </div>
        </section>
      ) : (
        <>
          {/* User Info Banner */}
          <div className="user-info-banner">
            <div className="user-info-content">
              <span className="user-label">👤 Current Operator:</span>
              <span className="user-name">{userAuth.name}</span>
              <span className="user-id">(ID: {userAuth.id})</span>
              <span className="user-time">
                Started: {format(userAuth.authTime, 'MMM d, h:mm a')}
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
                  {set.ackCode && (
                    <div className="ack-code-display">
                      <strong>🔑 Acknowledgment Code:</strong>
                      <div className="ack-code">{set.ackCode}</div>
                      <small>Share this code with support team</small>
                    </div>
                  )}
                  {set.supportAck && (
                    <div className="set-ack-info">
                      <strong>✅ Acknowledged by Support:</strong>
                      <div>{set.supportAck.name} (ID: {set.supportAck.id})</div>
                      <small>{format(new Date(set.supportAck.ackTime), 'MMM d, h:mm:ss a')}</small>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="current-set-info">
              <h3>Currently Working On: <span className="set-highlight">{sets[currentSet - 1].name}</span></h3>
              {sets[currentSet - 1].ackCode && !sets[currentSet - 1].supportAck && (
                <div className="ack-pending-alert">
                  ⚠️ Waiting for support team acknowledgment
                  <div className="ack-code-large">{sets[currentSet - 1].ackCode}</div>
                </div>
              )}
            </div>
          </section>

          {/* Support Acknowledgment Modal */}
          {supportAckPending && (
            <div className="modal-overlay">
              <div className="modal-container">
                <div className="modal-header">
                  <h2>🛡️ Support Team Acknowledgment Required</h2>
                  <p>Support team must acknowledge before proceeding to step 3</p>
                </div>
                
                <div className="support-instructions">
                  <h3>📞 How to get support acknowledgment:</h3>
                  <ol>
                    <li>Contact support team via phone/chat</li>
                    <li>Provide them with the acknowledgment code</li>
                    <li>Support team will acknowledge using their system</li>
                    <li>Once acknowledged, enter the code below</li>
                  </ol>
                  
                  <div className="ack-code-display-modal">
                    <strong>Acknowledgment Code:</strong>
                    <div className="ack-code-modal">{generatedAckCode}</div>
                    <small>Share this code with support team</small>
                  </div>
                </div>
                
                <form onSubmit={handleSupportAckSubmit} className="modal-form">
                  <div className="form-group">
                    <label htmlFor="ackCode">Enter Acknowledgment Code from Support</label>
                    <input
                      type="text"
                      id="ackCode"
                      value={supportAckInput}
                      onChange={(e) => setSupportAckInput(e.target.value.toUpperCase())}
                      placeholder="Enter ACK-XXXXXX code"
                      required
                      className="form-input"
                      style={{ textAlign: 'center', letterSpacing: '2px', fontSize: '1.1rem' }}
                    />
                  </div>
                  <div className="modal-actions">
                    <button type="button" onClick={() => setSupportAckPending(false)} className="btn-secondary">
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary">
                      Verify & Continue
                    </button>
                  </div>
                </form>
                
                <div className="simulation-note">
                  <small>💡 For simulation: Support team would acknowledge separately. Here you can enter the code above.</small>
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
                    
                    {/* Special content for step 2 */}
                    {step.id === 2 && step.ackCode && !step.completed && (
                      <div className="step-ack-required">
                        <div className="ack-waiting">
                          <strong>🛡️ Support Acknowledgment Required</strong>
                          <div className="ack-code-step">{step.ackCode}</div>
                          <small>Share this code with support team for acknowledgment</small>
                        </div>
                      </div>
                    )}
                    
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
                            <strong>✅ Support Acknowledgment:</strong> {step.ackBy}
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
                            Mark as Complete & Generate Support Code
                          </button>
                        ) : step.id === 2 ? (
                          <button
                            onClick={() => setSupportAckPending(true)}
                            className="complete-btn"
                            disabled={!step.ackCode}
                          >
                            {step.ackCode ? 'Enter Support Acknowledgment' : 'Waiting for code generation...'}
                          </button>
                        ) : (
                          <button
                            onClick={() => completeStep(step.id)}
                            className="complete-btn"
                          >
                            Mark as Complete
                          </button>
                        )}
                        
                        {step.id === 2 && step.ackCode && (
                          <div className="ack-required-note">
                            ⚠️ Requires support team acknowledgment before proceeding
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

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
                <span className="stat-label">Support Status</span>
                <span className="stat-value" style={{ color: sets[currentSet - 1].supportAck ? '#00b894' : '#fdcb6e' }}>
                  {sets[currentSet - 1].supportAck ? 'Acknowledged' : 'Pending'}
                </span>
              </div>
            </div>
            
            {sets.every(set => set.status === 'completed') && (
              <div className="completion-message">
                <h3>🎉 All Tasks Completed Successfully!</h3>
                <p>All server sets have been processed. Night Broker Restart procedure is complete.</p>
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
