import React, { useState, useEffect, useRef } from "react";
import { Camera, CameraOff, PictureInPicture2, Maximize2, Minimize2, Move, X, Mic, MicOff, RefreshCw } from "lucide-react";

interface CameraPipOverlayProps {
  role: "EDUCATOR" | "STUDENT";
  userName: string;
  isHostVoiceActive?: boolean;
}

export default function CameraPipOverlay({ role, userName }: CameraPipOverlayProps) {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isNativePipActive, setIsNativePipActive] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMirrored, setIsMirrored] = useState(true);
  const [isMicActive, setIsMicActive] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const startCamera = async () => {
    setErrorMessage(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 360 },
        audio: true,
      });
      setStream(mediaStream);
      setIsCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      setErrorMessage(err.message || "Failed to access webcam camera.");
    }
  };

  const stopCamera = () => {
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
    setIsNativePipActive(false);
  };

  const toggleNativePip = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsNativePipActive(false);
      } else {
        await videoRef.current.requestPictureInPicture();
        setIsNativePipActive(true);
      }
    } catch (err: any) {
      console.error("PiP error:", err);
      setErrorMessage("Picture-in-Picture error: " + (err.message || "Not supported by browser"));
    }
  };

  const toggleMic = () => {
    if (stream) {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks[0].enabled = !isMicActive;
        setIsMicActive(!isMicActive);
      }
    }
  };

  useEffect(() => {
    const handleLeavePip = () => {
      setIsNativePipActive(false);
    };

    const vidEl = videoRef.current;
    if (vidEl) {
      vidEl.addEventListener("leavepictureinpicture", handleLeavePip);
    }

    return () => {
      if (vidEl) {
        vidEl.removeEventListener("leavepictureinpicture", handleLeavePip);
      }
    };
  }, [videoRef.current]);

  return (
    <div className="fixed bottom-6 right-6 z-40 animate-fadeIn">
      {!isCameraActive ? (
        <button
          onClick={startCamera}
          className="bg-slate-900 hover:bg-slate-800 text-white border border-slate-700/80 px-3.5 py-2 rounded-2xl text-xs font-sans font-semibold flex items-center gap-2 shadow-xl hover:shadow-2xl transition-all cursor-pointer backdrop-blur-md"
          title="Enable Camera & Picture-in-Picture window"
        >
          <Camera className="w-4 h-4 text-emerald-400" />
          <span>Enable Camera PiP</span>
        </button>
      ) : (
        <div
          className={`bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-md transition-all duration-300 ${
            isMinimized ? "w-52" : "w-72 sm:w-80"
          }`}
        >
          {/* PiP Header Bar */}
          <div className="bg-slate-950/90 px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs font-sans">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-semibold text-slate-200 text-[11px] truncate max-w-[130px]">
                {userName || "You"} ({role})
              </span>
            </div>

            <div className="flex items-center gap-1 text-slate-400">
              <button
                onClick={toggleNativePip}
                className={`p-1 hover:text-white rounded-lg transition-colors cursor-pointer ${
                  isNativePipActive ? "text-emerald-400 bg-emerald-950/80" : "hover:bg-slate-800"
                }`}
                title="Pop out to Native Floating Picture-in-Picture"
              >
                <PictureInPicture2 className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setIsMirrored(!isMirrored)}
                className="p-1 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Flip / Mirror Video"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title={isMinimized ? "Expand Camera" : "Minimize Camera"}
              >
                {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={stopCamera}
                className="p-1 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Turn off Camera"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Video Player Display */}
          {!isMinimized && (
            <div className="relative bg-black aspect-video overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${isMirrored ? "scale-x-[-1]" : ""}`}
              />

              {errorMessage && (
                <div className="absolute inset-0 bg-slate-900/90 p-3 text-red-400 text-xs flex items-center justify-center text-center">
                  {errorMessage}
                </div>
              )}

              {/* Bottom Video Controls Overlay */}
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-auto">
                <button
                  onClick={toggleMic}
                  className={`p-1.5 rounded-xl text-xs flex items-center gap-1 font-mono transition-all backdrop-blur-md cursor-pointer ${
                    isMicActive ? "bg-slate-900/80 text-emerald-400 border border-slate-700" : "bg-red-600/90 text-white"
                  }`}
                  title={isMicActive ? "Mute Camera Mic" : "Unmute Camera Mic"}
                >
                  {isMicActive ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
                </button>

                <button
                  onClick={toggleNativePip}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded-xl text-[10px] font-sans font-bold shadow flex items-center gap-1 cursor-pointer"
                >
                  <PictureInPicture2 className="w-3 h-3" /> Native PiP
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
