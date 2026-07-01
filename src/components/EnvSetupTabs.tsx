import { useState } from 'react';
import { useLang } from '../lib/useLang';

interface EnvSetupItem { content: string; }
interface EnvSetup { pip?: EnvSetupItem; container?: EnvSetupItem; }
interface EnvSetupTabsProps { envSetupEn: EnvSetup; envSetupZh: EnvSetup; }

function renderMarkdown(md: string): string {
  let html = md;

  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
    const escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .trimEnd();
    return `<div class="code-block group relative"><div class="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"><button class="copy-btn px-2 py-1 text-[10px] font-mono rounded border border-ink-700 bg-ink-800 text-ink-400 hover:text-accent-400 hover:border-accent-500/30 transition-colors" data-code="${encodeURIComponent(code.trim())}">copy</button></div><pre><code class="language-${lang || 'bash'}">${escaped}</code></pre></div>`;
  });

  html = html.replace(/^> (.+)$/gm, '<blockquote class="border-l-2 border-accent-500/40 pl-4 py-2 my-4 bg-accent-500/5 rounded-r text-sm text-ink-400">$1</blockquote>');
  html = html.replace(/^\*\*(.+):\*\*\s*$/gm, '<h3 class="font-display text-sm font-semibold mt-4 mb-2 text-ink-200">$1</h3>');

  const lines = html.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    if (line.trim() && !line.startsWith('<') && !line.startsWith('```')) {
      const processed = line
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-accent-400 hover:text-accent-300 border-b border-accent-500/30">$1</a>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');
      result.push(`<p class="text-sm text-ink-400 leading-relaxed mb-4">${processed}</p>`);
    } else {
      result.push(line);
    }
  }

  return result.join('\n');
}

export default function EnvSetupTabs({ envSetupEn, envSetupZh }: EnvSetupTabsProps) {
  const { lang, t } = useLang();
  const envSetup = lang === 'zh' ? envSetupZh : envSetupEn;
  const hasPip = !!envSetup.pip;
  const hasContainer = !!envSetup.container;
  const [tab, setTab] = useState<'pip' | 'container'>(hasPip ? 'pip' : 'container');

  const tabClass = (active: boolean) =>
    `px-4 py-2 text-xs font-mono rounded-md transition-all ${
      active
        ? 'bg-accent-500/10 text-accent-400 border border-accent-500/30'
        : 'border border-ink-800/60 text-ink-500 hover:text-ink-300 hover:border-ink-700'
    }`;

  const currentContent = tab === 'pip' ? envSetup.pip?.content : envSetup.container?.content;
  const showTabs = hasPip && hasContainer;

  return (
    <div>
      {showTabs && (
        <div className="flex gap-2 mb-4">
          <button onClick={() => setTab('pip')} className={tabClass(tab === 'pip')}>
            {t('tabPip')}
          </button>
          <button onClick={() => setTab('container')} className={tabClass(tab === 'container')}>
            {t('tabContainer')}
          </button>
        </div>
      )}

      {currentContent && (
        <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(currentContent) }} />
      )}
    </div>
  );
}
