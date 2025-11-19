/**
 * 帮助页面 - 用户使用指南
 */

import { useState } from 'react';

interface FAQItem {
  question: string;
  answer: string | string[];
}

const faqData: { category: string; items: FAQItem[] }[] = [
  {
    category: '🚀 文件传输',
    items: [
      {
        question: '如何发送文件？',
        answer: [
          '1. 点击顶部"文件传输"标签',
          '2. 切换到"📤 发送"模式',
          '3. 点击或拖拽文件到选择区域',
          '4. 在设备列表中选择接收设备',
          '5. 点击"发送文件"按钮',
        ],
      },
      {
        question: '如何接收文件？',
        answer: [
          '1. 点击"文件传输"标签',
          '2. 切换到"📥 接收"模式',
          '3. 等待文件传输',
          '4. 传输完成后点击"下载文件"',
        ],
      },
      {
        question: '支持多大的文件？',
        answer: '支持 1GB+ 大文件，理论上无限制。系统使用流式传输，不会占用过多内存。',
      },
      {
        question: '传输速度有多快？',
        answer: '局域网内通常可达 20-50 MB/s，具体取决于 WiFi 质量。5GHz WiFi 比 2.4GHz 快很多。',
      },
      {
        question: '文件传输安全吗？',
        answer: [
          '✅ 安全！使用 WebRTC DTLS/SRTP 传输层加密',
          '🔒 加密算法：AES-GCM (128-256位)',
          '🛡️ 完美前向保密 (PFS)：每次连接新密钥',
          '✅ 防中间人攻击，防窃听',
          '🚫 文件不经过服务器，直接 P2P 传输',
          '📌 注意：传输层加密，未来将支持端到端文件加密',
        ],
      },
      {
        question: 'iOS Safari 如何下载文件？',
        answer: [
          '1. 点击"下载文件"，会打开新标签页',
          '2. **长按**显示的文件（重要！）',
          '3. 选择"存储到文件"或"添加到照片"',
          '4. 选择保存位置（如 iCloud 云盘）',
        ],
      },
    ],
  },
  {
    category: '📝 便签墙',
    items: [
      {
        question: '如何创建便签？',
        answer: [
          '1. 点击顶部"便签墙"标签',
          '2. 点击"+ 添加便签"按钮',
          '3. 输入内容并选择颜色',
          '4. 点击"保存"',
        ],
      },
      {
        question: '如何编辑或删除便签？',
        answer: [
          '编辑：点击便签 → 修改内容 → 保存',
          '删除：点击便签 → 点击"删除"按钮',
          '移动：按住便签拖动到目标位置',
        ],
      },
      {
        question: '便签如何同步？',
        answer: '所有设备的便签自动实时同步。任何设备创建、编辑、删除便签，其他设备立即看到变化。',
      },
      {
        question: '离线可以用吗？',
        answer: '可以。离线时仍可编辑便签，重新联网后会自动同步。',
      },
      {
        question: '数据会丢失吗？',
        answer: '不会。便签保存在浏览器本地存储（IndexedDB），刷新页面后仍然存在。',
      },
    ],
  },
  {
    category: '🔐 加密聊天',
    items: [
      {
        question: '如何开始聊天？',
        answer: [
          '1. 点击顶部"加密聊天"标签',
          '2. 在设备列表中选择聊天对象',
          '3. 等待连接建立（自动交换密钥）',
          '4. 输入消息并发送',
        ],
      },
      {
        question: '真的安全吗？',
        answer: [
          '✅ 是的，非常安全！采用军事级端到端加密 (E2EE)',
          '🔐 加密库：libsodium (NaCl)',
          '🔑 密钥强度：256位（当前技术无法破解）',
          '🛡️ 加密算法：XSalsa20 + Poly1305',
          '✅ 完美前向保密：每次连接新密钥',
          '✅ 防护：防窃听、防篡改、防重放',
          '🚫 服务器无法解密，数据不上传',
        ],
      },
      {
        question: '消息会保存吗？',
        answer: '不会。为了隐私，消息不会保存。刷新页面后聊天记录清空。',
      },
      {
        question: '密钥如何交换？',
        answer: '使用 ECDH 密钥协商算法，在建立连接时自动完成。每次重连都会生成新密钥。',
      },
    ],
  },
  {
    category: '⚙️ 设置与配置',
    items: [
      {
        question: '如何配置信令服务器？',
        answer: [
          '1. 点击右上角⚙️图标进入设置',
          '2. 填入服务器地址和端口',
          '3. 点击"保存配置"',
          '4. 刷新页面（Web）或重启应用（Desktop）',
        ],
      },
      {
        question: '为什么需要配置服务器？',
        answer: '默认使用 localhost，只适合本机测试。要在局域网多台电脑使用，需要配置一台电脑的 IP 作为信令服务器。',
      },
      {
        question: '如何查看本机 IP？',
        answer: [
          'Windows: 命令行运行 ipconfig',
          'Mac: 命令行运行 ifconfig',
          'Linux: 命令行运行 ip addr 或 ifconfig',
          '查找 192.168.x.x 或 10.0.x.x 格式的地址',
        ],
      },
    ],
  },
  {
    category: '❓ 常见问题',
    items: [
      {
        question: '看不到其他设备怎么办？',
        answer: [
          '1. 确认所有设备连接同一 WiFi',
          '2. 检查信令服务器是否运行',
          '3. 刷新页面或重启应用',
          '4. 检查防火墙设置',
        ],
      },
      {
        question: '传输速度很慢怎么办？',
        answer: [
          '1. 使用 5GHz WiFi（比 2.4GHz 快很多）',
          '2. 靠近路由器',
          '3. 减少其他设备的网络使用',
          '4. 关闭 VPN 或代理',
          '5. 使用有线连接（如果可能）',
        ],
      },
      {
        question: '手机和电脑无法连接？',
        answer: [
          '1. 确认连接同一 WiFi',
          '2. 手机浏览器访问：http://[电脑IP]:3000',
          '3. 检查电脑防火墙是否开放端口',
          '4. 确认信令服务器正在运行',
        ],
      },
      {
        question: '传输中断怎么办？',
        answer: [
          '1. 检查网络连接',
          '2. 确认对方设备在线',
          '3. 保持屏幕唤醒',
          '4. 关闭省电模式',
          '5. 重新发送文件',
        ],
      },
    ],
  },
];

