import mitt from 'mitt';
import { Command } from '@tauri-apps/plugin-shell';

// ── Pipeline Node Definition ─────────────────────────────────────────────────

export interface PipelineNode {
  nodeId: string;
  label: string;
  specialistProfileId: string;
  taskTemplate: string; // {{user_input}}, {{nodeId_output}} placeholders
  dependsOn: string[];
  validationCommand?: string; // e.g. "cmake --build build" — empty means no validation
  maxRetries: number;
  retryPromptTemplate?: string;
}

// ── Pipeline Template ────────────────────────────────────────────────────────

export interface PipelineTemplate {
  pipelineId: string;
  name: string;
  description: string;
  nodes: PipelineNode[];
  builtIn: boolean;
}

// ── Node State ───────────────────────────────────────────────────────────────

export type NodeState = 'waiting' | 'running' | 'validating' | 'completed' | 'failed';

// ── Pipeline Execution ───────────────────────────────────────────────────────

export interface PipelineExecution {
  executionId: string;
  pipelineId: string;
  parentSessionId: string;
  workspace: string;
  userInput: string;
  nodeSessionMap: Map<string, string>;    // nodeId → sessionId
  nodeStates: Map<string, NodeState>;
  nodeOutputs: Map<string, string>;       // nodeId → output text
  nodeAttempts: Map<string, number>;      // nodeId → current attempt
  nodeErrors: Map<string, string>;        // nodeId → last validation error
}

// ── Events ───────────────────────────────────────────────────────────────────

export type PipelineEvents = {
  pipelineStarted: { executionId: string };
  nodeStarted: { executionId: string; nodeId: string; sessionId: string };
  nodeCompleted: { executionId: string; nodeId: string; output: string };
  nodeFailed: { executionId: string; nodeId: string; error: string };
  nodeRetrying: { executionId: string; nodeId: string; attempt: number; error: string };
  pipelineCompleted: { executionId: string };
  pipelineFailed: { executionId: string; error: string };
};

// ── ChatPanel interface (decouples from Vue component) ───────────────────────

export interface PipelineChatPanelAPI {
  delegateToChild(
    parentSessionId: string,
    task: string,
    context: string,
    specialistProfileId: string,
    contextProfileIds?: string[],
  ): string;
  sessionFinalOutput(sessionId: string): string;
}

// ── PipelineEngine ───────────────────────────────────────────────────────────

export class PipelineEngine {
  private events = mitt<PipelineEvents>();
  on = this.events.on.bind(this.events);
  off = this.events.off.bind(this.events);

  private chatPanel: PipelineChatPanelAPI | null = null;
  private workspace = '';
  private templates = new Map<string, PipelineTemplate>();
  private executions = new Map<string, PipelineExecution>();

  // Reverse lookup: sessionId → (executionId, nodeId)
  private sessionToNode = new Map<string, { executionId: string; nodeId: string }>();

  constructor() {
    this.loadBuiltInTemplates();
  }

  setChatPanel(panel: PipelineChatPanelAPI) { this.chatPanel = panel; }
  setWorkspace(ws: string) { this.workspace = ws; }

  allTemplates(): PipelineTemplate[] { return Array.from(this.templates.values()); }

  pipelineTemplate(id: string): PipelineTemplate | undefined {
    return this.templates.get(id);
  }

  execution(id: string): PipelineExecution | undefined {
    return this.executions.get(id);
  }

  // ── Start Pipeline ─────────────────────────────────────────────────────

  startPipeline(
    pipelineId: string,
    parentSessionId: string,
    userInput: string,
  ): string {
    let tmpl = this.templates.get(pipelineId);

    // Try name prefix match
    if (!tmpl) {
      for (const t of this.templates.values()) {
        if (t.name.toLowerCase().startsWith(pipelineId.toLowerCase())) {
          tmpl = t;
          break;
        }
      }
    }

    if (!tmpl) {
      console.warn('[PipelineEngine] No template found for:', pipelineId);
      return '';
    }

    const executionId = crypto.randomUUID();
    const exec: PipelineExecution = {
      executionId,
      pipelineId: tmpl.pipelineId,
      parentSessionId,
      workspace: this.workspace,
      userInput,
      nodeSessionMap: new Map(),
      nodeStates: new Map(),
      nodeOutputs: new Map(),
      nodeAttempts: new Map(),
      nodeErrors: new Map(),
    };

    // Initialize all nodes as waiting
    for (const node of tmpl.nodes) {
      exec.nodeStates.set(node.nodeId, 'waiting');
      exec.nodeAttempts.set(node.nodeId, 0);
    }

    this.executions.set(executionId, exec);
    this.events.emit('pipelineStarted', { executionId });

    console.log(`[PipelineEngine] Started pipeline: ${tmpl.name} execution: ${executionId}`);
    this.advanceExecution(executionId);

    return executionId;
  }

