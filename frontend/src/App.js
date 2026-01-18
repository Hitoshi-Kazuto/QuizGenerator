import React, { useState, useRef } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import { API_BASE_URL } from './config';
import './App.css';

function App() {
  const [text, setText] = useState('');
  const [questions, setQuestions] = useState([]);
  const [quizType, setQuizType] = useState('mcq');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isPdfUploaded, setIsPdfUploaded] = useState(false);
  const fileInputRef = useRef(null);

  const generateQuiz = async () => {
    // Reset previous error
    setError(null);
    
    // Validate input
    if (!text.trim()) {
      setError('Please enter some text or upload a PDF to generate a quiz');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Sending request with text length:', text.length);
      console.log('Quiz type:', quizType);
      
      const response = await axios.post(`${API_BASE_URL}/generate-quiz`, {
        text: text,
        quiz_type: quizType
      });

      // Log the response to understand the structure
      console.log('Quiz Generation Response:', response.data);
      console.log('Questions array:', response.data.questions);
      console.log('Questions length:', response.data.questions ? response.data.questions.length : 0);

      if (!response.data.questions || response.data.questions.length === 0) {
        const errorMessage = response.data.error || 'No questions were generated. Please try again with different text or quiz type.';
        setError(errorMessage);
        setQuestions([]);
      } else {
        setQuestions(response.data.questions);
      }
    } catch (error) {
      console.error('Quiz generation failed', error);
      setError('Failed to generate quiz. Please try again.');
      setQuestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check if file is a PDF
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await axios.post(`${API_BASE_URL}/upload-pdf`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      console.log('PDF text length:', response.data.text.length);
      
      if (!response.data.text || response.data.text.trim() === '') {
        const errorMessage = response.data.error || 'No text could be extracted from the PDF. Please try a different file.';
        setError(errorMessage);
        return;
      }
      
      setText(response.data.text);
      setIsPdfUploaded(true);
    } catch (error) {
      console.error('PDF upload failed', error);
      setError('Failed to upload PDF. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const clearInput = () => {
    setText('');
    setQuestions([]);
    setError(null);
    setIsPdfUploaded(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadQuiz = () => {
    const doc = new jsPDF();
    
    // Set font sizes
    const titleFontSize = 16;
    const questionFontSize = 12;
    const optionFontSize = 10;
    
    // Set initial positions
    let yPos = 20;
    const leftMargin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const textWidth = pageWidth - 2 * leftMargin;
    
    // Add title
    doc.setFontSize(titleFontSize);
    doc.setFont('helvetica', 'bold');
    doc.text('Generated Quiz', leftMargin, yPos);
    yPos += 15;
    
    // Process each question
    doc.setFont('helvetica', 'normal');
    questions.forEach((q, index) => {
      // Check if we need a new page
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      
      // Add question number and text
      doc.setFontSize(questionFontSize);
      doc.setFont('helvetica', 'bold');
      const questionText = `${index + 1}. ${q.text}`;
      
      // Split long question text into multiple lines
      const splitQuestionText = doc.splitTextToSize(questionText, textWidth);
      doc.text(splitQuestionText, leftMargin, yPos);
      
      // Move down based on how many lines the question text takes
      yPos += splitQuestionText.length * 7;
      
      // Add options if it's an MCQ
      if (q.type === 'mcq' && q.options) {
        doc.setFontSize(optionFontSize);
        doc.setFont('helvetica', 'normal');
        
        q.options.forEach((option, optIndex) => {
          // Check if we need a new page
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
          }
          
          // Create option text with proper letter (A, B, C, etc.)
          const optionLetter = String.fromCharCode(65 + optIndex);
          const optionText = `${optionLetter}. ${option}`;
          
          // Split long option text into multiple lines
          const splitOptionText = doc.splitTextToSize(optionText, textWidth - 10);
          doc.text(splitOptionText, leftMargin + 10, yPos);
          
          // Move down based on how many lines the option text takes
          yPos += splitOptionText.length * 6 + 2;
        });
        
        // Add extra space after options
        yPos += 5;
      } else {
        // For short/long answer questions, add space for answers
        yPos += 15;
      }
    });

    doc.save('quiz.pdf');
  };

  return (
    <div className="container">
      <h1>TestifyAI</h1>
      
      <div className="input-section">
        <div className="file-upload">
          <input 
            type="file" 
            accept=".pdf" 
            onChange={handleFileUpload} 
            ref={fileInputRef}
            className="file-input"
          />
          <button 
            onClick={() => fileInputRef.current.click()}
            className="upload-btn"
            disabled={isLoading}
          >
            Upload PDF
          </button>
        </div>
        
        <div className="text-input">
          <textarea 
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter text or upload a PDF to generate quiz"
            disabled={isPdfUploaded}
          />
          {isPdfUploaded && (
            <div className="pdf-info">
              <p>PDF uploaded successfully! Text extracted and ready for quiz generation.</p>
              <button onClick={clearInput} className="clear-btn">Clear</button>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex">
        <select 
          value={quizType} 
          onChange={(e) => setQuizType(e.target.value)}
          className="select"
        >
          <option value="mcq">Multiple Choice</option>
          <option value="short">Short Answer</option>
          <option value="long">Long Answer</option>
        </select>
        
        <button 
          onClick={generateQuiz}
          disabled={isLoading}
          className="generate-btn"
        >
          {isLoading ? 'Generating...' : 'Generate Quiz'}
        </button>
      </div>

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      {questions.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-4">Generated Questions</h2>
          <button onClick={downloadQuiz} className="download-btn">Download Quiz</button>
          {questions.map((q, index) => (
            <div key={index} className="question">
              <p className="font-medium">{q.text}</p>
              {q.type === 'mcq' && q.options && (
                <div className="mt-2">
                  {q.options.map((option, optIndex) => (
                    <div key={optIndex} className="option-container" style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start', width: '100%', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <input 
                          type="radio" 
                          name={`question-${index}`} 
                          id={`option-${index}-${optIndex}`} 
                          style={{ marginRight: '10px' }}
                        />
                        <label 
                          htmlFor={`option-${index}-${optIndex}`}
                          style={{ textAlign: 'left' }}
                        >
                          {option}
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;