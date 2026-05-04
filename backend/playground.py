"""
playground.py — In-memory WebSocket room manager for the collaborative teacher playground.

Room lifecycle:
  1. Teacher calls POST /playground/create  → gets room_id
  2. Teachers connect via WS /playground/ws/{room_id} with their JWT token
  3. Teachers contribute texts, trigger generation, toggle questions
  4. One teacher finalises → questions saved as a normal Quiz document

All state is in-memory. If the server restarts, rooms are lost.
"""

import asyncio
import json
import uuid
from typing import Dict, List, Optional
from fastapi import WebSocket
from datetime import datetime



class PlaygroundRoom:
    def __init__(self, room_id: str, creator_id: str, creator_name: str):
        self.room_id = room_id
        self.created_at = datetime.utcnow().isoformat()
        self.connections: Dict[str, WebSocket] = {}
        self.teachers: List[Dict] = [{"id": creator_id, "name": creator_name}]
        self.contributions: List[Dict] = []
        self.generated_questions: List[Dict] = []
        self.custom_questions: List[Dict] = []
        self.selected_question_ids: List[str] = []
        self._generating = False

    def to_state(self) -> dict:
        """Serialise full room state for broadcast."""
        all_questions = self.generated_questions + self.custom_questions
        return {
            "room_id": self.room_id,
            "teachers": self.teachers,
            "contributions": self.contributions,
            "questions": all_questions,
            "selected_question_ids": self.selected_question_ids,
        }

    def get_teacher(self, teacher_id: str) -> Optional[Dict]:
        return next((t for t in self.teachers if t["id"] == teacher_id), None)

    def ensure_teacher(self, teacher_id: str, teacher_name: str):
        if not self.get_teacher(teacher_id):
            self.teachers.append({"id": teacher_id, "name": teacher_name})

    def remove_teacher(self, teacher_id: str):
        self.teachers = [t for t in self.teachers if t["id"] != teacher_id]
        self.connections.pop(teacher_id, None)

    def add_contribution(self, teacher_id: str, teacher_name: str, text: str) -> str:
        contrib_id = str(uuid.uuid4())
        self.contributions = [c for c in self.contributions if c["teacher_id"] != teacher_id]
        self.contributions.append({
            "id": contrib_id,
            "teacher_id": teacher_id,
            "teacher_name": teacher_name,
            "text": text,
        })
        return contrib_id

    def add_generated_questions(self, questions: List[Dict], teacher_id: str, teacher_name: str):
        for q in questions:
            q["id"] = str(uuid.uuid4())
            q["added_by_id"] = teacher_id
            q["added_by_name"] = teacher_name
            q["source"] = "ai"
            self.generated_questions.append(q)
            self.selected_question_ids.append(q["id"])

    def add_custom_question(self, question: Dict, teacher_id: str, teacher_name: str) -> str:
        q_id = str(uuid.uuid4())
        question["id"] = q_id
        question["added_by_id"] = teacher_id
        question["added_by_name"] = teacher_name
        question["source"] = "custom"
        self.custom_questions.append(question)
        self.selected_question_ids.append(q_id)
        return q_id

    def toggle_question(self, question_id: str) -> bool:
        """Toggle selection. Returns new selected state."""
        if question_id in self.selected_question_ids:
            self.selected_question_ids.remove(question_id)
            return False
        else:
            self.selected_question_ids.append(question_id)
            return True

    def remove_question(self, question_id: str):
        self.generated_questions = [q for q in self.generated_questions if q["id"] != question_id]
        self.custom_questions = [q for q in self.custom_questions if q["id"] != question_id]
        if question_id in self.selected_question_ids:
            self.selected_question_ids.remove(question_id)

    def get_selected_questions(self) -> List[Dict]:
        all_q = {q["id"]: q for q in (self.generated_questions + self.custom_questions)}
        return [all_q[qid] for qid in self.selected_question_ids if qid in all_q]

    @property
    def combined_text(self) -> str:
        return "\n\n".join(c["text"] for c in self.contributions if c["text"].strip())


_rooms: Dict[str, PlaygroundRoom] = {}


def create_room(creator_id: str, creator_name: str) -> str:
    room_id = str(uuid.uuid4())[:8].upper()
    _rooms[room_id] = PlaygroundRoom(room_id, creator_id, creator_name)
    return room_id


def get_room(room_id: str) -> Optional[PlaygroundRoom]:
    return _rooms.get(room_id)


def delete_room(room_id: str):
    _rooms.pop(room_id, None)


# ---------------------------------------------------------------------------
# Broadcast helpers
# ---------------------------------------------------------------------------

async def broadcast(room: PlaygroundRoom, message: dict):
    """Send a message to all connected teachers in the room."""
    dead = []
    for teacher_id, ws in room.connections.items():
        try:
            await ws.send_json(message)
        except Exception:
            dead.append(teacher_id)
    for teacher_id in dead:
        room.connections.pop(teacher_id, None)


async def broadcast_state(room: PlaygroundRoom):
    await broadcast(room, {"event": "room_state", "data": room.to_state()})
