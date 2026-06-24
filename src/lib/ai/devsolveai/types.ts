export interface DevSolveAiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface DevSolveAiContext {
  toolSlug?: string;
  toolName?: string;
  input?: string;
  output?: string;
  error?: string | null;
}

export interface DevSolveAiResponse {
  content: string;
  suggestions?: string[];
  relatedTools?: Array<{ slug: string; name: string; reason: string }>;
}

export interface DevSolveAiIntent {
  type:
    | 'greeting'
    | 'tool_help'
    | 'json_error'
    | 'regex_help'
    | 'jwt_help'
    | 'encoding_help'
    | 'diff_help'
    | 'recommend_tool'
    | 'privacy'
    | 'unknown';
  confidence: number;
}
