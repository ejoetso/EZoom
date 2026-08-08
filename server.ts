import express from "express";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Lazy-loaded Gemini Client to prevent crashing on startup if key is unconfigured
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "MY_GEMINI_API_KEY" || key === "") {
      throw new Error("GEMINI_API_KEY is not configured. Please add it via the Secrets panel in AI Studio.");
    }
    aiInstance = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

// Global Classroom Session State
interface RoomState {
  id: string;
  title: string;
  courseName: string;
  joinCode: string; // e.g. EDU-1234-56
  educatorId: string;
  educatorName: string;
  isLocked: boolean;
  waitingRoomEnabled: boolean;
  chatEnabled: boolean;
  recordingEnabled: boolean;
  status: "lobby" | "live" | "ended";
  startedAt?: string;
  endedAt?: string;

  // Real-time collections
  participants: Map<string, {
    id: string;
    name: string;
    email?: string;
    role: string;
    isMuted: boolean;
    handRaised: boolean;
    status: "active" | "unstable" | "reconnecting" | "disconnected" | "waiting";
    joinedAt: string;
    ws: WebSocket;
  }>;
  waitingRoom: Map<string, {
    id: string;
    name: string;
    email?: string;
    ws: WebSocket;
  }>;
  chat: any[];
  questions: any[];
  polls: any[];
  resources: any[];
  whiteboard: any[];
  annotations: any[];
  screenSharing: {
    isSharing: boolean;
    mode: string;
    isSimulation?: boolean;
    slideIdx?: number;
  };
  lastScreenFrame?: string;
  visitCount?: number;
  visitedUsers?: Set<string>;
}

const rooms = new Map<string, RoomState>();

// Helper to generate simple 4-digit join code
function generateJoinCode(): string {
  let code = Math.floor(1000 + Math.random() * 9000).toString();
  while (rooms.has(code)) {
    code = Math.floor(1000 + Math.random() * 9000).toString();
  }
  return code;
}

// REST API Endpoints

// Create Classroom
app.post("/api/classrooms", (req, res) => {
  const { title, courseName, educatorName, waitingRoom, chatEnabled, recording, password } = req.body;
  if (!title || !educatorName) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (password !== "97807723" && password !== "20260724") {
    return res.status(403).json({ error: "Incorrect broadcasting authorization password." });
  }

  const joinCode = generateJoinCode();
  const roomId = Math.random().toString(36).substring(2, 15);
  const educatorId = "edu_" + Math.random().toString(36).substring(2, 9);

  const newRoom: RoomState = {
    id: roomId,
    title,
    courseName: courseName || "General Studies",
    joinCode,
    educatorId,
    educatorName,
    isLocked: false,
    waitingRoomEnabled: waitingRoom !== false,
    chatEnabled: chatEnabled !== false,
    recordingEnabled: !!recording,
    status: "lobby",
    participants: new Map(),
    waitingRoom: new Map(),
    chat: [],
    questions: [],
    polls: [],
    resources: [],
    whiteboard: [],
    annotations: [],
    screenSharing: {
      isSharing: false,
      mode: "balanced",
    },
    visitCount: 56,
    visitedUsers: new Set(),
  };

  rooms.set(joinCode, newRoom);
  res.json({
    roomId,
    joinCode,
    educatorId,
    educatorName,
    session: {
      title: newRoom.title,
      courseName: newRoom.courseName,
      waitingRoomEnabled: newRoom.waitingRoomEnabled,
      chatEnabled: newRoom.chatEnabled,
      recordingEnabled: newRoom.recordingEnabled,
    }
  });
});

// Check/Validate Classroom Join Code
app.get("/api/classrooms/:code", (req, res) => {
  const { code } = req.params;
  const room = rooms.get(code.toUpperCase());
  if (!room) {
    return res.status(404).json({ error: "Classroom not found" });
  }
  if (room.status === "ended") {
    return res.status(400).json({ error: "This classroom session has already ended." });
  }
  if (room.isLocked) {
    return res.status(403).json({ error: "This classroom is currently locked by the educator." });
  }

  res.json({
    id: room.id,
    title: room.title,
    courseName: room.courseName,
    joinCode: room.joinCode,
    educatorName: room.educatorName,
    waitingRoomEnabled: room.waitingRoomEnabled,
    chatEnabled: room.chatEnabled,
    status: room.status,
  });
});

// API endpoint to upload shared resource files (mocked local save - returns object details)
app.post("/api/classrooms/:code/resources", (req, res) => {
  const { code } = req.params;
  const { name, size, type, uploaderName } = req.body;
  const room = rooms.get(code.toUpperCase());
  if (!room) {
    return res.status(404).json({ error: "Classroom not found" });
  }

  const newResource = {
    id: "res_" + Math.random().toString(36).substring(2, 9),
    name,
    size,
    type,
    url: "#", // Simulated local download
    uploadedBy: uploaderName,
    uploadedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };

  room.resources.push(newResource);
  
  // Broadcast new resource to all active participants
  broadcastToRoom(room, {
    type: "resource-added",
    resource: newResource
  });

  res.json(newResource);
});

