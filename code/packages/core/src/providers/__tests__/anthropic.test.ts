import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Message, ProviderStreamEvent } from '../../types.js';

// Mock the Anthropic SDK
const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class Anthropic {
      messages = { create: mockCreate };
      constructor() {}
    },
  };
});

// Import after mock
import { AnthropicAdapter, toAnthropicMessages, sanitizeAnthropicMessages } from '../anthropic.js';

// Helper: create an async iterable from an array of events
function asyncIter<T>(items: T[]): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        async next() {
          if (i < items.length) return { value: items[i++], done: false };
          return { value: undefined, done: true };
        },
      };
    },
  };
}

async function collectEvents(iter: AsyncIterable<ProviderStreamEvent>) {
  const events: ProviderStreamEvent[] = [];
  for await (const e of iter) events.push(e);
  return events;
}

describe('toAnthropicMessages', () => {
  it('translates text parts', () => {
    const messages: Message[] = [
      { role: 'user', content: [{ type: 'text', text: 'hello' }] },
    ];
    const result = toAnthropicMessages(messages);
    expect(result).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'hello' }] },
    ]);
  });

  it('translates tool_use parts', () => {
    const messages: Message[] = [
      { role: 'user', content: [{ type: 'text', text: 'read file' }] },
      {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'tc1', name: 'Read', input: { file_path: '/test' } },
        ],
      },
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'tc1', content: 'file content', is_error: false },
        ],
      },
    ];
    const result = toAnthropicMessages(messages);
    expect(result[1]).toEqual({
      role: 'assistant',
      content: [
        { type: 'tool_use', id: 'tc1', name: 'Read', input: { file_path: '/test' } },
      ],
    });
  });

  it('translates tool_result parts', () => {
    const messages: Message[] = [
      { role: 'user', content: [{ type: 'text', text: 'go' }] },
      {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'tc1', name: 'Read', input: {} },
        ],
      },
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'tc1', content: 'file content', is_error: false },
        ],
      },
    ];
    const result = toAnthropicMessages(messages);
    expect(result[2]).toEqual({
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: 'tc1', content: 'file content', is_error: false },
      ],
    });
  });

  it('handles mixed content parts in a single message', () => {
    const messages: Message[] = [
      { role: 'user', content: [{ type: 'text', text: 'go' }] },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Let me read that file' },
          { type: 'tool_use', id: 'tc1', name: 'Read', input: { path: '/a' } },
        ],
      },
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'tc1', content: 'ok', is_error: false },
        ],
      },
    ];
    const result = toAnthropicMessages(messages);
    expect(result[1].content).toHaveLength(2);
    expect(result[1].content[0]).toEqual({ type: 'text', text: 'Let me read that file' });
    expect(result[1].content[1]).toEqual({ type: 'tool_use', id: 'tc1', name: 'Read', input: { path: '/a' } });
  });

  it('merges consecutive messages of the same role', () => {
    const messages: Message[] = [
      { role: 'user', content: [{ type: 'text', text: 'hi' }] },
      { role: 'user', content: [{ type: 'text', text: 'there' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'hello' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'world' }] },
    ];
    const result = toAnthropicMessages(messages);
    // 3 messages: merged user, merged assistant, trailing user placeholder from sanitize
    expect(result).toHaveLength(3);
    expect(result[0].role).toBe('user');
    expect(result[0].content).toHaveLength(2);
    expect(result[1].role).toBe('assistant');
    expect(result[1].content).toHaveLength(2);
    expect(result[2].role).toBe('user');
  });
});

