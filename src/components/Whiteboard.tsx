import React, { useEffect, useRef, useState } from "react";
import { PenTool, Trash2, RotateCcw, Download, Check } from "lucide-react";

interface WhiteboardProps {
  ws: WebSocket | null;
  role: "EDUCATOR" | "STUDENT";
  roomCode: string;
  initialHistory?: any[];
}

export default function Whiteboard({ ws, role, roomCode, initialHistory = [] }: WhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#0f172a"); // Default slate-900
  const [width, setWidth] = useState(3);
  const [tool, setTool] = useState<"pen" | "highlighter">("pen");
  const [drawHistory, setDrawHistory] = useState<any[]>(initialHistory);

  // Active line buffer for current stroke
  const currentStrokeRef = useRef<{ x: number; y: number }[]>([]);

  // Colors list
  const colors = [
    { value: "#0f172a", label: "Dark" }, // Slate-900
    { value: "#ef4444", label: "Red" },  // Red-500
    { value: "#3b82f6", label: "Blue" }, // Blue-500
    { value: "#10b981", label: "Green" },// Emerald-500
    { value: "#eab308", label: "Yellow" }// Yellow-500
  ];

  // Resize and handle redraw
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      // Keep backup of canvas contents or simply redraw from history
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;

      // Redraw everything in history
      redrawAll();
    };

    window.addEventListener("resize", handleResize);
    // Initial size
    setTimeout(handleResize, 100);

    return () => window.removeEventListener("resize", handleResize);
  }, [drawHistory]);

  // Redraw all elements in history
  const redrawAll = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawHistory.forEach((action) => {
      if (action.type === "draw" && action.points && action.points.length > 0) {
        drawStrokeOnCanvas(ctx, action.points, action.color, action.width, action.isHighlighter);
      }
    });
  };

  // Listen for real-time remote drawing events
  useEffect(() => {
    if (!ws) return;

    const handleWSMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "whiteboard-action") {
          const action = data.action;
          setDrawHistory((prev) => {
            const updated = [...prev, action];
            // Immediately draw on canvas to avoid latency
            const canvas = canvasRef.current;
            if (canvas) {
              const ctx = canvas.getContext("2d");
              if (ctx && action.type === "draw" && action.points) {
                drawStrokeOnCanvas(ctx, action.points, action.color, action.width, action.isHighlighter);
              }
            }
            return updated;
          });
        } else if (data.type === "whiteboard-clear") {
          setDrawHistory([]);
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext("2d");
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        }
      } catch (err) {
        console.error("Whiteboard WS Event error:", err);
      }
    };

    ws.addEventListener("message", handleWSMessage);
    return () => ws.removeEventListener("message", handleWSMessage);
  }, [ws]);

  // Draw a normalized stroke onto the canvas
  const drawStrokeOnCanvas = (
    ctx: CanvasRenderingContext2D,
    normalizedPoints: { x: number; y: number }[],
    strokeColor: string,
    strokeWidth: number,
    isHighlighter: boolean
  ) => {
    if (normalizedPoints.length === 0) return;

    const canvas = ctx.canvas;
    const w = canvas.width;
    const h = canvas.height;

    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (isHighlighter) {
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = strokeColor === "#0f172a" ? "#eab308" : strokeColor; // yellow tint for default black highlighter
    }

    // Denormalize points
    const p0 = normalizedPoints[0];
    ctx.moveTo(p0.x * w, p0.y * h);

    for (let i = 1; i < normalizedPoints.length; i++) {
      const p = normalizedPoints[i];
      ctx.lineTo(p.x * w, p.y * h);
    }

    ctx.stroke();
    ctx.restore();
  };

  // Start Drawing (only for Educators, or Collaborative student mode)
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Students can view but are receive-only by default on whiteboard
    if (role === "STUDENT") return;

    setIsDrawing(true);
    const pos = getEventCoords(e);
    currentStrokeRef.current = [pos];
  };

  // Track coordinates
  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || role === "STUDENT") return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const pos = getEventCoords(e);
    const lastPos = currentStrokeRef.current[currentStrokeRef.current.length - 1];

    if (lastPos) {
      // Local preview draw (non-normalized, fast response)
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (tool === "highlighter") {
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = color === "#0f172a" ? "#eab308" : color;
      }

      ctx.moveTo(lastPos.x * canvas.width, lastPos.y * canvas.height);
      ctx.lineTo(pos.x * canvas.width, pos.y * canvas.height);
      ctx.stroke();
      ctx.restore();
    }

    currentStrokeRef.current.push(pos);
  };

  // Complete Drawing and Sync
  const endDrawing = () => {
    if (!isDrawing || role === "STUDENT") return;
    setIsDrawing(false);

    if (currentStrokeRef.current.length > 1) {
      const action = {
        type: "draw",
        points: currentStrokeRef.current,
        color,
        width,
        isHighlighter: tool === "highlighter",
      };

      // Add to local history
      setDrawHistory((prev) => [...prev, action]);

      // Emit over WS
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "whiteboard-action",
          action,
        }));
      }
    }
    currentStrokeRef.current = [];
  };

  // Helper to capture touch or mouse events and normalize coordinate mapped inside (0-1)
  const getEventCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ("touches" in e) {
      if (e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
    };
  };

  // Clear Whiteboard
  const handleClear = () => {
    if (role === "STUDENT") return;
    setDrawHistory([]);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "whiteboard-clear" }));
    }
  };

  // Undo Last Drawing
  const handleUndo = () => {
    if (role === "STUDENT" || drawHistory.length === 0) return;
    const newHistory = drawHistory.slice(0, -1);
    setDrawHistory(newHistory);

    // Redraw
    setTimeout(() => {
      redrawAll();
      // Inform students to clear and sync back everything
      // For simple sync, we can clear students' canvases and they sync on next action or we send full stack.
      // In full-scale, we can sync the new array or just send a clear and repaint.
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "whiteboard-clear" }));
        newHistory.forEach((act) => {
          ws.send(JSON.stringify({ type: "whiteboard-action", action: act }));
        });
      }
    }, 50);
  };

  // Download whiteboard document as file
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `educast-whiteboard-${roomCode}.png`;
    link.href = url;
    link.click();
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 border border-slate-200/70 rounded-2xl overflow-hidden shadow-inner relative group">
      
      {/* Educator Toolbar overlay */}
      {role === "EDUCATOR" && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/95 border border-slate-150 backdrop-blur-md px-5 py-2.5 rounded-full shadow-lg flex items-center gap-4 z-20 transition-all hover:shadow-xl">
          {/* Tools Toggle */}
          <div className="flex items-center gap-1.5 border-r border-slate-200 pr-4">
            <button
              onClick={() => setTool("pen")}
              className={`p-2 rounded-lg transition-all ${
                tool === "pen"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
              title="Pen"
            >
              <PenTool className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTool("highlighter")}
              className={`p-2 rounded-lg transition-all ${
                tool === "highlighter"
                  ? "bg-yellow-400 text-slate-950"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
              title="Highlighter"
            >
              <span className="text-xs font-sans font-bold">A</span>
            </button>
          </div>

          {/* Stroke Size */}
          <div className="flex items-center gap-1.5 border-r border-slate-200 pr-4">
            <button
              onClick={() => setWidth(2)}
              className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] ${
                width === 2 ? "border-slate-800 bg-slate-100" : "border-slate-200"
              }`}
            >
              •
            </button>
            <button
              onClick={() => setWidth(5)}
              className={`w-6 h-6 rounded-full border flex items-center justify-center text-[14px] ${
                width === 5 ? "border-slate-800 bg-slate-100" : "border-slate-200"
              }`}
            >
              ●
            </button>
            <button
              onClick={() => setWidth(10)}
              className={`w-7 h-7 rounded-full border flex items-center justify-center text-[18px] ${
                width === 10 ? "border-slate-800 bg-slate-100" : "border-slate-200"
              }`}
            >
              ●
            </button>
          </div>

          {/* Colors List */}
          <div className="flex items-center gap-2 border-r border-slate-200 pr-4">
            {colors.map((c) => (
              <button
                key={c.value}
                onClick={() => setColor(c.value)}
                className="w-5.5 h-5.5 rounded-full border border-slate-200 shadow-sm relative transition-transform hover:scale-110 flex items-center justify-center cursor-pointer"
                style={{ backgroundColor: c.value }}
              >
                {color === c.value && (
                  <Check className={`w-3.5 h-3.5 ${c.value === "#0f172a" ? "text-white" : "text-white"}`} />
                )}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            <button
              id="wb_undo_btn"
              onClick={handleUndo}
              disabled={drawHistory.length === 0}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-all cursor-pointer"
              title="Undo"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              id="wb_clear_btn"
              onClick={handleClear}
              className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-all cursor-pointer"
              title="Clear Canvas"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Canvas Meta Information / Floating action to download */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button
          onClick={handleDownload}
          className="bg-white/90 border border-slate-200 hover:border-slate-300 shadow-md backdrop-blur-md p-2.5 rounded-xl text-slate-700 hover:text-slate-900 transition-all cursor-pointer"
          title="Download as PNG"
        >
          <Download className="w-4 h-4" />
        </button>
        <span className="bg-slate-900/80 border border-slate-800/20 backdrop-blur-md px-3 py-1.5 rounded-xl text-[11px] font-mono text-white flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
          Whiteboard Mode
        </span>
      </div>

      {/* Canvas Area */}
      <div ref={containerRef} className="flex-1 w-full h-full relative cursor-crosshair">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={endDrawing}
          onMouseLeave={endDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={endDrawing}
          className="absolute inset-0 bg-white"
        />
        {role === "STUDENT" && (
          <div className="absolute inset-0 bg-transparent pointer-events-none" />
        )}
      </div>
    </div>
  );
}
