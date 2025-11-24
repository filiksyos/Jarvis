# Jarvis

https://github.com/user-attachments/assets/b195c62c-4ac9-4573-a066-93fa752040bb

🚀 **Futuristic AI Assistant with Jarvis-like Visual Interface**

A stealth desktop application featuring:
- 🎨 Visual chat interface with mermaid diagrams
- 🤖 OpenRouter AI integration (GPT-4, Claude, etc.)
- 👻 Stealth mode with invisible overlays
- 🪟 Advanced window management
- 🖼️ AI image generation

## 🎬 Features

### Visual Chat Interface (Jarvis-style)
- Fullscreen animated background
- Streaming AI responses
- Real-time mermaid diagram generation
- AI-generated images displayed across screen
- Futuristic glass morphism design

### Stealth Mode
- Process disguise (appears as "Terminal")
- Invisible click-through overlays
- Toggle visibility with global shortcuts
- Hidden from screen recording

### Advanced Window Management
- Multi-monitor support
- Draggable windows
- Window binding and positioning
- Always-on-top mode

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Environment
```bash
cp .env.example .env
```

Edit `.env` and add your OpenRouter API key:
```
OPENROUTER_API_KEY=your_key_here
```

Get your API key from: https://openrouter.ai/keys

### 3. Run the App
```bash
npm start
```

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Shift + V` | Toggle visibility |
| `Cmd/Ctrl + Shift + I` | Toggle click-through |
| `Cmd/Ctrl + Shift + C` | Open visual chat |
| `Cmd/Ctrl + ,` | Open settings |
| `Alt + A` | Toggle interaction mode |

## 🎨 Visual Features

### Mermaid Diagrams
The AI can generate architecture diagrams, flowcharts, and algorithm visualizations automatically.

### Image Generation
Request images and they'll appear as floating elements in the visual interface.

### Streaming Responses
Watch AI responses stream in real-time with futuristic animations.

## 🔧 Configuration

Edit `src/core/config.js` to customize:
- Window sizes and positions
- Stealth settings
- Visual effects
- AI model preferences

## 📦 Build Distributable

```bash
# macOS
npm run build:mac

# Windows
npm run build:win

# Linux
npm run build:linux
```

## 🛠️ Tech Stack

- **Electron** ^29.1.0 - Desktop framework
- **OpenRouter** - Multi-model AI access
- **Mermaid** ^10.6.1 - Diagram generation
- **Winston** ^3.17.0 - Logging
- **Tailwind CSS** - Styling

## 📝 License

MIT License - Based on TechyCSR/OpenCluely (original inspiration)

## 🙏 Credits

Inspired by:
- [TechyCSR/OpenCluely](https://github.com/TechyCSR/OpenCluely)
- [filiksyos/ai_outfit_app](https://github.com/filiksyos/ai_outfit_app)

---

**Made with ❤️ for the AI era**
