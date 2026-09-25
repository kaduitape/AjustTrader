import { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowRight, BarChart3, Calculator, Check, ChevronDown, ChevronRight,
  CircleDollarSign, Clock3, Copy, Edit3, History, Info, Layers3, LogOut, Menu, Plus,
  RefreshCw, Settings, ShieldCheck, Sparkles, Target, Trash2, TrendingDown,
  TrendingUp, WalletCards, X,
} from 'lucide-react';
import { api } from './api.js';
import { dateTime, money, shortMoney, statuses, tone } from './utils.js';

export function Logo({ compact = false }) {
  return <div className="logo"><div className="logo-mark"><Layers3 size={19} /></div>{!compact && <div><strong>Ajuste</strong><span>de Lotes</span></div>}</div>;
}

export function AuthScreen({ onAuthenticated }) {
  const [register, setRegister] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      const data = await api(register ? '/auth/register' : '/auth/login', { method: 'POST', body: JSON.stringify(form) });
      onAuthenticated(data);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  return <main className="auth-shell">
    <section className="auth-visual">
      <div className="visual-grid" />
      <Logo />
      <div className="auth-copy">
        <span className="eyebrow"><Sparkles size={14} /> Planejamento com precisão</span>
        <h1>Ajuste seus lotes.<br/><em>Proteja suas metas.</em></h1>
        <p>Planeje resultados entre MNQ e USTEC e encontre ajustes matemáticos sem improviso.</p>
        <div className="auth-metrics">
          <div><Target size={18}/><strong>4 cenários</strong><span>por operação</span></div>
          <div><ShieldCheck size={18}/><strong>100% algébrico</strong><span>sem valor absoluto no saldo</span></div>
        </div>
      </div>
      <div className="ticker-card">
        <span>AJUSTE PROJETADO</span><strong>+$610,00</strong><small><TrendingUp size={13}/> Meta recuperada</small>
      </div>
    </section>
    <section className="auth-panel">
      <div className="auth-form-wrap">
        <div className="mobile-logo"><Logo /></div>
        <span className="eyebrow muted">{register ? 'CRIAR CONTA' : 'BEM-VINDO DE VOLTA'}</span>
        <h2>{register ? 'Comece agora' : 'Acesse seu painel'}</h2>
        <p>{register ? 'Configure seus parâmetros e faça seu primeiro planejamento.' : 'Entre para acompanhar suas operações planejadas.'}</p>
        <form onSubmit={submit} className="form-stack">
          {register && <Field label="Seu nome"><input autoFocus value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Como podemos chamar você?" required /></Field>}
          <Field label="E-mail"><input autoFocus={!register} type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="voce@exemplo.com" required /></Field>
          <Field label="Senha"><input type="password" minLength="6" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="Mínimo de 6 caracteres" required /></Field>
          {error && <div className="error-box">{error}</div>}
          <button className="button primary wide" disabled={loading}>{loading ? <RefreshCw className="spin" size={17}/> : register ? 'Criar minha conta' : 'Entrar'} {!loading && <ArrowRight size={17}/>}</button>
        </form>
        <button className="text-button" onClick={() => { setRegister(!register); setError(''); }}>{register ? 'Já possui uma conta? Entrar' : 'Ainda não possui conta? Criar agora'}</button>
        <div className="security-note"><ShieldCheck size={15}/> Seus dados ficam isolados em sua conta.</div>
      </div>
    </section>
  </main>;
}

export function Field({ label, hint, children, className = '' }) {
  return <label className={`field ${className}`}><span><SemanticLabel text={label}/>{hint && <small>{hint}</small>}</span>{children}</label>;
}

const semanticTermClasses = { take: 'term-take', stop: 'term-stop', mesa: 'term-mesa', real: 'term-real' };

function SemanticLabel({ text }) {
  return <span className="semantic-label">{String(text).split(/(take|stop|mesa|real)/gi).map((part, index) => {
    const termClass = semanticTermClasses[part.toLowerCase()];
    return termClass ? <span className={termClass} key={`${part}-${index}`}>{part}</span> : part;
  })}</span>;
}

export function Modal({ title, subtitle, onClose, children, size = '' }) {
  useEffect(() => {
    const escape = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <section className={`modal ${size}`}>
      <header className="modal-header"><div><span className="eyebrow">AJUSTE DE LOTES</span><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={20}/></button></header>
      {children}
    </section>
  </div>;
}

export function OperationModal({ operation, settings, onClose, onSaved }) {
  const [form, setForm] = useState(operation || { description: '', mesaContracts: 1, realLots: settings.minLot, takeTicks: 150, stopTicks: 200, status: 'PLANEJADA' });
  const [preview, setPreview] = useState(operation || null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!form.mesaContracts || !form.realLots || !form.takeTicks || !form.stopTicks) return;
      try { setPreview(await api('/calculate', { method: 'POST', body: JSON.stringify(form) })); setError(''); }
      catch (err) { setError(err.message); }
    }, 220);
    return () => clearTimeout(timer);
  }, [form.mesaContracts, form.realLots, form.takeTicks, form.stopTicks]);

  async function submit(event) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const saved = await api(operation ? `/operations/${operation.id}` : '/operations', { method: operation ? 'PUT' : 'POST', body: JSON.stringify(form) });
      onSaved(saved);
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  return <Modal title={operation ? 'Editar planejamento' : 'Nova operação'} subtitle="Defina os lotes e limites da operação planejada." onClose={onClose}>
    <form onSubmit={submit}>
      <div className="modal-body">
        <Field label="Descrição"><input value={form.description} onChange={update('description')} placeholder="Ex.: Avaliação principal" required /></Field>
        <div className="form-grid">
          <Field label="Lote Mesa" hint="contratos MNQ"><input type="number" min="0" step="1" value={form.mesaContracts} onChange={update('mesaContracts')} required /></Field>
          <Field label="Lote Real" hint={`passo ${settings.lotStep}`}><input type="number" min={settings.minLot} max={settings.maxLot} step={settings.lotStep} value={form.realLots} onChange={update('realLots')} required /></Field>
          <Field label="Take" hint="ticks"><input type="number" min="1" step="1" value={form.takeTicks} onChange={update('takeTicks')} required /></Field>
          <Field label="Stop" hint="ticks"><input type="number" min="1" step="1" value={form.stopTicks} onChange={update('stopTicks')} required /></Field>
        </div>
        {operation && <Field label="Status"><select value={form.status} onChange={update('status')}>{statuses.map(status => <option key={status}>{status}</option>)}</select></Field>}
        <div className="preview-panel">
          <div className="section-label"><Calculator size={15}/> PREVIEW DO PLANEJAMENTO</div>
          <div className="preview-grid">
            <Metric label="Mesa Take" value={preview?.mesaTake} />
            <Metric label="Mesa Stop" value={preview?.mesaStop} />
            <Metric label="Real (Mesa Take)" value={preview?.realTake} />
            <Metric label="Real (Mesa Stop)" value={preview?.realStop} />
          </div>
        </div>
        {error && <div className="error-box">{error}</div>}
      </div>
      <footer className="modal-footer"><button type="button" className="button ghost" onClick={onClose}>Cancelar</button><button className="button primary" disabled={saving}>{saving ? 'Salvando…' : operation ? 'Salvar alterações' : 'Criar planejamento'}</button></footer>
    </form>
  </Modal>;
}

