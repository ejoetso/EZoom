export enum UserRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  ORGANISATION_ADMIN = "ORGANISATION_ADMIN",
  EDUCATOR = "EDUCATOR",
  TEACHING_ASSISTANT = "TEACHING_ASSISTANT",
  STUDENT = "STUDENT",
  GUEST = "GUEST"
}

export type ScreenShareMode = "detail" | "motion" | "balanced";

export interface Participant {
  id: string;
  name: string;
  role: UserRole;
  isMuted: boolean;
  handRaised: boolean;
  status: "active" | "unstable" | "reconnecting" | "disconnected" | "waiting";
  joinedAt: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  content: string;
  timestamp: string;
  isAnnouncement: boolean;
}

export interface Question {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  upvotes: number;
  upvotedBy: string[]; // List of user IDs
  isAnswered: boolean;
  timestamp: string;
}

export interface Poll {
  id: string;
  question: string;
  options: { id: string; text: string; votes: number }[];
  isOpen: boolean;
  isAnonymous: boolean;
  totalVotes: number;
  votedUserIds: string[]; // List of user IDs who voted
}

export interface SharedResource {
  id: string;
  name: string;
  size: string;
  type: string;
  url: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface WhiteboardAction {
  type: "draw" | "clear" | "undo";
  points?: { x: number; y: number }[];
  color?: string;
  width?: number;
  isHighlighter?: boolean;
}

export interface ClassroomSession {
  id: string;
  title: string;
  courseName: string;
  joinCode: string;
  educatorId: string;
  educatorName: string;
  isLocked: boolean;
  waitingRoomEnabled: boolean;
  chatEnabled: boolean;
  recordingEnabled: boolean;
  status: "lobby" | "live" | "ended";
  startedAt?: string;
  endedAt?: string;
}
