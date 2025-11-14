const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Chat operations
  sendChatMessage: (text) => ipcRenderer.invoke('send-chat-message', text),
  sendChatStream: (text) => ipcRenderer.invoke('send-chat-stream', text),
  onChatStreamChunk: (callback) => ipcRenderer.on('chat-stream-chunk', (event, data) => callback(data)),
  onChatStreamComplete: (callback) => ipcRenderer.on('chat-stream-complete', () => callback()),
  onToolCall: (callback) => ipcRenderer.on('tool-call', (event, data) => callback(data)),
  onToolResult: (callback) => ipcRenderer.on('tool-result', (event, data) => callback(data)),
  
  // Visual generation
  generateDiagram: (prompt) => ipcRenderer.invoke('generate-diagram', prompt),
  generateImage: (prompt) => ipcRenderer.invoke('generate-image', prompt),
  
  // Window management
  toggleVisibility: () => ipcRenderer.invoke('toggle-visibility'),
  toggleInteraction: () => ipcRenderer.invoke('toggle-interaction'),
  showVisualChat: () => ipcRenderer.invoke('show-visual-chat'),
  hideVisualChat: () => ipcRenderer.invoke('hide-visual-chat'),
  
  // Session management
  getSessionHistory: () => ipcRenderer.invoke('get-session-history'),
  clearSession: () => ipcRenderer.invoke('clear-session'),
  
  // Events
  onSessionCleared: (callback) => ipcRenderer.on('session-cleared', () => callback())
});
