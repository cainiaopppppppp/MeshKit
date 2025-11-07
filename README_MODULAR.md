# MeshKit - MeshDrop 文件快传（模块化版本）

基于WebRTC的P2P局域网文件传输系统，采用模块化架构设计，易于扩展和维护。

MeshKit是一套局域网协作工具套件，MeshDrop是其中的文件快传模块。

## 🎯 特性

- ✅ **模块化架构** - 清晰的模块划分，职责分离
- ✅ **事件驱动** - 基于EventBus的事件系统，模块间解耦
- ✅ **配置管理** - 统一的配置系统，支持动态调整
- ✅ **易于扩展** - 预留扩展接口，可快速添加新功能
- ✅ **错误处理** - 完善的错误处理和日志系统
- ✅ **响应式UI** - 适配移动端和桌面端

## 📁 项目结构

```
p2p_claude/
├── index.html                  # 主页面
├── signaling-server.js         # 信令服务器
├── package.json                # 项目配置
├── css/
│   └── style.css              # 样式文件
└── js/
    ├── app.js                 # 应用主入口
    ├── core/                  # 核心模块
    │   ├── EventBus.js       # 事件总线
    │   ├── Config.js         # 配置管理
    │   └── P2PManager.js     # P2P连接管理
    ├── modules/               # 功能模块
    │   ├── SignalingClient.js # 信令客户端
    │   ├── FileTransfer.js    # 文件传输
    │   └── DeviceManager.js   # 设备管理
    ├── ui/                    # UI模块
    │   ├── UIManager.js      # UI管理器
    │   └── Components.js     # UI组件
    └── utils/                 # 工具模块
        ├── Logger.js         # 日志工具
        └── Utils.js          # 通用工具函数
```

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务器

```bash
npm start
```

### 3. 访问应用

在同一WiFi下的设备上访问：
- 电脑: `http://localhost:8000`
- 手机: `http://[局域网IP]:8000`

## 🔧 核心模块说明

### EventBus (事件总线)

负责模块间的通信，提供发布-订阅模式。

```javascript
import { eventBus } from './core/EventBus.js';

// 订阅事件
eventBus.on('transfer:started', (data) => {
  console.log('传输开始', data);
});

// 发送事件
eventBus.emit('transfer:started', { direction: 'send' });
```

**主要事件:**
- `signaling:connected` - 信令服务器连接成功
- `signaling:disconnected` - 信令服务器断开连接
- `device:list-updated` - 设备列表更新
- `transfer:started` - 传输开始
- `transfer:progress` - 传输进度更新
- `transfer:completed` - 传输完成

### Config (配置管理)

统一管理应用配置。

```javascript
import { config } from './core/Config.js';

// 获取配置
const chunkSize = config.get('transfer.chunkSize');

// 设置配置
config.set('transfer.chunkSize', 512 * 1024);

// 批量更新
config.update({
  transfer: {
    chunkSize: 512 * 1024,
    sendDelay: 5
  }
});
```

**配置项:**
- `webrtc` - WebRTC配置（ICE服务器等）
- `transfer` - 传输配置（块大小、延迟等）
- `signaling` - 信令配置（重连等）
- `features` - 功能开关（用于扩展）

### P2PManager (P2P管理)

管理所有P2P连接的生命周期。

```javascript
import { p2pManager } from './core/P2PManager.js';

// 初始化
await p2pManager.init(deviceId);

// 连接到设备
const conn = p2pManager.connect(targetDeviceId);

// 获取状态
const status = p2pManager.getConnectionStatus();
```

## 📦 扩展指南

### 1. 添加新功能模块

创建新的模块文件 `js/modules/YourModule.js`:

```javascript
import { eventBus } from '../core/EventBus.js';
import { config } from '../core/Config.js';

class YourModule {
  constructor() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    eventBus.on('some:event', (data) => {
      // 处理事件
    });
  }

  yourMethod() {
    // 实现功能
    eventBus.emit('yourmodule:event', { /* data */ });
  }
}

export const yourModule = new YourModule();
export default YourModule;
```

### 2. 添加配置项

在 `js/core/Config.js` 中添加配置:

```javascript
this.config = {
  // ... 现有配置
  yourFeature: {
    enabled: true,
    option1: 'value1',
    option2: 100
  }
};
```

### 3. 添加UI组件

在 `js/ui/Components.js` 中添加组件:

```javascript
export function createYourComponent(data) {
  const div = document.createElement('div');
  div.className = 'your-component';
  div.innerHTML = `
    <!-- 你的HTML -->
  `;
  return div;
}
```

### 4. 扩展功能示例

#### 示例1: 添加聊天功能

1. 创建 `js/modules/ChatModule.js`
2. 在配置中添加 `features.chat: true`
3. 添加UI组件 `createChatPanel()`
4. 监听 `p2p:connection:data` 事件处理消息
5. 在 `app.js` 中初始化聊天模块

#### 示例2: 添加文件加密

1. 在 `js/modules/FileTransfer.js` 中添加加密方法
2. 在配置中添加 `features.encryption: true`
3. 在发送前加密，接收后解密
4. 添加密钥交换逻辑

#### 示例3: 添加多文件传输

1. 修改 `FileTransfer.selectFile()` 支持多文件
2. 创建文件队列管理
3. 添加队列UI显示
4. 实现顺序传输逻辑

## 🎨 自定义样式

修改 `css/style.css` 中的变量:

```css
:root {
  --primary-color: #667eea;
  --secondary-color: #764ba2;
  --success-color: #4caf50;
  --error-color: #f44336;
}
```

## 🐛 调试

### 启用调试模式

在浏览器控制台中:

```javascript
// 启用调试
P2PConfig.set('debug.enabled', true);
P2PConfig.set('debug.logLevel', 'debug');

// 查看应用状态
console.log(P2PApp.getStatus());

// 查看日志
console.log(P2PLogger.getLogs());

// 下载日志
P2PLogger.download('text');
```

### 事件监控

```javascript
// 监控所有事件
window.P2PEventBus.on('*', (event, data) => {
  console.log('Event:', event, data);
});
```

## 📝 待扩展功能

配置文件中已预留以下功能开关：

- [ ] `features.multipleFiles` - 多文件传输
- [ ] `features.encryption` - 加密传输
- [ ] `features.compression` - 压缩传输
- [ ] `features.chat` - 聊天功能
- [ ] `features.clipboard` - 剪贴板共享

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

MIT License

## 🙏 致谢

- [PeerJS](https://peerjs.com/) - WebRTC封装库
- [WebRTC](https://webrtc.org/) - 实时通信技术

## 📮 联系方式

如有问题或建议，请提交 Issue。

---

**注意**: 本项目仅用于局域网内文件传输，请勿用于非法用途。
