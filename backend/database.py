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

# Teacher model
class Teacher:
    @staticmethod
    async def create(email, password, name):
        hashed_password = hash_password(password)
        teacher = {
            "email": email,
            "password": hashed_password,
            "name": name,
            "created_at": datetime.utcnow()
        }
        result = await teachers_collection.insert_one(teacher)
        teacher["_id"] = result.inserted_id
        return teacher

    @staticmethod
    async def get_by_email(email):
        return await teachers_collection.find_one({"email": email})

    @staticmethod
    async def get_by_id(teacher_id):
        return await teachers_collection.find_one({"_id": ObjectId(teacher_id)})

# Student model
class Student:
    @staticmethod
    async def create(email, password, name):
        hashed_password = hash_password(password)
        student = {
            "email": email,
            "password": hashed_password,
            "name": name,
            "created_at": datetime.utcnow()
        }
        result = await students_collection.insert_one(student)
        student["_id"] = result.inserted_id
        return student

    @staticmethod
    async def get_by_email(email):
        return await students_collection.find_one({"email": email})

    @staticmethod
    async def get_by_id(student_id):
        return await students_collection.find_one({"_id": ObjectId(student_id)})

# Quiz model
class Quiz:
    @staticmethod
    async def create(teacher_id, title, description, questions, quiz_type):
        access_code = generate_access_code()
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