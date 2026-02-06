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
  const [showSetManualForm, setShowSetManualForm] = useState(false); // Toggle for manual form
  const [selectedServerSet, setSelectedServerSet] = useState(''); // Selected server set from dropdown
  const [showServerSetSelection, setShowServerSetSelection] = useState(false); // Toggle for server set selection step

  // Predefined server sets
  const serverSets = [
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
  ];

  // State for support acknowledgment modal
  const [supportAckModal, setSupportAckModal] = useState(false);
  const [supportAckData, setSupportAckData] = useState({
    name: '',
    id: ''
  });
  const [showSupportManualForm, setShowSupportManualForm] = useState(false); // Toggle for manual form

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
      title: 'INFORM END OF ACTIVITY TO SUPPORT TEAM',
      description: 'Notify support team about activity completion',
      completed: false,
      completedTime: null,
      requiresAck: true,
      ackBy: null,
      ackTime: null
    }
  ]);

  // Helper to normalize API response - ensures currSet is always an array
  const normalizeBrokerStatus = (statusData) => {
    if (!statusData) return null;

    console.log('Normalizing broker status:', statusData);

    // If currSet is an object (single set), wrap it in an array
    if (statusData.currSet && typeof statusData.currSet === 'object' && !Array.isArray(statusData.currSet)) {
      console.log('Converting currSet from object to array');
      return {
        ...statusData,
        currSet: [statusData.currSet]
      };
    }

    // If currSet is already an array or doesn't exist, return as-is
    return statusData;
  };

  // STEP 1: Initialize - Get restart ID on component mount
  useEffect(() => {
    initializeRestartId();
    return () => {
      if (timer) clearInterval(timer);
      if (statusPollingInterval.current) clearInterval(statusPollingInterval.current);
    };
  }, []);

  // Auto-refresh status every 30 seconds when viewing active work
  useEffect(() => {
    if (selectedSetIndex !== null && !allSetsCompleted && restartId) {
      statusPollingInterval.current = setInterval(() => {
        fetchBrokerStatus(restartId, true); // silent refresh
      }, 30000);
    }
    return () => {
      if (statusPollingInterval.current) {
        clearInterval(statusPollingInterval.current);
        statusPollingInterval.current = null;
      }
    };
  }, [selectedSetIndex, allSetsCompleted, restartId]);

  // Auto-scroll to current step when currentStep changes
  useEffect(() => {
    if (currentStepRef.current && selectedSetIndex !== null) {
      setTimeout(() => {
        currentStepRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }, 300);
    }
  }, [currentStep, selectedSetIndex]);

  // Enhanced helper to reliably extract subSetsId from multiple response shapes
  const extractSubsetId = (input) => {
    // 1) Normalize input (handle JSON strings)
    let response = input;
    if (typeof input === 'string') {
      try {
        response = JSON.parse(input);
        console.log('Parsed stringified response:', response);
      } catch (e) {
        console.warn('Failed to parse response string as JSON:', e);
        return undefined;
      }
    }
    // 2) Guard: must be an object
    if (!response || typeof response !== 'object') {
      console.warn('Response is not an object:', response);
      return undefined;
    }
    // Helper to pick id from any object using common key variants
    const pickId = (obj) => {
      if (!obj || typeof obj !== 'object') return undefined;
      if (obj.subSetsId != null) return obj.subSetsId;
      if (obj.subSetId != null) return obj.subSetId;
      if (obj.subsetId != null) return obj.subsetId;
      return undefined;
    };
    console.log('Extracting subsetId from response:', response);

    // 3) Try top-level
    const topLevelId = pickId(response);
    if (topLevelId != null) return topLevelId;

    // 4) Try currSet when it is an object (SINGLE SET RESPONSE)
    if (response.currSet && typeof response.currSet === 'object' && !Array.isArray(response.currSet)) {
      const idFromObject = pickId(response.currSet);
      if (idFromObject != null) return idFromObject;
    }

    // 5) Try currSet when it is an array
    if (response.currSet && Array.isArray(response.currSet)) {
      // Fallback: pick from the last active set (status === 'started' && endTime missing or "Present")
      const activeSets = response.currSet.filter(
        (set) => set && set.status === 'started' && (!set.endTime || set.endTime === 'Present')
      );
      if (activeSets.length > 0) {
        const lastActiveSet = activeSets[activeSets.length - 1];
        const idFromActive = pickId(lastActiveSet);
        if (idFromActive != null) return idFromActive;
      }

      // If no active set found, try the very last entry in currSet
      const latestSet = response.currSet[response.currSet.length - 1];
      const idFromLatest = pickId(latestSet);
      if (idFromLatest != null) return idFromLatest;
    }

    // 6) Nothing found
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
        // Always fetch broker status on page refresh
        logActivity('API_CALL', 'Fetching broker status on page refresh');
        const statusResponse = await getBrokerRestartStatus(parseInt(storedRestartId));
        const normalizedStatus = normalizeBrokerStatus(statusResponse);
        setBrokerStatus(normalizedStatus);
        logActivity('API_SUCCESS', 'Broker status fetched', normalizedStatus);

        // Check if support user and all sets completed - clear and reinitialize
        if (isSupport && normalizedStatus?.currSet && normalizedStatus.currSet.length >= 4) {
          const completedCount = normalizedStatus.currSet.filter(
            (set) => set.status === 'completed' && (set.endTime && set.endTime !== 'Present')
          ).length;
          if (completedCount >= 4) {
            logActivity(
              'SUPPORT_REFRESH',
              'Support user refreshed after completion - clearing and reinitializing session'
            );
            // Clear all localStorage entries
            for (let i = 0; i < 4; i++) {
              localStorage.removeItem(`currentSubsetId_${storedRestartId}_${i}`);
              localStorage.removeItem(`infraId_${storedRestartId}_${i}`);
              localStorage.removeItem(`infraName_${storedRestartId}_${i}`);
            }
            localStorage.removeItem('brokerRestartId');

            // Reset state
            setAllSetsCompleted(false);

            // Get new restart ID
            const response = await getRestartId();
            const newRestartId = response.restartId;
            setRestartId(newRestartId);
            localStorage.setItem('brokerRestartId', newRestartId);
            logActivity('API_SUCCESS', `New restart ID obtained after support refresh: ${newRestartId}`, response);

            // Fetch fresh broker status
            logActivity('API_CALL', 'Fetching fresh broker status after reinitialization');
            await fetchBrokerStatus(newRestartId);
            return;
          }
        }

        // Normal flow - process the fetched status
        await processBrokerStatus(normalizedStatus, parseInt(storedRestartId));
      } else {
        const response = await getRestartId();
        const newRestartId = response.restartId;
        setRestartId(newRestartId);
        localStorage.setItem('brokerRestartId', newRestartId);
        logActivity('API_SUCCESS', `New restart ID obtained: ${newRestartId}`, response);

        // Fetch broker status for new restart ID
        logActivity('API_CALL', 'Fetching broker status for new restart ID');
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

  // Helper function to process broker status
  const processBrokerStatus = async (statusResponse, rid, silent = false) => {
    // Check if all 4 sets are completed
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

    // Save infraId and infraName for all sets from API response if not in localStorage
    if (statusResponse.currSet && statusResponse.currSet.length > 0) {
      statusResponse.currSet.forEach((set, index) => {
        // Only save for started or completed sets that have data
        if (set.infraId && set.infraName) {
          const storedInfraId = localStorage.getItem(`infraId_${rid}_${index}`);
          const storedInfraName = localStorage.getItem(`infraName_${rid}_${index}`);

          // Save if not already in localStorage (happens on page refresh)
          if (!storedInfraId || !storedInfraName) {
            localStorage.setItem(`infraId_${rid}_${index}`, set.infraId);
            localStorage.setItem(`infraName_${rid}_${index}`, set.infraName);
            if (!silent) {
              logActivity('RESTORE', `Restored infraId and infraName from API for set ${index + 1}: ${set.infraName} (${set.infraId})`);
            }
          }
        }
      });
    }

    // Check if there's an ongoing set
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
          if (!silent) logActivity('WARNING', 'No subSetsId found in active set');
          const storedSubsetId = localStorage.getItem(`currentSubsetId_${rid}_${setIndex}`);
          if (storedSubsetId) {
            setCurrentSubsetId(storedSubsetId);
            if (!silent) logActivity('INFO', `Using stored subset ID: ${storedSubsetId} for set ${setIndex + 1}`);
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

          if (!silent) logActivity('RESUME', `Resuming set ${setIndex + 1} from step ${completedStepsCount + 1}`);
        } else {
          if (!silent) logActivity('RESUME', `Starting new set ${setIndex + 1} from step 1`);
          setCurrentStep(1);
        }

        if (!timer) {
          startTimer();
        }
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

  // STEP 2: Fetch broker status to check if any set is in progress
  const fetchBrokerStatus = async (rid, silent = false) => {
    try {
      const statusResponse = await getBrokerRestartStatus(rid);
      console.log('Broker status response:', statusResponse);
      const normalizedStatus = normalizeBrokerStatus(statusResponse);
      setBrokerStatus(normalizedStatus);
      if (!silent) logActivity('API_SUCCESS', 'Broker status fetched', normalizedStatus);
      await processBrokerStatus(normalizedStatus, rid, silent);
    } catch (error) {
      console.error('Error fetching broker status:', error);
      if (!silent) logActivity('API_ERROR', `Failed to fetch status: ${error.message}`);
    }
  };

  // Handle start new session button - Opens modal to start Set 1 directly
  const handleStartNewSession = async () => {
    if (!isOperations) {
      alert('Only Operations team can start new sessions.');
      return;
    }
    logActivity('NEW_SESSION', 'Starting new broker restart session from completion page');
    try {
      // Clear all localStorage entries for the previous session
      if (restartId) {
        for (let i = 0; i < 4; i++) {
          localStorage.removeItem(`currentSubsetId_${restartId}_${i}`);
          localStorage.removeItem(`infraId_${restartId}_${i}`);
          localStorage.removeItem(`infraName_${restartId}_${i}`);
        }
      }
      localStorage.removeItem('brokerRestartId');

      // Reset all state
      setAllSetsCompleted(false);
      setRestartId(null);
      setBrokerStatus(null);
      setSelectedSetIndex(0); // Set to 0 for Set 1
      setCurrentSubsetId(null);
      setCurrentStep(1);
      setActivityLog([]);

      // Reset checklist
      const resetSteps = checklistSteps.map((step) => ({
        ...step,
        completed: false,
        completedTime: null,
        ackBy: null,
        ackTime: null
      }));
      setChecklistSteps(resetSteps);

      // Clear timer
      if (timer) {
        clearInterval(timer);
        setTimer(null);
      }

      logActivity('NEW_SESSION', 'Session reset complete. Opening modal to start Set 1.');

      // Open the modal to start Set 1 immediately - show server set selection first
      setShowSetModal(true);
      setShowServerSetSelection(true);
      setShowSetManualForm(false);
      setSelectedServerSet('');
      setSetStartData({ infraName: '', infraId: '' });
    } catch (error) {
      console.error('Error starting new session:', error);
      logActivity('API_ERROR', `Failed to start new session: ${error.message}`);
      alert(`Failed to start new session: ${error.message}`);
    }
  };

  // STEP 4: Handle set start
  const handleSetStart = (setIndex) => {
    if (!isOperations) {
      alert('Only Operations team can start new sets.');
      return;
    }
    setSelectedSetIndex(setIndex);
    setShowSetModal(true);
    setShowServerSetSelection(true); // Start with server set selection
    setShowSetManualForm(false);
    setSelectedServerSet('');
    setSetStartData({ infraName: '', infraId: '' });
  };

  // NEW: Handle server set selection and proceed to user info
  const handleServerSetConfirm = () => {
    if (!selectedServerSet) {
      alert('Please select a server set before proceeding.');
      return;
    }
    logActivity('SERVER_SET', `Selected server set: ${selectedServerSet}`);
    setShowServerSetSelection(false); // Move to next step (user info choice)
  };

  // NEW: Handle "Use Current User Info" for Set Start
  const handleUseCurrentUserInfoForSet = async () => {
    const uidd = localStorage.getItem('uidd') || '';
    const username = localStorage.getItem('username') || '';

    if (!uidd || !username) {
      alert('User information not found in local storage. Please enter details manually.');
      return;
    }

    logActivity('USER_INFO', `Auto-filled with current user: ${username} (${uidd})`);
    
    // Directly submit the form with current user info
    await submitSetStart(username, uidd);
  };

  // NEW: Handle "Enter Details Manually" for Set Start
  const handleEnterDetailsManuallyForSet = () => {
    setShowSetManualForm(true);
    setSetStartData({ infraName: '', infraId: '' });
  };

  // NEW: Extracted submit logic for set start
  const submitSetStart = async (infraName, infraId) => {
    if (processingStep.current) return;

    processingStep.current = true;
    setLoading(true);
    try {
      logActivity('SET_START', `Starting set ${selectedSetIndex + 1}`, { infraName, infraId, serverSet: selectedServerSet });

      let restartIdToPass = null;
      const setNumber = selectedSetIndex + 1;

      if (!brokerStatus?.currSet || brokerStatus.currSet.length === 0) {
        restartIdToPass = null; // first set -> create new session
        logActivity('INFO', 'Starting first set - creating new session');
      } else if (!allSetsCompleted && brokerStatus?.currSet?.length > 0) {
        restartIdToPass = restartId; // continue current session
        logActivity('INFO', `Continuing session ${restartId} with set ${setNumber}`);
      }

      logActivity('INFO', `Calling API with restartId: ${restartIdToPass ?? 'null'}, setNumber: ${setNumber}`);

      const response = await startBrokerRestartTask(
        infraId,
        infraName,
        restartIdToPass,
        setNumber
      );

      logActivity('API_SUCCESS', `Set ${selectedSetIndex + 1} started successfully`, response);

      // Update restartId if backend returned a new one
      if (response.brokerRestartId) {
        const newRestartId = response.brokerRestartId;
        if (newRestartId !== restartId) {
          setRestartId(newRestartId);
          localStorage.setItem('brokerRestartId', newRestartId);
          logActivity('INFO', `New restart ID obtained from response: ${newRestartId}`);
        }
      }

      // Extract subset id from response
      let subsetId = extractSubsetId(response);
      if (!subsetId && response.currSet) {
        // Try to extract from currSet directly (handle both object and array)
        if (Array.isArray(response.currSet) && response.currSet[selectedSetIndex]) {
          subsetId = extractSubsetId(response.currSet[selectedSetIndex]);
        } else if (typeof response.currSet === 'object' && !Array.isArray(response.currSet)) {
          subsetId = extractSubsetId(response.currSet);
        }
      }
      if (!subsetId) {
        logActivity('ERROR', 'No subset ID returned from API. Full response: ' + JSON.stringify(response));
        throw new Error('No subset ID received from server');
      }

      setCurrentSubsetId(subsetId);
      logActivity('INFO', `Subset ID obtained: ${subsetId} for set ${selectedSetIndex + 1}`);

      // Persist subsetId, infraId, and infraName to localStorage
      const currentRestartId = response.brokerRestartId ?? restartId;
      if (currentRestartId) {
        localStorage.setItem(`currentSubsetId_${currentRestartId}_${selectedSetIndex}`, subsetId);
        // Save infraId and infraName for current set
        localStorage.setItem(`infraId_${currentRestartId}_${selectedSetIndex}`, infraId);
        localStorage.setItem(`infraName_${currentRestartId}_${selectedSetIndex}`, infraName);
        // Save selected server set info
        localStorage.setItem(`serverSet_${currentRestartId}_${selectedSetIndex}`, selectedServerSet);
        logActivity('INFO', `Saved infraId, infraName, and server set to localStorage for set ${selectedSetIndex + 1}`);
      }

      if (allSetsCompleted) {
        setAllSetsCompleted(false);
        logActivity('INFO', `New session started`);
      }

      // CRITICAL FIX: Normalize the response before setting broker status
      const normalizedResponse = normalizeBrokerStatus(response);
      setBrokerStatus(normalizedResponse);
      setShowSetModal(false);
      setShowServerSetSelection(false);
      setShowSetManualForm(false);
      setSelectedServerSet('');

      // Reset checklist steps for the new set
      setCurrentStep(1);
      const resetSteps = checklistSteps.map((step) => ({
        ...step,
        completed: false,
        completedTime: null,
        ackBy: null,
        ackTime: null
      }));
      setChecklistSteps(resetSteps);

      startTimer();
      logActivity('SET_INIT', `Set ${selectedSetIndex + 1} initialized successfully with server set: ${selectedServerSet}`);
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

  // NEW: Handle modal cancel - properly reset state
  const handleSetModalCancel = () => {
    setShowSetModal(false);
    setShowServerSetSelection(false);
    setShowSetManualForm(false);
    setSelectedServerSet('');
    setSetStartData({ infraName: '', infraId: '' });
    // Only reset selectedSetIndex if there's no active work in progress
    if (!currentSubsetId) {
      setSelectedSetIndex(null);
    }
  };

  // STEP 5: Mark step as complete
  const completeStep = async (stepId) => {
    // Only operations can mark steps as complete
    if (!isOperations) {
      alert('Only Operations team can mark steps as complete.');
      return;
    }
    // Skip if not the current step OR if it's the last step (support ack)
    if (stepId !== currentStep || stepId === 11) return;

    if (!currentSubsetId) {
      logActivity('ERROR', 'No active subset ID. Cannot complete step.');
      alert('Error: No active subset ID found. Please start a set first.');
      return;
    }
    if (processingStep.current) return;

    processingStep.current = true;
    try {
      const step = checklistSteps[stepId - 1];

      // Get infraId from localStorage with detailed debugging
      const currentRestartIdForInfra = restartId;
      const localStorageKey = `infraId_${currentRestartIdForInfra}_${selectedSetIndex}`;
      const storedInfraId = localStorage.getItem(localStorageKey);

      console.log('=== COMPLETE STEP DEBUG ===');
      console.log('Step ID:', stepId);
      console.log('Restart ID:', currentRestartIdForInfra);
      console.log('Selected Set Index:', selectedSetIndex);
      console.log('localStorage Key:', localStorageKey);
      console.log('Retrieved infraId:', storedInfraId);
      console.log('Current Subset ID:', currentSubsetId);
      console.log('===========================');

      if (!storedInfraId) {
        logActivity('WARNING', `No infraId found in localStorage for key: ${localStorageKey}. Attempting to retrieve from broker status...`);

        // Try to get from current broker status as fallback
        if (brokerStatus?.currSet?.[selectedSetIndex]?.infraId) {
          const fallbackInfraId = brokerStatus.currSet[selectedSetIndex].infraId;
          logActivity('INFO', `Using infraId from broker status: ${fallbackInfraId}`);

          // Save it to localStorage for future use
          localStorage.setItem(localStorageKey, fallbackInfraId);

          await updateSubRestart(step.title, currentSubsetId, fallbackInfraId);
          logActivity('API_SUCCESS', `Step ${stepId} completed with fallback infraId: ${step.title}`);
        } else {
          logActivity('ERROR', 'No infraId available in localStorage or broker status');
          alert('Error: Infrastructure ID not found. Please refresh the page and try again.');
          processingStep.current = false;
          return;
        }
      } else {
        logActivity('API_CALL', `Calling updateSubRestart for step ${stepId}: ${step.title}`, {
          subsetId: currentSubsetId,
          stepTitle: step.title,
          currentSubSetUserId: storedInfraId,
          localStorageKey: localStorageKey
        });

        await updateSubRestart(step.title, currentSubsetId, storedInfraId);
        logActivity('API_SUCCESS', `Step ${stepId} completed: ${step.title} with infraId: ${storedInfraId}`);
      }

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
    } finally {
      processingStep.current = false;
    }
  };

  // STEP 6: Handle support acknowledgment (Last Step - Step 11)
  const handleSupportAckClick = () => {
    // Only support users can acknowledge AND only when step 11 is current
    if (!isSupport) {
      alert('Only support team members can acknowledge completion.');
      return;
    }
    if (currentStep !== 11) {
      alert('Support acknowledgment is only available at step 11.');
      return;
    }
    setSupportAckModal(true);
    setShowSupportManualForm(false); // Reset to choice screen
    setSupportAckData({ name: '', id: '' });
  };

  // NEW: Handle "Use Current User Info" for Support Ack
  const handleUseCurrentUserInfoForSupport = async () => {
    const uidd = localStorage.getItem('uidd') || '';
    const username = localStorage.getItem('username') || '';

    if (!uidd || !username) {
      alert('User information not found in local storage. Please enter details manually.');
      return;
    }

    logActivity('USER_INFO', `Auto-filled support info with current user: ${username} (${uidd})`);
    
    // Directly submit with current user info
    await submitSupportAck(username, uidd);
  };

  // NEW: Handle "Enter Details Manually" for Support Ack
  const handleEnterDetailsManuallyForSupport = () => {
    setShowSupportManualForm(true);
    setSupportAckData({ name: '', id: '' });
  };

  // NEW: Extracted submit logic for support acknowledgment
  const submitSupportAck = async (supportName, supportId) => {
    if (!currentSubsetId) {
      logActivity('ERROR', 'No active subset ID. Cannot acknowledge support.');
      alert('Error: No active subset ID found.');
      return;
    }
    if (processingStep.current) return;

    processingStep.current = true;
    setLoading(true);

    // Capture selectedSetIndex now, before any state resets, so the log message is correct
    const completedSetIndex = selectedSetIndex;

    try {
      logActivity('API_CALL', `Completing set ${completedSetIndex + 1} with support acknowledgment`, {
        supportId,
        supportName,
        subSetsId: currentSubsetId
      });

      const updateResponse = await updateSetRestart(
        supportId,
        supportName,
        currentSubsetId
      );
      logActivity(
        'API_SUCCESS',
        `Support acknowledgment by ${supportName} (${supportId})`,
        updateResponse
      );

      // Mark step 11 as completed in the UI immediately
      const updatedSteps = [...checklistSteps];
      updatedSteps[10] = {
        ...updatedSteps[10],
        completed: true,
        completedTime: new Date().toISOString(),
        ackBy: supportName,
        ackTime: new Date().toISOString()
      };
      setChecklistSteps(updatedSteps);

      // Clear infraId and infraName from localStorage after set completion
      const currentRestartIdForClear = restartId;
      localStorage.removeItem(`infraId_${currentRestartIdForClear}_${completedSetIndex}`);
      localStorage.removeItem(`infraName_${currentRestartIdForClear}_${completedSetIndex}`);
      localStorage.removeItem(`serverSet_${currentRestartIdForClear}_${completedSetIndex}`);
      logActivity('INFO', `Cleared infraId, infraName, and server set from localStorage for completed set ${completedSetIndex + 1}`);

      // Fetch fresh status from backend to get the ground truth
      logActivity('API_CALL', `Fetching broker status after set completion`);
      const statusResponse = await getBrokerRestartStatus(restartId);
      const normalizedStatus = normalizeBrokerStatus(statusResponse);
      logActivity('API_SUCCESS', `Broker status refreshed`, normalizedStatus);
      setBrokerStatus(normalizedStatus);

      const completedCount =
        normalizedStatus.currSet?.filter(
          (set) => set.status === 'completed' && (set.endTime && set.endTime !== 'Present')
        ).length ?? 0;

      logActivity('INFO', `Total completed sets: ${completedCount}/4`);

      // Close the modal and clear its data first
      setSupportAckModal(false);
      setShowSupportManualForm(false);
      setSupportAckData({ name: '', id: '' });

      if (completedCount >= 4) {
        // All done — show completion page
        setAllSetsCompleted(true);
        setSelectedSetIndex(null);
        setCurrentSubsetId(null);
        logActivity('COMPLETE', 'All 4 sets completed! Broker restart activity finished.');
        if (timer) clearInterval(timer);
      } else {
        // More sets to go — reset checklist and let processBrokerStatus
        // decide what selectedSetIndex / currentSubsetId should be.
        const resetStepsAfterAck = checklistSteps.map((step) => ({
          ...step,
          completed: false,
          completedTime: null,
          ackBy: null,
          ackTime: null
        }));
        setChecklistSteps(resetStepsAfterAck);
        setCurrentStep(1);
        setTimeElapsed(0);

        logActivity(
          'SET_COMPLETE',
          `Set ${completedSetIndex + 1} completed. Ready to start next set (${completedCount + 1}/4)`
        );

        // Let processBrokerStatus set selectedSetIndex and currentSubsetId
        // based on the actual backend state instead of guessing
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

  // NEW: Handle support modal cancel
  const handleSupportModalCancel = () => {
    setSupportAckModal(false);
    setShowSupportManualForm(false);
    setSupportAckData({ name: '', id: '' });
  };

  // Handle resume of existing set
  const handleResumeSet = (setIndex, set) => {
    setSelectedSetIndex(setIndex);

    const subsetId = extractSubsetId(set);
    if (subsetId) {
      setCurrentSubsetId(subsetId);
      logActivity('INFO', `Resuming with subset ID: ${subsetId} for set ${setIndex + 1}`);
    } else {
      const storedSubsetId = localStorage.getItem(`currentSubsetId_${restartId}_${setIndex}`);
      if (storedSubsetId) {
        setCurrentSubsetId(storedSubsetId);
        logActivity('INFO', `Using stored subset ID: ${storedSubsetId} for set ${setIndex + 1}`);
      } else {
        logActivity('WARNING', 'No subSetsId found in set, cannot resume');
        alert('Cannot resume set: Missing subset ID');
        return;
      }
    }

    if (set.subTasks && set.subTasks.length > 0) {
      const stepNumber = set.subTasks.length + 1;
      setCurrentStep(stepNumber);

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

  // Timer management
  const startTimer = () => {
    if (timer) clearInterval(timer);
    setTimeElapsed(0);
    const newTimer = setInterval(() => {
      setTimeElapsed((prev) => prev + 1);
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
    setActivityLog((prev) => [logEntry, ...prev].slice(0, 50));
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
      case 'pending':
        return '#ff7675';
      case 'started':
        return '#74b9ff';
      case 'completed':
        return '#00b894';
      default:
        return '#636e72';
    }
  };

  // Get the next available set index
  const getNextSetIndex = () => {
    if (!brokerStatus?.currSet) return 0;
    return brokerStatus.currSet.length;
  };

  // Handle numeric input for infra ID (max 7 digits for manual entry)
  const handleInfraIdInput = (e) => {
    const value = e.target.value.replace(/\D/g, ''); // Remove non-numeric characters
    // Limit to 7 digits for manual entry
    const limited = value.slice(0, 7);
    setSetStartData({ ...setStartData, infraId: limited });
  };

  // Handle numeric input for support ID (max 7 digits for manual entry)
  const handleSupportIdInput = (e) => {
    const value = e.target.value.replace(/\D/g, ''); // Remove non-numeric characters
    // Limit to 7 digits for manual entry
    const limited = value.slice(0, 7);
    setSupportAckData({ ...supportAckData, id: limited });
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

  // Debug helper: Show localStorage state
  const showLocalStorageDebug = () => {
    console.log('=== LOCALSTORAGE DEBUG INFO ===');
    console.log('Current restartId:', restartId);
    console.log('Selected Set Index:', selectedSetIndex);
    console.log('Current Subset ID:', currentSubsetId);
    console.log('');

    if (restartId) {
      for (let i = 0; i < 4; i++) {
        const subsetId = localStorage.getItem(`currentSubsetId_${restartId}_${i}`);
        const infraId = localStorage.getItem(`infraId_${restartId}_${i}`);
        const infraName = localStorage.getItem(`infraName_${restartId}_${i}`);
        const serverSet = localStorage.getItem(`serverSet_${restartId}_${i}`);

        if (subsetId || infraId || infraName || serverSet) {
          console.log(`Set ${i}:`);
          console.log(`  - currentSubsetId_${restartId}_${i}:`, subsetId);
          console.log(`  - infraId_${restartId}_${i}:`, infraId);
          console.log(`  - infraName_${restartId}_${i}:`, infraName);
          console.log(`  - serverSet_${restartId}_${i}:`, serverSet);
          console.log('');
        }
      }
    }

    console.log('Broker Status currSet:', brokerStatus?.currSet);
    console.log('===============================');

    logActivity('DEBUG', 'localStorage state logged to console');
  };

  // Get server set name for display
  const getServerSetName = (setIndex) => {
    if (!restartId) return null;
    const serverSet = localStorage.getItem(`serverSet_${restartId}_${setIndex}`);
    return serverSet || (brokerStatus?.currSet?.[setIndex]?.serverSet);
  };

  // --- RENDER ---

  // Initial "initializing" screen
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

  // Completion page
  if (allSetsCompleted) {
    return (
      <div className="tasks-list-page">
        <div className="completion-message">
          <div className="completion-icon">🎉</div>
          <h3>Broker Restart Activity Completed!</h3>
          <p>All 4 sets have been successfully completed</p>

          <div className="completion-summary">
            <h4>✅ Completed Sets Summary</h4>

            {(brokerStatus?.currSet ?? [])
              .slice(0, 4)
              .map((set, index) => {
                const serverSetName = getServerSetName(index);
                return (
                  <div key={index} className="set-card set-card-completed" style={{ marginBottom: '1rem' }}>
                    <div className="set-header">
                      <h3>Set {index + 1}</h3>
                      <span className="set-status set-status-completed">✅ COMPLETED</span>
                    </div>

                    <div className="set-details">
                      {serverSetName && (
                        <p className="server-set-name">
                          <strong>Server Set:</strong> {serverSetName}
                        </p>
                      )}

                      {set.infraName && (
                        <p className="infra-name">
                          <strong>Infrastructure:</strong> {set.infraName}
                        </p>
                      )}

                      {set.supportName && (
                        <div className="set-support-ack">
                          <strong>Support Acknowledgment:</strong> {set.supportName}
                          {set.supportTime && set.supportTime !== 'Pending' && (
                            <>
                              <br />
                              <small>{format(new Date(set.supportTime), 'MMM d, h:mm:ss a')}</small>
                            </>
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
            <button
              onClick={handleStartNewSession}
              className="btn-primary"
              style={{ marginTop: '2rem', fontSize: '1rem', padding: '1rem 2rem' }}
              disabled={newSessionLoading}
            >
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

          </div>
        </div>
      </div>

      {selectedSetIndex === null && (
        <div className="sets-section">
          <h2>📊 Available Sets {(brokerStatus?.currSet?.length ?? 0)}/4</h2>
          <div className="sets-grid">
            {(brokerStatus?.currSet ?? []).map((set, index) => {
              const serverSetName = getServerSetName(index);
              return (
                <div
                  key={index}
                  className={`set-card ${set.status === 'completed' ? 'set-card-completed' : ''}`}
                  style={{ borderLeft: `4px solid ${getStatusColor(set.status)}` }}
                >
                  <div className="set-header">
                    <h3>Set {index + 1}</h3>
                    <span className={`set-status ${set.status === 'completed' ? 'set-status-completed' : ''}`}>
                      {set.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="set-details">
                    {serverSetName && (
                      <p className="server-set-name">
                        <strong>Server Set:</strong> {serverSetName}
                      </p>
                    )}

                    {set.infraName && (
                      <p className="infra-name">
                        <strong>Infra:</strong> {set.infraName}
                      </p>
                    )}

                    {set.supportName && set.supportName !== 'pending' && (
                      <div className="set-support-ack">
                        <strong>Support Ack:</strong> {set.supportName}
                      </div>
                    )}

                    <div className="set-progress-info">
                      {set.status === 'started' && (!set.endTime || set.endTime === 'Present') && (
                        <button onClick={() => handleResumeSet(index, set)} className="complete-btn">
                          Resume This Set
                        </button>
                      )}
                      {set.status === 'completed' && (
                        <div className="set-completed">
                          <span>✅ Completed</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {(!brokerStatus?.currSet || brokerStatus.currSet.length < 4) && isOperations && (
              <div
                onClick={() => handleSetStart(getNextSetIndex())}
                className="set-card click-prompt"
                style={{ borderLeft: '4px solid #74b9ff' }}
              >
                <h3>➕ Start Set {getNextSetIndex() + 1}</h3>
                <p>Click to begin</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* UPDATED SET START MODAL WITH SERVER SET SELECTION */}
      {showSetModal && (
        <div className="modal-overlay" onClick={handleSetModalCancel}>
          <div className="modal-container server-set-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🔐 Start Set {selectedSetIndex + 1}</h2>
              <p>
                {showServerSetSelection 
                  ? 'Select which server set you will be working on'
                  : 'Choose how to provide infra team details'}
              </p>
            </div>

            {showServerSetSelection ? (
              // SERVER SET SELECTION STEP
              <div className="server-set-selection">
                <div className="form-group">
                  <label>Server Set</label>
                  <select
                    value={selectedServerSet}
                    onChange={(e) => setSelectedServerSet(e.target.value)}
                    className="form-input server-set-dropdown"
                    required
                  >
                    <option value="">-- Select a Server Set --</option>
                    {serverSets.map((set, idx) => (
                      <option key={idx} value={set.name}>
                        {set.name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedServerSet && (
                  <div className="server-list-preview">
                    <h4>📋 Servers in this set:</h4>
                    <div className="server-numbers">
                      {serverSets.find(s => s.name === selectedServerSet)?.servers}
                    </div>
                  </div>
                )}

                <div className="modal-actions" style={{ marginTop: '2rem' }}>
                  <button type="button" onClick={handleSetModalCancel} className="btn-secondary">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleServerSetConfirm}
                    className="btn-primary"
                    disabled={!selectedServerSet}
                  >
                    Continue →
                  </button>
                </div>
              </div>
            ) : !showSetManualForm ? (
              // CHOICE SCREEN (after server set selection)
              <div className="modal-choice-container">
                <button
                  type="button"
                  onClick={handleUseCurrentUserInfoForSet}
                  className="btn-choice btn-choice-primary"
                  disabled={loading}
                >
                  <div className="btn-choice-icon">👤</div>
                  <div className="btn-choice-content">
                    <h3>Use Current User Info</h3>
                    <p>Automatically fill with your logged-in details</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleEnterDetailsManuallyForSet}
                  className="btn-choice btn-choice-secondary"
                >
                  <div className="btn-choice-icon">✍️</div>
                  <div className="btn-choice-content">
                    <h3>Enter Details Manually</h3>
                    <p>Fill in infra team member information</p>
                  </div>
                </button>

                <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowServerSetSelection(true);
                      setSelectedServerSet('');
                    }} 
                    className="btn-secondary"
                  >
                    ← Back to Server Selection
                  </button>
                  <button type="button" onClick={handleSetModalCancel} className="btn-secondary">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              // MANUAL FORM
              <form onSubmit={handleSetStartSubmit} className="modal-form">
                <div className="form-group">
                  <label>Infra Team Member Name</label>
                  <input
                    type="text"
                    value={setStartData.infraName}
                    onChange={(e) => setSetStartData({ ...setStartData, infraName: e.target.value })}
                    placeholder="Enter infra name"
                    required
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Infra Team Member ADID/TCS ID</label>
                  <input
                    type="text"
                    value={setStartData.infraId}
                    onChange={handleInfraIdInput}
                    placeholder="Enter infra ID (max 7 digits)"
                    required
                    className="form-input"
                    maxLength={7}
                  />
                  <small style={{
                    display: 'block',
                    marginTop: '0.5rem',
                    color: 'var(--text-secondary)',
                    fontSize: '0.85rem'
                  }}>
                    Numbers only, maximum 7 digits
                  </small>
                </div>

                <div className="modal-actions">
                  <button type="button" onClick={() => setShowSetManualForm(false)} className="btn-secondary">
                    Back
                  </button>
                  <button type="submit" disabled={loading} className="btn-primary">
                    {loading ? 'Starting...' : 'Start Set'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* SUPPORT ACK MODAL (unchanged) */}
      {supportAckModal && isSupport && (
        <div className="modal-overlay" onClick={handleSupportModalCancel}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🛡️ Complete Set {selectedSetIndex + 1}</h2>
              <p>Choose how to provide support team details</p>
            </div>

            {!showSupportManualForm ? (
              // CHOICE SCREEN
              <div className="modal-choice-container">
                <button
                  type="button"
                  onClick={handleUseCurrentUserInfoForSupport}
                  className="btn-choice btn-choice-primary"
                  disabled={loading}
                >
                  <div className="btn-choice-icon">👤</div>
                  <div className="btn-choice-content">
                    <h3>Use Current User Info</h3>
                    <p>Automatically fill with your logged-in details</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleEnterDetailsManuallyForSupport}
                  className="btn-choice btn-choice-secondary"
                >
                  <div className="btn-choice-icon">✍️</div>
                  <div className="btn-choice-content">
                    <h3>Enter Details Manually</h3>
                    <p>Fill in support team member information</p>
                  </div>
                </button>

                <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
                  <button type="button" onClick={handleSupportModalCancel} className="btn-secondary">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              // MANUAL FORM
              <form onSubmit={handleSupportAckSubmit} className="modal-form">
                <div className="form-group">
                  <label>Support Team Member Name</label>
                  <input
                    type="text"
                    value={supportAckData.name}
                    onChange={(e) => setSupportAckData({ ...supportAckData, name: e.target.value })}
                    placeholder="Enter name"
                    required
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Support Member ADID/TCS ID</label>
                  <input
                    type="text"
                    value={supportAckData.id}
                    onChange={handleSupportIdInput}
                    placeholder="Enter ID (max 7 digits)"
                    required
                    className="form-input"
                    maxLength={7}
                  />
                  <small style={{
                    display: 'block',
                    marginTop: '0.5rem',
                    color: 'var(--text-secondary)',
                    fontSize: '0.85rem'
                  }}>
                    Numbers only, maximum 7 digits
                  </small>
                </div>

                <div className="modal-actions">
                  <button type="button" onClick={() => setShowSupportManualForm(false)} className="btn-secondary">
                    Back
                  </button>
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
                <span className="server-set-badge">
                  🖥️ {getServerSetName(selectedSetIndex)}
                </span>
              )}

              {brokerStatus?.currSet?.[selectedSetIndex]?.infraName && (
                <span className="infra-info">
                  Infra: {brokerStatus?.currSet?.[selectedSetIndex]?.infraName}
                </span>
              )}
            </div>
            <div className="current-timer">⏱️ Step Time: {formatTime(timeElapsed)}</div>
          </div>

          <div className="checklist-section">
            <h2>📋 Restart Procedure Checklist</h2>
            {!isOperations && (
              <p style={{ color: 'var(--warning-yellow)', marginBottom: '1.5rem' }}>👁️ Read-Only View</p>
            )}

            <div className="timeline-container">
              {checklistSteps.map((step, index) => (
                <div
                  key={step.id}
                  ref={currentStep === step.id ? currentStepRef : null}
                  className={`timeline-step ${step.completed ? 'completed' : ''} ${
                    currentStep === step.id ? 'current' : ''
                  }`}
                >
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
                        <button
                          onClick={() => completeStep(step.id)}
                          className="btn-complete-step"
                          disabled={processingStep.current}
                        >
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

            <div
              style={{
                marginTop: '2rem',
                padding: '1.5rem',
                background: 'rgba(46, 213, 255, 0.05)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)'
              }}
            >
              <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--primary-blue)' }}>Progress:</strong> {currentStep - 1} of 11 steps
                completed
              </p>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--primary-blue)' }}>Current Step:</strong> {currentStep} -{' '}
                {checklistSteps[currentStep - 1]?.title}
              </p>
            </div>
          </div>
        </>
      )}

      <div className="activity-log-section">
        <h2>📜 Recent Activity Log</h2>
        <button
          onClick={() => setActivityLog([])}
          disabled={activityLog.length === 0}
          style={{ marginBottom: '1rem' }}
          className="btn-secondary"
        >
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
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
              No activity logs yet.
            </p>
          )}
        </div>
      </div>

    </div>
  );
};

export default TasksList;
