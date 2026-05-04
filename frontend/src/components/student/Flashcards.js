import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../config';
import './Flashcards.css';

const Flashcards = () => {
  const [text, setText] = useState('');
  const [numCards, setNumCards] = useState(8);
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [generated, setGenerated] = useState(false);

  const generateFlashcards = async () => {
    if (!text.trim()) {
      setError('Please enter some notes or topic text to generate flashcards.');
      return;
    }
    setError('');
    setIsLoading(true);
    setGenerated(false);
    setCards([]);
    setCurrentIndex(0);
    setIsFlipped(false);

    try {
      const response = await axios.post(`${API_BASE_URL}/generate-flashcards`, {
        text: text.trim(),
        num_cards: numCards,
      });

      if (response.data.flashcards && response.data.flashcards.length > 0) {
        setCards(response.data.flashcards);
        setGenerated(true);
        setCurrentIndex(0);
        setIsFlipped(false);
      } else {
        setError(response.data.error || 'Could not generate flashcards. Please provide more detailed notes.');
      }
    } catch (err) {
      console.error('Flashcard generation error:', err);
      setError('Failed to generate flashcards. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFlip = () => setIsFlipped(f => !f);

  const goNext = () => {
    setIsFlipped(false);
    setTimeout(() => setCurrentIndex(i => Math.min(i + 1, cards.length - 1)), 150);
  };

  const goPrev = () => {
    setIsFlipped(false);
    setTimeout(() => setCurrentIndex(i => Math.max(i - 1, 0)), 150);
  };

  const resetAll = () => {
    setCards([]);
    setText('');
    setGenerated(false);
    setCurrentIndex(0);
    setIsFlipped(false);
    setError('');
  };

  const progress = cards.length > 0 ? ((currentIndex + 1) / cards.length) * 100 : 0;

  return (
    <div className="flashcards-root">
      <div className="fc-header">
        <div className="fc-header-text">
          <p className="fc-eyebrow">AI Study Cards</p>
          <h2 className="fc-title">Flashcards</h2>
          <p className="fc-subtitle">
            Paste your notes below and let AI generate focused concept cards to help you revise.
          </p>
        </div>
      </div>

      {!generated ? (
        <div className="fc-input-panel">
          <div className="fc-textarea-wrap">
            <textarea
              className="fc-textarea"
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Paste your notes, textbook content, or describe the topic you want to revise…"
              rows={8}
              disabled={isLoading}
            />
            <div className="fc-char-count">{text.length} chars</div>
          </div>

          {error && (
            <div className="fc-error">
              <span>⚠</span> {error}
            </div>
          )}

          <div className="fc-controls">
            <div className="fc-num-control">
              <span className="fc-num-label">Number of cards</span>
              <div className="fc-num-chips">
                {[5, 6, 7, 8, 9, 10].map(n => (
                  <button
                    key={n}
                    className={`fc-num-chip ${numCards === n ? 'active' : ''}`}
                    onClick={() => setNumCards(n)}
                    disabled={isLoading}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="fc-generate-btn"
              onClick={generateFlashcards}
              disabled={isLoading || !text.trim()}
            >
              {isLoading ? (
                <>
                  <span className="fc-spinner" />
                  Generating cards…
                </>
              ) : (
                <>✦ Generate Flashcards</>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="fc-deck-panel">
          {/* Progress bar */}
          <div className="fc-progress-wrap">
            <div className="fc-progress-bar">
              <div className="fc-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="fc-counter">{currentIndex + 1} / {cards.length}</span>
          </div>

          {/* Card */}
          <div
            className={`fc-card-scene`}
            onClick={handleFlip}
            title="Click to flip"
          >
            <div className={`fc-card ${isFlipped ? 'flipped' : ''}`}>
              <div className="fc-card-face fc-card-front">
                <div className="fc-card-label">TERM</div>
                <div className="fc-card-content">{cards[currentIndex]?.term}</div>
                <div className="fc-flip-hint">Click to reveal definition →</div>
              </div>
              <div className="fc-card-face fc-card-back">
                <div className="fc-card-label">DEFINITION</div>
                <div className="fc-card-content">{cards[currentIndex]?.definition}</div>
                <div className="fc-flip-hint">← Click to see term</div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="fc-nav">
            <button
              className="fc-nav-btn"
              onClick={goPrev}
              disabled={currentIndex === 0}
            >
              ← Prev
            </button>

            <button className="fc-flip-btn" onClick={handleFlip}>
              {isFlipped ? 'Show Term' : 'Show Definition'}
            </button>

            <button
              className="fc-nav-btn"
              onClick={goNext}
              disabled={currentIndex === cards.length - 1}
            >
              Next →
            </button>
          </div>

          {/* All cards thumbnail strip */}
          <div className="fc-strip">
            {cards.map((c, i) => (
              <button
                key={i}
                className={`fc-strip-dot ${i === currentIndex ? 'active' : ''}`}
                onClick={() => { setIsFlipped(false); setTimeout(() => setCurrentIndex(i), 100); }}
                title={c.term}
              />
            ))}
          </div>

          <button className="fc-restart-btn" onClick={resetAll}>
            ↺ Generate New Cards
          </button>
        </div>
      )}
    </div>
  );
};

export default Flashcards;
