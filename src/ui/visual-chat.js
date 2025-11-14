// Initialize mermaid
mermaid.initialize({ startOnLoad: false, theme: 'dark' });

const messagesArea = document.getElementById('messagesArea');
const inputField = document.getElementById('inputField');
const closeBtn = document.getElementById('closeBtn');

let currentStreamingMessage = null;
let currentToolCalls = new Map(); // Track tool calls by toolName
let positionedElements = []; // Track positioned elements for Jarvis effect

// Ensure electronAPI is available
console.log('electronAPI available:', !!window.electronAPI);
console.log('onToolResult available:', !!window.electronAPI?.onToolResult);

// Setup IPC listeners immediately
function setupIPCListeners() {
  // Listen for stream chunks
  if (window.electronAPI?.onChatStreamChunk) {
    window.electronAPI.onChatStreamChunk((data) => {
      if (currentStreamingMessage) {
        const currentText = currentStreamingMessage.querySelector('.message-text')?.textContent || '';
        updateMessage(currentStreamingMessage, currentText + data.chunk);
      }
    });
  }

  // Listen for tool calls
  if (window.electronAPI?.onToolCall) {
    window.electronAPI.onToolCall((data) => {
      console.log('Tool call received:', data);
      const { toolName, args } = data;
      currentToolCalls.set(toolName, { args, status: 'calling' });
    });
  } else {
    console.error('onToolCall not available!');
  }

  // Listen for tool results
  if (window.electronAPI?.onToolResult) {
    window.electronAPI.onToolResult(async (data) => {
      console.log('Tool result received:', data);
      const { toolName, result } = data;
      
      // Update tool call status
      const toolCall = currentToolCalls.get(toolName);
      if (toolCall) {
        toolCall.status = 'completed';
        toolCall.result = result;
      }

      // Handle different tool results
      console.log('Handling tool result:', toolName, result);
      await handleToolResult(toolName, result);
    });
  } else {
    console.error('onToolResult not available!');
  }

  // Listen for stream completion
  if (window.electronAPI?.onChatStreamComplete) {
    window.electronAPI.onChatStreamComplete(() => {
      if (currentStreamingMessage) {
        currentStreamingMessage.classList.remove('streaming');
        currentStreamingMessage = null;
      }
    });
  }
}

// Setup listeners immediately
setupIPCListeners();

// Close button handler
closeBtn.addEventListener('click', () => {
  window.electronAPI.hideVisualChat();
});

// Send message on Enter (Shift+Enter for new line)
inputField.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Auto-resize textarea
inputField.addEventListener('input', () => {
  inputField.style.height = 'auto';
  inputField.style.height = Math.min(inputField.scrollHeight, 80) + 'px';
});

async function sendMessage() {
  const text = inputField.value.trim();
  if (!text) return;

  // Add user message
  addMessage(text, 'user');
  inputField.value = '';
  inputField.style.height = 'auto';

  // Clear previous positioned elements
  clearPositionedElements();

  // Create streaming assistant message
  currentStreamingMessage = addMessage('', 'assistant', true);
  currentToolCalls.clear();

  try {
    // Send message and stream response
    await window.electronAPI.sendChatStream(text);
  } catch (error) {
    updateMessage(currentStreamingMessage, `Error: ${error.message}`);
  }
}


// Handle tool results
async function handleToolResult(toolName, result) {
  console.log('handleToolResult called:', toolName, result);
  if (!result) {
    console.warn('No result provided');
    return;
  }

  try {
    if (toolName === 'generateText') {
      console.log('generateText result structure:', result);
      const { content, position } = result;
      console.log('Extracted content:', content, 'position:', position);
      
      if (!content) {
        console.error('No content in generateText result:', result);
        return;
      }
      
      if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
        console.warn('Invalid position, using defaults:', position);
        addPositionedElement('text', content, { x: 50, y: 50 });
      } else {
        addPositionedElement('text', content, position);
      }
    } else if (toolName === 'generateMermaidDiagram') {
      const { content, position } = result;
      console.log('Adding mermaid element:', content, position);
      await addPositionedElement('mermaid', content, position);
    } else if (toolName === 'generateImage') {
      const { content, position } = result;
      console.log('Adding image element:', content, position);
      addPositionedElement('image', content, position);
    } else if (toolName === 'generateLayout') {
      const { elements } = result;
      console.log('Adding layout elements:', elements);
      // Handle layout - position multiple elements
      for (const element of elements) {
        if (element.type === 'text') {
          addPositionedElement('text', element.content, element.position);
        } else if (element.type === 'mermaid') {
          await addPositionedElement('mermaid', element.content, element.position);
        } else if (element.type === 'image') {
          addPositionedElement('image', element.content, element.position);
        }
      }
    } else {
      console.warn('Unknown tool name:', toolName);
    }
  } catch (error) {
    console.error('Error handling tool result:', error);
  }
}

