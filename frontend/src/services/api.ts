import axios from 'axios';

const api = axios.create({
  baseURL: '/', // Points to the FastAPI root
});

export default api;
