// WebSocket message types for voice agent
export enum VoiceMessageType {
  // Client → Server
  AUDIO_CHUNK = "audio_chunk",
  START_SESSION = "start_session",
  END_SESSION = "end_session",
  CANCEL_STREAMING = "cancel_streaming",
  
  // Server → Client
  TRANSCRIPT = "transcript",
  AGENT_TEXT = "agent_text",
  AGENT_AUDIO = "agent_audio",
  TOOL_CALL = "tool_call",
  CONFIDENCE_UPDATE = "confidence_update",
  RAG_CONTEXT = "rag_context",
  ERROR = "error",
  SESSION_STARTED = "session_started",
}

export interface VoiceMessage {
  type: VoiceMessageType;
  data: any;
  timestamp?: number;
}

// Client → Server messages
export interface AudioChunkMessage extends VoiceMessage {
  type: VoiceMessageType.AUDIO_CHUNK;
  data: {
    audio: string; // base64 encoded audio chunk
    format: "webm" | "mp3" | "wav" | "mp4";
    turnId?: string;
    chunkIndex?: number;
    isLast?: boolean;
    chunkCount?: number;
  };
}

export interface StartSessionMessage extends VoiceMessage {
  type: VoiceMessageType.START_SESSION;
  data: {
    userId?: string;
    language?: string;
  };
}

// Server → Client messages
export type TranscriptResponseFormat = "text" | "json" | "verbose_json" | "diarized_json";

export interface TranscriptWordTiming {
  word?: string;
  start?: number;
  end?: number;
  confidence?: number;
  [key: string]: any;
}

export interface TranscriptSegment {
  id?: string;
  type?: string;
  start?: number;
  end?: number;
  text?: string;
  speaker?: string;
  [key: string]: any;
}

export interface TranscriptMetadata {
  format: TranscriptResponseFormat;
  durationSeconds?: number;
  language?: string;
  segments?: TranscriptSegment[];
  words?: TranscriptWordTiming[];
  diarizedSegments?: TranscriptSegment[];
  raw?: Record<string, any>;
}

export interface TranscriptMessage extends VoiceMessage {
  type: VoiceMessageType.TRANSCRIPT;
  data: {
    text: string;
    isFinal: boolean;
    metadata?: TranscriptMetadata;
  };
}

export interface AgentTextMessage extends VoiceMessage {
  type: VoiceMessageType.AGENT_TEXT;
  data: {
    text: string;
    isComplete: boolean;
    isSentence?: boolean; // true = complete sentence, false = word chunk for streaming
  };
}

export interface AgentAudioMessage extends VoiceMessage {
  type: VoiceMessageType.AGENT_AUDIO;
  data: {
    audio: string; // base64 encoded audio
    format: "mp3";
  };
}

export interface ToolCallMessage extends VoiceMessage {
  type: VoiceMessageType.TOOL_CALL;
  data: {
    name: string;
    arguments: Record<string, any>;
    result?: any;
  };
}

export interface RagReference {
  id: string;
  source: string;
  text: string;
  score: number;
  speaker?: string;
  metadata?: Record<string, any> | null;
}

export interface RagContextMessage extends VoiceMessage {
  type: VoiceMessageType.RAG_CONTEXT;
  data: {
    references: RagReference[];
  };
}

export interface CoachUpdateData {
  confidence: number;
  speechNotes?: string | null;
  fillerRate?: number | null;
  source?: "coach" | "stt";
}

export interface ConfidenceUpdateMessage extends VoiceMessage {
  type: VoiceMessageType.CONFIDENCE_UPDATE;
  data: CoachUpdateData;
}

export interface ErrorMessage extends VoiceMessage {
  type: VoiceMessageType.ERROR;
  data: {
    message: string;
    code?: string;
  };
}