export function Metric({ label, value, sub, kind, icon }) {
  return <div className={`metric ${kind || tone(value)}`}>{icon && <span className="metric-icon">{icon}</span>}<span><SemanticLabel text={label}/></span><strong>{value === undefined ? '—' : money(value)}</strong>{sub && <small>{sub}</small>}</div>;
}

const targetOptions = [
  ['mesaTake', 'Mesa Take', 'mesa'], ['mesaStop', 'Mesa Stop', 'mesa'],
  ['realTake', 'Real (Mesa Take)', 'real'], ['realStop', 'Real (Mesa Stop)', 'real'],
];

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return; } catch { /* usa fallback abaixo */ }
  }
  const textarea = document.createElement('textarea');
  textarea.value = text; textarea.style.position = 'fixed'; textarea.style.opacity = '0';
  document.body.appendChild(textarea); textarea.select(); document.execCommand('copy'); textarea.remove();
}

function CopyValue({ label, value, display, valueClass = '', compact = false }) {
  const [copied, setCopied] = useState(false);
  async function copy(event) {
    event.stopPropagation();
    await copyText(String(value));
    setCopied(true); setTimeout(() => setCopied(false), 1600);
  }
  return <button type="button" className={`copy-value ${compact ? 'compact' : ''} ${copied ? 'copied' : ''}`} onClick={copy} title={`Copiar ${label}`}>
    <small><SemanticLabel text={label}/></small><span className={valueClass}>{display ?? value}</span><em>{copied ? <Check size={12}/> : <Copy size={12}/>}</em>
  </button>;
}

