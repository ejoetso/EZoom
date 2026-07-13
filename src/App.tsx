import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Monitor,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Users,
  MessageSquare,
  Lock,
  Unlock,
  LogOut,
  Hand,
  Volume2,
  Sparkles,
  Layers,
  ArrowRight,
  Clipboard,
  Check,
  AlertCircle,
  HelpCircle,
  BookOpen
} from "lucide-react";

import { UserRole, ScreenShareMode } from "./types";
import Lobby from "./components/Lobby";
import Whiteboard from "./components/Whiteboard";
import Annotations from "./components/Annotations";
import ChatAndQA from "./components/ChatAndQA";
import WaitingRoomAndParticipants from "./components/WaitingRoomAndParticipants";
import PollsManager from "./components/PollsManager";
import AIAssistant from "./components/AIAssistant";

// Unique ID Generator
function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export default function App() {
  // Navigation & Screen Control
  const [currentScreen, setCurrentScreen] = useState<"landing" | "lobby" | "classroom" | "post-report">("landing");
  const [role, setRole] = useState<"EDUCATOR" | "STUDENT">("EDUCATOR");
  
  // App Core State
  const [userId] = useState<string>(() => "usr_" + generateId());
  const [userName, setUserName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [classroomTitle, setClassroomTitle] = useState("");
  const [courseName, setCourseName] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [waitingRoomEnabled, setWaitingRoomEnabled] = useState(true);
  const [recordingEnabled, setRecordingEnabled] = useState(false);

  // Connection and Socket State
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected" | "waiting" | "rejected">("disconnected");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [educatorError, setEducatorError] = useState<string | null>(null);
  const [broadcastingPassword, setBroadcastingPassword] = useState("");
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Synchronized Lists
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [polls, setPolls] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [waitingRoom, setWaitingRoom] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [whiteboardHistory, setWhiteboardHistory] = useState<any[]>([]);
  const [visitCount, setVisitCount] = useState<number>(56);
  const [concurrentUsers, setConcurrentUsers] = useState<number>(1);

  // Local/Live Audio/Video tracks
  const [micMuted, setMicMuted] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [screenShareQuality, setScreenShareQuality] = useState<ScreenShareMode>("balanced");
  const [isAnnotationsActive, setIsAnnotationsActive] = useState(false);
  
  // Display Mode switcher: "screen" or "whiteboard"
  const [activeStage, setActiveStage] = useState<"screen" | "whiteboard">("whiteboard");

  // WebRTC Peer Connections map for Educator (Student ID -> RTCPeerConnection)
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  const studentPeerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);

  const [remoteScreenStream, setRemoteScreenStream] = useState<MediaStream | null>(null);
  const [remoteScreenFrame, setRemoteScreenFrame] = useState<string | null>(null);
  const [streamMode, setStreamMode] = useState<"video" | "compatibility">("compatibility");
  const peerCandidatesRef = useRef<Record<string, RTCIceCandidate[]>>({});
  const studentCandidatesRef = useRef<RTCIceCandidate[]>([]);

  // Reactive floating emojis system
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: string; emoji: string; x: number }[]>([]);

  // Simulation fallback states if standard browser navigator.mediaDevices.getDisplayMedia is blocked by iframe constraints
  const [isSimulationActive, setIsSimulationActive] = useState(false);
  const [simulationFrameIdx, setSimulationFrameIdx] = useState(0);

  // Hands up state for local student
  const [handRaised, setHandRaised] = useState(false);

  // Initialize a classroom from Landing page (for Educators)
  const handleCreateClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classroomTitle || !userName) return;

    if (broadcastingPassword !== "97807723") {
      setEducatorError("Incorrect broadcasting password. Please enter the correct password to host/start broadcasting.");
      return;
    }

    setEducatorError(null);
    try {
      const response = await fetch("/api/classrooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: classroomTitle,
          courseName,
          educatorName: userName,
          waitingRoom: waitingRoomEnabled,
          chatEnabled,
          recording: recordingEnabled,
          password: broadcastingPassword,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to create classroom session");
      }

      const data = await response.json();
      setRoomCode(data.joinCode);
      setRole("EDUCATOR");
      setCurrentScreen("lobby");
    } catch (err: any) {
      setEducatorError(err.message || "Could not spin up educator classroom.");
    }
  };

  // Pre-join verification for students (Checking room code validity)
  const handleStudentJoinCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode || !userName) return;

    setErrorText(null);
    try {
      const response = await fetch(`/api/classrooms/${roomCode.toUpperCase()}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Classroom code is invalid or expired.");
      }

      const data = await response.json();
      setClassroomTitle(data.title);
      setCourseName(data.courseName);
      setRole("STUDENT");
      setCurrentScreen("lobby");
    } catch (err: any) {
      setErrorText(err.message || "Failed to locate classroom session.");
    }
  };

  // Launch WS signaling and start connection
  const handleLaunchClassroom = (settings: {
    micEnabled: boolean;
    camEnabled: boolean;
    qualityMode: ScreenShareMode;
  }) => {
    setMicMuted(!settings.micEnabled);
    setScreenShareQuality(settings.qualityMode);
    setConnectionStatus("connecting");

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.addEventListener("open", () => {
      setConnectionStatus("connected");
      // Join signaling channel
      socket.send(JSON.stringify({
        type: "join",
        userId,
        name: userName,
        role,
        roomCode: roomCode.toUpperCase(),
      }));
    });

    socket.addEventListener("message", async (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "waiting") {
          setConnectionStatus("waiting");
        } 
        
        else if (data.type === "rejected") {
          setConnectionStatus("rejected");
          socket.close();
        }

        else if (data.type === "joined") {
          setConnectionStatus("connected");
          setCurrentScreen("classroom");
          
          if (data.chat) setChatMessages(data.chat);
          if (data.questions) setQuestions(data.questions);
          if (data.polls) setPolls(data.polls);
          if (data.resources) setResources(data.resources);
          if (data.whiteboard) setWhiteboardHistory(data.whiteboard);
          if (data.participants) setParticipants(data.participants);
          if (data.waitingRoom) setWaitingRoom(data.waitingRoom);
          if (data.classroom) {
            if (data.classroom.visitCount !== undefined) {
              setVisitCount(data.classroom.visitCount);
            }
            if (data.classroom.concurrentUsers !== undefined) {
              setConcurrentUsers(data.classroom.concurrentUsers);
            }
          }

          if (data.screenSharing) {
            if (data.screenSharing.isSharing) {
              setActiveStage("screen");
              setIsSharingScreen(true);
              setIsSimulationActive(!!data.screenSharing.isSimulation);
              if (data.screenSharing.slideIdx !== undefined) {
                setSimulationFrameIdx(data.screenSharing.slideIdx);
              }
              if (data.screenFrame) {
                setRemoteScreenFrame(data.screenFrame);
              }
            }
          }
        }

        else if (data.type === "chat-message") {
          setChatMessages((prev) => [...prev, data.message]);
        }

        else if (data.type === "questions-update") {
          setQuestions(data.questions);
        }

        else if (data.type === "polls-update") {
          setPolls(data.polls);
        }

        else if (data.type === "resource-added") {
          setResources((prev) => [...prev, data.resource]);
        }

        else if (data.type === "participants-update") {
          setParticipants(data.participants);
          if (data.visitCount !== undefined) {
            setVisitCount(data.visitCount);
          }
          if (data.concurrentUsers !== undefined) {
            setConcurrentUsers(data.concurrentUsers);
          }
        }

        else if (data.type === "waiting-list-update") {
          setWaitingRoom(data.waitingRoom);
        }

        else if (data.type === "classroom-lock-update") {
          setIsLocked(data.isLocked);
        }

        else if (data.type === "screen-state-update") {
          if (data.screenSharing.isSharing) {
            setActiveStage("screen");
            setIsSharingScreen(true);
            setIsSimulationActive(!!data.screenSharing.isSimulation);
            if (data.screenSharing.slideIdx !== undefined) {
              setSimulationFrameIdx(data.screenSharing.slideIdx);
            }
          } else {
            setActiveStage("whiteboard");
            setIsSharingScreen(false);
            setIsSimulationActive(false);
            setRemoteScreenStream(null);
            setRemoteScreenFrame(null);
            if (studentPeerConnectionRef.current) {
              try {
                studentPeerConnectionRef.current.close();
              } catch {}
              studentPeerConnectionRef.current = null;
            }
            studentCandidatesRef.current = [];
          }
        }

        else if (data.type === "screen-frame") {
          setRemoteScreenFrame(data.dataUrl);
        }

        else if (data.type === "simulation-slide-update") {
          if (data.slideIdx !== undefined) {
            setSimulationFrameIdx(data.slideIdx);
          }
        }

        else if (data.type === "emoji-reaction") {
          triggerEmojiFloat(data.emoji);
        }

        else if (data.type === "session-ended") {
          socket.close();
          setCurrentScreen("post-report");
        }

        else if (data.type === "mute-state") {
          setMicMuted(data.isMuted);
        }

        else if (data.type === "kicked") {
          socket.close();
          setConnectionStatus("disconnected");
          setCurrentScreen("landing");
          alert("You have been removed from the classroom by the educator.");
        }

        // WebRTC Signaller (Offer / Answer / ICE candidates)
        else if (data.type === "signal") {
          const { senderId, signal } = data;
          
          if (role === "EDUCATOR") {
            const pc = peerConnectionsRef.current[senderId];
            if (pc) {
              if (signal.sdp) {
                await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                // Process and clear buffered ICE candidates
                const buffered = peerCandidatesRef.current[senderId] || [];
                for (const candidate of buffered) {
                  try {
                    await pc.addIceCandidate(candidate);
                  } catch (e) {
                    console.warn("Error adding buffered candidate on Educator side:", e);
                  }
                }
                peerCandidatesRef.current[senderId] = [];
              } else if (signal.candidate) {
                const cand = new RTCIceCandidate(signal.candidate);
                if (pc.remoteDescription) {
                  await pc.addIceCandidate(cand);
                } else {
                  if (!peerCandidatesRef.current[senderId]) {
                    peerCandidatesRef.current[senderId] = [];
                  }
                  peerCandidatesRef.current[senderId].push(cand);
                }
              }
            }
          } else {
            // Student side PeerConnection setup
            let pc = studentPeerConnectionRef.current;
            if (!pc) {
              pc = createStudentPeerConnection(senderId, socket);
            }
            if (signal.sdp) {
              await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
              if (signal.sdp.type === "offer") {
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.send(JSON.stringify({
                  type: "signal",
                  targetId: senderId,
                  signal: { sdp: answer }
                }));
              }
              // Process and clear student-side buffered ICE candidates
              const buffered = studentCandidatesRef.current;
              for (const candidate of buffered) {
                try {
                  await pc.addIceCandidate(candidate);
                } catch (e) {
                  console.warn("Error adding buffered candidate on Student side:", e);
                }
              }
              studentCandidatesRef.current = [];
            } else if (signal.candidate) {
              const cand = new RTCIceCandidate(signal.candidate);
              if (pc.remoteDescription) {
                await pc.addIceCandidate(cand);
              } else {
                studentCandidatesRef.current.push(cand);
              }
            }
          }
        }

      } catch (err) {
        console.error("WS error processing incoming message:", err);
      }
    });

    socket.addEventListener("close", () => {
      setConnectionStatus("disconnected");
    });

    setWs(socket);
  };

  // Educators trigger genuine WebRTC screen stream or simulation fallback
  const handleStartScreenShare = async () => {
    if (isSharingScreen) {
      // Stop sharing
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        setScreenStream(null);
      }
      setIsSharingScreen(false);
      setIsSimulationActive(false);
      setActiveStage("whiteboard");
      
      // Sync state Stop over WS
      if (ws) {
        ws.send(JSON.stringify({
          type: "screen-state",
          isSharing: false,
          mode: screenShareQuality,
          isSimulation: false,
          slideIdx: 0
        }));
      }
      return;
    }

    try {
      // standard DisplayMedia
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 15, max: 30 }
        },
        audio: true
      });

      setScreenStream(stream);
      setIsSharingScreen(true);
      setActiveStage("screen");

      // Set contentHint for text sharpness
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.contentHint = "detail";
        videoTrack.addEventListener("ended", () => {
          setIsSharingScreen(false);
          setActiveStage("whiteboard");
        });
      }

      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
      }

      // Distribute stream to all active student PeerConnections
      participants.forEach((student) => {
        setupEducatorPeerConnection(student.id, stream);
      });

      // Send start state to websocket
      if (ws) {
        ws.send(JSON.stringify({
          type: "screen-state",
          isSharing: true,
          mode: screenShareQuality,
          isSimulation: false,
          slideIdx: 0
        }));
      }

    } catch (err: any) {
      console.warn("DisplayMedia blocked or unavailable. Falling back to high-fidelity Classroom Simulation:", err);
      // Fallback: high-fidelity whiteboard presentation slide loop
      setIsSimulationActive(true);
      setIsSharingScreen(true);
      setActiveStage("screen");

      if (ws) {
        ws.send(JSON.stringify({
          type: "screen-state",
          isSharing: true,
          mode: screenShareQuality,
          isSimulation: true,
          slideIdx: 0
        }));
      }
    }
  };

  // Simulation Frame Slide Loop
  useEffect(() => {
    let interval: any;
    if (isSimulationActive && role === "EDUCATOR") {
      interval = setInterval(() => {
        setSimulationFrameIdx((prev) => {
          const nextIdx = (prev + 1) % 4;
          if (ws) {
            ws.send(JSON.stringify({
              type: "simulation-slide",
              slideIdx: nextIdx
            }));
          }
          return nextIdx;
        });
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [isSimulationActive, role, ws]);

  // Real-time Canvas-based frame capturing fallback for WebRTC-restricted iframe environments
  useEffect(() => {
    if (role !== "EDUCATOR" || !isSharingScreen || !screenStream) return;

    let intervalId: any;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const captureFrame = () => {
      const video = screenVideoRef.current;
      if (video && video.videoWidth && video.videoHeight && ws && ws.readyState === WebSocket.OPEN) {
        // scale down for optimal bandwidth/performance
        const scale = Math.min(960 / video.videoWidth, 540 / video.videoHeight, 1);
        canvas.width = video.videoWidth * scale;
        canvas.height = video.videoHeight * scale;
        
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        try {
          const dataUrl = canvas.toDataURL("image/jpeg", 0.45);
          ws.send(JSON.stringify({
            type: "screen-frame",
            dataUrl
          }));
        } catch (e) {
          console.error("Failed to capture or send screen frame:", e);
        }
      }
    };

    // Capture every 1000ms for stable compatibility broadcast
    intervalId = setInterval(captureFrame, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [role, isSharingScreen, screenStream, ws]);

  // Synchronize local or remote screen share stream with the HTML5 Video element whenever it is rendered or updated
  const videoRefCallback = useCallback((node: HTMLVideoElement | null) => {
    if (node) {
      (screenVideoRef as any).current = node;
      const activeStream = role === "EDUCATOR" ? screenStream : remoteScreenStream;
      if (activeStream && node.srcObject !== activeStream) {
        node.srcObject = activeStream;
      }
      node.play().catch((err) => console.warn("Auto-play blocked or failed:", err));
    }
  }, [screenStream, remoteScreenStream, role]);

  useEffect(() => {
    const videoEl = screenVideoRef.current;
    if (videoEl) {
      if (role === "EDUCATOR") {
        if (screenStream && videoEl.srcObject !== screenStream) {
          videoEl.srcObject = screenStream;
        }
      } else {
        if (remoteScreenStream && videoEl.srcObject !== remoteScreenStream) {
          videoEl.srcObject = remoteScreenStream;
        }
      }
    }
  }, [screenStream, remoteScreenStream, activeStage, currentScreen, role]);

  // PeerConnection creation helper for Educator (distributing streams to newly admitted student)
  const setupEducatorPeerConnection = async (studentId: string, stream: MediaStream) => {
    if (!ws) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    peerConnectionsRef.current[studentId] = pc;

    // Attach screen tracks
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        ws.send(JSON.stringify({
          type: "signal",
          targetId: studentId,
          signal: { candidate: e.candidate }
        }));
      }
    };

    // Create Offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    ws.send(JSON.stringify({
      type: "signal",
      targetId: studentId,
      signal: { sdp: offer }
    }));
  };

  // PeerConnection creation helper for Student (subscribing to Educator's screen broadcast)
  const createStudentPeerConnection = (educatorId: string, socket: WebSocket): RTCPeerConnection => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    studentPeerConnectionRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.send(JSON.stringify({
          type: "signal",
          targetId: educatorId || "EDUCATOR",
          signal: { candidate: e.candidate }
        }));
      }
    };

    pc.ontrack = (event) => {
      console.log("Student received remote stream track:", event.streams[0]);
      if (event.streams && event.streams[0]) {
        setRemoteScreenStream(event.streams[0]);
      }
    };

    return pc;
  };

  // Admitted student notifier triggered from educator list
  useEffect(() => {
    if (role === "EDUCATOR" && isSharingScreen && screenStream) {
      // Ensure any newly added student gets the tracks
      participants.forEach((student) => {
        if (!peerConnectionsRef.current[student.id]) {
          setupEducatorPeerConnection(student.id, screenStream);
        }
      });
    }
  }, [participants]);

  // Raise / Lower Hand for Student
  const handleRaiseHand = () => {
    if (!ws) return;
    const nextState = !handRaised;
    setHandRaised(nextState);
    ws.send(JSON.stringify({
      type: "hand-raise",
      raised: nextState,
    }));
  };

  // Emoji trigger system (sending micro emotional triggers)
  const sendEmojiReaction = (emoji: string) => {
    if (!ws) return;
    ws.send(JSON.stringify({
      type: "emoji-reaction",
      emoji
    }));
    triggerEmojiFloat(emoji);
  };

  const triggerEmojiFloat = (emoji: string) => {
    const id = Math.random().toString();
    const x = Math.floor(Math.random() * 60) + 20; // 20% to 80% screen width
    setFloatingEmojis((prev) => [...prev, { id, emoji, x }]);

    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((item) => item.id !== id));
    }, 2000);
  };

  // End Classroom Session
  const handleEndClassroom = () => {
    // Stop local screen sharing stream tracks if active
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
    }
    // Clean up local PeerConnections
    Object.keys(peerConnectionsRef.current).forEach((key) => {
      try {
        peerConnectionsRef.current[key].close();
      } catch {}
    });
    peerConnectionsRef.current = {};
    peerCandidatesRef.current = {};

    if (studentPeerConnectionRef.current) {
      try {
        studentPeerConnectionRef.current.close();
      } catch {}
      studentPeerConnectionRef.current = null;
    }
    studentCandidatesRef.current = [];
    setRemoteScreenStream(null);

    if (ws && role === "EDUCATOR") {
      ws.send(JSON.stringify({ type: "end-session" }));
    } else {
      if (ws) ws.close();
      setCurrentScreen("post-report");
    }
  };

  // Copy join code helper
  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  // Simulated presentations slide frames
  const simulationSlides = [
    {
      title: "Introduction to Advanced WebRTC Architecture",
      subtitle: "Signaling vs Media, SFU Topology, and UDP Hole Punching",
      bullets: [
        "Signaling transfers session description protocol (SDP) details and ICE candidates over secure HTTP/WebSockets.",
        "SFU (Selective Forwarding Unit) receives one upload stream and distributes copies, reducing CPU overhead on edge devices.",
        "STUN resolves server-reflexive IP addresses; TURN acts as relay fallback for strict symmetric NATs.",
      ]
    },
    {
      title: "SDP Negotiation Sequence Diagram",
      subtitle: "The JSEP (JavaScript Session Establishment Protocol) State Machine",
      bullets: [
        "Step 1: Educator sets local offer, transmits details to signalling hub.",
        "Step 2: Signaling routes offer SDP parameters to candidate student list.",
        "Step 3: Student sets remote offer, creates answer SDP, returns to Educator.",
      ]
    },
    {
      title: "Optimizing Text Clarity & Code Readability",
      subtitle: "Why Content Hints Matter",
      bullets: [
        "Detail ContentHint: enforces sharp crisp text lines, high fidelity, lower frames (5-15 FPS).",
        "Motion ContentHint: prioritizes smooth movement and framerates, compresses lines.",
        "Adaptive Bitrate: Scales layers matching student bandwidth without slowing the whole class.",
      ]
    },
    {
      title: "Interactive Whiteboard & Annotation Layers",
      subtitle: "Visualizing Coordinate Normalization",
      bullets: [
        "Normalization: Mapping click coordinates relative (0.0 to 1.0) on standard 1080p canvas bounds.",
        "Sync: Drawing actions are encoded as compressed delta events transmitted instantly.",
        "Dual Stage: Seamless toggling between standard full-desktop sharing and visual digital whiteboard drawing.",
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      
      {/* Floating Emojis Reaction Layer */}
      <div className="fixed bottom-12 right-12 z-50 pointer-events-none w-72 h-[450px] overflow-hidden flex justify-center">
        {floatingEmojis.map((item) => (
          <span
            key={item.id}
            className="absolute bottom-0 text-4xl animate-floatUp"
            style={{ left: `${item.x}%` }}
          >
            {item.emoji}
          </span>
        ))}
      </div>

      {/* 1. Landing Screen */}
      {currentScreen === "landing" && (
        <div className="max-w-5xl mx-auto px-4 py-12 flex flex-col items-center justify-center min-h-[90vh]">
          
          <div className="text-center space-y-3.5 mb-10 max-w-2xl">
            <div className="bg-slate-900 text-white w-14 h-14 rounded-2xl flex items-center justify-center mx-auto shadow-md">
              <Monitor className="w-8 h-8 text-emerald-400 stroke-[1.5]" />
            </div>
            <h1 className="text-4xl font-bold font-sans tracking-tight text-slate-900 sm:text-5xl">
              EjoeCast Platform
            </h1>
            <p className="text-sm font-sans text-slate-500 leading-relaxed">
              Secure, low-latency screen-broadcasting and collaborative digital whiteboard built for modern educators, schools, and training organizations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
            
            {/* Educator Creation Column */}
            <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <span className="bg-emerald-50 text-emerald-800 text-[10px] font-mono px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                  Educator Portal
                </span>
                <h2 className="text-2xl font-sans font-semibold text-slate-900">Start a Broadcasting Class</h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Establish a secure classroom space. Screen broadcast, use annotation pens on top of code displays, run real-time polls, and sync whiteboards.
                </p>
              </div>

              <form onSubmit={handleCreateClassroom} className="space-y-4 pt-4">
                {educatorError && (
                  <div className="bg-red-50 border border-red-200 text-red-800 p-3.5 rounded-xl text-xs flex items-start gap-2 animate-fadeIn">
                    <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5 text-red-600" />
                    <span>{educatorError}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[11px] font-sans font-medium text-slate-600">Your Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. Ada Lovelace"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs font-sans focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-sans font-medium text-slate-600">Classroom Lecture Title</label>
                  <input
                    type="text"
                    placeholder="e.g. WebRTC In-Depth and SFU Topology"
                    value={classroomTitle}
                    onChange={(e) => setClassroomTitle(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs font-sans focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-sans font-medium text-slate-600">Unit / Course Name (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. CS-401 Network Engineering"
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs font-sans focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-sans font-medium text-slate-600">Password for Broadcasting</label>
                    <span className="text-[10px] font-sans text-slate-400 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-amber-500" /> Required
                    </span>
                  </div>
                  <input
                    type="password"
                    placeholder="Enter the broadcasting authorization password"
                    value={broadcastingPassword}
                    onChange={(e) => setBroadcastingPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs font-sans focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all"
                    required
                  />
                </div>

                {/* Feature Toggles */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="flex items-center gap-2 text-xs font-sans text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={waitingRoomEnabled}
                      onChange={(e) => setWaitingRoomEnabled(e.target.checked)}
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    Enable Waiting Room Approval check
                  </label>
                  <label className="flex items-center gap-2 text-xs font-sans text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={chatEnabled}
                      onChange={(e) => setChatEnabled(e.target.checked)}
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    Enable Student General Chat
                  </label>
                </div>

                <button
                  id="create_class_submit"
                  type="submit"
                  className="w-full bg-slate-900 hover:bg-slate-800 active:bg-slate-955 text-white py-3.5 rounded-xl text-xs font-sans font-semibold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  Create Session Code <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* Student Joining Column */}
            <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <span className="bg-slate-100 text-slate-800 text-[10px] font-mono px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                  Student Portal
                </span>
                <h2 className="text-2xl font-sans font-semibold text-slate-900">Join a Classroom Room</h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Enter your assigned classroom invitation code. Enjoy low-latency screen sharing, download lecture notes, answer polls, and draw on collaborative canvases.
                </p>
              </div>

              <form onSubmit={handleStudentJoinCheck} className="space-y-5 pt-4">
                {errorText && (
                  <div className="bg-red-50 border border-red-200 text-red-800 p-3.5 rounded-xl text-xs flex items-start gap-2 animate-fadeIn">
                    <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5 text-red-600" />
                    <span>{errorText}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[11px] font-sans font-medium text-slate-600">Your Nickname</label>
                  <input
                    type="text"
                    placeholder="e.g. Richard Feynman"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs font-sans focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-sans font-medium text-slate-600">Classroom Code (EDU-XXXX-XX)</label>
                  <input
                    type="text"
                    placeholder="e.g. EDU-7K4P-92"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs font-sans focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all"
                    required
                  />
                </div>

                <button
                  id="join_class_submit"
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white py-3.5 rounded-xl text-xs font-sans font-semibold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  Verify Code & Lobby <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>

          </div>

        </div>
      )}

      {/* 2. Device Pre-Class Lobby Screen */}
      {currentScreen === "lobby" && (
        <Lobby
          onJoin={handleLaunchClassroom}
          title={classroomTitle}
          courseName={courseName}
          role={role}
        />
      )}

      {/* 3. Waiting Approval overlay state */}
      {connectionStatus === "waiting" && (
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
          <div className="w-full max-w-md bg-white border border-slate-150 p-8 rounded-3xl shadow-xl text-center space-y-4">
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto animate-bounce">
              <Users className="w-6 h-6 text-amber-600" />
            </div>
            <h2 className="text-xl font-sans font-semibold text-slate-950">Waiting for Educator Approval</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Hello <span className="font-semibold">{userName}</span>, you are currently in the waiting room for room <span className="font-semibold font-mono">{roomCode}</span>.
            </p>
            <p className="text-[11px] text-amber-700 font-sans italic bg-amber-50 py-2 rounded-xl">
              The Professor is notifying and verifying students... Please hold.
            </p>
          </div>
        </div>
      )}

      {connectionStatus === "rejected" && (
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
          <div className="w-full max-w-md bg-white border border-red-150 p-8 rounded-3xl shadow-xl text-center space-y-4">
            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="text-xl font-sans font-semibold text-slate-950">Access Denied</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Your request to join the classroom was declined by the educator.
            </p>
            <button
              onClick={() => setCurrentScreen("landing")}
              className="text-xs bg-slate-900 text-white px-4 py-2 rounded-xl"
            >
              Back to Portal
            </button>
          </div>
        </div>
      )}

      {/* 4. Live Classroom Dashboard Workspace */}
      {currentScreen === "classroom" && (
        <div className="p-4 md:p-6 space-y-5">
          
          {/* Top Panel Navigation Bar */}
          <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4 shadow-md border border-slate-800">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-500 text-slate-950 w-9 h-9 rounded-xl flex items-center justify-center shadow-inner">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">{courseName}</span>
                <h1 className="text-sm md:text-base font-sans font-semibold text-white leading-tight">{classroomTitle}</h1>
              </div>
            </div>

            {/* Middle widgets: Join Code clipboard copy */}
            <div className="flex items-center gap-3.5">
              <div className="bg-slate-800/80 border border-slate-750 px-3.5 py-1.5 rounded-xl backdrop-blur-md font-mono text-xs flex items-center gap-2">
                <span className="text-slate-400">Classroom Code:</span>
                <span className="text-white font-bold">{roomCode}</span>
                <button
                  id="copy_code_btn"
                  onClick={handleCopyCode}
                  className="text-slate-400 hover:text-white p-1 rounded transition-colors cursor-pointer"
                  title="Copy Join Code"
                >
                  {copyFeedback ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Clipboard className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Live status beacon */}
              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm relative">
                  <span className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-75"></span>
                </span>
                <span className="text-emerald-400 font-bold uppercase tracking-wider text-[10px]">LIVE BROADCAST</span>
              </div>

              {/* Visit Count & Concurrent Users */}
              <div className="flex items-center gap-4 bg-slate-800/80 border border-slate-750 px-3.5 py-1.5 rounded-xl backdrop-blur-md">
                <div className="flex flex-col text-left">
                  <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider leading-none mb-1.5">Visits</span>
                  <span className="text-white font-bold font-mono text-xs leading-none">
                    {visitCount}
                  </span>
                </div>
                <div className="h-4 w-px bg-slate-700"></div>
                <div className="flex flex-col text-left">
                  <span className="text-[9px] text-emerald-400/95 font-mono uppercase tracking-wider leading-none mb-1.5">Active</span>
                  <span className="text-emerald-400 font-bold font-mono text-xs leading-none flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse inline-block"></span>
                    {concurrentUsers}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions: Leave / Terminate */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-slate-400">Role: <span className="font-bold text-white uppercase">{role}</span></span>
              
              <button
                id="leave_session_btn"
                onClick={handleEndClassroom}
                className="bg-red-600/95 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-xs font-sans font-medium transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                {role === "EDUCATOR" ? "End Class for All" : "Leave Class"}
              </button>
            </div>
          </div>

          {/* Main Stage Grid System */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Left/Center Stage: Core Media & Whiteboard Workspace */}
            <div className="lg:col-span-3 space-y-4">
              
              {/* Media Switcher Headers */}
              <div className="flex justify-between items-center flex-wrap gap-2 w-full">
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveStage("whiteboard")}
                    className={`px-4 py-2 rounded-xl text-xs font-sans font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      activeStage === "whiteboard"
                        ? "bg-slate-900 text-white shadow-sm"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    Digital Whiteboard Drawing
                  </button>

                  <button
                    onClick={() => {
                      if (isSharingScreen) {
                        setActiveStage("screen");
                      } else if (role === "EDUCATOR") {
                        handleStartScreenShare();
                      }
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-sans font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      activeStage === "screen"
                        ? "bg-slate-900 text-white shadow-sm"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Monitor className="w-4 h-4" />
                    Screen Share Stream {isSharingScreen && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>}
                  </button>
                </div>

                {activeStage === "screen" && role === "STUDENT" && isSharingScreen && !isSimulationActive && (
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-xs">
                    <button
                      onClick={() => setStreamMode("compatibility")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-sans font-semibold transition-all cursor-pointer ${
                        streamMode === "compatibility"
                          ? "bg-slate-900 text-white shadow-xs"
                          : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900"
                      }`}
                    >
                      Stable Stream (WebSocket)
                    </button>
                    <button
                      onClick={() => setStreamMode("video")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-sans font-semibold transition-all cursor-pointer ${
                        streamMode === "video"
                          ? "bg-slate-900 text-white shadow-xs"
                          : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900"
                      }`}
                    >
                      Real-Time Video (WebRTC)
                    </button>
                  </div>
                )}
              </div>

              {/* Main Presentation Screen */}
              <div className="aspect-video w-full rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden relative">
                
                {activeStage === "whiteboard" ? (
                  <Whiteboard
                    ws={ws}
                    role={role}
                    roomCode={roomCode}
                    initialHistory={whiteboardHistory}
                  />
                ) : (
                  /* Screen Share Video Stream Layer */
                  <div className="w-full h-full relative flex items-center justify-center">
                    {/* Simulated High-Fidelity presentation slide fallbacks for development/iframe boxes */}
                    {isSimulationActive ? (
                      <div className="w-full h-full bg-slate-950 p-12 text-white flex flex-col justify-between select-none animate-fadeIn">
                        
                        {/* Slide Top bar */}
                        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                          <div className="space-y-1">
                            <span className="text-[9px] font-mono tracking-widest text-emerald-400 uppercase">EDUCAST HIGH-FIDELITY SCREEN SIMULATOR</span>
                            <h3 className="text-xl font-bold font-sans tracking-tight text-white">{simulationSlides[simulationFrameIdx].title}</h3>
                          </div>
                          <span className="text-xs font-mono text-slate-500">Slide {simulationFrameIdx + 1} of 4</span>
                        </div>

                        {/* Slide Content */}
                        <div className="space-y-6 flex-1 py-6">
                          <p className="text-slate-400 text-sm font-sans italic">{simulationSlides[simulationFrameIdx].subtitle}</p>
                          <ul className="space-y-4">
                            {simulationSlides[simulationFrameIdx].bullets.map((bullet, index) => (
                              <li key={index} className="flex gap-2 text-xs font-sans text-slate-200">
                                <span className="text-emerald-500 font-mono">•</span>
                                <span>{bullet}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Slide Footer */}
                        <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 border-t border-slate-850 pt-4">
                          <span>Educator: {userName}</span>
                          <span>Interactive Presentation Sandbox Mode</span>
                        </div>

                      </div>
                    ) : (
                      /* Real WebRTC HTML5 Video stream playback with high-compatibility image stream fallback */
                      role === "STUDENT" && streamMode === "compatibility" ? (
                        remoteScreenFrame ? (
                          <img
                            src={remoteScreenFrame}
                            alt="Educator Screen Stream (Compatibility Mode)"
                            className="w-full h-full object-contain bg-slate-950 select-none"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-400 gap-3">
                            <div className="w-8 h-8 border-2 border-slate-700 border-t-emerald-500 rounded-full animate-spin"></div>
                            <span className="text-xs font-mono tracking-wide text-slate-400">Waiting for stable stream frames...</span>
                          </div>
                        )
                      ) : (
                        <video
                          ref={videoRefCallback}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-contain bg-slate-950"
                        />
                      )
                    )}

                    {/* Annotations drawing Canvas Overlay */}
                    <Annotations
                      ws={ws}
                      role={role}
                      isActive={isAnnotationsActive}
                    />

                    {/* Laser Pointer Spotlight Status label */}
                    {isAnnotationsActive && (
                      <div className="absolute bottom-4 left-4 bg-slate-950/70 border border-slate-850 text-[10px] text-red-400 font-mono px-3 py-1.5 rounded-full backdrop-blur-md flex items-center gap-1.5 z-20">
                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></span>
                        ANNOTATIONS ON TOP OF SCREEN ENABLED
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom Control Toolbar */}
              <div className="bg-white border border-slate-200/60 p-4 rounded-2xl shadow-sm flex flex-wrap justify-between items-center gap-4">
                
                {/* Media togglers */}
                <div className="flex gap-2">
                  <button
                    id="stage_mic_mute"
                    onClick={() => setMicMuted(!micMuted)}
                    className={`p-3 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-sans font-medium cursor-pointer ${
                      micMuted
                        ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {micMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    {micMuted ? "Unmute Mic" : "Mute Mic"}
                  </button>

                  {role === "EDUCATOR" && (
                    <button
                      id="stage_screenshare_toggle"
                      onClick={handleStartScreenShare}
                      className={`p-3 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-sans font-medium cursor-pointer ${
                        isSharingScreen
                          ? "bg-slate-900 border-slate-950 text-white"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <Monitor className="w-4 h-4" />
                      {isSharingScreen ? "Stop Screen Share" : "Share Screen"}
                    </button>
                  )}

                  {role === "EDUCATOR" && isSharingScreen && (
                    <button
                      onClick={() => setIsAnnotationsActive(!isAnnotationsActive)}
                      className={`p-3 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-sans font-medium cursor-pointer ${
                        isAnnotationsActive
                          ? "bg-emerald-600 border-emerald-700 text-white"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <Layers className="w-4 h-4" />
                      {isAnnotationsActive ? "Hide Annotations" : "Draw over Screen"}
                    </button>
                  )}

                  {role === "STUDENT" && (
                    <button
                      id="stage_hand_raise"
                      onClick={handleRaiseHand}
                      className={`p-3 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-sans font-medium cursor-pointer ${
                        handRaised
                          ? "bg-amber-100 border-amber-200 text-amber-800"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <Hand className="w-4 h-4" />
                      {handRaised ? "Lower Hand" : "Raise Hand"}
                    </button>
                  )}
                </div>

                {/* Micro Reactions triggers */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-250/20 px-3 py-1.5 rounded-2xl">
                  <span className="text-[10px] font-mono text-slate-400 mr-1.5 uppercase">Reactions:</span>
                  {["👏", "👍", "❤️", "💡", "🔥"].map((emo) => (
                    <button
                      key={emo}
                      onClick={() => sendEmojiReaction(emo)}
                      className="text-xl hover:scale-125 transition-transform cursor-pointer p-1"
                    >
                      {emo}
                    </button>
                  ))}
                </div>

              </div>

              {/* Gemini AI Summary & Interactive Quiz Board (Educator-Only) */}
              {role === "EDUCATOR" && (
                <AIAssistant
                  roomCode={roomCode}
                  chatMessages={chatMessages}
                  whiteboardActions={whiteboardHistory}
                />
              )}

            </div>

            {/* Right Stage: Workspace Panels Sidebars (Rosters, Chats, Polls) */}
            <div className="space-y-6">
              
              {/* Waiting list approvals & Rosters */}
              <WaitingRoomAndParticipants
                ws={ws}
                role={role}
                participants={participants}
                waitingRoom={waitingRoom}
              />

              {/* Chat & Q&A Board */}
              <ChatAndQA
                ws={ws}
                role={role}
                userId={userId}
                chatMessages={chatMessages}
                questions={questions}
                chatEnabled={chatEnabled}
              />

              {/* Interactive Polls Manager */}
              <PollsManager
                ws={ws}
                role={role}
                userId={userId}
                polls={polls}
              />

            </div>

          </div>

        </div>
      )}

      {/* 5. Post-Session Summary & Engagement Recap Screen */}
      {currentScreen === "post-report" && (
        <div className="max-w-3xl mx-auto px-4 py-16 flex items-center justify-center min-h-[90vh]">
          <div className="bg-white border border-slate-100 rounded-3xl shadow-xl overflow-hidden w-full">
            
            {/* Header Banner */}
            <div className="bg-slate-900 text-white p-8 text-center space-y-2 relative overflow-hidden">
              <div className="absolute inset-0 bg-radial-at-t from-emerald-500/15 via-transparent to-transparent"></div>
              <Check className="w-12 h-12 text-emerald-400 mx-auto bg-slate-800 p-2.5 rounded-full shadow-inner animate-pulse" />
              <h1 className="text-3xl font-sans font-medium tracking-tight">Classroom Session Ended</h1>
              <p className="text-xs font-mono text-slate-400">Join Code: {roomCode}</p>
            </div>

            {/* Content stats summaries */}
            <div className="p-8 space-y-6">
              <div className="text-center max-w-md mx-auto space-y-1.5">
                <p className="text-sm font-sans text-slate-700 font-semibold">Thank you for attending, {userName}!</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  The educator terminated the live broadcast. All active WebRTC feeds, whiteboard sessions, and websocket tunnels were gracefully torn down.
                </p>
              </div>

              {/* Display summaries */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
                <div className="bg-slate-50 p-4 rounded-2xl text-center space-y-0.5 border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Chat Count</span>
                  <p className="text-lg font-sans font-bold text-slate-900">{chatMessages.length}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl text-center space-y-0.5 border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Questions Board</span>
                  <p className="text-lg font-sans font-bold text-slate-900">{questions.length}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl text-center space-y-0.5 border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Polls Conducted</span>
                  <p className="text-lg font-sans font-bold text-slate-900">{polls.length}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl text-center space-y-0.5 border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Collaborative Actions</span>
                  <p className="text-lg font-sans font-bold text-slate-900">{whiteboardHistory.length}</p>
                </div>
              </div>

              {/* Secondary AI Summary helper for post-recap */}
              <div className="pt-4 border-t border-slate-100">
                <AIAssistant
                  roomCode={roomCode}
                  chatMessages={chatMessages}
                  whiteboardActions={whiteboardHistory}
                />
              </div>

              {/* Action */}
              <div className="flex justify-center pt-6">
                <button
                  onClick={() => {
                    setCurrentScreen("landing");
                    // Clear out local states
                    setChatMessages([]);
                    setQuestions([]);
                    setPolls([]);
                    setParticipants([]);
                    setWaitingRoom([]);
                    setWhiteboardHistory([]);
                    setRoomCode("");
                    setCourseName("");
                    setClassroomTitle("");
                  }}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-sans font-medium px-6 py-3 rounded-xl transition-all cursor-pointer shadow-sm"
                >
                  Return to Portal Lobby
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
