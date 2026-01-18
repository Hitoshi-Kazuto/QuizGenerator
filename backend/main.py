from fastapi import FastAPI, File, UploadFile, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, HttpUrl
from quiz_generator import QuizGenerator
import PyPDF2
import io
import os
from dotenv import load_dotenv
from datetime import timedelta
from typing import List, Optional, Dict, Any
from bson import ObjectId
import requests
from bs4 import BeautifulSoup
from newspaper import Article
import nltk

# Download required NLTK data
nltk.download('punkt', quiet=True)

# Import our modules
from database import Teacher, Student, Quiz, QuizAttempt, BATCH_CHOICES
from auth import (
    create_access_token, 
    get_current_teacher, 
    get_current_student, 
    authenticate_teacher, 
    authenticate_student,
    ACCESS_TOKEN_EXPIRE_MINUTES
)

# Load environment variables
load_dotenv()

app = FastAPI()

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

VALID_BATCHES = {batch.upper() for batch in BATCH_CHOICES}


def normalize_batches(batches: List[str]) -> List[str]:
    normalized = list({batch.strip().upper() for batch in (batches or []) if batch})
    invalid = [batch for batch in normalized if batch not in VALID_BATCHES]
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid batch selection: {', '.join(invalid)}"
        )
    return normalized


def normalize_batch(batch: Optional[str]) -> str:
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Batch is required"
        )
    normalized = batch.strip().upper()
    if normalized not in VALID_BATCHES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid batch selection: {normalized}"
        )
    return normalized

# Root endpoint
@app.get("/")
async def root():
    return {"message": "Quiz Generator API is running"}

@app.head("/ping")
async def ping():
    return

# Pydantic models for request validation
class QuizRequest(BaseModel):
    text: str
    quiz_type: str = 'mcq'
    difficulty: str = 'medium'

class TeacherCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    batches: List[str] = []

class StudentCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    batch: str

class QuizCreate(BaseModel):
    title: str
    description: str
    questions: List[Dict[str, Any]]
    quiz_type: str
    batches: List[str]

class StudentBatchUpdate(BaseModel):
    batch: str

class TeacherBatchesUpdate(BaseModel):
    batches: List[str]

class QuizAccessRequest(BaseModel):
    access_code: str

class QuizAnswer(BaseModel):
    question_id: str
    answer: str

class QuizSubmission(BaseModel):
    quiz_id: str
    answers: List[QuizAnswer]

class WebsiteRequest(BaseModel):
    url: HttpUrl

# Authentication endpoints
@app.post("/token")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    # Check if user is a teacher or student
    teacher = await authenticate_teacher(form_data.username, form_data.password)
    if teacher:
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(teacher["_id"]), "type": "teacher"},
            expires_delta=access_token_expires
        )
        return {"access_token": access_token, "token_type": "bearer", "user_type": "teacher"}
    
    student = await authenticate_student(form_data.username, form_data.password)
    if student:
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(student["_id"]), "type": "student"},
            expires_delta=access_token_expires
        )
        return {"access_token": access_token, "token_type": "bearer", "user_type": "student"}
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect email or password",
        headers={"WWW-Authenticate": "Bearer"},
    )

# Teacher endpoints
@app.post("/teachers/register")
async def register_teacher(teacher: TeacherCreate):
    # Check if teacher already exists
    existing_teacher = await Teacher.get_by_email(teacher.email)
    if existing_teacher:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    normalized_batches = normalize_batches(teacher.batches)
    # Create new teacher
    new_teacher = await Teacher.create(teacher.email, teacher.password, teacher.name, normalized_batches)
    return {"message": "Teacher registered successfully", "teacher_id": str(new_teacher["_id"])}

@app.get("/teachers/me")
async def get_teacher_profile(current_teacher: dict = Depends(get_current_teacher)):
    return {
        "id": str(current_teacher["_id"]),
        "email": current_teacher["email"],
        "name": current_teacher["name"],
        "batches": current_teacher.get("batches", [])
    }

