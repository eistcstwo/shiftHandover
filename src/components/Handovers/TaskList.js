import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import './TasksList.css';
import {
  getRestartId,
  getBrokerRestartStatus,
  startBrokerRestartTask,
  updateSubRestart,
  updateSetRestart
} from '../../Api/HandOverApi';

// Helper function to extract subset ID from any object with multiple possible field names
const extractSubsetId = (data) => {
  if (!data) return null;
  
  // Check for all possible field names in order of priority
  const possibleFields = ['subSetsId', 'subSetId', 'subsetId', 'subset_id', 'subsets_id'];
  
  // First, check in the root of the object
  for (const field of possibleFields) {
    if (data[field]) {
      return data[field];
    }
  }
  
  // If not found in root, check nested structures
  if (data.currSet && Array.isArray(data.currSet)) {
    const activeSets = data.currSet.filter(
      set => set.status === 'started' && set.endTime === 'Present'
    );
    
    if (activeSets.length > 0) {
      const latestSet = activeSets[activeSets.length - 1];
      for (const field of possibleFields) {
        if (latestSet[field]) {
          return latestSet[field];
        }
      }
    }
    
    // Also check all sets if no active ones
    for (const set of data.currSet) {
      for (const field of possibleFields) {
        if (set[field]) {
          return set[field];
        }
      }
    }
  }
  
  // Check in subTasks array if present
  if (data.subTasks && Array.isArray(data.subTasks) && data.subTasks.length > 0) {
    const lastTask = data.subTasks[data.subTasks.length - 1];
    for (const field of possibleFields) {
      if (lastTask[field]) {
        return lastTask[field];
      }
    }
  }
  
  return null;
};