  // ── Cancel Pipeline ────────────────────────────────────────────────────

  cancelPipeline(executionId: string) {
    const exec = this.executions.get(executionId);
    if (!exec) return;

    // Remove session→node mappings for this execution
    for (const [sessionId, mapping] of this.sessionToNode) {
      if (mapping.executionId === executionId) {
        this.sessionToNode.delete(sessionId);
      }
    }

    this.executions.delete(executionId);
  }

  // ── Query ──────────────────────────────────────────────────────────────

  isNodeReady(exec: PipelineExecution, nodeId: string): boolean {
    const tmpl = this.templates.get(exec.pipelineId);
    if (!tmpl) return false;

    const node = tmpl.nodes.find(n => n.nodeId === nodeId);
    if (!node) return false;

    return node.dependsOn.every(
      depId => exec.nodeStates.get(depId) === 'completed',
    );
  }

  // ── Child Session Finished ─────────────────────────────────────────────

  async onChildSessionFinished(childSessionId: string) {
    const mapping = this.sessionToNode.get(childSessionId);
    if (!mapping) return;

    const { executionId, nodeId } = mapping;
    const exec = this.executions.get(executionId);
    if (!exec) return;

    const tmpl = this.templates.get(exec.pipelineId);
    if (!tmpl) return;

    const nodeDef = tmpl.nodes.find(n => n.nodeId === nodeId);
    const output = this.chatPanel?.sessionFinalOutput(childSessionId) || '';
    this.sessionToNode.delete(childSessionId);

    // If node has validation, run it
    if (nodeDef?.validationCommand) {
      exec.nodeStates.set(nodeId, 'validating');
      exec.nodeOutputs.set(nodeId, output);
      await this.runValidation(executionId, nodeId, nodeDef.validationCommand);
      return;
    }

    // No validation — mark completed
    exec.nodeStates.set(nodeId, 'completed');
    exec.nodeOutputs.set(nodeId, output);

    console.log(`[PipelineEngine] Node completed: ${nodeDef?.label || nodeId}`);
    this.events.emit('nodeCompleted', { executionId, nodeId, output });

    this.advanceExecution(executionId);
  }

  // ── Session ID Changed ─────────────────────────────────────────────────

  onSessionIdChanged(oldId: string, newId: string) {
    // Update session→node mapping
    const mapping = this.sessionToNode.get(oldId);
    if (mapping) {
      this.sessionToNode.delete(oldId);
      this.sessionToNode.set(newId, mapping);
      console.log(`[PipelineEngine] Session ID remapped: ${oldId} -> ${newId}`);
    }

    // Update nodeSessionMap in executions
    for (const exec of this.executions.values()) {
      for (const [nodeId, sessionId] of exec.nodeSessionMap) {
        if (sessionId === oldId) {
          exec.nodeSessionMap.set(nodeId, newId);
        }
      }
      if (exec.parentSessionId === oldId) {
        exec.parentSessionId = newId;
      }
    }
  }

  // ── Private: Advance Execution ─────────────────────────────────────────

  private advanceExecution(executionId: string) {
    const exec = this.executions.get(executionId);
    if (!exec) return;

    const tmpl = this.templates.get(exec.pipelineId);
    if (!tmpl) return;

    let anyRunning = false;
    let allDone = true;
    let anyFailed = false;

    for (const node of tmpl.nodes) {
      const state = exec.nodeStates.get(node.nodeId) || 'waiting';

      if (state === 'running' || state === 'validating') {
        anyRunning = true;
        allDone = false;
      } else if (state === 'waiting') {
        allDone = false;
        if (this.isNodeReady(exec, node.nodeId)) {
          this.launchNode(exec, node);
          anyRunning = true;
        }
      } else if (state === 'failed') {
        anyFailed = true;
      }
      // 'completed' contributes to allDone naturally
    }

    if (anyFailed && !anyRunning) {
      this.events.emit('pipelineFailed', {
        executionId,
        error: 'One or more nodes failed',
      });
      return;
    }

    if (allDone) {
      console.log(`[PipelineEngine] Pipeline completed: ${executionId}`);
      this.events.emit('pipelineCompleted', { executionId });
    }
  }

