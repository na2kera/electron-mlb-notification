import { useAppStore } from '../store/appStore';

export const NotificationLog = () => {
  const notifications = useAppStore((state) => state.notifications);

  return (
    <div className="notification-log">
      <div className="section-header">
        <div>
          <h2>通知履歴</h2>
          <p className="muted">最近の得点通知を新しい順に表示します。（最大50件）</p>
        </div>
      </div>
      {notifications.length === 0 ? (
        <p className="muted">まだ通知はありません。</p>
      ) : (
        <ul>
          {notifications.map((notification) => (
            <li key={`${notification.teamId}-${notification.timestampIso}`}>
              <div className="notification-header">
                <span className="team-name">{notification.teamName}</span>
                <span className="timestamp">{formatTimestamp(notification.timestampIso)}</span>
              </div>
              <p className="notification-title">{notification.title}</p>
              <p className="notification-body">{notification.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}
