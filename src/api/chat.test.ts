import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from './config';
import {
  deleteChatConversation,
  fetchChatConversations,
  fetchChatMessages,
  sendChatMessage,
} from './chat';

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });

describe('chat api', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('fetchChatConversations uses the configured API base URL', async () => {
    const mockFetch = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValue(jsonResponse([]));

    await fetchChatConversations();

    expect(mockFetch).toHaveBeenCalledWith(`${API_BASE_URL}/chat/conversations`);
  });

  it('fetchChatMessages encodes the conversation id in the URL', async () => {
    const mockFetch = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValue(jsonResponse([]));

    await fetchChatMessages('abc/123');

    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/chat/conversations/abc%2F123/messages`,
    );
  });

  it('sendChatMessage posts JSON to the API base URL', async () => {
    const mockFetch = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValue(jsonResponse({ ai_responses: [] }));

    await sendChatMessage({ message: 'Hello', thread_id: 'thread-1' });

    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/chat/message`,
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: 'Hello', thread_id: 'thread-1' }),
      }),
    );
  });

  it('deleteChatConversation issues a DELETE request', async () => {
    const mockFetch = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValue(new Response(null, { status: 204 }));

    await deleteChatConversation('thread-1');

    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/chat/conversations/thread-1`,
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
