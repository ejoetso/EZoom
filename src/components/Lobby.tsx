import { useState, useEffect, useRef } from "react";
import { Camera, Mic, Volume2, Monitor, Play, CheckCircle, QrCode, Sliders } from "lucide-react";
import MicTestModal from "./MicTestModal";

interface LobbyProps {
  onJoin: (settings: {
    micEnabled: boolean;
    camEnabled: boolean;
    qualityMode: "detail" | "balanced" | "motion";
  }) => void;
  title: string;
  courseName: string;
  role: "EDUCATOR" | "STUDENT";
  roomCode?: string;
  onOpenQr?: () => void;
}

export default function Lobby({ onJoin, title, courseName, role, roomCode, onOpenQr }: LobbyProps) {
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(role === "EDUCATOR");
  const [qualityMode, setQualityMode] = useState<"detail" | "balanced" | "motion">("balanced");
  const [micLevel, setMicLevel] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isMicTestOpen, setIsMicTestOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micIntervalRef = useRef<number | null>(null);

  // Setup media preview
  useEffect(() => {
    async function setupPreview() {
      try {
        const constraints = {
          video: role === "EDUCATOR" ? { width: 320, height: 240 } : false,
          audio: true,
        };
        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        setStream(mediaStream);

        if (videoRef.current && mediaStream.getVideoTracks().length > 0) {
          videoRef.current.srcObject = mediaStream;
        }

        // Setup real audio visualizer
        if (mediaStream.getAudioTracks().length > 0) {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          const audioContext = new AudioContextClass();
          audioContextRef.current = audioContext;

          const source = audioContext.createMediaStreamSource(mediaStream);
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          analyserRef.current = analyser;

          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);

          const updateVolume = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
              sum += dataArray[i];
            }
            const average = sum / bufferLength;
            // Map to percentage (0 - 100)
            setMicLevel(Math.min(100, Math.floor((average / 128) * 100)));
            micIntervalRef.current = requestAnimationFrame(updateVolume);
          };
          micIntervalRef.current = requestAnimationFrame(updateVolume);
        }
      } catch (err) {
        console.warn("Could not obtain camera/microphone for lobby preview:", err);
      }
    }

    setupPreview();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (micIntervalRef.current) {
        cancelAnimationFrame(micIntervalRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Handle track toggling
  useEffect(() => {
    if (stream) {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks[0].enabled = micEnabled;
      }
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length > 0) {
        videoTracks[0].enabled = camEnabled;
      }
    }
  }, [micEnabled, camEnabled, stream]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 py-8">
      <div className="w-full max-w-3xl bg-white border border-gray-100 rounded-3xl shadow-xl overflow-hidden">
        
        {/* Header Banner */}
        <div className="bg-slate-900 text-white p-6 sm:p-8 relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="relative z-10">
            <div className="absolute inset-0 bg-radial-at-t from-emerald-500/10 via-transparent to-transparent pointer-events-none"></div>
            <p className="text-emerald-400 font-mono text-xs uppercase tracking-widest mb-1">Pre-Class Lobby</p>
            <h1 className="text-2xl sm:text-3xl font-sans font-medium tracking-tight text-white mb-1">{title}</h1>
            <p className="text-slate-400 text-xs sm:text-sm font-mono">{courseName} • Role: {role}</p>
          </div>
          {roomCode && (
            <div className="relative z-10 flex items-center gap-3 bg-slate-800/90 border border-slate-700/70 p-2.5 px-3.5 rounded-2xl backdrop-blur-md shadow-md">
              <div>
                <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400 block">4-Digit Session Code</span>
                <span className="text-xl font-mono font-bold tracking-widest text-emerald-400">{roomCode}</span>
              </div>
              {onOpenQr && (
                <button
                  onClick={onOpenQr}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white p-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold shadow-sm ml-1"
                  title="View QR Code"
                >
                  <QrCode className="w-4 h-4" />
                  <span>QR Code</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Left Column: Device Previews */}
          <div className="space-y-6">
            <h2 className="text-lg font-sans font-medium text-slate-800">Media & Device Controls</h2>
            
            {/* Camera Preview Box */}
            <div className="aspect-video w-full bg-slate-100 rounded-2xl border border-slate-200/60 overflow-hidden relative flex items-center justify-center">
              {camEnabled && role === "EDUCATOR" ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
              ) : (
                <div className="text-center text-slate-400 space-y-2">
                  <Camera className="w-10 h-10 mx-auto stroke-[1.5]" />
                  <p className="text-xs font-sans">Camera is disabled</p>
                </div>
              )}
              
              {/* Overlays */}
              <div className="absolute bottom-3 left-3 bg-slate-950/70 text-white text-[11px] px-2.5 py-1 rounded-full backdrop-blur-md font-mono flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${micEnabled ? "bg-emerald-500" : "bg-red-500"}`}></span>
                {micEnabled ? "Mic On" : "Mic Muted"}
              </div>
            </div>

            {/* Mic Indicator & Toggles */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <Volume2 className="w-5 h-5 text-slate-400" />
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between text-xs font-mono text-slate-500">
                    <span>Input Volume Indicator</span>
                    <span>{micEnabled ? `${micLevel}%` : "Muted"}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-75"
                      style={{ width: micEnabled ? `${micLevel}%` : "0%" }}
                    ></div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsMicTestOpen(true)}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-750 text-slate-100 rounded-xl font-sans text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700 cursor-pointer shadow-sm transition-all"
              >
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                Test Voice Stream Microphone
              </button>

              {/* Toggle Buttons */}
              <div className="flex gap-3">
                <button
                  id="lobby_mic_toggle"
                  onClick={() => setMicEnabled(!micEnabled)}
                  className={`flex-1 py-3 px-4 rounded-xl font-sans text-sm font-medium transition-all flex items-center justify-center gap-2 border ${
                    micEnabled
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Mic className="w-4 h-4" />
                  {micEnabled ? "Muted Mic" : "Unmute Mic"}
                </button>

                {role === "EDUCATOR" && (
                  <button
                    id="lobby_cam_toggle"
                    onClick={() => setCamEnabled(!camEnabled)}
                    className={`flex-1 py-3 px-4 rounded-xl font-sans text-sm font-medium transition-all flex items-center justify-center gap-2 border ${
                      camEnabled
                        ? "bg-slate-900 border-slate-950 text-white"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Camera className="w-4 h-4" />
                    {camEnabled ? "Disable Cam" : "Enable Cam"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Settings & Proceed */}
          <div className="flex flex-col justify-between space-y-6">
            
            {/* Educator Quality Mode Presets */}
            {role === "EDUCATOR" ? (
              <div className="space-y-4">
                <h3 className="text-sm font-sans font-medium text-slate-700 flex items-center gap-1.5">
                  <Monitor className="w-4 h-4 text-slate-400" />
                  Broadcasting Optimization Mode
                </h3>
                
                <div className="space-y-2.5">
                  <button
                    onClick={() => setQualityMode("detail")}
                    className={`w-full p-3 rounded-xl border text-left transition-all ${
                      qualityMode === "detail"
                        ? "border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-xs font-sans font-medium text-slate-800">Detail & Text Mode</span>
                      {qualityMode === "detail" && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500">Optimizes screen broadcast sharpness for coding, codebases, slides, and websites.</p>
                  </button>

                  <button
                    onClick={() => setQualityMode("balanced")}
                    className={`w-full p-3 rounded-xl border text-left transition-all ${
                      qualityMode === "balanced"
                        ? "border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-xs font-sans font-medium text-slate-800">Balanced Mode</span>
                      {qualityMode === "balanced" && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500">Adaptive frame-rates and sharpness suitable for general slides and web navigation.</p>
                  </button>

                  <button
                    onClick={() => setQualityMode("motion")}
                    className={`w-full p-3 rounded-xl border text-left transition-all ${
                      qualityMode === "motion"
                        ? "border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-xs font-sans font-medium text-slate-800">Motion Mode</span>
                      {qualityMode === "motion" && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500">Prioritizes smooth 30 FPS playback for embedded video demonstrations or animations.</p>
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-3.5">
                <h3 className="text-xs font-mono uppercase tracking-wider text-slate-500">Welcome, Student</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  You are about to enter the waiting room. Once the educator admits you, you'll immediately receive the screen broadcast, audio feed, and interactive whiteboard.
                </p>
                <div className="flex items-center gap-2.5 text-xs text-slate-500 font-mono">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                  Waiting room is ACTIVE
                </div>
              </div>
            )}

            {/* Join / Start Button */}
            <button
              id="lobby_join_btn"
              onClick={() => onJoin({ micEnabled, camEnabled, qualityMode })}
              className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white py-4 rounded-xl font-sans font-medium shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer mt-auto"
            >
              <Play className="w-4 h-4 fill-white" />
              {role === "EDUCATOR" ? "Launch & Start Session" : "Join Classroom"}
            </button>
          </div>
        </div>

      </div>

      <MicTestModal isOpen={isMicTestOpen} onClose={() => setIsMicTestOpen(false)} />
    </div>
  );
}