  // ── Private: Launch Node ───────────────────────────────────────────────

  private launchNode(exec: PipelineExecution, node: PipelineNode) {
    if (!this.chatPanel) return;

    exec.nodeStates.set(node.nodeId, 'running');
    exec.nodeAttempts.set(node.nodeId, (exec.nodeAttempts.get(node.nodeId) || 0) + 1);

    const prompt = this.buildNodePrompt(exec, node);

    console.log(`[PipelineEngine] Launching node: ${node.label} attempt: ${exec.nodeAttempts.get(node.nodeId)}`);

    const childSessionId = this.chatPanel.delegateToChild(
      exec.parentSessionId,
      prompt,
      '', // context already baked into prompt via placeholders
      node.specialistProfileId,
    );

    if (childSessionId) {
      exec.nodeSessionMap.set(node.nodeId, childSessionId);
      this.sessionToNode.set(childSessionId, {
        executionId: exec.executionId,
        nodeId: node.nodeId,
      });
      this.events.emit('nodeStarted', {
        executionId: exec.executionId,
        nodeId: node.nodeId,
        sessionId: childSessionId,
      });
    }
  }

  // ── Private: Run Validation ────────────────────────────────────────────

  private async runValidation(
    executionId: string,
    nodeId: string,
    command: string,
  ) {
    const exec = this.executions.get(executionId);
    if (!exec) return;

    const tmpl = this.templates.get(exec.pipelineId);
    if (!tmpl) return;

    const nodeDef = tmpl.nodes.find(n => n.nodeId === nodeId);

    try {
      console.log(`[PipelineEngine] Running validation: ${command}`);
      const cmd = Command.create('exec-sh', ['-c', command], {
        cwd: this.workspace || undefined,
      });
      const output = await cmd.execute();
      const stdout = (output.stdout + '\n' + output.stderr).trim().substring(0, 3000);

      if (output.code === 0) {
        // Validation passed
        exec.nodeStates.set(nodeId, 'completed');
        console.log(`[PipelineEngine] Validation passed for: ${nodeDef?.label || nodeId}`);
        this.events.emit('nodeCompleted', {
          executionId,
          nodeId,
          output: exec.nodeOutputs.get(nodeId) || '',
        });
      } else {
        // Validation failed
        const errorOutput = stdout.length > 3000
          ? stdout.substring(0, 3000) + '\n[...truncated...]'
          : stdout;

        exec.nodeErrors.set(nodeId, errorOutput);
        const attempts = exec.nodeAttempts.get(nodeId) || 0;

        console.log(`[PipelineEngine] Validation failed for: ${nodeDef?.label || nodeId} attempt: ${attempts}/${nodeDef?.maxRetries || 0}`);

        if (nodeDef && attempts < nodeDef.maxRetries) {
          this.events.emit('nodeRetrying', {
            executionId,
            nodeId,
            attempt: attempts + 1,
            error: errorOutput,
          });
          this.retryNode(exec, nodeDef);
        } else {
          exec.nodeStates.set(nodeId, 'failed');
          this.events.emit('nodeFailed', {
            executionId,
            nodeId,
            error: `Validation failed after ${attempts} attempts`,
          });
        }
      }
    } catch (e: any) {
      exec.nodeStates.set(nodeId, 'failed');
      exec.nodeErrors.set(nodeId, e.message);
      this.events.emit('nodeFailed', {
        executionId,
        nodeId,
        error: e.message,
      });
    }

    this.advanceExecution(executionId);
  }

  // ── Private: Retry Node ────────────────────────────────────────────────

