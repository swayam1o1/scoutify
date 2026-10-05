import { useEffect, useRef, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';

const MAX_BOARD_NAME = 80;

function CreateBoardModal({ name, setName, onCreate, onClose }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Please enter a board name.');
      return;
    }
    setBusy(true);
    setError('');
    const result = await onCreate(name);
    setBusy(false);
    if (result?.ok) onClose();
    else setError(result?.message || 'Failed to create board.');
  };

  return (
    <div className="modal-overlay modal-overlay-centered" onMouseDown={onClose}>
      <div
        className="modal-content create-board-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-board-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
        <h3 id="create-board-title" style={{ marginBottom: '6px' }}>Create Project Board</h3>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
          Give this sourcing job a name, e.g. "Tirupati Villa" or "Chennai Office".
        </p>
        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label" htmlFor="create-board-name">Board name</label>
            <input
              id="create-board-name"
              ref={inputRef}
              type="text"
              className="form-control"
              placeholder="Board name"
              maxLength={MAX_BOARD_NAME}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (error) setError('');
              }}
            />
            {error && (
              <span style={{ display: 'block', marginTop: '8px', fontSize: '13px', color: 'var(--tone-danger-text)' }}>
                {error}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Creating…' : 'Create Board'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function BoardsView({ boards, onOpenBoard }) {
  const {
    boards: boardList,
    newBoardName,
    setNewBoardName,
    createBoard,
    deleteBoard
  } = boards;
  const [filter, setFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const query = filter.trim().toLowerCase();
  const visibleBoards = query
    ? boardList.filter(board => board.name.toLowerCase().includes(query))
    : boardList;

  const closeCreate = () => {
    setShowCreate(false);
    setNewBoardName('');
  };

  return (
    <div className="dashboard-container animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px 60px' }}>
      <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
        <div>
          <h2>📁 My Project Sourcing Boards</h2>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: '4px' }}>Create and organize distinct vendor board directories for your builds.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {boardList.length > 0 && (
            <div className="board-filter">
              <Search size={15} className="board-filter-icon" aria-hidden="true" />
              <input
                type="search"
                className="form-control"
                placeholder="Search boards..."
                aria-label="Search boards"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
          )}
          <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)} style={{ padding: '9px 18px', fontSize: '14px' }}>
            <Plus size={16} /> Create Board
          </button>
        </div>
      </div>

      {showCreate && (
        <CreateBoardModal
          name={newBoardName}
          setName={setNewBoardName}
          onCreate={(name) => createBoard(name, null, { quiet: true })}
          onClose={closeCreate}
        />
      )}

      {boardList.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '60px', color: 'var(--color-text-secondary)' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📁</div>
          <h3>No Project Boards Created Yet</h3>
          <p style={{ maxWidth: '400px', margin: '8px auto 20px', fontSize: '14px' }}>
            Organize different sourcing jobs (e.g. "Tirupati Villa", "Chennai Office") and save verified vendor cards directly.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Create your first board
          </button>
        </div>
      ) : visibleBoards.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-secondary)' }}>
          <h3>No boards match "{filter.trim()}"</h3>
          <button type="button" className="btn btn-secondary" onClick={() => setFilter('')} style={{ marginTop: '16px' }}>
            Clear search
          </button>
        </div>
      ) : (
        <div className="grid-container grid-3">
          {visibleBoards.map(board => (
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
