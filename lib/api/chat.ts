export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  metadata?: {
    technique: string;
    goal: string;
    progress: any[];
    analysis?: {
      emotionalState: string;
      themes: string[];
      riskLevel: number;
      recommendedApproach: string;
      progressIndicators: string[];
    };
  };
}

export interface ChatSession {
  sessionId: string;
  _id?: string;
  title?: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiResponse {
  message: string;
  response?: string;
  analysis?: {
    emotionalState: string;
    themes: string[];
    riskLevel: number;
    recommendedApproach: string;
    progressIndicators: string[];
  };
  metadata?: {
    technique: string;
    goal: string;
    progress: any[];
  };
}

const API_BASE = "/api";

// Helper function to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };
};

// Highly robust date parsing helper
const parseDate = (dateVal: any): Date => {
  if (!dateVal) return new Date();
  
  // Handle Unix timestamps (seconds vs milliseconds)
  if (typeof dateVal === "number") {
    // If it's a small number, it's likely seconds (heuristic: less than year 3000 in seconds)
    if (dateVal < 4000000000) {
      return new Date(dateVal * 1000);
    }
    return new Date(dateVal);
  }

  const parsed = new Date(dateVal);
  if (!isNaN(parsed.getTime())) return parsed;
  
  // Try to parse if it's a string number
  if (typeof dateVal === "string" && /^\d+$/.test(dateVal)) {
    const num = parseInt(dateVal, 10);
    if (num < 4000000000) return new Date(num * 1000);
    return new Date(num);
  }

  return new Date();
};

export const createChatSession = async (): Promise<string> => {
  try {
    console.log("Creating new chat session...");
    const response = await fetch(`${API_BASE}/chat/sessions`, {
      method: "POST",
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Failed to create chat session:", error);
      throw new Error(error.error || "Failed to create chat session");
    }

    const data = await response.json();
    console.log("Chat session created:", data);
    return data.sessionId;
  } catch (error) {
    console.error("Error creating chat session:", error);
    throw error;
  }
};

export const sendChatMessage = async (
  sessionId: string,
  message: string
): Promise<ApiResponse> => {
  try {
    console.log(`Sending message to session ${sessionId}:`, message);
    const response = await fetch(
      `${API_BASE}/chat/sessions/${sessionId}/messages`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ message }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error("Failed to send message:", error);
      throw new Error(error.error || "Failed to send message");
    }

    const data = await response.json();
    console.log("Message sent successfully:", data);
    return data;
  } catch (error) {
    console.error("Error sending chat message:", error);
    throw error;
  }
};

