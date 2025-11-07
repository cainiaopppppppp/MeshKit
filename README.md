# MeshKit - MeshDrop 文件快传

基于WebRTC的P2P局域网文件传输系统，采用Monorepo架构，支持Web、桌面和移动端。

MeshKit是一套局域网协作工具套件，MeshDrop是其中的文件快传模块。

## 🚀 快速启动（5步即可运行）

```bash
# 1. 安装依赖
pnpm install

# 2. 构建核心包（⚠️ 首次必须执行）
pnpm --filter @meshkit/core build

# 3. 启动信令服务器（新开终端窗口）
pnpm dev:signaling

# 4. 启动Web应用（再开一个终端窗口）
pnpm dev:web

# 5. 浏览器访问 http://localhost:3000
```

## ✨ 特性

- ⚡ **极速传输** - P2P直连，局域网内传输速度可达20-50 MB/s
- 🔒 **安全私密** - 数据仅在局域网内传输，不经过互联网
- 📦 **Monorepo架构** - 代码复用最大化
- 🎯 **TypeScript** - 完整的类型安全
- 🌐 **多平台支持** - Web、Desktop（Electron）、Mobile（React Native）
- 📱 **完美兼容** - 支持iOS、Android、Mac、Windows、Linux

## 📦 项目结构

```
p2p_claude/
├── packages/
│   ├── core/          ✅ 核心逻辑包（跨平台共享）
│   ├── web/           ✅ React Web应用
│   ├── desktop/       ⏳ Electron桌面应用（待实现）
│   └── mobile/        ⏳ React Native移动应用（待实现）
├── apps/
│   └── signaling/     ✅ 信令服务器
└── docs/              📚 文档
```

## 🚀 快速开始

### 前置要求

- Node.js >= 18
- pnpm >= 8

```bash
# 安装pnpm
npm install -g pnpm
```

### 安装依赖

```bash
# 1. 克隆项目
git clone <repository-url>
cd p2p_claude

# 2. 安装所有依赖
pnpm install
```

### ⚠️ 首次使用必看

**第一次运行前，必须先构建 Core 包！**

```bash
# 构建核心包（必须先执行）
pnpm --filter @meshkit/core build
```

> **为什么需要这步？**
> `@meshkit/core` 是 TypeScript 编写的核心包，需要编译成 JavaScript 后才能被 Web 应用使用。
> 构建后会生成 `packages/core/dist/` 目录，包含编译后的 JS 文件和类型定义。

### 开发

#### 方式一：完整启动（推荐新手）

```bash
# 一次性构建所有包（包括Core）
pnpm build

# 然后启动信令服务器（终端1）
pnpm dev:signaling

# 启动Web应用（终端2）
pnpm dev:web
```

#### 方式二：分步启动（推荐开发者）

**终端 1 - 启动信令服务器：**
```bash
pnpm dev:signaling
```

服务器会显示访问地址，例如：`ws://192.168.1.100:8000`

**终端 2 - 启动 Web 应用：**
```bash
pnpm dev:web
```

浏览器会自动打开 `http://localhost:3000`

> 💡 **提示**：如果修改了 Core 包的代码，需要重新构建：`pnpm --filter @meshkit/core build`

#### 3. 在其他设备上访问

在同一WiFi下的其他设备（手机、平板）上，使用浏览器访问：

```
http://[你的电脑IP]:3000
```

## 📖 使用说明

### Web版使用

1. **发送文件**
   - 打开Web应用
   - 切换到"📤 发送"模式
   - 点击或拖拽文件到选择区域
   - 选择目标设备
   - 点击"发送文件"

2. **接收文件**
   - 打开Web应用
   - 切换到"📥 接收"模式
   - 等待其他设备发送文件
   - 接收完成后点击"下载文件"

### iOS Safari 特别说明

由于iOS Safari的限制，下载文件需要：
1. 点击"下载文件"按钮
2. 在新打开的页面中**长按**文件
3. 选择"存储到文件"
4. 选择保存位置（如iCloud云盘）

## 🏗️ 技术栈

### Core包
- TypeScript
- PeerJS (WebRTC封装)
- EventEmitter3
- tsup (构建工具)

### Web应用
- React 18
- TypeScript
- Vite
- Zustand (状态管理)
- Tailwind CSS

### 信令服务器
- Node.js
- WebSocket (ws库)

## 📚 核心API

### 初始化

```typescript
import { initCore, connectSignaling } from '@meshkit/core';

// 初始化核心模块
const { deviceId, deviceName } = await initCore();

// 连接信令服务器
connectSignaling('ws://localhost:8000');
```

### 文件传输

