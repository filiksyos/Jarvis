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
      // Use Gemini 2.5 Flash Image model from .env (exactly like reference repo)
      const MODEL_NAME = this.imageModel || 'google/gemini-2.5-flash-image';
      const OPENROUTER_API_URL = `${this.baseUrl}/chat/completions`;
      const MAX_PROCESSING_TIME = 60000; // 60 seconds timeout
      
      // Prepare message content with text prompt (matching reference repo format exactly)
      const messageContent = [
        {
          type: 'text',
          text: prompt
        }
      ];

      logger.info('Making request to OpenRouter API', { url: OPENROUTER_API_URL, model: MODEL_NAME });
      
      const response = await axios.post(
        OPENROUTER_API_URL,
        {
          model: MODEL_NAME,
          messages: [
            {
              role: 'user',
              content: messageContent
            }
          ],
          timeout: MAX_PROCESSING_TIME
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.SITE_URL || 'https://opencluely-visual-mvp',
            'X-Title': 'OpenCluely Visual'
          }
        }
      );

      logger.info('OpenRouter API Response received', { status: response.status });

      // Extract the response according to OpenRouter/Gemini format (exactly like reference repo)
      const choice = response.data.choices?.[0];
      const message = choice?.message;
      const finishReason = choice?.finish_reason;
      const generatedImages = message?.images || [];
      const generatedContent = message?.content;

      logger.info('Response parsed', { 
        finishReason, 
        imagesCount: generatedImages.length,
        hasContent: !!generatedContent 
      });

      // Check if the response completed successfully
      if (!finishReason || !['stop', 'length', 'content_filter'].includes(finishReason)) {
        logger.error('Generation incomplete', { finishReason });
        throw new Error(`AI generation incomplete. Reason: ${finishReason || 'unknown'}`);
      }

      // Check if we got generated images (matching reference repo logic)
      if (generatedImages.length > 0) {
        logger.info(`Found ${generatedImages.length} generated image(s)`);
        
        // Get the first generated image (exactly like reference repo)
        const firstImage = generatedImages[0];
        const imageUrl = firstImage.image_url?.url || firstImage;
        
        if (!imageUrl) {
          logger.error('Generated image data is invalid or missing', { firstImage });
          throw new Error('Generated image data is invalid or missing');
        }

        logger.info('Image generated successfully', { url: imageUrl.substring(0, 50) + '...' });
        return imageUrl;
      }

      // If no images but there's text content
      if (generatedContent) {
        logger.warn('No images generated, only text content returned', { content: generatedContent.substring(0, 200) });
        throw new Error('AI model returned text instead of generating an image');
      }

      // No images and no content
      logger.error('No images or content generated', { response: response.data });
      throw new Error('AI model did not generate any content');
    } catch (error) {
      logger.error('Image generation failed', { 
        error: error.message, 
        response: error.response?.data,
        status: error.response?.status
      });
      throw error;
    }
  }
}

module.exports = new OpenRouterService();
