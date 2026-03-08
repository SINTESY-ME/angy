<template>
  <svg :width="width" :height="height" class="block">
    <!-- Edges -->
    <path
      v-for="(edge, i) in edges"
      :key="'e' + i"
      :d="edgePath(edge)"
      fill="none"
      :stroke="edge.color"
      stroke-width="2"
    />
    <!-- Nodes -->
    <circle
      v-for="node in nodes"
      :key="node.commit.hash"
      :cx="node.x * LANE_WIDTH + LANE_WIDTH / 2"
      :cy="node.y * ROW_HEIGHT + ROW_HEIGHT / 2"
      r="4"
      :fill="node.color"
      stroke="var(--bg-window)"
      stroke-width="2"
    />
  </svg>
</template>

<script setup lang="ts">
import { ROW_HEIGHT, LANE_WIDTH, type GitGraphNode, type GitGraphEdge } from '@/composables/useGitGraph';

defineProps<{
  nodes: GitGraphNode[];
  edges: GitGraphEdge[];
  width: number;
  height: number;
}>();

function edgePath(edge: GitGraphEdge): string {
  const x1 = edge.fromX * LANE_WIDTH + LANE_WIDTH / 2;
  const y1 = edge.fromY * ROW_HEIGHT + ROW_HEIGHT / 2;
  const x2 = edge.toX * LANE_WIDTH + LANE_WIDTH / 2;
  const y2 = edge.toY * ROW_HEIGHT + ROW_HEIGHT / 2;

  if (x1 === x2) {
    return `M ${x1},${y1} L ${x2},${y2}`;
  }
  const midY = (y1 + y2) / 2;
  return `M ${x1},${y1} C ${x1},${midY} ${x2},${midY} ${x2},${y2}`;
}
</script>
