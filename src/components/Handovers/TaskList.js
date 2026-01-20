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

const TasksList = () => {
  const userLevel = localStorage.getItem('userlevel') || '';
  const isSupport = userLevel.toLowerCase() === 'support';
  const isOperations = ['l1', 'l2', 'admin'].includes(userLevel.toLowerCase());

  const [restartId, setRestartId] = useState(null);
  const [brokerStatus, setBrokerStatus] = useState(null);
  const [currentSubsetId, setCurrentSubsetId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allSetsCompleted, setAllSetsCompleted] = useState(false);

  const processingStep = useRef(false);
  const statusPollingInterval = useRef(null);

  const [showSetModal, setShowSetModal] = useState(false);
  const [selectedSetIndex, setSelectedSetIndex] = useState(null);
  const [setStartData, setSetStartData] = useState({ infraName: '', infraId: '' });

  const [supportAckModal, setSupportAckModal] = useState(false);
  const [supportAckData, setSupportAckData] = useState({ name: '', id: '' });

  const [currentStep, setCurrentStep] = useState(1);
  const [timer, setTimer] = useState(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [activityLog, setActivityLog] = useState([]);

  const [checklistSteps, setChecklistSteps] = useState([
    { id: 1, title: 'CACHE UPDATED AFTER 12:00 A.M.', description: 'Ensure cache is updated after midnight', completed: false, completedTime: null },
    { id: 2, title: 'SETS READY FOR RESTART', description: 'Prepare all server sets for restart', completed: false, completedTime: null },
    { id: 3, title: 'ISOLATOR DOWN', description: 'Bring isolator down for maintenance', completed: false, completedTime: null },
    { id: 4, title: 'BROKER STOPPED', description: 'Stop all broker services', completed: false, completedTime: null },
    { id: 5, title: 'HEARTBEAT & CACHE BROKER STARTED', description: 'Start heartbeat and cache broker services', completed: false, completedTime: null },
    { id: 6, title: 'ALL BROKER STARTED', description: 'Start all broker services', completed: false, completedTime: null },
    { id: 7, title: 'CACHE HIT & WORKLOAD DONE', description: 'Verify cache hits and complete workload', completed: false, completedTime: null },
    { id: 8, title: 'UDP CHANGES (TIMEOUT & URL CHANGES)', description: 'Apply UDP configuration changes', completed: false, completedTime: null },
    { id: 9, title: 'LOGS VERIFICATION DONE', description: 'Verify all system logs', completed: false, completedTime: null },
    { id: 10, title: 'ISOLATOR UP', description: 'Bring isolator back online', completed: false, completedTime: null },
    { id: 11, title: 'INFORM START OF ACTIVITY TO SUPPORT TEAM', description: 'Notify support team about activity completion', completed: false, completedTime: null, requiresAck: true, ackBy: null, ackTime: null }
  ]);

  useEffect(() => {
    initializeRestartId();
    return () => {
      if (timer) clearInterval(timer);
      if (statusPollingInterval.current) clearInterval(statusPollingInterval.current);
    };
  }, []);

  useEffect(() => {
    if (selectedSetIndex !== null && !allSetsCompleted && restartId) {
      statusPollingInterval.current = setInterval(() => {
        fetchBrokerStatus(restartId, true);
      }, 30000);
    }
    return () => {
      if (statusPollingInterval.current) {
        clearInterval(statusPollingInterval.current);
        statusPollingInterval.current = null;
      }
    };
  }, [selectedSetIndex, allSetsCompleted, restartId]);

  const extractSubsetId = (response) => {
    if (response && typeof response === 'object' && !Array.isArray(response)) {
      if (response.subSetsId) return response.subSetsId;
      if (response.subSetId) return response.subSetId;
      if (response.subsetId) return response.subsetId;
    }
    if (response && response.currSet && Array.isArray(response.currSet)) {
      const latestSet = response.currSet[response.currSet.length - 1];
      if (latestSet) {
        if (latestSet.subSetsId) return latestSet.subSetsId;
        if (latestSet.subSetId) return latestSet.subSetId;
        if (latestSet.subsetId) return latestSet.subsetId;
      }
      const activeSets = response.currSet.filter(set => set.status === 'started' && (!set.endTime || set.endTime === 'Present'));
      if (activeSets.length > 0) {
        const lastActiveSet = activeSets[activeSets.length - 1];
        if (lastActiveSet.subSetsId) return lastActiveSet.subSetsId;
        if (lastActiveSet.subSetId) return lastActiveSet.subSetId;
        if (lastActiveSet.subsetId) return lastActiveSet.subsetId;
      }
    }
    return null;
  };

  const initializeRestartId = async () => {
    setLoading(true);
    try {
      const storedRestartId = localStorage.getItem('brokerRestartId');
      if (storedRestartId) {
        setRestartId(parseInt(storedRestartId));
        logActivity('INIT', `Using stored restart ID: ${storedRestartId}`);
        await fetchBrokerStatus(parseInt(storedRestartId));
      } else {
        const response = await getRestartId();
        const newRestartId = response.restartId;
        setRestartId(newRestartId);
        localStorage.setItem('brokerRestartId', newRestartId);
        logActivity('API_SUCCESS', `New restart ID obtained: ${newRestartId}`);
        await fetchBrokerStatus(newRestartId);
      }
    } catch (error) {
      logActivity('API_ERROR', `Failed to initialize: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchBrokerStatus = async (rid, silent = false) => {
    try {
      const statusResponse = await getBrokerRestartStatus(rid);
      setBrokerStatus(statusResponse);
      if (!silent) logActivity('API_SUCCESS', 'Broker status fetched');

      if (statusResponse.currSet && statusResponse.currSet.length >= 4) {
        const completedCount = statusResponse.currSet.filter(set => set.status === 'completed' || (set.endTime && set.endTime !== 'Present')).length;
        if (completedCount >= 4) {
          setAllSetsCompleted(true);
          setSelectedSetIndex(null);
          setCurrentSubsetId(null);
          if (!silent) logActivity('INFO', 'All 4 sets completed');
          return;
        }
      }

      if (statusResponse.currSet && statusResponse.currSet.length > 0) {
        const activeSets = statusResponse.currSet.filter(set => set.status === 'started' && (!set.endTime || set.endTime === 'Present'));
        if (activeSets.length > 0) {
          const lastActiveSet = activeSets[activeSets.length - 1];
          const setIndex = statusResponse.currSet.indexOf(lastActiveSet);
          setSelectedSetIndex(setIndex);

          const subsetId = extractSubsetId(lastActiveSet);
          if (subsetId) {
            setCurrentSubsetId(subsetId);
            localStorage.setItem(`currentSubsetId_${rid}_${setIndex}`, subsetId);
          } else {
            const storedSubsetId = localStorage.getItem(`currentSubsetId_${rid}_${setIndex}`);
            if (storedSubsetId) setCurrentSubsetId(storedSubsetId);
          }

          if (lastActiveSet.subTasks && lastActiveSet.subTasks.length > 0) {
            setCurrentStep(lastActiveSet.subTasks.length + 1);
            const updatedSteps = [...checklistSteps];
            lastActiveSet.subTasks.forEach((task, index) => {
              if (updatedSteps[index]) {
                updatedSteps[index].completed = true;
                updatedSteps[index].completedTime = task.completion || new Date().toISOString();
              }
            });
            setChecklistSteps(updatedSteps);
          } else {
            setCurrentStep(1);
          }
          if (!timer) startTimer();
        } else {
          setSelectedSetIndex(null);
          setCurrentSubsetId(null);
        }
      }
    } catch (error) {
      if (!silent) logActivity('API_ERROR', `Failed to fetch status: ${error.message}`);
    }
  };

  const handleSetStart = (setIndex) => {
    if (!isOperations) {
      alert('Only Operations team can start new sets.');
      return;
    }
    setSelectedSetIndex(setIndex);
    setShowSetModal(true);
    setSetStartData({ infraName: '', infraId: '' });
  };

  const handleSetStartSubmit = async (e) => {
    e.preventDefault();
    if (processingStep.current) return;
    processingStep.current = true;
    setLoading(true);

    try {
      logActivity('SET_START', `Starting set ${selectedSetIndex + 1}`);
      let restartIdToPass = (!brokerStatus?.currSet || brokerStatus.currSet.length === 0) ? null : restartId;
      const response = await startBrokerRestartTask(setStartData.infraId, setStartData.infraName, restartIdToPass, selectedSetIndex + 1);
      
      if (response.brokerRestartId && response.brokerRestartId !== restartId) {
        setRestartId(response.brokerRestartId);
        localStorage.setItem('brokerRestartId', response.brokerRestartId);
      }

      let subsetId = extractSubsetId(response);
      if (!subsetId && response.currSet && response.currSet[selectedSetIndex]) {
        subsetId = extractSubsetId(response.currSet[selectedSetIndex]);
      }

      if (!subsetId) throw new Error('No subset ID received');

      setCurrentSubsetId(subsetId);
      localStorage.setItem(`currentSubsetId_${response.brokerRestartId || restartId}_${selectedSetIndex}`, subsetId);

      if (allSetsCompleted) setAllSetsCompleted(false);
      setBrokerStatus(response);
      setShowSetModal(false);
      setCurrentStep(1);
      setChecklistSteps(checklistSteps.map(s => ({ ...s, completed: false, completedTime: null, ackBy: null, ackTime: null })));
      startTimer();
      logActivity('SET_INIT', `Set ${selectedSetIndex + 1} initialized`);
    } catch (error) {
      logActivity('API_ERROR', `Failed to start set: ${error.message}`);
      alert(`Failed to start set: ${error.message}`);
    } finally {
      setLoading(false);
      processingStep.current = false;
    }
  };

  const completeStep = async (stepId) => {
    if (!isOperations) {
      alert('Only Operations team can mark steps as complete.');
      return;
    }
    if (stepId !== currentStep || stepId === 11 || !currentSubsetId || processingStep.current) return;

    processingStep.current = true;
    try {
      const step = checklistSteps[stepId - 1];
      await updateSubRestart(step.title, currentSubsetId);
      logActivity('API_SUCCESS', `Step ${stepId} completed`);

      const updatedSteps = [...checklistSteps];
      updatedSteps[stepId - 1] = { ...updatedSteps[stepId - 1], completed: true, completedTime: new Date().toISOString() };
      setChecklistSteps(updatedSteps);

      if (stepId < checklistSteps.length) {
        setTimeout(() => {
          setCurrentStep(stepId + 1);
          setTimeElapsed(0);
        }, 500);
      }
    } catch (error) {
      logActivity('API_ERROR', `Failed to complete step: ${error.message}`);
      alert(`Failed to complete step: ${error.message}`);
    } finally {
      processingStep.current = false;
    }
  };

  const handleSupportAckClick = () => {
    if (!isSupport) {
      alert('Only support team members can acknowledge completion.');
      return;
    }
    if (currentStep !== 11) {
      alert('Support acknowledgment is only available at step 11.');
      return;
    }
    setSupportAckModal(true);
    setSupportAckData({ name: '', id: '' });
  };

  const handleSupportAckSubmit = async (e) => {
    e.preventDefault();
    if (!currentSubsetId || processingStep.current) return;

    processingStep.current = true;
    setLoading(true);

    try {
      await updateSetRestart(supportAckData.id, supportAckData.name, currentSubsetId);
      logActivity('API_SUCCESS', `Support ack by ${supportAckData.name}`);

      const updatedSteps = [...checklistSteps];
      updatedSteps[10] = { ...updatedSteps[10], completed: true, completedTime: new Date().toISOString(), ackBy: supportAckData.name, ackTime: new Date().toISOString() };
      setChecklistSteps(updatedSteps);

      const statusResponse = await getBrokerRestartStatus(restartId);
      setBrokerStatus(statusResponse);

      const completedCount = statusResponse.currSet?.filter(set => set.status === 'completed' || (set.endTime && set.endTime !== 'Present')).length || 0;

      if (completedCount >= 4) {
        setAllSetsCompleted(true);
        setSupportAckModal(false);
        setSelectedSetIndex(null);
        setCurrentSubsetId(null);
        if (timer) clearInterval(timer);
        logActivity('COMPLETE', 'All 4 sets completed!');
      } else {
        setSupportAckModal(false);
        setChecklistSteps(checklistSteps.map(s => ({ ...s, completed: false, completedTime: null, ackBy: null, ackTime: null })));
        setCurrentStep(1);
        setTimeElapsed(0);
        setSelectedSetIndex(null);
        setCurrentSubsetId(null);
        logActivity('SET_COMPLETE', `Set completed. Ready for next (${completedCount + 1}/4)`);
      }
    } catch (error) {
      logActivity('API_ERROR', `Failed: ${error.message}`);
      alert(`Failed: ${error.message}`);
    } finally {
      setLoading(false);
      processingStep.current = false;
    }
  };

  const handleResumeSet = (setIndex, set) => {
    setSelectedSetIndex(setIndex);
    const subsetId = extractSubsetId(set) || localStorage.getItem(`currentSubsetId_${restartId}_${setIndex}`);
    if (!subsetId) {
      alert('Cannot resume: Missing subset ID');
      return;
    }
    setCurrentSubsetId(subsetId);

    if (set.subTasks && set.subTasks.length > 0) {
      setCurrentStep(set.subTasks.length + 1);
      const updatedSteps = [...checklistSteps];
      set.subTasks.forEach((task, i) => {
        if (updatedSteps[i]) {
          updatedSteps[i].completed = true;
          updatedSteps[i].completedTime = task.completion || new Date().toISOString();
        }
      });
      setChecklistSteps(updatedSteps);
    } else {
      setCurrentStep(1);
    }
    startTimer();
  };

  const handleStartNewSession = () => {
    if (!isOperations) {
      alert('Only Operations team can start new sessions.');
      return;
    }
    if (restartId) {
      for (let i = 0; i < 4; i++) localStorage.removeItem(`currentSubsetId_${restartId}_${i}`);
    }
    localStorage.removeItem('brokerRestartId');
    setAllSetsCompleted(false);
    setRestartId(null);
    setBrokerStatus(null);
    setSelectedSetIndex(null);
    setCurrentSubsetId(null);
    setCurrentStep(1);
    setActivityLog([]);
    setChecklistSteps(checklistSteps.map(s => ({ ...s, completed: false, completedTime: null, ackBy: null, ackTime: null })));
    if (timer) {
      clearInterval(timer);
      setTimer(null);
    }
    initializeRestartId();
  };

  const startTimer = () => {
    if (timer) clearInterval(timer);
    setTimeElapsed(0);
    const newTimer = setInterval(() => setTimeElapsed(prev => prev + 1), 1000);
    setTimer(newTimer);
  };

  const logActivity = (type, message, data = null) => {
    const logEntry = { timestamp: new Date(), type, message, data };
    console.log(`[${type}] ${message}`, data);
    setActivityLog(prev => [logEntry, ...prev].slice(0, 50));
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#ff7675';
      case 'started': return '#74b9ff';
      case 'completed': return '#00b894';
      default: return '#636e72';
    }
  };

  const getNextSetIndex = () => brokerStatus?.currSet?.length || 0;

  const handleNumericInput = (e, field) => {
    const value = e.target.value.replace(/\D/g, '');
    if (field === 'infraId') setSetStartData({ ...setStartData, infraId: value });
    else if (field === 'supportId') setSupportAckData({ ...supportAckData, id: value });
  };

  const handleRefreshStatus = async () => {
    if (!restartId) return;
    setLoading(true);
    try {
      await fetchBrokerStatus(restartId, false);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !restartId && !allSetsCompleted) {
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

  if (allSetsCompleted) {
    return (
      <div className="tasks-list-page">
        <div className="tasks-list-header completion-header">
          <div className="header-content">
            <div className="completion-icon-large">🎉</div>
            <h1>Broker Restart Activity Completed!</h1>
            <p>All 4 sets have been successfully completed</p>
          </div>
        </div>

        <section className="completion-section">
          <div className="completion-summary">
            <h3>✅ Completed Sets Summary</h3>
            <div className="sets-grid">
              {brokerStatus?.currSet?.slice(0, 4).map((set, index) => (
                <div key={index} className="set-card set-card-completed" style={{ borderLeft: `4px solid ${getStatusColor(set.status)}` }}>
                  <div className="set-header">
                    <h3>Set {index + 1}</h3>
                    <span className="set-status set-status-completed">✅ COMPLETED</span>
                  </div>
                  <div className="set-details">
                    {set.infraName && <p className="infra-name"><strong>Infrastructure:</strong> {set.infraName}</p>}
                    {set.supportName && (
                      <div className="set-support-ack">
                        <strong>Support Acknowledgment:</strong><br />{set.supportName}
                        {set.supportTime && set.supportTime !== 'Pending' && <><br /><small>{format(new Date(set.supportTime), 'MMM d, h:mm:ss a')}</small></>}
                      </div>
                    )}
                    <p className="set-progress-info"><span>Steps completed: {set.subTasks?.length || 0}/10</span></p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {isOperations && (
            <button onClick={handleStartNewSession} className="btn-primary btn-large">
              🔄 Start New Broker Restart Session
            </button>
          )}
        </section>

        {activityLog.length > 0 && (
          <section className="activity-log-section">
            <h2>📜 Activity Log</h2>
            <div className="activity-log-container">
              {activityLog.slice(0, 20).map((log, index) => (
                <div key={index} className="log-entry">
                  <div className="log-time">{format(new Date(log.timestamp), 'HH:mm:ss')}</div>
                  <div className="log-message">{log.message}</div>
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
      <div className="tasks-list-header">
        <div className="header-content">
          <h1>📝 Night Broker Restart Checklist</h1>
          <div className="header-details">
            {restartId && <p>Restart ID: <strong>{restartId}</strong></p>}
            <p>Completed Sets: <strong>{brokerStatus?.currSet?.filter(s => s.status === 'completed').length || 0}/4</strong></p>
            {currentSubsetId && selectedSetIndex !== null && <p>Current Subset ID: <strong>{currentSubsetId}</strong></p>}
            <p>User Level: <strong style={{ color: isSupport ? '#00b894' : isOperations ? '#74b9ff' : '#ff7675' }}>
              {isSupport ? 'Support Team' : isOperations ? 'Operations Team' : userLevel}
            </strong></p>
            <button onClick={handleRefreshStatus} className="btn-refresh" disabled={loading}>
              {loading ? '🔄 Refreshing...' : '🔄 Refresh Status'}
            </button>
          </div>
        </div>
      </div>

      {selectedSetIndex === null && (
        <section className="sets-section">
          <h2>📊 Available Sets ({brokerStatus?.currSet?.length || 0}/4)</h2>
          <div className="sets-grid">
            {brokerStatus?.currSet?.map((set, index) => (
              <div key={index} className="set-card" style={{ borderLeft: `4px solid ${getStatusColor(set.status)}` }}>
                <div className="set-header">
                  <h3>Set {index + 1}</h3>
                  <span className="set-status" style={{ color: getStatusColor(set.status) }}>{set.status.toUpperCase()}</span>
                </div>
                <div className="set-details">
                  {set.subSetsId && <p className="subset-id">Subset ID: {set.subSetsId}</p>}
                  {set.infraName && <p className="infra-name">Infra: {set.infraName}</p>}
                  {set.supportName && set.supportName !== 'pending' && (
                    <div className="set-support-ack"><strong>Support Ack:</strong> {set.supportName}</div>
                  )}
                </div>
                {set.status === 'started' && (!set.endTime || set.endTime === 'Present') && (
                  <button onClick={() => handleResumeSet(index, set)} className="complete-btn">Resume This Set</button>
                )}
                {set.status === 'completed' && (
                  <div className="set-completed"><span>✅ Completed</span></div>
                )}
              </div>
            ))}

            {(!brokerStatus?.currSet || brokerStatus.currSet.length < 4) && isOperations && (
              <button onClick={() => handleSetStart(getNextSetIndex())} className="set-card click-prompt" style={{ borderLeft: '4px solid #74b9ff' }}>
                <h3>➕ Start Set {getNextSetIndex() + 1}</h3>
                <p>Click to begin</p>
              </button>
            )}
          </div>
        </section>
      )}

      {showSetModal && (
        <div className="modal-overlay" onClick={() => setShowSetModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🔐 Start Set {selectedSetIndex + 1}</h2>
              <p>Enter infrastructure details to begin</p>
            </div>
            <form onSubmit={handleSetStartSubmit} className="modal-form">
              <div className="form-group">
                <label htmlFor="infraName">Infrastructure Name</label>
                <input type="text" id="infraName" value={setStartData.infraName} onChange={(e) => setSetStartData({ ...setStartData, infraName: e.target.value })} placeholder="Enter infra name" required className="form-input" />
              </div>
              <div className="form-group">
                <label htmlFor="infraId">Infrastructure ID</label>
                <input type="text" id="infraId" value={setStartData.infraId} onChange={(e) => handleNumericInput(e, 'infraId')} placeholder="Enter infra ID" required className="form-input" pattern="\d+" />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowSetModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Starting...' : 'Start Set'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {supportAckModal && isSupport && (
        <div className="modal-overlay" onClick={() => setSupportAckModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🛡️ Complete Set {selectedSetIndex + 1}</h2>
              <p>Enter support team acknowledgment details</p>
            </div>
            <form onSubmit={handleSupportAckSubmit} className="modal-form">
              <div className="form-group">
                <label htmlFor="supportName">Support Team Member Name</label>
                <input type="text" id="supportName" value={supportAckData.name} onChange={(e) => setSupportAckData({ ...supportAckData, name: e.target.value })} placeholder="Enter name" required className="form-input" />
              </div>
              <div className="form-group">
                <label htmlFor="supportId">Support Member ID</label>
                <input type="text" id="supportId" value={supportAckData.id} onChange={(e) => handleNumericInput(e, 'supportId')} placeholder="Enter ID" required className="form-input" pattern="\d+" />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setSupportAckModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Processing...' : 'Complete Set'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedSetIndex !== null && (
        <>
          <div className="user-info-banner">
            <div className="user-info-content">
              <span className="user-label">📍 Current Set:</span>
              <span className="user-name">Set {selectedSetIndex + 1} of 4</span>
              <span className="user-id">Subset ID: {currentSubsetId || 'Loading...'}</span>
              {brokerStatus?.currSet?.[selectedSetIndex]?.infraName && <span className="infra-info">Infra: {brokerStatus.currSet[selectedSetIndex].infraName}</span>}
            </div>
            <div className="current-timer">⏱️ Step Time: {formatTime(timeElapsed)}</div>
          </div>

          <section className="checklist-section">
            <div className="checklist-header">
              <h2>📋 Restart Procedure Checklist</h2>
              {!isOperations && <span className="readonly-badge">👁️ Read-Only View</span>}
            </div>
            <div className="timeline-container">
              {checklistSteps.map((step, index) => (
                <div key={step.id} className={`timeline-step ${step.completed ? 'completed' : ''} ${currentStep === step.id ? 'current' : ''}`}>
                  <div className="step-marker">
                    <div className="step-number">{step.id}</div>
                    {index < checklistSteps.length - 1 && <div className="step-connector"></div>}
                  </div>
                  <div className="step-content">
                    <div className="step-title-container">
                      <h3 className="step-title">{step.title}</h3>
                      <div className="step-status-indicator">
                        {step.completed ? (
                          <span className="status-completed">✅ Completed</span>
                        ) : currentStep === step.id ? (
                          <span className="status-current">▶️ In Progress</span>
                        ) : (
                          <span className="status-pending">⏳ Pending</span>
                        )}
                      </div>
                    </div>
                    <p className="step-description">{step.description}</p>
                    
                    {step.completedTime && (
                      <div className="step-completed-time">
                        <small>Completed at: {format(new Date(step.completedTime), 'h:mm:ss a')}</small>
                      </div>
                    )}
                    
                    {step.id === 11 && step.ackBy && (
                      <div className="step-support-ack">
                        <strong>Acknowledged by:</strong> {step.ackBy}
                        {step.ackTime && <span> at {format(new Date(step.ackTime), 'h:mm:ss a')}</span>}
                      </div>
                    )}

                    <div className="step-actions">
                      {isOperations && currentStep === step.id && step.id !== 11 && !step.completed && (
                        <button onClick={() => completeStep(step.id)} className="btn-complete-step" disabled={processingStep.current}>
                          {processingStep.current ? 'Processing...' : 'Mark as Complete'}
                        </button>
                      )}
                      
                      {isSupport && currentStep === 11 && step.id === 11 && !step.completed && (
                        <button onClick={handleSupportAckClick} className="btn-support-ack">
                          Acknowledge as Support Team
                        </button>
                      )}
                      
                      {!isSupport && currentStep === 11 && step.id === 11 && !step.completed && (
                        <div className="waiting-support">
                          <span className="waiting-text">⏳ Waiting for Support team acknowledgment...</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="checklist-footer">
              <div className="progress-summary">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${((currentStep - 1) / 11) * 100}%` }}></div>
                </div>
                <div className="progress-text">
                  Progress: {currentStep - 1} of 11 steps completed
                </div>
              </div>
              <div className="current-step-info">
                <span className="current-step-label">Current Step:</span>
                <span className="current-step-number">{currentStep} - {checklistSteps[currentStep - 1]?.title}</span>
              </div>
            </div>
          </section>
        </>
      )}

      <section className="activity-log-section">
        <div className="activity-log-header">
          <h2>📜 Recent Activity Log</h2>
          <button className="btn-clear-log" onClick={() => setActivityLog([])} disabled={activityLog.length === 0}>
            Clear Log
          </button>
        </div>
        <div className="activity-log-container">
          {activityLog.length > 0 ? (
            activityLog.map((log, index) => (
              <div key={index} className={`log-entry ${log.type}`}>
                <div className="log-time">{format(new Date(log.timestamp), 'HH:mm:ss')}</div>
                <div className="log-message">{log.message}</div>
                <div className={`log-type-tag ${log.type}`}>{log.type}</div>
              </div>
            ))
          ) : (
            <div className="no-logs">No activity logs yet.</div>
          )}
        </div>
      </section>

      <div className="footer-info">
        <p>
          <strong>Note:</strong> 
          {isOperations 
            ? " You are part of the Operations team. You can start sets and mark checklist steps as complete."
            : isSupport
            ? " You are part of the Support team. You can only acknowledge completion at Step 11."
            : " You have limited access to view only."}
        </p>
        <p className="session-info">Session ID: {restartId || 'Not started'} | Total Sets: {brokerStatus?.currSet?.length || 0}/4</p>
      </div>
    </div>
  );
};

export default TasksList;
