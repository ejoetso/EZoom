import React, { useEffect, useRef, useState } from "react";
import { PenTool, Highlighter, Trash2, Check } from "lucide-react";

interface AnnotationsProps {
  ws: WebSocket | null;
  role: "EDUCATOR" | "STUDENT";
  isActive: boolean;
  onClearCallback?: () => void;
}

export default function Annotations({ ws, role, isActive, onClearCallback }: AnnotationsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<"pen" | "highlighter" | "laser">("pen");
  const [color, setColor] = useState("#ef4444"); // Default red-500
  const [width, setWidth] = useState(3);
  const [annotationHistory, setAnnotationHistory] = useState<any[]>([]);

  const currentStrokeRef = useRef<{ x: number; y: number }[]>([]);

  // Redraw annotations on resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas || !canvas.parentElement) return;

      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;

      redrawAll();
    };

    window.addEventListener("resize", handleResize);
    // Initial size
    setTimeout(handleResize, 150);

    return () => window.removeEventListener("resize", handleResize);
  }, [isActive, annotationHistory]);

  const redrawAll = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    annotationHistory.forEach((action) => {
      if (action.type === "draw" && action.points) {
        drawStroke(ctx, action.points, action.color, action.width, action.isHighlighter);
      }
    });
  };

  // Sync with remote events
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "annotation-action") {
          const action = data.action;
          setAnnotationHistory((prev) => {
            const updated = [...prev, action];
            const canvas = canvasRef.current;
            if (canvas) {
              const ctx = canvas.getContext("2d");
              if (ctx && action.type === "draw" && action.points) {
                drawStroke(ctx, action.points, action.color, action.width, action.isHighlighter);
              }
            }
            return updated;
          });
        } else if (data.type === "annotations-clear") {
          setAnnotationHistory([]);
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext("2d");
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        }
      } catch (err) {}
    };

    ws.addEventListener("message", handleMessage);
    return () => ws.removeEventListener("message", handleMessage);
  }, [ws]);

  const drawStroke = (
    ctx: CanvasRenderingContext2D,
    points: { x: number; y: number }[],
    strokeColor: string,
    strokeWidth: number,
    isHighlighter: boolean
  ) => {
    if (points.length === 0) return;
    const canvas = ctx.canvas;

    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (isHighlighter) {
      ctx.globalAlpha = 0.45;
    }

    ctx.moveTo(points[0].x * canvas.width, points[0].y * canvas.height);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x * canvas.width, points[i].y * canvas.height);
    }
    ctx.stroke();
    ctx.restore();
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isActive || role === "STUDENT") return;
    setIsDrawing(true);
    const coords = getCoords(e);
    currentStrokeRef.current = [coords];
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !isActive || role === "STUDENT") return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const coords = getCoords(e);
    const lastCoords = currentStrokeRef.current[currentStrokeRef.current.length - 1];

    if (lastCoords) {
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (tool === "highlighter") {
        ctx.globalAlpha = 0.45;
      }

      ctx.moveTo(lastCoords.x * canvas.width, lastCoords.y * canvas.height);
      ctx.lineTo(coords.x * canvas.width, coords.y * canvas.height);
      ctx.stroke();
      ctx.restore();
    }

    currentStrokeRef.current.push(coords);
  };

  const endDraw = () => {
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

      setAnnotationHistory((prev) => [...prev, action]);

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "annotation-action",
          action
        }));
      }
    }
    currentStrokeRef.current = [];
  };

  const getCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  const handleClear = () => {
    setAnnotationHistory([]);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "annotations-clear" }));
    }

    if (onClearCallback) onClearCallback();
  };

  if (!isActive) return null;

  return (
    <div className="absolute inset-0 z-30 pointer-events-auto">
      <canvas
        ref={canvasRef}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        className="w-full h-full bg-transparent absolute inset-0 cursor-pencil"
      />

      {/* Floating Toolbar for Educator */}
      {role === "EDUCATOR" && (
        <div className="absolute top-2.5 left-4 bg-slate-900/95 border border-slate-800 text-white p-2 rounded-xl shadow-lg flex items-center gap-3 backdrop-blur-md">
          <button
            onClick={() => { setTool("pen"); setWidth(3); }}
            className={`p-1.5 rounded-lg transition-all ${tool === "pen" ? "bg-emerald-600 text-white" : "hover:bg-slate-800 text-slate-300"}`}
            title="Pen"
          >
            <PenTool className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setTool("highlighter"); setWidth(8); }}
            className={`p-1.5 rounded-lg transition-all ${tool === "highlighter" ? "bg-emerald-600 text-white" : "hover:bg-slate-800 text-slate-300"}`}
            title="Highlighter"
          >
            <Highlighter className="w-4 h-4" />
          </button>
          
          <div className="h-4 w-px bg-slate-800 mx-1"></div>

          {/* Color Selection */}
          <div className="flex gap-1">
            {["#ef4444", "#3b82f6", "#eab308", "#10b981"].map((col) => (
              <button
                key={col}
                onClick={() => setColor(col)}
                className="w-4.5 h-4.5 rounded-full border border-slate-700 relative flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
                style={{ backgroundColor: col }}
              >
                {color === col && <Check className="w-3 h-3 text-white" />}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-slate-800 mx-1"></div>

          <button
            onClick={handleClear}
            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
            title="Clear Annotations"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
