import { useEffect, useState } from 'react';
import { authFetch } from '../api/client';

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

  const createBoard = async (name, autoSaveVendorId = null) => {
    if (!name || !name.trim()) return;
    try {
      const res = await authFetch('/boards', { token, method: 'POST', body: { name: name.trim() } });
      const data = await res.json();
      if (res.ok) {
        setBoards(data.boards || []);
        setNewBoardName('');
        setQuickNewBoardName('');

        if (autoSaveVendorId) {
          const newBoard = data.boards.find(b => b.name.toLowerCase() === name.trim().toLowerCase());
          if (newBoard) {
            await saveVendorToBoard(newBoard._id, autoSaveVendorId);
          }
        } else {
          alert('Project board created successfully!');
        }
      } else {
        alert(data.message || 'Failed to create board.');
      }
    } catch (err) {
      console.error(err);
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
        alert('Vendor saved to project board!');
      } else {
        alert(data.message || 'Failed to save vendor.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const removeVendorFromBoard = async (boardId, vendorId) => {
    if (!confirm('Are you sure you want to remove this vendor from the board?')) return;
    try {
      const res = await authFetch(`/boards/${boardId}/vendors/${vendorId}`, { token, method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setBoards(data.boards || []);
      } else {
        alert(data.message || 'Failed to remove vendor.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deleteBoard = async (boardId) => {
    if (!confirm('Are you sure you want to delete this project board?')) return;
    try {
      const res = await authFetch(`/boards/${boardId}`, { token, method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setBoards(data.boards || []);
        if (activeBoardId === boardId) {
          setActiveBoardId(null);
        }
      } else {
        alert(data.message || 'Failed to delete board.');
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
    if (!token) { alert('Please log in to use AI Sourcing.'); return; }
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
