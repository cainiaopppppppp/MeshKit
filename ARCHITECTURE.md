# 🏗️ MeshKit - 架构文档

## 项目架构总览

采用 **Monorepo** 架构，使用 **pnpm workspaces** + **Turbo** 管理多个包。

MeshKit是一套局域网协作工具套件，目前包含MeshDrop文件快传模块。

```
p2p_claude/
├── packages/
│   ├── core/           # 🎯 核心逻辑包（跨平台共享）
│   ├── web/            # 🌐 React Web应用
│   ├── desktop/        # 💻 Electron桌面应用
│   └── mobile/         # 📱 React Native移动应用
├── apps/
│   └── signaling/      # 🔌 信令服务器
├── pnpm-workspace.yaml # pnpm workspace配置
├── turbo.json          # Turbo构建配置
└── package.json        # 根package.json
```

---

## 📦 包说明

### 1. @meshkit/core

**核心逻辑包 - 跨平台共享**

#### 职责
- P2P连接管理（WebRTC）
- 文件传输逻辑
- 设备发现和管理
- 信令通信
- 事件系统
- 配置管理

#### 技术栈
- TypeScript
- PeerJS（WebRTC封装）
- EventEmitter3
- tsup（构建工具）

#### 目录结构
```
packages/core/
├── src/
│   ├── types/              # TypeScript类型定义
│   │   └── index.ts
│   ├── utils/              # 工具类
│   │   ├── EventBus.ts    # 事件总线
│   │   ├── Config.ts      # 配置管理
│   │   └── Logger.ts      # 日志系统
│   ├── managers/           # 管理器
│   │   ├── P2PManager.ts  # P2P连接管理
│   │   ├── DeviceManager.ts   # 设备管理
│   │   └── FileTransferManager.ts  # 文件传输
│   ├── services/           # 服务
│   │   └── SignalingClient.ts  # 信令客户端
│   └── index.ts           # 主导出
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

#### 导出API
```typescript
// 类型
export type { Device, FileMetadata, TransferProgress, ... }

// 工具
export { eventBus, config, logger }

// 管理器
export { P2PManager, DeviceManager, FileTransferManager }

// 服务
export { SignalingClient }
```

---

### 2. @meshkit/web

**React Web应用**

#### 职责
- Web端UI界面
- 浏览器兼容性处理
- PWA支持
- 响应式设计

#### 技术栈
- React 18
- TypeScript
- Vite
- Zustand / Jotai（状态管理）
- Tailwind CSS
- React Router

#### 目录结构
```
packages/web/
├── src/
│   ├── components/         # React组件
│   │   ├── DeviceList.tsx
│   │   ├── FileSelector.tsx
│   │   ├── TransferProgress.tsx
│   │   └── ...
│   ├── hooks/              # 自定义Hooks
│   │   ├── useP2P.ts
│   │   ├── useDevices.ts
│   │   └── useFileTransfer.ts
│   ├── store/              # 状态管理
│   │   └── index.ts
│   ├── App.tsx
│   └── main.tsx
├── public/
├── index.html
├── package.json
├── vite.config.ts
└── tsconfig.json
```

#### 特性
- ✅ PWA（可添加到主屏幕）
- ✅ 响应式设计（移动端/桌面端）
- ✅ 拖拽上传
- ✅ iOS Safari兼容

---

### 3. @meshkit/desktop

**Electron桌面应用**

#### 职责
- 桌面端原生体验
- 系统集成（文件管理器、托盘）
- 自动更新
- 原生通知

#### 技术栈
- Electron
- React 18
- TypeScript
- Vite
- electron-builder（打包）

#### 目录结构
```
packages/desktop/
├── electron/               # Electron主进程
│   ├── main.ts            # 主进程入口
│   ├── preload.ts         # 预加载脚本
│   └── ipc/               # IPC通信
├── src/                    # 渲染进程（React）
│   ├── components/
│   ├── hooks/
│   ├── App.tsx
│   └── main.tsx
├── package.json
├── electron-builder.yml
└── vite.config.ts
```

#### 特性
- ✅ 原生窗口
- ✅ 系统托盘
- ✅ 拖拽文件到应用
- ✅ 原生文件选择器
- ✅ 自动启动
- ✅ macOS / Windows / Linux支持

#### 打包输出
- macOS: `.dmg`, `.app`
- Windows: `.exe`, `.msi`
- Linux: `.AppImage`, `.deb`, `.rpm`

---

### 4. @meshkit/mobile

**React Native移动应用**

#### 职责
- 原生移动端体验
- 相机/相册集成
- 文件系统访问
- 推送通知

#### 技术栈
- React Native
- TypeScript
- Expo（推荐）或纯RN
- React Navigation
- react-native-fs（文件系统）

#### 目录结构
```
packages/mobile/
├── src/
│   ├── screens/           # 屏幕页面
│   │   ├── HomeScreen.tsx
│   │   ├── SendScreen.tsx
│   │   └── ReceiveScreen.tsx
│   ├── components/        # 组件
│   ├── navigation/        # 导航
│   ├── hooks/             # Hooks
│   └── App.tsx
├── android/               # Android原生代码
├── ios/                   # iOS原生代码
├── app.json               # Expo配置
└── package.json
```

#### 特性
- ✅ iOS / Android原生
- ✅ 相机集成
- ✅ 文件选择器
- ✅ 后台传输
- ✅ 推送通知
- ✅ 分享功能

---

### 5. apps/signaling

**信令服务器**

#### 职责
- WebSocket信令服务
- 设备发现
- NAT穿透协助

#### 技术栈
- Node.js
- ws（WebSocket库）
- TypeScript

#### 目录结构
```
apps/signaling/
├── src/
│   ├── server.ts          # 服务器主文件
│   ├── handlers/          # 消息处理器
│   └── types.ts           # 类型定义
├── package.json
└── tsconfig.json
```

---

## 🔄 数据流

### 1. 设备发现流程

```
[Device A] --register--> [Signaling Server]
[Device B] --register--> [Signaling Server]
                              |
                         broadcast
                              |