describe('sanitizeAnthropicMessages', () => {
  it('removes orphaned tool_results with no matching tool_use in previous assistant', () => {
    const messages = [
      { role: 'user' as const, content: [{ type: 'text' as const, text: 'hello' }] },
      { role: 'assistant' as const, content: [{ type: 'text' as const, text: 'hi' }] },
      {
        role: 'user' as const,
        content: [
          { type: 'tool_result' as const, tool_use_id: 'orphan-id', content: 'result', is_error: false },
          { type: 'text' as const, text: 'continue' },
        ],
      },
    ];

    const sanitized = sanitizeAnthropicMessages(messages);
    // The orphaned tool_result should be removed
    expect(sanitized[2].content).toEqual([{ type: 'text', text: 'continue' }]);
  });

  it('keeps valid tool_results that match tool_use in previous assistant', () => {
    const messages = [
      { role: 'user' as const, content: [{ type: 'text' as const, text: 'go' }] },
      {
        role: 'assistant' as const,
        content: [{ type: 'tool_use' as const, id: 'tc1', name: 'Read', input: {} }],
      },
      {
        role: 'user' as const,
        content: [{ type: 'tool_result' as const, tool_use_id: 'tc1', content: 'ok', is_error: false }],
      },
    ];

    const sanitized = sanitizeAnthropicMessages(messages);
    expect(sanitized[2].content).toEqual([
      { type: 'tool_result', tool_use_id: 'tc1', content: 'ok', is_error: false },
    ]);
  });

  it('inserts placeholder tool_results for tool_uses with no matching result', () => {
    const messages = [
      { role: 'user' as const, content: [{ type: 'text' as const, text: 'go' }] },
      {
        role: 'assistant' as const,
        content: [
          { type: 'tool_use' as const, id: 'tc1', name: 'Read', input: {} },
          { type: 'tool_use' as const, id: 'tc2', name: 'Write', input: {} },
        ],
      },
      {
        role: 'user' as const,
        content: [{ type: 'text' as const, text: 'continue' }],
      },
    ];

    const sanitized = sanitizeAnthropicMessages(messages);
    // The user message should now have placeholder tool_results prepended
    const userContent = sanitized[2].content;
    expect(userContent).toHaveLength(3); // 2 placeholders + 1 text
    expect(userContent[0]).toEqual({
      type: 'tool_result',
      tool_use_id: 'tc1',
      content: 'Error: tool execution was interrupted',
      is_error: true,
    });
    expect(userContent[1]).toEqual({
      type: 'tool_result',
      tool_use_id: 'tc2',
      content: 'Error: tool execution was interrupted',
      is_error: true,
    });
    expect(userContent[2]).toEqual({ type: 'text', text: 'continue' });
  });

  it('inserts a user message with tool_results when assistant tool_use has no following user', () => {
    const messages = [
      { role: 'user' as const, content: [{ type: 'text' as const, text: 'go' }] },
      {
        role: 'assistant' as const,
        content: [{ type: 'tool_use' as const, id: 'tc1', name: 'Bash', input: {} }],
      },
    ];

    const sanitized = sanitizeAnthropicMessages(messages);
    // Should insert a user message with placeholder tool_result, then end with user
    expect(sanitized).toHaveLength(3);
    expect(sanitized[2].role).toBe('user');
    expect(sanitized[2].content[0]).toEqual({
      type: 'tool_result',
      tool_use_id: 'tc1',
      content: 'Error: tool execution was interrupted',
      is_error: true,
    });
  });

  it('ensures conversation ends with a user message', () => {
    const messages = [
      { role: 'user' as const, content: [{ type: 'text' as const, text: 'hi' }] },
      { role: 'assistant' as const, content: [{ type: 'text' as const, text: 'hello' }] },
    ];

    const sanitized = sanitizeAnthropicMessages(messages);
    expect(sanitized[sanitized.length - 1].role).toBe('user');
    expect(sanitized[sanitized.length - 1].content).toEqual([{ type: 'text', text: '(continued)' }]);
  });

  it('adds placeholder text when all user content is filtered out', () => {
    const messages = [
      { role: 'user' as const, content: [{ type: 'text' as const, text: 'go' }] },
      { role: 'assistant' as const, content: [{ type: 'text' as const, text: 'ok' }] },
      {
        role: 'user' as const,
        content: [
          { type: 'tool_result' as const, tool_use_id: 'orphan', content: 'data', is_error: false },
        ],
      },
    ];

    const sanitized = sanitizeAnthropicMessages(messages);
    // The orphan is removed; placeholder text should be added
    expect(sanitized[2].content).toEqual([{ type: 'text', text: '(continued)' }]);
  });

  it('does not modify already-valid messages', () => {
    const messages = [
      { role: 'user' as const, content: [{ type: 'text' as const, text: 'read file' }] },
      {
        role: 'assistant' as const,
        content: [{ type: 'tool_use' as const, id: 'tc1', name: 'Read', input: { path: '/a' } }],
      },
      {
        role: 'user' as const,
        content: [{ type: 'tool_result' as const, tool_use_id: 'tc1', content: 'file data', is_error: false }],
      },
      {
        role: 'assistant' as const,
        content: [{ type: 'text' as const, text: 'here it is' }],
      },
      { role: 'user' as const, content: [{ type: 'text' as const, text: 'thanks' }] },
    ];

    const sanitized = sanitizeAnthropicMessages(messages);
    expect(sanitized).toHaveLength(5);
    expect(sanitized[2].content).toEqual([
      { type: 'tool_result', tool_use_id: 'tc1', content: 'file data', is_error: false },
    ]);
  });
});