@app.patch("/teachers/me/batches")
async def update_teacher_batches(
    update: TeacherBatchesUpdate,
    current_teacher: dict = Depends(get_current_teacher)
):
    if not update.batches:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please select at least one batch"
        )
    normalized_batches = normalize_batches(update.batches)
    updated_batches = await Teacher.update_batches(str(current_teacher["_id"]), normalized_batches)
    current_teacher["batches"] = updated_batches
    return {"message": "Batches updated successfully", "batches": updated_batches}

# Student endpoints
@app.post("/students/register")
async def register_student(student: StudentCreate):
    # Check if student already exists
    existing_student = await Student.get_by_email(student.email)
    if existing_student:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    normalized_batch = normalize_batch(student.batch)
    # Create new student
    new_student = await Student.create(student.email, student.password, student.name, normalized_batch)
    return {"message": "Student registered successfully", "student_id": str(new_student["_id"])}

@app.get("/students/me")
async def get_student_profile(current_student: dict = Depends(get_current_student)):
    return {
        "id": str(current_student["_id"]),
        "email": current_student["email"],
        "name": current_student["name"],
        "batch": current_student.get("batch")
    }

@app.patch("/students/me/batch")
async def update_student_batch(
    update: StudentBatchUpdate,
    current_student: dict = Depends(get_current_student)
):
    normalized_batch = normalize_batch(update.batch)
    updated_batch = await Student.update_batch(str(current_student["_id"]), normalized_batch)
    current_student["batch"] = updated_batch
    return {"message": "Batch updated successfully", "batch": updated_batch}

# Quiz endpoints
@app.post("/generate-quiz")
async def generate_quiz(request: QuizRequest):
    print(f"Received text: {request.text[:100]}...")
    print(f"Text length: {len(request.text)}")
    print(f"Quiz type: {request.quiz_type}")
    print(f"Difficulty: {request.difficulty}")
    
    # Validate text
    if not request.text or not request.text.strip():
        print("Empty text received")
        return {"questions": [], "error": "Text cannot be empty"}
    
    # Clean and prepare text
    cleaned_text = request.text.strip()
    
    try:
        generator = QuizGenerator(cleaned_text)
        questions = generator.generate_quiz(request.quiz_type, request.difficulty)
        
        print(f"Generated questions: {len(questions)}")
        
        if not questions:
            print("No questions were generated. Returning empty array.")
            return {"questions": [], "error": "No questions could be generated from the provided text"}
        
        return {"questions": questions}
    except Exception as e:
        print(f"Error in generate_quiz endpoint: {e}")
        return {"questions": [], "error": str(e)}

@app.post("/quizzes")
async def create_quiz(quiz: QuizCreate, current_teacher: dict = Depends(get_current_teacher)):
    if not quiz.batches:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please select at least one batch to share the quiz"
        )
    normalized_batches = normalize_batches(quiz.batches)
    teacher_batches = set(current_teacher.get("batches", []))
    if not teacher_batches:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not associated with any batches"
        )
    if not set(normalized_batches).issubset(teacher_batches):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only share quizzes with batches assigned to you"
        )
    new_quiz = await Quiz.create(
        teacher_id=str(current_teacher["_id"]),
        title=quiz.title,
        description=quiz.description,
        questions=quiz.questions,
        quiz_type=quiz.quiz_type,
        batches=normalized_batches
    )
    return {
        "message": "Quiz created successfully",
        "quiz_id": str(new_quiz["_id"]),
        "access_code": new_quiz["access_code"]
    }

@app.get("/quizzes")
async def get_all_quizzes(current_student: dict = Depends(get_current_student)):
    student_batch = current_student.get("batch")
    if not student_batch:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student is not associated with any batch"
        )
    quizzes = await Quiz.get_by_batch(student_batch)
    # Convert ObjectId to string for JSON serialization
    for quiz in quizzes:
        quiz["_id"] = str(quiz["_id"])
        quiz["teacher_id"] = str(quiz["teacher_id"])
    return quizzes

@app.get("/quizzes/teacher")
async def get_teacher_quizzes(current_teacher: dict = Depends(get_current_teacher)):
    quizzes = await Quiz.get_by_teacher(str(current_teacher["_id"]))
    # Convert ObjectId to string for JSON serialization
    for quiz in quizzes:
        quiz["_id"] = str(quiz["_id"])
        quiz["teacher_id"] = str(quiz["teacher_id"])
    return quizzes

