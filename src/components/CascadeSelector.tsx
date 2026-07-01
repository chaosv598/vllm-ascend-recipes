import { useState, useMemo, useEffect } from 'react';
import { useLang } from '../lib/useLang';

interface ScenarioStep {
  title: string;
  content: string;
}

interface Scenario {
  npu: string;
  precision: string;
  deployment: string;
  verified: boolean;
  steps: ScenarioStep[];
}

interface CascadeSelectorProps {
  scenarios: Scenario[];
}

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

  html = html.replace(/^### (.+)$/gm, '<h3 class="font-display text-base font-semibold mt-6 mb-2 text-ink-200">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="font-display text-lg font-semibold mt-6 mb-3 text-ink-100">$1</h2>');
  html = html.replace(/^> (.+)$/gm, '<blockquote class="border-l-2 border-accent-500/40 pl-4 py-2 my-4 bg-accent-500/5 rounded-r text-sm text-ink-400">$1</blockquote>');

  const lines = html.split('\n');
  const result: string[] = [];
  let inList = false;

  for (const line of lines) {
    if (line.match(/^- (.+)$/)) {
      if (!inList) {
        result.push('<ul class="list-none p-0 m-0 0 mb-4 space-y-1">');
        inList = true;
      }
      const itemContent = line.replace(/^- (.+)$/, '$1')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-accent-400 hover:text-accent-300 border-b border-accent-500/30">$1</a>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');
      result.push(`<li class="text-sm text-ink-400 pl-4 relative before:content-['▸'] before:absolute before:left-0 before:text-accent-500 before:text-xs before:top-0.5">${itemContent}</li>`);
    } else {
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
      if (line.trim() && !line.startsWith('<') && !line.startsWith('```')) {
        const processed = line
          .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-accent-400 hover:text-accent-300 border-b border-accent-500/30">$1</a>')
          .replace(/`([^`]+)`/g, '<code>$1</code>')
          .replace(/\*\*(.+?)\*\*/g, '<strong class="text-ink-200 font-semibold">$1</strong>');
        result.push(`<p class="text-sm text-ink-400 leading-relaxed mb-4">${processed}</p>`);
      } else {
        result.push(line);
      }
    }
  }

  if (inList) result.push('</ul>');
  return result.join('\n');
}

export default function CascadeSelector({ scenarios }: CascadeSelectorProps) {
  const { t } = useLang();

  const npus = useMemo(() => {
    const set = new Set<string>();
    scenarios.forEach((s) => set.add(s.npu));
    return Array.from(set);
  }, [scenarios]);

  const [selectedNpu, setSelectedNpu] = useState(npus[0] || '');

  const precisions = useMemo(() => {
    const set = new Set<string>();
    scenarios.filter((s) => s.npu === selectedNpu).forEach((s) => set.add(s.precision));
    return Array.from(set);
  }, [scenarios, selectedNpu]);

  const [selectedPrecision, setSelectedPrecision] = useState(precisions[0] || '');

  useEffect(() => {
    if (!precisions.includes(selectedPrecision)) {
      setSelectedPrecision(precisions[0] || '');
    }
  }, [precisions, selectedPrecision]);

  const effectivePrecision = precisions.includes(selectedPrecision)
    ? selectedPrecision
    : precisions[0] || '';

  const deployments = useMemo(() => {
    const set = new Set<string>();
    scenarios
      .filter((s) => s.npu === selectedNpu && s.precision === effectivePrecision)
      .forEach((s) => set.add(s.deployment));
    return Array.from(set);
  }, [scenarios, selectedNpu, effectivePrecision]);

  const [selectedDeployment, setSelectedDeployment] = useState(deployments[0] || '');

  useEffect(() => {
    if (!deployments.includes(selectedDeployment)) {
      setSelectedDeployment(deployments[0] || '');
    }
  }, [deployments, selectedDeployment]);

  const effectiveDeployment = deployments.includes(selectedDeployment)
    ? selectedDeployment
    : deployments[0] || '';

  const currentScenario = scenarios.find(
    (s) => s.npu === selectedNpu && s.precision === effectivePrecision && s.deployment === effectiveDeployment
  );

  const selectClass = "w-full px-3 py-2 text-xs font-mono rounded-lg border border-ink-800/60 bg-ink-900/40 text-ink-200 focus:outline-none focus:border-accent-500/40 focus:ring-1 focus:ring-accent-500/20 cursor-pointer transition-colors";

  const labelClass = "text-[10px] font-mono uppercase tracking-wider text-ink-600 mb-1.5 block";

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8 p-4 rounded-lg border border-ink-800/60 bg-ink-900/30">
        <div>
          <label className={labelClass}>{t('labelNpu')}</label>
          <select value={selectedNpu} onChange={(e) => setSelectedNpu(e.target.value)} className={selectClass}>
            {npus.map((n) => (<option key={n} value={n}>{n}</option>))}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t('labelPrecision')}</label>
          <select value={effectivePrecision} onChange={(e) => setSelectedPrecision(e.target.value)} className={selectClass}>
            {precisions.map((p) => (<option key={p} value={p}>{p}</option>))}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t('labelDeployment')}</label>
          <select value={effectiveDeployment} onChange={(e) => setSelectedDeployment(e.target.value)} className={selectClass}>
            {deployments.map((d) => (<option key={d} value={d}>{d}</option>))}
          </select>
        </div>
      </div>

      {currentScenario && (
        <div>
          <div className="flex items-center gap-2 mb-6">
            {currentScenario.verified ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-accent-500/20 bg-accent-500/5 text-[11px] font-mono text-accent-400">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {t('labelVerified')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-amber-500/20 bg-amber-500/5 text-[11px] font-mono text-amber-400">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
                {t('labelUnverified')}
              </span>
            )}
          </div>

          <div className="space-y-8">
            {currentScenario.steps.map((step, i) => (
              <div key={i} className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-accent-500/20 bg-accent-500/5 font-mono text-xs text-accent-400 font-semibold">
                    {i + 1}
                  </span>
                  <h3 className="font-display text-base font-semibold text-ink-100">{step.title}</h3>
                </div>
                <div className="ml-[18px] prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(step.content) }} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