const usageTips = [
  {
    title: '📁 批量传输',
    tip: '一次选择多个文件更高效。按住 Ctrl/Cmd 多选，或直接拖拽多个文件。',
  },
  {
    title: '🎨 便签颜色',
    tip: '用不同颜色区分类别。例如：黄色=想法，绿色=任务，红色=重要。',
  },
  {
    title: '🚀 5GHz WiFi',
    tip: '5GHz WiFi 比 2.4GHz 快 3-5 倍。如果路由器支持，优先使用 5GHz。',
  },
  {
    title: '💾 大文件传输',
    tip: '传输大文件时保持屏幕唤醒，关闭省电模式，避免传输中断。',
  },
  {
    title: '👥 团队协作',
    tip: '便签墙中每人用固定颜色，方便识别谁创建的便签。',
  },
  {
    title: '🔐 敏感信息',
    tip: '传递密码等敏感信息时使用加密聊天，刷新页面后消息自动清空。',
  },
];

function FAQSection({ category, items }: { category: string; items: FAQItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-gray-800 mb-4">{category}</h2>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={index}
            className="border border-gray-200 rounded-lg overflow-hidden bg-white"
          >
            <button
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <span className="font-medium text-gray-800">{item.question}</span>
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform ${
                  openIndex === index ? 'transform rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            {openIndex === index && (
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                {Array.isArray(item.answer) ? (
                  <ol className="space-y-1 text-gray-700">
                    {item.answer.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-gray-700">{item.answer}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function HelpPage() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* 头部 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">📖 使用帮助</h1>
        <p className="text-gray-600">
          MeshKit 使用指南 - 安全的 P2P 协作工具，提供加密文件传输、便签墙、端到端加密聊天
        </p>
        <div className="mt-3 flex gap-2 flex-wrap">
          <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
            🔐 端到端加密
          </span>
          <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
            🛡️ 256位密钥
          </span>
          <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
            🚫 零服务器存储
          </span>
        </div>
      </div>

      {/* 快速入门 */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-8 border border-blue-200">
        <h2 className="text-xl font-bold text-gray-800 mb-3">🚀 快速入门</h2>
        <div className="space-y-2 text-gray-700">
          <p><strong>第一步：</strong>确保所有设备连接到同一 WiFi 网络</p>
          <p><strong>第二步：</strong>等待设备自动发现（通常几秒钟）</p>
          <p><strong>第三步：</strong>选择要使用的功能开始协作</p>
        </div>
        <div className="mt-4 p-3 bg-white rounded border border-blue-200">
          <p className="text-sm text-gray-600">
            💡 <strong>提示：</strong>手机访问请使用浏览器打开{' '}
            <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">
              http://[电脑IP]:3000
            </code>
          </p>
        </div>
      </div>

      {/* FAQ 部分 */}
      {faqData.map((section, index) => (
        <FAQSection key={index} category={section.category} items={section.items} />
      ))}

      {/* 使用技巧 */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-800 mb-4">💡 使用技巧</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {usageTips.map((tip, index) => (
            <div
              key={index}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <h3 className="font-semibold text-gray-800 mb-2">{tip.title}</h3>
              <p className="text-sm text-gray-600">{tip.tip}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 获取更多帮助 */}
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <h2 className="text-xl font-bold text-gray-800 mb-4">🙋 需要更多帮助？</h2>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📚</span>
            <div>
              <h3 className="font-semibold text-gray-800">完整文档</h3>
              <p className="text-sm text-gray-600">
                查看{' '}
                <a
                  href="https://github.com/cainiaopppppppp/MeshKit/tree/main/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  完整用户手册
                </a>{' '}
                了解更多详细信息
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">🐛</span>
            <div>
              <h3 className="font-semibold text-gray-800">报告问题</h3>
              <p className="text-sm text-gray-600">
                遇到 Bug？在{' '}
                <a
                  href="https://github.com/cainiaopppppppp/MeshKit/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  GitHub Issues
                </a>{' '}
                提交问题
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">💬</span>
            <div>
              <h3 className="font-semibold text-gray-800">功能建议</h3>
              <p className="text-sm text-gray-600">
                有好的想法？在{' '}
                <a
                  href="https://github.com/cainiaopppppppp/MeshKit/discussions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  GitHub Discussions
                </a>{' '}
                分享
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 页脚 */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>
          Made with ❤️ for seamless P2P collaboration
        </p>
        <p className="mt-1">
          <a
            href="https://github.com/cainiaopppppppp/MeshKit"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            GitHub
          </a>
          {' · '}
          <a
            href="https://github.com/cainiaopppppppp/MeshKit/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            MIT License
          </a>
        </p>
      </div>
    </div>
  );
}
