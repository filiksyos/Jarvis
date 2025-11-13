require('dotenv').config();

const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const logger = require('./src/core/logger').createServiceLogger('MAIN');
const config = require('./src/core/config');
const windowManager = require('./src/managers/window.manager');
const sessionManager = require('./src/managers/session.manager');
const openrouterService = require('./src/services/openrouter.service');

class ApplicationController {
  constructor() {
    this.isReady = false;
    this.setupStealth();
    this.setupEventHandlers();
  }

  setupStealth() {
    if (config.get('stealth.enabled')) {
      process.title = config.get('app.processTitle');
      app.setName(config.get('app.processTitle'));
    }
  }

  setupEventHandlers() {
    app.whenReady().then(() => this.onAppReady());
    app.on('window-all-closed', () => this.onWindowAllClosed());
    app.on('activate', () => this.onActivate());
    app.on('will-quit', () => this.onWillQuit());
    this.setupIPCHandlers();
  }

  async onAppReady() {
    logger.info('Application starting', {
      version: config.get('app.version'),
      stealth: config.get('stealth.enabled')
    });

    try {
      await windowManager.initializeWindows();
      this.setupGlobalShortcuts();
      this.isReady = true;

      logger.info('Application initialized successfully');
      sessionManager.addEvent('Application started');
    } catch (error) {
      logger.error('Application initialization failed', { error: error.message });
      app.quit();
    }
  }

  setupGlobalShortcuts() {
    const shortcuts = {
      'CommandOrControl+Shift+V': () => windowManager.toggleVisibility(),
      'CommandOrControl+Shift+I': () => windowManager.toggleInteraction(),
      'CommandOrControl+Shift+C': () => windowManager.showVisualChat(),
      'Alt+A': () => windowManager.toggleInteraction()
    };

    Object.entries(shortcuts).forEach(([accelerator, handler]) => {
      const success = globalShortcut.register(accelerator, handler);
      logger.debug('Global shortcut registered', { accelerator, success });
    });
  }

  setupIPCHandlers() {
    // Chat message handling
    ipcMain.handle('send-chat-message', async (event, text) => {
      sessionManager.addUserInput(text, 'chat');
      
      try {
        const history = sessionManager.getOptimizedHistory();
        const response = await openrouterService.chat(text, history.recent);
        
        sessionManager.addModelResponse(response.content, {
          model: response.model,
          tokens: response.usage
        });

        return { success: true, response: response.content };
      } catch (error) {
        logger.error('Chat message failed', { error: error.message });
        return { success: false, error: error.message };
      }
    });

    // Streaming chat
    ipcMain.handle('send-chat-stream', async (event, text) => {
      sessionManager.addUserInput(text, 'chat');
      
      try {
        const history = sessionManager.getOptimizedHistory();
        const stream = await openrouterService.streamChat(text, history.recent);
        
        for await (const chunk of stream) {
          event.sender.send('chat-stream-chunk', { chunk });
        }
        
        event.sender.send('chat-stream-complete');
        return { success: true };
      } catch (error) {
        logger.error('Chat stream failed', { error: error.message });
        return { success: false, error: error.message };
      }
    });

    // Generate mermaid diagram
    ipcMain.handle('generate-diagram', async (event, prompt) => {
      try {
        const diagram = await openrouterService.generateDiagram(prompt);
        return { success: true, diagram };
      } catch (error) {
        logger.error('Diagram generation failed', { error: error.message });
        return { success: false, error: error.message };
      }
    });

    // Generate image
    ipcMain.handle('generate-image', async (event, prompt) => {
      try {
        const imageUrl = await openrouterService.generateImage(prompt);
        return { success: true, imageUrl };
      } catch (error) {
        logger.error('Image generation failed', { error: error.message });
        return { success: false, error: error.message };
      }
    });

    // Window management
    ipcMain.handle('toggle-visibility', () => {
      windowManager.toggleVisibility();
      return { success: true };
    });

    ipcMain.handle('toggle-interaction', () => {
      windowManager.toggleInteraction();
      return { success: true };
    });

    ipcMain.handle('show-visual-chat', () => {
      windowManager.showVisualChat();
      return { success: true };
    });

    ipcMain.handle('hide-visual-chat', () => {
      windowManager.hideVisualChat();
      return { success: true };
    });

    // Session management
    ipcMain.handle('get-session-history', () => {
      return sessionManager.getOptimizedHistory();
    });

    ipcMain.handle('clear-session', () => {
      sessionManager.clear();
      windowManager.broadcastToAllWindows('session-cleared');
      return { success: true };
    });
  }

  onWindowAllClosed() {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  }

  onActivate() {
    if (!this.isReady) {
      this.onAppReady();
    }
  }

  onWillQuit() {
    globalShortcut.unregisterAll();
    windowManager.destroyAllWindows();
    logger.info('Application shutting down');
  }
}

new ApplicationController();
