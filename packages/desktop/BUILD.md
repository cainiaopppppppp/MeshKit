# MeshKit Desktop 打包发布指南

本文档说明如何构建和发布 MeshKit Desktop 应用。

## 前置要求

### 所有平台
- Node.js 18+
- pnpm 8+
- 已安装项目依赖：`pnpm install`

### Windows 打包
- Windows 10/11 或 Linux/Mac (支持交叉编译)
- NSIS (Windows Installer 需要)

### macOS 打包
- macOS 10.13+
- Xcode Command Line Tools
- 可选：Apple Developer 账号（用于代码签名）

### Linux 打包
- Linux 系统或 WSL
- fpm (用于构建 deb/rpm 包)

## 构建命令

### 1. 开发模式
```bash
# 在项目根目录
cd packages/desktop
pnpm dev
```

### 2. 本地测试打包（不生成安装包）
```bash
cd packages/desktop
pnpm package
```
这会在 `release` 目录生成未打包的应用，用于快速测试。

### 3. 构建发布版本

#### 方式一：自动构建（推荐）
```bash
# 构建当前平台的安装包
pnpm release

# 或指定平台
pnpm release:win # Windows (NSIS + Portable)
pnpm release:mac # macOS (DMG + ZIP)
pnpm release:linux # Linux (AppImage + deb + rpm)
```

#### 方式二：手动构建
```bash
# 1. 构建所有代码
pnpm build

# 2. 打包
pnpm dist # 当前平台
pnpm dist:win # Windows
pnpm dist:mac # macOS
pnpm dist:linux # Linux
```

## 输出文件

所有构建产物在 `packages/desktop/release/` 目录：

### Windows
- `MeshKit-1.0.0-win-x64.exe` - NSIS 安装程序 (64位)
- `MeshKit-1.0.0-win-ia32.exe` - NSIS 安装程序 (32位)
- `MeshKit-1.0.0-portable.exe` - 便携版 (无需安装)

### macOS
- `MeshKit-1.0.0-mac-x64.dmg` - Intel Mac 安装镜像
- `MeshKit-1.0.0-mac-arm64.dmg` - Apple Silicon (M1/M2) 安装镜像
- `MeshKit-1.0.0-mac-x64.zip` - Intel Mac 压缩包
- `MeshKit-1.0.0-mac-arm64.zip` - Apple Silicon 压缩包

### Linux
- `MeshKit-1.0.0-linux-x64.AppImage` - 通用 AppImage (64位)
- `MeshKit-1.0.0-linux-arm64.AppImage` - ARM64 AppImage
- `MeshKit-1.0.0-linux-x64.deb` - Debian/Ubuntu 包
- `MeshKit-1.0.0-linux-arm64.deb` - ARM64 Debian 包
- `MeshKit-1.0.0-linux-x64.rpm` - RedHat/Fedora 包
- `MeshKit-1.0.0-linux-arm64.rpm` - ARM64 RPM 包

## 代码签名（可选）

### Windows 签名
需要代码签名证书 (.pfx 或 .p12)：

```bash
# 设置环境变量
export CSC_LINK=/path/to/certificate.pfx
export CSC_KEY_PASSWORD=your_password

# 构建已签名的应用
pnpm release:win
```

### macOS 签名
需要 Apple Developer 账号：

```bash
# 设置环境变量
export APPLE_ID=your@apple.id
export APPLE_ID_PASSWORD=app-specific-password
export APPLE_TEAM_ID=your-team-id

# 构建并签名
pnpm release:mac
```

## 版本管理

修改版本号：
```bash
# 在 packages/desktop/package.json 中修改
{
 "version": "1.0.0" # 改为新版本号
}
```

## 发布流程

### 1. 准备发布
```bash
# 1. 确保所有依赖都是最新的
pnpm install

# 2. 构建 core 包
pnpm --filter @meshkit/core build

# 3. 更新版本号
# 编辑 packages/desktop/package.json
```

### 2. 构建所有平台（推荐在 CI/CD 中执行）

```bash
# Linux/macOS 环境
cd packages/desktop

# 构建 Linux
pnpm release:linux

# 构建 Windows (交叉编译)
pnpm release:win

# 构建 macOS (仅在 Mac 上)
pnpm release:mac
```

### 3. 测试安装包

在对应平台测试安装包：
- 安装应用
- 测试核心功能（文件传输、便签、聊天）
- 测试设置页面
- 测试应用更新（如配置了自动更新）

### 4. 发布到 GitHub Releases

```bash
# 1. 创建 git tag
git tag v1.0.0
git push origin v1.0.0

# 2. 在 GitHub 创建 Release
# 上传 release/ 目录中的所有安装包

# 3. 编写 Release Notes
```

## 自定义图标

应用图标放在 `packages/desktop/build/` 目录：

### Windows
- `icon.ico` - Windows 图标（256x256）

### macOS
- `icon.icns` - macOS 图标（512x512@2x）

### Linux
- `icon.png` - Linux 图标（512x512）

生成图标工具推荐：
- [electron-icon-builder](https://github.com/jaretburkett/electron-icon-builder)
- [png2icons](https://github.com/idesis-gmbh/png2icons)

## 常见问题

### 1. 打包失败：权限错误
```bash
# 清理并重新构建
pnpm clean
pnpm install
pnpm release
```

### 2. macOS 签名失败
确保已安装 Xcode Command Line Tools：
```bash
xcode-select --install
```

### 3. Windows NSIS 错误
安装 NSIS (Windows) 或在 Linux/Mac 上会自动下载。

### 4. Linux AppImage 权限问题
```bash
chmod +x MeshKit-*.AppImage
./MeshKit-*.AppImage
```

## 更多资源

- [Electron Builder 文档](https://www.electron.build/)
- [Electron 文档](https://www.electronjs.org/docs)
- [代码签名指南](https://www.electron.build/code-signing)

## CI/CD 自动化

可以配置 GitHub Actions 自动构建：

```yaml
# .github/workflows/build.yml
name: Build Desktop App

on:
 push:
 tags:
 - 'v*'

jobs:
 build:
 runs-on: ${{ matrix.os }}
 strategy:
 matrix:
 os: [ubuntu-latest, windows-latest, macos-latest]

 steps:
 - uses: actions/checkout@v3
 - uses: pnpm/action-setup@v2
 - uses: actions/setup-node@v3

 - run: pnpm install
 - run: pnpm --filter @meshkit/core build
 - run: cd packages/desktop && pnpm release

 - uses: actions/upload-artifact@v3
 with:
 name: ${{ matrix.os }}
 path: packages/desktop/release/*
```

## 提示

1. **首次打包**：第一次打包会下载必要的构建工具，可能需要几分钟
2. **交叉编译**：在 Linux/Mac 上可以构建 Windows 版本，但 Mac 版本只能在 macOS 上构建
3. **文件大小**：未压缩的安装包约 100-150MB，这是正常的（包含 Electron 运行时）
4. **自动更新**：如需启用自动更新，需要配置更新服务器并签名应用
