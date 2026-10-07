import {storage} from './core/storage.js';
const saved=storage.get('warrantyvault:theme')||'system';
document.documentElement.dataset.theme=['light','dark','system'].includes(saved)?saved:'system';
document.documentElement.style.colorScheme=saved==='dark'?'dark':saved==='light'?'light':'light dark';