// Add positioned element to screen
async function addPositionedElement(type, content, position) {
  console.log('addPositionedElement called:', type, content, position);
  
  if (!content) {
    console.error('No content provided for', type);
    return;
  }
  
  if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
    console.error('Invalid position provided:', position);
    position = { x: 50, y: 50 };
  }
  
  const element = document.createElement('div');
  element.className = `positioned-element positioned-${type}`;
  element.style.left = `${position.x}%`;
  element.style.top = `${position.y}%`;
  element.style.zIndex = '1000';
  
  // Add animation
  element.style.opacity = '0';
  element.style.transform = 'scale(0.8) translateY(20px)';
  
  if (type === 'text') {
    const textDiv = document.createElement('div');
    textDiv.className = 'positioned-text';
    textDiv.textContent = content;
    textDiv.style.color = '#e0e0e0';
    element.appendChild(textDiv);
    console.log('Text div created with content:', content.substring(0, 50));
  } else if (type === 'mermaid') {
    const diagramContainer = document.createElement('div');
    diagramContainer.className = 'positioned-diagram';
    try {
      // Generate a valid CSS selector ID (no decimals allowed)
      const uniqueId = 'mermaid-' + Date.now() + '-' + Math.floor(Math.random() * 1000000);
      const { svg } = await mermaid.render(uniqueId, content);
      diagramContainer.innerHTML = svg;
      element.appendChild(diagramContainer);
    } catch (error) {
      diagramContainer.textContent = `Failed to render diagram: ${error.message}`;
      element.appendChild(diagramContainer);
    }
  } else if (type === 'image') {
    const imageContainer = document.createElement('div');
    imageContainer.className = 'positioned-image-container';
    const img = document.createElement('img');
    img.src = content;
    img.alt = 'Generated image';
    imageContainer.appendChild(img);
    element.appendChild(imageContainer);
  }

  document.body.appendChild(element);
  positionedElements.push(element);
  console.log('Element appended to body:', element, 'Total positioned elements:', positionedElements.length);
  console.log('Element computed style:', window.getComputedStyle(element).display, window.getComputedStyle(element).visibility);

  // Animate in
  requestAnimationFrame(() => {
    element.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
    element.style.opacity = '1';
    element.style.transform = 'scale(1) translateY(0)';
    element.style.visibility = 'visible';
    console.log('Element animated in, opacity:', element.style.opacity);
    
    // Fallback: ensure visibility after animation
    setTimeout(() => {
      if (window.getComputedStyle(element).opacity === '0') {
        console.warn('Element still invisible after animation, forcing visibility');
        element.style.opacity = '1';
        element.style.visibility = 'visible';
      }
    }, 600);
  });
}

// Clear positioned elements
function clearPositionedElements() {
  positionedElements.forEach(el => {
    el.style.transition = 'all 0.3s ease-out';
    el.style.opacity = '0';
    el.style.transform = 'scale(0.8) translateY(-20px)';
    setTimeout(() => el.remove(), 300);
  });
  positionedElements = [];
}



// Helper functions
function addMessage(text, role, isStreaming = false) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}${isStreaming ? ' streaming' : ''}`;
  
  const textDiv = document.createElement('div');
  textDiv.className = 'message-text';
  textDiv.textContent = text;
  
  messageDiv.appendChild(textDiv);
  messagesArea.appendChild(messageDiv);
  
  // Auto-scroll to bottom
  messagesArea.scrollTop = messagesArea.scrollHeight;
  
  return messageDiv;
}

function updateMessage(messageElement, newText) {
  const textDiv = messageElement.querySelector('.message-text');
  if (textDiv) {
    textDiv.textContent = newText;
  }
  
  // Auto-scroll to bottom
  messagesArea.scrollTop = messagesArea.scrollHeight;
}

async function renderMermaidDiagram(messageElement, mermaidCode) {
  const diagramContainer = document.createElement('div');
  diagramContainer.className = 'diagram-container';
  
  try {
    // Generate a valid CSS selector ID (no decimals allowed)
    const uniqueId = 'mermaid-diagram-' + Date.now() + '-' + Math.floor(Math.random() * 1000000);
    const { svg } = await mermaid.render(uniqueId, mermaidCode);
    diagramContainer.innerHTML = svg;
    messageElement.appendChild(diagramContainer);
  } catch (error) {
    diagramContainer.textContent = `Failed to render diagram: ${error.message}`;
    messageElement.appendChild(diagramContainer);
  }
  
  // Auto-scroll to bottom
  messagesArea.scrollTop = messagesArea.scrollHeight;
}

function addImageToMessage(messageElement, imageUrl) {
  const imageContainer = document.createElement('div');
  imageContainer.className = 'image-container';
  
  const img = document.createElement('img');
  img.src = imageUrl;
  img.alt = 'Generated image';
  img.onload = () => {
    // Auto-scroll when image loads
    messagesArea.scrollTop = messagesArea.scrollHeight;
  };
  
  imageContainer.appendChild(img);
  messageElement.appendChild(imageContainer);
}

// Listen for session cleared
if (window.electronAPI.onSessionCleared) {
  window.electronAPI.onSessionCleared(() => {
    messagesArea.innerHTML = '';
    clearPositionedElements();
  });
}
