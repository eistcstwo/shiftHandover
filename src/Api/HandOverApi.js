HandOverApi.js
-rwxrwxrwx 1 root root 1691 Oct  8 18:20 HandOverApi.js_131025
-rwxr-x--- 1 root root 1083 Oct 22 13:20 HandOverApi.js_bkp
[root@eispr-prt1-01 Api]# cat HandOverApi.js
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
// Add a request interceptor to attach the Authorization header automatically
api.interceptors.request.use(
  (config) => {
    // Get the session ID from localStorage just before the request is made
    const sessionId = localStorage.getItem('sessionid');

    // If a sessionId exists, attach the Authorization header
    if (sessionId) {
      config.headers.Authorization = `Bearer ${sessionId}`;
    }

    return config;
  },
  (error) => {
    // Do something with request error
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
    console.log(response)
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get all tasks from all handovers
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
    throw error;
  }
};

// Create new task
export const createTask = async (taskData) => {
  try {
    const uid = localStorage.getItem('uidd');
    const password = localStorage.getItem('password');

    if (!uid || !password) {
      throw new Error('Authentication credentials not found');
    }

    const payload = {
      uid: uid,
      password: password,
      taskDesc: taskData.taskDesc || '',
      status: taskData.status || 'open',
      priority: taskData.priority || 'Medium',
      acknowledgeStatus: taskData.acknowledgeStatus || 'Pending',
      taskTitle: taskData.taskTitle || '',
      ackDesc: taskData.ackDesc || '',
      handover_id_id: taskData.handover_id_id
    };

    const response = await api.post('/saveNew_task/', payload, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      }
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Update existing task
export const updateTask = async (taskData) => {
  try {
    const uid = localStorage.getItem('uidd');
    const password = localStorage.getItem('password');

    if (!uid || !password) {
      throw new Error('Authentication credentials not found');
    }

    const payload = {
      uid: uid,
      password: password,
      task_id: taskData.task_id,
      taskDesc: taskData.taskDesc || '',
      status: taskData.status || 'open',
      priority: taskData.priority || 'Medium',
      acknowledgeStatus: taskData.acknowledgeStatus || 'Pending',
      taskTitle: taskData.taskTitle || '',
      ackDesc: taskData.ackDesc || ''
    };

    const response = await api.post('/saveNew_task/', payload, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      }
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Legacy saveTask function for backward compatibility
export const saveTask = async (taskData) => {
  // If task_id exists, it's an update, otherwise it's a create
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
    const payload = { uid, password };
    const response = await api.post('/get_historyHandover/', payload, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      }
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};
