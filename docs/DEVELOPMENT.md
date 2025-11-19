# 开发指南

本文档介绍如何参与 MeshKit 项目的开发。

## 前置要求

### 必需工具

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0
- **Git** >= 2.30

### 推荐工具

- **VS Code** - 代码编辑器
- **TypeScript extension** - TS 语言支持
- **ESLint extension** - 代码检查
- **Prettier extension** - 代码格式化

## 环境搭建

### 1. 克隆项目

```bash
# 使用 HTTPS
git clone https://github.com/cainiaopppppppp/MeshKit.git

# 或使用 SSH
git clone git@github.com:cainiaopppppppp/MeshKit.git

cd MeshKit
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 构建核心包

```bash
pnpm --filter @meshkit/core build
```

### 4. 启动开发环境

```bash
# 方式一：同时启动所有服务
pnpm dev

# 方式二：分别启动
pnpm dev:signaling # 终端1
pnpm dev:web # 终端2
```

## 项目结构

```
MeshKit/
├── packages/
│ ├── core/ # 核心业务逻辑
│ │ ├── src/
│ │ │ ├── managers/ # 管理器
│ │ │ ├── types/ # 类型定义
│ │ │ ├── utils/ # 工具函数
│ │ │ └── index.ts # 导出入口
│ │ ├── package.json
│ │ ├── tsconfig.json
│ │ └── tsup.config.ts # 构建配置
│ │
│ ├── web/ # Web 应用
│ │ ├── src/
│ │ │ ├── components/ # React 组件
│ │ │ ├── pages/ # 页面组件
│ │ │ ├── hooks/ # React Hooks
│ │ │ ├── store/ # Zustand 状态管理
│ │ │ ├── utils/ # 工具函数
│ │ │ ├── App.tsx # 根组件
│ │ │ └── main.tsx # 入口文件
│ │ ├── public/ # 静态资源
│ │ ├── package.json
│ │ ├── vite.config.ts # Vite 配置
│ │ └── tailwind.config.js # Tailwind 配置
│ │
│ └── desktop/ # Desktop 应用
│ ├── src/
│ │ ├── main/ # Electron 主进程
│ │ ├── preload/ # 预加载脚本
│ │ └── renderer/ # 渲染进程 (React)
│ ├── build/ # 构建资源 (图标等)
│ └── package.json
│
├── apps/
│ └── signaling/ # 信令服务器
│ ├── src/
│ │ └── index.ts # 服务器入口
│ └── package.json
│
├── docs/ # 文档
├── turbo.json # Turborepo 配置
├── pnpm-workspace.yaml # pnpm 工作空间
└── package.json # 根配置
```

## 开发流程

### 开发新功能

1. **创建功能分支**
 ```bash
 git checkout -b feature/your-feature-name
 ```

2. **编写代码**
 - 遵循现有代码风格
 - 添加必要的注释
 - 编写类型定义

3. **测试功能**
 - 在浏览器中测试
 - 测试多设备场景
 - 测试边界条件

4. **提交代码**
 ```bash
 git add .
 git commit -m "feat: your feature description"
 ```

5. **推送并创建 PR**
 ```bash
 git push origin feature/your-feature-name
 ```

### 修复 Bug

1. **创建修复分支**
 ```bash
 git checkout -b fix/bug-description
 ```

2. **定位问题**
 - 查看控制台错误
 - 使用 Chrome DevTools 调试
 - 检查网络请求

3. **修复并测试**
 - 修复问题
 - 确保不引入新问题
 - 添加回归测试

4. **提交**
 ```bash
 git commit -m "fix: bug description"
 ```

## 代码规范

### TypeScript

```typescript
// 好的示例
interface User {
 id: string;
 name: string;
 email?: string;
}

function getUserName(user: User): string {
 return user.name;
}

// 避免
function getUserName(user: any) { // 不要使用 any
 return user.name;
}
```

### React 组件

```tsx
// 好的示例
interface Props {
 title: string;
 onClose: () => void;
}

