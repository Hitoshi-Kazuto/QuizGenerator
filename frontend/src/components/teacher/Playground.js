import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../config';
import './Playground.css';

/* ── WS URL helper ─────────────────────────────────────── */
const WS_BASE = API_BASE_URL.replace(/^http/, 'ws');

/* ── Custom question form defaults ─────────────────────── */
const EMPTY_CUSTOM_Q = {
  text: '',
  type: 'mcq',
  difficulty: 'medium',
  options: ['', '', '', ''],
  correct_answer: '',
};

/* ================================================================
   Playground component
   ================================================================ */
const Playground = () => {
  const [view, setView] = useState('lobby'); // 'lobby' | 'room'
  const [joinRoomId, setJoinRoomId] = useState('');
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [roomState, setRoomState] = useState(null);

  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');

  // Contribution text
  const [contributionText, setContributionText] = useState('');

  // Generation settings
  const [genType, setGenType] = useState('mcq');
  const [genDifficulty, setGenDifficulty] = useState('medium');
  const [genNumQ, setGenNumQ] = useState(10);
  const [isGenerating, setIsGenerating] = useState(false);

  // Custom question form
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customQ, setCustomQ] = useState({ ...EMPTY_CUSTOM_Q });

  // Finalize form
  const [showFinalizeForm, setShowFinalizeForm] = useState(false);
  const [finalizeTitle, setFinalizeTitle] = useState('');
  const [finalizeDesc, setFinalizeDesc] = useState('');
  const [finalizeBatches, setFinalizeBatches] = useState([]);
  const [teacherBatches, setTeacherBatches] = useState([]);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [finalizedCode, setFinalizedCode] = useState(null);

  // Status messages
  const [statusMsg, setStatusMsg] = useState('');

  const wsRef = useRef(null);
  const reconnectRef = useRef(false);

  // ── fetch teacher batches for finalize form ────────────────
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    axios
      .get(`${API_BASE_URL}/teachers/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setTeacherBatches(r.data.batches || []))
      .catch(() => {});
  }, []);

  // ── WebSocket connect ──────────────────────────────────────
  const connectWs = useCallback((roomId) => {
    if (wsRef.current) wsRef.current.close();

    const token = localStorage.getItem('token');
    const ws = new WebSocket(`${WS_BASE}/playground/ws/${roomId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ event: 'join', token }));
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        handleServerEvent(msg);
      } catch {}
    };

    ws.onerror = () => setError('WebSocket connection error. Please refresh.');
    ws.onclose = () => {
      if (!reconnectRef.current) setStatusMsg('Disconnected from room.');
    };
  }, []);

  const handleServerEvent = (msg) => {
    const { event, data } = msg;
    switch (event) {
      case 'room_state':
        setRoomState(data);
        break;
      case 'teacher_joined':
        setStatusMsg(`${data.name} joined the room.`);
        break;
      case 'teacher_left':
        setStatusMsg(`${data.name} left the room.`);
        break;
      case 'generating':
        setIsGenerating(true);
        setStatusMsg('AI is generating questions…');
        break;
      case 'questions_generated':
        setIsGenerating(false);
        setStatusMsg(`✓ ${data.count} new questions added to the pool.`);
        break;
      case 'question_toggled':
        // handled via room_state update
        break;
      case 'quiz_finalized':
        setFinalizedCode(data.access_code);
        setShowFinalizeForm(false);
        setStatusMsg(`Quiz "${data.title}" finalized! Access code: ${data.access_code}`);
        break;
      case 'error':
        setIsGenerating(false);
        setError(typeof data === 'string' ? data : 'An error occurred.');
        break;
      default:
        break;
    }
  };

  // ── Cleanup WS on unmount ──────────────────────────────────
  useEffect(() => {
    return () => {
      reconnectRef.current = true;
      wsRef.current?.close();
    };
  }, []);

  // ── Create room ────────────────────────────────────────────
  const createRoom = async () => {
    setError('');
    setIsCreating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/playground/create`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const roomId = response.data.room_id;
      setActiveRoomId(roomId);
      setView('room');
      connectWs(roomId);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create room. Make sure you are logged in as a teacher.');
    } finally {
      setIsCreating(false);
    }
  };

  // ── Join room ──────────────────────────────────────────────
  const joinRoom = () => {
    if (!joinRoomId.trim()) {
      setError('Please enter a room code.');
      return;
    }
    setError('');
    setIsJoining(true);
    const roomId = joinRoomId.trim().toUpperCase();
    setActiveRoomId(roomId);
    setView('room');
    connectWs(roomId);
    setIsJoining(false);
  };

  // ── WS send helpers ────────────────────────────────────────
  const wsSend = (payload) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    } else {
      setError('Not connected to room. Please refresh.');
    }
  };

  const submitContribution = () => {
    if (!contributionText.trim()) return;
    wsSend({ event: 'add_text', data: { text: contributionText.trim() } });
    setContributionText('');
  };

  const triggerGeneration = () => {
    setError('');
    wsSend({
      event: 'generate',
      data: { quiz_type: genType, difficulty: genDifficulty, num_questions: genNumQ },
    });
  };

  const toggleQuestion = (qId) => {
    wsSend({ event: 'toggle_question', data: { question_id: qId } });
  };

  const removeQuestion = (qId) => {
    wsSend({ event: 'remove_question', data: { question_id: qId } });
  };

  // ── Custom question form ───────────────────────────────────
  const submitCustomQuestion = () => {
    const { text, type, difficulty, options, correct_answer } = customQ;
    if (!text.trim()) { setError('Question text is required.'); return; }
    const nonEmptyOptions = options.filter(o => o.trim());
    if (nonEmptyOptions.length < 2) { setError('At least 2 options are required.'); return; }
    if (!correct_answer.trim()) { setError('Correct answer is required.'); return; }

    wsSend({
      event: 'add_custom_question',
      data: {
        question: {
          text: text.trim(),
          type,
          difficulty,
          options: nonEmptyOptions,
          correct_answer: correct_answer.trim(),
        },
      },
    });
    setCustomQ({ ...EMPTY_CUSTOM_Q });
    setShowCustomForm(false);
  };

  // ── Finalize ───────────────────────────────────────────────
  const finalizeQuiz = async () => {
    if (!finalizeTitle.trim()) { setError('Quiz title is required.'); return; }
    if (!finalizeBatches.length) { setError('Select at least one batch.'); return; }
    setError('');
    setIsFinalizing(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_BASE_URL}/playground/finalize`,
        {
          room_id: activeRoomId,
          title: finalizeTitle,
          description: finalizeDesc,
          batches: finalizeBatches,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to finalize quiz.');
    } finally {
      setIsFinalizing(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────
  const toggleFinalizeBatch = (b) =>
    setFinalizeBatches(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]);

  const selectedIds = new Set(roomState?.selected_question_ids || []);
  const allQuestions = roomState?.questions || [];
  const selectedCount = allQuestions.filter(q => selectedIds.has(q.id)).length;

  // =============================================================
  // RENDER
  // =============================================================

  if (view === 'lobby') {
    return (
      <div className="pg-root">
        <div className="pg-lobby">
          <div className="pg-lobby-header">
            <p className="pg-eyebrow">Collaborative</p>
            <h2 className="pg-title">Quiz Playground</h2>
            <p className="pg-subtitle">
              Create a room and invite other teachers to co-build a quiz in real time.
              Contribute notes, generate questions, curate the pool, and publish together.
            </p>
          </div>

          {error && <div className="pg-error">⚠ {error}</div>}

          <div className="pg-lobby-cards">
            {/* Create */}
            <div className="pg-lobby-card">
              <div className="pg-lobby-card-icon">✦</div>
              <h3>Create a Room</h3>
              <p>Start a new collaborative session and get a room code to share.</p>
              <button
                className="pg-primary-btn"
                onClick={createRoom}
                disabled={isCreating}
              >
                {isCreating ? 'Creating…' : 'Create New Room'}
              </button>
            </div>

            {/* Join */}
            <div className="pg-lobby-card">
              <div className="pg-lobby-card-icon">⇢</div>
              <h3>Join a Room</h3>
              <p>Enter a room code shared by a colleague to collaborate together.</p>
              <div className="pg-join-row">
                <input
                  className="pg-code-input"
                  placeholder="Room code (e.g. A3F9B2C1)"
                  value={joinRoomId}
                  onChange={e => setJoinRoomId(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && joinRoom()}
                />
                <button
                  className="pg-primary-btn"
                  onClick={joinRoom}
                  disabled={isJoining}
                >
                  {isJoining ? 'Joining…' : 'Join'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Room View ──────────────────────────────────────────── */
  return (
    <div className="pg-root">
      {/* Top bar */}
      <div className="pg-topbar">
        <div className="pg-topbar-left">
          <button className="pg-back-btn" onClick={() => { setView('lobby'); wsRef.current?.close(); }}>
            ← Leave Room
          </button>
          <div className="pg-room-id-badge">
            Room: <strong>{activeRoomId}</strong>
          </div>
        </div>
        <div className="pg-presence">
          {(roomState?.teachers || []).map(t => (
            <div key={t.id} className="pg-presence-pill">
              <span className="pg-presence-dot" />
              {t.name}
            </div>
          ))}
        </div>
      </div>

      {error && <div className="pg-error pg-error-room">⚠ {error} <button onClick={() => setError('')}>✕</button></div>}
      {statusMsg && <div className="pg-status">{statusMsg}</div>}

      <div className="pg-room-layout">
        {/* ── LEFT: Contribute + Generation settings ─────────── */}
        <aside className="pg-panel pg-contribute-panel">
          <h3 className="pg-panel-title">Your Contribution</h3>
          <p className="pg-panel-hint">Paste your notes or topic content here. Each teacher contributes independently.</p>
          <textarea
            className="pg-textarea"
            value={contributionText}
            onChange={e => setContributionText(e.target.value)}
            placeholder="Paste notes, article text, textbook excerpts…"
            rows={7}
          />
          <button
            className="pg-secondary-btn"
            onClick={submitContribution}
            disabled={!contributionText.trim()}
          >
            Add My Content ↑
          </button>

          {/* Contributors list */}
          {(roomState?.contributions || []).length > 0 && (
            <div className="pg-contributions-list">
              <p className="pg-contrib-label">Contributions so far</p>
              {(roomState?.contributions || []).map(c => (
                <div key={c.id} className="pg-contrib-item">
                  <span className="pg-contrib-name">{c.teacher_name}</span>
                  <span className="pg-contrib-chars">{c.text.length} chars</span>
                </div>
              ))}
            </div>
          )}

          <div className="pg-divider" />

          {/* Generation settings */}
          <h3 className="pg-panel-title">Generate Questions</h3>
          <div className="pg-gen-settings">
            <label className="pg-gen-label">
              Type
              <select className="pg-gen-select" value={genType} onChange={e => setGenType(e.target.value)}>
                <option value="mcq">Multiple Choice</option>
                <option value="true_false">True / False</option>
                <option value="multi_answer">Multi-Select</option>
              </select>
            </label>
            <label className="pg-gen-label">
              Difficulty
              <select className="pg-gen-select" value={genDifficulty} onChange={e => setGenDifficulty(e.target.value)}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </label>
            <label className="pg-gen-label">
              # Questions
              <div className="pg-num-chips">
                {[10, 15, 20].map(n => (
                  <button
                    key={n}
                    className={`pg-num-chip ${genNumQ === n ? 'active' : ''}`}
                    onClick={() => setGenNumQ(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </label>
          </div>
          <button
            className="pg-primary-btn pg-gen-btn"
            onClick={triggerGeneration}
            disabled={isGenerating || !(roomState?.contributions || []).length}
          >
            {isGenerating ? (
              <><span className="pg-spinner" /> Generating…</>
            ) : (
              '✦ Generate Questions'
            )}
          </button>
        </aside>

        {/* ── CENTER: Question pool ──────────────────────────── */}
        <main className="pg-panel pg-pool-panel">
          <div className="pg-pool-header">
            <h3 className="pg-panel-title">
              Question Pool
              <span className="pg-pool-count">{allQuestions.length} total · {selectedCount} selected</span>
            </h3>
            <button className="pg-add-custom-btn" onClick={() => setShowCustomForm(s => !s)}>
              {showCustomForm ? '✕ Cancel' : '+ Add Custom'}
            </button>
          </div>

          {/* Custom question form */}
          {showCustomForm && (
            <div className="pg-custom-form">
              <textarea
                className="pg-textarea"
                value={customQ.text}
                onChange={e => setCustomQ(q => ({ ...q, text: e.target.value }))}
                placeholder="Question text…"
                rows={2}
              />
              <div className="pg-custom-options">
                {customQ.options.map((opt, i) => (
                  <input
                    key={i}
                    className="pg-custom-option-input"
                    placeholder={`Option ${String.fromCharCode(65 + i)}`}
                    value={opt}
                    onChange={e => {
                      const opts = [...customQ.options];
                      opts[i] = e.target.value;
                      setCustomQ(q => ({ ...q, options: opts }));
                    }}
                  />
                ))}
              </div>
              <input
                className="pg-custom-option-input"
                placeholder="Correct answer (must match one option)"
                value={customQ.correct_answer}
                onChange={e => setCustomQ(q => ({ ...q, correct_answer: e.target.value }))}
              />
              <div className="pg-custom-form-actions">
                <button className="pg-primary-btn" onClick={submitCustomQuestion}>Add Question</button>
              </div>
            </div>
          )}

          {/* Question cards */}
          {allQuestions.length === 0 ? (
            <div className="pg-empty-pool">
              <p>No questions yet.</p>
              <p>Add your content on the left and click Generate Questions.</p>
            </div>
          ) : (
            <div className="pg-question-list">
              {allQuestions.map((q) => {
                const isSelected = selectedIds.has(q.id);
                return (
                  <div
                    key={q.id}
                    className={`pg-q-card ${isSelected ? 'selected' : 'deselected'}`}
                    onClick={() => toggleQuestion(q.id)}
                  >
                    <div className="pg-q-card-top">
                      <div className="pg-q-check">{isSelected ? '✓' : '○'}</div>
                      <div className="pg-q-meta">
                        <span className={`pg-q-badge pg-q-type-${q.type}`}>{q.type?.replace('_', ' ').toUpperCase()}</span>
                        <span className={`pg-q-badge pg-q-diff-${q.difficulty}`}>{q.difficulty?.toUpperCase()}</span>
                        <span className="pg-q-author">by {q.added_by_name}</span>
                        {q.source === 'custom' && <span className="pg-q-badge pg-q-custom">CUSTOM</span>}
                      </div>
                      <button
                        className="pg-q-remove-btn"
                        onClick={(e) => { e.stopPropagation(); removeQuestion(q.id); }}
                        title="Remove question"
                      >
                        ✕
                      </button>
                    </div>
                    <p className="pg-q-text">{q.text}</p>
                    {q.options && (
                      <div className="pg-q-options">
                        {q.options.map((opt, i) => (
                          <span key={i} className={`pg-q-option ${opt === q.correct_answer || (q.correct_answers || []).includes(opt) ? 'correct' : ''}`}>
                            {String.fromCharCode(65 + i)}. {opt}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {/* ── RIGHT: Finalize ───────────────────────────────── */}
        <aside className="pg-panel pg-finalize-panel">
          <h3 className="pg-panel-title">Finalize Quiz</h3>
          <p className="pg-panel-hint">
            {selectedCount} question{selectedCount !== 1 ? 's' : ''} selected.
            Uncheck questions in the pool to exclude them.
          </p>

          {finalizedCode ? (
            <div className="pg-finalized-box">
              <div className="pg-finalized-icon">🎉</div>
              <p className="pg-finalized-label">Quiz Published!</p>
              <div className="pg-finalized-code">{finalizedCode}</div>
              <p className="pg-finalized-hint">Share this access code with students.</p>
            </div>
          ) : showFinalizeForm ? (
            <div className="pg-finalize-form">
              <input
                className="pg-finalize-input"
                placeholder="Quiz title"
                value={finalizeTitle}
                onChange={e => setFinalizeTitle(e.target.value)}
              />
              <textarea
                className="pg-textarea pg-finalize-desc"
                placeholder="Description (optional)"
                value={finalizeDesc}
                onChange={e => setFinalizeDesc(e.target.value)}
                rows={2}
              />
              <p className="pg-finalize-batch-label">Share with batches</p>
              <div className="pg-batch-chips">
                {teacherBatches.map(b => (
                  <button
                    key={b}
                    className={`pg-batch-chip ${finalizeBatches.includes(b) ? 'selected' : ''}`}
                    onClick={() => toggleFinalizeBatch(b)}
                  >
                    {b}
                  </button>
                ))}
              </div>
              <div className="pg-finalize-actions">
                <button
                  className="pg-primary-btn"
                  onClick={finalizeQuiz}
                  disabled={isFinalizing || selectedCount === 0}
                >
                  {isFinalizing ? 'Saving…' : `Publish Quiz (${selectedCount}q)`}
                </button>
                <button className="pg-ghost-btn" onClick={() => setShowFinalizeForm(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <button
              className="pg-primary-btn pg-finalize-open-btn"
              disabled={selectedCount === 0}
              onClick={() => setShowFinalizeForm(true)}
            >
              Finalize & Publish →
            </button>
          )}
        </aside>
      </div>
    </div>
  );
};

export default Playground;
