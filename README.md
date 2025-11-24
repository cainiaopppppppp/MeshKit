# MeshKit - 安全的 P2P 协作工具套件

<div align="center">

**基于 WebRTC 的去中心化 P2P 协作平台**

 **端到端加密** • **文件传输** • **便签协作** • **加密聊天**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2-blue)](https://reactjs.org/)
[![Electron](https://img.shields.io/badge/Electron-28.0-blue)](https://www.electronjs.org/)
[![Security](https://img.shields.io/badge/Security-E2EE-green)](https://en.wikipedia.org/wiki/End-to-end_encryption)

[快速开始](#-快速开始) • [功能特性](#-核心功能) • [安全性](#-安全保障) • [文档](#-文档)

</div>

---

## 项目简介

MeshKit 是一个**去中心化、端到端加密的 P2P 协作工具套件**，提供三大核心功能：

- **文件传输** - 高速 P2P 文件传输（传输层加密），局域网内可达 20-50 MB/s
- **便签墙** - 实时协同编辑的虚拟便签墙，支持多人协作
- **加密聊天** - 端到端加密（E2EE）的即时通讯

### 为什么选择 MeshKit？

- **端到端加密** - 采用 NaCl/libsodium 加密库，256位密钥
- **完全去中心化** - 数据直接在设备间传输，永不经过第三方服务器
- **隐私至上** - 聊天消息不保存，刷新即清空，零数据留痕
- **传输层安全** - WebRTC 原生 DTLS/SRTP 加密，防窃听
- **局域网优先** - 在同一网络内享受极速传输体验
- **跨平台支持** - Web、Desktop (Electron)、Mobile (规划中)
- **开源免费** - MIT 协议，完全开源，代码可审计

## ️ 安全保障

### 加密技术栈

| 功能 | 加密方式 | 密钥长度 | 算法 |
|------|---------|---------|------|
| **文件传输** | WebRTC DTLS/SRTP | 128-256位 | AES-GCM |
| **便签同步** | WebRTC 传输层加密 | 128-256位 | DTLS 1.2+ |
| **加密聊天** | 端到端加密 (E2EE) | 256位 | NaCl/libsodium |

### 密钥交换

- **ECDH** (Elliptic Curve Diffie-Hellman) 密钥协商
- **Curve25519** 椭圆曲线算法
- **前向保密** - 每次会话生成新密钥
- **自动化** - 无需手动交换密钥，连接时自动完成

### ️ 隐私保护

- **零服务器存储** - 所有数据仅在设备间传输
- **消息即焚** - 聊天记录不保存，刷新页面自动清空
- **本地存储** - 便签数据仅保存在浏览器本地 IndexedDB
- **不留痕迹** - 无日志记录，无数据追踪
- **可审计代码** - 开源代码，安全专家可审查



## 核心功能

### 1. 文件传输 (MeshDrop)

基于 WebRTC 的 P2P 文件传输系统，**传输层自动加密**，支持大文件、多文件传输。

**主要特性：**
- **传输层加密** - WebRTC DTLS/SRTP 自动加密，防止中间人攻击和窃听
- **极速传输** - 局域网内速度可达 20-50 MB/s
- **大文件支持** - 支持 1GB+ 大文件，流式传输不占内存
- **多文件队列** - 批量传输多个文件
- **实时进度** - 精确显示传输进度、速度、剩余时间
- ️ **安全可靠** - P2P 直连，数据不经过服务器，保护隐私
- **断点续传** - 传输中断后自动恢复（规划中）
- **跨平台** - 支持所有主流平台和浏览器

**安全保证：**
- WebRTC Data Channel 使用 DTLS 1.2+ 加密
- 类似 HTTPS 的安全级别
- 数据仅在设备间传输，不经过任何服务器
- 防止网络窃听和中间人攻击

**使用场景：**
- 安全传输敏感文件（合同、账号信息等）
- 局域网内快速分享文件（不需要U盘或云盘）
- 手机与电脑之间传输照片、视频
- 会议中快速分发文档、资料
- 开发团队共享代码、构建产物

### 2. 便签墙 (StickyNotes)

基于 Yjs CRDT 的实时协同便签墙，**WebRTC 加密传输**，多人可同时编辑。

**主要特性：**
- **加密同步** - WebRTC 传输层加密，保护协作内容
- **丰富的便签** - 支持多种颜色、样式
- **多人协作** - 实时同步，支持多人同时编辑
- **自动同步** - 基于 CRDT 算法，保证数据一致性
- **拖拽排列** - 自由拖动便签位置
- **本地存储** - 数据仅保存在浏览器本地 IndexedDB
- **P2P 同步** - 无需服务器，设备间直接加密同步
- ️ **隐私保护** - 便签数据不上传云端，完全掌控

**安全保证：**
- 所有同步数据通过 WebRTC 加密传输
- 便签内容仅存储在本地设备
- 无服务器存储，无数据泄露风险
- 刷新页面后便签仍然保留（本地持久化）

**使用场景：**
- 敏感项目的团队头脑风暴、思维整理
- 内部项目任务看板、待办事项
- 课堂教学互动、私密笔记共享
- 设计评审、创意收集（保护知识产权）

### 3. 加密聊天 (EncryptedChat)

**军事级端到端加密**的即时通讯，基于 **libsodium (NaCl)** 加密库。

**主要特性：**
- **端到端加密 (E2EE)** - 使用 NaCl/libsodium 加密算法，256位密钥
- ️ **军事级加密** - Salsa20 流密码 + Poly1305 消息认证
- **自动密钥交换** - ECDH (Curve25519) 密钥协商，无需手动配置
- **即时通讯** - 基于 WebRTC Data Channel，低延迟
- ️ **完全私密** - 消息仅在设备间传输，服务器无法解密
- **富文本支持** - 支持文本格式、表情符号
- **消息即焚** - 刷新页面后聊天记录自动清空
- **消息通知** - 桌面通知提醒（规划中）

**安全保证：**
- **256位密钥** - 与军事、银行级别加密相同
- **前向保密 (PFS)** - 每次会话生成新密钥，历史消息不会暴露
- **防篡改** - Poly1305 消息认证码防止消息被修改
- **防重放** - Nonce 机制防止重放攻击
- **零日志** - 消息不保存，不上传，不留痕
- **可审计** - 开源代码，加密实现可被安全专家审查

**技术细节：**
```
加密算法: NaCl (Networking and Cryptography library)
密钥交换: ECDH (Curve25519)
对称加密: Salsa20 (256位密钥)
消息认证: Poly1305-AES
密钥长度: 256 bits (32 bytes)
```

**使用场景：**
- 企业内部保密通讯、商业机密讨论
- 团队私密讨论、敏感项目沟通
- 传递账号密码、API密钥等敏感信息
- 隐私意识强的个人用户

## 快速开始

### 前置要求

- **Node.js** >= 18
- **pnpm** >= 8

```bash
# 安装 pnpm
npm install -g pnpm
```

### 安装依赖

```bash
# 1. 克隆项目
git clone https://github.com/cainiaopppppppp/MeshKit.git
cd MeshKit

# 2. 安装所有依赖
pnpm install

# 3. 构建核心包（️ 首次必须执行）
pnpm --filter @meshkit/core build
```

### 启动开发环境

**方式一：同时启动所有服务（推荐）**

```bash
# 一键启动信令服务器 + Web 应用
pnpm dev
```

**方式二：分别启动（适合调试）**

```bash
# 终端 1 - 启动信令服务器
pnpm dev:signaling

# 终端 2 - 启动 Web 应用
pnpm dev:web

# 终端 3 - 启动 Desktop 应用（可选）
cd packages/desktop
pnpm dev
```

### 访问应用

- **Web 版**: http://localhost:3000
- **Desktop 版**: 自动启动 Electron 窗口

### 在其他设备访问

在同一局域网（WiFi）下的其他设备上访问：

```
http://[你的电脑IP]:3000
```

查看本机 IP：
- Windows: `ipconfig`
- Mac/Linux: `ifconfig` 或 `ip addr`

## 项目结构

```
MeshKit/
├── packages/
│ ├── core/ # 核心逻辑包（P2P、文件传输、CRDT同步）
│ ├── web/ # React Web 应用
│ ├── desktop/ # Electron 桌面应用
│ └── mobile/ # ⏳ React Native 移动应用（规划中）
├── apps/
│ └── signaling/ # WebSocket 信令服务器
├── docs/ # 文档
└── package.json # 根配置
```

### 包说明

#### `@meshkit/core`
核心业务逻辑包，包含：
- P2P 连接管理（PeerJS + WebRTC）
- 文件传输管理器
- CRDT 同步（Yjs）
- 加密通讯（libsodium）
- 设备发现与管理
- 事件总线

#### `@meshkit/web`
React Web 应用，包含：
- 文件传输页面
- 便签墙页面
- 加密聊天页面
- 设置页面
- UI 组件库

#### `@meshkit/desktop`
Electron 桌面应用，包含：
- 主进程（窗口管理、系统集成）
- 预加载脚本（IPC 桥接）
- 渲染进程（复用 Web 组件）

#### `signaling`
WebSocket 信令服务器：
- 设备注册与发现
- 心跳与健康检查
- P2P 连接协商

## ️ 技术架构

### 核心技术栈

| 技术 | 用途 | 说明 |
|------|------|------|
| **TypeScript** | 类型安全 | 全栈 TypeScript，完整类型定义 |
| **React 18** | UI 框架 | Web 和 Desktop 渲染层 |
| **Electron** | 桌面应用 | 跨平台桌面应用框架 |
| **PeerJS** | WebRTC 封装 | 简化 P2P 连接建立 |
| **Yjs** | CRDT 同步 | 实时协同编辑数据结构 |
| **libsodium** | 加密库 | 端到端加密通讯 |
| **WebSocket** | 信令通道 | 设备发现与连接协商 |
| **Zustand** | 状态管理 | 轻量级 React 状态管理 |
| **Vite** | 构建工具 | 快速的开发和构建 |
| **pnpm** | 包管理 | Monorepo 工作空间管理 |
| **Turborepo** | 构建系统 | 高效的 Monorepo 构建 |

### 架构图

```
┌─────────────────────────────────────────────────────────┐
│ Client Devices │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│ │ Web │ │ Desktop │ │ Mobile │ │
│ │ Browser │ │ Electron │ │React Nat.│ │
│ └────┬─────┘ └────┬─────┘ └────┬─────┘ │
│ │ │ │ │
│ └─────────────┴──────────────┘ │
│ │ │
│ @meshkit/core │
│ ┌──────────────┼──────────────┐ │
│ │ │ │ │
│ ┌────▼────┐ ┌─────▼──────┐ ┌────▼─────┐ │
│ │P2P Mgr. │ │File Trans. │ │CRDT Sync │ │
│ │(PeerJS) │ │(WebRTC DC) │ │ (Yjs) │ │
│ └────┬────┘ └─────┬──────┘ └────┬─────┘ │
└───────┼─────────────┼──────────────┼──────────────────┘
 │ │ │
 │ ┌────────▼──────────┐ │
 └────► Signaling Server ◄────┘
 │ (WebSocket) │
 └───────────────────┘

 ┌─────────────────────────┐
 │ WebRTC P2P Channel │
 │ ┌────┐ ┌────┐ │
 │ │Dev1│◄────────►│Dev2│ │
 │ └────┘ └────┘ │
 │ Direct Connection │
 └─────────────────────────┘
```

## 使用指南

### 文件传输

1. **发送文件**
 ```
 打开 Web/Desktop 应用
 → 选择"文件传输"标签
 → 切换到"发送"模式
 → 选择或拖拽文件
 → 选择目标设备
 → 点击"发送文件"
 ```

2. **接收文件**
 ```
 打开应用
 → 选择"文件传输"标签
 → 切换到"接收"模式
 → 等待接收
 → 完成后点击"下载文件"
 ```

### 便签墙

1. **创建便签**
 ```
 打开"便签墙"标签
 → 点击"+ 添加便签"
 → 输入内容
 → 选择颜色
 ```

2. **协作编辑**
 ```
 多个设备打开便签墙
 → 自动 P2P 同步
 → 任意设备编辑都会实时同步
 ```

### 加密聊天

1. **发起聊天**
 ```
 打开"加密聊天"标签
 → 选择聊天对象
 → 输入消息
 → 发送（端到端加密）
 ```

2. **密钥管理**
 ```
 首次连接会自动交换密钥
 → 使用 ECDH 密钥协商
 → 所有消息自动加密
 ```

### 设置

```
点击右上角️图标
→ 配置信令服务器地址
→ 保存并重启/刷新
```

适用于局域网部署场景。

## 开发指南

### 开发命令

```bash
# 构建核心包（首次必须执行）
pnpm --filter @meshkit/core build

# 构建所有包
pnpm build

# 启动所有服务
pnpm dev

# 分别启动
pnpm dev:signaling # 信令服务器
pnpm dev:web # Web 应用
pnpm dev:desktop # Desktop 应用

# 类型检查
pnpm type-check

# 清理构建产物
pnpm clean
```

### Desktop 应用打包

```bash
cd packages/desktop

# 打包当前平台
pnpm release

# 打包特定平台
pnpm release:win # Windows
pnpm release:mac # macOS
pnpm release:linux # Linux
```

详见 [Desktop 打包文档](./packages/desktop/BUILD.md)

### 项目配置

#### 修改端口

**信令服务器端口**（`apps/signaling/src/index.ts`）：
```typescript
const WS_PORT = 7000; // WebSocket 端口
const PEER_PORT = 8000; // PeerJS 端口
```

**Web 应用端口**（`packages/web/vite.config.ts`）：
```typescript
server: {
 port: 3000
}
```

#### 配置信令服务器

在设置页面配置信令服务器地址，支持：
- localhost（默认，本地开发）
- 局域网 IP（如 192.168.1.100）
- 域名（部署到公网）

## 部署指南

### 部署信令服务器

#### Docker 部署（推荐）

```bash
# 构建镜像
docker build -t meshkit-signaling -f apps/signaling/Dockerfile .

# 运行容器
docker run -d \
 -p 7000:7000 \
 -p 8000:8000 \
 --name meshkit-signaling \
 meshkit-signaling
```

#### PM2 部署

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
cd apps/signaling
pm2 start npm --name "meshkit-signaling" -- start

# 查看状态
pm2 list
pm2 logs meshkit-signaling
```

### 部署 Web 应用

#### 静态部署

```bash
# 构建
pnpm build:web

# 部署 packages/web/dist/ 目录到任意静态托管服务
# - Nginx
# - Vercel
# - Netlify
# - GitHub Pages
```

#### Nginx 配置示例

```nginx
server {
 listen 80;
 server_name meshkit.example.com;
 root /var/www/meshkit;
 index index.html;

 location / {
 try_files $uri $uri/ /index.html;
 }
}
```

详见 [部署文档](./docs/DEPLOYMENT.md)

## 文档

- **[功能详解](./docs/FEATURES.md)** - 三大功能详细说明
- **[架构设计](./docs/ARCHITECTURE.md)** - 技术架构和设计决策
- **[开发指南](./docs/DEVELOPMENT.md)** - 贡献代码指南
- **[API 文档](./docs/API.md)** - Core 包 API 参考
- **[部署指南](./docs/DEPLOYMENT.md)** - 生产环境部署
- **[Desktop 打包](./packages/desktop/BUILD.md)** - Electron 应用打包

## 常见问题

### 1. 启动时报错：`Failed to resolve entry for package "@meshkit/core"`

**原因**：Core 包未构建

**解决**：
```bash
pnpm --filter @meshkit/core build
```

### 2. 设备列表为空

**可能原因**：
- 信令服务器未启动
- 设备不在同一局域网
- 防火墙阻止连接

**解决**：
1. 确保信令服务器运行：`pnpm dev:signaling`
2. 检查所有设备在同一 WiFi
3. 检查防火墙设置

### 3. 文件传输速度慢

**优化建议**：
- 使用 5GHz WiFi（比 2.4GHz 快）
- 靠近路由器
- 减少其他设备网络占用
- 使用有线连接

### 4. iOS Safari 无法下载文件

**解决**：
1. 点击"下载文件"
2. **长按**打开的文件
3. 选择"存储到文件"
4. 选择保存位置

### 5. 便签墙同步延迟

**原因**：WebRTC 连接质量

**优化**：
- 确保良好的网络连接
- 减少同时连接的设备数量
- 检查是否有网络代理

### 6. 加密聊天无法连接

**检查**：
- 是否完成密钥交换
- P2P 连接是否建立
- 查看控制台错误信息

## 路线图

### v1.0（当前版本）
- 文件传输
- 便签墙
- 加密聊天
- Desktop 应用
- 设置页面

### v1.1（规划中）
- ⏳ 断点续传
- ⏳ 文件加密传输
- ⏳ 消息通知
- ⏳ 主题切换
- ⏳ 国际化支持

### v2.0（未来）
- ⏳ React Native 移动应用
- ⏳ 视频通话
- ⏳ 屏幕共享
- ⏳ 语音消息
- ⏳ 云同步（可选）

## 贡献

欢迎贡献代码！请阅读 [贡献指南](./CONTRIBUTING.md)

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](./LICENSE) 文件

## 致谢

- [PeerJS](https://peerjs.com/) - WebRTC 封装库
- [Yjs](https://yjs.dev/) - CRDT 协同编辑
- [libsodium](https://libsodium.gitbook.io/) - 加密库
- [React](https://reactjs.org/) - UI 框架
- [Electron](https://www.electronjs.org/) - 桌面应用框架

---

<div align="center">

**Made with ️ for seamless P2P collaboration**

[GitHub](https://github.com/cainiaopppppppp/MeshKit) • [Issues](https://github.com/cainiaopppppppp/MeshKit/issues) • [Discussions](https://github.com/cainiaopppppppp/MeshKit/discussions)

</div>

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=cainiaopppppppp/MeshKit.git&type=date&legend=top-left)](https://www.star-history.com/#cainiaopppppppp/MeshKit.git&type=date&legend=top-left)
