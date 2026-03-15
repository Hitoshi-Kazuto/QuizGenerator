import os
import json
import re
from openai import OpenAI

class QuizGenerator:
    def __init__(self, text: str):
        self.text = text
        self.client = OpenAI(
            base_url="https://router.huggingface.co/v1",
            api_key=os.getenv("HF_API_TOKEN"),
        )
        self.model = "Qwen/Qwen3-8B"

    def generate_quiz_prompt(self, quiz_type: str, difficulty: str = 'medium'):
        type_specific_instructions = {
            "mcq": """
            - Generate ONLY Multiple Choice Questions with ONE correct answer
            - Each question MUST have exactly 4 options
            - Use the "correct_answer" field to specify the exact text of the correct option
            - Do NOT use "correct_answers" field
            """,
            "true_false": """
            - Generate ONLY True/False questions
            - Each question MUST have exactly 2 options: ["True", "False"]
            - Use the "correct_answer" field to specify either "True" or "False"
            - Do NOT use "correct_answers" field
            """,
            "multi_answer": """
            - Generate ONLY Multiple Choice Questions with MULTIPLE correct answers
            - Each question MUST have 4-6 options
            - Use the "correct_answers" field as an array of the exact text of ALL correct options
            - Do NOT use "correct_answer" field
            """
        }

        difficulty_instructions = {
            "easy": """
            - Questions should test basic understanding and recall
            - Use simple vocabulary and straightforward concepts
            - Focus on main ideas and explicit information from the text
            """,
            "medium": """
            - Questions should test comprehension and application
            - Include some analytical thinking
            - Mix straightforward and more nuanced concepts
            """,
            "hard": """
            - Questions should test analysis and evaluation
            - Include complex relationships between concepts
            - Require deeper understanding and critical thinking
            - Challenge students with nuanced distinctions
            """
        }

        return f"""
        You are a quiz generator. Your task is to create a quiz based on the following text:

        TEXT:
        {self.text}

        INSTRUCTIONS:
        1. Generate exactly 10 questions based on the text above.
        2. Each question MUST follow this EXACT format:
           {{
             "text": "Question text here",
             "type": "{quiz_type}",
             "difficulty": "{difficulty}",
             "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
             "correct_answer": "The correct answer here"  // For MCQ and True/False ONLY
             "correct_answers": ["Answer 1", "Answer 2"]  // For multi-answer ONLY
           }}

        DIFFICULTY LEVEL: {difficulty.upper()}
        {difficulty_instructions.get(difficulty, "")}

        TYPE-SPECIFIC REQUIREMENTS:
        {type_specific_instructions.get(quiz_type, "")}

        IMPORTANT:
        - Return ONLY the JSON array, with no additional text
        - Ensure the JSON is properly formatted and valid
        - If you cannot generate questions, return an empty array []
        - NEVER mix question types - all questions must be of type "{quiz_type}"
        - NEVER include both correct_answer and correct_answers in the same question
        - For True/False questions, options MUST be ["True", "False"]
        - For MCQ questions, options MUST be an array of 4 strings
        - For multi-answer questions, options MUST be an array of 4-6 strings
        - ALL questions must match the specified difficulty level
        - Do NOT wrap the JSON in markdown code fences
        """

    def parse_response(self, response_text):
        """Parse the response text and extract valid questions"""
        print("Parsing response:", response_text[:100] + "..." if len(response_text) > 100 else response_text)
        
        # Try to extract JSON from the response if it's not directly parseable
        json_match = re.search(r'\[\s*\{.*\}\s*\]', response_text, re.DOTALL)
        if json_match:
            json_str = json_match.group(0)
            print("Extracted JSON string:", json_str[:100] + "..." if len(json_str) > 100 else json_str)
            
            try:
                questions = json.loads(json_str)
                print(f"Successfully parsed extracted JSON. Type: {type(questions)}")
                return questions
            except json.JSONDecodeError as e:
                print(f"Failed to parse extracted JSON: {e}")
                return []
        else:
            print("No JSON array pattern found in response")
            return []

    def validate_questions(self, questions):
        """Validate the questions and return only valid ones"""
        if not isinstance(questions, list):
            print(f"Response is not a list of questions. Type: {type(questions)}")
            return []
        
        validated_questions = []
        for q in questions:
            # Basic validation
            if not all(key in q for key in ["text", "type", "difficulty", "options"]):
                print(f"Question missing required fields: {q}")
                continue

            # Type-specific validation
            question_type = q.get("type")
            if question_type == "mcq":
                if len(q["options"]) != 4:
                    print(f"MCQ question must have exactly 4 options: {q}")
                    continue
                if "correct_answer" not in q or "correct_answers" in q:
                    print(f"MCQ question must have correct_answer and not correct_answers: {q}")
                    continue
                if q["correct_answer"] not in q["options"]:
                    print(f"MCQ correct answer must be one of the options: {q}")
                    continue
            elif question_type == "true_false":
                if q["options"] != ["True", "False"]:
                    print(f"True/False question must have options ['True', 'False']: {q}")
                    continue
                if "correct_answer" not in q or "correct_answers" in q:
                    print(f"True/False question must have correct_answer and not correct_answers: {q}")
                    continue
                if q["correct_answer"] not in ["True", "False"]:
                    print(f"True/False correct answer must be 'True' or 'False': {q}")
                    continue
            elif question_type == "multi_answer":
                if not (4 <= len(q["options"]) <= 6):
                    print(f"Multi-answer question must have 4-6 options: {q}")
                    continue
                if "correct_answers" not in q or "correct_answer" in q:
                    print(f"Multi-answer question must have correct_answers and not correct_answer: {q}")
                    continue
                if not isinstance(q["correct_answers"], list):
                    print(f"Multi-answer correct_answers must be a list: {q}")
                    continue
                if not all(ans in q["options"] for ans in q["correct_answers"]):
                    print(f"Multi-answer correct answers must be from the options: {q}")
                    continue
            else:
                print(f"Invalid question type: {question_type}")
                continue

            validated_questions.append(q)
        
        print(f"Validated {len(validated_questions)} questions out of {len(questions)}")
        return validated_questions

    def generate_quiz(self, quiz_type: str = 'mcq', difficulty: str = 'medium'):
        prompt = self.generate_quiz_prompt(quiz_type, difficulty)
        try:
            print(f"Generating quiz with type: {quiz_type} and difficulty: {difficulty}")
            print(f"Input text length: {len(self.text)}")
            print(f"Using model: {self.model}")

            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a quiz generator that outputs ONLY valid JSON arrays. No markdown, no explanations, just the JSON array."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.7,
                max_tokens=4096,
            )

            response_text = response.choices[0].message.content
            print("Raw response:", response_text[:200] + "..." if len(response_text) > 200 else response_text)

            # Parse and validate
            questions = self.parse_response(response_text)
            validated_questions = self.validate_questions(questions)

            if validated_questions:
                return validated_questions

            print("Failed to generate valid questions.")
            return []

        except Exception as e:
            print(f"Error in quiz generation: {e}")
            return []