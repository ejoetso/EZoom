import React from "react";
import { Users, UserX, VolumeX, Mic, MicOff, Check, X, Shield, Hand, Mail, ShieldCheck } from "lucide-react";
import { UserRole } from "../types";

interface WaitingRoomAndParticipantsProps {
  ws: WebSocket | null;
  role: "EDUCATOR" | "STUDENT";
  participants: any[];
  waitingRoom: any[];
}

export default function WaitingRoomAndParticipants({ ws, role, participants, waitingRoom }: WaitingRoomAndParticipantsProps) {
  
  const handleWaitingAction = (studentId: string, action: "admit" | "reject") => {
    if (!ws || role !== "EDUCATOR") return;
    ws.send(JSON.stringify({
      type: "waiting-room-action",
      studentId,
      action
    }));
  };

  const handleModeration = (targetId: string, action: "mute" | "kick") => {
    if (!ws || role !== "EDUCATOR") return;
    ws.send(JSON.stringify({
      type: "participant-action",
      targetId,
      action
    }));
  };

  return (
    <div className="space-y-6">
      
      {/* Waiting Room Section (Only visible to Educator when there are entries) */}
      {role === "EDUCATOR" && waitingRoom.length > 0 && (
        <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-5 space-y-3.5 animate-pulse-subtle">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-sans font-medium text-amber-900 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-amber-700" />
              Waiting Room Approvals ({waitingRoom.length})
            </h3>
            <span className="bg-amber-100 text-amber-800 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">Action Required</span>
          </div>

          <div className="divide-y divide-amber-200/50 max-h-48 overflow-y-auto pr-1">
            {waitingRoom.map((w) => (
              <div key={w.id} className="flex justify-between items-center py-2.5">
                <div className="space-y-0.5">
                  <span className="text-xs font-sans font-semibold text-amber-950 block">{w.name}</span>
                  {w.email && (
                    <span className="text-[10px] text-amber-900/80 font-mono flex items-center gap-1">
                      <Mail className="w-3 h-3 text-emerald-600" />
                      {w.email}
                      <ShieldCheck className="w-3 h-3 text-emerald-600" title="Security Verified" />
                    </span>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleWaitingAction(w.id, "admit")}
                    className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all shadow-sm cursor-pointer"
                    title="Admit Student"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleWaitingAction(w.id, "reject")}
                    className="p-1.5 bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 rounded-lg transition-all cursor-pointer"
                    title="Deny Access"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Classroom Participants list */}
      <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden p-5 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-sans font-medium text-slate-800 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-slate-500" />
            Classroom Roster ({participants.length + (role === "EDUCATOR" ? 1 : 0)})
          </h3>
          <span className="bg-slate-100 text-slate-600 text-[10px] font-mono px-2 py-0.5 rounded-full font-medium">Live</span>
        </div>

        {/* Simulated Audience Generation button (Educator-Only) */}
        {role === "EDUCATOR" && !participants.some(p => p.id.startsWith("sim_")) && (
          <button
            onClick={() => {
              if (ws) {
                ws.send(JSON.stringify({ type: "simulate-audience" }));
              }
            }}
            className="w-full bg-emerald-50 border border-emerald-200 hover:bg-emerald-100/50 text-emerald-800 font-sans font-semibold text-xs py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs animate-pulse-subtle"
          >
            <Users className="w-4 h-4 text-emerald-600" />
            Populate Simulated Class (20 Students)
          </button>
        )}

        {role === "EDUCATOR" && (
          <p className="text-[10px] text-slate-400 font-sans leading-relaxed border-b border-slate-100 pb-3">
            <strong>Testing Tip:</strong> Standard browsers restrict concurrent connections to a single domain name to 6-7. To connect more than 7 *real* tabs/students on one machine, use incognito mode, distinct browser profiles, or separate external devices (phones/laptops).
          </p>
        )}

        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {/* Always display the Educator at the top */}
          <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-900 fill-slate-100" />
              <div className="space-y-0.5">
                <span className="text-xs font-sans font-medium text-slate-900">Professor (Educator)</span>
                <p className="text-[9px] text-slate-400 font-mono">Session Host</p>
              </div>
            </div>
            <span className="bg-slate-900 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">Host</span>
          </div>

          {/* Student Roster */}
          {participants.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs font-sans italic border border-dashed border-slate-200 rounded-xl">
              No students active in the classroom.
            </div>
          ) : (
            participants.map((p) => (
              <div
                key={p.id}
                className={`flex justify-between items-center p-2.5 rounded-xl border transition-all ${
                  p.handRaised ? "bg-amber-50/50 border-amber-100" : "bg-white border-slate-100"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm relative">
                    <span className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-60"></span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-xs font-sans font-medium text-slate-800 flex items-center gap-1">
                      {p.name}
                      {p.email && <ShieldCheck className="w-3 h-3 text-emerald-600 inline" title="Verified School Email" />}
                    </span>
                    <p className="text-[9px] text-slate-400 font-mono">
                      {p.email ? p.email : `Student ID: ${p.id}`}
                    </p>
                  </div>
                </div>

                {/* Hand raise & Moderation controls */}
                <div className="flex items-center gap-2">
                  {/* Raised hand indicator */}
                  {p.handRaised && (
                    <span className="bg-amber-100 text-amber-800 p-1 rounded-lg animate-bounce duration-1000">
                      <Hand className="w-3.5 h-3.5 fill-amber-300 text-amber-700" />
                    </span>
                  )}

                  {/* Educator Admin Actions */}
                  {role === "EDUCATOR" && (
                    <div className="flex gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleModeration(p.id, "mute")}
                        className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                          p.isMuted
                            ? "bg-red-50 border-red-200 text-red-600"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                        title={p.isMuted ? "Unmute Student" : "Mute Student"}
                      >
                        {p.isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleModeration(p.id, "kick")}
                        className="p-1.5 bg-white border border-slate-200 text-red-500 hover:bg-red-50 hover:border-red-100 rounded-lg transition-all cursor-pointer"
                        title="Remove Student"
                      >
                        <UserX className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
