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
      handover_id_id: taskData.handover_id_id // Changed from handover_id
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

    // Only add handover_id_id if it's being reassigned
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
    const payload = { uidd: uid, password }; // Changed to uidd to match backend
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
export const getHistoryHandovers = async () => {
  try {
    const uid = localStorage.getItem('uidd');
    const password = localStorage.getItem('password');
    if (!uid || !password) {
      throw new Error('Authentication credentials not found in localStorage');
    }
    const payload = { uidd: uid, password }; // Changed to uidd to match backend
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

// Get restart ID for sets 2, 3, 4
export const getRestartId = async () => {
  try {
    const response = await api.post('/getRestartId', {}, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      }
    });
    console.log('getRestartId response:', response);
    return response.data;
  } catch (error) {
    console.error('getRestartId error:', error);
    throw error;
  }
};

// Start broker restart task
export const startBrokerRestartTask = async (infraId, infraName, restartId = null) => {
  try {
    const payload = {
      infraId: infraId,
      infraName: infraName
    };

    let url = '/startBrokerRestartTask/';
    if (restartId) {
      url += restartId;
      console.log('Starting broker restart task with restart ID:', restartId);
    } else {
      console.log('Starting broker restart task for Set 1 (no restart ID)');
    }

    const response = await api.post(url, payload, {
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

