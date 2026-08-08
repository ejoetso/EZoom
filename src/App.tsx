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
  VolumeX,
  Sparkles,
  Layers,
  ArrowRight,
  Clipboard,
  Check,
  AlertCircle,
  HelpCircle,
  BookOpen,
  RefreshCw,
  Maximize,
  Minimize,
  QrCode,
  Share2,
  X,
  Square,
  Circle,
  Download,
  ShieldCheck,
  Mail,
  Radio,
  Sliders
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { UserRole, ScreenShareMode } from "./types";
import Lobby from "./components/Lobby";
import Whiteboard from "./components/Whiteboard";
import Annotations from "./components/Annotations";
import ChatAndQA from "./components/ChatAndQA";
import WaitingRoomAndParticipants from "./components/WaitingRoomAndParticipants";
import PollsManager from "./components/PollsManager";
import MicTestModal from "./components/MicTestModal";
import CameraPipOverlay from "./components/CameraPipOverlay";
import AIAssistant from "./components/AIAssistant";
import ProductLandingPage from "./components/ProductLandingPage";

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
  const [studentEmail, setStudentEmail] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [mathChallenge, setMathChallenge] = useState(() => ({
    left: Math.floor(Math.random() * 9) + 1,
    right: Math.floor(Math.random() * 9) + 1,
  }));
  const [classroomTitle, setClassroomTitle] = useState("");
  const [courseName, setCourseName] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [waitingRoomEnabled, setWaitingRoomEnabled] = useState(true);
  const [recordingEnabled, setRecordingEnabled] = useState(false);

  // Host Live Voice Microphone Streaming State
  const [isHostLiveVoiceActive, setIsHostLiveVoiceActive] = useState(false);
  const [remoteHostVoiceActive, setRemoteHostVoiceActive] = useState(false);
  const [isStudentMutedVoice, setIsStudentMutedVoice] = useState(false);
  const [audioContextUnlocked, setAudioContextUnlocked] = useState(false);
  const [isMicTestOpen, setIsMicTestOpen] = useState(false);

  const hostMicAudioStreamRef = useRef<MediaStream | null>(null);
  const hostAudioContextRef = useRef<AudioContext | null>(null);
  const hostScriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

  const studentAudioContextRef = useRef<AudioContext | null>(null);
  const studentAudioNextTimeRef = useRef<number>(0);

  // Educator Computer Class Recording State
  const [isRecordingClass, setIsRecordingClass] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [meetingStartedAt, setMeetingStartedAt] = useState<string | null>(null);
  const [meetingExpiresAt, setMeetingExpiresAt] = useState<string | null>(null);
  const [meetingTimeSeconds, setMeetingTimeSeconds] = useState(0);
  const recordedChunksRef = useRef<Blob[]>([]);
  const classMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<any>(null);

  // Connection and Socket State
  const [ws, setWs] = useState<WebSocket | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isStudentMutedVoiceRef = useRef(false);

  useEffect(() => {
    isStudentMutedVoiceRef.current = isStudentMutedVoice;
  }, [isStudentMutedVoice]);
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected" | "waiting" | "rejected">("disconnected");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [educatorError, setEducatorError] = useState<string | null>(null);
  const [broadcastingPassword, setBroadcastingPassword] = useState("");
  const [educatorEmail, setEducatorEmail] = useState("");
  const [educatorAuthenticated, setEducatorAuthenticated] = useState(false);
  const [educatorAccountType, setEducatorAccountType] = useState<"superadmin" | "trial" | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [joinBaseUrl, setJoinBaseUrl] = useState(() => window.location.origin);

  useEffect(() => {
    const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
    if (!isLocalHost) return;

    fetch("/api/network-info")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (data?.joinBaseUrl) setJoinBaseUrl(data.joinBaseUrl);
      })
      .catch(() => {});
  }, []);

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
  const [remoteEducatorCameraFrame, setRemoteEducatorCameraFrame] = useState<string | null>(null);
  const [remoteEducatorCameraActive, setRemoteEducatorCameraActive] = useState(false);
  const [streamMode, setStreamMode] = useState<"video" | "compatibility">("compatibility");
  const peerCandidatesRef = useRef<Record<string, RTCIceCandidate[]>>({});
  const studentCandidatesRef = useRef<RTCIceCandidate[]>([]);

  // Reconnection and Stream Refresh controls
  const lastLaunchSettingsRef = useRef<{ micEnabled: boolean; camEnabled: boolean; qualityMode: ScreenShareMode } | null>(null);
  const hasIntentionallyLeftRef = useRef(false);
  const captureFrameRef = useRef<(() => Promise<void>) | null>(null);
  const [streamNotification, setStreamNotification] = useState<string | null>(null);

  // Fullscreen and QR modal states
  const [showQrModal, setShowQrModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const screenStageRef = useRef<HTMLDivElement>(null);

  // Auto-detect join code from URL ?code=1234
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const codeParam = params.get("code") || params.get("join");
      if (codeParam) {
        setRoomCode(codeParam.trim().slice(0, 4));
        setRole("STUDENT");
      }
    } catch (err) {}
  }, []);

  // Fullscreen toggle & Escape key listener
  const toggleFullScreen = async () => {
    if (!screenStageRef.current) return;
    if (!document.fullscreenElement && !isFullscreen) {
      try {
        if (screenStageRef.current.requestFullscreen) {
          await screenStageRef.current.requestFullscreen();
        } else if ((screenStageRef.current as any).webkitRequestFullscreen) {
          await (screenStageRef.current as any).webkitRequestFullscreen();
        }
      } catch (e) {
        console.log("Native fullscreen fallback to pseudo mode:", e);
      }
      setIsFullscreen(true);
    } else {
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        }
      } catch (e) {}
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
        setIsFullscreen(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const showStreamToast = (msg: string) => {
    setStreamNotification(msg);
    setTimeout(() => {
      setStreamNotification((current) => current === msg ? null : current);
    }, 4000);
  };

  const formatRecordingDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, "0")}:${remMins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const unlockAudioContext = async () => {
    try {
      if (!studentAudioContextRef.current || studentAudioContextRef.current.state === "closed") {
        studentAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (studentAudioContextRef.current.state === "suspended") {
        await studentAudioContextRef.current.resume();
      }
      const isRunning = studentAudioContextRef.current.state === "running";
      setAudioContextUnlocked(isRunning);
      if (isRunning) studentAudioNextTimeRef.current = studentAudioContextRef.current.currentTime;
    } catch (e) {
      console.error("AudioContext unlock error:", e);
      setAudioContextUnlocked(false);
    }
  };

  useEffect(() => {
    if (currentScreen !== "classroom" || !meetingStartedAt) return;
    const updateMeetingTimer = () => {
      const now = Date.now();
      if (meetingExpiresAt) {
        setMeetingTimeSeconds(Math.max(0, Math.ceil((new Date(meetingExpiresAt).getTime() - now) / 1000)));
      } else {
        setMeetingTimeSeconds(Math.max(0, Math.floor((now - new Date(meetingStartedAt).getTime()) / 1000)));
      }
    };
    updateMeetingTimer();
    const timer = window.setInterval(updateMeetingTimer, 1000);
    return () => window.clearInterval(timer);
  }, [currentScreen, meetingStartedAt, meetingExpiresAt]);

  // Educator Live Voice Microphone Streaming Handler (Web Audio API PCM Streaming)
  const toggleHostLiveVoice = async () => {
    if (role !== "EDUCATOR") return;

    if (isHostLiveVoiceActive) {
      if (hostScriptProcessorRef.current) {
        try { hostScriptProcessorRef.current.disconnect(); } catch {}
        hostScriptProcessorRef.current = null;
      }
      if (hostAudioContextRef.current && hostAudioContextRef.current.state !== "closed") {
        try { hostAudioContextRef.current.close(); } catch {}
        hostAudioContextRef.current = null;
      }
      if (hostMicAudioStreamRef.current) {
        hostMicAudioStreamRef.current.getTracks().forEach((track) => track.stop());
        hostMicAudioStreamRef.current = null;
      }

      setIsHostLiveVoiceActive(false);
      const activeWs = wsRef.current || ws;
      if (activeWs && activeWs.readyState === WebSocket.OPEN) {
        activeWs.send(JSON.stringify({ type: "host-voice-state", active: false }));
      }
      showStreamToast("Host live microphone voice streaming muted 🔇");
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        hostMicAudioStreamRef.current = stream;

        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioContextClass();
        hostAudioContextRef.current = audioCtx;

        if (audioCtx.state === "suspended") {
          await audioCtx.resume();
        }

        const sourceNode = audioCtx.createMediaStreamSource(stream);
        const scriptNode = audioCtx.createScriptProcessor(2048, 1, 1);
        hostScriptProcessorRef.current = scriptNode;

        const silentGain = audioCtx.createGain();
        silentGain.gain.value = 0;

        scriptNode.onaudioprocess = (e) => {
          const activeWs = wsRef.current || ws;
          if (!activeWs || activeWs.readyState !== WebSocket.OPEN) return;
          if (activeWs.bufferedAmount > 256 * 1024) return;
          const inputData = e.inputBuffer.getChannelData(0);

          const pcm16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }

          let binary = "";
          const bytes = new Uint8Array(pcm16.buffer);
          const len = bytes.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64Pcm = btoa(binary);

          activeWs.send(JSON.stringify({
            type: "host-voice-chunk",
            pcm: base64Pcm,
            sampleRate: audioCtx.sampleRate
          }));
        };

        sourceNode.connect(scriptNode);
        scriptNode.connect(silentGain);
        silentGain.connect(audioCtx.destination);

        setIsHostLiveVoiceActive(true);
        const activeWs = wsRef.current || ws;
        if (activeWs && activeWs.readyState === WebSocket.OPEN) {
          activeWs.send(JSON.stringify({ type: "host-voice-state", active: true }));
        }
        showStreamToast("Host live microphone voice streaming active 🎙️");
      } catch (err: any) {
        console.error("Host live voice error:", err);
        showStreamToast("Failed to start host microphone live voice stream: " + (err.message || "Permission denied"));
      }
    }
  };

  // Educator Computer Class Recording Handler (Saves directly to Host Computer Storage)
  const startClassRecording = async () => {
    if (role !== "EDUCATOR") return;

    try {
      // 1. Ensure host microphone stream exists for capturing host live voice
      if (!hostMicAudioStreamRef.current) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          hostMicAudioStreamRef.current = micStream;
        } catch (e) {
          console.warn("Host microphone stream unavailable for recording:", e);
        }
      }

      // 2. Obtain video track without prompting getDisplayMedia
      let videoTrack: MediaStreamTrack | null = null;
      if (screenStream && screenStream.getVideoTracks().length > 0 && screenStream.getVideoTracks()[0].readyState === "live") {
        videoTrack = screenStream.getVideoTracks()[0];
      } else {
        const wbCanvas = document.getElementById("whiteboard-canvas") as HTMLCanvasElement;
        if (wbCanvas) {
          const canvasStream = wbCanvas.captureStream(25);
          videoTrack = canvasStream.getVideoTracks()[0];
        } else {
          // Fallback offscreen canvas if whiteboard canvas element isn't in DOM
          const dummyCanvas = document.createElement("canvas");
          dummyCanvas.width = 1280;
          dummyCanvas.height = 720;
          const ctx = dummyCanvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#0f172a";
            ctx.fillRect(0, 0, 1280, 720);
            ctx.fillStyle = "#10b981";
            ctx.font = "bold 28px sans-serif";
            ctx.fillText("Classroom Session Recording", 60, 100);
          }
          const dummyStream = dummyCanvas.captureStream(10);
          videoTrack = dummyStream.getVideoTracks()[0];
        }
      }

      // 3. Audio Mixing using Web Audio API
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const recAudioCtx = new AudioCtxClass();
      const destNode = recAudioCtx.createMediaStreamDestination();

      let hasAudioSource = false;

      if (hostMicAudioStreamRef.current && hostMicAudioStreamRef.current.getAudioTracks().length > 0) {
        try {
          const micSource = recAudioCtx.createMediaStreamSource(hostMicAudioStreamRef.current);
          micSource.connect(destNode);
          hasAudioSource = true;
        } catch (e) {
          console.warn("Could not connect host mic to recording destination:", e);
        }
      }

      if (screenStream && screenStream.getAudioTracks().length > 0) {
        try {
          const screenAudioSource = recAudioCtx.createMediaStreamSource(screenStream);
          screenAudioSource.connect(destNode);
          hasAudioSource = true;
        } catch (e) {
          console.warn("Could not connect screen audio to recording destination:", e);
        }
      }

      const combinedTracks: MediaStreamTrack[] = [];
      if (videoTrack) combinedTracks.push(videoTrack);
      if (hasAudioSource && destNode.stream.getAudioTracks().length > 0) {
        combinedTracks.push(destNode.stream.getAudioTracks()[0]);
      }

      if (combinedTracks.length === 0) {
        showStreamToast("No video or audio stream available to record.");
        return;
      }

      const recStream = new MediaStream(combinedTracks);
      recordedChunksRef.current = [];

      const mimeTypes = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
        "video/mp4"
      ];
      const supportedMime = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || "";

      const recorder = supportedMime ? new MediaRecorder(recStream, { mimeType: supportedMime }) : new MediaRecorder(recStream);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        if (recAudioCtx && recAudioCtx.state !== "closed") {
          recAudioCtx.close().catch(() => {});
        }
        if (recordedChunksRef.current.length > 0) {
          const mime = recorder.mimeType || "video/webm";
          const ext = mime.includes("mp4") ? "mp4" : "webm";
          const blob = new Blob(recordedChunksRef.current, { type: mime });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.style.display = "none";
          a.href = url;
          a.download = `Class_Recording_${roomCode || "EDU"}_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "_")}.${ext}`;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 200);
          showStreamToast("Class recording saved & downloaded to host computer storage! 💾");
        }
      };

      recorder.start(1000);
      classMediaRecorderRef.current = recorder;
      setIsRecordingClass(true);
      setRecordingTime(0);

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      showStreamToast("Class recording started! Capturing host sound and live whiteboard/screen.");
    } catch (err: any) {
      console.error("Recording error:", err);
      showStreamToast("Failed to start recording: " + (err.message || "Unknown error"));
    }
  };

  const stopClassRecording = () => {
    if (classMediaRecorderRef.current && classMediaRecorderRef.current.state !== "inactive") {
      classMediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecordingClass(false);
  };

  // Reactive floating emojis system
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: string; emoji: string; x: number }[]>([]);

  // Simulation fallback states if standard browser navigator.mediaDevices.getDisplayMedia is blocked by iframe constraints
  const [isSimulationActive, setIsSimulationActive] = useState(false);
  const [simulationFrameIdx, setSimulationFrameIdx] = useState(0);

  // Hands up state for local student
  const [handRaised, setHandRaised] = useState(false);

  // Initialize a classroom from Landing page (for Educators)
  const handleEducatorLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setEducatorError(null);
    try {
      const response = await fetch("/api/educator/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: educatorEmail, password: broadcastingPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Educator login failed.");
      setEducatorEmail(data.email);
      setEducatorAccountType(data.accountType);
      setEducatorAuthenticated(true);
    } catch (err: any) {
      setEducatorError(err.message || "Educator login failed.");
    }
  };

  const handleCreateClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classroomTitle || !userName) return;

    if (!educatorAuthenticated) {
      setEducatorError("Please sign in with an educator account first.");
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
          email: educatorEmail,
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

  // Pre-join verification for students (Checking room code validity & school email security question)
  const handleStudentJoinCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode || !userName) return;

    const emailClean = studentEmail.trim().toLowerCase();
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean);

    if (!isValidEmail) {
      setErrorText("Please enter a valid email address.");
      return;
    }

    const normalizedRoomCode = roomCode.replace(/\D/g, "").slice(0, 4);
    if (normalizedRoomCode.length !== 4) {
      setErrorText("Please enter the complete 4-digit classroom code.");
      return;
    }
    if (Number(securityAnswer) !== mathChallenge.left + mathChallenge.right) {
      setErrorText("Incorrect math security answer. Please try again.");
      setMathChallenge({
        left: Math.floor(Math.random() * 9) + 1,
        right: Math.floor(Math.random() * 9) + 1,
      });
      setSecurityAnswer("");
      return;
    }

    setErrorText(null);
    try {
      const response = await fetch(`/api/classrooms/${normalizedRoomCode}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Classroom code is invalid or expired.");
      }

      const data = await response.json();
      setRoomCode(normalizedRoomCode);
      setStudentEmail(emailClean);
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
    lastLaunchSettingsRef.current = settings;
    hasIntentionallyLeftRef.current = false;
    setMicMuted(!settings.micEnabled);
    setScreenShareQuality(settings.qualityMode);
    setConnectionStatus("connecting");

    // Student playback must be unlocked directly from this user gesture.
    if (role === "STUDENT") {
      void unlockAudioContext();
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);
    setWs(socket);
    wsRef.current = socket;

    socket.addEventListener("open", () => {
      setConnectionStatus("connected");
      // Join signaling channel
      socket.send(JSON.stringify({
        type: "join",
        userId,
        name: userName,
        email: role === "STUDENT" ? studentEmail : undefined,
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

        else if (data.type === "error") {
          setErrorText(data.message || "Unable to join this classroom.");
          setConnectionStatus("disconnected");
          setCurrentScreen("lobby");
          socket.close();
        }

        else if (data.type === "joined") {
          setConnectionStatus("connected");
          setCurrentScreen("classroom");

          // "Mic On" in the educator lobby means start broadcasting on entry.
          if (
            role === "EDUCATOR" &&
            lastLaunchSettingsRef.current?.micEnabled &&
            !hostScriptProcessorRef.current
          ) {
            void toggleHostLiveVoice();
          }
          
          if (data.chat) setChatMessages(data.chat);
          if (data.questions) setQuestions(data.questions);
          if (data.polls) setPolls(data.polls);
          if (data.resources) setResources(data.resources);
          if (data.whiteboard) setWhiteboardHistory(data.whiteboard);
          if (data.participants) setParticipants(data.participants);
          if (data.waitingRoom) setWaitingRoom(data.waitingRoom);
          if (data.classroom) {
            if (data.classroom.startedAt) setMeetingStartedAt(data.classroom.startedAt);
            setMeetingExpiresAt(data.classroom.expiresAt || null);
            setRemoteEducatorCameraActive(!!data.classroom.educatorCameraActive);
            if (data.classroom.visitCount !== undefined) {
              setVisitCount(data.classroom.visitCount);
            }
            if (data.classroom.concurrentUsers !== undefined) {
              setConcurrentUsers(data.classroom.concurrentUsers);
            }
            if (data.classroom.isHostVoiceActive) {
              setRemoteHostVoiceActive(true);
              unlockAudioContext();
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
          if (data.educatorCameraFrame) {
            setRemoteEducatorCameraFrame(data.educatorCameraFrame);
            setRemoteEducatorCameraActive(true);
          }
        }

        else if (data.type === "educator-camera-state") {
          setRemoteEducatorCameraActive(!!data.active);
          if (!data.active) setRemoteEducatorCameraFrame(null);
        }

        else if (data.type === "educator-camera-frame") {
          setRemoteEducatorCameraFrame(data.dataUrl);
          setRemoteEducatorCameraActive(true);
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

        else if (data.type === "stream-force-refresh") {
          // Received by STUDENT
          if (role === "STUDENT") {
            if (studentPeerConnectionRef.current) {
              try { studentPeerConnectionRef.current.close(); } catch {}
              studentPeerConnectionRef.current = null;
            }
            studentCandidatesRef.current = [];
            setRemoteScreenStream(null);
            setRemoteScreenFrame(null);
            showStreamToast("Educator has refreshed the stream connection.");
          }
        }

        else if (data.type === "request-stream-refresh") {
          // Received by EDUCATOR
          if (role === "EDUCATOR" && isSharingScreen) {
            const targetUserId = data.userId;
            const targetUserName = data.name || "Student";
            
            // Re-create the peer connection with the student if in sharing screen mode
            if (peerConnectionsRef.current[targetUserId]) {
              try { peerConnectionsRef.current[targetUserId].close(); } catch {}
              delete peerConnectionsRef.current[targetUserId];
            }
            if (screenStream) {
              setupEducatorPeerConnection(targetUserId, screenStream);
            }
            
            // Also trigger rapid frame transmission for compatibility mode fallback
            if (captureFrameRef.current) {
              captureFrameRef.current().catch(() => {});
            }

            showStreamToast(`Refreshed stream feed for student: ${targetUserName}`);
          }
        }

        else if (data.type === "host-voice-state") {
          setRemoteHostVoiceActive(data.active);
          if (data.active) {
            showStreamToast("Host enabled Live Microphone Voice Streaming 🎙️");
            unlockAudioContext();
          } else {
            showStreamToast("Host muted Live Voice Stream 🔇");
            studentAudioNextTimeRef.current = 0;
          }
        }

        else if (data.type === "host-voice-chunk") {
          setRemoteHostVoiceActive(true);
          if (!isStudentMutedVoiceRef.current && data.pcm) {
            try {
              const binary = atob(data.pcm);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
              }
              const int16 = new Int16Array(bytes.buffer);
              const float32 = new Float32Array(int16.length);
              for (let i = 0; i < int16.length; i++) {
                float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7FFF);
              }

              let ctx = studentAudioContextRef.current;
              if (!ctx || ctx.state === "closed") {
                ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: data.sampleRate || 44100 });
                studentAudioContextRef.current = ctx;
              }
              if (ctx.state === "suspended") {
                await ctx.resume().catch(() => {});
              }
              if (ctx.state !== "running") {
                setAudioContextUnlocked(false);
                studentAudioNextTimeRef.current = 0;
                return;
              }
              setAudioContextUnlocked(true);

              const buffer = ctx.createBuffer(1, float32.length, data.sampleRate || ctx.sampleRate);
              buffer.getChannelData(0).set(float32);

              const sourceNode = ctx.createBufferSource();
              sourceNode.buffer = buffer;
              sourceNode.connect(ctx.destination);

              const currentTime = ctx.currentTime;
              if (studentAudioNextTimeRef.current < currentTime) {
                studentAudioNextTimeRef.current = currentTime + 0.04;
              }
              sourceNode.start(studentAudioNextTimeRef.current);
              studentAudioNextTimeRef.current += buffer.duration;
            } catch (e) {
              console.error("PCM playback error:", e);
            }
          }
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
          hasIntentionallyLeftRef.current = true;
          if (screenStream) {
            screenStream.getTracks().forEach((track) => track.stop());
          }
          setScreenStream(null);

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
          setRemoteScreenFrame(null);

          socket.close();
          setConnectionStatus("disconnected");
          setCurrentScreen("post-report");
        }

        else if (data.type === "mute-state") {
          setMicMuted(data.isMuted);
        }

        else if (data.type === "kicked") {
          hasIntentionallyLeftRef.current = true;
          if (screenStream) {
            screenStream.getTracks().forEach((track) => track.stop());
          }
          setScreenStream(null);

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
          setRemoteScreenFrame(null);

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
      if (!hasIntentionallyLeftRef.current) {
        console.log("WebSocket connection dropped unexpectedly. Reconnecting...");
        setConnectionStatus("connecting");
        setTimeout(() => {
          if (lastLaunchSettingsRef.current && !hasIntentionallyLeftRef.current) {
            handleLaunchClassroom(lastLaunchSettingsRef.current);
          }
        }, 3000);
      }
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
      // standard DisplayMedia with audio sharing support
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 15, max: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          suppressLocalAudioPlayback: false
        },
        systemAudio: "include",
        selfBrowserSurface: "include",
        surfaceSwitching: "include"
      } as any);

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

    const captureFrame = async () => {
      try {
        const video = screenVideoRef.current;
        const track = screenStream.getVideoTracks()[0];
        if (!track || track.readyState !== "live") return;

        let frameSource: any = null;

        // Try to use ImageCapture to grab the latest frame directly from the track, bypassing video element restrictions in background tabs
        if (typeof (window as any).ImageCapture !== "undefined") {
          try {
            const capturer = new (window as any).ImageCapture(track);
            frameSource = await capturer.grabFrame();
          } catch (err) {
            // Quiet fallback to standard video capturing
          }
        }

        // Use grabbed ImageBitmap if successful, otherwise fallback to the video element
        const source = frameSource || video;
        if (!source) return;

        const width = frameSource ? (source as ImageBitmap).width : (source as HTMLVideoElement).videoWidth;
        const height = frameSource ? (source as ImageBitmap).height : (source as HTMLVideoElement).videoHeight;

        if (width && height && ws && ws.readyState === WebSocket.OPEN) {
          // scale down for optimal bandwidth/performance
          const scale = Math.min(960 / width, 540 / height, 1);
          canvas.width = width * scale;
          canvas.height = height * scale;
          
          ctx?.drawImage(source, 0, 0, canvas.width, canvas.height);
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

        // Clean up ImageBitmap if it was created
        if (frameSource && typeof frameSource.close === "function") {
          frameSource.close();
        }
      } catch (e) {
        console.error("Error in captureFrame execution:", e);
      }
    };

    // Capture every 1000ms for stable compatibility broadcast
    intervalId = setInterval(captureFrame, 1000);
    captureFrameRef.current = captureFrame;

    return () => {
      clearInterval(intervalId);
      captureFrameRef.current = null;
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
    hasIntentionallyLeftRef.current = true;

    if (isRecordingClass) {
      stopClassRecording();
    }

    if (isHostLiveVoiceActive) {
      if (hostScriptProcessorRef.current) {
        try { hostScriptProcessorRef.current.disconnect(); } catch {}
        hostScriptProcessorRef.current = null;
      }
      if (hostAudioContextRef.current && hostAudioContextRef.current.state !== "closed") {
        try { hostAudioContextRef.current.close(); } catch {}
        hostAudioContextRef.current = null;
      }
      if (hostMicAudioStreamRef.current) {
        hostMicAudioStreamRef.current.getTracks().forEach((track) => track.stop());
        hostMicAudioStreamRef.current = null;
      }
      setIsHostLiveVoiceActive(false);
    }

    if (studentAudioContextRef.current && studentAudioContextRef.current.state !== "closed") {
      try { studentAudioContextRef.current.close(); } catch {}
      studentAudioContextRef.current = null;
    }

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

  // Educator-side global stream transmission refresh
  const handleEducatorRefreshStream = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      showStreamToast("Cannot refresh stream: connection offline.");
      return;
    }

    // Clear and close all existing student WebRTC peer connections
    Object.keys(peerConnectionsRef.current).forEach((studentId) => {
      try {
        peerConnectionsRef.current[studentId].close();
      } catch (err) {}
      delete peerConnectionsRef.current[studentId];
    });
    peerConnectionsRef.current = {};
    peerCandidatesRef.current = {};

    // Notify all student clients of the forced refresh
    ws.send(JSON.stringify({
      type: "stream-force-refresh",
      mode: streamMode
    }));

    // If WebRTC is sharing active stream, setup clean peer connections again
    if (isSharingScreen && screenStream) {
      participants.forEach((student) => {
        setupEducatorPeerConnection(student.id, screenStream);
      });
    }

    // If compatibility mode capturing is active, trigger an immediate frame capture
    if (captureFrameRef.current) {
      captureFrameRef.current().catch(() => {});
    }

    showStreamToast("Broadcasting stream successfully refreshed for all students!");
  };

  // Student-side stream feed request refresh
  const handleStudentRefreshStream = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      showStreamToast("Cannot refresh stream: connection offline.");
      return;
    }

    // Reset local peer connection
    if (studentPeerConnectionRef.current) {
      try {
        studentPeerConnectionRef.current.close();
      } catch (err) {}
      studentPeerConnectionRef.current = null;
    }
    studentCandidatesRef.current = [];
    setRemoteScreenStream(null);
    setRemoteScreenFrame(null);

    // Send refresh request to server (forwarded to Educator)
    ws.send(JSON.stringify({
      type: "request-stream-refresh"
    }));

    showStreamToast("Requesting a fresh screen stream from Educator...");
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

  const directJoinUrl = `${joinBaseUrl}/?code=${encodeURIComponent(roomCode)}`;

  if (window.location.pathname === "/about") {
    return <ProductLandingPage />;
  }

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
            <div className="relative h-32 w-full overflow-hidden" aria-hidden="true">
              <img
                src="/ezoom-logo.png"
                alt=""
                className="absolute left-1/2 top-1/2 w-[700px] max-w-none -translate-x-1/2 -translate-y-1/2"
              />
            </div>
            <h1 className="sr-only">EZoom</h1>
            <p className="text-sm font-sans text-slate-500 leading-relaxed">
              Secure, low-latency screen-broadcasting and collaborative digital whiteboard built for modern educators, schools, and training organizations.
            </p>
            <p className="text-xs text-slate-400">
              Commercial use, education deployment, or collaboration: <a className="font-semibold text-emerald-700 hover:underline" href="mailto:eozoe2025@gmail.com">eozoe2025@gmail.com</a>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
            
            {/* Educator Creation Column */}
            <div className="order-2 bg-white border border-slate-100 rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <span className="bg-emerald-50 text-emerald-800 text-[10px] font-mono px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                  Educator Portal
                </span>
                <h2 className="text-2xl font-sans font-semibold text-slate-900">Educator Sign In</h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Educator accounts can create and manage secure broadcasting sessions.
                </p>
              </div>

              {educatorAuthenticated ? (
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

                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 flex items-center justify-between">
                  <span>{educatorEmail}</span>
                  <span className="font-bold uppercase">{educatorAccountType === "trial" ? "30-minute trial" : "Superadmin"}</span>
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
              ) : (
              <form onSubmit={handleEducatorLogin} autoComplete="off" className="space-y-4 pt-4">
                {educatorError && (
                  <div className="bg-red-50 border border-red-200 text-red-800 p-3.5 rounded-xl text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" /> <span>{educatorError}</span>
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600">Educator Email</label>
                  <input type="email" name="educator_login_email" autoComplete="off" placeholder="educator@example.com" value={educatorEmail} onChange={(e) => setEducatorEmail(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-slate-900" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600">Password</label>
                  <input type="password" name="educator_login_password" autoComplete="new-password" placeholder="Enter educator password" value={broadcastingPassword} onChange={(e) => setBroadcastingPassword(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-slate-900" required />
                </div>
                <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3.5 rounded-xl text-xs font-semibold shadow-md flex items-center justify-center gap-2">
                  <Lock className="w-4 h-4" /> Sign In as Educator
                </button>
                <p className="text-[10px] text-slate-400 text-center">Trial meetings are limited to 30 minutes.</p>
              </form>
              )}
            </div>

            {/* Student Joining Column */}
            <div className="order-1 bg-white border border-slate-100 rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <span className="bg-slate-100 text-slate-800 text-[10px] font-mono px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                  Student Portal
                </span>
                <h2 className="text-2xl font-sans font-semibold text-slate-900">Enter Your Session</h2>
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
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-sans font-medium text-slate-600 flex items-center gap-1">
                      <Mail className="w-3 h-3 text-emerald-600" /> Your Email Address
                    </label>
                    <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5">
                      <ShieldCheck className="w-3 h-3" /> Required
                    </span>
                  </div>
                  <input
                    type="email"
                    placeholder="Enter your email address"
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs font-sans focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all font-mono"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-sans font-medium text-slate-600">4-Digit Session Code</label>
                    {roomCode.length === 4 && (
                      <button
                        type="button"
                        onClick={() => setShowQrModal(true)}
                        className="text-[10px] text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <QrCode className="w-3 h-3" /> View QR Code
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    placeholder="e.g. 4829"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-base font-mono font-bold tracking-widest text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all uppercase"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-sans font-medium text-slate-600">
                    Security Check: What is {mathChallenge.left} + {mathChallenge.right}?
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={3}
                    placeholder="Enter the answer"
                    value={securityAnswer}
                    onChange={(e) => setSecurityAnswer(e.target.value.replace(/\D/g, "").slice(0, 3))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-base font-mono font-bold tracking-widest text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
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

          <section className="w-full mt-14 space-y-8" aria-labelledby="demo-heading">
            <div className="text-center space-y-2">
              <span className="inline-flex rounded-full bg-cyan-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-700">Product Demo</span>
              <h2 id="demo-heading" className="text-3xl font-bold text-slate-900">See EZoom in Action</h2>
              <p className="mx-auto max-w-2xl text-sm leading-relaxed text-slate-500">
                Watch the guided walkthrough, preview the educator and student experience, then try a free 30-minute meeting.
              </p>
            </div>

            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 p-2 shadow-2xl">
              <video
                controls
                preload="metadata"
                poster="/demo/05-live-classroom.png"
                className="aspect-video w-full rounded-2xl bg-black object-contain"
              >
                <source src="/demo/EZoom-demo.mp4" type="video/mp4" />
                Your browser does not support the EZoom demo video.
              </video>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {[
                ["/demo/04-educator-lobby.png", "Educator device lobby"],
                ["/demo/05-live-classroom.png", "Live educator classroom"],
                ["/demo/06-student-join.png", "Student secure entry"],
                ["/demo/07-student-classroom.png", "Student classroom experience"],
              ].map(([src, label]) => (
                <figure key={src} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                  <img src={src} alt={label} loading="lazy" className="aspect-video w-full object-cover object-top" />
                  <figcaption className="border-t border-slate-100 px-4 py-3 text-xs font-semibold text-slate-700">{label}</figcaption>
                </figure>
              ))}
            </div>

            <div className="flex flex-col items-center justify-between gap-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center sm:flex-row sm:text-left">
              <div>
                <h3 className="font-bold text-emerald-950">Free 30-minute educator trial</h3>
                <p className="mt-1 text-xs text-emerald-800">
                  Sign in with <span className="font-mono font-bold">user@ejoecast.com</span> and password <span className="font-mono font-bold">user123!</span>
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <a href="/demo/EZoom-demo.mp4" download className="rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-emerald-800">Download Demo</a>
                <a href="https://github.com/ejoetso/EZoom/blob/main/docs/USER_GUIDE.md" target="_blank" rel="noreferrer" className="rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-100">Open User Guide</a>
                <a href="/about" className="rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-100">Project Overview</a>
              </div>
            </div>
          </section>

        </div>
      )}

      {/* 2. Device Pre-Class Lobby Screen */}
      {currentScreen === "lobby" && (
        <Lobby
          onJoin={handleLaunchClassroom}
          title={classroomTitle}
          courseName={courseName}
          role={role}
          roomCode={roomCode}
          onOpenQr={() => setShowQrModal(true)}
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
          
          {/* Connection status and Auto Reconnect notifications */}
          {connectionStatus !== "connected" && (
            <div className={`p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-sans ${
              connectionStatus === "connecting" 
                ? "bg-amber-500/15 border border-amber-500/30 text-amber-300 animate-pulse" 
                : "bg-red-500/15 border border-red-500/30 text-red-300"
            }`}>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${connectionStatus === "connecting" ? "bg-amber-400 animate-ping" : "bg-red-500"}`}></span>
                <span className="font-medium text-[13px]">
                  {connectionStatus === "connecting" 
                    ? "Connection interrupted. Attempting automatic reconnection to the live classroom..." 
                    : "Disconnected from the live classroom. Auto-reconnection pending..."}
                </span>
              </div>
              <button
                onClick={() => {
                  if (lastLaunchSettingsRef.current) {
                    handleLaunchClassroom(lastLaunchSettingsRef.current);
                  }
                }}
                className="bg-slate-800 hover:bg-slate-700 text-white px-3.5 py-2 rounded-xl text-xs font-sans font-semibold transition-all cursor-pointer shadow-sm border border-slate-700/50"
              >
                Reconnect Now
              </button>
            </div>
          )}

          {/* Persistent stream action toasts */}
          {streamNotification && (
            <div className="fixed top-6 right-6 z-50 bg-slate-900/95 border border-slate-800 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-2.5 max-w-md animate-fadeIn backdrop-blur-md">
              <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
              <p className="text-xs font-sans font-medium">{streamNotification}</p>
            </div>
          )}

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

            {/* Middle widgets: Join Code clipboard copy & QR code trigger */}
            <div className="flex items-center gap-3.5">
              <div className="bg-slate-800/80 border border-slate-750 px-3.5 py-1.5 rounded-xl backdrop-blur-md font-mono text-xs flex items-center gap-2">
                <span className="text-slate-400">Code:</span>
                <span className="text-emerald-400 font-extrabold text-sm tracking-widest">{roomCode}</span>
                <button
                  id="copy_code_btn"
                  onClick={handleCopyCode}
                  className="text-slate-400 hover:text-white p-1 rounded transition-colors cursor-pointer"
                  title="Copy 4-Digit Session Code"
                >
                  {copyFeedback ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Clipboard className="w-3.5 h-3.5" />}
                </button>
                <div className="h-3.5 w-px bg-slate-700 mx-0.5"></div>
                <button
                  onClick={() => setShowQrModal(true)}
                  className="text-slate-300 hover:text-white flex items-center gap-1 font-sans text-[11px] font-semibold transition-colors cursor-pointer bg-slate-700/60 hover:bg-slate-700 px-2 py-0.5 rounded-lg border border-slate-650"
                  title="Display Session QR Code"
                >
                  <QrCode className="w-3 h-3 text-emerald-400" /> QR
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

            {/* Actions: Voice, Recording, Mic Test, Leave / Terminate */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={() => setIsMicTestOpen(true)}
                className="bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl text-xs font-sans font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                title="Test Voice Stream Microphone Input & Volume Level"
              >
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Test Mic</span>
              </button>

              {role === "EDUCATOR" && (
                <>
                  <button
                    onClick={toggleHostLiveVoice}
                    className={`px-3 py-2 rounded-xl text-xs font-sans font-semibold flex items-center gap-1.5 transition-all cursor-pointer border shadow-sm ${
                      isHostLiveVoiceActive
                        ? "bg-emerald-500 text-slate-950 border-emerald-400 font-bold animate-pulse"
                        : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-750"
                    }`}
                    title={isHostLiveVoiceActive ? "Mute Host Live Voice Stream" : "Enable Host Live Voice Microphone Streaming"}
                  >
                    <Radio className={`w-3.5 h-3.5 ${isHostLiveVoiceActive ? "text-slate-950" : "text-emerald-400"}`} />
                    <span>{isHostLiveVoiceActive ? "Mic Stream Active" : "Live Mic Stream"}</span>
                  </button>

                  <button
                    onClick={isRecordingClass ? stopClassRecording : startClassRecording}
                    className={`px-3 py-2 rounded-xl text-xs font-sans font-semibold flex items-center gap-1.5 transition-all cursor-pointer border shadow-sm ${
                      isRecordingClass
                        ? "bg-red-600 text-white border-red-500 font-bold animate-pulse"
                        : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-750"
                    }`}
                    title={isRecordingClass ? "Stop Recording & Save to Host Computer Storage" : "Record Class to Educator Host Computer Storage"}
                  >
                    {isRecordingClass ? (
                      <>
                        <Square className="w-3.5 h-3.5 fill-current text-white" />
                        <span>REC ({formatRecordingDuration(recordingTime)})</span>
                      </>
                    ) : (
                      <>
                        <Circle className="w-3.5 h-3.5 fill-current text-red-500" />
                        <span>Record Class</span>
                      </>
                    )}
                  </button>
                </>
              )}

              {role === "STUDENT" && remoteHostVoiceActive && (
                <div className="flex items-center gap-2">
                  {!audioContextUnlocked ? (
                    <button
                      onClick={unlockAudioContext}
                      className="bg-amber-400 hover:bg-amber-500 text-slate-950 px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-xs font-sans font-bold shadow-md animate-bounce cursor-pointer"
                    >
                      <Volume2 className="w-4 h-4" /> Tap to Enable Live Host Voice
                    </button>
                  ) : (
                    <div className="bg-emerald-950/90 border border-emerald-800 text-emerald-300 px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs font-mono shadow-sm">
                      <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                      <span className="hidden sm:inline font-sans text-[11px] font-medium">Host Mic Live</span>
                      <button
                        onClick={() => {
                          unlockAudioContext();
                          setIsStudentMutedVoice(!isStudentMutedVoice);
                        }}
                        className="p-1 hover:bg-emerald-900 rounded text-emerald-300 transition-colors cursor-pointer"
                        title={isStudentMutedVoice ? "Unmute Host Live Voice Stream" : "Mute Host Live Voice Stream"}
                      >
                        {isStudentMutedVoice ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <span className="text-xs font-mono text-slate-400 hidden sm:inline">Role: <span className="font-bold text-white uppercase">{role}</span></span>
              <div className={`px-3 py-2 rounded-xl border font-mono text-xs ${meetingExpiresAt ? "bg-amber-950/80 border-amber-700 text-amber-300" : "bg-slate-800 border-slate-700 text-emerald-300"}`}>
                {meetingExpiresAt ? "Trial left" : "Meeting"}: {formatRecordingDuration(meetingTimeSeconds)}
              </div>
              
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
                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-xs flex-wrap">
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
                    <div className="h-4 w-px bg-slate-300"></div>
                    <button
                      onClick={handleStudentRefreshStream}
                      className="px-3 py-1.5 rounded-lg text-xs font-sans font-bold bg-red-600 hover:bg-red-700 text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="Request a fresh stream and reload player if frozen"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Refresh Stream
                    </button>
                  </div>
                )}

                {activeStage === "screen" && role === "EDUCATOR" && isSharingScreen && (
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-xs">
                    <button
                      onClick={handleEducatorRefreshStream}
                      className="px-3 py-1.5 rounded-lg text-xs font-sans font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="Force a stream refresh and rebuild connections for all students"
                    >
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '4s' }} />
                      Refresh Stream Transmission
                    </button>
                  </div>
                )}
              </div>

              {/* Main Presentation Screen */}
              <div
                ref={screenStageRef}
                className={`transition-all duration-300 relative overflow-hidden ${
                  isFullscreen
                    ? "fixed inset-0 z-[9999] w-screen h-screen rounded-none border-none bg-slate-950 p-0 flex flex-col justify-center items-center"
                    : "aspect-video w-full rounded-2xl bg-slate-900 border border-slate-800 shadow-xl"
                }`}
              >
                {/* Stage top-right Overlay controls: Fullscreen & QR code */}
                <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
                  <button
                    onClick={() => setShowQrModal(true)}
                    className="bg-slate-950/80 hover:bg-slate-900 text-white p-2 rounded-xl border border-slate-700/70 backdrop-blur-md transition-all cursor-pointer shadow-md flex items-center gap-1.5 text-xs font-sans font-medium"
                    title="View Session QR Code"
                  >
                    <QrCode className="w-4 h-4 text-emerald-400" />
                    {!isFullscreen && <span className="hidden sm:inline">QR Code</span>}
                  </button>

                  <button
                    onClick={toggleFullScreen}
                    className="bg-slate-950/80 hover:bg-slate-900 text-white p-2 rounded-xl border border-slate-700/70 backdrop-blur-md transition-all cursor-pointer shadow-md flex items-center gap-1.5 text-xs font-sans font-medium"
                    title={isFullscreen ? "Exit Fullscreen Mode (Esc)" : "Enter Fullscreen Mode"}
                  >
                    {isFullscreen ? <Minimize className="w-4 h-4 text-amber-400" /> : <Maximize className="w-4 h-4 text-emerald-400" />}
                    <span>{isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen"}</span>
                  </button>
                </div>

                {/* Fullscreen Overlay Floating Indicator */}
                {isFullscreen && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 border border-slate-700 text-white px-5 py-2 rounded-full text-xs font-sans font-medium flex items-center gap-3 shadow-2xl backdrop-blur-md animate-fadeIn">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Full Screen Mode • Press <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-600 rounded text-[10px] font-mono text-emerald-300">Esc</kbd> to exit</span>
                    <button
                      onClick={toggleFullScreen}
                      className="hover:bg-slate-800 text-slate-400 hover:text-white p-1 rounded-full transition-colors cursor-pointer"
                      title="Exit Fullscreen"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                
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
                    setSecurityAnswer("");
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

      {/* Quick Access Session QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center space-y-5 shadow-2xl relative">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-all cursor-pointer"
              title="Close Modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-mono px-3 py-1 rounded-full font-bold uppercase tracking-wider inline-block">
                Classroom QR Access
              </span>
              <h3 className="text-xl font-sans font-bold text-slate-900 pt-2">Scan to Join Live Session</h3>
              <p className="text-xs text-slate-500 leading-relaxed">Point your mobile camera at this QR code to join instantly without typing.</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 inline-block shadow-inner">
              <QRCodeSVG
                value={directJoinUrl}
                size={200}
                level="H"
                includeMargin={true}
                className="rounded-xl shadow-xs"
              />
            </div>

            <div className="bg-slate-900 text-white p-3.5 rounded-2xl space-y-1 shadow-md">
              <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">4-Digit Session Code</span>
              <p className="text-3xl font-mono font-extrabold tracking-widest text-emerald-400">
                {roomCode || "----"}
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(directJoinUrl);
                  showStreamToast("Direct join link copied to clipboard!");
                }}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" /> Copy Link
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(roomCode);
                  showStreamToast("4-digit session code copied!");
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Clipboard className="w-3.5 h-3.5" /> Copy Code
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Camera Picture-in-Picture & Mic Testing Modals */}
      {currentScreen === "classroom" && (
        role === "EDUCATOR" ? (
        <CameraPipOverlay
          role={role}
          userName={userName}
          autoStart={role === "EDUCATOR" && !!lastLaunchSettingsRef.current?.camEnabled}
          onCameraStateChange={(active) => {
            const activeSocket = wsRef.current;
            if (activeSocket?.readyState === WebSocket.OPEN) {
              activeSocket.send(JSON.stringify({ type: "educator-camera-state", active }));
            }
          }}
          onCameraFrame={(dataUrl) => {
            const activeSocket = wsRef.current;
            if (activeSocket?.readyState === WebSocket.OPEN && activeSocket.bufferedAmount < 512 * 1024) {
              activeSocket.send(JSON.stringify({ type: "educator-camera-frame", dataUrl }));
            }
          }}
        />
        ) : remoteEducatorCameraActive && remoteEducatorCameraFrame ? (
          <div className="fixed bottom-6 right-6 z-40 w-72 sm:w-80 bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-950 text-xs text-slate-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Educator Camera Live
            </div>
            <img src={remoteEducatorCameraFrame} alt="Live educator camera" className="w-full aspect-video object-cover scale-x-[-1]" />
          </div>
        ) : null
      )}
      <MicTestModal isOpen={isMicTestOpen} onClose={() => setIsMicTestOpen(false)} />

      {currentScreen === "landing" && (
        <footer className="pb-8 px-4 text-center text-[11px] text-slate-400">
          © {new Date().getFullYear()} Ejoe Tso. All rights reserved.
        </footer>
      )}

    </div>
  );
}