@app.post("/quizzes/access")
async def access_quiz_by_code(access_request: QuizAccessRequest, current_student: dict = Depends(get_current_student)):
    quiz = await Quiz.get_by_access_code(access_request.access_code)
    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found with this access code"
        )
    student_batch = current_student.get("batch")
    if not student_batch or student_batch not in quiz.get("batches", []):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This quiz is not available for your batch"
        )
    
    # Check if student has already attempted this quiz
    existing_attempt = await QuizAttempt.get_by_student_and_quiz(
        str(current_student["_id"]), 
        str(quiz["_id"])
    )
    
    if existing_attempt:
        return {
            "message": "You have already attempted this quiz",
            "quiz_id": str(quiz["_id"]),
            "score": existing_attempt["score"]
        }
    
    # Convert ObjectId to string for JSON serialization
    quiz["_id"] = str(quiz["_id"])
    quiz["teacher_id"] = str(quiz["teacher_id"])
    return quiz

@app.get("/quizzes/{quiz_id}")
async def get_quiz_by_id(quiz_id: str, current_student: dict = Depends(get_current_student)):
    quiz = await Quiz.get_by_id(quiz_id)
    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found"
        )
    student_batch = current_student.get("batch")
    if not student_batch or student_batch not in quiz.get("batches", []):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access this quiz"
        )
    
    # Convert ObjectId to string for JSON serialization
    quiz["_id"] = str(quiz["_id"])
    quiz["teacher_id"] = str(quiz["teacher_id"])
    return quiz

@app.post("/quizzes/submit")
async def submit_quiz(submission: QuizSubmission, current_student: dict = Depends(get_current_student)):
    quiz = await Quiz.get_by_id(submission.quiz_id)
    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found"
        )
    student_batch = current_student.get("batch")
    if not student_batch or student_batch not in quiz.get("batches", []):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to submit this quiz"
        )
    
    # Check if student has already attempted this quiz
    existing_attempt = await QuizAttempt.get_by_student_and_quiz(
        str(current_student["_id"]), 
        submission.quiz_id
    )
    
    if existing_attempt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already submitted this quiz"
        )
    
    # Calculate score
    correct_answers = 0
    total_questions = len(quiz["questions"])
    answer_details = []
    
    for answer in submission.answers:
        question_id = answer.question_id
        student_answer = answer.answer
        
        # Find the corresponding question
        question = None
        for q in quiz["questions"]:
            if str(q.get("id", "")) == question_id or str(quiz["questions"].index(q)) == question_id:
                question = q
                break
        
        if not question:
            continue
        
        # Check if the answer is correct based on question type
        is_correct = False
        question_type = question.get("type", "mcq")
        
        if question_type == "mcq" or question_type == "true_false":
            # For MCQ and True/False, exact match is required
            correct_answer = question.get("correct_answer", "")
            is_correct = student_answer == correct_answer
        elif question_type == "multi_answer":
            # For multi-answer, check if all correct answers are selected
            correct_answers_list = question.get("correct_answers", [])
            student_answers = student_answer.split(",") if isinstance(student_answer, str) else student_answer
            
            # Check if all correct answers are selected and no incorrect ones
            is_correct = (
                len(student_answers) == len(correct_answers_list) and
                all(ans in correct_answers_list for ans in student_answers)
            )
        
        if is_correct:
            correct_answers += 1
        
        # Store answer details for feedback
        answer_details.append({
            "question_id": question_id,
            "student_answer": student_answer,
            "correct_answer": question.get("correct_answer", ""),
            "correct_answers": question.get("correct_answers", []),
            "is_correct": is_correct
        })
    
    # Calculate score as percentage
    score = (correct_answers / total_questions) * 100 if total_questions > 0 else 0
    
    # Save attempt with answer details
    attempt = await QuizAttempt.create(
        student_id=str(current_student["_id"]),
        quiz_id=submission.quiz_id,
        answers=answer_details,
        score=score
    )
    
    return {
        "message": "Quiz submitted successfully",
        "score": score,
        "attempt_id": str(attempt["_id"]),
        "correct_answers": correct_answers,
        "total_questions": total_questions
    }

