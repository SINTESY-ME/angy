<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" @click.self="$emit('close')">
      <div class="w-[480px] max-w-[480px] max-h-[80vh] bg-[var(--bg-window)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] overflow-hidden flex flex-col" style="box-shadow: var(--shadow-lg)">
        <div class="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
          <span class="text-sm font-medium text-[var(--text-primary)]">Personality Profiles</span>
          <button @click="$emit('close')" class="text-[var(--text-muted)] hover:text-[var(--text-secondary)]">✕</button>
        </div>

        <div class="flex flex-1 overflow-hidden">
          <!-- Profile list -->
          <div class="w-48 border-r border-[var(--border-subtle)] overflow-y-auto">
            <div
              v-for="profile in profiles"
              :key="profile.id"
              @click="selectProfile(profile)"
              class="flex items-center gap-2 px-3 py-2 cursor-pointer"
              :class="selectedId === profile.id ? 'bg-[var(--bg-raised)]' : 'hover:bg-white/[0.03]'"
            >
              <span class="text-xs">{{ profile.icon || '👤' }}</span>
              <span class="text-xs text-[var(--text-primary)] flex-1 truncate">{{ profile.name }}</span>
              <span v-if="profile.isBuiltIn" class="text-[8px] text-[var(--text-faint)]">built-in</span>
            </div>
            <button @click="createNew" class="w-full px-3 py-2 text-xs text-[var(--accent-mauve)] hover:bg-white/[0.03]">+ New Profile</button>
          </div>

          <!-- Profile editor -->
          <div v-if="editing" class="flex-1 p-4 space-y-3 overflow-y-auto">
            <div>
              <label class="text-xs text-[var(--text-secondary)] mb-1 block">Name</label>
              <input
                v-model="editing.name"
                :disabled="editing.isBuiltIn"
                class="w-full text-xs bg-[var(--bg-raised)] text-[var(--text-primary)] border border-[var(--border-standard)] rounded px-3 py-2 outline-none focus:border-[var(--accent-mauve)] disabled:opacity-50"
              />
            </div>
            <div>
              <label class="text-xs text-[var(--text-secondary)] mb-1 block">Icon</label>
              <input
                v-model="editing.icon"
                :disabled="editing.isBuiltIn"
                maxlength="2"
                class="w-16 text-center text-sm bg-[var(--bg-raised)] text-[var(--text-primary)] border border-[var(--border-standard)] rounded px-2 py-1 outline-none"
              />
            </div>
            <div>
              <label class="text-xs text-[var(--text-secondary)] mb-1 block">System Prompt</label>
              <textarea
                v-model="editing.systemPrompt"
                :disabled="editing.isBuiltIn"
                rows="10"
                class="w-full text-xs bg-[var(--bg-raised)] text-[var(--text-primary)] border border-[var(--border-standard)] rounded px-3 py-2 outline-none focus:border-[var(--accent-mauve)] resize-none disabled:opacity-50"
              />
            </div>
            <div class="flex gap-2">
              <button
                v-if="!editing.isBuiltIn"
                @click="saveProfile"
                class="text-xs px-4 py-1.5 rounded bg-[var(--accent-mauve)] text-[var(--bg-base)] font-medium"
              >
                Save
              </button>
              <button
                v-if="!editing.isBuiltIn"
                @click="deleteProfile"
                class="text-xs px-4 py-1.5 rounded bg-[color-mix(in_srgb,var(--accent-red)_20%,transparent)] text-[var(--accent-red)]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ProfileManager, type PersonalityProfile } from '../../engine/ProfileManager';

defineProps<{ visible: boolean }>();
defineEmits<{ close: [] }>();

const profileManager = new ProfileManager();
const profiles = ref<PersonalityProfile[]>([]);
const selectedId = ref('');
const editing = ref<PersonalityProfile | null>(null);

onMounted(async () => {
  await profileManager.init();
  profiles.value = profileManager.allProfiles();
  if (profiles.value.length > 0) selectProfile(profiles.value[0]);
});

function selectProfile(profile: PersonalityProfile) {
  selectedId.value = profile.id;
  editing.value = { ...profile };
}

function createNew() {
  const id = `profile-${Date.now()}`;
  editing.value = { id, name: 'New Profile', systemPrompt: '', isBuiltIn: false, icon: '👤' };
  selectedId.value = id;
}

async function saveProfile() {
  if (!editing.value) return;
  await profileManager.saveProfile(editing.value);
  profiles.value = profileManager.allProfiles();
}

async function deleteProfile() {
  if (!editing.value || editing.value.isBuiltIn) return;
  await profileManager.deleteProfile(editing.value.id);
  profiles.value = profileManager.allProfiles();
  editing.value = profiles.value[0] ? { ...profiles.value[0] } : null;
  selectedId.value = profiles.value[0]?.id || '';
}
</script>
