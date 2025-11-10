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
    format: "webm" | "mp3" | "wav";
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
export interface TranscriptMessage extends VoiceMessage {
  type: VoiceMessageType.TRANSCRIPT;
  data: {
    text: string;
    isFinal: boolean;
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

export interface ErrorMessage extends VoiceMessage {
  type: VoiceMessageType.ERROR;
  data: {
    message: string;
    code?: string;
  };
}
