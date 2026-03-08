# Prompt Improvements — IMPLEMENTED

All improvements from the original plan have been implemented in `src/engine/Orchestrator.ts`.

## What was done
- Specialist prompts: structured output formats, pipeline awareness, tool awareness
- Orchestrator preamble: resolved contradictions, positive framing, project context placeholder
- CREATE_WORKFLOW: retry limits, mandatory review, parallelization guidance, Definition of Done
- FIX_WORKFLOW: consolidated constraints, retry limits, feedback passing instructions
- Deduplication: single source of truth in Orchestrator.ts, imported by ProfileManager, ClaudeProcess, AngyEngine, App.vue
- Few-shot example added to orchestrator prompt

See the source code for current prompt text.
