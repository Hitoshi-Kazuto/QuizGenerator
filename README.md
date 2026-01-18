# TestifyAI

A web application that generates quizzes from text or PDF documents using Google's Gemini AI.

## Features

- Generate quizzes from text input
- Upload PDF documents and extract text for quiz generation
- Multiple quiz types: Multiple Choice, Short Answer, Long Answer
- Modern, responsive UI

## Setup

### Backend Setup

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Create a virtual environment:
   ```
   python -m venv venv
   ```

3. Activate the virtual environment:
   - On Windows:
     ```
     venv\Scripts\activate
     ```
   - On macOS/Linux:
     ```
     source venv/bin/activate
     ```

4. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

5. Create a `.env` file in the backend directory with your Gemini API key:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

6. Start the backend server:
   ```
   uvicorn main:app --reload
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```
   cd frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the frontend development server:
   ```
   npm start
   ```

4. Open your browser and navigate to `http://localhost:3000`

## Usage

1. Enter text directly in the text area or upload a PDF file
2. Select the quiz type (Multiple Choice, Short Answer, or Long Answer)
3. Click "Generate Quiz" to create a quiz based on the input
4. View and interact with the generated questions

## Technologies Used

- **Backend**: FastAPI, Google Gemini AI, PyPDF2
- **Frontend**: React, Axios
- **Styling**: CSS

## License

MIT 