const TasksList = () => {
  // State for restart ID management
  const [restartId, setRestartId] = useState(null);
  const [brokerStatus, setBrokerStatus] = useState(null);
  const [currentSubsetId, setCurrentSubsetId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allSetsCompleted, setAllSetsCompleted] = useState(false);
  
  // Ref to track if we're initializing
  const isInitializing = useRef(true);

  // State for set selection modal
  const [showSetModal, setShowSetModal] = useState(false);
  const [selectedSetIndex, setSelectedSetIndex] = useState(null);
  const [setStartData, setSetStartData] = useState({
    infraName: '',
    infraId: ''
  });

  // State for support acknowledgment modal
  const [supportAckModal, setSupportAckModal] = useState(false);
  const [supportAckData, setSupportAckData] = useState({
    name: '',
    id: ''
  });

  // State for current step tracking
  const [currentStep, setCurrentStep] = useState(1);
  const [timer, setTimer] = useState(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [activityLog, setActivityLog] = useState([]);

  // Checklist steps definition
  const [checklistSteps, setChecklistSteps] = useState([
    {
      id: 1,
      title: 'CACHE UPDATED AFTER 12:00 A.M.',
      description: 'Ensure cache is updated after midnight',
      completed: false,
      completedTime: null
    },
    {
      id: 2,
      title: 'SETS READY FOR RESTART',
      description: 'Prepare all server sets for restart',
      completed: false,
      completedTime: null
    },
    {
      id: 3,
      title: 'ISOLATOR DOWN',
      description: 'Bring isolator down for maintenance',
      completed: false,
      completedTime: null
    },
    {
      id: 4,
      title: 'BROKER STOPPED',
      description: 'Stop all broker services',
      completed: false,
      completedTime: null
    },
    {
      id: 5,
      title: 'HEARTBEAT & CACHE BROKER STARTED',
      description: 'Start heartbeat and cache broker services',
      completed: false,
      completedTime: null
    },
    {
      id: 6,
      title: 'ALL BROKER STARTED',
      description: 'Start all broker services',
      completed: false,
      completedTime: null
    },
    {
      id: 7,
      title: 'CACHE HIT & WORKLOAD DONE',
      description: 'Verify cache hits and complete workload',
      completed: false,
      completedTime: null
    },
    {
      id: 8,
      title: 'UDP CHANGES (TIMEOUT & URL CHANGES)',
      description: 'Apply UDP configuration changes',
      completed: false,
      completedTime: null
    },
    {
      id: 9,
      title: 'LOGS VERIFICATION DONE',
      description: 'Verify all system logs',
      completed: false,
      completedTime: null
    },
    {
      id: 10,
      title: 'ISOLATOR UP',
      description: 'Bring isolator back online',
      completed: false,
      completedTime: null
    },
    {
      id: 11,
      title: 'INFORM START OF ACTIVITY TO SUPPORT TEAM',
      description: 'Notify support team about activity completion',
      completed: false,
      completedTime: null,
      requiresAck: true,
      ackBy: null,
      ackTime: null
    }
  ]);

  // STEP 1: Initialize - Get restart ID on component mount
  useEffect(() => {
    initializeRestartId();
    return () => {
      if (timer) clearInterval(timer);
    };
  }, []);

  const initializeRestartId = async () => {
    setLoading(true);
    try {
      // Check if we already have a restart ID in localStorage
      const storedRestartId = localStorage.getItem('brokerRestartId');

      if (storedRestartId) {
        setRestartId(parseInt(storedRestartId));
        logActivity('INIT', `Using stored restart ID: ${storedRestartId}`);
        // STEP 2: Fetch current status
        await fetchBrokerStatus(parseInt(storedRestartId));
      } else {
        // Get new restart ID from API
        const response = await getRestartId();
        const newRestartId = response.restartId;
        setRestartId(newRestartId);
        localStorage.setItem('brokerRestartId', newRestartId);
        logActivity('API_SUCCESS', `New restart ID obtained: ${newRestartId}`, response);

        // STEP 2: Fetch current status
        await fetchBrokerStatus(newRestartId);
      }
    } catch (error) {
      console.error('Error initializing restart ID:', error);
      logActivity('API_ERROR', `Failed to initialize: ${error.message}`);
    } finally {
      setLoading(false);
      isInitializing.current = false;
    }
  };

  // STEP 2: Fetch broker status to check if any set is in progress
  const fetchBrokerStatus = async (rid) => {
    try {
      const statusResponse = await getBrokerRestartStatus(rid);
      setBrokerStatus(statusResponse);
      logActivity('API_SUCCESS', 'Broker status fetched', statusResponse);

      // Check if all 4 sets are completed
      if (statusResponse.currSet && statusResponse.currSet.length >= 4) {
        const completedCount = statusResponse.currSet.filter(
          set => set.status === 'completed' || (set.endTime && set.endTime !== 'Present')
        ).length;
        
        if (completedCount >= 4) {
          setAllSetsCompleted(true);
          setSelectedSetIndex(null);
          setCurrentSubsetId(null);
          logActivity('INFO', 'All 4 sets completed. Ready to start new session.');
          return;
        }
      }

      // Check if there's an ongoing set
      if (statusResponse.currSet && statusResponse.currSet.length > 0) {
        // Find the most recent set that is started but not ended
        const activeSets = statusResponse.currSet.filter(
          set => set.status === 'started' && set.endTime === 'Present'
        );
        
        if (activeSets.length > 0) {
          // Get the most recent active set (last one in the array)
          const lastActiveSet = activeSets[activeSets.length - 1];
          const setIndex = statusResponse.currSet.indexOf(lastActiveSet);
          setSelectedSetIndex(setIndex);
          
          // Extract subset ID using the robust helper function
          const subsetId = extractSubsetId(lastActiveSet);
          
          if (subsetId) {
            setCurrentSubsetId(subsetId);
            logActivity('INFO', `Found active subset ID: ${subsetId} for set ${setIndex + 1}`);
          } else {
            logActivity('WARNING', 'No subset ID found in active set');
            if (!isInitializing.current) {
              handleSetStart(statusResponse.currSet.length);
              return;
            }
          }

          // Determine which step we're on based on subtasks
          if (lastActiveSet.subTasks && lastActiveSet.subTasks.length > 0) {
            const completedStepsCount = lastActiveSet.subTasks.length;
            setCurrentStep(completedStepsCount + 1);

            // Update completed steps
            const updatedSteps = [...checklistSteps];
            lastActiveSet.subTasks.forEach((task, index) => {
              if (updatedSteps[index]) {
                updatedSteps[index].completed = true;
                updatedSteps[index].completedTime = task.completion || new Date().toISOString();
              }
            });
            setChecklistSteps(updatedSteps);
            
            logActivity('RESUME', `Resuming set ${setIndex + 1} from step ${completedStepsCount + 1}`);
          } else {
            logActivity('RESUME', `Starting new set ${setIndex + 1} from step 1`);
            setCurrentStep(1);
          }
          
          startTimer();
        } else {
          // No active sets found
          logActivity('INFO', 'No active set found. Ready to start a new set.');
          setSelectedSetIndex(null);
          setCurrentSubsetId(null);
        }
      } else {
        logActivity('INFO', 'No sets started yet. Ready to begin.');
        setSelectedSetIndex(null);
        setCurrentSubsetId(null);
      }
    } catch (error) {
      console.error('Error fetching broker status:', error);
      logActivity('API_ERROR', `Failed to fetch status: ${error.message}`);
    }
  };

  // STEP 4: Handle set start
  const handleSetStart = (setIndex) => {
    setSelectedSetIndex(setIndex);
    setShowSetModal(true);
    setSetStartData({ infraName: '', infraId: '' });
  };

  const handleSetStartSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      logActivity('SET_START', `Starting set ${selectedSetIndex + 1}`, setStartData);

      // If all sets are completed, start fresh without restartId
      // Otherwise, check if we should pass restartId based on currSet length
      let shouldPassRestartId = false;
      
      if (!allSetsCompleted && brokerStatus?.currSet?.length < 4) {
        shouldPassRestartId = true;
      }
      
      logActivity('INFO', `All sets completed: ${allSetsCompleted}, Current sets count: ${brokerStatus?.currSet?.length || 0}, Will ${shouldPassRestartId ? 'include' : 'exclude'} restartId`);

      // Call startBrokerRestartTask
      const response = await startBrokerRestartTask(
        setStartData.infraId,
        setStartData.infraName,
        shouldPassRestartId ? restartId : null
      );

      logActivity('API_SUCCESS', `Set ${selectedSetIndex + 1} started successfully`, response);

      // Extract the subset ID from the response using the robust helper function
      const subsetId = extractSubsetId(response);

      if (subsetId) {
        setCurrentSubsetId(subsetId);
        localStorage.setItem(`currentSubsetId_${restartId}_${selectedSetIndex}`, subsetId);
        logActivity('INFO', `Subset ID obtained: ${subsetId} for set ${selectedSetIndex + 1}`);
      } else {
        logActivity('ERROR', 'No subset ID returned from API');
        throw new Error('No subset ID received from server');
      }

      // If this was a new session (all sets completed), update the restart state
      if (allSetsCompleted) {
        const newRestartId = response.restartId || restartId;
        setRestartId(newRestartId);
        localStorage.setItem('brokerRestartId', newRestartId);
        setAllSetsCompleted(false);
        logActivity('INFO', `New session started with restart ID: ${newRestartId}`);
      }

      setBrokerStatus(response);
      setShowSetModal(false);
      setCurrentStep(1);
      
      // Reset checklist
      const resetSteps = checklistSteps.map(step => ({
        ...step,
        completed: false,
        completedTime: null,
        ackBy: null,
        ackTime: null
      }));
      setChecklistSteps(resetSteps);
      
      startTimer();

      logActivity('SET_INIT', `Set ${selectedSetIndex + 1} initialized with subset ID: ${subsetId}`);

    } catch (error) {
      console.error('Error starting set:', error);
      logActivity('API_ERROR', `Failed to start set: ${error.message}`);
      alert(`Failed to start set: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // STEP 5: Mark step as complete
  const completeStep = async (stepId) => {
    // Skip if not the current step OR if it's the last step (support ack)
    if (stepId !== currentStep || stepId === 11) return;

    if (!currentSubsetId) {
      logActivity('ERROR', 'No active subset ID. Cannot complete step.');
      alert('Error: No active subset ID found. Please start a set first.');
      return;
    }

    try {
      const step = checklistSteps[stepId - 1];

      logActivity('API_CALL', `Calling updateSubRestart for step ${stepId}: ${step.title}`, {
        subsetId: currentSubsetId,
        stepTitle: step.title
      });

      // Call updateSubRestart API
      await updateSubRestart(step.title, currentSubsetId);

      logActivity('API_SUCCESS', `Step ${stepId} completed: ${step.title}`);

      // Update local state
      const updatedSteps = [...checklistSteps];
      updatedSteps[stepId - 1] = {
        ...updatedSteps[stepId - 1],
        completed: true,
        completedTime: new Date().toISOString()
      };
      setChecklistSteps(updatedSteps);

      // Move to next step
      if (stepId < checklistSteps.length) {
        setTimeout(() => {
          setCurrentStep(stepId + 1);
          setTimeElapsed(0);
        }, 500);
      }
    } catch (error) {
      console.error('Error completing step:', error);
      logActivity('API_ERROR', `Failed to complete step ${stepId}: ${error.message}`);
      alert(`Failed to complete step: ${error.message}`);
    }
  };

  // STEP 6: Handle support acknowledgment (Last Step - Step 11)
  const handleSupportAckClick = () => {
    setSupportAckModal(true);
    setSupportAckData({ name: '', id: '' });
  };

  const handleSupportAckSubmit = async (e) => {
    e.preventDefault();

    if (!currentSubsetId) {
      logActivity('ERROR', 'No active subset ID. Cannot acknowledge support.');
      alert('Error: No active subset ID found.');
      return;
    }

    setLoading(true);
    try {
      // FIRST: Call updateSetRestart API to complete current set
      logActivity('API_CALL', `Completing set ${selectedSetIndex + 1} with support acknowledgment`, {
        supportId: supportAckData.id,
        supportName: supportAckData.name,
        subSetsId: currentSubsetId
      });

      const updateResponse = await updateSetRestart(
        supportAckData.id,
        supportAckData.name,
        currentSubsetId
      );
      
      logActivity('API_SUCCESS', `Support acknowledgment by ${supportAckData.name} (${supportAckData.id})`, updateResponse);

      // Update step 11 as completed
      const updatedSteps = [...checklistSteps];
      updatedSteps[10] = {
        ...updatedSteps[10],
        completed: true,
        completedTime: new Date().toISOString(),
        ackBy: supportAckData.name,
        ackTime: new Date().toISOString()
      };
      setChecklistSteps(updatedSteps);

      // SECOND: Fetch broker status to check how many sets are completed
      logActivity('API_CALL', `Fetching broker status after set completion`);
      
      const statusResponse = await getBrokerRestartStatus(restartId);
      
      logActivity('API_SUCCESS', `Broker status refreshed`, statusResponse);
      setBrokerStatus(statusResponse);

      // Check if all 4 sets are now completed
      const completedCount = statusResponse.currSet?.filter(
        set => set.status === 'completed' || (set.endTime && set.endTime !== 'Present')
      ).length || 0;

      logActivity('INFO', `Total completed sets: ${completedCount}/4`);

      if (completedCount >= 4) {
        // All sets completed - show completion page
        setAllSetsCompleted(true);
        setSupportAckModal(false);
        setSupportAckData({ name: '', id: '' });
        setSelectedSetIndex(null);
        setCurrentSubsetId(null);
        
        logActivity('COMPLETE', 'All 4 sets completed! Broker restart activity finished.');
        
        if (timer) clearInterval(timer);
        
      } else {
        // More sets to do - reset for next set
        setSupportAckModal(false);
        setSupportAckData({ name: '', id: '' });

        // Reset checklist for next set
        const resetSteps = checklistSteps.map(step => ({
          ...step,
          completed: false,
          completedTime: null,
          ackBy: null,
          ackTime: null
        }));
        setChecklistSteps(resetSteps);
        
        setCurrentStep(1);
        setTimeElapsed(0);
        setSelectedSetIndex(null);
        setCurrentSubsetId(null);

        logActivity('SET_COMPLETE', `Set ${selectedSetIndex + 1} completed. Ready to start next set (${completedCount + 1}/4)`);
      }

    } catch (error) {
      console.error('Error in support acknowledgment:', error);
      logActivity('API_ERROR', `Failed: ${error.message}`);
      alert(`Failed: ${error.message}`);
      // Refresh status to get current state
      await fetchBrokerStatus(restartId);
    } finally {
      setLoading(false);
    }
  };

  // Handle resume of existing set
  const handleResumeSet = (setIndex, set) => {
    setSelectedSetIndex(setIndex);
    
    const subsetId = extractSubsetId(set);
    
    if (subsetId) {
      setCurrentSubsetId(subsetId);
      logActivity('INFO', `Resuming with subset ID: ${subsetId} for set ${setIndex + 1}`);
    } else {
      logActivity('WARNING', 'No subset ID found in set, cannot resume');
      alert('Cannot resume set: Missing subset ID');
      return;
    }
    
    // Determine current step based on subtasks
    if (set.subTasks && set.subTasks.length > 0) {
      const stepNumber = set.subTasks.length + 1;
      setCurrentStep(stepNumber);
      
      // Update completed steps
      const updatedSteps = [...checklistSteps];
      set.subTasks.forEach((task, taskIndex) => {
        if (updatedSteps[taskIndex]) {
          updatedSteps[taskIndex].completed = true;
          updatedSteps[taskIndex].completedTime = task.completion || new Date().toISOString();
        }
      });
      setChecklistSteps(updatedSteps);
      
      logActivity('RESUME', `Resumed set ${setIndex + 1} at step ${stepNumber}`);
    } else {
      setCurrentStep(1);
      logActivity('RESUME', `Starting set ${setIndex + 1} from beginning`);
    }
    
    startTimer();
  };

  // Handle starting new session when all sets are completed
  const handleStartNewSession = () => {
    // Clear stored data
    localStorage.removeItem('brokerRestartId');
    
    // Reset all state
    setAllSetsCompleted(false);
    setRestartId(null);
    setBrokerStatus(null);
    setSelectedSetIndex(null);
    setCurrentSubsetId(null);
    setActivityLog([]);
    
    // Re-initialize
    initializeRestartId();
  };

  // Timer management
  const startTimer = () => {
    if (timer) clearInterval(timer);
    setTimeElapsed(0);
    const newTimer = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
    }, 1000);
    setTimer(newTimer);
  };

  // Activity logging
  const logActivity = (type, message, data = null) => {
    const logEntry = {
      timestamp: new Date(),
      type,
      message,
      data
    };
    console.log(`[${type}] ${message}`, data);
    setActivityLog(prev => [logEntry, ...prev].slice(0, 50));
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
      case 'started': return '#74b9ff';
      case 'completed': return '#00b894';
      default: return '#636e72';
    }
  };

  // Get the next available set index
  const getNextSetIndex = () => {
    if (!brokerStatus?.currSet) return 0;
    return brokerStatus.currSet.length;
  };

  if (loading && !restartId) {
    return (
      <div className="tasks-list-page">
        <div className="tasks-list-header">
          <div className="header-content">
            <h1>📝 Night Broker Restart Checklist</h1>
            <p>Initializing restart session...</p>
          </div>
        </div>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading...</p>
        </div>
      </div>
    );
  }

  // Show completion page when all 4 sets are done
  if (allSetsCompleted) {
    return (
      <div className="tasks-list-page">
        <div className="tasks-list-header">
          <div className="header-content">
            <h1>🎉 Broker Restart Activity Completed!</h1>
            <p>All 4 sets have been successfully completed</p>
          </div>
        </div>

        <section className="completion-message">
          <h3>✅ All Sets Completed Successfully</h3>
          <p>The broker restart activity has been completed for all 4 sets.</p>
          
          <div className="completion-summary">
            <h4>Completed Sets Summary:</h4>
            <div className="sets-grid">
              {brokerStatus?.currSet?.slice(0, 4).map((set, index) => (
                <div
                  key={index}
                  className="set-card"
                  style={{ borderLeft: `4px solid ${getStatusColor(set.status)}` }}
                >
                  <div className="set-header">
                    <h3>Set {index + 1}</h3>
                    <span className="set-status" style={{ color: getStatusColor(set.status) }}>
                      ✅ COMPLETED
                    </span>
                  </div>
                  <div className="set-details">
                    {set.infraName && (
                      <p className="infra-name">Infra: {set.infraName}</p>
                    )}
                    {set.supportName && (
                      <div className="set-support-ack">
                        <strong>Support Ack by:</strong> {set.supportName}
                        {set.supportTime && set.supportTime !== 'Pending' && (
                          <><br /><small>{set.supportTime}</small></>
                        )}
                      </div>
                    )}
                    <p className="set-progress-info">
                      <span>Steps completed: {set.subTasks?.length || 0}/10</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleStartNewSession}
            className="btn-primary"
            style={{ marginTop: '2rem' }}
          >
            Start New Broker Restart Session
          </button>
        </section>

        {/* Activity Log */}
        {activityLog.length > 0 && (
          <section className="activity-log-section">
            <h2>📜 Activity Log</h2>
            <div className="activity-log-container">
              {activityLog.slice(0, 20).map((log, index) => (
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
      </div>
    );
  }

  return (
    <div className="tasks-list-page">
      {/* Header */}
      <div className="tasks-list-header">
        <div className="header-content">
          <h1>📝 Night Broker Restart Checklist</h1>
          <div className="header-details">
            <p>Restart ID: <strong>{restartId}</strong></p>
            <p>Completed Sets: <strong>{brokerStatus?.currSet?.filter(s => s.status === 'completed').length || 0}/4</strong></p>
            {currentSubsetId && selectedSetIndex !== null && (
              <p>Current Subset ID: <strong>{currentSubsetId}</strong></p>
            )}
          </div>
        </div>
      </div>

      {/* Show set selection if no active set */}
      {selectedSetIndex === null && (
        <section className="sets-section">
          <h2>📊 Available Sets ({brokerStatus?.currSet?.length || 0}/4)</h2>
          <div className="sets-grid">
            {brokerStatus?.currSet?.map((set, index) => (
              <div
                key={index}
                className="set-card"
                style={{ borderLeft: `4px solid ${getStatusColor(set.status)}` }}
              >
                <div className="set-header">
                  <h3>Set {index + 1}</h3>
                  <span className="set-status" style={{ color: getStatusColor(set.status) }}>
                    {set.status.toUpperCase()}
                  </span>
                </div>
                <div className="set-details">
                  {(set.subSetsId || set.subSetId) && (
                    <p className="subset-id">Subset ID: {set.subSetsId || set.subSetId}</p>
                  )}
                  {set.infraName && (
                    <p className="infra-name">Infra: {set.infraName}</p>
                  )}
                  {set.supportName && set.supportName !== 'pending' && (
                    <div className="set-support-ack">
                      <strong>Support Ack:</strong> {set.supportName}
                    </div>
                  )}
                </div>
                {set.status === 'started' && set.endTime === 'Present' && (
                  <button
                    onClick={() => handleResumeSet(index, set)}
                    className="complete-btn"
                  >
                    Resume This Set
                  </button>
                )}
                {set.status === 'completed' && (
                  <div className="set-completed">
                    <span>✅ Completed</span>
                  </div>
                )}
              </div>
            ))}

            {/* Button to start new set - only if less than 4 sets */}
            {(!brokerStatus?.currSet || brokerStatus.currSet.length < 4) && (
              <button
                onClick={() => handleSetStart(getNextSetIndex())}
                className="set-card click-prompt"
                style={{ borderLeft: '4px solid #74b9ff' }}
              >
                <h3>➕ Start Set {getNextSetIndex() + 1}</h3>
                <p>Click to begin</p>
              </button>
            )}
          </div>
        </section>
      )}

      {/* Set Start Modal */}
      {showSetModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h2>🔐 Start Set {selectedSetIndex + 1}</h2>
              <p>Enter infrastructure details to begin</p>
            </div>
            <form onSubmit={handleSetStartSubmit} className="modal-form">
              <div className="form-group">
                <label htmlFor="infraName">Infrastructure Name</label>
                <input
                  type="text"
                  id="infraName"
                  value={setStartData.infraName}
                  onChange={(e) => setSetStartData({...setStartData, infraName: e.target.value})}
                  placeholder="Enter infra name"
                  required
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="infraId">Infrastructure ID</label>
                <input
                  type="text"
                  id="infraId"
                  value={setStartData.infraId}
                  onChange={(e) => setSetStartData({...setStartData, infraId: e.target.value})}
                  placeholder="Enter infra ID"
                  required
                  className="form-input"
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowSetModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Starting...' : 'Start Set'}
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
              <h2>🛡️ Complete Set {selectedSetIndex + 1}</h2>
              <p>Enter support team acknowledgment details</p>
            </div>
            <form onSubmit={handleSupportAckSubmit} className="modal-form">
              <div className="form-group">
                <label htmlFor="supportName">Support Team Member Name</label>
                <input
                  type="text"
                  id="supportName"
                  value={supportAckData.name}
                  onChange={(e) => setSupportAckData({...supportAckData, name: e.target.value})}
                  placeholder="Enter support member name"
                  required
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="supportId">Support Member ID</label>
                <input
                  type="text"
                  id="supportId"
                  value={supportAckData.id}
                  onChange={(e) => setSupportAckData({...supportAckData, id: e.target.value})}
                  placeholder="Enter support member ID"
                  required
                  className="form-input"
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setSupportAckModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Processing...' : 'Complete Set'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Active Work Section */}
      {selectedSetIndex !== null && (
        <>
          {/* Timer Banner */}
          <div className="user-info-banner">
            <div className="user-info-content">
              <span className="user-label">📍 Current Set:</span>
              <span className="user-name">Set {selectedSetIndex + 1} of 4</span>
              <span className="user-id">Subset ID: {currentSubsetId || 'Loading...'}</span>
              {brokerStatus?.currSet?.[selectedSetIndex]?.infraName && (
                <span className="infra-info">Infra: {brokerStatus.currSet[selectedSetIndex].infraName}</span>
              )}
            </div>
            <div className="current-timer">
              ⏱️ Step Time: {formatTime(timeElapsed)}
            </div>
          </div>

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
                          <strong>Completed at:</strong> {format(new Date(step.completedTime), 'MMM d, h:mm:ss a')}
                        </div>
                        {step.requiresAck && step.ackBy && (
                          <div className="detail-item ack-info">
                            <strong>✅ Support Ack by:</strong> {step.ackBy}
                            <br />
                            <small>{format(new Date(step.ackTime), 'MMM d, h:mm:ss a')}</small>
                          </div>
                        )}
                      </div>
                    )}

                    {currentStep === step.id && !step.completed && (
                      <div className="step-actions">
                        {step.id === 11 ? (
                          <button onClick={handleSupportAckClick} className="complete-btn">
                            Complete Set & Acknowledge
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
                      <div className={`log-type ${log.type.includes('SUCCESS') ? 'api-success' : log.type.includes('ERROR')  ? 'api-error' : 'api-call'}`}>
                        {log.type.includes('SUCCESS') ? 'SUCCESS' : log.type.includes('ERROR') ? 'ERROR' : 'API'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default TasksList;
