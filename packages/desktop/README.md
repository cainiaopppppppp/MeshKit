# MeshKit Desktop

基于 Electron 的 MeshKit 桌面应用，提供 P2P 文件传输、便签墙和加密聊天功能。

## 功能特性

- 📁 **文件传输**: P2P 局域网文件传输，支持大文件和文件夹
- 📝 **便签墙**: 实时协作便签墙
- 💬 **加密聊天**: 端到端加密聊天

## 开发

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm dev
```

这会同时启动：
- Vite 开发服务器（渲染进程）
- Electron 主进程（调试模式）

### 构建

```bash
# 构建所有部分
pnpm build

# 或分别构建
pnpm build:main      # 构建主进程
pnpm build:preload   # 构建预加载脚本
pnpm build:renderer  # 构建渲染进程
```

### 打包

```bash
# 打包当前平台
pnpm package

# 打包为发布版本
pnpm dist

# 打包特定平台
pnpm dist:win    # Windows
pnpm dist:mac    # macOS
pnpm dist:linux  # Linux
```

## 项目结构

```
packages/desktop/
├── src/
│   ├── main/           # Electron 主进程
│   │   └── main.ts
│   ├── preload/        # 预加载脚本
│   │   └── preload.ts
│   └── renderer/       # 渲染进程（React）
│       ├── pages/
│       ├── App.tsx
│       ├── main.tsx
│       └── index.html
├── build/              # 构建资源（图标等）
├── dist/               # 构建输出
└── release/            # 打包输出
```

## 技术栈

- **Electron**: 跨平台桌面应用框架
- **React**: UI 框架
- **TypeScript**: 类型安全
- **Vite**: 快速构建工具
- **Tailwind CSS**: 样式框架
- **PeerJS**: WebRTC P2P 连接

## 许可证

MIT
