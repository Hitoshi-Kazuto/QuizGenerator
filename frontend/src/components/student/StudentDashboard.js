import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './StudentDashboard.css';

const API_BASE_URL = 'https://quizgenerator-6qge.onrender.com';

const StudentDashboard = () => {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(null);
  const [error, setError] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [user, setUser] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showScore, setShowScore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState({});

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
      return;
    }

    // Get user profile
    const fetchUserProfile = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/students/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUser(response.data);
      } catch (err) {
        console.error('Error fetching user profile:', err);
        if (err.response && err.response.status === 401) {
          navigate('/');
        }
      }
    };

    fetchUserProfile();
    fetchQuizzes();
    fetchAttempts();
  }, [navigate]);

  const fetchQuizzes = async () => {
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
  };

  const fetchAttempts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/attempts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAttempts(response.data);
    } catch (err) {
      console.error('Error fetching attempts:', err);
    }
  };

  const handleLogout = () => {
    // Clear any stored user data/tokens
    localStorage.removeItem('token');
    localStorage.removeItem('userType');
    navigate('/');
  };

  const handleAccessCodeSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

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
        setShowQuiz(true);
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

  const startQuiz = async () => {
    if (!selectedQuiz) {
      setError('Please select a quiz first');
      return;
    }
    
    // Show access code form for the selected quiz
    setError('');
  };

  const handleAnswerSelect = (questionIndex, answer) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionIndex]: answer
    }));
  };

  const submitQuiz = async () => {
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
          answers: answers
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setScore(response.data.score);
      setShowScore(true);
      setShowQuiz(false);
      await fetchAttempts(); // Refresh attempts after submission
    } catch (error) {
      console.error('Error submitting quiz:', error);
      setError(error.response?.data?.detail || 'Failed to submit quiz');
    } finally {
      setIsSubmitting(false);
    }
  };

  const backToQuizList = () => {
    setCurrentQuiz(null);
    setSelectedQuiz(null);
    setAnswers({});
    setScore(null);
    setError('');
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
    <div className="student-dashboard">
      <nav className="dashboard-nav">
        <h1>TestifyAI - Student Dashboard</h1>
        <div className="user-info">
          {user && <span>Welcome, {user.name}</span>}
          <button className="logout-button" onClick={handleLogout}>Logout</button>
        </div>
      </nav>
      <div className="dashboard-content">
        {!currentQuiz ? (
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
                    <button type="submit" className="access-code-btn">Start Quiz</button>
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
                onClick={submitQuiz}
                disabled={Object.keys(selectedAnswers).length !== currentQuiz.questions.length}
              >
                Submit Quiz
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard; 