[Device A] <--device-list-- [Device B]
```

### 2. 文件传输流程

```
[Sender] --select file--> [Core: FileTransferManager]
              |
              |--select device--> [Core: DeviceManager]
              |
              |--establish P2P--> [Core: P2PManager]
              |                         |
              |                    [PeerJS]
              |                         |
              |--send chunks-------------> [Receiver]
              |
[Receiver] --save file--> [Platform: File System]
```

### 3. 事件流

```
[Core] --emit event--> [EventBus] --notify--> [Platform UI]
                                                    |
                                               [React/RN]
                                                    |
                                              [User sees update]
```

---

## 🎨 UI层架构

### Web / Desktop（React）

```typescript
// 使用Core包
import { eventBus, FileTransferManager } from '@meshkit/core';

// 自定义Hook
function useFileTransfer() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handler = (data) => setProgress(data.progress);
    eventBus.on('transfer:progress', handler);
    return () => eventBus.off('transfer:progress', handler);
  }, []);

  return { progress };
}

// 组件中使用
function TransferProgress() {
  const { progress } = useFileTransfer();
  return <ProgressBar value={progress} />;
}
```

### Mobile（React Native）

```typescript
// 使用Core包
import { eventBus, FileTransferManager } from '@meshkit/core';
import { View, Text } from 'react-native';

// 相同的Hook逻辑
function useFileTransfer() {
  // ... 与Web版相同
}

// RN组件
function TransferProgress() {
  const { progress } = useFileTransfer();
  return (
    <View>
      <Text>{progress}%</Text>
    </View>
  );
}
```

---

## 🛠️ 开发工作流

### 1. 安装依赖

```bash
# 安装pnpm（如果没有）
npm install -g pnpm

# 安装所有依赖
pnpm install
```

### 2. 开发

```bash
# 开发所有包（并行）
pnpm dev

# 只开发Web
pnpm dev:web

# 只开发Desktop
pnpm dev:desktop

# 只开发Mobile
pnpm dev:mobile
```

### 3. 构建

```bash
# 构建所有包
pnpm build

# 构建特定包
pnpm build:web
pnpm build:desktop
```

### 4. 类型检查

```bash
# 检查所有包
pnpm type-check
```

---

## 📦 发布流程

### Web发布

```bash
cd packages/web
pnpm build
# 部署到 Vercel / Netlify / 自托管
```

### Desktop发布

```bash
cd packages/desktop
pnpm build

# 打包
pnpm package:mac    # macOS
pnpm package:win    # Windows
pnpm package:linux  # Linux
```

### Mobile发布

```bash
cd packages/mobile

# iOS
pnpm ios:build

# Android
pnpm android:build
```

---

## 🔧 技术决策

### 为什么选择Monorepo？

1. **代码共享** - Core包被所有平台使用
2. **统一开发** - 一次修改，多平台受益
3. **类型安全** - TypeScript跨包类型共享
4. **简化依赖** - 统一版本管理

### 为什么选择React？

1. **生态成熟** - Web/Desktop/Mobile都支持
2. **组件复用** - UI逻辑可跨平台复用
3. **开发效率** - 热重载、DevTools
4. **社区支持** - 大量第三方库

### 为什么选择TypeScript？

1. **类型安全** - 编译时发现错误
2. **更好的IDE支持** - 自动补全、重构
3. **跨平台一致性** - 统一的类型定义
4. **可维护性** - 大型项目必备

---

## 🚀 扩展功能规划

### 已实现
- ✅ 基础P2P文件传输
- ✅ 设备发现
- ✅ 事件系统
- ✅ 配置管理

### 开发中
- 🔄 React Web UI
- 🔄 Electron Desktop
- 🔄 React Native Mobile

### 计划中
- ⏳ 多文件传输
- ⏳ 文件加密
- ⏳ 压缩传输
- ⏳ 聊天功能
- ⏳ 剪贴板共享
- ⏳ 屏幕共享

---

## 📚 相关文档

- [Core包README](./packages/core/README.md)
- [Web包README](./packages/web/README.md)
- [Desktop包README](./packages/desktop/README.md)
- [Mobile包README](./packages/mobile/README.md)
- [跨平台使用指南](./CROSS_PLATFORM_GUIDE.md)

---

**架构设计完成，开始实现各平台应用！** 🎉