describe('AnthropicAdapter', () => {
  let adapter: AnthropicAdapter;

  beforeEach(() => {
    mockCreate.mockReset();
    adapter = new AnthropicAdapter({ apiKey: 'test-key' });
  });

  it('maps text_delta events', async () => {
    mockCreate.mockResolvedValue(
      asyncIter([
        { type: 'message_start', message: { usage: { input_tokens: 100, output_tokens: 0 } } },
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'hello' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ' world' } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 10 } },
      ]),
    );

    const events = await collectEvents(
      adapter.streamMessage({
        model: 'claude-opus-4-6',
        system: 'you are helpful',
        messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
        tools: [],
        maxTokens: 1024,
      }),
    );

    expect(events).toEqual([
      { type: 'text_delta', text: 'hello' },
      { type: 'text_delta', text: ' world' },
      { type: 'message_end', stop_reason: 'end_turn', usage: { input: 100, output: 10 } },
    ]);
  });

  it('maps tool_use events', async () => {
    mockCreate.mockResolvedValue(
      asyncIter([
        { type: 'message_start', message: { usage: { input_tokens: 50, output_tokens: 0 } } },
        {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'tool_use', id: 'tc1', name: 'Read' },
        },
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'input_json_delta', partial_json: '{"file' },
        },
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'input_json_delta', partial_json: '":"a.ts"}' },
        },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 20 } },
      ]),
    );

    const events = await collectEvents(
      adapter.streamMessage({
        model: 'claude-opus-4-6',
        system: '',
        messages: [{ role: 'user', content: [{ type: 'text', text: 'read a.ts' }] }],
        tools: [{ name: 'Read', description: 'read', inputSchema: { type: 'object' } }],
        maxTokens: 1024,
      }),
    );

    expect(events).toEqual([
      { type: 'tool_call_start', id: 'tc1', name: 'Read' },
      { type: 'tool_call_delta', id: 'tc1', input: '{"file' },
      { type: 'tool_call_delta', id: 'tc1', input: '":"a.ts"}' },
      { type: 'tool_call_end', id: 'tc1' },
      { type: 'message_end', stop_reason: 'tool_use', usage: { input: 50, output: 20 } },
    ]);
  });

  it('handles mixed text and tool blocks', async () => {
    mockCreate.mockResolvedValue(
      asyncIter([
        { type: 'message_start', message: { usage: { input_tokens: 10, output_tokens: 0 } } },
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'reading...' } },
        { type: 'content_block_stop', index: 0 },
        { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'tc2', name: 'Bash' } },
        { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{}' } },
        { type: 'content_block_stop', index: 1 },
        { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 5 } },
      ]),
    );

    const events = await collectEvents(
      adapter.streamMessage({
        model: 'test',
        system: '',
        messages: [{ role: 'user', content: [{ type: 'text', text: 'go' }] }],
        tools: [{ name: 'Bash', description: 'bash', inputSchema: { type: 'object' } }],
        maxTokens: 1024,
      }),
    );

    const types = events.map((e) => e.type);
    expect(types).toEqual([
      'text_delta',
      'tool_call_start',
      'tool_call_delta',
      'tool_call_end',
      'message_end',
    ]);
  });

  it('catches API errors and yields message_end with stop_reason error', async () => {
    mockCreate.mockRejectedValue(new Error('rate limited'));

    const events = await collectEvents(
      adapter.streamMessage({
        model: 'test',
        system: '',
        messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
        tools: [],
        maxTokens: 1024,
      }),
    );

    expect(events).toEqual([
      { type: 'message_end', stop_reason: 'error', usage: { input: 0, output: 0 }, error: 'rate limited' },
    ]);
  });

  it('catches stream iteration errors and yields message_end', async () => {
    const failingIter = {
      [Symbol.asyncIterator]() {
        return {
          async next() {
            throw new Error('stream broke');
          },
        };
      },
    };
    mockCreate.mockResolvedValue(failingIter);

    const events = await collectEvents(
      adapter.streamMessage({
        model: 'test',
        system: '',
        messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
        tools: [],
        maxTokens: 1024,
      }),
    );

    expect(events).toEqual([
      { type: 'message_end', stop_reason: 'error', usage: { input: 0, output: 0 }, error: 'stream broke' },
    ]);
  });
});
