const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 接收添加新任务的事件
  onAddNewTask: (callback) => {
    ipcRenderer.on('add-new-task', callback);
  },
  
  // 移除监听器
  removeAddNewTaskListener: (callback) => {
    ipcRenderer.removeListener('add-new-task', callback);
  },
  
  // 平台信息
  platform: process.platform,
  
  // 是否是Electron环境
  isElectron: true
});
