import React, { useState } from "react";
import { BarChart3, Plus, Trash2, CheckCircle2, Lock } from "lucide-react";

interface PollsManagerProps {
  ws: WebSocket | null;
  role: "EDUCATOR" | "STUDENT";
  userId: string;
  polls: any[];
}

export default function PollsManager({ ws, role, userId, polls }: PollsManagerProps) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleAddOption = () => {
    if (options.length < 5) {
      setOptions([...options, ""]);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index: number, val: string) => {
    const updated = [...options];
    updated[index] = val;
    setOptions(updated);
  };

  const handleLaunchPoll = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || options.some(o => !o.trim()) || !ws) return;

    ws.send(JSON.stringify({
      type: "poll-create",
      question,
      options: options.filter(o => o.trim() !== ""),
      isAnonymous,
    }));

    // Reset Form
    setQuestion("");
    setOptions(["", ""]);
    setIsAnonymous(false);
    setIsCreating(false);
  };

  const handleVote = (pollId: string, optionId: string) => {
    if (!ws) return;
    ws.send(JSON.stringify({
      type: "poll-vote",
      pollId,
      optionId,
    }));
  };

  const handleClosePoll = (pollId: string) => {
    if (!ws || role !== "EDUCATOR") return;
    ws.send(JSON.stringify({
      type: "poll-close",
      pollId,
    }));
  };

  return (
    <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden p-5 space-y-4">
      
      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
        <h3 className="text-sm font-sans font-medium text-slate-800 flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4 text-slate-500" />
          Polls & Quizzes ({polls.length})
        </h3>
        {role === "EDUCATOR" && !isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="text-xs bg-slate-900 hover:bg-slate-800 text-white px-2.5 py-1.5 rounded-xl transition-all font-sans font-medium flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Poll
          </button>
        )}
      </div>

      {/* Create Poll Sheet (Educator only) */}
      {isCreating && role === "EDUCATOR" && (
        <form onSubmit={handleLaunchPoll} className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3.5">
          <div className="space-y-1">
            <label className="text-[11px] font-sans font-medium text-slate-600">Question</label>
            <input
              type="text"
              placeholder="e.g. Which keyword is used to declare an interface?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-sans focus:outline-none focus:ring-1 focus:ring-slate-900"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-sans font-medium text-slate-600 flex justify-between">
              <span>Options (Min 2, Max 5)</span>
              {options.length < 5 && (
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="text-[10px] text-emerald-600 font-sans hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Add Option
                </button>
              )}
            </label>

            {options.map((opt, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder={`Option ${idx + 1}`}
                  value={opt}
                  onChange={(e) => handleOptionChange(idx, e.target.value)}
                  className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-sans focus:outline-none focus:ring-1 focus:ring-slate-900"
                  required
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(idx)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-2">
            <label className="flex items-center gap-1.5 text-[11px] font-sans text-slate-600 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              Anonymous responses
            </label>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-xs bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-xl hover:bg-slate-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl shadow-sm transition-all font-medium cursor-pointer"
              >
                Launch Poll
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Active Polls List */}
      <div className="space-y-4">
        {polls.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs font-sans italic border border-dashed border-slate-200 rounded-xl">
            No polls launched yet.
          </div>
        ) : (
          [...polls].reverse().map((poll) => {
            const hasVoted = poll.votedUserIds.includes(userId);
            const total = poll.totalVotes || 0;

            return (
              <div
                key={poll.id}
                className={`border border-slate-150 p-4 rounded-2xl space-y-3.5 transition-all ${
                  poll.isOpen ? "bg-white shadow-sm" : "bg-slate-50 opacity-80"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${poll.isOpen ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`}></span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {poll.isOpen ? "Active Poll" : "Closed"} • {poll.isAnonymous ? "Anonymous" : "Standard"}
                      </span>
                    </div>
                    <h4 className="text-xs font-sans font-medium text-slate-800 leading-normal">{poll.question}</h4>
                  </div>

                  {role === "EDUCATOR" && poll.isOpen && (
                    <button
                      onClick={() => handleClosePoll(poll.id)}
                      className="text-[10px] bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1 rounded-lg border border-red-200 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Lock className="w-3 h-3" />
                      Close Poll
                    </button>
                  )}
                </div>

                {/* Display Voting Options or Results */}
                <div className="space-y-2.5">
                  {poll.isOpen && !hasVoted && role === "STUDENT" ? (
                    /* Student Vote Form */
                    poll.options.map((opt: any) => (
                      <button
                        key={opt.id}
                        onClick={() => handleVote(poll.id, opt.id)}
                        className="w-full text-left px-3.5 py-2.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-xl text-xs font-sans transition-all cursor-pointer flex items-center justify-between"
                      >
                        <span>{opt.text}</span>
                        <span className="w-4 h-4 rounded-full border border-slate-300"></span>
                      </button>
                    ))
                  ) : (
                    /* Display Results with Pretty Bar Graph */
                    poll.options.map((opt: any) => {
                      const percent = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
                      return (
                        <div key={opt.id} className="space-y-1">
                          <div className="flex justify-between text-xs font-sans text-slate-700">
                            <span className="font-medium flex items-center gap-1.5">
                              {opt.text}
                              {hasVoted && poll.votedUserIds.includes(userId) && (
                                <span className="text-[9px] text-emerald-600 font-mono bg-emerald-50 px-1 py-0.2 rounded-full">Voted</span>
                              )}
                            </span>
                            <span className="font-mono text-[11px] text-slate-500">
                              {opt.votes} votes ({percent}%)
                            </span>
                          </div>

                          {/* Horizontal Percentage Progress Bar */}
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-150">
                            <div
                              className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
                              style={{ width: `${percent}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="flex justify-between text-[10px] text-slate-400 font-mono border-t border-slate-100 pt-2">
                  <span>Total Responses: {total}</span>
                  {hasVoted && <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-600" /> Response recorded</span>}
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
