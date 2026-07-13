import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, HelpCircle, Send, Award, ThumbsUp, CheckCircle2 } from "lucide-react";
import { UserRole } from "../types";

interface ChatAndQAProps {
  ws: WebSocket | null;
  role: "EDUCATOR" | "STUDENT";
  userId: string;
  chatMessages: any[];
  questions: any[];
  chatEnabled: boolean;
}

export default function ChatAndQA({ ws, role, userId, chatMessages, questions, chatEnabled }: ChatAndQAProps) {
  const [activeTab, setActiveTab] = useState<"chat" | "qa">("chat");
  const [chatInput, setChatInput] = useState("");
  const [isAnnouncement, setIsAnnouncement] = useState(false);
  const [qaInput, setQaInput] = useState("");

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Auto scroll chat to bottom when messages arrive
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !ws) return;

    ws.send(JSON.stringify({
      type: "chat-message",
      content: chatInput,
      isAnnouncement: role === "EDUCATOR" ? isAnnouncement : false,
    }));

    setChatInput("");
    setIsAnnouncement(false);
  };

  const handleAskQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qaInput.trim() || !ws) return;

    ws.send(JSON.stringify({
      type: "question-ask",
      content: qaInput,
    }));

    setQaInput("");
  };

  const handleUpvote = (qId: string) => {
    if (!ws) return;
    ws.send(JSON.stringify({
      type: "question-upvote",
      questionId: qId,
    }));
  };

  const handleResolve = (qId: string) => {
    if (!ws || role !== "EDUCATOR") return;
    ws.send(JSON.stringify({
      type: "question-resolve",
      questionId: qId,
    }));
  };

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
      
      {/* Tabs Selector */}
      <div className="flex bg-slate-50 border-b border-slate-200/60 p-1">
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex-1 py-2.5 rounded-xl font-sans text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === "chat"
              ? "bg-white text-slate-900 shadow-sm border border-slate-150"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          General Chat
        </button>
        <button
          onClick={() => setActiveTab("qa")}
          className={`flex-1 py-2.5 rounded-xl font-sans text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === "qa"
              ? "bg-white text-slate-900 shadow-sm border border-slate-150"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          Q&A Board ({questions.length})
        </button>
      </div>

      {/* Active Tab Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px]">
        {activeTab === "chat" ? (
          /* Chat Message Stream */
          <div className="space-y-3.5">
            {chatMessages.length === 0 ? (
              <div className="text-center py-10 text-slate-400 space-y-2">
                <MessageSquare className="w-8 h-8 mx-auto opacity-40 stroke-[1.5]" />
                <p className="text-xs font-sans">No messages yet. Send a greeting!</p>
              </div>
            ) : (
              chatMessages.map((msg) => {
                const isEdu = msg.senderRole === "EDUCATOR";
                const isOwn = msg.senderId === userId;

                if (msg.isAnnouncement) {
                  return (
                    <div key={msg.id} className="bg-amber-50 border border-amber-200/70 p-3.5 rounded-xl space-y-1 animate-fadeIn">
                      <div className="flex items-center gap-1.5 text-xs text-amber-800 font-sans font-medium">
                        <Award className="w-4 h-4 text-amber-600 fill-amber-100" />
                        Announcement by {msg.senderName}
                      </div>
                      <p className="text-xs font-sans text-amber-900 font-medium leading-relaxed">{msg.content}</p>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col max-w-[85%] ${isOwn ? "ml-auto items-end" : "mr-auto items-start"}`}
                  >
                    <span className="text-[10px] text-slate-400 font-mono mb-0.5">
                      {msg.senderName} {isEdu && <span className="bg-slate-900 text-white px-1.5 py-0.2 rounded-full text-[9px] uppercase font-bold tracking-wider ml-1">Educator</span>}
                    </span>
                    <div
                      className={`p-3 rounded-2xl text-xs font-sans leading-relaxed ${
                        isOwn
                          ? "bg-slate-900 text-white rounded-tr-none"
                          : "bg-slate-50 text-slate-800 rounded-tl-none border border-slate-100"
                      }`}
                    >
                      {msg.content}
                    </div>
                    <span className="text-[9px] text-slate-400 font-mono mt-0.5">{msg.timestamp}</span>
                  </div>
                );
              })
            )}
            <div ref={chatBottomRef} />
          </div>
        ) : (
          /* Q&A List */
          <div className="space-y-3.5">
            {questions.length === 0 ? (
              <div className="text-center py-10 text-slate-400 space-y-2">
                <HelpCircle className="w-8 h-8 mx-auto opacity-40 stroke-[1.5]" />
                <p className="text-xs font-sans">No questions asked yet.</p>
              </div>
            ) : (
              [...questions]
                .sort((a, b) => b.upvotes - a.upvotes)
                .map((q) => (
                  <div
                    key={q.id}
                    className={`border border-slate-150 p-3.5 rounded-xl transition-all ${
                      q.isAnswered ? "bg-slate-50 border-slate-200/60 opacity-75" : "bg-white hover:shadow-sm"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-4 mb-2">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-400 font-mono">{q.senderName} • {q.timestamp}</span>
                        <p className={`text-xs font-sans font-medium text-slate-800 ${q.isAnswered ? "line-through text-slate-400" : ""}`}>
                          {q.content}
                        </p>
                      </div>

                      {/* Vote Count / Action */}
                      <button
                        onClick={() => handleUpvote(q.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer text-xs font-mono ${
                          q.upvotedBy.includes(userId)
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        {q.upvotes}
                      </button>
                    </div>

                    {/* Educator Controls to Resolve */}
                    {role === "EDUCATOR" && !q.isAnswered && (
                      <button
                        onClick={() => handleResolve(q.id)}
                        className="mt-2 text-[11px] text-emerald-600 font-sans font-medium hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Mark as Answered
                      </button>
                    )}

                    {q.isAnswered && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-sans font-medium mt-1">
                        <CheckCircle2 className="w-3 h-3 fill-emerald-50 text-emerald-600" />
                        Answered live in class
                      </span>
                    )}
                  </div>
                ))
            )}
          </div>
        )}
      </div>

      {/* Input Form Footer */}
      <div className="p-3 border-t border-slate-200/60 bg-slate-50">
        {activeTab === "chat" ? (
          /* Chat Input */
          chatEnabled || role === "EDUCATOR" ? (
            <form onSubmit={handleSendChat} className="space-y-2">
              <div className="flex gap-2">
                <input
                  id="chat_message_input"
                  type="text"
                  placeholder="Type a message..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-sans focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
                <button
                  id="chat_send_btn"
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 text-white p-2.5 rounded-xl shadow-sm transition-all flex items-center justify-center cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              {/* Educator Announcement Selector */}
              {role === "EDUCATOR" && (
                <label className="flex items-center gap-1.5 text-[11px] font-sans text-slate-600 select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAnnouncement}
                    onChange={(e) => setIsAnnouncement(e.target.checked)}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  Send as Official Announcement (Gold banner)
                </label>
              )}
            </form>
          ) : (
            <div className="text-center p-2 text-xs font-sans text-slate-500 italic bg-slate-100 rounded-xl border border-slate-200/50">
              Chat has been disabled for students by the educator.
            </div>
          )
        ) : (
          /* Q&A Input */
          <form onSubmit={handleAskQuestion} className="flex gap-2">
            <input
              id="qa_question_input"
              type="text"
              placeholder="Ask a question..."
              value={qaInput}
              onChange={(e) => setQaInput(e.target.value)}
              className="flex-1 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-sans focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
            <button
              id="qa_submit_btn"
              type="submit"
              className="bg-slate-900 hover:bg-slate-800 text-white p-2.5 rounded-xl shadow-sm transition-all flex items-center justify-center cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>

    </div>
  );
}
