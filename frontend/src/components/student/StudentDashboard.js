import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './StudentDashboard.css';
import { API_BASE_URL } from '../../config';
import { isTokenExpired, clearAuth } from '../../utils/tokenUtils';
import Flashcards from './Flashcards';
const BATCHES = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9'];

const StudentDashboard = () => {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [score, setScore] = useState(null);
  const [error, setError] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [user, setUser] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [showScore, setShowScore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedBatchForUpdate, setSelectedBatchForUpdate] = useState(BATCHES[0]);
  const [isUpdatingBatch, setIsUpdatingBatch] = useState(false);
  const [batchModalError, setBatchModalError] = useState('');
  const [showTabWarning, setShowTabWarning] = useState(false);
  const [activeView, setActiveView] = useState('quizzes'); // 'quizzes' | 'flashcards'
  const tabSwitchCountRef = useRef(0);
  const isAutoSubmittingRef = useRef(false);
  const submitQuizRef = useRef(null);

  const fetchQuizzes = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/quizzes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setQuizzes(response.data);
    } catch (err) {
      setError('Failed to fetch quizzes. Please try again later.');
      console.error('Error fetching quizzes:', err);
    }
  }, []);

  const fetchAttempts = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/attempts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAttempts(response.data);
    } catch (err) {
      console.error('Error fetching attempts:', err);
    }
  }, []);

  const fetchUserProfile = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/students/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
      if (response.data.batch) {
        setSelectedBatchForUpdate(response.data.batch);
        setShowBatchModal(false);
        await fetchQuizzes();
        await fetchAttempts();
      } else {
        setShowBatchModal(true);
        setQuizzes([]);
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
      if (err.response && err.response.status === 401) {
        clearAuth();
        navigate('/');
      }
    }
  }, [navigate, fetchQuizzes, fetchAttempts]);

  useEffect(() => {
    // Check if user is logged in and token is still valid
    const token = localStorage.getItem('token');
    if (!token || isTokenExpired(token)) {
      clearAuth();
      navigate('/');
      return;
    }

    fetchUserProfile();
  }, [navigate, fetchUserProfile]);





  const handleLogout = () => {
    clearAuth();
    navigate('/');
  };

  const openBatchModal = () => {
    setSelectedBatchForUpdate(user?.batch || BATCHES[0]);
    setBatchModalError('');
    setShowBatchModal(true);
  };

  const handleBatchUpdate = async () => {
    if (!selectedBatchForUpdate) {
      setBatchModalError('Please select a batch');
      return;
    }
    try {
      setIsUpdatingBatch(true);
      const token = localStorage.getItem('token');
      await axios.patch(
        `${API_BASE_URL}/students/me/batch`,
        { batch: selectedBatchForUpdate },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUser((prev) => prev ? { ...prev, batch: selectedBatchForUpdate } : prev);
      setShowBatchModal(false);
      setBatchModalError('');
      await fetchQuizzes();
      await fetchAttempts();
    } catch (err) {
      console.error('Error updating batch:', err);
      setBatchModalError(err.response?.data?.detail || 'Failed to update batch');
    } finally {
      setIsUpdatingBatch(false);
    }
  };

  const handleAccessCodeSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!selectedQuiz) {
      setError('Please select a quiz first');
      setIsLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/quizzes/access`,
        { access_code: accessCode },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.message) {
        // Quiz already attempted
        setError(response.data.message);
      } else {
        // Check if the accessed quiz matches the selected quiz
        if (response.data._id !== selectedQuiz._id) {
          setError('Access code does not match the selected quiz');
          return;
        }
        setCurrentQuiz(response.data);
        // Enter fullscreen when quiz starts
        try {
          await document.documentElement.requestFullscreen();
        } catch (err) {
          console.warn('Could not enter fullscreen:', err);
        }
      }
    } catch (error) {
      console.error('Error accessing quiz:', error);
      setError(error.response?.data?.detail || 'Failed to access quiz');
    } finally {
      setIsLoading(false);
    }
  };

  const selectQuiz = (quiz) => {
    setSelectedQuiz(quiz);
    setError('');
  };



  const handleAnswerSelect = (questionIndex, answer) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionIndex]: answer
    }));
  };

  const submitQuiz = async (isTabViolation = false) => {
    if (!currentQuiz) return;

    setIsSubmitting(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const answers = currentQuiz.questions.map((q, index) => ({
        question_id: q.id || index.toString(),
        answer: selectedAnswers[index] || ''
      }));

      const response = await axios.post(
        `${API_BASE_URL}/quizzes/submit`,
        {
          quiz_id: currentQuiz._id,
          answers: answers,
          tab_violation: isTabViolation,
          tab_switch_count: tabSwitchCountRef.current
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setScore(response.data.score);
      setShowScore(true);
      await fetchAttempts();

      // If auto-submitted due to tab violation, exit fullscreen and go back
      if (isTabViolation) {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => { });
        }
        setError('Quiz auto-submitted due to tab switching violation.');
        // Reset quiz state after a brief delay so student sees what happened
        setTimeout(() => {
          setCurrentQuiz(null);
          setSelectedQuiz(null);
          setScore(null);
          setShowScore(false);
          setShowTabWarning(false);
          tabSwitchCountRef.current = 0;
          isAutoSubmittingRef.current = false;
        }, 2000);
      }
    } catch (error) {
      console.error('Error submitting quiz:', error);
      setError(error.response?.data?.detail || 'Failed to submit quiz');
      if (isTabViolation && document.fullscreenElement) {
        document.exitFullscreen().catch(() => { });
      }
    } finally {
      setIsSubmitting(false);
      if (!isTabViolation) {
        isAutoSubmittingRef.current = false;
      }
    }
  };

  // Keep ref in sync with the latest submitQuiz
  useEffect(() => {
    submitQuizRef.current = submitQuiz;
  });

  // Tab-switch & fullscreen-exit detection during quiz
  useEffect(() => {
    if (!currentQuiz || score !== null) return;

    let lastViolationTime = 0;

    const handleViolation = (reason) => {
      if (isAutoSubmittingRef.current) return;

      // Debounce: ignore violations within 500ms of each other
      // (both visibilitychange and fullscreenchange can fire for one tab switch)
      const now = Date.now();
      if (now - lastViolationTime < 500) return;
      lastViolationTime = now;

      tabSwitchCountRef.current += 1;
      console.log(`Tab violation #${tabSwitchCountRef.current}: ${reason}`);

      if (tabSwitchCountRef.current === 1) {
        // First violation — show warning
        setShowTabWarning(true);
      } else if (tabSwitchCountRef.current >= 2) {
        // Second violation — auto-submit and go back
        setShowTabWarning(false);
        isAutoSubmittingRef.current = true;
        if (submitQuizRef.current) {
          submitQuizRef.current(true);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleViolation('tab-switch');
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        handleViolation('fullscreen-exit');
      }
    };

    const handleBlur = () => {
      handleViolation('window-blur');
    };

    // Also block certain key combos
    const handleKeyDown = (e) => {
      // Block Alt+Tab hint, Cmd+Tab, etc. (we can't fully prevent OS-level, but we detect them)
      if (e.altKey && e.key === 'Tab') {
        e.preventDefault();
        handleViolation('alt-tab');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleBlur);
    };
  }, [currentQuiz, score]);

  const backToQuizList = () => {
    setCurrentQuiz(null);
    setSelectedQuiz(null);
    setScore(null);
    setError('');
    setShowTabWarning(false);
    tabSwitchCountRef.current = 0;
    isAutoSubmittingRef.current = false;
    // Exit fullscreen if active
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => { });
    }
  };

  if (error && !currentQuiz) {
    return (
      <div className="student-dashboard">
        <nav className="dashboard-nav">
          <h1>TestifyAI - Student Dashboard</h1>
          <button className="logout-button" onClick={handleLogout}>Logout</button>
        </nav>
        <div className="dashboard-content">
          <div className="error">{error}</div>
          <button className="back-btn" onClick={() => setError('')}>Back to Quizzes</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="student-dashboard">
        <nav className="dashboard-nav">
          <div className="nav-brand">TestifyAI</div>
          <div className="nav-tabs">
            <button
              className={`nav-tab ${activeView === 'quizzes' ? 'active' : ''}`}
              onClick={() => setActiveView('quizzes')}
            >
              📝 Quizzes
            </button>
            <button
              className={`nav-tab ${activeView === 'flashcards' ? 'active' : ''}`}
              onClick={() => setActiveView('flashcards')}
            >
              🃏 Flashcards
            </button>
          </div>
          <div className="user-info">
            {user && (
              <>
                <span>Welcome, {user.name}</span>
                <span className="badge">Batch: {user.batch || 'Not set'}</span>
                <button className="manage-batch-btn" onClick={openBatchModal}>
                  Update Batch
                </button>
              </>
            )}
            <button className="logout-button" onClick={handleLogout}>Logout</button>
          </div>
        </nav>
        <div className="dashboard-content">
          {activeView === 'flashcards' ? (
            <Flashcards />
          ) : (
          !currentQuiz ? (
            <div className="quiz-list-section">
              <h2>Available Quizzes</h2>

              {selectedQuiz ? (
                <div className="access-code-form">
                  <h3>Enter Access Code for: {selectedQuiz.title}</h3>
                  <p className="quiz-description">{selectedQuiz.description}</p>
                  <form onSubmit={handleAccessCodeSubmit}>
                    <input
                      type="text"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                      placeholder="Enter access code"
                      className="access-code-input"
                    />
                    <div className="form-actions">
                      <button type="submit" className="access-code-btn" disabled={isLoading}>
                        {isLoading ? 'Starting...' : 'Start Quiz'}
                      </button>
                      <button
                        type="button"
                        className="cancel-btn"
                        onClick={() => setSelectedQuiz(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                  {error && <div className="error">{error}</div>}
                </div>
              ) : (
                <div className="quiz-list">
                  {quizzes.map((quiz, index) => (
                    <div key={index} className="quiz-card">
                      <h3>{quiz.title}</h3>
                      <p className="quiz-description">{quiz.description}</p>
                      <p>Number of questions: {quiz.questions.length}</p>
                      <p>Type: {quiz.quiz_type}</p>
                      <button
                        className="start-quiz-btn"
                        onClick={() => selectQuiz(quiz)}
                      >
                        Attempt Quiz
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Previous Attempts */}
              {attempts.length > 0 && (
                <div className="attempts-section">
                  <h3>Your Previous Attempts</h3>
                  <div className="attempts-list">
                    {attempts.map((attempt, index) => {
                      // Find the quiz title from the quizzes list
                      const quiz = quizzes.find(q => q._id === attempt.quiz_id);
                      return (
                        <div key={index} className="attempt-card">
                          <h4>{quiz ? quiz.title : `Quiz ID: ${attempt.quiz_id}`}</h4>
                          <p>Score: {attempt.score}%</p>
                          <p>Submitted: {new Date(attempt.submitted_at).toLocaleString()}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="quiz-section">
              <button className="back-btn" onClick={backToQuizList}>
                Back to Quiz List
              </button>
              <h2>{currentQuiz.title}</h2>
              <p className="quiz-description">{currentQuiz.description}</p>

              {currentQuiz.questions.map((question, qIndex) => (
                <div key={qIndex} className="question">
                  <p className="question-text">{qIndex + 1}. {question.text}</p>
                  <div className="options">
                    {question.options && question.options.map((option, oIndex) => (
                      <div key={oIndex} className="option">
                        <input
                          type="radio"
                          id={`q${qIndex}-o${oIndex}`}
                          name={`question-${qIndex}`}
                          value={option}
                          checked={selectedAnswers[qIndex] === option}
                          onChange={(e) => handleAnswerSelect(qIndex, e.target.value)}
                          disabled={score !== null}
                        />
                        <label htmlFor={`q${qIndex}-o${oIndex}`}>{option}</label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {showScore ? (
                <div className="score-section">
                  <h3>Your Score: {score.toFixed(2)}%</h3>
                  <button className="try-again-btn" onClick={backToQuizList}>
                    Back to Quiz List
                  </button>
                </div>
              ) : (
                <button
                  className="submit-btn"
                  onClick={() => submitQuiz()}
                  disabled={Object.keys(selectedAnswers).length !== currentQuiz.questions.length || isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Quiz'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      {showTabWarning && (
        <div className="tab-warning-backdrop">
          <div className="tab-warning-modal">
            <div className="tab-warning-icon">⚠️</div>
            <h2>Warning: Tab Switch Detected!</h2>
            <p>You switched away from the quiz or exited fullscreen. This has been recorded.</p>
            <p className="tab-warning-bold">If you do this again, your quiz will be automatically submitted with your current answers and you will be redirected.</p>
            <button
              className="tab-warning-btn"
              onClick={async () => {
                setShowTabWarning(false);
                // Re-enter fullscreen
                try {
                  await document.documentElement.requestFullscreen();
                } catch (err) {
                  console.warn('Could not re-enter fullscreen:', err);
                }
              }}
            >
              I Understand — Continue Quiz
            </button>
          </div>
        </div>
      )}
      {showBatchModal && (
        <div className="batch-modal-backdrop">
          <div className="batch-modal">
            <h2>Select Your Batch</h2>
            <p>Please choose your current batch (F1 - F9) to continue.</p>
            <select
              value={selectedBatchForUpdate}
              onChange={(e) => setSelectedBatchForUpdate(e.target.value)}
            >
              {BATCHES.map((batch) => (
                <option key={batch} value={batch}>
                  {batch}
                </option>
              ))}
            </select>
            {batchModalError && <p className="modal-error">{batchModalError}</p>}
            <div className="batch-modal-actions">
              <button
                className="primary-btn"
                onClick={handleBatchUpdate}
                disabled={isUpdatingBatch}
              >
                {isUpdatingBatch ? 'Saving...' : 'Save Batch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default StudentDashboard; 