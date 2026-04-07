import { useState } from 'react';
import {
  DesktopComputerIcon,
  InfoIcon,
  MobilePhoneIcon,
  ShieldLockIcon,
  TransferInboxIcon,
} from '../components/FileTransferIcons';

interface FAQItem {
  question: string;
  answer: string | string[];
}

interface FAQSectionData {
  category: string;
  items: FAQItem[];
}

const faqData: FAQSectionData[] = [
  {
    category: '文件传输',
    items: [
      {
        question: '如何发送文件？',
        answer: [
          '1. 打开“文件传输”页面。',
          '2. 选择发送模式并选中文件。',
          '3. 在设备列表中选择接收方。',
          '4. 点击发送并等待对方确认。',
        ],
      },
      {
        question: '如何接收文件？',
        answer: [
          '1. 保持页面打开并连接同一局域网。',
          '2. 等待发送方发起请求。',
          '3. 在弹窗里确认接收。',
          '4. 传输完成后保存文件。',
        ],
      },
      {
        question: '文件传输安全吗？',
        answer: [
          '传输链路使用 WebRTC 加密。',
          '文件默认不经过中心服务器，只在设备之间点对点传输。',
          '如果需要更高隐私，建议在可信局域网中使用。',
        ],
      },
    ],
  },
  {
    category: '便签墙',
    items: [
      {
        question: '便签会自动同步吗？',
        answer: '会。连接同一房间的设备会实时同步新增、编辑和删除操作。',
      },
      {
        question: '离线后还能编辑吗？',
        answer: '可以。重新联网后，变更会继续同步到其他设备。',
      },
    ],
  },
  {
    category: '加密聊天',
    items: [
      {
        question: '聊天内容会被保存吗？',
        answer: '默认不会长期保存。刷新页面或重新进入房间后，历史消息可能被清空。',
      },
      {
        question: '房间密码有什么作用？',
        answer: '房间密码会限制新成员加入，避免同一局域网下的其他人误入聊天。',
      },
    ],
  },
  {
    category: '设置与连接',
    items: [
      {
        question: '为什么需要配置信令服务器？',
        answer: '本机测试时可用 localhost。多设备协作时，需要让其他设备知道哪台电脑在运行信令服务。',
      },
      {
        question: '手机和电脑怎么互联？',
        answer: [
          '1. 先在电脑上运行信令服务。',
          '2. 再运行 Web 页面。',
          '3. 手机和电脑连接同一 Wi-Fi。',
          '4. 手机浏览器打开 http://[电脑IP]:3000。',
        ],
      },
      {
        question: '看不到其他设备怎么办？',
        answer: [
          '确认所有设备在同一局域网。',
          '检查电脑防火墙是否放行相关端口。',
          '确认设置页中的信令地址正确。',
          '刷新页面或重新打开应用后重试。',
        ],
      },
    ],
  },
];

const usageTips = [
  {
    title: '批量传输',
    tip: '一次选择多个文件通常比逐个发送更高效。',
  },
  {
    title: '5GHz Wi-Fi',
    tip: '如果路由器支持，5GHz 通常比 2.4GHz 更适合大文件传输。',
  },
  {
    title: '保持常亮',
    tip: '传输大文件时尽量避免设备熄屏或进入省电模式。',
  },
  {
    title: '分享链接',
    tip: '优先使用应用里的“复制分享网址”或“复制邀请链接”，能减少手填 IP 出错。',
  },
];

function FAQSection({ category, items }: FAQSectionData) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="mb-8">
      <h2 className="mb-4 text-xl font-bold text-gray-800">{category}</h2>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={item.question} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <button
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gray-50"
            >
              <span className="font-medium text-gray-800">{item.question}</span>
              <svg
                className={`h-5 w-5 text-gray-500 transition-transform ${openIndex === index ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {openIndex === index && (
              <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
                {Array.isArray(item.answer) ? (
                  <ol className="space-y-1 text-gray-700">
                    {item.answer.map((line) => (
                      <li key={line}>{line}</li>
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
    </section>
  );
}

export function HelpPage() {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-gray-900">使用帮助</h1>
        <p className="text-gray-600">
          MeshKit 是一个面向局域网协作的 P2P 工具，支持文件传输、便签墙和加密聊天。
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-sm text-green-800">
            <ShieldLockIcon className="h-4 w-4" />
            端到端保护
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800">
            <TransferInboxIcon className="h-4 w-4" />
            局域网直连
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
            <InfoIcon className="h-4 w-4" />
            零账号即可用
          </span>
        </div>
      </div>

      <section className="mb-8 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
        <h2 className="mb-3 text-xl font-bold text-gray-800">快速上手</h2>
        <div className="space-y-2 text-gray-700">
          <p><strong>第一步：</strong>确保所有设备连接到同一 Wi-Fi。</p>
          <p><strong>第二步：</strong>在电脑上启动信令服务和 Web 页面。</p>
          <p><strong>第三步：</strong>让其他设备通过分享链接或电脑 IP 进入网页。</p>
        </div>

        <div className="mt-4 rounded-xl border border-blue-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                <DesktopComputerIcon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900">电脑</div>
                <div className="text-xs text-gray-500">运行 `pnpm dev:web` 并提供网页入口</div>
              </div>
            </div>

            <div className="hidden text-center text-blue-300 sm:block">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 12h14m-4-4 4 4-4 4" />
              </svg>
            </div>

            <div className="flex items-center gap-3 rounded-xl bg-blue-50 px-3 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                <MobilePhoneIcon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900">手机</div>
                <div className="text-xs text-gray-500">浏览器打开分享链接或 `http://[电脑IP]:3000`</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {faqData.map((section) => (
        <FAQSection key={section.category} category={section.category} items={section.items} />
      ))}

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-bold text-gray-800">使用技巧</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {usageTips.map((tip) => (
            <div key={tip.title} className="rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md">
              <h3 className="mb-2 font-semibold text-gray-800">{tip.title}</h3>
              <p className="text-sm text-gray-600">{tip.tip}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-gray-50 p-6">
        <h2 className="mb-4 text-xl font-bold text-gray-800">更多帮助</h2>
        <div className="space-y-3 text-sm text-gray-600">
          <p>
            文档：{' '}
            <a
              href="https://github.com/cainiaopppppppp/MeshKit/tree/main/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              查看 docs 目录
            </a>
          </p>
          <p>
            问题反馈：{' '}
            <a
              href="https://github.com/cainiaopppppppp/MeshKit/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              GitHub Issues
            </a>
          </p>
          <p>
            功能建议：{' '}
            <a
              href="https://github.com/cainiaopppppppp/MeshKit/discussions"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              GitHub Discussions
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
