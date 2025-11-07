# 🚀 MeshKit - 快速开始

## 📋 前置要求

确保你的系统安装了以下工具：

```bash
# Node.js (v18+)
node --version

# pnpm (推荐的包管理器)
npm install -g pnpm

# 验证pnpm
pnpm --version
```

---

## 🏁 初始化项目

### 1. 安装所有依赖

```bash
cd p2p_claude
pnpm install
```

这会安装所有packages的依赖。

### 2. 构建核心包

```bash
# 构建core包（其他包依赖它）
cd packages/core
pnpm build

# 或在根目录
pnpm --filter @meshkit/core build
```

---

## 💻 开发各个平台

### Web开发

```bash
# 启动Web开发服务器
pnpm dev:web

# 访问 http://localhost:3000
```

### Desktop开发（Electron）

```bash
# 启动Electron应用
pnpm dev:desktop
```

### Mobile开发（React Native）

```bash
# iOS (需要Mac + Xcode)
pnpm dev:mobile
# 然后按 'i' 启动iOS模拟器

# Android (需要Android Studio)
pnpm dev:mobile
# 然后按 'a' 启动Android模拟器
```

### 信令服务器

```bash
# 启动信令服务器
pnpm dev:signaling

# 服务器会在 http://localhost:8000 运行
```

---

## 🔄 完整开发流程

### 开发新功能的步骤

1. **修改Core包**
   ```bash
   cd packages/core
   # 修改代码
   pnpm dev  # 监听模式，自动重新构建
   ```

2. **在Web中使用**
   ```bash
   cd packages/web
   pnpm dev  # 会自动使用最新的Core包
   ```

3. **同步到Desktop/Mobile**
   - Core包的改动会自动同步到所有平台
   - 只需重启对应平台的dev服务器

---

## 📦 项目结构

```
p2p_claude/
├── packages/
│   ├── core/       ← 从这里开始！核心逻辑
│   ├── web/        ← React Web应用
│   ├── desktop/    ← Electron桌面应用
│   └── mobile/     ← React Native移动应用
├── apps/
│   └── signaling/  ← 信令服务器
└── pnpm-workspace.yaml
```

---

## 🎯 当前状态

### ✅ 已完成
- [x] Monorepo架构搭建
- [x] Core包基础结构
  - [x] TypeScript类型定义
  - [x] EventBus事件系统
  - [x] Config配置管理
- [x] 完整的架构文档

### 🔄 进行中
- [ ] Core包完整实现
  - [ ] P2PManager
  - [ ] FileTransferManager
  - [ ] DeviceManager
  - [ ] SignalingClient
- [ ] React Web应用
- [ ] Electron桌面应用
- [ ] React Native移动应用

---

## 🛠️ 常用命令

### 根目录命令

```bash
# 安装依赖
pnpm install

# 开发所有包（并行）
pnpm dev

# 构建所有包
pnpm build

# 类型检查
pnpm type-check

# 清理
pnpm clean
```

### 针对特定包

```bash
# 只开发Web
pnpm dev:web
pnpm build:web

# 只开发Desktop
pnpm dev:desktop
pnpm build:desktop

# 只开发Mobile
pnpm dev:mobile
pnpm build:mobile
```

### 在特定包中运行命令

```bash
# 在core包中运行命令
pnpm --filter @meshkit/core [command]

# 例如
pnpm --filter @meshkit/core build
pnpm --filter @meshkit/core type-check
```

---

## 🐛 故障排除

### pnpm install失败

```bash
# 清理缓存
pnpm store prune

# 删除所有node_modules
rm -rf node_modules packages/*/node_modules

# 重新安装
pnpm install
```

### Core包构建失败

```bash
cd packages/core

# 清理
rm -rf dist

# 重新构建
pnpm build
```

### 类型错误

```bash
# 检查所有包的类型
pnpm type-check

# 只检查特定包
cd packages/core
pnpm type-check
```

---

## 📖 下一步

1. **完成Core包实现**
   - 实现P2PManager
   - 实现FileTransferManager
   - 实现DeviceManager

2. **创建React Web UI**
   - 设置Vite + React
   - 创建基础组件
   - 集成Core包

3. **创建Electron应用**
   - 设置Electron
   - 主进程/渲染进程通信
   - 复用Web的UI组件

4. **创建React Native应用**
   - 设置React Native/Expo
   - 创建原生UI组件
   - 集成Core包

---

## 💡 开发技巧

### 1. 监听模式开发

在一个终端：
```bash
cd packages/core
pnpm dev  # 监听Core包变化
```

在另一个终端：
```bash
pnpm dev:web  # Web会自动使用最新Core
```

### 2. 同时开发多个包

使用Turbo并行：
```bash
pnpm dev  # 所有包并行开发
```

### 3. 调试

```typescript
// 在Core包中
console.log('[Core]', data);

// 在Web/Desktop/Mobile中
import { eventBus } from '@meshkit/core';

eventBus.on('*', (event, data) => {
  console.log('[Event]', event, data);
});
```

---

## 🎓 学习资源

- [Monorepo指南](https://turbo.build/repo/docs)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Electron文档](https://www.electronjs.org/docs/latest/)
- [React Native文档](https://reactnative.dev/docs/getting-started)

---

## 🤝 参与开发

欢迎贡献代码！开发流程：

1. Fork项目
2. 创建功能分支
3. 提交PR

---

**祝你开发愉快！** 🎉

有问题随时查看 [ARCHITECTURE.md](./ARCHITECTURE.md) 了解详细架构。