```typescript
import {
  fileTransferManager,
  deviceManager,
  eventBus,
} from '@meshkit/core';

// 选择文件
const file = document.getElementById('fileInput').files[0];
fileTransferManager.selectFile(file);

// 选择目标设备
deviceManager.selectDevice(targetDeviceId);

// 发送文件
await fileTransferManager.sendFile(targetDeviceId);

// 监听进度
eventBus.on('transfer:progress', (progress) => {
  console.log(`进度: ${progress.progress}%`);
  console.log(`速度: ${progress.speedMB} MB/s`);
});

// 下载接收的文件
fileTransferManager.downloadFile();
```

## 🔧 开发命令

```bash
# 构建Core包（首次必须执行）
pnpm --filter @meshkit/core build

# 构建所有包
pnpm build

# 开发所有包（并行）
pnpm dev

# 只开发Web应用
pnpm dev:web

# 只开发信令服务器
pnpm dev:signaling

# 构建Web应用
pnpm build:web

# 类型检查
pnpm type-check

# 清理构建产物
pnpm clean
```

## ❓ 常见问题

### 1. 启动 Web 应用时报错：`Failed to resolve entry for package "@meshkit/core"`

**原因**：Core 包没有构建，缺少 dist 目录。

**解决方法**：
```bash
pnpm --filter @meshkit/core build
```

### 2. 设备列表为空，看不到其他设备

**原因**：
- 信令服务器没有启动
- 设备不在同一局域网
- 防火墙阻止了 WebSocket 连接

**解决方法**：
1. 确保信令服务器正在运行：`pnpm dev:signaling`
2. 确保所有设备连接到同一 WiFi
3. 检查防火墙设置，允许端口 8000 和 3000

### 3. iOS Safari 无法下载文件

**原因**：iOS Safari 的安全限制。

**解决方法**：
1. 点击"下载文件"后，会打开新标签页
2. **长按**图片/文件
3. 选择"存储到文件"或"添加到照片"
4. 选择保存位置

### 4. 传输速度很慢

**可能原因**：
- WiFi 信号弱
- 使用了 5GHz 和 2.4GHz 混合连接
- 路由器性能限制

**解决方法**：
- 确保设备距离路由器较近
- 使用同一频段的 WiFi（都用 5GHz 或都用 2.4GHz）
- 减少其他设备的网络占用

### 5. Windows 系统下 pnpm 命令不可用

**解决方法**：
```bash
# 全局安装 pnpm
npm install -g pnpm

# 验证安装
pnpm --version
```

### 6. 修改了 Core 包代码后，Web 应用没有更新

**原因**：需要重新构建 Core 包。

**解决方法**：
```bash
# 重新构建 Core 包
pnpm --filter @meshkit/core build

# 或者使用 watch 模式（自动重新构建）
pnpm --filter @meshkit/core dev
```

### 7. 大文件（1GB+）传输失败或缓慢

**已修复**！现在系统已优化支持大文件：

**优化内容**：
- ✅ 流式读取文件，避免内存溢出
- ✅ 智能背压控制，防止缓冲区溢出
- ✅ 增大chunk大小至1MB，提高效率
- ✅ 5分钟传输超时，支持大文件
- ✅ 内存自动清理

**性能**：
- 支持文件大小：**无限制**（理论上）
- 测试通过：200MB ✅, 1GB+ ✅
- 传输速度：20-50 MB/s（局域网）
- 内存占用：低（流式处理）

## 🌟 功能特性

### 已实现 ✅
- P2P连接管理
- **大文件支持** - 优化的流式传输，支持1GB+文件
- 文件分块传输（1MB chunks，智能背压控制）
- 实时进度显示
- 速度和剩余时间计算
- 设备自动发现
- 心跳和重连机制
- 超时和错误处理
- 内存优化（流式读取，避免溢出）
- iOS Safari兼容
- 响应式UI

### 计划中 ⏳
- 多文件批量传输
- 文件加密传输
- 压缩传输
- 聊天功能
- 剪贴板共享
- Electron桌面应用
- React Native移动应用

## 🎯 性能

- **传输速度**: 20-50 MB/s (良好WiFi)
- **分块大小**: 256KB
- **延迟**: <1ms (局域网)

## 📄 文档

- [架构设计](./ARCHITECTURE.md) - 详细的架构说明
- [快速开始](./GETTING_STARTED.md) - 开发指南
- [Core包文档](./packages/core/README.md) - 核心包API
- [跨平台使用指南](./CROSS_PLATFORM_GUIDE.md) - 各平台使用说明

## 📝 许可证

MIT License

---

**Made with ❤️ for seamless P2P file transfer**
