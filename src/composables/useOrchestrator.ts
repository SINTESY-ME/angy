import { ref, computed } from 'vue';
import { OrchestratorPool } from '../engine/OrchestratorPool';
import { PipelineEngine } from '../engine/PipelineEngine';
import { engineBus } from '../engine/EventBus';
import type { AngyEngine } from '../engine/AngyEngine';
import type { BranchManager } from '../engine/BranchManager';
import { getTechProfileById, type TechProfile } from '../engine/TechDetector';

// ── Singleton instances ──────────────────────────────────────────────────────

const pipeline = new PipelineEngine();

// ── Pool ─────────────────────────────────────────────────────────────────────

let pool: OrchestratorPool | null = null;

// ── Reactive state ───────────────────────────────────────────────────────────

const phase = ref('');
const running = ref(false);
const delegations = ref(0);
const lastEvent = ref('');
const activeEpicCount = ref(0);
const autoProfiles = ref<TechProfile[]>([]);

// ── Wire engine bus events to reactive state ─────────────────────────────────

engineBus.on('orchestrator:autoProfilesDetected', (data) => {
  autoProfiles.value = data.profileIds
    .map(id => getTechProfileById(id))
    .filter((p): p is TechProfile => p !== undefined);
});

// ── Composable ───────────────────────────────────────────────────────────────

export function useOrchestrator() {
  const isRunning = computed(() => running.value);
  const totalDelegations = computed(() => delegations.value);

  // ── Pool management ──────────────────────────────────────────────────

  function initPool(branchManager: BranchManager): OrchestratorPool {
    pool = OrchestratorPool.getInstance(branchManager);
    return pool;
  }

  function getPool(): OrchestratorPool | null {
    return pool;
  }

  /** Set the AngyEngine reference (no-op — retained for App.vue compatibility). */
  function setEngine(_e: AngyEngine): void {
    // No-op: all orchestration is now handled by AngyEngine directly
  }

  // TODO: re-implement standalone orchestration using HybridPipelineRunner if needed

  // ── Pipeline (unchanged) ─────────────────────────────────────────────

  function startPipeline(
    pipelineId: string,
    parentSessionId: string,
    userInput: string,
  ) {
    return pipeline.startPipeline(pipelineId, parentSessionId, userInput);
  }

  function cancelPipeline(executionId: string) {
    pipeline.cancelPipeline(executionId);
  }

  return {
    // Engine instances
    pipeline,
    // Pool & Engine
    pool: computed(() => pool),
    activeEpicCount: computed(() => activeEpicCount.value),
    initPool,
    getPool,
    setEngine,
    // Reactive state
    phase,
    isRunning,
    totalDelegations,
    lastEvent,
    autoProfiles,
    // Actions
    startPipeline,
    cancelPipeline,
  };
}
