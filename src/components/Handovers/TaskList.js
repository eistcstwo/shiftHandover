import React, { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import './TasksList.css';
import {
  getRestartId,
  getBrokerRestartStatus,
  startBrokerRestartTask,
  updateSubRestart,
  updateSetRestart,
  deleteSetRestart,
  deleteBrokerRestart,
} from '../../Api/HandOverApi';

// ─── Constants ────────────────────────────────────────────────────────────────

const USER_LEVELS = { SUPPORT: 'support', OPS: ['l1', 'l2', 'admin'] };

const INITIAL_STEPS = [
  // Operations steps (1–10)
  { id: 1,  title: 'CACHE UPDATED AFTER 12:00 A.M.',        description: 'Ensure cache is updated after midnight',                                           role: 'ops' },
  { id: 2,  title: 'SETS READY FOR RESTART',                 description: 'Prepare all server sets for restart',                                              role: 'ops' },
  { id: 3,  title: 'ISOLATOR DOWN',                          description: 'Bring isolator down for maintenance',                                              role: 'ops' },
  { id: 4,  title: 'BROKER STOPPED',                         description: 'Stop all broker services',                                                         role: 'ops' },
  { id: 5,  title: 'HEARTBEAT & CACHE BROKER STARTED',       description: 'Start heartbeat and cache broker services',                                        role: 'ops' },
  { id: 6,  title: 'ALL BROKER STARTED',                     description: 'Start all broker services',                                                        role: 'ops' },
  { id: 7,  title: 'CACHE HIT & WORKLOAD DONE',              description: 'Verify cache hits and complete workload',                                          role: 'ops' },
  { id: 8,  title: 'UDP CHANGES (TIMEOUT & URL CHANGES)',    description: 'Apply UDP configuration changes',                                                  role: 'ops' },
  { id: 9,  title: 'LOGS VERIFICATION DONE',                 description: 'Verify all system logs',                                                           role: 'ops' },
  { id: 10, title: 'ISOLATOR UP',                            description: 'Bring isolator back online',                                                       role: 'ops' },
  // Support check steps (11–14) — completable once ops hands over
  { id: 11, title: 'Server and Brokerwise - count/TD/BD',    description: 'Check count/TD/BD on each server and broker',                                      role: 'support' },
  { id: 12, title: 'Check Critical Services',                description: 'Verify YONO 2.0, YONO 1.0, SBICAP, ATM',                                          role: 'support' },
  { id: 13, title: 'ARRAY LB Check',                         description: 'Critical Services (YONO2 LOGIN - 4034 to 4036 and 5034 to 5036)',                  role: 'support' },
  { id: 14, title: 'Parameters to be Checked',               description: 'High response time per server, Throughput, Concurrent connections',                 role: 'support' },
  // Final acknowledgment step (15) — support only, after all checks
  { id: 15, title: 'ACKNOWLEDGED BY SUPPORT TEAM',           description: 'Support team formally acknowledges end of activity',                               role: 'support', isAck: true, ackBy: null, ackTime: null },
].map((s) => ({ ...s, completed: false, completedTime: null }));

const PREDEFINED_SERVER_SETS = [
  { name: '25 Series - Set 1', servers: '155, 156, 157, 173, 174, 73, 74, 55, 56, 57, 63, 64, 163, 164, 10, 11, 12, 110, 111, 112, 41, 42, 43, 141, 142, 143, 31, 32, 134, 135, 192, 196, 197, 68, 69, 168, 169' },
  { name: '25 Series - Set 2', servers: '158, 159, 160, 175, 176, 75, 58, 59, 65, 66, 67, 165, 166, 13, 14, 113, 114, 115, 44, 45, 144, 145, 146, 33, 34, 131, 132, 133, 190, 191, 194, 195, 70, 71, 170, 171' },
  { name: '24 Series - Set 3', servers: '158, 159, 160, 175, 176, 75, 58, 59, 65, 66, 67, 165, 166, 13, 14, 113, 114, 115, 44, 45, 144, 145, 146, 33, 34, 131, 132, 133, 190, 191, 194, 195, 70, 71, 170, 171' },
  { name: '24 Series - Set 4', servers: '155, 156, 157, 173, 174, 73, 74, 55, 56, 57, 63, 64, 163, 164, 10, 11, 12, 110, 111, 112, 41, 42, 43, 141, 142, 143, 31, 32, 134, 135, 192, 196, 197, 68, 69, 168, 169' },
];

const STATUS_COLORS = { pending: '#ff7675', started: '#74b9ff', completed: '#00b894' };

// ─── Small pure helpers ───────────────────────────────────────────────────────

const formatTime = (seconds) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

const lsGet  = (key) => localStorage.getItem(key);
const lsSet  = (key, val) => localStorage.setItem(key, val);
const lsDel  = (key) => localStorage.removeItem(key);
const isValidLs = (v) => v && v !== 'null' && v !== 'undefined' && v.trim() !== '';

const resetStepList = (steps) =>
  steps.map((s) => ({ ...s, completed: false, completedTime: null, ackBy: null, ackTime: null }));

// Extract subSetsId from various API response shapes
const extractSubsetId = (input) => {
  if (!input || typeof input !== 'object') return undefined;
  const pick = (o) => o?.subSetsId ?? o?.subSetId ?? o?.subsetId;
  const top = pick(input);
  if (top != null) return top;
  if (input.currSet && !Array.isArray(input.currSet)) return pick(input.currSet);
  if (Array.isArray(input.currSet)) {
    const active = input.currSet.filter(
      (s) => s?.status === 'started' && (!s.endTime || s.endTime === 'Present')
    );
    const target = active.length ? active[active.length - 1] : input.currSet[input.currSet.length - 1];
    return pick(target);
  }
  return undefined;
};

// Normalise currSet: always an array
const normalizeBrokerStatus = (data) => {
  if (!data) return null;
  if (data.currSet && !Array.isArray(data.currSet)) return { ...data, currSet: [data.currSet] };
  return data;
};

// Clear all per-session localStorage keys for a given restartId
const clearSessionStorage = (rid) => {
  for (let i = 0; i < 4; i++) {
    ['currentSubsetId', 'infraId', 'infraName', 'serverSet', 'serverList'].forEach((k) =>
      lsDel(`${k}_${rid}_${i}`)
    );
  }
};

// ─── Component ────────────────────────────────────────────────────────────────

const TasksList = () => {
  const rawUserLevel       = lsGet('userlevel') || '';
  const normalizedLevel    = rawUserLevel.toLowerCase();
  const isSupport          = normalizedLevel === USER_LEVELS.SUPPORT;
  const isOperations       = USER_LEVELS.OPS.includes(normalizedLevel);

  // Core session state
  const [restartId,        setRestartId]        = useState(null);
  const [brokerStatus,     setBrokerStatus]     = useState(null);
  const [currentSubsetId,  setCurrentSubsetId]  = useState(null);
  const [selectedSetIndex, setSelectedSetIndex] = useState(null);
  const [checklistSteps,   setChecklistSteps]   = useState(INITIAL_STEPS);
  const [currentStep,      setCurrentStep]      = useState(1);

  // UI loading/flags
  const [loading,           setLoading]           = useState(true);
  const [allSetsCompleted,  setAllSetsCompleted]  = useState(false);
  const [newSessionLoading, setNewSessionLoading] = useState(false);

  // Timer
  const [timer,       setTimer]       = useState(null);
  const [timeElapsed, setTimeElapsed] = useState(0);

  // Activity log
  const [activityLog, setActivityLog] = useState([]);

  // Reset/delete dialog
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetLoading,     setResetLoading]     = useState(false);
  const [resetStep,        setResetStep]        = useState('choose'); // 'choose' | 'deleteSet' | 'deleteAll'
  const [deleteSetForm,    setDeleteSetForm]    = useState({ subSetId: '', ackDesc: '' });
  const [deleteAllForm,    setDeleteAllForm]    = useState({ userInfraId: '', ackDesc: '' });

  // Set-start modal
  const [showSetModal,          setShowSetModal]          = useState(false);
  const [setStartData,          setSetStartData]          = useState({ infraName: '', infraId: '' });
  const [showSetManualForm,     setShowSetManualForm]     = useState(false);
  const [selectedServerSet,     setSelectedServerSet]     = useState('');
  const [showServerSetSelection,setShowServerSetSelection]= useState(false);
  const [showCustomSetForm,     setShowCustomSetForm]     = useState(false);
  const [customSetData,         setCustomSetData]         = useState({ name: '', servers: '' });
  const [serverSets,            setServerSets]            = useState(PREDEFINED_SERVER_SETS);

  // Support ack modal
  const [supportAckModal,      setSupportAckModal]      = useState(false);
  const [supportAckData,       setSupportAckData]       = useState({ name: '', id: '' });
  const [showSupportManualForm,setShowSupportManualForm]= useState(false);

  // Refs
  const processingStep      = useRef(false);
  const statusPollingInterval = useRef(null);
  const currentStepRef      = useRef(null);

  // Derived
  const supportChecksCompleted = checklistSteps
    .filter((s) => s.role === 'support' && !s.isAck)
    .every((s) => s.completed);

  // ── Logging ────────────────────────────────────────────────────────────────
  const logActivity = useCallback((type, message, data = null) => {
    console.log(`[${type}] ${message}`, data);
    setActivityLog((prev) => [{ timestamp: new Date(), type, message, data }, ...prev].slice(0, 50));
  }, []);

  // ── localStorage helpers keyed to restartId ────────────────────────────────
  const lsKey = useCallback((field, idx) => `${field}_${restartId}_${idx}`, [restartId]);

  const getServerSetName = useCallback((idx) =>
    lsGet(`serverSet_${restartId}_${idx}`) || brokerStatus?.currSet?.[idx]?.serverSet || null,
  [restartId, brokerStatus]);

  const getServerList = useCallback((idx) =>
    lsGet(`serverList_${restartId}_${idx}`) || brokerStatus?.currSet?.[idx]?.serverList || null,
  [restartId, brokerStatus]);

  // ── Timer ──────────────────────────────────────────────────────────────────
  const startTimer = useCallback(() => {
    setTimer((prev) => { if (prev) clearInterval(prev); return null; });
    setTimeElapsed(0);
    const t = setInterval(() => setTimeElapsed((s) => s + 1), 1000);
    setTimer(t);
  }, []);

  // ── Process broker status ──────────────────────────────────────────────────
  const processBrokerStatus = useCallback(async (status, rid, silent = false) => {
    if (!status) return;

    // All 4 sets done?
    if (status.currSet?.length >= 4) {
      const done = status.currSet.filter(
        (s) => s.status === 'completed' && s.endTime && s.endTime !== 'Present'
      ).length;
      if (done >= 4) {
        setAllSetsCompleted(true);
        setSelectedSetIndex(null);
        setCurrentSubsetId(null);
        if (!silent) logActivity('INFO', 'All 4 sets completed.');
        return;
      }
    }

    // Cache infra info from API into localStorage
    status.currSet?.forEach((set, i) => {
      if (set.infraId && !lsGet(`infraId_${rid}_${i}`)) {
        lsSet(`infraId_${rid}_${i}`, set.infraId);
        lsSet(`infraName_${rid}_${i}`, set.infraName);
        if (set.serverSet)  lsSet(`serverSet_${rid}_${i}`, set.serverSet);
        if (set.serverList) lsSet(`serverList_${rid}_${i}`, set.serverList);
        if (!silent) logActivity('RESTORE', `Restored infra for set ${i + 1}`);
      }
    });

    // Find active set
    const activeSets = status.currSet?.filter(
      (s) => s.status === 'started' && (!s.endTime || s.endTime === 'Present')
    ) ?? [];

    if (!activeSets.length) {
      if (!silent) logActivity('INFO', 'No active set. Ready to start a new one.');
      setSelectedSetIndex(null);
      setCurrentSubsetId(null);
      return;
    }

    const lastActive = activeSets[activeSets.length - 1];
    const setIdx     = status.currSet.indexOf(lastActive);
    setSelectedSetIndex(setIdx);

    // Resolve subsetId
    const subsetId = extractSubsetId(lastActive) ?? lsGet(`currentSubsetId_${rid}_${setIdx}`);
    if (subsetId) {
      setCurrentSubsetId(subsetId);
      lsSet(`currentSubsetId_${rid}_${setIdx}`, subsetId);
      if (!silent) logActivity('INFO', `Active subset ID: ${subsetId} (set ${setIdx + 1})`);
    }

    // Restore completed steps
    if (lastActive.subTasks?.length > 0) {
      const count = lastActive.subTasks.length;
      setCurrentStep(count + 1);
      setChecklistSteps((prev) => {
        const updated = [...prev];
        lastActive.subTasks.forEach((task, i) => {
          if (updated[i]) {
            updated[i] = { ...updated[i], completed: true, completedTime: task.completion || new Date().toISOString() };
          }
        });
        return updated;
      });
      if (!silent) logActivity('RESUME', `Resuming set ${setIdx + 1} from step ${count + 1}`);
    } else {
      setCurrentStep(1);
      if (!silent) logActivity('RESUME', `Starting set ${setIdx + 1} from step 1`);
    }

    startTimer();
  }, [logActivity, startTimer]);

  // ── Fetch broker status ────────────────────────────────────────────────────
  const fetchBrokerStatus = useCallback(async (rid, silent = false) => {
    try {
      const raw  = await getBrokerRestartStatus(rid);
      const norm = normalizeBrokerStatus(raw);
      setBrokerStatus(norm);
      if (!silent) logActivity('API_SUCCESS', 'Broker status fetched');
      await processBrokerStatus(norm, rid, silent);
    } catch (err) {
      if (!silent) logActivity('API_ERROR', `Fetch status failed: ${err.message}`);
    }
  }, [logActivity, processBrokerStatus]);

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const storedId = lsGet('brokerRestartId');
        if (storedId) {
          const rid  = parseInt(storedId);
          setRestartId(rid);
          logActivity('INIT', `Using stored restart ID: ${rid}`);
          const raw  = await getBrokerRestartStatus(rid);
          const norm = normalizeBrokerStatus(raw);
          setBrokerStatus(norm);

          // If support user sees all 4 done, auto-rotate to new session
          if (isSupport && norm?.currSet?.length >= 4) {
            const done = norm.currSet.filter(
              (s) => s.status === 'completed' && s.endTime && s.endTime !== 'Present'
            ).length;
            if (done >= 4) {
              clearSessionStorage(storedId);
              lsDel('brokerRestartId');
              const { restartId: newId } = await getRestartId();
              setRestartId(newId);
              lsSet('brokerRestartId', newId);
              await fetchBrokerStatus(newId);
              return;
            }
          }
          await processBrokerStatus(norm, rid);
        } else {
          const { restartId: newId } = await getRestartId();
          setRestartId(newId);
          lsSet('brokerRestartId', newId);
          logActivity('API_SUCCESS', `New restart ID: ${newId}`);
          await fetchBrokerStatus(newId);
        }
      } catch (err) {
        logActivity('API_ERROR', `Init failed: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    init();
    return () => {
      if (statusPollingInterval.current) clearInterval(statusPollingInterval.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-poll every 30 s while a set is active
  useEffect(() => {
    if (selectedSetIndex !== null && !allSetsCompleted && restartId) {
      statusPollingInterval.current = setInterval(() => fetchBrokerStatus(restartId, true), 30_000);
    }
    return () => { clearInterval(statusPollingInterval.current); statusPollingInterval.current = null; };
  }, [selectedSetIndex, allSetsCompleted, restartId, fetchBrokerStatus]);

  // Auto-scroll to current step
  useEffect(() => {
    if (currentStepRef.current && selectedSetIndex !== null) {
      setTimeout(() => currentStepRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
    }
  }, [currentStep, selectedSetIndex]);

  // ── Clean-up timer on unmount ──────────────────────────────────────────────
  useEffect(() => () => { if (timer) clearInterval(timer); }, [timer]);

  // ── Reset helpers ──────────────────────────────────────────────────────────
  const resetAllLocalState = (keepLog = false) => {
    setAllSetsCompleted(false);
    setRestartId(null);
    setBrokerStatus(null);
    setSelectedSetIndex(null);
    setCurrentSubsetId(null);
    setCurrentStep(1);
    setTimeElapsed(0);
    setChecklistSteps(INITIAL_STEPS);
    if (!keepLog) setActivityLog([]);
    if (timer) { clearInterval(timer); setTimer(null); }
  };

  const openSetStartModal = (idx) => {
    setSelectedSetIndex(idx);
    setShowSetModal(true);
    setShowServerSetSelection(true);
    setShowSetManualForm(false);
    setShowCustomSetForm(false);
    setSelectedServerSet('');
    setCustomSetData({ name: '', servers: '' });
    setSetStartData({ infraName: '', infraId: '' });
  };

  // ── Resolve infra ID for a step call ──────────────────────────────────────
  const resolveInfraId = (setIdx) => {
    const fromLs  = lsGet(`infraId_${restartId}_${setIdx}`);
    const fromApi = brokerStatus?.currSet?.[setIdx]?.infraId;
    const id      = fromLs || fromApi;
    if (id) lsSet(`infraId_${restartId}_${setIdx}`, id);
    return id;
  };

  // ── Complete a step (ops: 1–10, support: 11–14) ───────────────────────────
  const completeStep = async (stepId) => {
    const step         = checklistSteps[stepId - 1];
    const isSupportStep = step.role === 'support' && !step.isAck;
    const isOpsStep     = step.role === 'ops';

    // Role guards
    if (isOpsStep     && !isOperations) { alert('Only Operations team can complete this step.'); return; }
    if (isSupportStep && !isSupport)    { alert('Only Support team can complete steps 11–14.');  return; }
    if (step.isAck) return; // ack handled via modal

    // Sequential guard for ops steps
    if (isOpsStep && stepId !== currentStep) return;

    // Sequential guard for support steps (11–14) among themselves
    if (isSupportStep) {
      if (step.completed) return;
      const supportIds = checklistSteps.filter((s) => s.role === 'support' && !s.isAck).map((s) => s.id);
      const myIdx      = supportIds.indexOf(stepId);
      if (myIdx > 0) {
        const prevId = supportIds[myIdx - 1];
        if (!checklistSteps[prevId - 1]?.completed) {
          alert(`Please complete Step ${prevId} first.`);
          return;
        }
      }
    }

    if (!currentSubsetId) { alert('No active subset ID. Please start a set first.'); return; }
    if (processingStep.current) return;
    processingStep.current = true;

    try {
      const infraId = resolveInfraId(selectedSetIndex);
      if (!infraId) { alert('Infrastructure ID not found. Please refresh.'); return; }

      await updateSubRestart(step.title, currentSubsetId, infraId);
      logActivity('API_SUCCESS', `Step ${stepId} completed: ${step.title}`);

      setChecklistSteps((prev) => {
        const u = [...prev];
        u[stepId - 1] = { ...u[stepId - 1], completed: true, completedTime: new Date().toISOString() };
        return u;
      });

      // Only advance currentStep for ops steps; support steps are parallel to currentStep 11–14
      if (isOpsStep) {
        setTimeout(() => { setCurrentStep(stepId + 1); setTimeElapsed(0); }, 500);
      }
    } catch (err) {
      logActivity('API_ERROR', `Step ${stepId} failed: ${err.message}`);
      alert(`Failed to complete step: ${err.message}`);
    } finally {
      processingStep.current = false;
    }
  };

  // ── Support final acknowledgment (step 15) ─────────────────────────────────
  const handleSupportAckClick = () => {
    if (!isSupport)              { alert('Only Support team can acknowledge.');             return; }
    if (!supportChecksCompleted) { alert('Complete steps 11–14 before acknowledging.');    return; }
    setSupportAckModal(true);
    setShowSupportManualForm(false);
    setSupportAckData({ name: '', id: '' });
  };

  const submitSupportAck = async (supportName, supportId) => {
    if (!currentSubsetId) { alert('No active subset ID.'); return; }
    if (processingStep.current) return;
    processingStep.current = true;
    setLoading(true);
    const doneSetIndex = selectedSetIndex;
    try {
      await updateSetRestart(supportId, supportName, currentSubsetId);
      logActivity('API_SUCCESS', `Acknowledged by ${supportName} (${supportId})`);

      setChecklistSteps((prev) => {
        const u = [...prev];
        const ackIdx = u.findIndex((s) => s.isAck);
        u[ackIdx] = { ...u[ackIdx], completed: true, completedTime: new Date().toISOString(), ackBy: supportName, ackTime: new Date().toISOString() };
        return u;
      });

      // Clean up infra keys for this set
      ['infraId','infraName','serverSet','serverList'].forEach((k) =>
        lsDel(`${k}_${restartId}_${doneSetIndex}`)
      );

      const raw  = await getBrokerRestartStatus(restartId);
      const norm = normalizeBrokerStatus(raw);
      setBrokerStatus(norm);

      const completedCount = norm.currSet?.filter(
        (s) => s.status === 'completed' && s.endTime && s.endTime !== 'Present'
      ).length ?? 0;

      setSupportAckModal(false);
      setShowSupportManualForm(false);

      if (completedCount >= 4) {
        setAllSetsCompleted(true);
        setSelectedSetIndex(null);
        setCurrentSubsetId(null);
        if (timer) clearInterval(timer);
        logActivity('COMPLETE', 'All 4 sets completed!');
      } else {
        setChecklistSteps(INITIAL_STEPS);
        setCurrentStep(1);
        setTimeElapsed(0);
        logActivity('SET_COMPLETE', `Set ${doneSetIndex + 1} done. ${completedCount}/4 complete.`);
        await processBrokerStatus(norm, restartId);
      }
    } catch (err) {
      logActivity('API_ERROR', `Ack failed: ${err.message}`);
      alert(`Failed: ${err.message}`);
      await fetchBrokerStatus(restartId);
    } finally {
      setLoading(false);
      processingStep.current = false;
    }
  };

  // ── Start a set ────────────────────────────────────────────────────────────
  const submitSetStart = async (infraName, infraId) => {
    if (processingStep.current) return;
    processingStep.current = true;
    setLoading(true);
    try {
      const selectedSet  = serverSets.find((s) => s.name === selectedServerSet);
      const serverList   = selectedSet?.servers ?? '';
      const setNumber    = selectedSetIndex + 1;
      const restartIdArg = (!brokerStatus?.currSet?.length || allSetsCompleted) ? null : restartId;

      logActivity('SET_START', `Starting set ${setNumber}`, { infraName, infraId, serverSet: selectedServerSet });

      const response = await startBrokerRestartTask(
        infraId, infraName, restartIdArg, setNumber, selectedServerSet, serverList
      );
      logActivity('API_SUCCESS', `Set ${setNumber} started`, response);

      // Persist new restartId if returned
      const newRestartId = response.brokerRestartId;
      if (newRestartId && newRestartId !== restartId) {
        setRestartId(newRestartId);
        lsSet('brokerRestartId', newRestartId);
      }

      // Resolve subsetId
      let subsetId = extractSubsetId(response);
      if (!subsetId && response.currSet) {
        const target = Array.isArray(response.currSet)
          ? response.currSet[selectedSetIndex]
          : response.currSet;
        subsetId = extractSubsetId(target);
      }
      if (!subsetId) throw new Error('No subset ID received from server');

      setCurrentSubsetId(subsetId);
      const rid = newRestartId ?? restartId;
      lsSet(`currentSubsetId_${rid}_${selectedSetIndex}`, subsetId);
      lsSet(`infraId_${rid}_${selectedSetIndex}`, infraId);
      lsSet(`infraName_${rid}_${selectedSetIndex}`, infraName);
      lsSet(`serverSet_${rid}_${selectedSetIndex}`, selectedServerSet);
      lsSet(`serverList_${rid}_${selectedSetIndex}`, serverList);

      setBrokerStatus(normalizeBrokerStatus(response));
      setAllSetsCompleted(false);

      // Close modal, reset checklist
      setShowSetModal(false);
      setShowServerSetSelection(false);
      setShowSetManualForm(false);
      setShowCustomSetForm(false);
      setSelectedServerSet('');
      setChecklistSteps(INITIAL_STEPS);
      setCurrentStep(1);
      startTimer();
      logActivity('SET_INIT', `Set ${setNumber} ready — server set: ${selectedServerSet}`);
    } catch (err) {
      logActivity('API_ERROR', `Set start failed: ${err.message}`);
      alert(`Failed to start set: ${err.message}`);
    } finally {
      setLoading(false);
      processingStep.current = false;
    }
  };

  // ── Resume a set from the overview ────────────────────────────────────────
  const handleResumeSet = (setIdx, set) => {
    setSelectedSetIndex(setIdx);
    const subsetId = extractSubsetId(set) ?? lsGet(`currentSubsetId_${restartId}_${setIdx}`);
    if (!subsetId) { alert('Cannot resume: missing subset ID.'); return; }
    setCurrentSubsetId(subsetId);
    if (set.subTasks?.length > 0) {
      setCurrentStep(set.subTasks.length + 1);
      setChecklistSteps((prev) => {
        const u = [...prev];
        set.subTasks.forEach((task, i) => {
          if (u[i]) u[i] = { ...u[i], completed: true, completedTime: task.completion || new Date().toISOString() };
        });
        return u;
      });
    } else {
      setCurrentStep(1);
    }
    startTimer();
  };

  // ── Delete a specific set ──────────────────────────────────────────────────
  const handleDeleteSet = async (e) => {
    e.preventDefault();
    if (!deleteSetForm.ackDesc.trim()) { alert('Please enter a reason.'); return; }
    setResetLoading(true);
    try {
      const raw  = await getBrokerRestartStatus(restartId);
      const norm = normalizeBrokerStatus(raw);
      const activeSets = norm?.currSet?.filter(
        (s) => s?.status === 'started' && (!s.endTime || s.endTime === 'Present')
      ) ?? [];
      const target = activeSets.length
        ? activeSets[activeSets.length - 1]
        : norm?.currSet?.[norm.currSet.length - 1];
      const subSetId = target?.subSetsId ?? target?.subSetId ?? target?.subsetId ?? deleteSetForm.subSetId ?? currentSubsetId;
      if (!subSetId) { alert('Could not determine Sub-Set ID. Refresh and try again.'); return; }

      await deleteSetRestart(subSetId, deleteSetForm.ackDesc.trim());
      logActivity('API_SUCCESS', `Sub-set ${subSetId} deleted`);
      setShowResetConfirm(false);
      await fetchBrokerStatus(restartId);
    } catch (err) {
      logActivity('API_ERROR', `Delete set failed: ${err.message}`);
      alert(`Failed: ${err.message}`);
    } finally {
      setResetLoading(false);
    }
  };

  // ── Delete entire session ──────────────────────────────────────────────────
  const handleDeleteAll = async (e) => {
    e.preventDefault();
    if (!deleteAllForm.userInfraId.trim()) { alert('Infra ID is required.'); return; }
    if (!deleteAllForm.ackDesc.trim())     { alert('Please enter a reason.'); return; }
    setResetLoading(true);
    try {
      await deleteBrokerRestart(restartId, deleteAllForm.userInfraId.trim(), deleteAllForm.ackDesc.trim());
      logActivity('API_SUCCESS', `Session ${restartId} deleted`);

      const ids = new Set([String(restartId), lsGet('brokerRestartId')].filter(Boolean));
      ids.forEach(clearSessionStorage);
      lsDel('brokerRestartId');

      resetAllLocalState(true);
      const { restartId: newId } = await getRestartId();
      setRestartId(newId);
      lsSet('brokerRestartId', newId);
      await fetchBrokerStatus(newId, true);
      setShowResetConfirm(false);
      logActivity('DELETE_ALL', 'Session wiped — fresh start ready');
    } catch (err) {
      logActivity('API_ERROR', `Delete all failed: ${err.message}`);
      alert(`Failed: ${err.message}`);
    } finally {
      setResetLoading(false);
    }
  };

  // ── Open reset dialog (auto-populate fields) ───────────────────────────────
  const handleOpenResetConfirm = () => {
    if (!isOperations) { alert('Only Operations team can reset the session.'); return; }

    const activeSets = brokerStatus?.currSet?.filter(
      (s) => s?.status === 'started' && (!s.endTime || s.endTime === 'Present')
    ) ?? [];
    const target    = activeSets.length
      ? activeSets[activeSets.length - 1]
      : brokerStatus?.currSet?.[brokerStatus.currSet.length - 1];
    const autoSub   = String(target?.subSetsId ?? target?.subSetId ?? target?.subsetId ?? currentSubsetId ?? '');

    const rid       = restartId ?? lsGet('brokerRestartId');
    let autoInfra   = '';
    if (rid != null && selectedSetIndex !== null) {
      const v = lsGet(`infraId_${rid}_${selectedSetIndex}`);
      if (isValidLs(v)) autoInfra = v.trim();
    }
    if (!autoInfra && rid != null) {
      for (let i = 0; i < 4; i++) {
        const v = lsGet(`infraId_${rid}_${i}`);
        if (isValidLs(v)) { autoInfra = v.trim(); break; }
      }
    }
    if (!autoInfra && brokerStatus?.currSet) {
      for (const s of brokerStatus.currSet) {
        if (s?.infraId) { autoInfra = String(s.infraId); break; }
      }
    }

    setResetStep('choose');
    setDeleteSetForm({ subSetId: autoSub, ackDesc: '' });
    setDeleteAllForm({ userInfraId: autoInfra, ackDesc: '' });
    setShowResetConfirm(true);
  };

  // ── Start new session (from completion screen) ────────────────────────────
  const handleStartNewSession = async () => {
    if (!isOperations) { alert('Only Operations team can start new sessions.'); return; }
    setNewSessionLoading(true);
    try {
      if (restartId) clearSessionStorage(restartId);
      lsDel('brokerRestartId');
      resetAllLocalState();
      openSetStartModal(0);
    } finally {
      setNewSessionLoading(false);
    }
  };

  // ── Minor input handlers ───────────────────────────────────────────────────
  const handleInfraIdInput   = (e) => setSetStartData((p) => ({ ...p, infraId:   e.target.value.slice(0, 10) }));
  const handleSupportIdInput = (e) => setSupportAckData((p) => ({ ...p, id: e.target.value.replace(/\D/g, '').slice(0, 7) }));

  // ── Loading screen ─────────────────────────────────────────────────────────
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
          <div className="loading-spinner" />
          <p className="loading-text">Loading...</p>
        </div>
      </div>
    );
  }

  // ── Completion screen ──────────────────────────────────────────────────────
  if (allSetsCompleted) {
    return (
      <div className="tasks-list-page">
        <div className="completion-message">
          <div className="completion-icon">🎉</div>
          <h3>Broker Restart Activity Completed!</h3>
          <p>All 4 sets have been successfully completed</p>
          <div className="completion-summary">
            <h4>✅ Completed Sets Summary</h4>
            {(brokerStatus?.currSet ?? []).slice(0, 4).map((set, i) => (
              <div key={i} className="set-card set-card-completed" style={{ marginBottom: '1rem' }}>
                <div className="set-header">
                  <h3>Set {i + 1}</h3>
                  <span className="set-status set-status-completed">✅ COMPLETED</span>
                </div>
                <div className="set-details">
                  {getServerSetName(i) && <p className="server-set-name"><strong>Server Set:</strong> {getServerSetName(i)}</p>}
                  {getServerList(i)    && <div className="server-list-display"><strong>Servers:</strong><div className="server-numbers-compact">{getServerList(i)}</div></div>}
                  {set.infraName       && <p className="infra-name"><strong>Infrastructure:</strong> {set.infraName}</p>}
                  {set.supportName     && (
                    <div className="set-support-ack">
                      <strong>Support Acknowledgment:</strong> {set.supportName}
                      {set.supportTime && set.supportTime !== 'Pending' && (
                        <><br /><small>{format(new Date(set.supportTime), 'MMM d, h:mm:ss a')}</small></>
                      )}
                    </div>
                  )}
                  <div className="set-progress-info">
                    <span>Steps completed: {set.subTasks?.length ?? 0}/15</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {isOperations && (
            <button onClick={handleStartNewSession} className="btn-primary"
              style={{ marginTop: '2rem', fontSize: '1rem', padding: '1rem 2rem' }}
              disabled={newSessionLoading}>
              {newSessionLoading ? 'Starting...' : '🔄 Start New Broker Restart Session'}
            </button>
          )}
        </div>

        {activityLog.length > 0 && <ActivityLog logs={activityLog} />}
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="tasks-list-page">

      {/* ── Reset/Delete dialog ───────────────────────────────────────────── */}
      {showResetConfirm && (
        <div className="modal-overlay" onClick={() => !resetLoading && setShowResetConfirm(false)}>
          <div className="modal-container reset-confirm-modal" onClick={(e) => e.stopPropagation()}>

            {resetStep === 'choose' && (
              <>
                <div className="modal-header">
                  <div className="reset-warning-icon">⚠️</div>
                  <h2>Reset / Delete Session</h2>
                  <p>Both options are <strong>irreversible</strong>.</p>
                </div>
                <div className="reset-choice-grid">
                  <button type="button" className="btn-choice btn-choice-secondary" onClick={() => setResetStep('deleteSet')}>
                    <div className="btn-choice-icon">🗂️</div>
                    <div className="btn-choice-content"><h3>Delete a Specific Set</h3><p>Remove one set using its Sub-Set ID</p></div>
                  </button>
                  <button type="button" className="btn-choice btn-choice-danger" onClick={() => setResetStep('deleteAll')}>
                    <div className="btn-choice-icon">🔥</div>
                    <div className="btn-choice-content"><h3>Delete Entire Session</h3><p>Wipe all sets &amp; start fresh</p></div>
                  </button>
                </div>
                <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
                  <button type="button" onClick={() => setShowResetConfirm(false)} className="btn-secondary" disabled={resetLoading}>Cancel</button>
                </div>
              </>
            )}

            {resetStep === 'deleteSet' && (
              <>
                <div className="modal-header">
                  <div className="reset-warning-icon">🗂️</div>
                  <h2>Delete Current Working Set</h2>
                  <p>Enter a reason to confirm deletion of the active set.</p>
                </div>
                <form onSubmit={handleDeleteSet} className="modal-form">
                  <div className="form-group">
                    <div className="readonly-info-box">ℹ️ The latest Sub-Set ID will be fetched live from the server when you confirm.</div>
                  </div>
                  <div className="form-group">
                    <label>Reason / Description <span className="required-star">*</span></label>
                    <textarea value={deleteSetForm.ackDesc}
                      onChange={(e) => setDeleteSetForm((p) => ({ ...p, ackDesc: e.target.value }))}
                      placeholder="e.g. Servers were restarted manually" required className="form-input" rows="3" style={{ resize: 'vertical' }} />
                  </div>
                  <div className="modal-actions">
                    <button type="button" onClick={() => setResetStep('choose')} className="btn-secondary" disabled={resetLoading}>← Back</button>
                    <button type="submit" className="btn-danger" disabled={resetLoading}>{resetLoading ? '⏳ Deleting...' : '🗑️ Delete Set'}</button>
                  </div>
                </form>
              </>
            )}

            {resetStep === 'deleteAll' && (
              <>
                <div className="modal-header">
                  <div className="reset-warning-icon">🔥</div>
                  <h2>Delete Entire Session</h2>
                  <p>Permanently deletes <strong>Restart ID {restartId}</strong> and all its sets.</p>
                </div>
                <form onSubmit={handleDeleteAll} className="modal-form">
                  <div className="form-group">
                    <label>Infra ID (Current Set)</label>
                    <div className="readonly-info-box">
                      {deleteAllForm.userInfraId
                        ? <><span>🪪 </span><strong>{deleteAllForm.userInfraId}</strong><span className="readonly-badge">Auto-detected</span></>
                        : <span className="readonly-missing">⚠️ Infra ID not found in session</span>}
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Reason / Description <span className="required-star">*</span></label>
                    <textarea value={deleteAllForm.ackDesc}
                      onChange={(e) => setDeleteAllForm((p) => ({ ...p, ackDesc: e.target.value }))}
                      placeholder="e.g. Incorrect server set selected" required className="form-input" rows="3" style={{ resize: 'vertical' }} />
                  </div>
                  <div className="reset-confirm-details">
                    <ul>
                      <li>🗑️ All sets under this session will be wiped</li>
                      <li>🔢 A new Restart ID will be obtained</li>
                      <li>▶️ You will return to the fresh start screen</li>
                    </ul>
                  </div>
                  <div className="modal-actions">
                    <button type="button" onClick={() => setResetStep('choose')} className="btn-secondary" disabled={resetLoading}>← Back</button>
                    <button type="submit" className="btn-danger" disabled={resetLoading || !deleteAllForm.userInfraId}>
                      {resetLoading ? '⏳ Deleting...' : '🔥 Delete Entire Session'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="tasks-list-header">
        <div className="header-content">
          <h1>📝 Night Broker Restart Checklist</h1>
          <div className="header-details">
            <p><strong>Completed Sets:</strong> {brokerStatus?.currSet?.filter((s) => s.status === 'completed').length ?? 0}/4</p>
            <p><strong>User Level:</strong> {isSupport ? 'Support Team' : isOperations ? 'Infra Team' : rawUserLevel || 'Guest'}</p>
            <button onClick={() => { setLoading(true); fetchBrokerStatus(restartId).finally(() => setLoading(false)); }}
              className="btn-refresh-status" disabled={loading}>
              {loading ? '🔄 Refreshing...' : '🔄 Refresh Status'}
            </button>
            {isOperations && (
              <button onClick={handleOpenResetConfirm} className="btn-reset-session"
                disabled={loading || resetLoading} title="Delete a set or wipe the entire session">
                🔁 Reset &amp; Start New
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Sets overview (when no active set) ───────────────────────────── */}
      {selectedSetIndex === null && (
        <div className="sets-section">
          <h2>📊 Available Sets {brokerStatus?.currSet?.length ?? 0}/4</h2>
          <div className="sets-grid">
            {(brokerStatus?.currSet ?? []).map((set, i) => (
              <div key={i} className={`set-card ${set.status === 'completed' ? 'set-card-completed' : ''}`}
                style={{ borderLeft: `4px solid ${STATUS_COLORS[set.status] ?? '#636e72'}` }}>
                <div className="set-header">
                  <h3>Set {i + 1}</h3>
                  <span className={`set-status ${set.status === 'completed' ? 'set-status-completed' : ''}`}>
                    {set.status.toUpperCase()}
                  </span>
                </div>
                <div className="set-details">
                  {getServerSetName(i) && <p className="server-set-name"><strong>Server Set:</strong> {getServerSetName(i)}</p>}
                  {getServerList(i)    && <div className="server-list-display"><strong>Servers:</strong><div className="server-numbers-compact">{getServerList(i)}</div></div>}
                  {set.infraName       && <p className="infra-name"><strong>Infra:</strong> {set.infraName}</p>}
                  {set.supportName && set.supportName !== 'pending' && (
                    <div className="set-support-ack"><strong>Support Ack:</strong> {set.supportName}</div>
                  )}
                  <div className="set-progress-info">
                    {set.status === 'started' && (!set.endTime || set.endTime === 'Present') && (
                      <button onClick={() => handleResumeSet(i, set)} className="complete-btn">Resume This Set</button>
                    )}
                    {set.status === 'completed' && <div className="set-completed"><span>✅ Completed</span></div>}
                  </div>
                </div>
              </div>
            ))}

            {(!brokerStatus?.currSet || brokerStatus.currSet.length < 4) && isOperations && (
              <div onClick={() => openSetStartModal(brokerStatus?.currSet?.length ?? 0)}
                className="set-card click-prompt" style={{ borderLeft: '4px solid #74b9ff' }}>
                <h3>➕ Start Set {(brokerStatus?.currSet?.length ?? 0) + 1}</h3>
                <p>Click to begin</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Set-start modal ────────────────────────────────────────────────── */}
      {showSetModal && (
        <div className="modal-overlay" onClick={() => { setShowSetModal(false); if (!currentSubsetId) setSelectedSetIndex(null); }}>
          <div className="modal-container server-set-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🔐 Start Set {selectedSetIndex + 1}</h2>
              <p>{showServerSetSelection ? 'Select the server set' : showCustomSetForm ? 'Create a custom set' : 'Provide infra details'}</p>
            </div>

            {showServerSetSelection ? (
              <div className="server-set-selection">
                <div className="form-group">
                  <label>Server Set</label>
                  <select value={selectedServerSet} onChange={(e) => setSelectedServerSet(e.target.value)}
                    className="form-input server-set-dropdown" required>
                    <option value="">-- Select a Server Set --</option>
                    {serverSets.map((s, i) => <option key={i} value={s.name}>{s.name}{s.isCustom ? ' (Custom)' : ''}</option>)}
                  </select>
                </div>
                {selectedServerSet && (
                  <div className="server-list-preview">
                    <h4>📋 Servers in this set:</h4>
                    <div className="server-numbers">{serverSets.find((s) => s.name === selectedServerSet)?.servers}</div>
                  </div>
                )}
                <div className="modal-actions" style={{ marginTop: '2rem' }}>
                  <button type="button" onClick={() => { setShowServerSetSelection(false); setShowCustomSetForm(true); }}
                    className="btn-secondary" style={{ marginRight: 'auto' }}>➕ Create Custom Set</button>
                  <button type="button" onClick={() => { setShowSetModal(false); if (!currentSubsetId) setSelectedSetIndex(null); }} className="btn-secondary">Cancel</button>
                  <button type="button" onClick={() => {
                    if (!selectedServerSet) { alert('Please select a server set.'); return; }
                    setShowServerSetSelection(false);
                  }} className="btn-primary" disabled={!selectedServerSet}>Continue →</button>
                </div>
              </div>

            ) : showCustomSetForm ? (
              <form onSubmit={(e) => {
                e.preventDefault();
                if (!customSetData.name.trim() || !customSetData.servers.trim()) { alert('Fill in all fields.'); return; }
                const newSet = { name: customSetData.name.trim(), servers: customSetData.servers.trim(), isCustom: true };
                setServerSets((p) => [...p, newSet]);
                setSelectedServerSet(newSet.name);
                setShowCustomSetForm(false);
                setCustomSetData({ name: '', servers: '' });
              }} className="modal-form">
                <div className="form-group">
                  <label>Custom Set Name</label>
                  <input type="text" value={customSetData.name}
                    onChange={(e) => setCustomSetData((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g., Production Set A" required className="form-input" />
                </div>
                <div className="form-group">
                  <label>Server Numbers (comma-separated)</label>
                  <textarea value={customSetData.servers}
                    onChange={(e) => setCustomSetData((p) => ({ ...p, servers: e.target.value }))}
                    placeholder="e.g., 155, 156, 157" required className="form-input" rows="4"
                    style={{ resize: 'vertical', fontFamily: "'Courier New', monospace" }} />
                </div>
                <div className="modal-actions">
                  <button type="button" onClick={() => { setShowCustomSetForm(false); setShowServerSetSelection(true); }} className="btn-secondary">Back</button>
                  <button type="submit" className="btn-primary">Create &amp; Select</button>
                </div>
              </form>

            ) : !showSetManualForm ? (
              <div className="modal-choice-container">
                <button type="button" className="btn-choice btn-choice-primary" disabled={loading}
                  onClick={async () => {
                    const uidd = lsGet('uidd') || '', username = lsGet('username') || '';
                    if (!uidd || !username) { alert('User info not found. Enter manually.'); return; }
                    await submitSetStart(username, uidd);
                  }}>
                  <div className="btn-choice-icon">👤</div>
                  <div className="btn-choice-content"><h3>Use Current User Info</h3><p>Auto-fill with your logged-in details</p></div>
                </button>
                <button type="button" className="btn-choice btn-choice-secondary"
                  onClick={() => { setShowSetManualForm(true); setSetStartData({ infraName: '', infraId: '' }); }}>
                  <div className="btn-choice-icon">✍️</div>
                  <div className="btn-choice-content"><h3>Enter Details Manually</h3><p>Fill in infra team member info</p></div>
                </button>
                <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
                  <button type="button" onClick={() => { setShowServerSetSelection(true); setSelectedServerSet(''); }} className="btn-secondary">← Back to Server Selection</button>
                  <button type="button" onClick={() => { setShowSetModal(false); if (!currentSubsetId) setSelectedSetIndex(null); }} className="btn-secondary">Cancel</button>
                </div>
              </div>

            ) : (
              <form onSubmit={(e) => { e.preventDefault(); submitSetStart(setStartData.infraName, setStartData.infraId); }} className="modal-form">
                <div className="form-group">
                  <label>Infra Team Member Name</label>
                  <input type="text" value={setStartData.infraName}
                    onChange={(e) => setSetStartData((p) => ({ ...p, infraName: e.target.value }))}
                    placeholder="Enter infra name" required className="form-input" />
                </div>
                <div className="form-group">
                  <label>Infra Team Member ADID/TCS ID</label>
                  <input type="text" value={setStartData.infraId} onChange={handleInfraIdInput}
                    placeholder="e.g. v1018696" required className="form-input" maxLength={10} />
                  <small style={{ display: 'block', marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Alphanumeric, max 10 characters
                  </small>
                </div>
                <div className="modal-actions">
                  <button type="button" onClick={() => setShowSetManualForm(false)} className="btn-secondary">Back</button>
                  <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Starting...' : 'Start Set'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Support ack modal ──────────────────────────────────────────────── */}
      {supportAckModal && isSupport && (
        <div className="modal-overlay" onClick={() => { setSupportAckModal(false); setShowSupportManualForm(false); }}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🛡️ Acknowledge Set {selectedSetIndex + 1}</h2>
              <p>Provide support team details to complete this set</p>
            </div>
            {!showSupportManualForm ? (
              <div className="modal-choice-container">
                <button type="button" className="btn-choice btn-choice-primary" disabled={loading}
                  onClick={async () => {
                    const uidd = lsGet('uidd') || '', username = lsGet('username') || '';
                    if (!uidd || !username) { alert('User info not found. Enter manually.'); return; }
                    await submitSupportAck(username, uidd);
                  }}>
                  <div className="btn-choice-icon">👤</div>
                  <div className="btn-choice-content"><h3>Use Current User Info</h3><p>Auto-fill with your logged-in details</p></div>
                </button>
                <button type="button" className="btn-choice btn-choice-secondary"
                  onClick={() => { setShowSupportManualForm(true); setSupportAckData({ name: '', id: '' }); }}>
                  <div className="btn-choice-icon">✍️</div>
                  <div className="btn-choice-content"><h3>Enter Details Manually</h3><p>Fill in support team member info</p></div>
                </button>
                <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
                  <button type="button" onClick={() => setSupportAckModal(false)} className="btn-secondary">Cancel</button>
                </div>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); submitSupportAck(supportAckData.name, supportAckData.id); }} className="modal-form">
                <div className="form-group">
                  <label>Support Team Member Name</label>
                  <input type="text" value={supportAckData.name}
                    onChange={(e) => setSupportAckData((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Enter name" required className="form-input" />
                </div>
                <div className="form-group">
                  <label>Support Member ADID/TCS ID</label>
                  <input type="text" value={supportAckData.id} onChange={handleSupportIdInput}
                    placeholder="Max 7 digits" required className="form-input" maxLength={7} />
                  <small style={{ display: 'block', marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Numbers only, max 7 digits
                  </small>
                </div>
                <div className="modal-actions">
                  <button type="button" onClick={() => setShowSupportManualForm(false)} className="btn-secondary">Back</button>
                  <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Processing...' : 'Complete Set'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Active set checklist ───────────────────────────────────────────── */}
      {selectedSetIndex !== null && (
        <>
          <div className="user-info-banner">
            <div className="user-info-content">
              <span className="user-label">📍 Current Set: Set {selectedSetIndex + 1} of 4</span>
              {getServerSetName(selectedSetIndex) && (
                <span className="server-set-badge">🖥️ {getServerSetName(selectedSetIndex)}</span>
              )}
              {brokerStatus?.currSet?.[selectedSetIndex]?.infraName && (
                <span className="infra-info">Infra: {brokerStatus.currSet[selectedSetIndex].infraName}</span>
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

            {!isOperations && !isSupport && (
              <p style={{ color: 'var(--warning-yellow)', marginBottom: '1.5rem' }}>👁️ Read-Only View</p>
            )}

            {/* Support status banner shown once ops hand-off is done */}
            {isSupport && currentStep > 10 && (
              <div style={{
                marginBottom: '1.5rem', padding: '1rem 1.25rem', borderRadius: '10px',
                background: supportChecksCompleted ? 'rgba(0,184,148,0.1)' : 'rgba(253,203,110,0.1)',
                border: `1px solid ${supportChecksCompleted ? '#00b894' : '#fdcb6e'}`,
                color: supportChecksCompleted ? '#00b894' : '#fdcb6e',
              }}>
                {supportChecksCompleted
                  ? <p style={{ margin: 0 }}>✅ All checks (steps 11–14) done. You can now acknowledge on step 15.</p>
                  : <p style={{ margin: 0 }}>⚠️ Complete steps 11–14 before you can acknowledge on step 15.</p>}
              </div>
            )}

            <div className="timeline-container">
              {checklistSteps.map((step, index) => {
                const isCurrentStep  = currentStep === step.id;
                const isSupportCheck = step.role === 'support' && !step.isAck;
                const isAckStep      = step.isAck;
                // Support check steps are "in progress" once ops hands off (currentStep > 10)
                const supportCheckActive = isSupportCheck && currentStep > 10 && !step.completed;
                const showAsActive = isCurrentStep || supportCheckActive;

                return (
                  <div
                    key={step.id}
                    ref={isCurrentStep ? currentStepRef : null}
                    className={[
                      'timeline-step',
                      step.completed  ? 'completed' : '',
                      showAsActive    ? 'current'   : '',
                      isSupportCheck  ? 'support-step' : '',
                      isAckStep       ? 'ack-step'  : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <div className="step-marker">
                      <div className="step-number">{step.id}</div>
                      {index < checklistSteps.length - 1 && <div className="step-connector" />}
                    </div>

                    <div className="step-content">
                      <div className="step-header">
                        <h3>
                          {step.title}
                          {isSupportCheck && (
                            <span style={{ marginLeft: '0.6rem', fontSize: '0.7rem', fontWeight: 600,
                              padding: '2px 8px', borderRadius: '12px',
                              background: 'rgba(116,185,255,0.15)', color: '#74b9ff',
                              border: '1px solid #74b9ff', verticalAlign: 'middle' }}>
                              SUPPORT
                            </span>
                          )}
                          {isAckStep && (
                            <span style={{ marginLeft: '0.6rem', fontSize: '0.7rem', fontWeight: 600,
                              padding: '2px 8px', borderRadius: '12px',
                              background: 'rgba(0,184,148,0.15)', color: '#00b894',
                              border: '1px solid #00b894', verticalAlign: 'middle' }}>
                              FINAL ACK
                            </span>
                          )}
                        </h3>
                        <div className="step-status">
                          {step.completed   ? <span className="status-completed">✅ Completed</span>
                          : showAsActive    ? <span className="status-current">▶️ In Progress</span>
                          :                   <span className="status-pending">⏳ Pending</span>}
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

                      {isAckStep && step.ackBy && (
                        <div className="ack-info">
                          <strong>Acknowledged by:</strong> {step.ackBy}
                          {step.ackTime && <> at {format(new Date(step.ackTime), 'h:mm:ss a')}</>}
                        </div>
                      )}

                      <div className="step-actions">
                        {/* Ops: complete steps 1–10 */}
                        {isOperations && isCurrentStep && step.role === 'ops' && !step.completed && (
                          <button onClick={() => completeStep(step.id)} className="btn-complete-step"
                            disabled={processingStep.current}>
                            {processingStep.current ? 'Processing...' : '✓ Mark as Complete'}
                          </button>
                        )}

                        {/* Support: complete steps 11–14 (sequential, available when currentStep > 10) */}
                        {isSupport && isSupportCheck && currentStep > 10 && !step.completed && (() => {
                          const supportCheckIds = checklistSteps.filter((s) => s.role === 'support' && !s.isAck).map((s) => s.id);
                          const myIdx     = supportCheckIds.indexOf(step.id);
                          const prevId    = myIdx > 0 ? supportCheckIds[myIdx - 1] : null;
                          const prevDone  = prevId ? checklistSteps[prevId - 1]?.completed : true;
                          return (
                            <button onClick={() => completeStep(step.id)} className="btn-complete-step"
                              disabled={processingStep.current || !prevDone}
                              title={!prevDone ? `Complete Step ${prevId} first` : ''}
                              style={{ opacity: !prevDone ? 0.45 : 1, cursor: !prevDone ? 'not-allowed' : 'pointer' }}>
                              {processingStep.current ? 'Processing...'
                                : !prevDone ? `🔒 Complete Step ${prevId} first`
                                : '✓ Mark as Complete'}
                            </button>
                          );
                        })()}

                        {/* Non-support waiting message for support check steps */}
                        {!isSupport && isSupportCheck && !step.completed && (
                          <div className="support-only-message">
                            <p>⏳ Waiting for Support team to complete this check...</p>
                          </div>
                        )}

                        {/* Support: final ack button on step 15 */}
                        {isSupport && isAckStep && !step.completed && (
                          <button onClick={handleSupportAckClick} className="btn-complete-step"
                            disabled={!supportChecksCompleted}
                            title={!supportChecksCompleted ? 'Complete steps 11–14 first' : ''}
                            style={{ opacity: !supportChecksCompleted ? 0.5 : 1, cursor: !supportChecksCompleted ? 'not-allowed' : 'pointer' }}>
                            {supportChecksCompleted ? '🛡️ Acknowledge as Support Team' : '🔒 Complete steps 11–14 first'}
                          </button>
                        )}

                        {/* Non-support waiting for final ack */}
                        {!isSupport && isAckStep && !step.completed && (
                          <div className="support-only-message">
                            <p>⏳ Waiting for Support team acknowledgment...</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Progress summary */}
            <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'rgba(46,213,255,0.05)',
              borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--primary-blue)' }}>Progress:</strong>{' '}
                {checklistSteps.filter((s) => s.completed).length} of 15 steps completed
              </p>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--primary-blue)' }}>Current Step:</strong>{' '}
                {currentStep} — {checklistSteps[currentStep - 1]?.title}
              </p>
            </div>
          </div>
        </>
      )}

      {/* ── Activity log ──────────────────────────────────────────────────── */}
      <ActivityLog logs={activityLog} onClear={() => setActivityLog([])} />

    </div>
  );
};

// ─── ActivityLog sub-component ────────────────────────────────────────────────
const ActivityLog = ({ logs, onClear }) => (
  <div className="activity-log-section">
    <h2>📜 Recent Activity Log</h2>
    {onClear && (
      <button onClick={onClear} disabled={!logs.length} style={{ marginBottom: '1rem' }} className="btn-secondary">
        Clear Log
      </button>
    )}
    <div className="activity-log-container">
      {logs.length > 0 ? logs.map((log, i) => (
        <div key={i} className="log-entry">
          <div className="log-time">{format(new Date(log.timestamp), 'HH:mm:ss')}</div>
          <div className="log-message">{log.message}</div>
          <div className={`log-type ${log.type.includes('SUCCESS') ? 'api-success' : log.type.includes('ERROR') ? 'api-error' : 'api-call'}`}>
            {log.type.includes('SUCCESS') ? 'SUCCESS' : log.type.includes('ERROR') ? 'ERROR' : log.type}
          </div>
        </div>
      )) : (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>No activity logs yet.</p>
      )}
    </div>
  </div>
);

export default TasksList;
