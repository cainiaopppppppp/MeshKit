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
  answer: string;
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
        question: '点对点传输和取件码有什么区别？',
        answer: '点对点传输适合直接选择在线设备后立即发送；取件码更适合通过 6 位码、邀请链接或二维码让对方加入一个临时房间后再接收文件。',
      },
      {
        question: '为什么传输时不让我切到别的页面？',
        answer: '在取件码房间和活跃的点对点传输期间，发送方和接收方都需要保持在当前页面，避免 RTC 连接中断。你可以先取消发送、取消接收，或在接收方点击“标记为已完成”后再离开。',
      },
      {
        question: '接收方如何结束一次传输？',
        answer: '接收方保存完需要的文件后，需要点击“标记为已完成”通知发送方。发送方也可以在等待确认、传输中或等待完成时主动点击“取消发送”。',
      },
      {
        question: '分享取件码时支持二维码吗？',
        answer: '支持。分享弹层会同时提供邀请链接、二维码展示和二维码下载，Desktop 也能导入这类邀请链接。',
      },
    ],
  },
  {
    category: '便签墙',
    items: [
      {
        question: '便签墙支持加密吗？',
        answer: '支持。创建房间时可以启用密码和内容加密；加入已有加密房间时需要输入正确密码。',
      },
      {
        question: '谁可以销毁便签墙房间？',
        answer: '只有房主可以销毁当前房间。房间销毁后，其他在线成员会收到提示并退出房间。',
      },
      {
        question: '房间销毁后，房间号还能继续用吗？',
        answer: '可以。销毁代表清空这次房间的数据和成员，不代表这个房间号永久作废。之后手动再次输入同一个房间号，会作为一个新的空房间重新创建。',
      },
    ],
  },
  {
    category: '加密聊天',
    items: [
      {
        question: '加密聊天房间也有房主限制吗？',
        answer: '有。只有房主可以销毁加密聊天房间，其他成员只能离开房间，不能销毁。',
      },
      {
        question: '房间被销毁后会发生什么？',
        answer: '房主销毁房间后，其他成员会收到明确提示并退出当前房间，本地最近房间入口也会同步清理。',
      },
      {
        question: '邀请链接能直接带我进入聊天房间吗？',
        answer: '可以。Web 侧分享出来的邀请链接可以直接在 Web 中打开，也可以导入到 Desktop 设置页，Desktop 会自动跳转到对应房间。',
      },
    ],
  },
  {
    category: '邀请链接与 Desktop',
    items: [
      {
        question: 'Web 用户分享的邀请链接，Desktop 怎么用？',
        answer: '在 Desktop 的设置页粘贴完整邀请链接并导入即可。现在 Desktop 不只会导入共享配置，还会自动识别目标功能并跳转到取件码、便签墙或加密聊天页面。',
      },
      {
        question: '分享弹层里可以做什么？',
        answer: '你可以复制邀请链接、查看二维码、下载二维码图片；在支持系统分享的设备上，还能调用系统分享面板。',
      },
    ],
  },
  {
    category: '常见排查',
    items: [
      {
        question: '看不到其他设备怎么办？',
        answer: '先确认双方处于同一网络，且共享服务或信令服务已经启动；如果仍然看不到，再检查防火墙和端口配置是否正确。',
      },
      {
        question: 'RTC 一直显示未连接怎么办？',
        answer: '先确认对方仍停留在传输页面，再尝试点击“刷新 RTC”。如果依旧无法连接，请检查 peer 端口、局域网连通性与防火墙设置。',
      },
      {
        question: '为什么浏览器会提示 blob 文件是非 HTTPS 加载？',
        answer: '这是浏览器在 HTTP 页面下载本地 blob 文件时给出的安全提示，不一定代表传输失败。若要彻底消除提示，需要把分享页部署到 HTTPS 环境。',
      },
    ],
  },
];

const tips = [
  { title: '优先分享链接', tip: '邀请链接和二维码比手动输入地址更稳定，也更适合手机加入。' },
  { title: '保持页面常亮', tip: '文件传输、取件码和点对点接收期间，尽量不要锁屏或切走页面。' },
  { title: '善用最近房间', tip: '便签墙和加密聊天支持最近房间，但房间被销毁后会自动清理。' },
  { title: '局域网体验更好', tip: '同一 Wi-Fi 或同一局域网下，设备发现和 RTC 建连通常更快。' },
];