export function AdjustmentModal({ operation, settings, onClose, onSaved }) {
  const [tab, setTab] = useState('single');
  const [targetField, setTargetField] = useState('mesaTake');
  const [realized, setRealized] = useState('');
  const [mode, setMode] = useState('keep_ticks');
  const [ticks, setTicks] = useState(operation.takeTicks);
  const [quantity, setQuantity] = useState(operation.mesaContracts || 1);
  const [calculation, setCalculation] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const target = operation[targetField];
  const market = targetOptions.find(item => item[0] === targetField)[2];

  useEffect(() => {
    setTicks(targetField.toLowerCase().includes('stop') ? operation.stopTicks : operation.takeTicks);
    setQuantity(market === 'mesa' ? Math.max(1, operation.mesaContracts) : operation.realLots);
    setCalculation(null); setSelected(null);
  }, [targetField, market, operation]);

  async function calculate(event) {
    event?.preventDefault(); setError('');
    if (realized === '') return setError('Informe o resultado obtido nesta operação.');
    try {
      const result = await api('/calculate-adjustment', { method: 'POST', body: JSON.stringify({
        operationId: operation.id, market, target, realized, mode, ticks, quantity, targetField,
        referenceTakeTicks: operation.takeTicks, referenceStopTicks: operation.stopTicks,
        mesaContracts: operation.mesaContracts, realLots: operation.realLots,
      }) });
      setCalculation(result); setSelected(result.suggestions[0] || null);
    } catch (err) { setError(err.message); }
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    try {
      await api(`/operations/${operation.id}/adjustments`, { method: 'POST', body: JSON.stringify({
        targetField, targetValue: target, realizedValue: realized, market, mode,
        suggestedQuantity: selected.quantity, suggestedTicks: selected.ticks,
        predictedResult: selected.result, difference: selected.difference,
      }) });
      onSaved();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  return <Modal title="Ajuste de meta" subtitle={`${operation.description} · ${operation.mesaContracts} MNQ · ${operation.realLots} USTEC`} onClose={onClose} size="large">
    <div className="modal-tabs"><button className={tab === 'single' ? 'active' : ''} onClick={() => setTab('single')}><Target size={16}/> Ajuste individual</button><button className={tab === 'combined' ? 'active' : ''} onClick={() => setTab('combined')}><Layers3 size={16}/> Ajuste combinado</button></div>
    {tab === 'combined' ? <CombinedAdjustment operation={operation} settings={settings} /> : <>
      <div className="modal-body adjustment-body">
        <div className="original-strip">
          <span><small><SemanticLabel text="Mesa"/></small><strong>{operation.mesaContracts} contratos</strong></span>
          <span><small><SemanticLabel text="Real"/></small><strong>{operation.realLots} lotes</strong></span>
          <span><small>TP</small><strong>{operation.takeTicks} ticks</strong></span>
          <span><small>SL</small><strong>{operation.stopTicks} ticks</strong></span>
        </div>
        <div className="adjust-grid">
          <section className="adjust-form">
            <Field label="Qual resultado deseja ajustar?"><select value={targetField} onChange={e => setTargetField(e.target.value)}>{targetOptions.map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></Field>
            <Field label="Qual foi o resultado desta operação?" hint="será somado ao acumulado anterior"><div className="money-input"><span>US$</span><input type="number" step="0.01" value={realized} onChange={e => { setRealized(e.target.value); setCalculation(null); }} placeholder="0,00" /></div></Field>
            <div className="section-label top-gap">MODO DE CÁLCULO</div>
            <div className="mode-list">
              {[['keep_ticks', 'Manter ticks', 'Calcular o lote ideal'], ['keep_quantity', 'Manter lote', 'Calcular os ticks ideais'], ['suggest', 'Sugerir combinações', 'Comparar alternativas próximas']].map(([key, label, sub]) =>
                <label className={mode === key ? 'selected' : ''} key={key}><input type="radio" name="mode" value={key} checked={mode === key} onChange={() => { setMode(key); setCalculation(null); }} /><span><strong>{label}</strong><small>{sub}</small></span><Check size={16}/></label>)}
            </div>
            {mode === 'keep_ticks' && <Field label="Ticks mantidos"><input type="number" min="1" step="1" value={ticks} onChange={e => setTicks(e.target.value)} /></Field>}
            {mode === 'keep_quantity' && <Field label={market === 'mesa' ? 'Contratos mantidos' : 'Lotes mantidos'}><input type="number" min={market === 'mesa' ? 1 : settings.minLot} step={market === 'mesa' ? 1 : settings.lotStep} value={quantity} onChange={e => setQuantity(e.target.value)} /></Field>}
            {mode === 'suggest' && <div className="form-grid compact"><Field label="Referência de ticks"><input type="number" min="1" step="1" value={ticks} onChange={e => setTicks(e.target.value)} /></Field><Field label="Referência de lote"><input type="number" min="1" step={market === 'mesa' ? 1 : settings.lotStep} value={quantity} onChange={e => setQuantity(e.target.value)} /></Field></div>}
            <button className="button primary wide" onClick={calculate}><Calculator size={17}/> Calcular ajuste</button>
            {error && <div className="error-box">{error}</div>}
          </section>
          <section className="adjust-results">
            <div className="reset-summary-grid">
              <Metric label="Resultado atual" value={calculation?.resultAccumulated ?? (realized === '' ? undefined : realized)} />
              <Metric label="Meta Take" value={calculation?.metaTake ?? (market === 'mesa' ? operation.mesaTake : operation.realTake)} />
              <Metric label="Meta Stop" value={calculation?.metaStop ?? (market === 'mesa' ? operation.mesaStop : operation.realStop)} />
              <Metric label="Falta para Take" value={calculation?.takeNeeded} kind="pending" />
              <Metric label="Falta para Stop" value={calculation?.stopNeeded} kind="pending" />
            </div>
            {calculation && Number(calculation.previousAccumulated) !== 0 && <div className="accumulated-note"><History size={14}/><span>Acumulado anterior: <strong>{money(calculation.previousAccumulated)}</strong></span><span>Resultado informado agora: <strong>{money(realized)}</strong></span></div>}
            {!calculation ? <div className="empty-result"><div><Calculator size={28}/></div><h3>Pronto para calcular</h3><p>Informe o realizado e escolha um modo para encontrar o melhor ajuste.</p></div> : calculation.suggestions.length === 0 ? <div className="empty-result"><h3>Meta já atingida</h3><p>Não há saldo pendente para ajustar.</p></div> : <div className="suggestions">
              <div className="suggestion-head"><div><span className="section-label">ALTERNATIVAS</span><small>Ordenadas pela menor diferença</small></div><span className={`direction ${calculation.direction.toLowerCase()}`}>Direção {calculation.direction.toLowerCase()}</span></div>
              <div className="suggestion-table">
                <div className="suggestion-row header"><span>{market === 'mesa' ? 'Contratos' : 'Lotes'}</span><span><SemanticLabel text="Take"/></span><span><SemanticLabel text="Stop"/></span><span>Resultado</span><span>Diferença</span><span></span></div>
                {calculation.suggestions.map((item, index) => <button type="button" className={`suggestion-row ${selected === item ? 'selected' : ''}`} key={`${item.quantity}-${item.ticks}`} onClick={() => setSelected(item)}><span>{item.quantity}</span><span>{item.takeTicks ?? item.ticks}</span><span>{item.stopTicks ?? '—'}</span><span className={tone(item.result)}>{money(item.result)}</span><span className={tone(item.difference)}>{money(item.difference)}</span><span className="select-dot">{selected === item && <Check size={12}/>}</span>{index === 0 && <em>Melhor ajuste</em>}</button>)}
              </div>
              {selected && <div className="reset-scenarios">
                <section className="reset-scenario take"><header><TrendingUp size={16}/><SemanticLabel text="SE BATER TAKE"/></header><div><CopyValue label="Nova operação" value={selected.takeResult} display={money(selected.takeResult)} valueClass={tone(selected.takeResult)}/><CopyValue label="Resultado acumulado" value={selected.finalTake} display={money(selected.finalTake)} valueClass={tone(selected.finalTake)}/><CopyValue label="Meta original" value={selected.metaTake} display={money(selected.metaTake)} valueClass={tone(selected.metaTake)}/><CopyValue label="Diferença" value={selected.takeDifference} display={money(selected.takeDifference)} valueClass={tone(selected.takeDifference)}/></div></section>
                <section className="reset-scenario stop"><header><TrendingDown size={16}/><SemanticLabel text="SE BATER STOP"/></header><div><CopyValue label="Nova operação" value={selected.stopResult} display={money(selected.stopResult)} valueClass={tone(selected.stopResult)}/><CopyValue label="Resultado acumulado" value={selected.finalStop} display={money(selected.finalStop)} valueClass={tone(selected.finalStop)}/><CopyValue label="Meta original" value={selected.metaStop} display={money(selected.metaStop)} valueClass={tone(selected.metaStop)}/><CopyValue label="Diferença" value={selected.stopDifference} display={money(selected.stopDifference)} valueClass={tone(selected.stopDifference)}/></div></section>
              </div>}
              {selected?.impact && <div className="copy-config-card">
                <span className="copy-config-title"><span><Copy size={14}/> COPIAR VALORES</span><em>Clique em um quadrado</em></span>
                <div className="copy-config-main"><CopyValue label="Mesa" value={selected.mesaContracts} display={`${selected.mesaContracts} contratos`}/><CopyValue label="Conta Real" value={selected.realLots} display={`${selected.realLots} lotes`}/><CopyValue label="Take financeiro" value={selected.takeTicks} display={`${selected.takeTicks} ticks`}/><CopyValue label="Stop financeiro" value={selected.stopTicks} display={`${selected.stopTicks} ticks`}/></div>
                <div className="copy-impact-grid"><CopyValue label="Mesa Take" value={selected.impact.mesaTake} display={money(selected.impact.mesaTake)} valueClass={tone(selected.impact.mesaTake)}/><CopyValue label="Mesa Stop" value={selected.impact.mesaStop} display={money(selected.impact.mesaStop)} valueClass={tone(selected.impact.mesaStop)}/><CopyValue label="Real (Mesa Take)" value={selected.impact.realTake} display={money(selected.impact.realTake)} valueClass={tone(selected.impact.realTake)}/><CopyValue label="Real (Mesa Stop)" value={selected.impact.realStop} display={money(selected.impact.realStop)} valueClass={tone(selected.impact.realStop)}/></div>
              </div>}
            </div>}
          </section>
        </div>
        <Disclaimer />
      </div>
      <footer className="modal-footer"><button className="button ghost" onClick={onClose}>Cancelar</button><button className="button primary" disabled={!selected || saving} onClick={save}>{saving ? 'Registrando…' : 'Registrar ajuste'}</button></footer>
    </>}
  </Modal>;
}

function CombinedAdjustment({ operation, settings }) {
  const [form, setForm] = useState({ mesaContracts: operation.mesaContracts || 1, realLots: operation.realLots, takeTicks: operation.takeTicks, stopTicks: operation.stopTicks });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const update = key => e => setForm({ ...form, [key]: e.target.value });
  async function calculate() {
    try { setResult(await api('/calculate-combined', { method: 'POST', body: JSON.stringify({ ...form, before: { mesaTake: operation.mesaTake, mesaStop: operation.mesaStop, realTake: operation.realTake, realStop: operation.realStop } }) })); setError(''); }
    catch (err) { setError(err.message); }
  }
  return <div className="modal-body combined-body">
    <div className="combined-editor">
      <div><span className="eyebrow">NOVA OPERAÇÃO</span><h3>Simule o impacto conjunto</h3><p>Veja como uma nova configuração afeta os quatro resultados simultaneamente.</p></div>
      <div className="form-grid">
        <Field label="Contratos Mesa"><input type="number" min="0" step="1" value={form.mesaContracts} onChange={update('mesaContracts')} /></Field>
        <Field label="Lotes Real"><input type="number" min={settings.minLot} step={settings.lotStep} value={form.realLots} onChange={update('realLots')} /></Field>
        <Field label="Take (ticks)"><input type="number" min="1" step="1" value={form.takeTicks} onChange={update('takeTicks')} /></Field>
        <Field label="Stop (ticks)"><input type="number" min="1" step="1" value={form.stopTicks} onChange={update('stopTicks')} /></Field>
      </div>
      <button className="button primary wide" onClick={calculate}><Activity size={17}/> Simular impacto</button>{error && <div className="error-box">{error}</div>}
    </div>
    <div className="combined-results">
      {result ? <>
        <Comparison title="Antes do ajuste" values={result.before} subtle />
        <div className="impact-arrow"><ArrowRight size={20}/></div>
        <Comparison title="Impacto da nova operação" values={result.impact} />
        <div className="impact-arrow"><ArrowRight size={20}/></div>
        <Comparison title="Resultado acumulado" values={result.after} highlight />
      </> : <div className="combined-placeholder"><BarChart3 size={34}/><h3>Impacto em quatro dimensões</h3><p>Configure a nova operação para visualizar os valores antes, o impacto e o resultado acumulado.</p></div>}
    </div>
    <Disclaimer />
  </div>;
}

function Comparison({ title, values, subtle, highlight }) {
  return <section className={`comparison ${subtle ? 'subtle' : ''} ${highlight ? 'highlight' : ''}`}><h4>{title}</h4><div>{[['mesaTake','Mesa Take'],['mesaStop','Mesa Stop'],['realTake','Real (Mesa Take)'],['realStop','Real (Mesa Stop)']].map(([key,label]) => <span key={key}><small><SemanticLabel text={label}/></small><strong className={tone(values[key])}>{money(values[key])}</strong></span>)}</div></section>;
}

export function Disclaimer() {
  return <div className="disclaimer"><Info size={18}/><p><strong>Valores estimados.</strong> Comissões, spread, slippage, diferenças de cotação entre MNQ e USTEC e custos da corretora podem alterar o resultado real. Nenhuma sugestão é garantia de resultado.</p></div>;
}

export function HistoryPanel({ operation }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  async function toggle() {
    setOpen(!open);
    if (!loaded) { setItems(await api(`/operations/${operation.id}/adjustments`)); setLoaded(true); }
  }
  if (!operation.adjustmentCount) return null;
  return <div className="history-panel"><button onClick={toggle}><History size={15}/>{operation.adjustmentCount} {operation.adjustmentCount === 1 ? 'ajuste registrado' : 'ajustes registrados'}{open ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}</button>{open && <div className="history-list">{items.map((item, index) => {
    const mesaQuantity = item.suggestedMesaContracts ?? (item.market === 'mesa' ? item.suggestedQuantity : operation.mesaContracts);
    const realQuantity = item.suggestedRealLots ?? (item.market === 'real' ? item.suggestedQuantity : operation.realLots);
    const takeTicks = item.suggestedTakeTicks ?? item.suggestedTicks;
    const stopTicks = item.suggestedStopTicks ?? item.suggestedTicks;
    return <article key={item.id} className="reset-history-item">
      <div className="history-line"><span>AJUSTE #{items.length - index} · RESET FINANCEIRO</span><small>{dateTime(item.createdAt)}</small></div>
      <div className="history-reset-top">
        <span><small>Mercado</small><strong><SemanticLabel text={item.market === 'mesa' ? 'Mesa MNQ' : 'Conta Real USTEC'}/></strong></span>
        <span><small>Resultado informado</small><strong className={tone(item.realizedValue)}>{money(item.realizedValue)}</strong></span>
        <span><small>Resultado acumulado</small><strong className={tone(item.resultAccumulated)}>{money(item.resultAccumulated)}</strong></span>
        <span><small><SemanticLabel text="Falta para Take"/></small><strong className="pending">{money(item.takeNeeded)}</strong></span>
        <span><small><SemanticLabel text="Falta para Stop"/></small><strong className="pending">{money(item.stopNeeded)}</strong></span>
      </div>
      <div className="history-reset-body">
        <div className="history-config"><small><span>Copiar cada valor</span><Copy size={11}/></small><div className="history-copy-grid"><CopyValue compact label="Mesa" value={mesaQuantity} display={`${mesaQuantity} contratos`}/><CopyValue compact label="Real" value={realQuantity} display={`${realQuantity} lotes`}/><CopyValue compact label="Take" value={takeTicks} display={`${takeTicks} ticks`}/><CopyValue compact label="Stop" value={stopTicks} display={`${stopTicks} ticks`}/></div></div>
        <section className="history-outcome take"><header><SemanticLabel text="SE BATER TAKE"/></header><div><span><small>Nova operação</small><strong className={tone(item.takeResult)}>{money(item.takeResult)}</strong></span><span><small>Acumulado final</small><strong className={tone(item.finalTake)}>{money(item.finalTake)}</strong></span><span><small>Meta</small><strong>{money(item.metaTake)}</strong></span><span><small>Diferença</small><strong className={tone(item.takeDifference)}>{money(item.takeDifference)}</strong></span></div></section>
        <section className="history-outcome stop"><header><SemanticLabel text="SE BATER STOP"/></header><div><span><small>Nova operação</small><strong className={tone(item.stopResult)}>{money(item.stopResult)}</strong></span><span><small>Acumulado final</small><strong className={tone(item.finalStop)}>{money(item.finalStop)}</strong></span><span><small>Meta</small><strong>{money(item.metaStop)}</strong></span><span><small>Diferença</small><strong className={tone(item.stopDifference)}>{money(item.stopDifference)}</strong></span></div></section>
      </div>
    </article>;
  })}</div>}</div>;
}

export function SettingsModal({ settings, onClose, onSaved }) {
  const [form, setForm] = useState(settings);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const update = key => e => setForm({ ...form, [key]: e.target.value });
  async function save(event) {
    event.preventDefault(); setSaving(true);
    try { onSaved(await api('/settings', { method: 'PUT', body: JSON.stringify(form) })); }
    catch (err) { setError(err.message); } finally { setSaving(false); }
  }
  return <Modal title="Configurações" subtitle="Parâmetros usados em todos os cálculos." onClose={onClose}>
    <form onSubmit={save}><div className="modal-body">
      <div className="settings-section"><div className="settings-title"><div><BarChart3 size={18}/></div><span><strong>MNQ</strong><small>Micro E-mini Nasdaq-100</small></span></div><div className="form-grid"><Field label="Tamanho do tick"><input type="number" step="0.01" min="0.01" value={form.mnqTickSize} onChange={update('mnqTickSize')} /></Field><Field label="Valor do tick (US$)"><input type="number" step="0.01" min="0.01" value={form.mnqTickValue} onChange={update('mnqTickValue')} /></Field></div></div>
      <div className="settings-section"><div className="settings-title"><div><WalletCards size={18}/></div><span><strong><SemanticLabel text="USTEC / Conta Real"/></strong><small>Parâmetros da corretora</small></span></div><Field label="Valor por ponto por lote (US$)"><input type="number" step="0.01" min="0.01" value={form.ustecValuePerPoint} onChange={update('ustecValuePerPoint')} /></Field><div className="form-grid three"><Field label="Passo de lote"><input type="number" step="0.01" min="0.01" value={form.lotStep} onChange={update('lotStep')} /></Field><Field label="Lote mínimo"><input type="number" step="0.01" min="0.01" value={form.minLot} onChange={update('minLot')} /></Field><Field label="Lote máximo"><input type="number" step="0.01" min="0.01" value={form.maxLot} onChange={update('maxLot')} /></Field></div></div>
      <div className="settings-section"><div className="settings-title"><div><CircleDollarSign size={18}/></div><span><strong>Exibição</strong><small>Moeda e formatação</small></span></div><div className="form-grid"><Field label="Locale"><select value={form.locale} onChange={update('locale')}><option value="pt-BR">Português (Brasil)</option><option value="en-US">English (USA)</option></select></Field><Field label="Moeda"><select value={form.currency} disabled><option>USD</option></select></Field></div></div>
      {error && <div className="error-box">{error}</div>}
    </div><footer className="modal-footer"><button type="button" className="button ghost" onClick={onClose}>Cancelar</button><button className="button primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar configurações'}</button></footer></form>
  </Modal>;
}

export function DashboardHeader({ user, onAdd, onSettings, onLogout, operations }) {
  const totals = useMemo(() => operations.reduce((acc, operation) => ({ take: acc.take + Number(operation.mesaTake), exposure: acc.exposure + Math.abs(Number(operation.mesaStop)) }), { take: 0, exposure: 0 }), [operations]);
  return <>
    <header className="topbar"><div className="topbar-mobile"><Logo /></div><div className="breadcrumb"><span>Workspace</span><ChevronRight size={14}/><strong>Operações</strong></div><div className="top-actions"><button className="icon-button settings-trigger" onClick={onSettings} title="Configurações"><Settings size={18}/></button><div className="user-chip"><span>{user.name.slice(0,2).toUpperCase()}</span><div><strong>{user.name}</strong><small>{user.email}</small></div></div><button className="icon-button" onClick={onLogout} title="Sair"><LogOut size={18}/></button></div></header>
    <div className="page-heading"><div><span className="eyebrow"><Activity size={14}/> VISÃO GERAL</span><h1>Operações planejadas</h1><p>Calcule cenários e recupere suas metas com precisão.</p></div><button className="button primary add-button" onClick={onAdd}><Plus size={18}/> Adicionar operação</button></div>
    <div className="overview-cards">
      <div className="overview-card"><div className="overview-icon blue"><Layers3 size={20}/></div><span><small>Operações</small><strong>{operations.length}</strong><em>{operations.filter(o => o.status !== 'ENCERRADA').length} ativas</em></span></div>
      <div className="overview-card"><div className="overview-icon green"><TrendingUp size={20}/></div><span><small><SemanticLabel text="Potencial Mesa"/></small><strong className="positive">{shortMoney(totals.take)}</strong><em><SemanticLabel text="cenário de Take"/></em></span></div>
      <div className="overview-card"><div className="overview-icon red"><TrendingDown size={20}/></div><span><small><SemanticLabel text="Risco Mesa"/></small><strong className="negative">-{shortMoney(totals.exposure).replace('+','')}</strong><em><SemanticLabel text="cenário de Stop"/></em></span></div>
      <div className="overview-card"><div className="overview-icon amber"><History size={20}/></div><span><small>Ajustes</small><strong>{operations.reduce((sum, item) => sum + item.adjustmentCount, 0)}</strong><em>histórico total</em></span></div>
    </div>
  </>;
}

export function Sidebar({ onSettings, onLogout }) {
  return <aside className="sidebar"><Logo /><nav><button className="active"><BarChart3 size={19}/><span>Operações</span></button><button onClick={onSettings}><Settings size={19}/><span>Configurações</span></button></nav><div className="sidebar-bottom"><div className="safety"><ShieldCheck size={18}/><div><strong>Ambiente seguro</strong><small>Planejamento, sem execução</small></div></div><button onClick={onLogout}><LogOut size={18}/><span>Sair da conta</span></button></div></aside>;
}

export function OperationList({ operations, loading, onAdd, onEdit, onAdjust, onDelete }) {
  if (loading) return <div className="loading-state"><RefreshCw className="spin"/> Carregando suas operações…</div>;
  if (!operations.length) return <div className="empty-operations"><div className="empty-illustration"><BarChart3 size={38}/><span /></div><h2>Seu primeiro planejamento começa aqui</h2><p><SemanticLabel text="Cadastre os lotes, Take e Stop para visualizar todos os cenários automaticamente."/></p><button className="button primary" onClick={onAdd}><Plus size={18}/> Criar primeira operação</button></div>;
  return <section className="operations-card">
    <div className="table-title"><div><h2>Planejamentos</h2><p>{operations.length} {operations.length === 1 ? 'operação cadastrada' : 'operações cadastradas'}</p></div><span><span className="live-dot"/> Cálculos atualizados</span></div>
    <div className="desktop-table"><div className="table-row table-header"><span>Operação</span><span><SemanticLabel text="Mesa / Real"/></span><span>TP / SL</span><span><SemanticLabel text="Mesa Take"/></span><span><SemanticLabel text="Mesa Stop"/></span><span><SemanticLabel text="Real (Mesa Take)"/></span><span><SemanticLabel text="Real (Mesa Stop)"/></span><span>Ações</span></div>{operations.map(operation => <div className="operation-group" key={operation.id}><div className="table-row"><span className="operation-name"><strong>{operation.description}</strong><Status value={operation.status}/></span><span><strong>{operation.mesaContracts} MNQ</strong><small>{operation.realLots} USTEC</small></span><span><strong>{operation.takeTicks} ticks</strong><small>{operation.stopTicks} ticks</small></span><MoneyCell value={operation.mesaTake}/><MoneyCell value={operation.mesaStop}/><MoneyCell value={operation.realTake}/><MoneyCell value={operation.realStop}/><span className="row-actions"><button className="adjust-button" title="Ajustar operação" onClick={() => onAdjust(operation)}>A</button><button className="icon-button small" title="Editar" onClick={() => onEdit(operation)}><Edit3 size={15}/></button><button className="icon-button small danger" title="Excluir" onClick={() => onDelete(operation)}><Trash2 size={15}/></button></span></div><HistoryPanel operation={operation}/></div>)}</div>
    <div className="mobile-cards">{operations.map(operation => <article className="operation-mobile" key={operation.id}><header><div><strong>{operation.description}</strong><Status value={operation.status}/></div><div className="row-actions"><button className="adjust-button" onClick={() => onAdjust(operation)}>A</button><button className="icon-button small" onClick={() => onEdit(operation)}><Edit3 size={15}/></button><button className="icon-button small danger" onClick={() => onDelete(operation)}><Trash2 size={15}/></button></div></header><div className="mobile-limits"><span><small><SemanticLabel text="Mesa"/></small><strong>{operation.mesaContracts} MNQ</strong></span><span><small><SemanticLabel text="Real"/></small><strong>{operation.realLots} lotes</strong></span><span><small><SemanticLabel text="Take"/></small><strong>{operation.takeTicks} ticks</strong></span><span><small><SemanticLabel text="Stop"/></small><strong>{operation.stopTicks} ticks</strong></span></div><div className="mobile-results"><MoneyCell label="Mesa Take" value={operation.mesaTake}/><MoneyCell label="Mesa Stop" value={operation.mesaStop}/><MoneyCell label="Real (Mesa Take)" value={operation.realTake}/><MoneyCell label="Real (Mesa Stop)" value={operation.realStop}/></div><HistoryPanel operation={operation}/></article>)}</div>
  </section>;
}

function MoneyCell({ value, label }) { return <span className={`money-cell ${tone(value)}`}>{label && <small><SemanticLabel text={label}/></small>}<strong>{money(value)}</strong></span>; }
function Status({ value }) { return <small className={`status status-${value.toLowerCase().replaceAll(' ', '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`}>{value}</small>; }
