import { FormEvent, useCallback } from 'react';
import { useAppStore } from '../store/appStore';

export const TeamSelector = () => {
  const searchQuery = useAppStore((state) => state.searchQuery);
  const searchResults = useAppStore((state) => state.searchResults);
  const teams = useAppStore((state) => state.teams);
  const setSearchQuery = useAppStore((state) => state.setSearchQuery);
  const searchTeams = useAppStore((state) => state.searchTeams);
  const addTeam = useAppStore((state) => state.addTeam);
  const removeTeam = useAppStore((state) => state.removeTeam);
  const isSearching = useAppStore((state) => state.isSearching);

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void searchTeams(searchQuery);
    },
    [searchQuery, searchTeams]
  );

  return (
    <div className="team-selector">
      <div className="section-header">
        <div>
          <h2>チーム選択</h2>
          <p className="muted">キーワードで MLB チームを検索し、通知対象に追加します。</p>
        </div>
      </div>
      <form className="team-search" onSubmit={onSubmit}>
        <input
          className="team-search-input"
          type="text"
          placeholder="チーム名や略称で検索"
          value={searchQuery}
          onChange={(event) => {
            const value = event.target.value;
            setSearchQuery(value);
          }}
        />
        <button type="submit" className="primary-btn">
          {isSearching ? '検索中...' : '検索'}
        </button>
      </form>

      <div className="team-lists">
        <div className="team-list">
          <h3>検索結果</h3>
          {isSearching ? (
            <p className="muted">検索中です...</p>
          ) : searchResults.length === 0 ? (
            <p className="muted">該当するチームが見つかりません。</p>
          ) : (
            <ul>
              {searchResults.map((team) => {
                const alreadyAdded = teams.some((selected) => selected.teamId === team.id);
                return (
                  <li key={team.id}>
                    <div>
                      <span className="team-name">
                        {team.name} <span className="abbr">({team.abbreviation})</span>
                      </span>
                      <span className="subtext">{team.locationName}</span>
                    </div>
                    <button
                      type="button"
                      className="secondary-btn"
                      disabled={alreadyAdded}
                      onClick={() => void addTeam(team)}
                    >
                      {alreadyAdded ? '追加済み' : '追加'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="team-list">
          <h3>監視中のチーム</h3>
          {teams.length === 0 ? (
            <p className="muted">まだチームが登録されていません。</p>
          ) : (
            <ul>
              {teams.map((team) => (
                <li key={team.teamId}>
                  <div>
                    <span className="team-name">
                      {team.teamName} <span className="abbr">({team.abbreviation})</span>
                    </span>
                    <span className="subtext">追加日: {new Date(team.addedAtIso).toLocaleString()}</span>
                  </div>
                  <button
                    type="button"
                    className="danger-btn"
                    onClick={() => void removeTeam(team.teamId)}
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
