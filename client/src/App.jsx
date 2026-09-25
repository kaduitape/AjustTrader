import { useEffect, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { api, hasToken, setToken } from './api.js';
import {
  AdjustmentModal, AuthScreen, DashboardHeader, OperationList,
  OperationModal, SettingsModal, Sidebar,
} from './components.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [operations, setOperations] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(hasToken());
  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!hasToken()) return;
    Promise.all([api('/me'), api('/operations'), api('/settings')])
      .then(([me, ops, config]) => { setUser(me.user); setOperations(ops); setSettings(config); })
      .catch(() => setToken(null)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3400);
    return () => clearTimeout(timer);
  }, [toast]);

  async function authenticated(data) {
    setToken(data.token); setUser(data.user); setLoading(true);
    const [ops, config] = await Promise.all([api('/operations'), api('/settings')]);
    setOperations(ops); setSettings(config); setLoading(false);
  }

  function logout() { setToken(null); setUser(null); setOperations([]); setSettings(null); setDialog(null); }

  async function reload(message) {
    setOperations(await api('/operations')); setDialog(null); setToast(message);
  }

  async function remove(operation) {
    if (!window.confirm(`Excluir “${operation.description}” e todo o histórico de ajustes?`)) return;
    try { await api(`/operations/${operation.id}`, { method: 'DELETE' }); await reload('Operação excluída.'); }
    catch (error) { setToast(error.message); }
  }

  if (loading && !user) return <div className="splash"><div className="splash-mark">A</div><span>Preparando seu painel…</span></div>;
  if (!user) return <AuthScreen onAuthenticated={authenticated}/>;

  return <div className="app-shell">
    <Sidebar onSettings={() => setDialog({ type: 'settings' })} onLogout={logout}/>
    <main className="main-content">
      <DashboardHeader user={user} operations={operations} onAdd={() => setDialog({ type: 'operation' })} onSettings={() => setDialog({ type: 'settings' })} onLogout={logout}/>
      <OperationList operations={operations} loading={loading} onAdd={() => setDialog({ type: 'operation' })} onEdit={operation => setDialog({ type: 'operation', operation })} onAdjust={operation => setDialog({ type: 'adjustment', operation })} onDelete={remove}/>
      <footer className="app-footer"><span>Ajuste de Lotes</span><span>Planejamento financeiro · Sem execução de ordens</span></footer>
    </main>
    {dialog?.type === 'operation' && <OperationModal operation={dialog.operation} settings={settings} onClose={() => setDialog(null)} onSaved={() => reload(dialog.operation ? 'Operação atualizada.' : 'Planejamento criado.')}/>} 
    {dialog?.type === 'adjustment' && <AdjustmentModal operation={dialog.operation} settings={settings} onClose={() => setDialog(null)} onSaved={() => reload('Ajuste registrado no histórico.')}/>} 
    {dialog?.type === 'settings' && <SettingsModal settings={settings} onClose={() => setDialog(null)} onSaved={value => { setSettings(value); setDialog(null); setToast('Configurações atualizadas.'); }}/>} 
    {toast && <div className="toast"><CheckCircle2 size={18}/><span>{toast}</span><button onClick={() => setToast('')}><X size={15}/></button></div>}
  </div>;
}
