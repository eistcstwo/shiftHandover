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
  // Get user level from localStorage (normalized safely)
  const rawUserLevel = localStorage.getItem('userlevel') || '';
  const normalizedUserLevel = rawUserLevel.toLowerCase();
  const isSupport = normalizedUserLevel === 'support';
  const isOperations = ['l1', 'l2', 'admin'].includes(normalizedUserLevel);

  // State for restart ID management
  const [restartId, setRestartId] = useState(null);
  const [brokerStatus, setBrokerStatus] = useState(null);
  const [currentSubsetId, setCurrentSubsetId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allSetsCompleted, setAllSetsCompleted] = useState(false);
  const [newSessionLoading, setNewSessionLoading] = useState(false);

  // ── NEW: Reset confirmation dialog state ──────────────────────────────────
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  // ─────────────────────────────────────────────────────────────────────────

  // Refs to track state and prevent race conditions
  const isInitializing = useRef(true);
  const processingStep = useRef(false);
  const statusPollingInterval = useRef(null);
  const currentStepRef = useRef(null);

  // State for set selection modal
  const [showSetModal, setShowSetModal] = useState(false);
  const [selectedSetIndex, setSelectedSetIndex] = useState(null);
  const [setStartData, setSetStartData] = useState({
    infraName: '',
    infraId: ''
  });
  const [showSetManualForm, setShowSetManualForm] = useState(false);
  const [selectedServerSet, setSelectedServerSet] = useState('');
  const [showServerSetSelection, setShowServerSetSelection] = useState(false);
  const [showCustomSetForm, setShowCustomSetForm] = useState(false);
  const [customSetData, setCustomSetData] = useState({
    name: '',
    servers: ''
  });

  // Predefined server sets
  const [serverSets, setServerSets] = useState([
    {
      name: '25 Series - Set 1',
      servers: '155, 156, 157, 173, 174, 73, 74, 55, 56, 57, 63, 64, 163, 164, 10, 11, 12, 110, 111, 112, 41, 42, 43, 141, 142, 143, 31, 32, 134, 135, 192, 196, 197, 68, 69, 168, 169'
    },
    {
      name: '25 Series - Set 2',
      servers: '158, 159, 160, 175, 176, 75, 58, 59, 65, 66, 67, 165, 166, 13, 14, 113, 114, 115, 44, 45, 144, 145, 146, 33, 34, 131, 132, 133, 190, 191, 194, 195, 70, 71, 170, 171'
    },
    {
      name: '24 Series - Set 3',
      servers: '158, 159, 160, 175, 176, 75, 58, 59, 65, 66, 67, 165, 166, 13, 14, 113, 114, 115, 44, 45, 144, 145, 146, 33, 34, 131, 132, 133, 190, 191, 194, 195, 70, 71, 170, 171'
    },
    {
      name: '24 Series - Set 4',
      servers: '155, 156, 157, 173, 174, 73, 74, 55, 56, 57, 63, 64, 163, 164, 10, 11, 12, 110, 111, 112, 41, 42, 43, 141, 142, 143, 31, 32, 134, 135, 192, 196, 197, 68, 69, 168, 169'
    }
  ]);

  // State for support acknowledgment modal
  const [supportAckModal, setSupportAckModal] = useState(false);
  const [supportAckData, setSupportAckData] = useState({
    name: '',
    id: ''
  });
  const [showSupportManualForm, setShowSupportManualForm] = useState(false);

  // State for current step tracking
  const [currentStep, setCurrentStep] = useState(1);
  const [timer, setTimer] = useState(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [activityLog, setActivityLog] = useState([]);

  // Checklist steps definition
  const [checklistSteps, setChecklistSteps] = useState([
    { id: 1,  title: 'CACHE UPDATED AFTER 12:00 A.M.',          description: 'Ensure cache is updated after midnight',              completed: false, completedTime: null },
    { id: 2,  title: 'SETS READY FOR RESTART',                   description: 'Prepare all server sets for restart',               completed: false, completedTime: null },
    { id: 3,  title: 'ISOLATOR DOWN',                            description: 'Bring isolator down for maintenance',               completed: false, completedTime: null },
    { id: 4,  title: 'BROKER STOPPED',                           description: 'Stop all broker services',                          completed: false, completedTime: null },
    { id: 5,  title: 'HEARTBEAT & CACHE BROKER STARTED',         description: 'Start heartbeat and cache broker services',         completed: false, completedTime: null },
    { id: 6,  title: 'ALL BROKER STARTED',                       description: 'Start all broker services',                         completed: false, completedTime: null },
    { id: 7,  title: 'CACHE HIT & WORKLOAD DONE',                description: 'Verify cache hits and complete workload',           completed: false, completedTime: null },
    { id: 8,  title: 'UDP CHANGES (TIMEOUT & URL CHANGES)',      description: 'Apply UDP configuration changes',                   completed: false, completedTime: null },
    { id: 9,  title: 'LOGS VERIFICATION DONE',                   description: 'Verify all system logs',                           completed: false, completedTime: null },
    { id: 10, title: 'ISOLATOR UP',                              description: 'Bring isolator back online',                        completed: false, completedTime: null },
    { id: 11, title: 'INFORM END OF ACTIVITY TO SUPPORT TEAM',   description: 'Notify support team about activity completion',     completed: false, completedTime: null, requiresAck: true, ackBy: null, ackTime: null }
  ]);

  // Helper to normalize API response
  const normalizeBrokerStatus = (statusData) => {
    if (!statusData) return null;
    console.log('Normalizing broker status:', statusData);
    if (statusData.currSet && typeof statusData.currSet === 'object' && !Array.isArray(statusData.currSet)) {
      console.log('Converting currSet from object to array');
      return { ...statusData, currSet: [statusData.currSet] };
    }
    return statusData;
  };

  // STEP 1: Initialize
  useEffect(() => {
    initializeRestartId();
    return () => {
      if (timer) clearInterval(timer);
      if (statusPollingInterval.current) clearInterval(statusPollingInterval.current);
    };
  }, []);

  // Auto-refresh status every 30 seconds
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

  // Auto-scroll to current step
  useEffect(() => {
    if (currentStepRef.current && selectedSetIndex !== null) {
      setTimeout(() => {
        currentStepRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [currentStep, selectedSetIndex]);

  // Extract subSetsId from multiple response shapes
  const extractSubsetId = (input) => {
    let response = input;
    if (typeof input === 'string') {
      try { response = JSON.parse(input); } catch (e) { return undefined; }
    }
    if (!response || typeof response !== 'object') return undefined;
    const pickId = (obj) => {
      if (!obj || typeof obj !== 'object') return undefined;
      if (obj.subSetsId != null) return obj.subSetsId;
      if (obj.subSetId  != null) return obj.subSetId;
      if (obj.subsetId  != null) return obj.subsetId;
      return undefined;
    };
    const topLevelId = pickId(response);
    if (topLevelId != null) return topLevelId;
    if (response.currSet && typeof response.currSet === 'object' && !Array.isArray(response.currSet)) {
      const id = pickId(response.currSet);
      if (id != null) return id;
    }
    if (response.currSet && Array.isArray(response.currSet)) {
      const activeSets = response.currSet.filter(
        (set) => set && set.status === 'started' && (!set.endTime || set.endTime === 'Present')
      );
      if (activeSets.length > 0) {
        const id = pickId(activeSets[activeSets.length - 1]);
        if (id != null) return id;
      }
      const id = pickId(response.currSet[response.currSet.length - 1]);
      if (id != null) return id;
    }
    console.warn('subset id not found in response.');
    return undefined;
  };

  const initializeRestartId = async () => {
    setLoading(true);
    try {
      const storedRestartId = localStorage.getItem('brokerRestartId');
      if (storedRestartId) {
        setRestartId(parseInt(storedRestartId));
        logActivity('INIT', `Using stored restart ID: ${storedRestartId}`);
        const statusResponse = await getBrokerRestartStatus(parseInt(storedRestartId));
        const normalizedStatus = normalizeBrokerStatus(statusResponse);
        setBrokerStatus(normalizedStatus);
        logActivity('API_SUCCESS', 'Broker status fetched', normalizedStatus);

        if (isSupport && normalizedStatus?.currSet && normalizedStatus.currSet.length >= 4) {
          const completedCount = normalizedStatus.currSet.filter(
            (set) => set.status === 'completed' && (set.endTime && set.endTime !== 'Present')
          ).length;
          if (completedCount >= 4) {
            for (let i = 0; i < 4; i++) {
              localStorage.removeItem(`currentSubsetId_${storedRestartId}_${i}`);
              localStorage.removeItem(`infraId_${storedRestartId}_${i}`);
              localStorage.removeItem(`infraName_${storedRestartId}_${i}`);
              localStorage.removeItem(`serverSet_${storedRestartId}_${i}`);
              localStorage.removeItem(`serverList_${storedRestartId}_${i}`);
            }
            localStorage.removeItem('brokerRestartId');
            setAllSetsCompleted(false);
            const response = await getRestartId();
            const newRestartId = response.restartId;
            setRestartId(newRestartId);
            localStorage.setItem('brokerRestartId', newRestartId);
            await fetchBrokerStatus(newRestartId);
            return;
          }
        }
        await processBrokerStatus(normalizedStatus, parseInt(storedRestartId));
      } else {
        const response = await getRestartId();
        const newRestartId = response.restartId;
        setRestartId(newRestartId);
        localStorage.setItem('brokerRestartId', newRestartId);
        logActivity('API_SUCCESS', `New restart ID obtained: ${newRestartId}`, response);
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

  const processBrokerStatus = async (statusResponse, rid, silent = false) => {
    if (statusResponse.currSet && statusResponse.currSet.length >= 4) {
      const completedCount = statusResponse.currSet.filter(
        (set) => set.status === 'completed' && (set.endTime && set.endTime !== 'Present')
      ).length;
      if (completedCount >= 4) {
        setAllSetsCompleted(true);
        setSelectedSetIndex(null);
        setCurrentSubsetId(null);
        if (!silent) logActivity('INFO', 'All 4 sets completed. Ready to start new session.');
        return;
      }
    }

    if (statusResponse.currSet && statusResponse.currSet.length > 0) {
      statusResponse.currSet.forEach((set, index) => {
        if (set.infraId && set.infraName) {
          const storedInfraId   = localStorage.getItem(`infraId_${rid}_${index}`);
          const storedInfraName = localStorage.getItem(`infraName_${rid}_${index}`);
          if (!storedInfraId || !storedInfraName) {
            localStorage.setItem(`infraId_${rid}_${index}`, set.infraId);
            localStorage.setItem(`infraName_${rid}_${index}`, set.infraName);
            if (set.serverSet)  localStorage.setItem(`serverSet_${rid}_${index}`, set.serverSet);
            if (set.serverList) localStorage.setItem(`serverList_${rid}_${index}`, set.serverList);
            if (!silent) logActivity('RESTORE', `Restored infra info from API for set ${index + 1}`);
          }
        }
      });
    }

    if (statusResponse.currSet && statusResponse.currSet.length > 0) {
      const activeSets = statusResponse.currSet.filter(
        (set) => set.status === 'started' && (!set.endTime || set.endTime === 'Present')
      );
      if (activeSets.length > 0) {
        const lastActiveSet = activeSets[activeSets.length - 1];
        const setIndex = statusResponse.currSet.indexOf(lastActiveSet);
        setSelectedSetIndex(setIndex);
        const subsetId = extractSubsetId(lastActiveSet);
        if (subsetId) {
          setCurrentSubsetId(subsetId);
          localStorage.setItem(`currentSubsetId_${rid}_${setIndex}`, subsetId);
          if (!silent) logActivity('INFO', `Found active subset ID: ${subsetId} for set ${setIndex + 1}`);
        } else {
          const storedSubsetId = localStorage.getItem(`currentSubsetId_${rid}_${setIndex}`);
          if (storedSubsetId) {
            setCurrentSubsetId(storedSubsetId);
            if (!silent) logActivity('INFO', `Using stored subset ID: ${storedSubsetId}`);
          }
        }
        if (lastActiveSet.subTasks && lastActiveSet.subTasks.length > 0) {
          const completedStepsCount = lastActiveSet.subTasks.length;
          setCurrentStep(completedStepsCount + 1);
          const updatedSteps = [...checklistSteps];
          lastActiveSet.subTasks.forEach((task, index) => {
            if (updatedSteps[index]) {
              updatedSteps[index].completed = true;
              updatedSteps[index].completedTime = task.completion || new Date().toISOString();
            }
          });
          setChecklistSteps(updatedSteps);
          if (!silent) logActivity('RESUME', `Resuming set ${setIndex + 1} from step ${completedStepsCount + 1}`);
        } else {
          if (!silent) logActivity('RESUME', `Starting new set ${setIndex + 1} from step 1`);
          setCurrentStep(1);
        }
        if (!timer) startTimer();
      } else {
        if (!silent) logActivity('INFO', 'No active set found. Ready to start a new set.');
        setSelectedSetIndex(null);
        setCurrentSubsetId(null);
      }
    } else {
      if (!silent) logActivity('INFO', 'No sets started yet. Ready to begin.');
      setSelectedSetIndex(null);
      setCurrentSubsetId(null);
    }
  };

  const fetchBrokerStatus = async (rid, silent = false) => {
    try {
      const statusResponse = await getBrokerRestartStatus(rid);
      const normalizedStatus = normalizeBrokerStatus(statusResponse);
      setBrokerStatus(normalizedStatus);
      if (!silent) logActivity('API_SUCCESS', 'Broker status fetched', normalizedStatus);
      await processBrokerStatus(normalizedStatus, rid, silent);
    } catch (error) {
      console.error('Error fetching broker status:', error);
      if (!silent) logActivity('API_ERROR', `Failed to fetch status: ${error.message}`);
    }
  };

  // ── NEW: handleResetSession ───────────────────────────────────────────────
  // Wipes all local state + localStorage and calls getRestartId + opens the
  // Set-1 start modal so the user immediately hits startBrokerRestartTask.
  const handleResetSession = async () => {
    if (!isOperations) {
      alert('Only Operations team can reset the session.');
      return;
    }
    setResetLoading(true);
    logActivity('RESET', 'Resetting session — clearing all data and starting fresh');

    try {
      // 1. Stop any running timers / polling
      if (timer) { clearInterval(timer); setTimer(null); }
      if (statusPollingInterval.current) {
        clearInterval(statusPollingInterval.current);
        statusPollingInterval.current = null;
      }

      // 2. Clear localStorage for current (and the last known) restart session
      const idsToClear = new Set();
      if (restartId) idsToClear.add(String(restartId));
      const stored = localStorage.getItem('brokerRestartId');
      if (stored) idsToClear.add(stored);

      idsToClear.forEach((id) => {
        for (let i = 0; i < 4; i++) {
          localStorage.removeItem(`currentSubsetId_${id}_${i}`);
          localStorage.removeItem(`infraId_${id}_${i}`);
          localStorage.removeItem(`infraName_${id}_${i}`);
          localStorage.removeItem(`serverSet_${id}_${i}`);
          localStorage.removeItem(`serverList_${id}_${i}`);
        }
      });
      localStorage.removeItem('brokerRestartId');

      // 3. Reset all React state
      setAllSetsCompleted(false);
      setRestartId(null);
      setBrokerStatus(null);
      setSelectedSetIndex(null);
      setCurrentSubsetId(null);
      setCurrentStep(1);
      setTimeElapsed(0);
      setActivityLog([]);

      const resetSteps = checklistSteps.map((step) => ({
        ...step,
        completed: false,
        completedTime: null,
        ackBy: null,
        ackTime: null
      }));
      setChecklistSteps(resetSteps);

      // 4. Get a brand-new restart ID from the backend
      const response = await getRestartId();
      const newRestartId = response.restartId;
      setRestartId(newRestartId);
      localStorage.setItem('brokerRestartId', newRestartId);
      logActivity('API_SUCCESS', `New restart ID obtained after reset: ${newRestartId}`);

      // 5. Fetch fresh status (will show 0 sets started)
      await fetchBrokerStatus(newRestartId, true);

      // 6. Close confirm dialog and immediately open the Start-Set-1 modal
      setShowResetConfirm(false);
      setSelectedSetIndex(0);
      setShowSetModal(true);
      setShowServerSetSelection(true);
      setShowSetManualForm(false);
      setShowCustomSetForm(false);
      setSelectedServerSet('');
      setCustomSetData({ name: '', servers: '' });
      setSetStartData({ infraName: '', infraId: '' });

      logActivity('RESET', 'Session reset complete — ready to start Set 1');
    } catch (error) {
      console.error('Error resetting session:', error);
      logActivity('API_ERROR', `Reset failed: ${error.message}`);
      alert(`Reset failed: ${error.message}`);
    } finally {
      setResetLoading(false);
    }
  };
  // ─────────────────────────────────────────────────────────────────────────

  const handleStartNewSession = async () => {
    if (!isOperations) {
      alert('Only Operations team can start new sessions.');
      return;
    }
    logActivity('NEW_SESSION', 'Starting new broker restart session from completion page');
    try {
      if (restartId) {
        for (let i = 0; i < 4; i++) {
          localStorage.removeItem(`currentSubsetId_${restartId}_${i}`);
          localStorage.removeItem(`infraId_${restartId}_${i}`);
          localStorage.removeItem(`infraName_${restartId}_${i}`);
          localStorage.removeItem(`serverSet_${restartId}_${i}`);
          localStorage.removeItem(`serverList_${restartId}_${i}`);
        }
      }
      localStorage.removeItem('brokerRestartId');
      setAllSetsCompleted(false);
      setRestartId(null);
      setBrokerStatus(null);
      setSelectedSetIndex(0);
      setCurrentSubsetId(null);
      setCurrentStep(1);
      setActivityLog([]);
      const resetSteps = checklistSteps.map((step) => ({
        ...step, completed: false, completedTime: null, ackBy: null, ackTime: null
      }));
      setChecklistSteps(resetSteps);
      if (timer) { clearInterval(timer); setTimer(null); }
      logActivity('NEW_SESSION', 'Session reset complete. Opening modal to start Set 1.');
      setShowSetModal(true);
      setShowServerSetSelection(true);
      setShowSetManualForm(false);
      setShowCustomSetForm(false);
      setSelectedServerSet('');
      setCustomSetData({ name: '', servers: '' });
      setSetStartData({ infraName: '', infraId: '' });
    } catch (error) {
      console.error('Error starting new session:', error);
      logActivity('API_ERROR', `Failed to start new session: ${error.message}`);
      alert(`Failed to start new session: ${error.message}`);
    }
  };

  const handleSetStart = (setIndex) => {
    if (!isOperations) {
      alert('Only Operations team can start new sets.');
      return;
    }
    setSelectedSetIndex(setIndex);
    setShowSetModal(true);
    setShowServerSetSelection(true);
    setShowSetManualForm(false);
    setShowCustomSetForm(false);
    setSelectedServerSet('');
    setCustomSetData({ name: '', servers: '' });
    setSetStartData({ infraName: '', infraId: '' });
  };

  const handleServerSetConfirm = () => {
    if (!selectedServerSet) {
      alert('Please select a server set before proceeding.');
      return;
    }
    logActivity('SERVER_SET', `Selected server set: ${selectedServerSet}`);
    setShowServerSetSelection(false);
  };

  const handleCreateCustomSet = () => {
    setShowServerSetSelection(false);
    setShowCustomSetForm(true);
    setCustomSetData({ name: '', servers: '' });
  };

  const handleCustomSetSubmit = (e) => {
    e.preventDefault();
    if (!customSetData.name.trim()) { alert('Please enter a name for the custom set.'); return; }
    if (!customSetData.servers.trim()) { alert('Please enter server numbers.'); return; }
    const newSet = { name: customSetData.name.trim(), servers: customSetData.servers.trim(), isCustom: true };
    setServerSets([...serverSets, newSet]);
    setSelectedServerSet(newSet.name);
    logActivity('CUSTOM_SET', `Created custom server set: ${newSet.name}`);
    setShowCustomSetForm(false);
    setCustomSetData({ name: '', servers: '' });
  };

  const handleUseCurrentUserInfoForSet = async () => {
    const uidd     = localStorage.getItem('uidd') || '';
    const username = localStorage.getItem('username') || '';
    if (!uidd || !username) {
      alert('User information not found. Please enter details manually.');
      return;
    }
    logActivity('USER_INFO', `Auto-filled with current user: ${username} (${uidd})`);
    await submitSetStart(username, uidd);
  };

  const handleEnterDetailsManuallyForSet = () => {
    setShowSetManualForm(true);
    setSetStartData({ infraName: '', infraId: '' });
  };

  const submitSetStart = async (infraName, infraId) => {
    if (processingStep.current) return;
    processingStep.current = true;
    setLoading(true);
    try {
      const selectedSet = serverSets.find((s) => s.name === selectedServerSet);
      const serverList  = selectedSet ? selectedSet.servers : '';
      logActivity('SET_START', `Starting set ${selectedSetIndex + 1}`, { infraName, infraId, serverSet: selectedServerSet, serverList });

      let restartIdToPass = null;
      const setNumber = selectedSetIndex + 1;

      if (!brokerStatus?.currSet || brokerStatus.currSet.length === 0) {
        restartIdToPass = null;
        logActivity('INFO', 'Starting first set — creating new session');
      } else if (!allSetsCompleted && brokerStatus?.currSet?.length > 0) {
        restartIdToPass = restartId;
        logActivity('INFO', `Continuing session ${restartId} with set ${setNumber}`);
      }

      logActivity('INFO', `Calling API with restartId: ${restartIdToPass ?? 'null'}, setNumber: ${setNumber}`);

      const response = await startBrokerRestartTask(
        infraId,
        infraName,
        restartIdToPass,
        setNumber,
        selectedServerSet,
        serverList
      );

      logActivity('API_SUCCESS', `Set ${selectedSetIndex + 1} started successfully`, response);

      if (response.brokerRestartId) {
        const newRestartId = response.brokerRestartId;
        if (newRestartId !== restartId) {
          setRestartId(newRestartId);
          localStorage.setItem('brokerRestartId', newRestartId);
          logActivity('INFO', `New restart ID from response: ${newRestartId}`);
        }
      }

      let subsetId = extractSubsetId(response);
      if (!subsetId && response.currSet) {
        if (Array.isArray(response.currSet) && response.currSet[selectedSetIndex]) {
          subsetId = extractSubsetId(response.currSet[selectedSetIndex]);
        } else if (typeof response.currSet === 'object' && !Array.isArray(response.currSet)) {
          subsetId = extractSubsetId(response.currSet);
        }
      }
      if (!subsetId) {
        logActivity('ERROR', 'No subset ID returned. Full response: ' + JSON.stringify(response));
        throw new Error('No subset ID received from server');
      }

      setCurrentSubsetId(subsetId);
      logActivity('INFO', `Subset ID obtained: ${subsetId} for set ${selectedSetIndex + 1}`);

      const currentRestartId = response.brokerRestartId ?? restartId;
      if (currentRestartId) {
        localStorage.setItem(`currentSubsetId_${currentRestartId}_${selectedSetIndex}`, subsetId);
        localStorage.setItem(`infraId_${currentRestartId}_${selectedSetIndex}`, infraId);
        localStorage.setItem(`infraName_${currentRestartId}_${selectedSetIndex}`, infraName);
        localStorage.setItem(`serverSet_${currentRestartId}_${selectedSetIndex}`, selectedServerSet);
        localStorage.setItem(`serverList_${currentRestartId}_${selectedSetIndex}`, serverList);
      }

      if (allSetsCompleted) { setAllSetsCompleted(false); }

      const normalizedResponse = normalizeBrokerStatus(response);
      setBrokerStatus(normalizedResponse);
      setShowSetModal(false);
      setShowServerSetSelection(false);
      setShowSetManualForm(false);
      setShowCustomSetForm(false);
      setSelectedServerSet('');
      setCustomSetData({ name: '', servers: '' });

      setCurrentStep(1);
      const resetSteps = checklistSteps.map((step) => ({
        ...step, completed: false, completedTime: null, ackBy: null, ackTime: null
      }));
      setChecklistSteps(resetSteps);

      startTimer();
      logActivity('SET_INIT', `Set ${selectedSetIndex + 1} initialized with server set: ${selectedServerSet}`);
    } catch (error) {
      console.error('Error starting set:', error);
      logActivity('API_ERROR', `Failed to start set: ${error.message}`);
      alert(`Failed to start set: ${error.message}`);
    } finally {
      setLoading(false);
      processingStep.current = false;
    }
  };

  const handleSetStartSubmit = async (e) => {
    e.preventDefault();
    await submitSetStart(setStartData.infraName, setStartData.infraId);
  };

  const handleSetModalCancel = () => {
    setShowSetModal(false);
    setShowServerSetSelection(false);
    setShowSetManualForm(false);
    setShowCustomSetForm(false);
    setSelectedServerSet('');
    setCustomSetData({ name: '', servers: '' });
    setSetStartData({ infraName: '', infraId: '' });
    if (!currentSubsetId) setSelectedSetIndex(null);
  };

  const completeStep = async (stepId) => {
    if (!isOperations) { alert('Only Operations team can mark steps as complete.'); return; }
    if (stepId !== currentStep || stepId === 11) return;
    if (!currentSubsetId) {
      alert('Error: No active subset ID found. Please start a set first.');
      return;
    }
    if (processingStep.current) return;
    processingStep.current = true;
    try {
      const step = checklistSteps[stepId - 1];
      const localStorageKey = `infraId_${restartId}_${selectedSetIndex}`;
      const storedInfraId   = localStorage.getItem(localStorageKey);

      if (!storedInfraId) {
        if (brokerStatus?.currSet?.[selectedSetIndex]?.infraId) {
          const fallbackInfraId = brokerStatus.currSet[selectedSetIndex].infraId;
          localStorage.setItem(localStorageKey, fallbackInfraId);
          await updateSubRestart(step.title, currentSubsetId, fallbackInfraId);
        } else {
          alert('Error: Infrastructure ID not found. Please refresh and try again.');
          processingStep.current = false;
          return;
        }
      } else {
        await updateSubRestart(step.title, currentSubsetId, storedInfraId);
        logActivity('API_SUCCESS', `Step ${stepId} completed: ${step.title}`);
      }

      const updatedSteps = [...checklistSteps];
      updatedSteps[stepId - 1] = { ...updatedSteps[stepId - 1], completed: true, completedTime: new Date().toISOString() };
      setChecklistSteps(updatedSteps);

      if (stepId < checklistSteps.length) {
        setTimeout(() => { setCurrentStep(stepId + 1); setTimeElapsed(0); }, 500);
      }
    } catch (error) {
      console.error('Error completing step:', error);
      logActivity('API_ERROR', `Failed to complete step ${stepId}: ${error.message}`);
      alert(`Failed to complete step: ${error.message}`);
    } finally {
      processingStep.current = false;
    }
  };

  const handleSupportAckClick = () => {
    if (!isSupport) { alert('Only support team members can acknowledge completion.'); return; }
    if (currentStep !== 11) { alert('Support acknowledgment is only available at step 11.'); return; }
    setSupportAckModal(true);
    setShowSupportManualForm(false);
    setSupportAckData({ name: '', id: '' });
  };

  const handleUseCurrentUserInfoForSupport = async () => {
    const uidd     = localStorage.getItem('uidd') || '';
    const username = localStorage.getItem('username') || '';
    if (!uidd || !username) { alert('User information not found. Please enter details manually.'); return; }
    logActivity('USER_INFO', `Auto-filled support info: ${username} (${uidd})`);
    await submitSupportAck(username, uidd);
  };

  const handleEnterDetailsManuallyForSupport = () => {
    setShowSupportManualForm(true);
    setSupportAckData({ name: '', id: '' });
  };

  const submitSupportAck = async (supportName, supportId) => {
    if (!currentSubsetId) { alert('Error: No active subset ID found.'); return; }
    if (processingStep.current) return;
    processingStep.current = true;
    setLoading(true);
    const completedSetIndex = selectedSetIndex;
    try {
      const updateResponse = await updateSetRestart(supportId, supportName, currentSubsetId);
      logActivity('API_SUCCESS', `Support acknowledgment by ${supportName} (${supportId})`, updateResponse);

      const updatedSteps = [...checklistSteps];
      updatedSteps[10] = { ...updatedSteps[10], completed: true, completedTime: new Date().toISOString(), ackBy: supportName, ackTime: new Date().toISOString() };
      setChecklistSteps(updatedSteps);

      localStorage.removeItem(`infraId_${restartId}_${completedSetIndex}`);
      localStorage.removeItem(`infraName_${restartId}_${completedSetIndex}`);
      localStorage.removeItem(`serverSet_${restartId}_${completedSetIndex}`);
      localStorage.removeItem(`serverList_${restartId}_${completedSetIndex}`);

      const statusResponse    = await getBrokerRestartStatus(restartId);
      const normalizedStatus  = normalizeBrokerStatus(statusResponse);
      setBrokerStatus(normalizedStatus);

      const completedCount = normalizedStatus.currSet?.filter(
        (set) => set.status === 'completed' && (set.endTime && set.endTime !== 'Present')
      ).length ?? 0;

      setSupportAckModal(false);
      setShowSupportManualForm(false);
      setSupportAckData({ name: '', id: '' });

      if (completedCount >= 4) {
        setAllSetsCompleted(true);
        setSelectedSetIndex(null);
        setCurrentSubsetId(null);
        logActivity('COMPLETE', 'All 4 sets completed!');
        if (timer) clearInterval(timer);
      } else {
        const resetStepsAfterAck = checklistSteps.map((step) => ({
          ...step, completed: false, completedTime: null, ackBy: null, ackTime: null
        }));
        setChecklistSteps(resetStepsAfterAck);
        setCurrentStep(1);
        setTimeElapsed(0);
        logActivity('SET_COMPLETE', `Set ${completedSetIndex + 1} completed. Ready for next set (${completedCount + 1}/4)`);
        await processBrokerStatus(normalizedStatus, restartId);
      }
    } catch (error) {
      console.error('Error in support acknowledgment:', error);
      logActivity('API_ERROR', `Failed: ${error.message}`);
      alert(`Failed: ${error.message}`);
      await fetchBrokerStatus(restartId);
    } finally {
      setLoading(false);
      processingStep.current = false;
    }
  };

  const handleSupportAckSubmit = async (e) => {
    e.preventDefault();
    await submitSupportAck(supportAckData.name, supportAckData.id);
  };

  const handleSupportModalCancel = () => {
    setSupportAckModal(false);
    setShowSupportManualForm(false);
    setSupportAckData({ name: '', id: '' });
  };

  const handleResumeSet = (setIndex, set) => {
    setSelectedSetIndex(setIndex);
    const subsetId = extractSubsetId(set);
    if (subsetId) {
      setCurrentSubsetId(subsetId);
    } else {
      const storedSubsetId = localStorage.getItem(`currentSubsetId_${restartId}_${setIndex}`);
      if (storedSubsetId) {
        setCurrentSubsetId(storedSubsetId);
      } else {
        alert('Cannot resume set: Missing subset ID');
        return;
      }
    }
    if (set.subTasks && set.subTasks.length > 0) {
      const stepNumber   = set.subTasks.length + 1;
      setCurrentStep(stepNumber);
      const updatedSteps = [...checklistSteps];
      set.subTasks.forEach((task, taskIndex) => {
        if (updatedSteps[taskIndex]) {
          updatedSteps[taskIndex].completed    = true;
          updatedSteps[taskIndex].completedTime = task.completion || new Date().toISOString();
        }
      });
      setChecklistSteps(updatedSteps);
    } else {
      setCurrentStep(1);
    }
    startTimer();
  };

  const startTimer = () => {
    if (timer) clearInterval(timer);
    setTimeElapsed(0);
    const newTimer = setInterval(() => { setTimeElapsed((prev) => prev + 1); }, 1000);
    setTimer(newTimer);
  };

  const logActivity = (type, message, data = null) => {
    const logEntry = { timestamp: new Date(), type, message, data };
    console.log(`[${type}] ${message}`, data);
    setActivityLog((prev) => [logEntry, ...prev].slice(0, 50));
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':   return '#ff7675';
      case 'started':   return '#74b9ff';
      case 'completed': return '#00b894';
      default:          return '#636e72';
    }
  };

  const getNextSetIndex = () => {
    if (!brokerStatus?.currSet) return 0;
    return brokerStatus.currSet.length;
  };

  const handleInfraIdInput = (e) => {
    const limited = e.target.value.replace(/\D/g, '').slice(0, 7);
    setSetStartData({ ...setStartData, infraId: limited });
  };

  const handleSupportIdInput = (e) => {
    const limited = e.target.value.replace(/\D/g, '').slice(0, 7);
    setSupportAckData({ ...supportAckData, id: limited });
  };

  const handleRefreshStatus = async () => {
    if (!restartId) return;
    setLoading(true);
    try { await fetchBrokerStatus(restartId, false); }
    finally { setLoading(false); }
  };

  const getServerSetName = (setIndex) => {
    if (!restartId) return null;
    return localStorage.getItem(`serverSet_${restartId}_${setIndex}`) || brokerStatus?.currSet?.[setIndex]?.serverSet;
  };

  const getServerList = (setIndex) => {
    if (!restartId) return null;
    return localStorage.getItem(`serverList_${restartId}_${setIndex}`) || brokerStatus?.currSet?.[setIndex]?.serverList;
  };

  // ── RENDER ────────────────────────────────────────────────────────────────

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
        <div className="completion-message">
          <div className="completion-icon">🎉</div>
          <h3>Broker Restart Activity Completed!</h3>
          <p>All 4 sets have been successfully completed</p>
          <div className="completion-summary">
            <h4>✅ Completed Sets Summary</h4>
            {(brokerStatus?.currSet ?? []).slice(0, 4).map((set, index) => {
              const serverSetName = getServerSetName(index);
              const serverList    = getServerList(index);
              return (
                <div key={index} className="set-card set-card-completed" style={{ marginBottom: '1rem' }}>
                  <div className="set-header">
                    <h3>Set {index + 1}</h3>
                    <span className="set-status set-status-completed">✅ COMPLETED</span>
                  </div>
                  <div className="set-details">
                    {serverSetName && <p className="server-set-name"><strong>Server Set:</strong> {serverSetName}</p>}
                    {serverList && (
                      <div className="server-list-display">
                        <strong>Servers:</strong>
                        <div className="server-numbers-compact">{serverList}</div>
                      </div>
                    )}
                    {set.infraName && <p className="infra-name"><strong>Infrastructure:</strong> {set.infraName}</p>}
                    {set.supportName && (
                      <div className="set-support-ack">
                        <strong>Support Acknowledgment:</strong> {set.supportName}
                        {set.supportTime && set.supportTime !== 'Pending' && (
                          <><br /><small>{format(new Date(set.supportTime), 'MMM d, h:mm:ss a')}</small></>
                        )}
                      </div>
                    )}
                    <div className="set-progress-info">
                      <span>Steps completed: {set.subTasks?.length ?? 0}/10</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {isOperations && (
            <button onClick={handleStartNewSession} className="btn-primary"
              style={{ marginTop: '2rem', fontSize: '1rem', padding: '1rem 2rem' }}
              disabled={newSessionLoading}>
              {newSessionLoading ? 'Starting New Session...' : '🔄 Start New Broker Restart Session'}
            </button>
          )}
        </div>

        {activityLog.length > 0 && (
          <div className="activity-log-section">
            <h2>📜 Activity Log</h2>
            <div className="activity-log-container">
              {activityLog.slice(0, 20).map((log, index) => (
                <div key={index} className="log-entry">
                  <div className="log-time">{format(new Date(log.timestamp), 'HH:mm:ss')}</div>
                  <div className="log-message">{log.message}</div>
                  <div className={`log-type ${log.type.includes('SUCCESS') ? 'api-success' : log.type.includes('ERROR') ? 'api-error' : 'api-call'}`}>
                    {log.type.includes('SUCCESS') ? 'SUCCESS' : log.type.includes('ERROR') ? 'ERROR' : 'API'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Normal page
  return (
    <div className="tasks-list-page">

      {/* ── RESET CONFIRMATION DIALOG ─────────────────────────────────────── */}
      {showResetConfirm && (
        <div className="modal-overlay" onClick={() => !resetLoading && setShowResetConfirm(false)}>
          <div className="modal-container reset-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="reset-warning-icon">⚠️</div>
              <h2>Reset &amp; Start New Session?</h2>
              <p>
                This will <strong>discard all current progress</strong> — including any sets that
                are started but not yet completed — and immediately begin a brand-new restart
                session from Set 1.
              </p>
            </div>
            <div className="reset-confirm-details">
              <ul>
                <li>🗑️ All in-progress set data will be cleared</li>
                <li>🔢 A new Restart ID will be obtained from the server</li>
                <li>▶️ You will be taken straight to the Start Set 1 screen</li>
              </ul>
            </div>
            <div className="modal-actions reset-modal-actions">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="btn-secondary"
                disabled={resetLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetSession}
                className="btn-danger"
                disabled={resetLoading}
              >
                {resetLoading ? '⏳ Resetting...' : '🔁 Yes, Reset & Start Fresh'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ──────────────────────────────────────────────────────────────────── */}

      <div className="tasks-list-header">
        <div className="header-content">
          <h1>📝 Night Broker Restart Checklist</h1>
          <div className="header-details">
            <p>
              <strong>Completed Sets:</strong>{' '}
              {(brokerStatus?.currSet?.filter((s) => s.status === 'completed')?.length ?? 0)}/4
            </p>
            <p>
              <strong>User Level:</strong>{' '}
              {isSupport ? 'Support Team' : isOperations ? 'Infra Team' : (rawUserLevel || 'Guest')}
            </p>
            <button onClick={handleRefreshStatus} className="btn-refresh-status" disabled={loading}>
              {loading ? '🔄 Refreshing...' : '🔄 Refresh Status'}
            </button>

            {/* ── NEW RESET BUTTON ── only visible to operations */}
            {isOperations && (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="btn-reset-session"
                disabled={loading || resetLoading}
                title="Discard current progress and start a brand-new session"
              >
                🔁 Reset &amp; Start New
              </button>
            )}
          </div>
        </div>
      </div>

      {selectedSetIndex === null && (
        <div className="sets-section">
          <h2>📊 Available Sets {(brokerStatus?.currSet?.length ?? 0)}/4</h2>
          <div className="sets-grid">
            {(brokerStatus?.currSet ?? []).map((set, index) => {
              const serverSetName = getServerSetName(index);
              const serverList    = getServerList(index);
              return (
                <div key={index}
                  className={`set-card ${set.status === 'completed' ? 'set-card-completed' : ''}`}
                  style={{ borderLeft: `4px solid ${getStatusColor(set.status)}` }}>
                  <div className="set-header">
                    <h3>Set {index + 1}</h3>
                    <span className={`set-status ${set.status === 'completed' ? 'set-status-completed' : ''}`}>
                      {set.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="set-details">
                    {serverSetName && <p className="server-set-name"><strong>Server Set:</strong> {serverSetName}</p>}
                    {serverList && (
                      <div className="server-list-display">
                        <strong>Servers:</strong>
                        <div className="server-numbers-compact">{serverList}</div>
                      </div>
                    )}
                    {set.infraName && <p className="infra-name"><strong>Infra:</strong> {set.infraName}</p>}
                    {set.supportName && set.supportName !== 'pending' && (
                      <div className="set-support-ack"><strong>Support Ack:</strong> {set.supportName}</div>
                    )}
                    <div className="set-progress-info">
                      {set.status === 'started' && (!set.endTime || set.endTime === 'Present') && (
                        <button onClick={() => handleResumeSet(index, set)} className="complete-btn">
                          Resume This Set
                        </button>
                      )}
                      {set.status === 'completed' && (
                        <div className="set-completed"><span>✅ Completed</span></div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {(!brokerStatus?.currSet || brokerStatus.currSet.length < 4) && isOperations && (
              <div onClick={() => handleSetStart(getNextSetIndex())} className="set-card click-prompt"
                style={{ borderLeft: '4px solid #74b9ff' }}>
                <h3>➕ Start Set {getNextSetIndex() + 1}</h3>
                <p>Click to begin</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SET START MODAL */}
      {showSetModal && (
        <div className="modal-overlay" onClick={handleSetModalCancel}>
          <div className="modal-container server-set-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🔐 Start Set {selectedSetIndex + 1}</h2>
              <p>
                {showServerSetSelection
                  ? 'Select which server set you will be working on'
                  : showCustomSetForm
                  ? 'Create a custom server set'
                  : 'Choose how to provide infra team details'}
              </p>
            </div>

            {showServerSetSelection ? (
              <div className="server-set-selection">
                <div className="form-group">
                  <label>Server Set</label>
                  <select value={selectedServerSet} onChange={(e) => setSelectedServerSet(e.target.value)}
                    className="form-input server-set-dropdown" required>
                    <option value="">-- Select a Server Set --</option>
                    {serverSets.map((set, idx) => (
                      <option key={idx} value={set.name}>{set.name}{set.isCustom ? ' (Custom)' : ''}</option>
                    ))}
                  </select>
                </div>
                {selectedServerSet && (
                  <div className="server-list-preview">
                    <h4>📋 Servers in this set:</h4>
                    <div className="server-numbers">{serverSets.find((s) => s.name === selectedServerSet)?.servers}</div>
                  </div>
                )}
                <div className="modal-actions" style={{ marginTop: '2rem' }}>
                  <button type="button" onClick={handleCreateCustomSet} className="btn-secondary" style={{ marginRight: 'auto' }}>
                    ➕ Create Custom Set
                  </button>
                  <button type="button" onClick={handleSetModalCancel} className="btn-secondary">Cancel</button>
                  <button type="button" onClick={handleServerSetConfirm} className="btn-primary" disabled={!selectedServerSet}>
                    Continue →
                  </button>
                </div>
              </div>
            ) : showCustomSetForm ? (
              <form onSubmit={handleCustomSetSubmit} className="modal-form">
                <div className="form-group">
                  <label>Custom Set Name</label>
                  <input type="text" value={customSetData.name}
                    onChange={(e) => setCustomSetData({ ...customSetData, name: e.target.value })}
                    placeholder="e.g., Production Set A" required className="form-input" />
                </div>
                <div className="form-group">
                  <label>Server Numbers (comma-separated)</label>
                  <textarea value={customSetData.servers}
                    onChange={(e) => setCustomSetData({ ...customSetData, servers: e.target.value })}
                    placeholder="e.g., 155, 156, 157, 173, 174" required className="form-input"
                    rows="4" style={{ resize: 'vertical', fontFamily: "'Courier New', monospace" }} />
                  <small style={{ display: 'block', marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Enter server numbers separated by commas
                  </small>
                </div>
                <div className="modal-actions">
                  <button type="button" onClick={() => { setShowCustomSetForm(false); setShowServerSetSelection(true); setCustomSetData({ name: '', servers: '' }); }} className="btn-secondary">
                    Back
                  </button>
                  <button type="submit" className="btn-primary">Create &amp; Select</button>
                </div>
              </form>
            ) : !showSetManualForm ? (
              <div className="modal-choice-container">
                <button type="button" onClick={handleUseCurrentUserInfoForSet} className="btn-choice btn-choice-primary" disabled={loading}>
                  <div className="btn-choice-icon">👤</div>
                  <div className="btn-choice-content">
                    <h3>Use Current User Info</h3>
                    <p>Automatically fill with your logged-in details</p>
                  </div>
                </button>
                <button type="button" onClick={handleEnterDetailsManuallyForSet} className="btn-choice btn-choice-secondary">
                  <div className="btn-choice-icon">✍️</div>
                  <div className="btn-choice-content">
                    <h3>Enter Details Manually</h3>
                    <p>Fill in infra team member information</p>
                  </div>
                </button>
                <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
                  <button type="button" onClick={() => { setShowServerSetSelection(true); setSelectedServerSet(''); }} className="btn-secondary">
                    ← Back to Server Selection
                  </button>
                  <button type="button" onClick={handleSetModalCancel} className="btn-secondary">Cancel</button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSetStartSubmit} className="modal-form">
                <div className="form-group">
                  <label>Infra Team Member Name</label>
                  <input type="text" value={setStartData.infraName}
                    onChange={(e) => setSetStartData({ ...setStartData, infraName: e.target.value })}
                    placeholder="Enter infra name" required className="form-input" />
                </div>
                <div className="form-group">
                  <label>Infra Team Member ADID/TCS ID</label>
                  <input type="text" value={setStartData.infraId} onChange={handleInfraIdInput}
                    placeholder="Enter infra ID (max 7 digits)" required className="form-input" maxLength={7} />
                  <small style={{ display: 'block', marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Numbers only, maximum 7 digits
                  </small>
                </div>
                <div className="modal-actions">
                  <button type="button" onClick={() => setShowSetManualForm(false)} className="btn-secondary">Back</button>
                  <button type="submit" disabled={loading} className="btn-primary">
                    {loading ? 'Starting...' : 'Start Set'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* SUPPORT ACK MODAL */}
      {supportAckModal && isSupport && (
        <div className="modal-overlay" onClick={handleSupportModalCancel}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🛡️ Complete Set {selectedSetIndex + 1}</h2>
              <p>Choose how to provide support team details</p>
            </div>
            {!showSupportManualForm ? (
              <div className="modal-choice-container">
                <button type="button" onClick={handleUseCurrentUserInfoForSupport} className="btn-choice btn-choice-primary" disabled={loading}>
                  <div className="btn-choice-icon">👤</div>
                  <div className="btn-choice-content">
                    <h3>Use Current User Info</h3>
                    <p>Automatically fill with your logged-in details</p>
                  </div>
                </button>
                <button type="button" onClick={handleEnterDetailsManuallyForSupport} className="btn-choice btn-choice-secondary">
                  <div className="btn-choice-icon">✍️</div>
                  <div className="btn-choice-content">
                    <h3>Enter Details Manually</h3>
                    <p>Fill in support team member information</p>
                  </div>
                </button>
                <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
                  <button type="button" onClick={handleSupportModalCancel} className="btn-secondary">Cancel</button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSupportAckSubmit} className="modal-form">
                <div className="form-group">
                  <label>Support Team Member Name</label>
                  <input type="text" value={supportAckData.name}
                    onChange={(e) => setSupportAckData({ ...supportAckData, name: e.target.value })}
                    placeholder="Enter name" required className="form-input" />
                </div>
                <div className="form-group">
                  <label>Support Member ADID/TCS ID</label>
                  <input type="text" value={supportAckData.id} onChange={handleSupportIdInput}
                    placeholder="Enter ID (max 7 digits)" required className="form-input" maxLength={7} />
                  <small style={{ display: 'block', marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Numbers only, maximum 7 digits
                  </small>
                </div>
                <div className="modal-actions">
                  <button type="button" onClick={() => setShowSupportManualForm(false)} className="btn-secondary">Back</button>
                  <button type="submit" disabled={loading} className="btn-primary">
                    {loading ? 'Processing...' : 'Complete Set'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {selectedSetIndex !== null && (
        <>
          <div className="user-info-banner">
            <div className="user-info-content">
              <span className="user-label">📍 Current Set: Set {selectedSetIndex + 1} of 4</span>
              {getServerSetName(selectedSetIndex) && (
                <span className="server-set-badge">🖥️ {getServerSetName(selectedSetIndex)}</span>
              )}
              {brokerStatus?.currSet?.[selectedSetIndex]?.infraName && (
                <span className="infra-info">Infra: {brokerStatus?.currSet?.[selectedSetIndex]?.infraName}</span>
              )}
            </div>
            <div className="current-timer">⏱️ Step Time: {formatTime(timeElapsed)}</div>
          </div>

          {getServerList(selectedSetIndex) && (
            <div className="current-server-list-section">
              <h3>🖥️ Servers in Current Set</h3>
              <div className="server-list-display-box">{getServerList(selectedSetIndex)}</div>
            </div>
          )}

          <div className="checklist-section">
            <h2>📋 Restart Procedure Checklist</h2>
            {!isOperations && (
              <p style={{ color: 'var(--warning-yellow)', marginBottom: '1.5rem' }}>👁️ Read-Only View</p>
            )}
            <div className="timeline-container">
              {checklistSteps.map((step, index) => (
                <div key={step.id} ref={currentStep === step.id ? currentStepRef : null}
                  className={`timeline-step ${step.completed ? 'completed' : ''} ${currentStep === step.id ? 'current' : ''}`}>
                  <div className="step-marker">
                    <div className="step-number">{step.id}</div>
                    {index < checklistSteps.length - 1 && <div className="step-connector"></div>}
                  </div>
                  <div className="step-content">
                    <div className="step-header">
                      <h3>{step.title}</h3>
                      <div className="step-status">
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
                      <div className="step-details">
                        <div className="detail-item">
                          <strong>Completed at:</strong> {format(new Date(step.completedTime), 'h:mm:ss a')}
                        </div>
                      </div>
                    )}
                    {step.id === 11 && step.ackBy && (
                      <div className="ack-info">
                        <strong>Acknowledged by:</strong> {step.ackBy}
                        {step.ackTime && <> at {format(new Date(step.ackTime), 'h:mm:ss a')}</>}
                      </div>
                    )}
                    <div className="step-actions">
                      {isOperations && currentStep === step.id && step.id !== 11 && !step.completed && (
                        <button onClick={() => completeStep(step.id)} className="btn-complete-step" disabled={processingStep.current}>
                          {processingStep.current ? 'Processing...' : '✓ Mark as Complete'}
                        </button>
                      )}
                      {isSupport && currentStep === 11 && step.id === 11 && !step.completed && (
                        <button onClick={handleSupportAckClick} className="btn-complete-step">
                          Acknowledge as Support Team
                        </button>
                      )}
                      {!isSupport && currentStep === 11 && step.id === 11 && !step.completed && (
                        <div className="support-only-message">
                          <p>⏳ Waiting for Support team acknowledgment...</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'rgba(46, 213, 255, 0.05)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--primary-blue)' }}>Progress:</strong> {currentStep - 1} of 11 steps completed
              </p>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--primary-blue)' }}>Current Step:</strong> {currentStep} — {checklistSteps[currentStep - 1]?.title}
              </p>
            </div>
          </div>
        </>
      )}

      <div className="activity-log-section">
        <h2>📜 Recent Activity Log</h2>
        <button onClick={() => setActivityLog([])} disabled={activityLog.length === 0}
          style={{ marginBottom: '1rem' }} className="btn-secondary">
          Clear Log
        </button>
        <div className="activity-log-container">
          {activityLog.length > 0 ? (
            activityLog.map((log, index) => (
              <div key={index} className="log-entry">
                <div className="log-time">{format(new Date(log.timestamp), 'HH:mm:ss')}</div>
                <div className="log-message">{log.message}</div>
                <div className={`log-type ${log.type.toLowerCase().replace('_', '-')}`}>{log.type}</div>
              </div>
            ))
          ) : (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>No activity logs yet.</p>
          )}
        </div>
      </div>

    </div>
  );
};

export default TasksList;

