import axios from 'axios';

// Create axios instance with custom configuration
const api = axios.create({
  baseURL: 'https://10.191.171.12:5443/EISHOME_TEST/shiftHandover',
  timeout: 100000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// === AXIOS REQUEST INTERCEPTOR ===
api.interceptors.request.use(
  (config) => {
    const sessionId = localStorage.getItem('sessionid');
    if (sessionId) {
      config.headers.Authorization = `Bearer ${sessionId}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
// === END INTERCEPTOR ===

export const getHandovers = async () => {
  try {
    const uid = localStorage.getItem('uidd');
    const password = localStorage.getItem('password');
    if (!uid || !password) {
      throw new Error('Authentication credentials not found in localStorage');
    }
    const payload = { uid, password };
    const response = await api.post('/get_Handover/', payload, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      }
    });
    console.log('getHandovers response:', response);
    return response.data;
  } catch (error) {
    console.error('getHandovers error:', error);
    throw error;
  }
};

export const getAllTasks = async () => {
  try {
    const uid = localStorage.getItem('uidd');
    const password = localStorage.getItem('password');
    if (!uid || !password) {
      throw new Error('Authentication credentials not found in localStorage');
    }
    const payload = { uid, password };
    const response = await api.post('/get_Handover_All/', payload, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      }
    });
    return response.data;
  } catch (error) {
    console.error('getAllTasks error:', error);
    throw error;
  }
};

export const createTask = async (taskData) => {
  try {
    const uid = localStorage.getItem('uidd');
    const password = localStorage.getItem('password');

    if (!uid || !password) {
      throw new Error('Authentication credentials not found');
    }

    const payload = {
      uidd: uid,
      password: password,
      taskDesc: taskData.taskDesc || '',
      status: taskData.status || 'open',
      priority: taskData.priority || 'Medium',
      acknowledgeStatus: taskData.acknowledgeStatus || 'Pending',
      taskTitle: taskData.taskTitle || '',
      ackDesc: taskData.ackDesc || '',
      handover_id_id: taskData.handover_id_id
    };

    console.log('Creating task with payload:', payload);

    const response = await api.post('/saveNew_task/', payload, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      }
    });
    return response.data;
  } catch (error) {
    console.error('createTask error:', error);
    throw error;
  }
};

export const updateTask = async (taskData) => {
  try {
    const uid = localStorage.getItem('uidd');
    const password = localStorage.getItem('password');

    if (!uid || !password) {
      throw new Error('Authentication credentials not found');
    }

    const payload = {
      uidd: uid,
      password: password,
      task_id: taskData.task_id,
      taskDesc: taskData.taskDesc || '',
      status: taskData.status || 'open',
      priority: taskData.priority || 'Medium',
      acknowledgeStatus: taskData.acknowledgeStatus || 'Pending',
      taskTitle: taskData.taskTitle || '',
      ackDesc: taskData.ackDesc || ''
    };

    if (taskData.handover_id_id) {
      payload.handover_id_id = taskData.handover_id_id;
    }

    console.log('Updating task with payload:', payload);

    const response = await api.post('/saveNew_task/', payload, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      }
    });
    return response.data;
  } catch (error) {
    console.error('updateTask error:', error);
    throw error;
  }
};

export const saveTask = async (taskData) => {
  if (taskData.task_id || taskData.Taskid) {
    return updateTask({
      ...taskData,
      task_id: taskData.task_id || taskData.Taskid
    });
  } else {
    return createTask(taskData);
  }
};

export const getHistoryHandovers = async () => {
  try {
    const uid = localStorage.getItem('uidd');
    const password = localStorage.getItem('password');
    if (!uid || !password) {
      throw new Error('Authentication credentials not found in localStorage');
    }
    const payload = { uidd: uid, password };
    const response = await api.post('/get_historyHandover/', payload, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      }
    });
    console.log('getHistoryHandovers response:', response);
    return response.data;
  } catch (error) {
    console.error('getHistoryHandovers error:', error);
    throw error;
  }
};

// ========== BROKER RESTART TASK APIs ==========

// STEP 1: Get initial restart ID (no payload)
export const getRestartId = async () => {
  try {
    const response = await api.post('/getRestartId/', {}, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      }
    });

    console.log('getRestartId response:', response);

    const data = response && response.data ? response.data : {};
    // Support multiple possible keys returned by the backend
    const restartId = data.restartId ?? data.brokerRestartId ?? data.id ?? null;

    // Return a normalized object so callers can rely on response.restartId
    return { restartId, raw: data };
  } catch (error) {
    console.error('getRestartId error:', error);
    throw error;
  }
};

// STEP 2: Get broker restart status
export const getBrokerRestartStatus = async (restartId) => {
  try {
    const payload = { restartId };

    const response = await api.post('/statusBrokerRestart/', payload, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      }
    });

    console.log('getBrokerRestartStatus response:', response);
    return response.data;
  } catch (error) {
    console.error('getBrokerRestartStatus error:', error);
    throw error;
  }
};

// STEP 3 & 4: Start broker restart task
// If restartId is provided and currSet.length < 4, it creates a new subset
// If restartId is NOT provided (undefined/null), it starts a completely new restart session
// setNumber indicates which set (1-4) is being started
export const startBrokerRestartTask = async (infraId, infraName, restartId = null, setNumber = null) => {
  try {
    const payload = {
      infraId: infraId,
      infraName: infraName
    };

    // Only include restartId if it's provided and we want to add to existing session
    if (restartId !== null && restartId !== undefined) {
      payload.restartId = restartId;
    }

    // Include setNumber if provided
    if (setNumber !== null && setNumber !== undefined) {
      payload.setNumber = setNumber;
    }

    console.log('Starting broker restart task with payload:', payload);

    const response = await api.post('/startBrokerRestartTask/', payload, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      }
    });

    console.log('startBrokerRestartTask response:', response);
    return response.data;
  } catch (error) {
    console.error('startBrokerRestartTask error:', error);
    throw error;
  }
};

// STEP 5: Update sub-restart (mark step as complete)
export const updateSubRestart = async (description, subSetsId, currentSubSetUserId) => {
  try {
    if (!currentSubSetUserId) {
      throw new Error('currentSubSetUserId is required');
    }

    const payload = {
      description: description,
      subSetsId: subSetsId,
      currentSubSetUserId: currentSubSetUserId
    };

    console.log('Updating sub-restart with payload:', payload);

    const response = await api.post('/updateSubRestart/', payload, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      }
    });

    console.log('updateSubRestart response:', response);
    return response.data;
  } catch (error) {
    console.error('updateSubRestart error:', error);
    throw error;
  }
};

// STEP 6: Update support acknowledgment (REMOVED - replaced by updateSetRestart)

// NEW: Update set restart with completion status
export const updateSetRestart = async (supportId, supportName, subSetsId) => {
  try {
    const payload = {
      status: "completed",
      suportId: supportId,  // Note: API uses 'suportId' (typo in backend)
      supportName: supportName,
      subSetsId: subSetsId
    };

    console.log('Updating set restart with payload:', payload);

    const response = await api.post('/updateSetRestart/', payload, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      }
    });

    console.log('updateSetRestart response:', response);
    return response.data;
  } catch (error) {
    console.error('updateSetRestart error:', error);
    throw error;
  }
};
