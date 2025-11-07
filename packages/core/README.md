# @meshkit/core

MeshKit核心逻辑包，提供跨平台共享的文件传输核心功能。

## 📦 功能

- ✅ 事件系统（EventBus）
- ✅ 配置管理（Config）
- ✅ TypeScript类型定义
- 🔄 P2P连接管理
- 🔄 文件传输管理
- 🔄 设备管理
- 🔄 信令服务

## 🎯 跨平台支持

此包被以下平台共享：

- 🌐 **Web** - React Web应用
- 💻 **Desktop** - Electron桌面应用
- 📱 **Mobile** - React Native移动应用

## 📖 使用

```typescript
import {
  eventBus,
  config,
  initCore,
  type Device,
  type FileMetadata
} from '@meshkit/core';

// 初始化
initCore();

// 监听事件
eventBus.on('transfer:started', (data) => {
  console.log('Transfer started:', data);
});

// 配置
config.set('transfer.chunkSize', 512 * 1024);
```

## 🏗️ 架构

```
src/
├── types/          # TypeScript类型定义
├── utils/          # 工具类（EventBus, Config等）
├── managers/       # 管理器（P2P, Device, FileTransfer）
├── services/       # 服务（Signaling）
└── index.ts        # 主导出文件
```

## 🔧 开发

```bash
# 开发模式（监听文件变化）
pnpm dev

# 构建
pnpm build

# 类型检查
pnpm type-check
```
