<p align="center">
  <img src="public/icons/icon128.png" alt="Spyder-Scribe" width="128" height="128" />
</p>

<h1 align="center">Spyder-Scribe</h1>

<p align="center">
  <strong>AI-powered browser translation with multiple LLM providers</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#development">Development</a> •
  <a href="#architecture">Architecture</a>
</p>

---

## Features

🌐 **Multi-Provider Translation**
- Google Gemini (2.5 Flash, 2.5 Pro, and more)
- xAI Grok (4.1 Fast, Reasoning variants)
- OpenAI GPT (5-nano, 5-mini)

⚡ **Translation Modes**
- **Full Page** – Translate entire web pages with one click
- **Selection Popup** – Select text to see instant translations
- **Context Menu** – Right-click to translate selection

🧠 **Smart Caching**
- Hybrid in-memory + IndexedDB cache
- 7-day TTL with LRU eviction
- Survives browser/extension restarts

🎨 **Modern UI**
- Dark theme with glassmorphism design
- Draggable & resizable translation popups
- Toast notifications for feedback

🛡️ **Privacy & Control**
- Per-site blacklisting
- All API keys stored locally
- No data sent to third parties (only to chosen AI provider)

---

## Installation

### From Source

1. **Clone the repository**
   ```bash
   git clone https://github.com/medy17/SpyderScribe.git
   cd SpyderScribe
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Build the extension**
   ```bash
   pnpm build
   ```

4. **Load in Chrome**
   - Navigate to `chrome://extensions`
   - Enable **Developer mode** (top right)
   - Click **Load unpacked**
   - Select the `dist` folder

---

## Usage

### Full Page Translation

1. Click the Spyder-Scribe icon in your browser toolbar
2. Select source and target languages
3. Click **Translate Page**
4. Click **Revert** to restore original text

### Selection Translation

1. Select any text on a webpage
2. A floating popup appears with the translation
3. Drag to reposition, resize as needed
4. Click outside to dismiss

### Context Menu

- Right-click selected text → **Translate Selection**
- Right-click on page → **Disable/Enable Spyder-Scribe on this site**

---

## Configuration

Open the extension popup and go to the **Settings** tab:

| Setting | Description |
|---------|-------------|
| **Gemini API Key** | Your Google AI Studio API key |
| **Grok API Key** | Your xAI API key |
| **OpenAI API Key** | Your OpenAI API key |
| **Model** | Choose which AI model to use |
| **Custom Prompt** | Optional custom translation instructions |

### Getting API Keys

- **Gemini**: [Google AI Studio](https://aistudio.google.com/)
- **Grok**: [xAI Platform](https://x.ai/)
- **OpenAI**: [OpenAI Platform](https://platform.openai.com/)

---

## Development

This project uses [Vite](https://vitejs.dev/) with [@crxjs/vite-plugin](https://crxjs.dev/vite-plugin) for hot-reloading during development.

### Setup

```bash
pnpm install
pnpm dev
```

Then load the `dist` folder as an unpacked extension. Changes will hot-reload automatically!

> **Tip:** If you see "Cannot connect to Vite Dev Server", ensure `pnpm dev` is running and reload the extension.

### Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server with HMR |
| `pnpm build` | Production build |
| `pnpm lint` | Run ESLint |
| `pnpm test` | Run tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:coverage` | Run tests with coverage |

### Tech Stack

| Technology | Version |
|------------|---------|
| React | 19 |
| TypeScript | 5.9 |
| Vite | 7 |
| Tailwind CSS | 4 |
| Vitest | 4 |
| shadcn/ui | Latest |

---

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed documentation on:

- Component structure
- Data flow diagrams  
- Translation pipeline
- Caching system
- Error handling
- Testing strategy

---

## Project Structure

```
src/
├── background/          # Service worker (message handling, API calls)
│   ├── handlers/        # Message routing
│   ├── managers/        # Context menus
│   └── services/        # Cache, translation, providers
├── content/             # Injected into web pages
│   └── selection/       # Text selection & popup
├── popup/               # Extension popup UI (React)
│   └── components/      # Tab components
├── components/ui/       # shadcn/ui components
├── lib/                 # Shared utilities
└── __tests__/           # Test suite
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is private. All rights reserved.

---

<p align="center">
  Made with ❤️ and 🕷️
</p>
