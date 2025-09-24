import { ChangeEvent } from 'react';
import { useAppStore } from '../store/appStore';

const POLLING_OPTIONS = [15, 30, 45, 60, 90];

export const SettingsPanel = () => {
  const settings = useAppStore((state) => state.settings);
  const toggleNotifications = useAppStore((state) => state.toggleNotifications);
  const toggleSound = useAppStore((state) => state.toggleSound);
  const setPollingInterval = useAppStore((state) => state.setPollingInterval);

  if (!settings) {
    return (
      <div className="settings-panel">
        <h2>設定</h2>
        <p className="muted">設定情報を読み込み中です。</p>
      </div>
    );
  }

  const onPollingChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = Number(event.target.value);
    void setPollingInterval(value);
  };

  return (
    <div className="settings-panel">
      <div className="section-header">
        <div>
          <h2>設定</h2>
          <p className="muted">通知やポーリング間隔などの設定を変更できます。</p>
        </div>
      </div>
      <div className="settings-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={settings.notificationsEnabled}
            onChange={(event) => void toggleNotifications(event.target.checked)}
          />
          通知を有効にする
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={settings.soundEnabled}
            onChange={(event) => void toggleSound(event.target.checked)}
            disabled={!settings.notificationsEnabled}
          />
          得点通知にサウンドを鳴らす
        </label>
      </div>
      <div className="settings-group">
        <label htmlFor="polling-select" className="setting-label">
          ポーリング間隔
        </label>
        <select id="polling-select" value={settings.pollingIntervalSec} onChange={onPollingChange}>
          {POLLING_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option} 秒
            </option>
          ))}
        </select>
      </div>
      <div className="settings-summary">
        <p className="muted small">
          登録チーム数: <strong>{settings.teams.length}</strong>
        </p>
      </div>
    </div>
  );
};
