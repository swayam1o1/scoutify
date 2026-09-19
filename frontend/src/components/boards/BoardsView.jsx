export function BoardsView({ boards, onOpenBoard }) {
  const {
    boards: boardList,
    newBoardName,
    setNewBoardName,
    createBoard,
    deleteBoard
  } = boards;

  return (
    <div className="dashboard-container animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px 60px' }}>
      <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
        <div>
          <h2>📁 My Project Sourcing Boards</h2>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: '4px' }}>Create and organize distinct vendor board directories for your builds.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            className="form-control"
            placeholder="New Board Name..."
            value={newBoardName}
            onChange={(e) => setNewBoardName(e.target.value)}
            style={{ padding: '8px 14px', fontSize: '14px', height: 'auto', width: '200px' }}
          />
          <button className="btn btn-primary" onClick={() => createBoard(newBoardName)}>
            + Create Board
          </button>
        </div>
      </div>

      {boardList.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '60px', color: 'var(--color-text-secondary)' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📁</div>
          <h3>No Project Boards Created Yet</h3>
          <p style={{ maxWidth: '400px', margin: '8px auto 20px', fontSize: '14px' }}>
            Organize different sourcing jobs (e.g. "Tirupati Villa", "Chennai Office") and save verified vendor cards directly.
          </p>
        </div>
      ) : (
        <div className="grid-container grid-3">
          {boardList.map(board => (
            <div
              key={board._id}
              className="glass-card board-card-primary"
              onClick={() => onOpenBoard(board._id)}
              style={{ cursor: 'pointer', position: 'relative', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '180px', transition: 'transform 0.2s' }}
            >
              <button
                className="board-delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteBoard(board._id);
                }}
                style={{ position: 'absolute', top: '16px', right: '16px' }}
              >
                ✕
              </button>

              <div style={{ fontSize: '36px' }}>📁</div>
              <div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '18px' }}>{board.name}</h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                  {board.vendors?.length || 0} Sourced Vendors
                </p>
              </div>

              <button
                className="btn btn-outline"
                style={{ marginTop: 'auto', padding: '6px 12px', fontSize: '12px', justifyContent: 'center' }}
              >
                Open Sourcing Pipeline →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default BoardsView;