@app.get("/attempts")
async def get_student_attempts(current_student: dict = Depends(get_current_student)):
    attempts = await QuizAttempt.get_by_student(str(current_student["_id"]))
    # Convert ObjectId to string for JSON serialization
    for attempt in attempts:
        attempt["_id"] = str(attempt["_id"])
        attempt["student_id"] = str(attempt["student_id"])
        attempt["quiz_id"] = str(attempt["quiz_id"])
    return attempts

@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    try:
        pdf_content = await file.read()
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_content))
        
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text()
        
        print(f"Extracted text length: {len(text)}")
        
        if not text.strip():
            print("No text extracted from PDF")
            return {"text": "", "error": "No text could be extracted from the PDF"}
        
        return {"text": text}
    except Exception as e:
        print(f"Error in upload_pdf endpoint: {e}")
        return {"text": "", "error": str(e)}

@app.get("/quizzes/{quiz_id}/attempts")
async def get_quiz_attempts(quiz_id: str, current_teacher: dict = Depends(get_current_teacher)):
    # First verify that the quiz belongs to this teacher
    quiz = await Quiz.get_by_id(quiz_id)
    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found"
        )
    
    if str(quiz["teacher_id"]) != str(current_teacher["_id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view attempts for this quiz"
        )
    
    # Get all attempts for this quiz
    attempts = await QuizAttempt.get_by_quiz(quiz_id)
    
    # For each attempt, get the student name
    for attempt in attempts:
        student = await Student.get_by_id(str(attempt["student_id"]))
        attempt["student_name"] = student["name"] if student else "Unknown Student"
        # Convert ObjectId to string for JSON serialization
        attempt["_id"] = str(attempt["_id"])
        attempt["student_id"] = str(attempt["student_id"])
        attempt["quiz_id"] = str(attempt["quiz_id"])
    
    return attempts

@app.post("/scrape-website")
async def scrape_website(request: WebsiteRequest):
    try:
        # Initialize article
        article = Article(str(request.url))
        
        try:
            # Download and parse article
            article.download()
            article.parse()
            
            # Natural Language Processing
            article.nlp()
            
            # Get the cleaned text
            text = article.text
            
            # If article text is empty, try basic BeautifulSoup scraping as fallback
            if not text.strip():
                response = requests.get(str(request.url))
                response.raise_for_status()
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Remove script and style elements
                for script in soup(["script", "style"]):
                    script.decompose()
                
                # Get text content
                text = soup.get_text()
                
                # Clean up the text
                lines = (line.strip() for line in text.splitlines())
                chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
                text = ' '.join(chunk for chunk in chunks if chunk)
            
            print(f"Extracted text length: {len(text)}")
            
            if not text.strip():
                return {"text": "", "error": "No text could be extracted from the website"}
            
            # Add article metadata if available
            metadata = {
                "title": article.title,
                "authors": article.authors,
                "publish_date": article.publish_date.isoformat() if article.publish_date else None,
                "keywords": article.keywords,
                "summary": article.summary
            }
            
            return {
                "text": text,
                "metadata": metadata
            }
            
        except Exception as e:
            print(f"Article extraction failed: {e}")
            # If article extraction fails, try basic BeautifulSoup scraping
            response = requests.get(str(request.url))
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Remove script and style elements
            for script in soup(["script", "style"]):
                script.decompose()
            
            # Get text content
            text = soup.get_text()
            
            # Clean up the text
            lines = (line.strip() for line in text.splitlines())
            chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
            text = ' '.join(chunk for chunk in chunks if chunk)
            
            print(f"Extracted text length (fallback): {len(text)}")
            
            if not text.strip():
                return {"text": "", "error": "No text could be extracted from the website"}
            
            return {"text": text}
            
    except requests.RequestException as e:
        print(f"Error scraping website: {e}")
        return {"text": "", "error": f"Failed to access website: {str(e)}"}
    except Exception as e:
        print(f"Error in scrape_website endpoint: {e}")
        return {"text": "", "error": str(e)}