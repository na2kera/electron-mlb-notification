import { useMemo } from 'react';
import { useAppStore } from '../store/appStore';

export const GameStatusList = () => {
  const statuses = useAppStore((state) => state.statuses);
  const teams = useAppStore((state) => state.teams);

  const statusList = useMemo(() => Object.values(statuses), [statuses]);

  return (
    <div className="status-list">
      <div className="section-header">
        <div>
          <h2>試合状況</h2>
          <p className="muted">登録チームの当日試合状況とスコアを表示します。</p>
        </div>
      </div>
      {teams.length === 0 ? (
        <p className="muted">監視対象のチームを追加すると試合状況が表示されます。</p>
      ) : statusList.length === 0 ? (
        <p className="muted">データ取得中です。しばらくお待ちください。</p>
      ) : (
        <ul className="status-cards">
          {statusList.map((status) => (
            <li key={status.teamId} className={`status-card status-${status.state}`}>
              <div className="status-card-head">
                <span className="status-team">{status.teamName}</span>
                <span className="status-state">{renderStateLabel(status.state)}</span>
              </div>
              {status.linescore ? (
                <div className="score-line">
                  <span>
                    {status.linescore.home.team.abbreviation}: {status.linescore.home.runs}
                  </span>
                  <span>
                    {status.linescore.away.team.abbreviation}: {status.linescore.away.runs}
                  </span>
                </div>
              ) : null}
              <div className="status-details">
                <span>{status.linescore?.inning ? `${status.linescore.inning}回` : ''}</span>
                <span>{status.linescore?.inningState ?? ''}</span>
              </div>
              {status.message ? <p className="muted small">{status.message}</p> : null}
              <p className="timestamp">最終更新: {new Date(status.lastUpdatedIso).toLocaleTimeString()}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

function renderStateLabel(state: string) {
  switch (state) {
    case 'live':
      return '試合中';
    case 'scheduled':
      return '試合前';
    case 'final':
      return '試合終了';
    case 'idle':
      return '試合なし';
    case 'error':
      return '取得エラー';
    default:
      return state;
  }
}
