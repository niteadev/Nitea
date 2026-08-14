<div align="center">

![Nitea Banner](https://github.com/niteadev/niteaassets/blob/main/images/header_1640x857.png?raw=true)

# Nitea

**Unleash Your Potential. Master Your Focus.**

An open-source, cross-platform desktop application designed to eliminate digital distractions and foster deep focus during demanding work and study sessions.

[![GitHub Release](https://img.shields.io/github/v/release/niteadev/nitea?style=flat-square&color=blue)](https://github.com/niteadev/nitea/releases)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=flat-square)](https://github.com/niteadev/nitea/releases)
[![Electron](https://img.shields.io/badge/Electron-28.x-47848F?style=flat-square&logo=electron)](https://www.electronjs.org/)
[![Vue](https://img.shields.io/badge/Vue.js-3.x-4FC08D?style=flat-square&logo=vue.js)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Crowdin](https://img.shields.io/badge/Crowdin-Translations-2E3440?style=flat-square&logo=crowdin)](https://crowdin.com)
[![Website](https://img.shields.io/badge/website-nitea.cc-orange?style=flat-square)](https://nitea.cc)

---

</div>

<div align="center">
  <img src="https://github.com/niteadev/niteaassets/blob/main/images/nitea1.0.0screen.png?raw=true" alt="Nitea Application Preview" width="850" />
</div>

## Overview

In an age of constant notifications and digital interruptions, achieving deep work requires intentional boundaries. **Nitea** is built to bridge the gap between intention and execution by locking down distraction vectors and offering an immersive, minimalist workspace.

Whether you are programming, writing, studying, or engaging in creative work, Nitea ensures your focus remains uninterrupted until your session goals are met.

---

## Features

- **Fullscreen Immersive Workspace**: Launches an uncluttered, borderless fullscreen focus environment designed to keep your attention pinned on what matters.
- **Strict Mode Enforcement**: Optional strict discipline mode that prevents premature session termination (intercepts exit hotkeys like `Alt+F4`) until the timer expires.
- **Granular Session Customization**: Fine-tune focus intervals with precision controls for hours, minutes, and seconds, accompanied by real-time countdowns.
- **Micro-Interactions & Celebration Effects**: Smooth transitions, real-time feedback toast notifications, and celebration animations upon completing focus blocks.
- **Dark and Light Themes**: Carefully balanced color palettes built to reduce eye strain in any lighting condition.
- **Seamless Auto-Updates**: Integrated background updater powered by `electron-updater` and GitHub Releases for friction-free version management.
- **Global Localization**: Multi-language support with live language switching, seamlessly synchronized via Crowdin.
- **Cross-Platform Compatibility**: Native desktop builds for Windows, macOS, and Linux.

---

## Installation

### Download Pre-Built Binaries

Download the latest version for your platform from the [GitHub Releases](https://github.com/niteadev/nitea/releases) page or via the official website at [nitea.cc](https://nitea.cc).

| Platform | Format | Architecture |
|---|---|---|
| **Windows** | `.exe` (NSIS Installer) | x64 |


---

## Tech Stack

Nitea is built using a modern, performant desktop web stack:

- **Desktop Framework**: [Electron 28](https://www.electronjs.org/) with secure IPC preload architecture
- **Frontend UI**: [Vue 3](https://vuejs.org/) (Composition API, `<script setup>`)
- **Build System**: [electron-vite](https://electron-vite.org/) & [Vite 5](https://vitejs.dev/)
- **Packaging**: [electron-builder](https://www.electron.build/)
- **Icons**: [Lucide Icons](https://lucide.dev/) (`@lucide/vue`, `lucide-vue-next`)
- **Language & Types**: [TypeScript 5](https://www.typescriptlang.org/)
- **Localization**: [Crowdin](https://crowdin.com) integration

---

## Getting Started

### Prerequisites

Ensure you have the following installed on your development machine:

- **Node.js**: `v18.x` or `v20.x` or later
- **npm**: `v9.x` or later (or `pnpm` / `yarn`)
- **Git**

### Installation Steps

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/niteadev/nitea.git
   cd nitea
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```

4. **Type Check and Linting**:
   ```bash
   # Run full type checking across Node and Web contexts
   npm run typecheck

   # Run ESLint check and auto-fix
   npm run lint

   # Format code using Prettier
   npm run format
   ```

---

## Building Executables

To package Nitea into production-ready standalone installers or executables for your target platform:

```bash
# Build for Windows (NSIS installer)
npm run build:win

# Build for Microsoft Store (AppX package)
npm run build:mstore

# Build for macOS (DMG package)
npm run build:mac

# Build for Linux (AppImage, deb, snap)
npm run build:linux

# Unpacked directory build (for testing)
npm run build:unpack
```

Packaged distribution artifacts will be placed in the `dist/` directory.

---

## Project Structure

```text
nitea/
├── build/                     # App icons, certificates, installer graphics
├── resources/                 # Packaged static assets
├── scripts/                   # Utility scripts (Crowdin sync, automated tasks)
├── src/
│   ├── main/                  # Electron main process (lifecycle, IPC, window management)
│   │   └── index.ts
│   ├── preload/               # Secure context isolation scripts (API bridges)
│   │   ├── index.d.ts
│   │   └── index.ts
│   └── renderer/              # Vue 3 Frontend UI
│       ├── src/
│       │   ├── assets/        # Styles, images, and audio assets
│       │   ├── components/    # Modals, TitleBar, ToastNotifications, Dialogs
│       │   ├── languages/     # I18n JSON translation files (en, it, de, es, etc.)
│       │   ├── App.vue        # Main application component & state machine
│       │   └── main.ts        # Renderer entry point
│       └── index.html         # Frontend HTML entry point
├── electron-builder.yml       # Electron builder packaging configuration
├── electron.vite.config.ts    # Vite bundling configuration for main/preload/renderer
├── crowdin.yml                # Crowdin localization configuration
├── package.json               # Dependencies and build scripts
└── tsconfig.json              # TypeScript root configuration
```

---

## Localization

Nitea is available in multiple languages and welcomes internationalization contributions.

### Supported Languages

- English (`en`)
- Italian (`it`)
- German (`de`)
- Spanish (`es`)
- Portuguese (`pt`)
- Russian (`ru`)
- Arabic (`ar`)

### Syncing Translations with Crowdin

We use Crowdin to manage crowd-sourced community translations:

```bash
# Upload base English strings to Crowdin
npm run crowdin:upload

# Download updated translations and sync language definitions
npm run crowdin:download

# Synchronize local language manifests
npm run crowdin:sync
```

If you would like to help translate Nitea into your native language, please check our [Crowdin Project](https://crowdin.com) or submit a Pull Request adding strings to `src/renderer/src/languages/`.

---

## Contributing

Contributions make the open-source community an incredible place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your Changes (`git commit -m 'feat: add some AmazingFeature'`).
4. Push to the Branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

Please ensure your code passes both `npm run typecheck` and `npm run lint` before opening a pull request.

---

## License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

## Acknowledgments

- [Electron](https://www.electronjs.org/) for the cross-platform runtime.
- [Vue.js](https://vuejs.org/) for the reactive UI layer.
- [Lucide](https://lucide.dev/) for the clean, consistent icons.
- All our contributors, translators, and users who support the project.
