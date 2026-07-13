import React, { useState } from "react";
import { Sparkles, FileText, CheckCircle2, AlertCircle, RefreshCw, Loader2 } from "lucide-react";

interface AIAssistantProps {
  roomCode: string;
  chatMessages: any[];
  whiteboardActions: any[];
}

export default function AIAssistant({ roomCode, chatMessages, whiteboardActions }: AIAssistantProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [activeTab, setActiveTab] = useState<"summary" | "quiz">("summary");

  // Compile transcripts and whiteboard context to send to Gemini
  const generateAIAssistance = async () => {
    setLoading(true);
    setError(null);
    setSummary(null);
    setQuiz(null);
    setSelectedAnswers({});

    // Phase 1: Transcribing
    setLoadingPhase("Analyzing classroom chat history...");
    const transcriptText = chatMessages
      .map((msg) => `[${msg.timestamp}] ${msg.senderName} (${msg.senderRole}): ${msg.content}`)
      .join("\n");

    // Phase 2: Compiling Whiteboard Actions
    setLoadingPhase("Analyzing whiteboard and slides context...");
    const whiteboardNotes = `The educator performed ${whiteboardActions.length} drawing, clearing, or stroke actions on the collaborative blackboard.`;

    try {
      // Fetch Summary from server proxy (to keep API keys safe!)
      setLoadingPhase("Formulating lesson summary with Gemini 3.5...");
      const summaryRes = await fetch("/api/gemini/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: roomCode,
          transcriptText,
          whiteboardNotes,
        }),
      });

      if (!summaryRes.ok) {
        const errData = await summaryRes.json();
        throw new Error(errData.error || "Failed to fetch summary.");
      }

      const summaryData = await summaryRes.json();
      setSummary(summaryData.summary);

      // Phase 3: Fetch Interactive Quiz
      setLoadingPhase("Creating interactive review questions with Gemini...");
      const quizRes = await fetch("/api/gemini/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: roomCode,
          lectureContext: `${transcriptText}\n${whiteboardNotes}\nSummary: ${summaryData.summary}`,
        }),
      });

      if (!quizRes.ok) {
        const errData = await quizRes.json();
        throw new Error(errData.error || "Failed to generate quiz.");
      }

      const quizData = await quizRes.json();
      setQuiz(quizData.quiz);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred while communicating with Gemini.");
    } finally {
      setLoading(false);
      setLoadingPhase("");
    }
  };

  const handleSelectAnswer = (qIdx: number, oIdx: number) => {
    if (selectedAnswers[qIdx] !== undefined) return; // Prevent re-answering
    setSelectedAnswers({
      ...selectedAnswers,
      [qIdx]: oIdx,
    });
  };

  return (
    <div className="bg-gradient-to-br from-emerald-50/40 via-white to-white border border-slate-200/60 rounded-2xl shadow-sm p-6 space-y-5 relative overflow-hidden">
      
      {/* Decorative background blob */}
      <div className="absolute top-0 right-0 w-36 h-36 bg-radial-at-t from-emerald-500/10 via-transparent to-transparent pointer-events-none"></div>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-slate-100 pb-4">
        <div className="space-y-0.5">
          <h3 className="text-sm font-sans font-medium text-slate-800 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse" />
            Gemini AI Classroom Companion
          </h3>
          <p className="text-[11px] text-slate-500 font-sans">
            Instantly generate study summaries and interactive review quiz cards from live class discussions.
          </p>
        </div>

        {!loading && (
          <button
            id="ai_generate_btn"
            onClick={generateAIAssistance}
            className="text-xs bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-3.5 py-2.5 rounded-xl transition-all font-sans font-medium flex items-center justify-center gap-1.5 cursor-pointer shadow-sm hover:shadow-md"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {summary ? "Regenerate Notes" : "Generate Notes & Quiz"}
          </button>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 animate-fadeIn">
          <div className="p-3 bg-emerald-50 rounded-2xl">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-sans font-medium text-slate-800">Compiling Classroom Insights...</p>
            <p className="text-xs text-slate-500 font-mono italic animate-pulse">{loadingPhase}</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200/80 p-4 rounded-xl flex items-start gap-2.5 animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-sans font-medium text-red-900">Gemini Key or Network Unconfigured</h4>
            <p className="text-xs text-red-800 leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* AI Output Panels */}
      {!loading && summary && (
        <div className="space-y-4 animate-fadeIn">
          {/* Sub Tab selector */}
          <div className="flex bg-slate-50 border border-slate-150 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("summary")}
              className={`flex-1 py-2 rounded-lg font-sans text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "summary" ? "bg-white text-slate-900 shadow-sm font-semibold" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Markdown Lecture Notes
            </button>
            <button
              onClick={() => setActiveTab("quiz")}
              className={`flex-1 py-2 rounded-lg font-sans text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "quiz" ? "bg-white text-slate-900 shadow-sm font-semibold" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Interactive Review Quiz ({quiz?.length || 0})
            </button>
          </div>

          {/* Sub Tab: Summary Output */}
          {activeTab === "summary" && (
            <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 overflow-y-auto max-h-96 pr-2">
              <div className="prose prose-sm prose-slate max-w-none text-slate-700 text-xs font-sans leading-relaxed space-y-4">
                {summary.split("\n").map((line, idx) => {
                  if (line.startsWith("# ")) {
                    return <h1 key={idx} className="text-lg font-bold text-slate-900 mt-4 border-b border-slate-200 pb-1">{line.replace("# ", "")}</h1>;
                  }
                  if (line.startsWith("## ")) {
                    return <h2 key={idx} className="text-sm font-bold text-slate-800 mt-3">{line.replace("## ", "")}</h2>;
                  }
                  if (line.startsWith("### ")) {
                    return <h3 key={idx} className="text-xs font-bold text-slate-800 mt-2">{line.replace("### ", "")}</h3>;
                  }
                  if (line.startsWith("- ") || line.startsWith("* ")) {
                    return <li key={idx} className="ml-4 list-disc pl-1 mb-1">{line.substring(2)}</li>;
                  }
                  if (line.trim() === "") {
                    return <div key={idx} className="h-2"></div>;
                  }
                  return <p key={idx}>{line}</p>;
                })}
              </div>
            </div>
          )}

          {/* Sub Tab: Review Quiz */}
          {activeTab === "quiz" && quiz && (
            <div className="space-y-6">
              {quiz.map((q, qIdx) => {
                const chosenIdx = selectedAnswers[qIdx];
                const isCorrect = chosenIdx === q.correctAnswerIndex;

                return (
                  <div key={qIdx} className="border border-slate-150 p-4 rounded-2xl bg-white shadow-sm space-y-3">
                    <div className="flex gap-2">
                      <span className="bg-slate-100 text-slate-700 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold shrink-0">
                        {qIdx + 1}
                      </span>
                      <h4 className="text-xs font-sans font-semibold text-slate-800 leading-normal">{q.question}</h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pl-7">
                      {q.options.map((opt: string, oIdx: number) => {
                        const isChosen = chosenIdx === oIdx;
                        const isRightAnswer = q.correctAnswerIndex === oIdx;

                        let btnStyle = "bg-white border-slate-200 text-slate-700 hover:bg-slate-50";
                        if (chosenIdx !== undefined) {
                          if (isRightAnswer) {
                            btnStyle = "bg-emerald-55 text-emerald-800 border-emerald-300 ring-1 ring-emerald-300";
                          } else if (isChosen) {
                            btnStyle = "bg-red-50 text-red-800 border-red-300 ring-1 ring-red-300";
                          } else {
                            btnStyle = "bg-slate-50 border-slate-100 text-slate-400 opacity-60";
                          }
                        }

                        return (
                          <button
                            key={oIdx}
                            onClick={() => handleSelectAnswer(qIdx, oIdx)}
                            disabled={chosenIdx !== undefined}
                            className={`px-3.5 py-2.5 border rounded-xl text-xs font-sans text-left transition-all ${btnStyle} cursor-pointer`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>

                    {/* Explanatory notes after responding */}
                    {chosenIdx !== undefined && (
                      <div className={`mt-3 pl-7 py-3 pr-4 rounded-xl border flex items-start gap-2.5 animate-fadeIn ${
                        isCorrect ? "bg-emerald-50/50 border-emerald-100 text-emerald-900" : "bg-red-50/50 border-red-100 text-red-900"
                      }`}>
                        {isCorrect ? (
                          <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-4.5 h-4.5 text-red-500 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-0.5 text-xs font-sans">
                          <p className="font-semibold">{isCorrect ? "Correct answer!" : "Incorrect."}</p>
                          <p className="text-slate-600 text-[11px] leading-relaxed">{q.explanation}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Blank placeholder state if not generated yet */}
      {!loading && !summary && (
        <div className="text-center py-8 border border-dashed border-slate-200 rounded-2xl bg-white space-y-3.5">
          <Sparkles className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5]" />
          <div className="space-y-1">
            <h4 className="text-xs font-sans font-medium text-slate-800">AI Notes Companion Idle</h4>
            <p className="text-[11px] text-slate-400 font-sans max-w-sm mx-auto">
              Once you have conducted some chats or drawing notations, click "Generate Notes" to let Gemini compile study aids.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
