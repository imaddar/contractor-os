import { API_BASE_URL } from './config';

export interface ChatConversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatHistoryMessage {
  message_type: string;
  content: string;
  created_at?: string;
}

export interface ChatMessageRequest {
  message: string;
  thread_id: string;
}

export interface ChatMessageResponse {
  ai_responses?: Array<{
    content: string;
    timestamp: string;
  }>;
}

const buildConversationMessagesUrl = (conversationId: string) =>
  `${API_BASE_URL}/chat/conversations/${encodeURIComponent(conversationId)}/messages`;

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
};

export const fetchChatConversations = async (): Promise<ChatConversation[]> => {
  const response = await fetch(`${API_BASE_URL}/chat/conversations`);
  await handleResponse(response);
  return response.json();
};

export const fetchChatMessages = async (
  conversationId: string,
): Promise<ChatHistoryMessage[] | null> => {
  const response = await fetch(buildConversationMessagesUrl(conversationId));
  if (response.ok) {
    return response.json();
  }
  if (response.status === 404 || response.status === 500) {
    return null;
  }
  throw new Error(`Request failed with status ${response.status}`);
};

export const sendChatMessage = async (
  payload: ChatMessageRequest,
): Promise<ChatMessageResponse> => {
  const response = await fetch(`${API_BASE_URL}/chat/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  await handleResponse(response);
  return response.json();
};

export const deleteChatConversation = async (
  conversationId: string,
): Promise<void> => {
  const response = await fetch(
    `${API_BASE_URL}/chat/conversations/${encodeURIComponent(conversationId)}`,
    {
      method: 'DELETE',
    },
  );
  await handleResponse(response);
};
