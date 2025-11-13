const path = require('path');

class Config {
  constructor() {
    this.config = {
      app: {
        name: 'OpenCluely Visual',
        version: '1.0.0',
        processTitle: process.env.PROCESS_TITLE || 'Terminal ',
        isDevelopment: process.env.NODE_ENV === 'development'
      },
      stealth: {
        enabled: process.env.STEALTH_MODE !== 'false',
        disguiseProcess: true,
        clickThrough: true
      },
      windows: {
        overlay: {
          width: 300,
          height: 60,
          x: 50,
          y: 50,
          transparent: true,
          frame: false,
          alwaysOnTop: true,
          skipTaskbar: true
        },
        visualChat: {
          width: 1400,
          height: 900,
          transparent: true,
          frame: false,
          alwaysOnTop: true,
          backgroundColor: '#00000000'
        }
      },
      openrouter: {
        apiKey: process.env.OPENROUTER_API_KEY,
        model: process.env.OPENROUTER_MODEL || 'openai/gpt-3.5-turbo',
        imageModel: process.env.IMAGE_MODEL || 'openai/dall-e-3',
        baseUrl: 'https://openrouter.ai/api/v1'
      },
      session: {
        maxHistoryItems: 50,
        maxRecentItems: 10
      }
    };
  }

  get(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this.config);
  }

  set(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((obj, key) => obj[key], this.config);
    target[lastKey] = value;
  }
}

module.exports = new Config();
