const { createOpenRouter } = require('@openrouter/ai-sdk-provider');
const { streamText, tool } = require('ai');
const { z } = require('zod');
const logger = require('../core/logger').createServiceLogger('AI_SERVICE');
const config = require('../core/config');
const axios = require('axios');

class AIService {
  constructor() {
    this.apiKey = config.get('openrouter.apiKey');
    this.modelId = config.get('openrouter.model');
    this.imageModel = config.get('openrouter.imageModel');
    
    if (!this.apiKey) {
      logger.warn('OpenRouter API key not configured');
    }

    this.openrouter = createOpenRouter({
      apiKey: this.apiKey,
    });

    this.model = this.openrouter.chat(this.modelId);
  }

  // Tool: Generate Text
  generateTextTool() {
    return tool({
      description: 'Generate formatted text content for display in the Jarvis interface. Use this to provide explanations, responses, or any text-based content.',
      inputSchema: z.object({
        text: z.string().describe('The text content to display'),
        positionX: z.number().min(0).max(100).optional().describe('Horizontal position as percentage (0-100)'),
        positionY: z.number().min(0).max(100).optional().describe('Vertical position as percentage (0-100)'),
      }),
      execute: async ({ text, positionX, positionY }) => {
        logger.info('Generate text tool called', { textLength: text.length, positionX, positionY });
        return {
          type: 'text',
          content: text,
          position: { x: positionX ?? 50, y: positionY ?? 50 },
        };
      },
    });
  }

  // Tool: Generate Mermaid Diagram
  generateMermaidDiagramTool() {
    return tool({
      description: 'Generate a Mermaid diagram code based on a description. Returns the mermaid code that can be rendered.',
      inputSchema: z.object({
        description: z.string().describe('Description of what diagram to generate'),
        positionX: z.number().min(0).max(100).optional().describe('Horizontal position as percentage (0-100)'),
        positionY: z.number().min(0).max(100).optional().describe('Vertical position as percentage (0-100)'),
      }),
      execute: async ({ description, positionX, positionY }) => {
        logger.info('Generate mermaid diagram tool called', { description, positionX, positionY });
        
        // Use AI to generate mermaid code
        const diagramPrompt = `Generate a mermaid diagram for: ${description}\n\nReturn ONLY the mermaid code without any markdown code blocks or explanations. Start directly with 'graph', 'sequenceDiagram', 'flowchart', etc.`;
        
        try {
          const response = await axios.post(
            `${config.get('openrouter.baseUrl')}/chat/completions`,
            {
              model: this.modelId,
              messages: [
                { role: 'user', content: diagramPrompt }
              ],
            },
            {
              headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
              }
            }
          );

          let mermaidCode = response.data.choices[0].message.content.trim();
          // Remove markdown code blocks if present
          mermaidCode = mermaidCode.replace(/```mermaid\n?/g, '').replace(/```\n?/g, '').trim();

          return {
            type: 'mermaid',
            content: mermaidCode,
            position: { x: positionX ?? 50, y: positionY ?? 50 },
          };
        } catch (error) {
          logger.error('Mermaid generation failed', { error: error.message });
          throw error;
        }
      },
    });
  }

  // Tool: Generate Image
  generateImageTool() {
    return tool({
      description: 'Generate an image based on a text prompt. Returns the image URL.',
      inputSchema: z.object({
        prompt: z.string().describe('Description of the image to generate'),
        positionX: z.number().min(0).max(100).optional().describe('Horizontal position as percentage (0-100)'),
        positionY: z.number().min(0).max(100).optional().describe('Vertical position as percentage (0-100)'),
      }),
      execute: async ({ prompt, positionX, positionY }) => {
        logger.info('Generate image tool called', { prompt, positionX, positionY });
        
        try {
          // Use Gemini 2.5 Flash Image model from .env (exactly like reference repo)
          const MODEL_NAME = this.imageModel || 'google/gemini-2.5-flash-image';
          const OPENROUTER_API_URL = `${config.get('openrouter.baseUrl')}/chat/completions`;
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

            return {
              type: 'image',
              content: imageUrl,
              position: { x: positionX ?? 50, y: positionY ?? 50 },
            };
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
      },
    });
  }

  // Tool: Generate Layout
  generateLayoutTool() {
    return tool({
      description: 'Generate a layout specification for positioning multiple elements (text, diagrams, images) across the screen for a Jarvis-like effect. Returns positioning information for elements.',
      inputSchema: z.object({
        elements: z.array(z.object({
          id: z.string().describe('Unique identifier for the element'),
          type: z.enum(['text', 'mermaid', 'image']).describe('Type of element'),
          content: z.string().describe('Content or description for the element'),
          position: z.object({
            x: z.number().min(0).max(100).describe('Horizontal position as percentage (0-100)'),
            y: z.number().min(0).max(100).describe('Vertical position as percentage (0-100)'),
          }).describe('Position for this element'),
        })).describe('Array of elements to position'),
      }),
      execute: async ({ elements }) => {
        logger.info('Generate layout tool called', { elementCount: elements.length });
        return {
          type: 'layout',
          elements,
        };
      },
    });
  }

  // Get all tools
  getTools() {
    return {
      generateText: this.generateTextTool(),
      generateMermaidDiagram: this.generateMermaidDiagramTool(),
      generateImage: this.generateImageTool(),
      generateLayout: this.generateLayoutTool(),
    };
  }

  // Stream chat with tools
  async *streamChat(message, history = []) {
    try {
      const tools = this.getTools();
      
      const messages = [
        ...history.map(h => ({ role: h.role, content: h.content })),
        { role: 'user', content: message }
      ];

      const systemPrompt = `You are Jarvis, an advanced AI assistant with a futuristic interface. 
When responding to users, you can use tools to generate:
- Text content (generateText)
- Mermaid diagrams (generateMermaidDiagram) 
- Images (generateImage)
- Layouts for positioning multiple elements (generateLayout)

Use these tools creatively to provide rich, visual responses. When generating layouts, position elements across the screen for a dynamic Jarvis-like effect.`;

      const result = streamText({
        model: this.model,
        system: systemPrompt,
        messages,
        tools,
        maxSteps: 5,
      });

      // Stream both text and tool calls from fullStream
      for await (const chunk of result.fullStream) {
        if (chunk.type === 'text-delta') {
          yield { type: 'text', content: chunk.textDelta };
        } else if (chunk.type === 'tool-call') {
          yield { 
            type: 'tool-call', 
            toolName: chunk.toolName,
            args: chunk.args 
          };
        } else if (chunk.type === 'tool-result') {
          yield { 
            type: 'tool-result', 
            toolName: chunk.toolName,
            result: chunk.result 
          };
        }
      }

      logger.info('Stream completed');
    } catch (error) {
      logger.error('Stream request failed', { error: error.message });
      throw error;
    }
  }
}

module.exports = new AIService();

