from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient
from bson import ObjectId
import os
from dotenv import load_dotenv
import bcrypt
import secrets
import string
import ssl


load_dotenv()


MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "QuizGen")

BATCH_CHOICES = [f"F{i}" for i in range(1, 10)]

client = AsyncIOMotorClient(MONGO_URL, tlsAllowInvalidCertificates=True)
db = client[DB_NAME]


sync_client = MongoClient(MONGO_URL, tlsAllowInvalidCertificates=True)
sync_db = sync_client[DB_NAME]

# Collections
teachers_collection = db.teachers
students_collection = db.students
quizzes_collection = db.quizzes
attempts_collection = db.attempts


sync_db.teachers.create_index("email", unique=True)
sync_db.students.create_index("email", unique=True)
sync_db.quizzes.create_index("teacher_id")
sync_db.quizzes.create_index("batches")
sync_db.quizzes.create_index("access_code")
sync_db.attempts.create_index([("student_id", 1), ("quiz_id", 1)])


def generate_access_code(length=8):
    """Generate a random access code for quizzes"""
    alphabet = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def hash_password(password):
    """Hash a password using bcrypt"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode(), salt)

def verify_password(plain_password, hashed_password):
    """Verify a password against its hash"""
    return bcrypt.checkpw(plain_password.encode(), hashed_password)


def _normalize_batches(batch_list):
    if not batch_list:
        return []
    normalized = list({batch.strip().upper() for batch in batch_list if batch})
    invalid = [batch for batch in normalized if batch not in BATCH_CHOICES]
    if invalid:
        raise ValueError(f"Invalid batch selection: {', '.join(invalid)}")
    return normalized


def _normalize_batch(batch):
    if not batch:
        raise ValueError("Batch is required for students")
    normalized = batch.strip().upper()
    if normalized not in BATCH_CHOICES:
        raise ValueError(f"Invalid batch selection: {normalized}")
    return normalized

# Teacher model
class Teacher:
    @staticmethod
    async def create(email, password, name, batches=None):
        hashed_password = hash_password(password)
        normalized_batches = _normalize_batches(batches or [])
        teacher = {
            "email": email,
            "password": hashed_password,
            "name": name,
            "batches": normalized_batches,
            "created_at": datetime.utcnow()
        }
        result = await teachers_collection.insert_one(teacher)
        teacher["_id"] = result.inserted_id
        return teacher

    @staticmethod
    async def get_by_email(email):
        teacher = await teachers_collection.find_one({"email": email})
        if teacher is not None and "batches" not in teacher:
            teacher["batches"] = []
        return teacher

    @staticmethod
    async def get_by_id(teacher_id):
        teacher = await teachers_collection.find_one({"_id": ObjectId(teacher_id)})
        if teacher is not None and "batches" not in teacher:
            teacher["batches"] = []
        return teacher

    @staticmethod
    async def update_batches(teacher_id, batches):
        normalized_batches = _normalize_batches(batches or [])
        await teachers_collection.update_one(
            {"_id": ObjectId(teacher_id)},
            {"$set": {"batches": normalized_batches}}
        )
        return normalized_batches

# Student model
class Student:
    @staticmethod
    async def create(email, password, name, batch):
        hashed_password = hash_password(password)
        normalized_batch = _normalize_batch(batch)
        student = {
            "email": email,
            "password": hashed_password,
            "name": name,
            "batch": normalized_batch,
            "created_at": datetime.utcnow()
        }
        result = await students_collection.insert_one(student)
        student["_id"] = result.inserted_id
        return student

    @staticmethod
    async def get_by_email(email):
        student = await students_collection.find_one({"email": email})
        if student is not None and "batch" not in student:
            student["batch"] = None
        return student

    @staticmethod
    async def get_by_id(student_id):
        student = await students_collection.find_one({"_id": ObjectId(student_id)})
        if student is not None and "batch" not in student:
            student["batch"] = None
        return student

    @staticmethod
    async def update_batch(student_id, batch):
        normalized_batch = _normalize_batch(batch)
        await students_collection.update_one(
            {"_id": ObjectId(student_id)},
            {"$set": {"batch": normalized_batch}}
        )
        return normalized_batch

# Quiz model
class Quiz:
    @staticmethod
    async def create(teacher_id, title, description, questions, quiz_type, batches):
        access_code = generate_access_code()
        normalized_batches = _normalize_batches(batches or [])
        quiz = {
            "teacher_id": ObjectId(teacher_id),
            "title": title,
            "description": description,
            "questions": [{
                "text": q["text"],
                "type": q["type"],
                "difficulty": q["difficulty"],
                "options": q["options"],
                "correct_answer": q.get("correct_answer"),  # For MCQ and True/False
                "correct_answers": q.get("correct_answers", []),  # For multi-answer
                "created_at": datetime.utcnow()
            } for q in questions],
            "quiz_type": quiz_type,
            "access_code": access_code,
            "batches": normalized_batches,
            "created_at": datetime.utcnow()
        }
        result = await quizzes_collection.insert_one(quiz)
        quiz["_id"] = result.inserted_id
        return quiz

    @staticmethod
    async def get_by_id(quiz_id):
        return await quizzes_collection.find_one({"_id": ObjectId(quiz_id)})

    @staticmethod
    async def get_by_access_code(access_code):
        return await quizzes_collection.find_one({"access_code": access_code})

    @staticmethod
    async def get_all():
        cursor = quizzes_collection.find()
        return await cursor.to_list(length=None)

    @staticmethod
    async def get_by_batch(batch):
        cursor = quizzes_collection.find({"batches": batch})
        return await cursor.to_list(length=None)

    @staticmethod
    async def get_by_teacher(teacher_id):
        cursor = quizzes_collection.find({"teacher_id": ObjectId(teacher_id)})
        return await cursor.to_list(length=None)

# Quiz Attempt model
class QuizAttempt:
    @staticmethod
    async def create(student_id, quiz_id, answers, score):
        attempt = {
            "student_id": ObjectId(student_id),
            "quiz_id": ObjectId(quiz_id),
            "answers": answers,
            "score": score,
            "submitted_at": datetime.utcnow()
        }
        result = await attempts_collection.insert_one(attempt)
        attempt["_id"] = result.inserted_id
        return attempt

    @staticmethod
    async def get_by_student_and_quiz(student_id, quiz_id):
        return await attempts_collection.find_one({
            "student_id": ObjectId(student_id),
            "quiz_id": ObjectId(quiz_id)
        })

    @staticmethod
    async def get_by_student(student_id):
        cursor = attempts_collection.find({"student_id": ObjectId(student_id)})
        return await cursor.to_list(length=None)

    @staticmethod
    async def get_by_quiz(quiz_id):
        cursor = attempts_collection.find({"quiz_id": ObjectId(quiz_id)})
        return await cursor.to_list(length=None)

# Import datetime at the end to avoid circular imports
from datetime import datetime 