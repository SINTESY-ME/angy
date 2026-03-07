<template>
  <div class="space-y-1.5">
    <label
      v-for="repo in repos"
      :key="repo.id"
      class="flex items-center gap-2 px-2 py-1 rounded text-sm cursor-pointer
             hover:bg-[var(--bg-raised)] transition-colors"
    >
      <input
        type="checkbox"
        :checked="modelValue.includes(repo.id)"
        class="accent-[var(--accent-mauve)] rounded"
        @change="toggle(repo.id)"
      />
      <div class="flex flex-col min-w-0">
        <span class="text-[var(--text-primary)] text-sm truncate">{{ repo.name }}</span>
        <span class="text-[var(--text-muted)] text-[10px] truncate">{{ repo.path }}</span>
      </div>
    </label>
    <p v-if="repos.length === 0" class="text-xs text-[var(--text-muted)] italic px-2">
      No repos configured for this project.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useProjectsStore } from '@/stores/projects';

const props = defineProps<{
  projectId: string;
  modelValue: string[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string[]];
}>();

const projectsStore = useProjectsStore();
const repos = computed(() => projectsStore.reposByProjectId(props.projectId));

function toggle(repoId: string) {
  if (props.modelValue.includes(repoId)) {
    emit('update:modelValue', props.modelValue.filter((id) => id !== repoId));
  } else {
    emit('update:modelValue', [...props.modelValue, repoId]);
  }
}
</script>
