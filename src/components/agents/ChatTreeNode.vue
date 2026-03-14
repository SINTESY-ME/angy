<template>
  <div
    class="py-1 border-l-2 pl-2"
    :style="{ borderColor: agentColor }"
  >
    <!-- User message -->
    <div v-if="message.role === 'user'" class="text-[13px] text-txt-secondary leading-relaxed">
      {{ message.content }}
    </div>

    <!-- Assistant message -->
    <template v-else-if="message.role === 'assistant'">
      <!-- Thinking blocks (parsed from content) -->
      <ThinkingBlock
        v-for="(block, i) in thinkingBlocks"
        :key="'think-' + i"
        :content="block.content"
        :elapsedMs="block.elapsedMs"
        :isStreaming="block.isStreaming"
      />

      <!-- Main content -->
      <div
        v-if="textContent"
        class="text-[13px] text-txt-primary leading-relaxed whitespace-pre-wrap"
      >{{ textContent }}</div>

      <!-- Tool calls -->
      <ToolCallGroup
        v-if="toolCalls.length > 0"
        :calls="toolCalls"
        @file-clicked="(path: string) => $emit('file-clicked', path)"
      />

      <!-- Streaming indicator -->
      <div
        v-if="isStreaming"
        class="bg-teal/5 border border-teal/10 px-2.5 py-1.5 rounded-md flex items-center gap-2 mt-1"
      >
        <WaveBar />
        <span class="text-[11px] text-teal">Generating...</span>
      </div>
    </template>

    <!-- Tool result -->
    <div v-else-if="message.role === 'tool'" class="text-[11px] text-txt-muted font-mono truncate">
      <span class="text-txt-faint">{{ message.toolName }}:</span> {{ message.content.slice(0, 200) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { MessageRecord } from '../../engine/types';
import ThinkingBlock from '../chat/ThinkingBlock.vue';
import ToolCallGroup from '../chat/ToolCallGroup.vue';
import WaveBar from '@/components/common/WaveBar.vue';
import type { ToolCallInfo } from '../chat/ToolCallGroup.vue';

const props = defineProps<{
  message: MessageRecord;
  agentColor: string;
}>();

defineEmits<{
  'file-clicked': [filePath: string];
}>();

// Parse thinking blocks from content (format: <thinking>...</thinking>)
const thinkingBlocks = computed(() => {
  if (props.message.role !== 'assistant') return [];
  const blocks: { content: string; elapsedMs?: number; isStreaming?: boolean }[] = [];
  const regex = /<thinking>([\s\S]*?)<\/thinking>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(props.message.content)) !== null) {
    blocks.push({ content: match[1].trim() });
  }
  return blocks;
});

// Text content without thinking blocks
const textContent = computed(() => {
  if (props.message.role !== 'assistant') return '';
  return props.message.content
    .replace(/<thinking>[\s\S]*?<\/thinking>/g, '')
    .trim();
});

// Parse tool calls from toolInput JSON
const toolCalls = computed((): ToolCallInfo[] => {
  if (props.message.role !== 'assistant') return [];
  if (!props.message.toolName) return [];
  try {
    const input = props.message.toolInput ? JSON.parse(props.message.toolInput) : {};
    return [{
      toolName: props.message.toolName,
      filePath: input.file_path || input.filePath,
      summary: input.command || input.query,
      isEdit: props.message.toolName === 'Edit' || props.message.toolName === 'Replace',
      oldString: input.old_string || input.oldString,
      newString: input.new_string || input.newString,
    }];
  } catch {
    return [{
      toolName: props.message.toolName,
      summary: props.message.toolInput?.slice(0, 100),
    }];
  }
});

// Detect streaming (last message with no content yet or partial)
const isStreaming = computed(() => {
  return props.message.role === 'assistant' && !props.message.content && !props.message.toolName;
});
</script>
