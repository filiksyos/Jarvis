const axios = require('axios');
const logger = require('../core/logger').createServiceLogger('OPENROUTER');
const config = require('../core/config');

class OpenRouterService {
  constructor() {
    this.apiKey = config.get('openrouter.apiKey');
    this.model = config.get('openrouter.model');
    this.imageModel = config.get('openrouter.imageModel');
    this.baseUrl = config.get('openrouter.baseUrl');
    
    if (!this.apiKey) {
      logger.warn('OpenRouter API key not configured');
    }
  }

  async chat(message, history = []) {
    try {
      const messages = [
        ...history.map(h => ({ role: h.role, content: h.content })),
        { role: 'user', content: message }
      ];

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: this.model,
          messages
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const result = {
        content: response.data.choices[0].message.content,
        model: response.data.model,
        usage: response.data.usage
      };

      logger.info('Chat response received', { 
        model: result.model,
        tokens: result.usage?.total_tokens 
      });

      return result;
    } catch (error) {
      logger.error('Chat request failed', { 
        error: error.message,
        status: error.response?.status 
      });
      throw error;
    }
  }

  async *streamChat(message, history = []) {
    try {
      const messages = [
        ...history.map(h => ({ role: h.role, content: h.content })),
        { role: 'user', content: message }
      ];

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: this.model,
          messages,
          stream: true
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          responseType: 'stream'
        }
      );

      for await (const chunk of response.data) {
        const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      logger.info('Stream completed');
    } catch (error) {
      logger.error('Stream request failed', { error: error.message });
      throw error;
    }
  }

  async generateDiagram(prompt) {
    try {
      const diagramPrompt = `Generate a mermaid diagram for: ${prompt}\n\nReturn ONLY the mermaid code without any markdown code blocks or explanations. Start directly with 'graph' or 'sequenceDiagram' etc.`;

      const response = await this.chat(diagramPrompt, []);
      
      // Extract mermaid code
      let mermaidCode = response.content.trim();
      
      // Remove markdown code blocks if present
      mermaidCode = mermaidCode.replace(/```mermaid\n?/g, '').replace(/```\n?/g, '');
      
      logger.info('Diagram generated', { length: mermaidCode.length });
      return mermaidCode;
    } catch (error) {
      logger.error('Diagram generation failed', { error: error.message });
      throw error;
    }
  }

  async generateImage(prompt) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/images/generations`,
        {
          model: this.imageModel,
          prompt,
          n: 1,
          size: '1024x1024'
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const imageUrl = response.data.data[0].url;
      logger.info('Image generated', { url: imageUrl });
      return imageUrl;
    } catch (error) {
      logger.error('Image generation failed', { error: error.message });
      throw error;
    }
  }
}

module.exports = new OpenRouterService();
