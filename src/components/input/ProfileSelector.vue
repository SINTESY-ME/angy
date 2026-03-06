<template>
  <div class="relative" ref="root">
    <button
      @click="open = !open"
      class="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-[var(--border-subtle)]"
    >
      <span>{{ selectedCount > 0 ? `${selectedCount} profile${selectedCount > 1 ? 's' : ''}` : 'Profiles' }}</span>
      <span class="text-[8px]">▾</span>
    </button>
    <div
      v-if="open"
      class="absolute bottom-full left-0 mb-1 w-56 bg-[var(--bg-raised)] border border-[var(--border-standard)] rounded-lg shadow-lg overflow-hidden z-10 max-h-48 overflow-y-auto"
    >
      <label
        v-for="profile in profiles"
        :key="profile.id"
        class="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-white/[0.05]"
      >
        <input type="checkbox" :value="profile.id" v-model="selected" class="accent-[var(--accent-mauve)]" />
        <span class="text-xs">{{ profile.icon || '👤' }}</span>
        <span class="text-xs text-[var(--text-primary)]">{{ profile.name }}</span>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { ProfileManager, type PersonalityProfile } from '../../engine/ProfileManager';

const props = defineProps<{ modelValue: string[] }>();
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);
const selected = ref<string[]>([...props.modelValue]);
const profiles = ref<PersonalityProfile[]>([]);

const profileManager = new ProfileManager();

onMounted(async () => {
  await profileManager.init();
  profiles.value = profileManager.userProfiles();
});

const selectedCount = computed(() => selected.value.length);

watch(selected, (val) => {
  emit('update:modelValue', [...val]);
});

function onClickOutside(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) {
    open.value = false;
  }
}

onMounted(() => document.addEventListener('click', onClickOutside));
onUnmounted(() => document.removeEventListener('click', onClickOutside));
</script>