export const getChatHistory = async (
  sessionId: string
): Promise<ChatMessage[]> => {
  try {
    console.log(`Fetching chat history for session ${sessionId}`);
    const response = await fetch(
      `${API_BASE}/chat/sessions/${sessionId}/history`,
      {
        headers: getAuthHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error("Failed to fetch chat history:", error);
      throw new Error(error.error || "Failed to fetch chat history");
    }

    let data = await response.json();
    console.log("Received chat history data structure:", data);

    // Aggressive extraction of messages from various nested structures
    if (data && !Array.isArray(data)) {
      if (Array.isArray(data.messages)) data = data.messages;
      else if (Array.isArray(data.history)) data = data.history;
      else if (Array.isArray(data.chatMessages)) data = data.chatMessages;
      else if (Array.isArray(data.convo)) data = data.convo;
      else if (Array.isArray(data.chat_history)) data = data.chat_history;
      else if (Array.isArray(data.chat)) data = data.chat;
      else if (Array.isArray(data.data)) data = data.data;
      else {
        // Find the first property that is an array
        const firstArrayKey = Object.keys(data).find(key => Array.isArray((data as any)[key]));
        if (firstArrayKey) data = (data as any)[firstArrayKey];
      }
    }
    
    if (!Array.isArray(data)) {
      console.error("Invalid chat history format:", data);
      return [];
    }

    // Ensure each message has the correct format
    return data.map((msg: any) => ({
      role: msg.role,
      content: msg.content,
      timestamp: parseDate(msg.timestamp || msg.created_at || msg.time),
      metadata: msg.metadata,
    }));
  } catch (error) {
    console.error("Error fetching chat history:", error);
    throw error;
  }
};

export const getAllChatSessions = async (): Promise<ChatSession[]> => {
  try {
    console.log("Fetching all chat sessions...");
    const response = await fetch(`${API_BASE}/chat/sessions`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Failed to fetch chat sessions:", error);
      throw new Error(error.error || "Failed to fetch chat sessions");
    }

    let data = await response.json();
    console.log("Received chat sessions data structure:", data);

    // Aggressive extraction of sessions list from various nested structures
    if (data && !Array.isArray(data)) {
      if (Array.isArray(data.sessions)) data = data.sessions;
      else if (Array.isArray(data.data)) data = data.data;
      else if (Array.isArray(data.chatSessions)) data = data.chatSessions;
      else if (Array.isArray(data.chat_sessions)) data = data.chat_sessions;
      else if (Array.isArray(data.results)) data = data.results;
      else if (Array.isArray(data.conversations)) data = data.conversations;
      else if (Array.isArray(data.threads)) data = data.threads;
      else {
        // Find the first property that is an array
        const firstArrayKey = Object.keys(data).find(key => Array.isArray((data as any)[key]));
        if (firstArrayKey) data = (data as any)[firstArrayKey];
      }
    }
    
    if (!Array.isArray(data)) {
      console.error("Invalid chat sessions format:", data);
      return [];
    }

    return data.map((session: any) => {
      // 1. Find the best nested object
      const s = (session.session && typeof session.session === "object") ? session.session : session;
      
      // 2. Identify all arrays in the object to find potential messages
      const allArrays = Object.values(s).filter(v => Array.isArray(v));
      const potentialMessages = allArrays.find(arr => 
        arr.length > 0 && typeof arr[0] === "object" && 
        (arr[0].content || arr[0].text || arr[0].message || arr[0].body)
      );

      const messages = potentialMessages || (s.messages || s.history || s.chatMessages || 
                        s.convo || s.chat_history || s.chat || s.data?.messages || []);
      
      // 3. Summary and Topics are key fields from the smart contract/backend structure
      const topics = Array.isArray(s.topics) ? s.topics.join(", ") : "";
      const summary = s.summary || s.description || s.contentPreview || "";

      // 4. Robust title search - prioritize specific titles, then summary, then topics
      const titleKeys = ["title", "name", "subject", "chatName", "sessionTitle", "convo_title", "chat_title", "chat_name", "label", "display_name"];
      let rawTitle = "";
      for (const key of titleKeys) {
        if (s[key] && typeof s[key] === "string" && s[key].length > 1) {
          rawTitle = s[key];
          break;
        }
      }
      
      // If the found title is generic, try to use summary or topics
      const genericPlaceholders = ["new session", "new chat", "new therapy session", "untitled", "chat session", "therapy session", "session", "default"];
      if (!rawTitle || genericPlaceholders.includes(rawTitle.toLowerCase())) {
        if (summary && summary.length > 1) rawTitle = summary;
        else if (topics && topics.length > 1) rawTitle = topics;
      }

      // If we still don't have a title, search all keys containing 'topic' or 'summary'
      if (!rawTitle) {
        const anyTitleKey = Object.keys(s).find(k => 
          (k.toLowerCase().includes("summary") || k.toLowerCase().includes("topic") || k.toLowerCase().includes("header")) && 
          typeof (s as any)[k] === "string" && (s as any)[k].length > 1
        );
        if (anyTitleKey) rawTitle = (s as any)[anyTitleKey];
      }

      // 5. Message preview for fallback title and sidebar subtitle
      const latestMsg = messages.length > 0 ? messages[messages.length - 1] : null;
      const firstMsg = messages.length > 0 ? messages[0] : null;
      
      const lastMsgContent = latestMsg?.content || latestMsg?.text || latestMsg?.message || latestMsg?.body || 
                             s.lastMessagePreview || s.preview || s.lastMessage || s.last_message || s.last_msg || summary || "";
      
      const firstMsgContent = firstMsg?.content || firstMsg?.text || firstMsg?.message || firstMsg?.body || summary || "";
      
      const fallbackTitle = (firstMsgContent && typeof firstMsgContent === "string") ? 
                            (firstMsgContent.slice(0, 30) + (firstMsgContent.length > 30 ? "..." : "")) : "Untitled Chat";

      // Final title decision
      let title = rawTitle || fallbackTitle;
      if (title && typeof title === "string" && genericPlaceholders.includes(title.toLowerCase()) && firstMsgContent) {
        title = fallbackTitle;
      }

      // 6. Aggressive date searching
      const dateKeys = ["updatedAt", "updated_at", "lastUpdated", "last_updated", "updated", 
                        "createdAt", "created_at", "timestamp", "date", "time", "updated_date", 
                        "last_interaction", "created_date", "modified_at"];
      let dateRaw = null;
      for (const key of dateKeys) {
        if (s[key]) {
          dateRaw = s[key];
          break;
        }
      }

      if (!dateRaw) {
        const anyDateKey = Object.keys(s).find(k => (k.toLowerCase().includes("date") || k.toLowerCase().includes("time") || k.endsWith("_at")) && s[k]);
        if (anyDateKey) dateRaw = s[anyDateKey];
      }
      
      if (!dateRaw && latestMsg) {
        dateRaw = latestMsg.timestamp || latestMsg.created_at || latestMsg.time || latestMsg.date;
      }

      const updatedAt = parseDate(dateRaw);
      const createdAt = parseDate(s.createdAt || s.created_at || s.timestamp || s.date);

      return {
        ...s,
        sessionId: s.sessionId || s.session_id || s._id || s.id || s.id_str || s.uuid || s.session_uuid || s.cid,
        title: title || "New Chat",
        summary: summary, // Preserve for UI
        createdAt,
        updatedAt,
        messages: Array.isArray(messages) ? messages.map((msg: any) => ({
          ...msg,
          content: msg.content || msg.text || msg.message || msg.body || (typeof msg === "string" ? msg : ""),
          timestamp: parseDate(msg.timestamp || msg.created_at || msg.time || msg.date),
        })) : [],
      };
    }).sort((a: any, b: any) => b.updatedAt.getTime() - a.updatedAt.getTime());
  } catch (error) {
    console.error("Error fetching chat sessions:", error);
    throw error;
  }
};
