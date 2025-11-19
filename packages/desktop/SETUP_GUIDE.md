# MeshKit Desktop 安装和运行指南

## 快速开始

### 1. 安装依赖

从项目根目录运行：

```bash
# 安装所有依赖（如果遇到 Electron 下载失败，参考下面的解决方案）
pnpm install

# 构建 core 包（必需）
pnpm --filter @meshkit/core build
```

### 2. 运行开发模式

```bash
# 从项目根目录
pnpm dev:desktop

# 或从 desktop 目录
cd packages/desktop
pnpm dev
```

## Electron 下载问题解决方案

如果遇到 Electron 下载失败的问题（403 Forbidden），可以使用以下方法：

### 方法 1: 使用国内镜像（推荐）

```bash
# 设置 Electron 镜像
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
export ELECTRON_CUSTOM_DIR="{{ version }}"

# 然后安装依赖
pnpm install
```

### 方法 2: 使用 .npmrc 配置

在项目根目录创建或编辑 `.npmrc` 文件：

```
electron_mirror=https://npmmirror.com/mirrors/electron/
electron_custom_dir={{ version }}
```

### 方法 3: 跳过 postinstall（开发时）

```bash
# 跳过安装脚本
pnpm install --ignore-scripts

# 然后手动安装 Electron
cd packages/desktop
pnpm add -D electron
```

## 开发环境配置

1. 确保已安装 Node.js >= 18
2. 确保已安装 pnpm >= 8
3. 从项目根目录运行 `pnpm install`

## 运行项目

### 开发模式

```bash
# 从项目根目录
pnpm dev:desktop

# 或从 desktop 目录
cd packages/desktop
pnpm dev
```

### 构建项目

```bash
# 从项目根目录
pnpm build:desktop

# 或从 desktop 目录
cd packages/desktop
pnpm build
```

### 打包应用

```bash
cd packages/desktop

# 打包为发布版本
pnpm dist

# 打包特定平台
pnpm dist:win     # Windows
pnpm dist:mac     # macOS
pnpm dist:linux   # Linux
```

## 常见问题

### Q: Electron 下载失败怎么办？

A: 参考上面的"方法 1"使用国内镜像。

### Q: 如何调试主进程？

A: 开发模式下，主进程会监听 5858 端口，可以使用 Chrome DevTools 连接：
1. 打开 Chrome 浏览器
2. 访问 `chrome://inspect`
3. 点击 "Configure" 添加 `localhost:5858`
4. 连接并调试

### Q: 如何调试渲染进程？

A: 开发模式下会自动打开 DevTools。或者按 `Ctrl+Shift+I` (Windows/Linux) 或 `Cmd+Option+I` (macOS)。

### Q: 打包后的应用在哪里？

A: 在 `packages/desktop/release` 目录下。

## 项目结构说明

```
packages/desktop/
├── src/
│   ├── main/           # Electron 主进程
│   │   └── main.ts     # 窗口管理、IPC 通信等
│   ├── preload/        # 预加载脚本
│   │   └── preload.ts  # 安全的 API 桥接
│   └── renderer/       # 渲染进程（React 应用）
│       ├── pages/      # 页面组件（复用 web 包）
│       ├── App.tsx     # 主应用组件
│       ├── main.tsx    # React 入口
│       └── index.html  # HTML 模板
├── build/              # 构建资源
│   └── icon.png        # 应用图标
├── dist/               # 构建输出
│   ├── main/           # 主进程编译后的代码
│   ├── preload/        # 预加载脚本编译后的代码
│   └── renderer/       # 渲染进程编译后的代码
└── release/            # 打包输出
```

## 开发工作流

1. **启动开发服务器**
   ```bash
   pnpm dev
   ```
   这会启动 Vite 开发服务器和 Electron 应用。

2. **修改代码**
   - 渲染进程代码修改会热更新
   - 主进程代码修改需要重启 Electron

3. **测试**
   - 在 Electron 窗口中测试功能
   - 使用 DevTools 调试

4. **构建和打包**
   ```bash
   pnpm build
   pnpm dist
   ```

## 更多资源

- [Electron 文档](https://www.electronjs.org/docs)
- [Vite 文档](https://vitejs.dev)
- [React 文档](https://react.dev)
