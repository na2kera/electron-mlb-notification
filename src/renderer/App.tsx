import { useEffect } from 'react';
import { Layout } from './components/Layout';
import { TeamSelector } from './components/TeamSelector';
import { GameStatusList } from './components/GameStatusList';
import { NotificationLog } from './components/NotificationLog';
import { SettingsPanel } from './components/SettingsPanel';
import { useAppStore } from './store/appStore';

function App() {
  const init = useAppStore((state) => state.init);
  const isLoading = useAppStore((state) => state.isLoading);
  const error = useAppStore((state) => state.error);

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <Layout>
      <div className="grid">
        <section className="section full-width">
          <TeamSelector />
        </section>
        <section className="section">
          <SettingsPanel />
        </section>
        <section className="section">
          <GameStatusList />
        </section>
        <section className="section full-width">
          <NotificationLog />
        </section>
      </div>
      {isLoading && <div className="overlay">読み込み中...</div>}
      {error && <div className="overlay error">{error}</div>}
    </Layout>
  );
}

export default App;