  private retryNode(exec: PipelineExecution, node: PipelineNode) {
    if (!this.chatPanel) return;

    // Build retry prompt with error context
    let retryPrompt = node.retryPromptTemplate
      || 'The previous attempt failed:\n\n{{error}}\n\nFix all issues.';

    retryPrompt = retryPrompt.replace('{{error}}', exec.nodeErrors.get(node.nodeId) || '');
    retryPrompt = retryPrompt.replace('{{user_input}}', exec.userInput);

    // Replace any {{nodeId_output}} placeholders
    for (const [depId, output] of exec.nodeOutputs) {
      retryPrompt = retryPrompt.replace(`{{${depId}_output}}`, output);
    }

    exec.nodeStates.set(node.nodeId, 'running');
    exec.nodeAttempts.set(node.nodeId, (exec.nodeAttempts.get(node.nodeId) || 0) + 1);

    const childSessionId = this.chatPanel.delegateToChild(
      exec.parentSessionId,
      retryPrompt,
      '',
      node.specialistProfileId,
    );

    if (childSessionId) {
      exec.nodeSessionMap.set(node.nodeId, childSessionId);
      this.sessionToNode.set(childSessionId, {
        executionId: exec.executionId,
        nodeId: node.nodeId,
      });
      this.events.emit('nodeStarted', {
        executionId: exec.executionId,
        nodeId: node.nodeId,
        sessionId: childSessionId,
      });
    }
  }

  // ── Private: Build Node Prompt ─────────────────────────────────────────

  private buildNodePrompt(exec: PipelineExecution, node: PipelineNode): string {
    let prompt = node.taskTemplate;
    prompt = prompt.replace('{{user_input}}', exec.userInput);

    for (const [depId, output] of exec.nodeOutputs) {
      prompt = prompt.replace(`{{${depId}_output}}`, output);
    }

    return prompt;
  }

  // ── Private: Load Built-In Templates ───────────────────────────────────

  private loadBuiltInTemplates() {
    // Refactor Pipeline: architect → implementer (with build validation) → [reviewer, tester]
    this.templates.set('builtin-refactor', {
      pipelineId: 'builtin-refactor',
      name: 'Refactor Pipeline',
      description: 'Architect → Implement (with build validation) → Review + Test',
      builtIn: true,
      nodes: [
        {
          nodeId: 'architect',
          label: 'Architect',
          specialistProfileId: 'specialist-architect',
          taskTemplate:
            'Analyze the following task and produce a detailed implementation plan:\n\n{{user_input}}',
          dependsOn: [],
          maxRetries: 0,
        },
        {
          nodeId: 'implementer',
          label: 'Implementer',
          specialistProfileId: 'specialist-implementer',
          taskTemplate:
            'Implement the following plan:\n\n{{architect_output}}',
          dependsOn: ['architect'],
          validationCommand: 'cmake --build build',
          maxRetries: 3,
          retryPromptTemplate:
            'The build failed with the following errors:\n\n{{error}}\n\nFix all build errors.',
        },
        {
          nodeId: 'reviewer',
          label: 'Reviewer',
          specialistProfileId: 'specialist-reviewer',
          taskTemplate:
            'Review the changes made by the implementer. The original task was:\n\n' +
            '{{user_input}}\n\nThe architect\'s plan was:\n\n{{architect_output}}',
          dependsOn: ['implementer'],
          maxRetries: 0,
        },
        {
          nodeId: 'tester',
          label: 'Tester',
          specialistProfileId: 'specialist-tester',
          taskTemplate:
            'Write and run tests for the recent changes. The original task was:\n\n{{user_input}}',
          dependsOn: ['implementer'],
          maxRetries: 0,
        },
      ],
    });

    // Review Pipeline: reviewer → implementer (fixes)
    this.templates.set('builtin-review', {
      pipelineId: 'builtin-review',
      name: 'Review Pipeline',
      description: 'Review → Fix issues found',
      builtIn: true,
      nodes: [
        {
          nodeId: 'reviewer',
          label: 'Reviewer',
          specialistProfileId: 'specialist-reviewer',
          taskTemplate:
            'Review the current state of the codebase for:\n\n{{user_input}}',
          dependsOn: [],
          maxRetries: 0,
        },
        {
          nodeId: 'implementer',
          label: 'Fixer',
          specialistProfileId: 'specialist-implementer',
          taskTemplate:
            'Fix the issues found by the reviewer:\n\n{{reviewer_output}}',
          dependsOn: ['reviewer'],
          validationCommand: 'cmake --build build',
          maxRetries: 3,
          retryPromptTemplate:
            'The build failed after your fixes:\n\n{{error}}\n\nFix all build errors.',
        },
      ],
    });
  }
}