export function Modal({ title, onClose }: Props) {
 return (
 <div>
 <h1>{title}</h1>
 <button onClick={onClose}>Close</button>
 </div>
 );
}

// 避免
export function Modal(props: any) { // 不明确的 props
 return <div>{props.title}</div>;
}
```

### 命名规范

- **文件名**: PascalCase for components, camelCase for utils
 - `FileTransferPage.tsx`
 - `useP2P.ts`
 - `formatBytes.ts`

- **变量名**: camelCase
 - `deviceId`
 - `isConnected`

- **常量**: UPPER_SNAKE_CASE
 - `MAX_FILE_SIZE`
 - `DEFAULT_TIMEOUT`

- **类型/接口**: PascalCase
 - `interface Device {}`
 - `type MessageType = 'text' | 'file'`

### Commit 规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**类型 (type)**:
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式(不影响功能)
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具配置

**示例**:
```
feat(file-transfer): add resume capability
fix(chat): correct message order
docs: update installation guide
```

## 调试技巧

### Web 应用调试

1. **Chrome DevTools**
 ```javascript
 // 在代码中添加断点
 debugger;

 // 查看 WebRTC 连接
 chrome://webrtc-internals
 ```

2. **查看日志**
 ```typescript
 // Core 包日志
 console.log('[P2PManager]', ...);
 console.log('[FileTransfer]', ...);
 ```

3. **网络请求**
 - 打开 Network 标签
 - 查看 WebSocket 连接
 - 检查 WebRTC 数据通道

### Desktop 应用调试

```bash
# 启动时开启调试
pnpm dev:electron

# 主进程日志会显示在终端
# 渲染进程可使用 Chrome DevTools
```

### 常见问题

1. **Core 包未更新**
 ```bash
 # 重新构建 Core 包
 pnpm --filter @meshkit/core build
 ```

2. **端口被占用**
 ```bash
 # 查找占用端口的进程
 lsof -i :3000 # Mac/Linux
 netstat -ano | findstr :3000 # Windows

 # 杀死进程或更改端口
 ```

3. **TypeScript 错误**
 ```bash
 # 类型检查
 pnpm type-check

 # 清除缓存
 rm -rf node_modules/.cache
 ```

## 测试

### 手动测试

1. **文件传输测试**
 - 小文件 (<1MB)
 - 大文件 (>1GB)
 - 多文件批量传输
 - 不同文件类型

2. **便签墙测试**
 - 创建/编辑/删除便签
 - 多设备同步
 - 离线后上线同步

3. **加密聊天测试**
 - 发送/接收消息
 - 连接建立/断开
 - 密钥交换

### 跨浏览器测试

- Chrome/Edge 
- Firefox 
- Safari 
- Mobile Safari 
- Mobile Chrome 

## 性能优化

### 文件传输优化

```typescript
// 调整 chunk 大小
const CHUNK_SIZE = 1024 * 1024; // 1MB

// 调整发送延迟
const SEND_DELAY = 1; // ms
```

### 便签墙优化

```typescript
// 减少重新渲染
const MemoizedNote = React.memo(Note);

// 虚拟化大列表 (如有大量便签)
import { FixedSizeList } from 'react-window';
```

### 加密聊天优化

```typescript
// 复用加密上下文
const cryptoContext = useMemo(() => {
 return sodium.crypto_box_beforenm(peerPublicKey, secretKey);
}, [peerPublicKey, secretKey]);
```

## 贡献检查清单

提交 PR 前，请确保：

- [ ] 代码遵循项目规范
- [ ] 添加了必要的类型定义
- [ ] 功能在多个浏览器中测试
- [ ] 没有 TypeScript 错误
- [ ] 没有 ESLint 警告
- [ ] Commit 信息符合规范
- [ ] 更新了相关文档
- [ ] 测试了边界条件

## 获取帮助

遇到问题？

- 查看 [文档](../README.md#文档)
- 提交 [Issue](https://github.com/cainiaopppppppp/MeshKit/issues)
- 参与 [Discussions](https://github.com/cainiaopppppppp/MeshKit/discussions)

---

**感谢你的贡献！** 