function FAQSection({ category, items }: FAQSectionData) {
  const [openIndex, setOpenIndex] = useState<number>(0);

  return (
    <section className="mt-6 first:mt-0">
      <h2 className="mb-3 pl-0.5 text-[15px] font-bold text-[#1a1f36]">{category}</h2>
      <div className="space-y-1.5">
        {items.map((item, index) => {
          const open = openIndex === index;

          return (
            <div
              key={item.question}
              className="overflow-hidden rounded-[10px] border border-[#e8ecf2] bg-white transition hover:border-[rgba(26,109,255,0.2)]"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(open ? -1 : index)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-[13px] font-medium text-[#1a1f36]"
              >
                <span>{item.question}</span>
                <svg
                  className={`h-4 w-4 shrink-0 text-[#8e95b2] transition ${open ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {open ? (
                <div className="px-4 pb-4 text-[13px] leading-7 text-[#5e6687]">{item.answer}</div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function HelpPage() {
  return (
    <div className="mx-auto max-w-[480px] px-5 py-6 pb-14 sm:px-4">
      <section className="mb-7">
        <p className="mb-1.5 font-['DM_Sans',_'Noto_Sans_SC',sans-serif] text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1a6dff]">
          MeshKit Help
        </p>
        <h1 className="text-[26px] font-bold tracking-[-0.03em] text-[#1a1f36]">使用帮助</h1>
        <p className="mt-2 text-sm leading-7 text-[#5e6687]">
          MeshKit 1.1.0 提供文件传输、便签墙和加密聊天三大能力，支持邀请链接、二维码分享，以及 Web 与 Desktop 间的联动。
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-[#e8f0ff] px-2.5 py-1 text-[11px] font-medium text-[#1a6dff]">
            <ShieldLockIcon className="h-3.5 w-3.5" />
            邀请链接与二维码
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-[rgba(16,185,129,0.1)] px-2.5 py-1 text-[11px] font-medium text-[#059669]">
            <TransferInboxIcon className="h-3.5 w-3.5" />
            P2P 协作
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-[#f8fafd] px-2.5 py-1 text-[11px] font-medium text-[#5e6687]">
            <InfoIcon className="h-3.5 w-3.5" />
            Web / Desktop 通用
          </span>
        </div>
      </section>

      <section className="mb-6 rounded-[14px] border border-[rgba(26,109,255,0.1)] bg-[linear-gradient(135deg,#e8f0ff,rgba(26,109,255,0.04))] p-5 shadow-[0_1px_3px_rgba(26,31,54,0.04)]">
        <h2 className="mb-3 text-sm font-bold text-[#1a1f36]">快速开始</h2>
        <div className="space-y-1.5 text-[13px] leading-7 text-[#5e6687]">
          <p><strong>第一步：</strong>确认设备在同一网络，或已经通过邀请链接接入共享服务。</p>
          <p><strong>第二步：</strong>发送方在 Web 或 Desktop 中选择对应功能并生成分享入口。</p>
          <p><strong>第三步：</strong>接收方通过邀请链接、二维码、取件码或房间号加入。</p>
        </div>

        <div className="mt-4 rounded-[10px] border border-[#f0f3f8] bg-white p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-3 text-[12px] text-[#5e6687]">
              <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#e8f0ff] text-[#1a6dff]">
                <DesktopComputerIcon className="h-4 w-4" />
              </span>
              <div>
                <div className="font-semibold text-[#1a1f36]">电脑</div>
                <div className="text-[11px] text-[#8e95b2]">适合发起房间、导入邀请链接和分享二维码</div>
              </div>
            </div>
            <div className="hidden text-[#8e95b2] sm:block">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-4-4 4 4-4 4" />
              </svg>
            </div>
            <div className="flex flex-1 items-center gap-3 text-[12px] text-[#5e6687]">
              <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#e8f0ff] text-[#1a6dff]">
                <MobilePhoneIcon className="h-4 w-4" />
              </span>
              <div>
                <div className="font-semibold text-[#1a1f36]">手机</div>
                <div className="text-[11px] text-[#8e95b2]">适合通过二维码或邀请链接快速加入</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {faqData.map((section) => (
        <FAQSection key={section.category} category={section.category} items={section.items} />
      ))}

      <section className="mt-6 grid gap-2 sm:grid-cols-2">
        {tips.map((tip) => (
          <div key={tip.title} className="rounded-[10px] border border-[#f0f3f8] bg-[#f8fafd] p-3.5">
            <h3 className="text-[13px] font-semibold text-[#1a1f36]">{tip.title}</h3>
            <p className="mt-1 text-[11px] leading-5 text-[#8e95b2]">{tip.tip}</p>
          </div>
        ))}
      </section>

      <section className="mt-5 rounded-[14px] border border-[#e8ecf2] bg-white p-4 shadow-[0_1px_3px_rgba(26,31,54,0.04)]">
        <h2 className="mb-3 text-[13px] font-semibold text-[#1a1f36]">更多帮助</h2>
        <div className="space-y-2 text-[12px]">
          <div className="flex items-center gap-2">
            <span className="min-w-[56px] text-[#8e95b2]">文档：</span>
            <a
              href="https://github.com/cainiaopppppppp/MeshKit/tree/main/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1a6dff] hover:underline"
            >
              查看 docs 目录
            </a>
          </div>
          <div className="flex items-center gap-2">
            <span className="min-w-[56px] text-[#8e95b2]">问题反馈：</span>
            <a
              href="https://github.com/cainiaopppppppp/MeshKit/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1a6dff] hover:underline"
            >
              GitHub Issues
            </a>
          </div>
          <div className="flex items-center gap-2">
            <span className="min-w-[56px] text-[#8e95b2]">功能建议：</span>
            <a
              href="https://github.com/cainiaopppppppp/MeshKit/discussions"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1a6dff] hover:underline"
            >
              GitHub Discussions
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
