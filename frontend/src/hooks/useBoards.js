import { useEffect, useState } from 'react';
import { authFetch } from '../api/client';
import { showAlert, showConfirm } from '../components/ui/dialog';

export function useBoards({ token }) {
  // Project Boards state
  const [boards, setBoards] = useState([]);
  const [activeBoardId, setActiveBoardId] = useState(null);
  const [newBoardName, setNewBoardName] = useState('');
  const [activeSaveDropdownId, setActiveSaveDropdownId] = useState(null);
  const [quickNewBoardName, setQuickNewBoardName] = useState('');

  // Board Recommendations state
  const [boardRecommendations, setBoardRecommendations] = useState([]);
  const [boardRationale, setBoardRationale] = useState('');
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);

  // Board Search states
  const [boardSearchCity, setBoardSearchCity] = useState('');
  const [boardSearchService, setBoardSearchService] = useState('');
  const [boardSearchAiQuery, setBoardSearchAiQuery] = useState('');
  const [boardSearchMode, setBoardSearchMode] = useState('standard');
  const [boardSearchResults, setBoardSearchResults] = useState([]);
  const [boardSearching, setBoardSearching] = useState(false);
  const [boardSearchTotalResults, setBoardSearchTotalResults] = useState(0);

  const fetchBoards = async () => {
    if (!token) return;
    try {
      const res = await authFetch('/boards', { token });
      const data = await res.json();
      if (res.ok) {
        setBoards(data.boards || []);
      }
    } catch (err) {
      console.error('Error fetching boards:', err);
    }
  };

  // Boards belong to the session: load them on sign-in, drop them on sign-out.
  useEffect(() => {
    if (token) {
      fetchBoards();
    } else {
      setBoards([]);
    }
  }, [token]);

  // Resolves { ok, message }. `quiet` lets a caller (e.g. the create modal) show errors inline.
  const createBoard = async (name, autoSaveVendorId = null, { quiet = false } = {}) => {
    const fail = (message) => {
      if (!quiet) showAlert(message, { tone: 'error' });
      return { ok: false, message };
    };

    if (!name || !name.trim()) return fail('Please enter a board name first.');
    try {
      const res = await authFetch('/boards', { token, method: 'POST', body: { name: name.trim() } });
      const data = await res.json();
      if (!res.ok) return fail(data.message || 'Failed to create board.');

      setBoards(data.boards || []);
      setNewBoardName('');
      setQuickNewBoardName('');

      if (autoSaveVendorId) {
        const newBoard = data.boards.find(b => b.name.toLowerCase() === name.trim().toLowerCase());
        if (newBoard) {
          await saveVendorToBoard(newBoard._id, autoSaveVendorId);
        }
      } else {
        showAlert(`"${name.trim()}" is ready. Open it to start saving vendors.`, { title: 'Board created', tone: 'success' });
      }
      return { ok: true };
    } catch (err) {
      console.error(err);
      return fail('Could not reach the server. Please try again.');
    }
  };

  const saveVendorToBoard = async (boardId, vendorId) => {
    try {
      const res = await authFetch(`/boards/${boardId}/vendors`, {
        token,
        method: 'POST',
        body: { vendorId }
      });
      const data = await res.json();
      if (res.ok) {
        setBoards(data.boards || []);
        setActiveSaveDropdownId(null);
        showAlert('Vendor saved to project board!', { tone: 'success' });
      } else {
        showAlert(data.message || 'Failed to save vendor.', { tone: 'error' });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const removeVendorFromBoard = async (boardId, vendorId) => {
    const confirmed = await showConfirm('Remove this vendor from the board?', { title: 'Remove vendor', confirmLabel: 'Remove', danger: true });
    if (!confirmed) return;
    try {
      const res = await authFetch(`/boards/${boardId}/vendors/${vendorId}`, { token, method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setBoards(data.boards || []);
      } else {
        showAlert(data.message || 'Failed to remove vendor.', { tone: 'error' });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deleteBoard = async (boardId) => {
    const confirmed = await showConfirm('This board and its saved vendors list will be deleted.', { title: 'Delete project board?', confirmLabel: 'Delete', danger: true });
    if (!confirmed) return;
    try {
      const res = await authFetch(`/boards/${boardId}`, { token, method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setBoards(data.boards || []);
        if (activeBoardId === boardId) {
          setActiveBoardId(null);
        }
      } else {
        showAlert(data.message || 'Failed to delete board.', { tone: 'error' });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBoardRecommendations = async (boardId) => {
    if (!boardId || !token) return;
    setLoadingRecommendations(true);
    try {
      const res = await authFetch(`/boards/${boardId}/recommendations`, { token });
      const data = await res.json();
      if (res.ok) {
        setBoardRecommendations(data.recommendations || []);
        setBoardRationale(data.rationale || '');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  useEffect(() => {
    if (activeBoardId) {
      fetchBoardRecommendations(activeBoardId);
    } else {
      setBoardRecommendations([]);
      setBoardRationale('');
    }
  }, [activeBoardId, boards]);

  const handleBoardSearch = async (e) => {
    if (e) e.preventDefault();
    if (!boardSearchCity.trim() && !boardSearchService.trim()) return;
    setBoardSearching(true);
    setBoardSearchResults([]);
    try {
      const queryParams = new URLSearchParams({
        city: boardSearchCity.trim(),
        service: boardSearchService.trim()
      });
      const res = await authFetch(`/search?${queryParams}`, { token });
      const data = await res.json();
      if (res.ok) {
        setBoardSearchResults(data.results || []);
        setBoardSearchTotalResults(data.totalResults || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBoardSearching(false);
    }
  };

  const handleBoardAiSearch = async (e) => {
    if (e) e.preventDefault();
    if (!boardSearchAiQuery.trim()) return;
    if (!token) { showAlert('Please log in to use AI Sourcing.'); return; }
    setBoardSearching(true);
    setBoardSearchResults([]);
    try {
      const res = await authFetch('/search/ai', {
        token,
        method: 'POST',
        body: { query: boardSearchAiQuery.trim() }
      });
      const data = await res.json();
      if (res.ok) {
        const aiResults = data.matches || data.results || [];
        setBoardSearchResults(aiResults);
        setBoardSearchTotalResults(aiResults.length);
      } else {
        console.error('AI search error:', data.message);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBoardSearching(false);
    }
  };

  return {
    boards,
    activeBoardId,
    setActiveBoardId,
    newBoardName,
    setNewBoardName,
    activeSaveDropdownId,
    setActiveSaveDropdownId,
    quickNewBoardName,
    setQuickNewBoardName,

    fetchBoards,
    createBoard,
    saveVendorToBoard,
    removeVendorFromBoard,
    deleteBoard,

    boardRecommendations,
    boardRationale,
    loadingRecommendations,

    boardSearchCity,
    setBoardSearchCity,
    boardSearchService,
    setBoardSearchService,
    boardSearchAiQuery,
    setBoardSearchAiQuery,
    boardSearchMode,
    setBoardSearchMode,
    boardSearchResults,
    boardSearching,
    boardSearchTotalResults,
    handleBoardSearch,
    handleBoardAiSearch
  };
}

export default useBoards;