// GET Classroom Session report (historical summary)
app.get("/api/classrooms/:code/report", (req, res) => {
  const { code } = req.params;
  const room = rooms.get(code.toUpperCase());
  if (!room) {
    return res.status(404).json({ error: "Classroom not found" });
  }

  // Compile high fidelity report stats
  const stats = {
    title: room.title,
    courseName: room.courseName,
    joinCode: room.joinCode,
    educatorName: room.educatorName,
    totalChatMessages: room.chat.length,
    totalQuestionsAsked: room.questions.length,
    totalPollsRun: room.polls.length,
    totalResourcesShared: room.resources.length,
    startedAt: room.startedAt || new Date().toISOString(),
    endedAt: room.endedAt || new Date().toISOString(),
  };

  res.json(stats);
});

// AI endpoints using official `@google/genai`
app.post("/api/gemini/summarize", async (req, res) => {
  const { code, transcriptText, whiteboardNotes } = req.body;
  try {
    const ai = getGeminiClient();
    const prompt = `
You are the EduCast AI Learning Assistant. Summarize this lecture for students.
Create a highly professional, beautiful educational summary with key takeaways and definitions.
Use clean markdown layout (headings, bullets, and bold terms).

Lecture Details:
Room Code: ${code}
Transcript / Chat Record:
${transcriptText || "No active speech transcript recorded."}

Whiteboard / Slides Context:
${whiteboardNotes || "No whiteboard notations shared."}

Your summary should be:
1. Executive Abstract: Summary of what was taught.
2. Core Takeaways: Bullet-pointed key themes.
3. Key Terms Dictionary: Defining any jargon or technical terms.
4. Actionable Next Steps: What the student should study next.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({ summary: response.text });
  } catch (error: any) {
    console.error("Gemini summary error:", error);
    res.status(500).json({ error: error.message || "Failed to generate AI summary." });
  }
});

app.post("/api/gemini/quiz", async (req, res) => {
  const { code, lectureContext } = req.body;
  try {
    const ai = getGeminiClient();
    const prompt = `
Generate a 3-question multiple choice review quiz based on this classroom context:
Context: ${lectureContext || "General educational topics."}

Respond STRICTLY with a JSON array of objects representing the quiz questions. Do not wrap in markdown code fences like \`\`\`json.
Each object must have:
- question: string (the quiz question)
- options: string[] (exactly 4 options)
- correctAnswerIndex: number (0-indexed index of the correct answer)
- explanation: string (short, friendly explanation of why that answer is correct)
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    let jsonStr = response.text || "[]";
    // Sanitize any occasional markdown fence wrapping just in case
    jsonStr = jsonStr.replace(/```json/gi, "").replace(/```/g, "").trim();

    const quiz = JSON.parse(jsonStr);
    res.json({ quiz });
  } catch (error: any) {
    console.error("Gemini quiz error:", error);
    res.status(500).json({ error: error.message || "Failed to generate AI quiz." });
  }
});


// WebSocket Signaller Connection Handling
const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (ws: WebSocket) => {
  let userSession: {
    userId: string;
    name: string;
    role: string;
    roomCode: string;
  } | null = null;

  ws.on("message", (messageStr: string) => {
    try {
      const message = JSON.parse(messageStr);
      const { type } = message;

      if (type === "join") {
        const { userId, name, email, role, roomCode } = message;
        const code = roomCode.toUpperCase();
        const room = rooms.get(code);

        if (!room) {
          ws.send(JSON.stringify({ type: "error", message: "Classroom not found" }));
          return;
        }

        userSession = { userId, name, role, roomCode: code };

        // If user is the educator
        if (role === "EDUCATOR") {
          room.educatorId = userId;
          room.educatorName = name;
          (room as any).educatorWs = ws;
          room.status = "live";
          if (!room.startedAt) room.startedAt = new Date().toISOString();

          // Sync initial data
          ws.send(JSON.stringify({
            type: "joined",
            classroom: {
              title: room.title,
              courseName: room.courseName,
              joinCode: room.joinCode,
              isLocked: room.isLocked,
              waitingRoomEnabled: room.waitingRoomEnabled,
              chatEnabled: room.chatEnabled,
              recordingEnabled: room.recordingEnabled,
              visitCount: room.visitCount || 56,
              concurrentUsers: room.participants.size + 1
            },
            participants: Array.from(room.participants.values()).map(p => ({
              id: p.id,
              name: p.name,
              email: p.email,
              role: p.role,
              isMuted: p.isMuted,
              handRaised: p.handRaised,
              status: p.status,
            })),
            waitingRoom: Array.from(room.waitingRoom.values()).map(w => ({
              id: w.id,
              name: w.name,
              email: w.email,
            })),
            chat: room.chat,
            questions: room.questions,
            polls: room.polls,
            resources: room.resources,
            whiteboard: room.whiteboard,
          }));

          // Notify everyone educator is online
          broadcastToRoom(room, {
            type: "educator-joined",
            name,
            visitCount: room.visitCount || 56,
            concurrentUsers: room.participants.size + 1
          });
        } 
        // If student joins
        else {
          // If locked
          if (room.isLocked) {
            ws.send(JSON.stringify({ type: "error", message: "Classroom is locked" }));
            return;
          }

          // If waiting room is enabled and student is not already admitted
          const isAlreadyAdmitted = room.participants.has(userId);
          if (room.waitingRoomEnabled && !isAlreadyAdmitted) {
            // Add to waiting room
            room.waitingRoom.set(userId, { id: userId, name, email, ws });
            ws.send(JSON.stringify({ type: "waiting" }));

            // Notify educator
            sendToEducator(room, {
              type: "waiting-list-update",
              waitingRoom: Array.from(room.waitingRoom.values()).map(w => ({ id: w.id, name: w.name, email: w.email }))
            });
            return;
          }

          // Track unique student visit
          if (!room.visitedUsers) room.visitedUsers = new Set();
          if (!room.visitCount) room.visitCount = 56;
          if (!room.visitedUsers.has(userId)) {
            room.visitedUsers.add(userId);
            room.visitCount += 1;
          }

          // Otherwise, join directly or restore state
          const newParticipant = {
            id: userId,
            name,
            email,
            role: "STUDENT",
            isMuted: false,
            handRaised: false,
            status: "active" as const,
            joinedAt: new Date().toISOString(),
            ws,
          };

          room.participants.set(userId, newParticipant);

          // Sync initial state to student
          ws.send(JSON.stringify({
            type: "joined",
            classroom: {
              title: room.title,
              courseName: room.courseName,
              joinCode: room.joinCode,
              isLocked: room.isLocked,
              chatEnabled: room.chatEnabled,
              recordingEnabled: room.recordingEnabled,
              isHostVoiceActive: !!(room as any).isHostVoiceActive,
              visitCount: room.visitCount,
              concurrentUsers: room.participants.size + (room.educatorId ? 1 : 0)
            },
            chat: room.chat,
            questions: room.questions,
            polls: room.polls,
            resources: room.resources,
            whiteboard: room.whiteboard,
            screenSharing: room.screenSharing,
            screenFrame: room.lastScreenFrame,
          }));

          // Notify room of participant change
          broadcastToRoom(room, {
            type: "participants-update",
            participants: Array.from(room.participants.values()).map(p => ({
              id: p.id,
              name: p.name,
              role: p.role,
              isMuted: p.isMuted,
              handRaised: p.handRaised,
              status: p.status,
            })),
            visitCount: room.visitCount,
            concurrentUsers: room.participants.size + (room.educatorId ? 1 : 0)
          });
        }
      }

      // Signal for WebRTC (Forward directly to target user or educator)
      else if (type === "signal") {
        if (!userSession) return;
        const room = rooms.get(userSession.roomCode);
        if (!room) return;

        const { targetId, signal } = message;
        if (targetId === "EDUCATOR" || targetId === room.educatorId) {
          // Forward to educator WS
          sendToEducator(room, {
            type: "signal",
            senderId: userSession.userId,
            signal,
          });
        } else {
          // Forward to specific student WS
          const student = room.participants.get(targetId);
          if (student) {
            student.ws.send(JSON.stringify({
              type: "signal",
              senderId: userSession.userId,
              signal,
            }));
          }
        }
      }

      // Live Chat Message
      else if (type === "chat-message") {
        if (!userSession) return;
        const room = rooms.get(userSession.roomCode);
        if (!room) return;

        // If chat disabled for students, reject
        if (!room.chatEnabled && userSession.role !== "EDUCATOR") {
          return;
        }

        const chatMsg = {
          id: "msg_" + Math.random().toString(36).substring(2, 9),
          senderId: userSession.userId,
          senderName: userSession.name,
          senderRole: userSession.role,
          content: message.content,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isAnnouncement: userSession.role === "EDUCATOR" && !!message.isAnnouncement,
        };

        room.chat.push(chatMsg);
        broadcastToRoom(room, {
          type: "chat-message",
          message: chatMsg,
        });
      }

      // Create Q&A Question
      else if (type === "question-ask") {
        if (!userSession) return;
        const room = rooms.get(userSession.roomCode);
        if (!room) return;

        const newQuestion = {
          id: "q_" + Math.random().toString(36).substring(2, 9),
          senderId: userSession.userId,
          senderName: userSession.name,
          content: message.content,
          upvotes: 0,
          upvotedBy: [],
          isAnswered: false,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };

        room.questions.push(newQuestion);
        broadcastToRoom(room, {
          type: "questions-update",
          questions: room.questions,
        });
      }

      // Upvote Q&A Question
      else if (type === "question-upvote") {
        if (!userSession) return;
        const room = rooms.get(userSession.roomCode);
        if (!room) return;

        const question = room.questions.find(q => q.id === message.questionId);
        if (question) {
          const idx = question.upvotedBy.indexOf(userSession.userId);
          if (idx === -1) {
            question.upvotedBy.push(userSession.userId);
            question.upvotes += 1;
          } else {
            question.upvotedBy.splice(idx, 1);
            question.upvotes = Math.max(0, question.upvotes - 1);
          }
          broadcastToRoom(room, {
            type: "questions-update",
            questions: room.questions,
          });
        }
      }

      // Mark Question Answered
      else if (type === "question-resolve") {
        if (!userSession || userSession.role !== "EDUCATOR") return;
        const room = rooms.get(userSession.roomCode);
        if (!room) return;

        const question = room.questions.find(q => q.id === message.questionId);
        if (question) {
          question.isAnswered = true;
          broadcastToRoom(room, {
            type: "questions-update",
            questions: room.questions,
          });
        }
      }

      // Hand Raise / Lower
      else if (type === "hand-raise") {
        if (!userSession) return;
        const room = rooms.get(userSession.roomCode);
        if (!room) return;

        const participant = room.participants.get(userSession.userId);
        if (participant) {
          participant.handRaised = message.raised;
          broadcastToRoom(room, {
            type: "participants-update",
            participants: Array.from(room.participants.values()).map(p => ({
              id: p.id,
              name: p.name,
              role: p.role,
              isMuted: p.isMuted,
              handRaised: p.handRaised,
              status: p.status,
            }))
          });
        }
      }

      // Whiteboard Draw Sync
      else if (type === "whiteboard-action") {
        if (!userSession) return;
        const room = rooms.get(userSession.roomCode);
        if (!room) return;

        room.whiteboard.push(message.action);
        // Relay to everyone except the sender
        broadcastToRoom(room, {
          type: "whiteboard-action",
          action: message.action,
        }, userSession.userId);
      }

      // Clear Whiteboard
      else if (type === "whiteboard-clear") {
        if (!userSession || userSession.role !== "EDUCATOR") return;
        const room = rooms.get(userSession.roomCode);
        if (!room) return;

        room.whiteboard = [];
        broadcastToRoom(room, {
          type: "whiteboard-clear"
        });
      }

      // Annotations Overlay Sync
      else if (type === "annotation-action") {
        if (!userSession || userSession.role !== "EDUCATOR") return;
        const room = rooms.get(userSession.roomCode);
        if (!room) return;

        room.annotations.push(message.action);
        broadcastToRoom(room, {
          type: "annotation-action",
          action: message.action
        }, userSession.userId);
      }

      // Host Live Microphone Voice Streaming
      else if (type === "host-voice-chunk") {
        if (!userSession || userSession.role !== "EDUCATOR") return;
        const room = rooms.get(userSession.roomCode);
        if (!room) return;

        broadcastToRoom(room, {
          type: "host-voice-chunk",
          pcm: message.pcm,
          sampleRate: message.sampleRate
        }, userSession.userId);
      }

      else if (type === "host-voice-state") {
        if (!userSession || userSession.role !== "EDUCATOR") return;
        const room = rooms.get(userSession.roomCode);
        if (!room) return;

        (room as any).isHostVoiceActive = !!message.active;

        broadcastToRoom(room, {
          type: "host-voice-state",
          active: message.active
        });
      }

      // Clear Annotations
      else if (type === "annotations-clear") {
        if (!userSession || userSession.role !== "EDUCATOR") return;
        const room = rooms.get(userSession.roomCode);
        if (!room) return;

        room.annotations = [];
        broadcastToRoom(room, {
          type: "annotations-clear"
        });
      }

      // Waiting Room Action (Admit/Reject)
      else if (type === "waiting-room-action") {
        if (!userSession || userSession.role !== "EDUCATOR") return;
        const room = rooms.get(userSession.roomCode);
        if (!room) return;

        const { studentId, action } = message;
        const student = room.waitingRoom.get(studentId);

        if (student) {
          room.waitingRoom.delete(studentId);
          
          if (action === "admit") {
            // Track unique student visit
            if (!room.visitedUsers) room.visitedUsers = new Set();
            if (!room.visitCount) room.visitCount = 56;
            if (!room.visitedUsers.has(studentId)) {
              room.visitedUsers.add(studentId);
              room.visitCount += 1;
            }

            const newParticipant = {
              id: student.id,
              name: student.name,
              email: student.email,
              role: "STUDENT" as const,
              isMuted: false,
              handRaised: false,
              status: "active" as const,
              joinedAt: new Date().toISOString(),
              ws: student.ws,
            };
            room.participants.set(studentId, newParticipant);

            // Tell the student WS they are admitted
            student.ws.send(JSON.stringify({
              type: "joined",
              classroom: {
                title: room.title,
                courseName: room.courseName,
                joinCode: room.joinCode,
                isLocked: room.isLocked,
                chatEnabled: room.chatEnabled,
                recordingEnabled: room.recordingEnabled,
                visitCount: room.visitCount,
                concurrentUsers: room.participants.size + (room.educatorId ? 1 : 0)
              },
              chat: room.chat,
              questions: room.questions,
              polls: room.polls,
              resources: room.resources,
              whiteboard: room.whiteboard,
              screenSharing: room.screenSharing,
              screenFrame: room.lastScreenFrame,
            }));

            // Sync participants roster to all
            broadcastToRoom(room, {
              type: "participants-update",
              participants: Array.from(room.participants.values()).map(p => ({
                id: p.id,
                name: p.name,
                role: p.role,
                isMuted: p.isMuted,
                handRaised: p.handRaised,
                status: p.status,
              })),
              visitCount: room.visitCount,
              concurrentUsers: room.participants.size + (room.educatorId ? 1 : 0)
            });
          } else {
            // Rejected
            student.ws.send(JSON.stringify({ type: "rejected" }));
            student.ws.close();
          }

          // Update waiting list for educator
          sendToEducator(room, {
            type: "waiting-list-update",
            waitingRoom: Array.from(room.waitingRoom.values()).map(w => ({ id: w.id, name: w.name }))
          });
        }
      }

      // Poll Creation
      else if (type === "poll-create") {
        if (!userSession || userSession.role !== "EDUCATOR") return;
        const room = rooms.get(userSession.roomCode);
        if (!room) return;

        const newPoll = {
          id: "poll_" + Math.random().toString(36).substring(2, 9),
          question: message.question,
          options: message.options.map((opt: string) => ({
            id: "opt_" + Math.random().toString(36).substring(2, 7),
            text: opt,
            votes: 0
          })),
          isOpen: true,
          isAnonymous: !!message.isAnonymous,
          totalVotes: 0,
          votedUserIds: [],
        };

        room.polls.push(newPoll);
        broadcastToRoom(room, {
          type: "polls-update",
          polls: room.polls,
        });
      }

      // Poll Vote
      else if (type === "poll-vote") {
        if (!userSession) return;
        const room = rooms.get(userSession.roomCode);
        if (!room) return;

        const { pollId, optionId } = message;
        const poll = room.polls.find(p => p.id === pollId);
        if (poll && poll.isOpen) {
          if (!poll.votedUserIds.includes(userSession.userId)) {
            const opt = poll.options.find((o: any) => o.id === optionId);
            if (opt) {
              opt.votes += 1;
              poll.totalVotes += 1;
              poll.votedUserIds.push(userSession.userId);
              broadcastToRoom(room, {
                type: "polls-update",
                polls: room.polls,
              });
            }
          }
        }
      }

      // Poll Close
      else if (type === "poll-close") {
        if (!userSession || userSession.role !== "EDUCATOR") return;
        const room = rooms.get(userSession.roomCode);
        if (!room) return;

        const poll = room.polls.find(p => p.id === message.pollId);
        if (poll) {
          poll.isOpen = false;
          broadcastToRoom(room, {
            type: "polls-update",
            polls: room.polls,
          });
        }
      }

      // Toggle Classroom Lock
      else if (type === "classroom-lock") {
        if (!userSession || userSession.role !== "EDUCATOR") return;
        const room = rooms.get(userSession.roomCode);
        if (!room) return;

        room.isLocked = !!message.isLocked;
        broadcastToRoom(room, {
          type: "classroom-lock-update",
          isLocked: room.isLocked,
        });
      }

      // Screen Share State Signaling
      else if (type === "screen-state") {
        if (!userSession || userSession.role !== "EDUCATOR") return;
        const room = rooms.get(userSession.roomCode);
        if (!room) return;

        room.screenSharing = {
          isSharing: !!message.isSharing,
          mode: message.mode || "balanced",
          isSimulation: !!message.isSimulation,
          slideIdx: typeof message.slideIdx === "number" ? message.slideIdx : 0
        };

        if (!room.screenSharing.isSharing) {
          room.lastScreenFrame = undefined;
        }

        broadcastToRoom(room, {
          type: "screen-state-update",
          screenSharing: room.screenSharing
        }, userSession.userId);
      }

      // WebSocket-based Screen Frame relay (for robust browser/sandbox fallback)
      else if (type === "screen-frame") {
        if (!userSession || userSession.role !== "EDUCATOR") return;
        const room = rooms.get(userSession.roomCode);
        if (!room) return;

        room.lastScreenFrame = message.dataUrl;

        broadcastToRoom(room, {
          type: "screen-frame",
          dataUrl: message.dataUrl
        }, userSession.userId);
      }

      // Simulation slide transition sync
      else if (type === "simulation-slide") {
        if (!userSession || userSession.role !== "EDUCATOR") return;
        const room = rooms.get(userSession.roomCode);
        if (!room) return;

        if (room.screenSharing) {
          room.screenSharing.slideIdx = typeof message.slideIdx === "number" ? message.slideIdx : 0;
        }

        broadcastToRoom(room, {
          type: "simulation-slide-update",
          slideIdx: message.slideIdx
        }, userSession.userId);
      }

      // Populate 20 Simulated/Virtual Students for Testing and Scale Demonstrations
      else if (type === "simulate-audience") {
        if (!userSession || userSession.role !== "EDUCATOR") return;
        const room = rooms.get(userSession.roomCode);
        if (!room) return;

        // Names of simulated students to join
        const mockNames = [
          "Alex Rivera", "Sophia Chen", "Liam Johnson", "Olivia Martinez", "Noah Patel",
          "Emma Wilson", "Jackson Davis", "Ava Thompson", "Lucas Rodriguez", "Isabella Kim",
          "Ethan Thomas", "Mia Garcia", "Mason White", "Charlotte Taylor", "Oliver Anderson",
          "Amelia Lopez", "Elijah Harris", "Harper Martin", "Logan Clark", "Evelyn Lewis"
        ];

        mockNames.forEach((name, index) => {
          const studentId = "sim_" + (index + 1) + "_" + Math.random().toString(36).substring(2, 6);
          
          const simulatedStudent = {
            id: studentId,
            name,
            role: "STUDENT" as const,
            isMuted: false,
            handRaised: false,
            status: "active" as const,
            joinedAt: new Date().toISOString(),
            ws: {
              send: () => {}, // mock send
              close: () => {},
              readyState: 1 // Open
            } as any,
          };

          room.participants.set(studentId, simulatedStudent);
          
          if (!room.visitedUsers) room.visitedUsers = new Set();
          if (!room.visitCount) room.visitCount = 56;
          if (!room.visitedUsers.has(studentId)) {
            room.visitedUsers.add(studentId);
            room.visitCount += 1;
          }
        });

        // Broadcast updated participants list to everyone in room
        broadcastToRoom(room, {
          type: "participants-update",
          participants: Array.from(room.participants.values()).map(p => ({
            id: p.id,
            name: p.name,
            role: p.role,
            isMuted: p.isMuted,
            handRaised: p.handRaised,
            status: p.status,
          })),
          visitCount: room.visitCount,
          concurrentUsers: room.participants.size + (room.educatorId ? 1 : 0)
        });

        // Cast random votes if there are any active polls
        if (room.polls.length > 0) {
          room.polls.forEach(poll => {
            if (poll.isOpen) {
              mockNames.forEach((_, idx) => {
                const studentId = "sim_" + (idx + 1);
                if (Math.random() < 0.75 && !poll.votedUserIds.includes(studentId)) {
                  const randomOption = poll.options[Math.floor(Math.random() * poll.options.length)];
                  if (randomOption) {
                    randomOption.votes += 1;
                    poll.totalVotes += 1;
                    poll.votedUserIds.push(studentId);
                  }
                }
              });
            }
          });

          broadcastToRoom(room, {
            type: "polls-update",
            polls: room.polls,
          });
        }

        // Post 2 initial questions to Q&A Board
        const questionsPool = [
          "Can you explain the difference between STUN and TURN relays once more?",
          "Does WebRTC use TCP or UDP for media transport?",
          "Are video frames in Compatibility Mode compressed as JPEGs?",
          "How does an SFU solve the O(N^2) mesh network scaling problem?",
          "Will we be tested on the JSEP State Machine in the final quiz?",
        ];

        const shuffled = questionsPool.sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 2);

        selected.forEach((qText, idx) => {
          const author = mockNames[Math.floor(Math.random() * mockNames.length)];
          const newQuestion = {
            id: "q_sim_" + Math.random().toString(36).substring(2, 6),
            senderId: "sim_author_" + idx,
            senderName: author,
            content: qText,
            upvotes: Math.floor(Math.random() * 8) + 3,
            upvotedBy: [],
            isAnswered: false,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
          room.questions.push(newQuestion);
        });

        if (selected.length > 0) {
          broadcastToRoom(room, {
            type: "questions-update",
            questions: room.questions,
          });
        }

        // Start dynamic interactivity intervals (hands, chat, emojis)
        if (!(room as any).simulationInterval) {
          (room as any).simulationInterval = setInterval(() => {
            const activeRoom = rooms.get(room.joinCode);
            if (!activeRoom || activeRoom.status === "ended") {
              clearInterval((room as any).simulationInterval);
              (room as any).simulationInterval = null;
              return;
            }

            const simulatedParticipants = Array.from(activeRoom.participants.values()).filter(p => p.id.startsWith("sim_"));
            if (simulatedParticipants.length === 0) {
              clearInterval((room as any).simulationInterval);
              (room as any).simulationInterval = null;
              return;
            }

            const randomActionType = Math.random();
            const luckyStudent = simulatedParticipants[Math.floor(Math.random() * simulatedParticipants.length)];

            if (randomActionType < 0.4) {
              // Toggle hand raise
              luckyStudent.handRaised = !luckyStudent.handRaised;
              broadcastToRoom(activeRoom, {
                type: "participants-update",
                participants: Array.from(activeRoom.participants.values()).map(p => ({
                  id: p.id,
                  name: p.name,
                  role: p.role,
                  isMuted: p.isMuted,
                  handRaised: p.handRaised,
                  status: p.status,
                })),
                visitCount: activeRoom.visitCount,
                concurrentUsers: activeRoom.participants.size + (activeRoom.educatorId ? 1 : 0)
              });
            } else if (randomActionType < 0.8) {
              // Send random chat message
              const messages = [
                "This makes total sense now, thank you!",
                "Great presentation!",
                "Wow, the drawing is super responsive",
                "Can we get a copy of these slides afterward?",
                "Absolutely brilliant explanation 👍",
                "Yes, I agree!",
                "Is the next class at the same time?",
                "Got it!",
                "Whoa, incredible demo!",
                "Loving this interactive board!"
              ];
              const chatMsg = {
                id: "msg_sim_" + Math.random().toString(36).substring(2, 6),
                senderId: luckyStudent.id,
                senderName: luckyStudent.name,
                senderRole: "STUDENT",
                content: messages[Math.floor(Math.random() * messages.length)],
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                isAnnouncement: false,
              };
              activeRoom.chat.push(chatMsg);
              broadcastToRoom(activeRoom, {
                type: "chat-message",
                message: chatMsg,
              });
            } else {
              // Send emoji reaction
              const emojis = ["👏", "👍", "❤️", "💡", "🔥"];
              const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
              broadcastToRoom(activeRoom, {
                type: "emoji-reaction",
                emoji: randomEmoji,
              });
            }
          }, 8000);
        }
      }

      // Floating Emojis Reaction System (Fly up effects)
      else if (type === "emoji-reaction") {
        if (!userSession) return;
        const room = rooms.get(userSession.roomCode);
        if (!room) return;

        broadcastToRoom(room, {
          type: "emoji-reaction",
          senderName: userSession.name,
          emoji: message.emoji,
        }, userSession.userId);
      }

      // Mute / Kick Student
      else if (type === "participant-action") {
        if (!userSession || userSession.role !== "EDUCATOR") return;
        const room = rooms.get(userSession.roomCode);
        if (!room) return;

        const { targetId, action } = message;
        const student = room.participants.get(targetId);
        if (student) {
          if (action === "mute") {
            student.isMuted = !student.isMuted;
            student.ws.send(JSON.stringify({ type: "mute-state", isMuted: student.isMuted }));
            broadcastToRoom(room, {
              type: "participants-update",
              participants: Array.from(room.participants.values()).map(p => ({
                id: p.id,
                name: p.name,
                role: p.role,
                isMuted: p.isMuted,
                handRaised: p.handRaised,
                status: p.status,
              }))
            });
          } else if (action === "kick") {
            student.ws.send(JSON.stringify({ type: "kicked" }));
            student.ws.close();
            room.participants.delete(targetId);
            broadcastToRoom(room, {
              type: "participants-update",
              participants: Array.from(room.participants.values()).map(p => ({
                id: p.id,
                name: p.name,
                role: p.role,
                isMuted: p.isMuted,
                handRaised: p.handRaised,
                status: p.status,
              }))
            });
          }
        }
      }

      // End Classroom for All
      else if (type === "end-session") {
        if (!userSession || userSession.role !== "EDUCATOR") return;
        const room = rooms.get(userSession.roomCode);
        if (!room) return;

        room.status = "ended";
        room.endedAt = new Date().toISOString();

        broadcastToRoom(room, { type: "session-ended" });

        // Close all student connections
        room.participants.forEach(p => p.ws.close());
        room.waitingRoom.forEach(w => w.ws.close());
        room.participants.clear();
        room.waitingRoom.clear();
      }

      // Educator forces stream refresh
      else if (type === "stream-force-refresh") {
        if (!userSession || userSession.role !== "EDUCATOR") return;
        const room = rooms.get(userSession.roomCode);
        if (!room) return;

        broadcastToRoom(room, {
          type: "stream-force-refresh",
          mode: message.mode
        }, userSession.userId);
      }

      // Student requests stream refresh
      else if (type === "request-stream-refresh") {
        if (!userSession) return;
        const room = rooms.get(userSession.roomCode);
        if (!room) return;

        sendToEducator(room, {
          type: "request-stream-refresh",
          userId: userSession.userId,
          name: userSession.name
        });
      }

      // Ping
      else if (type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
      }

    } catch (err) {
      console.error("WS message processing error:", err);
    }
  });

  // Handle client disconnection
  ws.on("close", () => {
    if (userSession) {
      const { userId, role, roomCode } = userSession;
      const room = rooms.get(roomCode);
      if (room) {
        if (role === "EDUCATOR") {
          // Notify students that educator disconnected
          broadcastToRoom(room, { type: "educator-left" });
        } else {
          // Remove from participants
          if (room.participants.has(userId)) {
            room.participants.delete(userId);
            broadcastToRoom(room, {
              type: "participants-update",
              participants: Array.from(room.participants.values()).map(p => ({
                id: p.id,
                name: p.name,
                role: p.role,
                isMuted: p.isMuted,
                handRaised: p.handRaised,
                status: p.status,
              })),
              visitCount: room.visitCount,
              concurrentUsers: room.participants.size + (room.educatorId ? 1 : 0)
            });
          }
          // Remove from waiting room if there
          if (room.waitingRoom.has(userId)) {
            room.waitingRoom.delete(userId);
            sendToEducator(room, {
              type: "waiting-list-update",
              waitingRoom: Array.from(room.waitingRoom.values()).map(w => ({ id: w.id, name: w.name }))
            });
          }
        }
      }
    }
  });
});

// Broadcast utilities
function broadcastToRoom(room: RoomState, payload: any, skipUserId?: string) {
  const json = JSON.stringify(payload);
  
  // Send to educator if exists and not skipping
  if (room.educatorId && skipUserId !== room.educatorId) {
    const activeEdu = Array.from(rooms.values()).find(r => r.educatorId === room.educatorId);
    // Note: since the educator's websocket is held, let's verify if we can locate it or have stored it
  }

  // A cleaner approach: we can iterate room participants and send to all
  room.participants.forEach((student) => {
    if (student.id !== skipUserId && student.ws.readyState === WebSocket.OPEN) {
      student.ws.send(json);
    }
  });

  // Also send to educator websocket if active
  const eduWS = findEducatorWS(room);
  if (eduWS && skipUserId !== room.educatorId && eduWS.readyState === WebSocket.OPEN) {
    eduWS.send(json);
  }
}

function sendToEducator(room: RoomState, payload: any) {
  const eduWS = findEducatorWS(room);
  if (eduWS && eduWS.readyState === WebSocket.OPEN) {
    eduWS.send(JSON.stringify(payload));
  }
}

function findEducatorWS(room: RoomState): WebSocket | null {
  // We can search through any custom stored mapping, or we can look for the WebSocket that identified as the educator.
  // To make it easy, we can store educatorWs reference in RoomState!
  // Let's check: Yes, we should store educatorWs directly in RoomState to avoid scanning.
  // Let's modify our 'join' handler to record room.educatorWs = ws! Yes, let's do that!
  return (room as any).educatorWs || null;
}

// Enhance wss connection logic to set educatorWs in room state
wss.on("connection", (ws: WebSocket) => {
  ws.on("message", (messageStr: string) => {
    try {
      const message = JSON.parse(messageStr);
      if (message.type === "join" && message.role === "EDUCATOR") {
        const room = rooms.get(message.roomCode.toUpperCase());
        if (room) {
          (room as any).educatorWs = ws;
        }
      }
    } catch {}
  });
});


// Serve Static Assets & SPA Fallback (Express + Vite Setup)
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`EduCast Server running on port ${PORT}`);
  });
}

// Coordinate WebSocket upgrades
server.on("upgrade", (request, socket, head) => {
  const pathname = request.url ? new URL(request.url, "http://localhost:3000").pathname : "";
  if (pathname === "/ws") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  }
});

startServer();
