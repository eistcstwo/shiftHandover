import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';

const TasksList = () => {
  // State for main operator authentication
  const [operatorAuth, setOperatorAuth] = useState({
    name: '',
    id: '',
    isAuthenticated: false,
    authTime: null,
    selectedSet: null
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
      completedTime: null
    },
    {
      id: 2,
      name: '25 Series - Set 2',
      servers: '158, 159, 160, 175, 176, 75, 58, 59, 65, 66, 67, 165, 166, 13, 14, 113, 114, 115, 44, 45, 144, 145, 146, 33, 34, 131, 132, 133, 190, 191, 194, 195, 70, 71, 170, 171',
      status: 'pending',
      supportAck: null,
      completedBy: null,
      completedTime: null
    },
    {
      id: 3,
      name: '24 Series - Set 3',
      servers: '158, 159, 160, 175, 176, 75, 58, 59, 65, 66, 67, 165, 166, 13, 14, 113, 114, 115, 44, 45, 144, 145, 146, 33, 34, 131, 132, 133, 190, 191, 194, 195, 70, 71, 170, 171',
      status: 'pending',
      supportAck: null,
      completedBy: null,
      completedTime: null
    },
    {
      id: 4,
      name: '24 Series - Set 4',
      servers: '155, 156, 157, 173, 174, 73, 74, 55, 56, 57, 63, 64, 163, 164, 10, 11, 12, 110, 111, 112, 41, 42, 43, 141, 142, 143, 31, 32, 134, 135, 192, 196, 197, 68, 69, 168, 169',
      status: 'pending',
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

  // Handle set card click - show auth modal for that set
  const handleSetCardClick = (setId) => {
    // Only allow clicking on pending sets or sets that haven't been started
    const selectedSet = sets.find(s => s.id === setId);
    if (selectedSet.status === 'completed') return;
    
    setOperatorAuth({
      ...operatorAuth,
      selectedSet: setId
    });
  };

  // Handle operator authentication
  const handleOperatorAuth = (e) => {
    e.preventDefault();
    const authTime = new Date();
    const selectedSetId = operatorAuth.selectedSet;
    
    setOperatorAuth({
      ...operatorAuth,
      isAuthenticated: true,
      authTime
    });

    setCurrentSet(selectedSetId);

    // Update set status to in-progress
    const updatedSets = [...sets];
    updatedSets[selectedSetId - 1] = {
      ...updatedSets[selectedSetId - 1],
      status: 'in-progress'
    };
    setSets(updatedSets);

    // Log authentication
    logActivity('OPERATOR_AUTH', `Operator ${operatorAuth.name} (ID: ${operatorAuth.id}) started Set ${selectedSetId}`, operatorAuth);

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
      selectedSet: null
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
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>📝 Night Broker Restart Checklist</h1>
          <p style={styles.subtitle}>Click on a server set to begin the restart procedure</p>
        </div>
      </div>

      {/* Server Sets Progress - Always visible */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>📊 Server Sets Progress</h2>
        <div style={styles.setsGrid}>
          {sets.map((set) => (
            <button
              key={set.id}
              onClick={() => handleSetCardClick(set.id)}
              disabled={set.status === 'completed'}
              style={{
                ...styles.setCard,
                ...(currentSet === set.id ? styles.setCardActive : {}),
                ...(set.status === 'completed' ? styles.setCardDisabled : {}),
                borderLeft: `4px solid ${getStatusColor(set.status)}`,
                cursor: set.status === 'completed' ? 'not-allowed' : 'pointer'
              }}
            >
              <div style={styles.setHeader}>
                <h3 style={styles.setName}>{set.name}</h3>
                <span style={{ ...styles.setStatus, color: getStatusColor(set.status) }}>
                  {set.status.toUpperCase()}
                </span>
              </div>
              <div style={styles.setServers}>
                <strong>Servers:</strong> {set.servers}
              </div>

              {set.supportAck && (
                <div style={styles.setInfo}>
                  <strong>🛡️ Support Acknowledgment:</strong>
                  <div>{set.supportAck.name} (ID: {set.supportAck.id})</div>
                  <small>{format(new Date(set.supportAck.time), 'MMM d, h:mm:ss a')}</small>
                </div>
              )}

              {set.completedBy && (
                <div style={styles.setInfo}>
                  <strong>✅ Completed by:</strong>
                  <div>{set.completedBy}</div>
                  <small>{format(new Date(set.completedTime), 'MMM d, h:mm:ss a')}</small>
                </div>
              )}

              {set.status === 'pending' && (
                <div style={styles.clickPrompt}>
                  👆 Click to start this set
                </div>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Operator Authentication Modal */}
      {operatorAuth.selectedSet && !operatorAuth.isAuthenticated && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContainer}>
            <div style={styles.modalHeader}>
              <h2>🔐 Operator Authentication Required</h2>
              <p>Starting work on {sets[operatorAuth.selectedSet - 1].name}</p>
            </div>

            <form onSubmit={handleOperatorAuth} style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Your Name (Operator)</label>
                <input
                  type="text"
                  value={operatorAuth.name}
                  onChange={(e) => setOperatorAuth({...operatorAuth, name: e.target.value})}
                  placeholder="Enter your full name"
                  required
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Your ADID / Employee ID</label>
                <input
                  type="text"
                  value={operatorAuth.id}
                  onChange={(e) => setOperatorAuth({...operatorAuth, id: e.target.value})}
                  placeholder="Enter your ADID"
                  required
                  style={styles.input}
                />
              </div>
              <div style={styles.modalActions}>
                <button 
                  type="button" 
                  onClick={() => setOperatorAuth({...operatorAuth, selectedSet: null})}
                  style={styles.btnSecondary}
                >
                  Cancel
                </button>
                <button type="submit" style={styles.btnPrimary}>
                  Start Task
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
          <div style={styles.userBanner}>
            <div style={styles.userInfo}>
              <span>👤 Current Operator:</span>
              <span style={styles.userName}>{operatorAuth.name}</span>
              <span>(ADID: {operatorAuth.id})</span>
              <span>Started: {format(operatorAuth.authTime, 'MMM d, h:mm a')}</span>
            </div>
            <div style={styles.timer}>
              ⏱️ Current Step Time: {formatTime(timeElapsed)}
            </div>
          </div>

          <div style={styles.currentSetInfo}>
            <h3>Currently Working On: <span style={styles.setHighlight}>{sets[currentSet - 1].name}</span></h3>
            <div style={styles.progressInfo}>
              <span>Set {currentSet} of {sets.length}</span>
              <span>•</span>
              <span>Step {currentStep} of {checklistSteps.length}</span>
            </div>
          </div>

          {/* Support Acknowledgment Modal */}
          {supportAckModal && (
            <div style={styles.modalOverlay}>
              <div style={styles.modalContainer}>
                <div style={styles.modalHeader}>
                  <h2>🛡️ Support Team Acknowledgment Required</h2>
                  <p>Step 2 requires support team acknowledgment before proceeding</p>
                </div>

                <form onSubmit={handleSupportAckSubmit} style={styles.form}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Support Team Member Name</label>
                    <input
                      type="text"
                      value={supportAckData.name}
                      onChange={(e) => setSupportAckData({...supportAckData, name: e.target.value})}
                      placeholder="Enter support team member name"
                      required
                      style={styles.input}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Support Team Member ADID/Employee ID</label>
                    <input
                      type="text"
                      value={supportAckData.id}
                      onChange={(e) => setSupportAckData({...supportAckData, id: e.target.value})}
                      placeholder="Enter support team member ID"
                      required
                      style={styles.input}
                    />
                  </div>
                  <div style={styles.modalActions}>
                    <button type="button" onClick={() => setSupportAckModal(false)} style={styles.btnSecondary}>
                      Cancel
                    </button>
                    <button type="submit" style={styles.btnPrimary}>
                      Acknowledge & Continue
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Set Completion Verification Modal */}
          {setCompleteModal && (
            <div style={styles.modalOverlay}>
              <div style={styles.modalContainer}>
                <div style={styles.modalHeader}>
                  <h2>✅ Set Completion Verification</h2>
                  <p>Set {currentSet} completed. Please verify completion.</p>
                </div>

                <form onSubmit={handleSetCompleteSubmit} style={styles.form}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Your Name</label>
                    <input
                      type="text"
                      value={setCompleteData.name}
                      onChange={(e) => setSetCompleteData({...setCompleteData, name: e.target.value})}
                      placeholder="Enter your name"
                      required
                      style={styles.input}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Your ADID / Employee ID</label>
                    <input
                      type="text"
                      value={setCompleteData.id}
                      onChange={(e) => setSetCompleteData({...setCompleteData, id: e.target.value})}
                      placeholder="Enter your ADID"
                      required
                      style={styles.input}
                    />
                  </div>
                  <div style={styles.modalActions}>
                    <button type="button" onClick={() => setSetCompleteModal(false)} style={styles.btnSecondary}>
                      Cancel
                    </button>
                    <button type="submit" style={styles.btnPrimary}>
                      Verify & Complete Set
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Checklist Timeline */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>📋 Restart Procedure Checklist</h2>
            <div style={styles.timeline}>
              {checklistSteps.map((step, index) => (
                <div
                  key={step.id}
                  style={{
                    ...styles.timelineStep,
                    ...(step.completed ? styles.stepCompleted : {}),
                    ...(currentStep === step.id ? styles.stepCurrent : {})
                  }}
                >
                  <div style={styles.stepMarker}>
                    <div style={styles.stepNumber}>{step.id}</div>
                    {index < checklistSteps.length - 1 && (
                      <div style={styles.stepConnector}></div>
                    )}
                  </div>
                  <div style={styles.stepContent}>
                    <div style={styles.stepHeader}>
                      <h3 style={styles.stepTitle}>{step.title}</h3>
                      <div>
                        {step.completed ? (
                          <span style={styles.statusCompleted}>✅ Completed</span>
                        ) : currentStep === step.id ? (
                          <span style={styles.statusCurrent}>⏳ In Progress</span>
                        ) : (
                          <span style={styles.statusPending}>⏱️ Pending</span>
                        )}
                      </div>
                    </div>
                    <p style={styles.stepDescription}>{step.description}</p>

                    {step.completed && (
                      <div style={styles.stepDetails}>
                        <div><strong>Completed by:</strong> {step.completedBy}</div>
                        <div><strong>Time:</strong> {format(new Date(step.completedTime), 'MMM d, h:mm:ss a')}</div>
                        {step.requiresAck && step.ackBy && (
                          <div style={styles.ackInfo}>
                            <strong>✅ Support Acknowledgment by:</strong> {step.ackBy}
                            <br />
                            <small>{format(new Date(step.ackTime), 'MMM d, h:mm:ss a')}</small>
                          </div>
                        )}
                      </div>
                    )}

                    {currentStep === step.id && !step.completed && (
                      <div style={styles.stepActions}>
                        {step.id === 1 ? (
                          <button onClick={completeStep1} style={styles.completeBtn}>
                            Mark as Complete
                          </button>
                        ) : step.id === 2 ? (
                          <button onClick={completeStep2} style={styles.completeBtn}>
                            Enter Support Acknowledgment
                          </button>
                        ) : (
                          <button onClick={() => completeStep(step.id)} style={styles.completeBtn}>
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
            <section style={styles.section}>
              <h2 style={styles.sectionTitle}>📜 Activity Log</h2>
              <div style={styles.activityLog}>
                {activityLog.slice(0, 10).map((log, index) => (
                  <div key={index} style={styles.logEntry}>
                    <div style={styles.logTime}>
                      {format(new Date(log.timestamp), 'HH:mm:ss')}
                    </div>
                    <div style={styles.logMessage}>{log.message}</div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Completion Summary */}
      {sets.every(set => set.status === 'completed') && (
        <div style={styles.completionMessage}>
          <h3>🎉 All Tasks Completed Successfully!</h3>
          <p>All 4 server sets have been processed. Night Broker Restart procedure is complete.</p>
          <div style={styles.completionSummary}>
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

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f5f7fa',
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  header: {
    backgroundColor: '#2c3e50',
    color: 'white',
    padding: '30px',
    borderRadius: '12px',
    marginBottom: '30px'
  },
  title: {
    margin: '0 0 10px 0',
    fontSize: '28px',
    fontWeight: 'bold'
  },
  subtitle: {
    margin: 0,
    opacity: 0.9,
    fontSize: '16px'
  },
  section: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '25px',
    marginBottom: '25px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  },
  sectionTitle: {
    fontSize: '22px',
    marginTop: 0,
    marginBottom: '20px',
    color: '#2c3e50'
  },
  setsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px',
    marginBottom: '20px'
  },
  setCard: {
    backgroundColor: 'white',
    border: '1px solid #e1e8ed',
    borderRadius: '8px',
    padding: '20px',
    textAlign: 'left',
    transition: 'all 0.3s ease',
    outline: 'none'
  },
  setCardActive: {
    transform: 'scale(1.02)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    borderColor: '#3498db'
  },
  setCardDisabled: {
    opacity: 0.6,
    backgroundColor: '#f8f9fa'
  },
  setHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px'
  },
  setName: {
    margin: 0,
    fontSize: '18px',
    color: '#2c3e50'
  },
  setStatus: {
    fontSize: '12px',
    fontWeight: 'bold',
    padding: '4px 8px',
    borderRadius: '4px',
    backgroundColor: '#ecf0f1'
  },
  setServers: {
    fontSize: '13px',
    color: '#555',
    marginBottom: '10px',
    lineHeight: '1.6'
  },
  setInfo: {
    marginTop: '12px',
    padding: '10px',
    backgroundColor: '#f8f9fa',
    borderRadius: '6px',
    fontSize: '13px'
  },
  clickPrompt: {
    marginTop: '15px',
    padding: '10px',
    backgroundColor: '#e3f2fd',
    borderRadius: '6px',
    textAlign: 'center',
    color: '#1976d2',
    fontWeight: '500'
  },
  userBanner: {
    backgroundColor: '#34495e',
    color: 'white',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '15px'
  },
  userInfo: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  userName: {
    fontWeight: 'bold',
    fontSize: '16px'
  },
  timer: {
    fontSize: '18px',
    fontWeight: 'bold',
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: '8px 16px',
    borderRadius: '6px'
  },
  currentSetInfo: {
    backgroundColor: '#3498db',
    color: 'white',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '25px',
    textAlign: 'center'
  },
  setHighlight: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: '4px 12px',
    borderRadius: '4px',
    fontWeight: 'bold'
  },
  progressInfo: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'center',
    marginTop: '10px',
    fontSize: '14px',
    opacity: 0.9
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px'
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '30px',
    maxWidth: '500px',
    width: '100%',
    maxHeight: '90vh',
    overflow: 'auto'
  },
  modalHeader: {
    marginBottom: '25px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  label: {
    fontWeight: '600',
    color: '#2c3e50',
    fontSize: '14px'
  },
  input: {
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.3s'
  },
  modalActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    marginTop: '10px'
  },
  btnPrimary: {
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.3s'
  },
  btnSecondary: {
    backgroundColor: '#95a5a6',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.3s'
  },
  timeline: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  timelineStep: {
    display: 'flex',
    gap: '20px',
    position: 'relative'
  },
  stepCompleted: {
    opacity: 0.7
  },
  stepCurrent: {
    backgroundColor: '#e3f2fd',
    padding: '15px',
    borderRadius: '8px',
    marginLeft: '-15px',
    marginRight: '-15px'
  },
  stepMarker: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative'
  },
  stepNumber: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#3498db',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: '16px',
    flexShrink: 0
  },
  stepConnector: {
    width: '2px',
    flex: 1,
    backgroundColor: '#ddd',
    marginTop: '8px',
    minHeight: '40px'
  },
  stepContent: {
    flex: 1,
    paddingBottom: '10px'
  },
  stepHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '8px',
    gap: '15px'
  },
  stepTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '600',
    color: '#2c3e50'
  },
  stepDescription: {
    margin: '0 0 12px 0',
    color: '#666',
    fontSize: '14px'
  },
  stepDetails: {
    backgroundColor: '#f8f9fa',
    padding: '12px',
    borderRadius: '6px',
    fontSize: '13px',
    marginTop: '12px',
    lineHeight: '1.6'
  },
  ackInfo: {
    marginTop: '8px',
    paddingTop: '8px',
    borderTop: '1px solid #dee2e6'
  },
  stepActions: {
    marginTop: '12px'
  },
  completeBtn: {
    backgroundColor: '#27ae60',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.3s'
  },
  statusCompleted: {
    color: '#27ae60',
    fontSize: '13px',
    fontWeight: '600'
  },
  statusCurrent: {
    color: '#f39c12',
    fontSize: '13px',
    fontWeight: '600'
  },
  statusPending: {
    color: '#95a5a6',
    fontSize: '13px',
    fontWeight: '600'
  },
  activityLog: {
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    padding: '15px',
    maxHeight: '300px',
    overflow: 'auto'
  },
  logEntry: {
    display: 'flex',
    gap: '15px',
    padding: '10px',
    borderBottom: '1px solid #e1e8ed',
    fontSize: '13px'
  },
  logTime: {
    color: '#7f8c8d',
    fontWeight: '600',
    minWidth: '70px'
  },
  logMessage: {
    color: '#2c3e50',
    flex: 1
  },
  completionMessage: {
    backgroundColor: '#d4edda',
    border: '1px solid #c3e6cb',
    borderRadius: '8px',
    padding: '25px',
    marginTop: '25px',
    textAlign: 'center'
  },
  completionSummary: {
    marginTop: '20px',
    textAlign: 'left',
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px'
  }
};

export default TasksList;
