import { ref, reactive } from 'vue'
import { Command } from '@tauri-apps/plugin-shell'

// ── Types ─────────────────────────────────────────────────────────────────

export interface RepoBranchInfo {
  repoId: string
  repoName: string
  repoPath: string
  currentBranch: string
  branches: string[]
  loading: boolean
  error: string | null
}

export interface MergeResult {
  epicId: string
  epicName: string
  branchName: string
  repoPath: string
  repoName: string
  success: boolean
  conflicted: boolean
  output: string
}

// ── Composable ────────────────────────────────────────────────────────────

export function useMultiRepoGit() {
  const repoBranches = reactive<Map<string, RepoBranchInfo>>(new Map())
  const loading = ref(false)

  // ── Helper: run a git command in a specific directory ────────────────

  async function gitCmd(cwd: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
    const result = await Command.create('git', args, { cwd }).execute()
    return { code: result.code ?? 1, stdout: result.stdout.trim(), stderr: result.stderr.trim() }
  }

  // ── Get current branch for a single repo ────────────────────────────

  async function getCurrentBranch(repoPath: string): Promise<string> {
    const result = await gitCmd(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD'])
    return result.code === 0 ? result.stdout : 'unknown'
  }

  // ── Refresh branch info for all repos ───────────────────────────────

  async function refreshAllBranches(repos: Array<{ id: string; name: string; path: string }>): Promise<void> {
    loading.value = true
    try {
      await Promise.all(repos.map(async (repo) => {
        const info: RepoBranchInfo = {
          repoId: repo.id,
          repoName: repo.name,
          repoPath: repo.path,
          currentBranch: '',
          branches: [],
          loading: true,
          error: null,
        }
        repoBranches.set(repo.id, info)

        try {
          const [branchResult, currentResult] = await Promise.all([
            gitCmd(repo.path, ['branch', '--list', '--format=%(refname:short)']),
            getCurrentBranch(repo.path),
          ])

          info.currentBranch = currentResult
          info.branches = branchResult.code === 0
            ? branchResult.stdout.split('\n').filter(Boolean)
            : []
          info.loading = false
        } catch (e: unknown) {
          info.error = e instanceof Error ? e.message : 'Failed to get branch info'
          info.loading = false
        }
      }))
    } finally {
      loading.value = false
    }
  }

  // ── Checkout branch in a specific repo ──────────────────────────────

  async function checkoutInRepo(repoPath: string, branchName: string): Promise<{ success: boolean; error?: string }> {
    const result = await gitCmd(repoPath, ['checkout', branchName])
    if (result.code === 0) {
      for (const [, info] of repoBranches) {
        if (info.repoPath === repoPath) {
          info.currentBranch = branchName
        }
      }
      return { success: true }
    }
    return { success: false, error: result.stderr }
  }

  // ── Create a new branch in a specific repo ──────────────────────────

  async function createBranchInRepo(
    repoPath: string,
    name: string,
    checkout = true,
    baseBranch?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const args = checkout ? ['checkout', '-b', name] : ['branch', name]
    if (baseBranch) args.push(baseBranch)
    const result = await gitCmd(repoPath, args)
    if (result.code === 0) {
      for (const [, info] of repoBranches) {
        if (info.repoPath === repoPath) {
          if (checkout) info.currentBranch = name
          if (!info.branches.includes(name)) info.branches.push(name)
        }
      }
      return { success: true }
    }
    return { success: false, error: result.stderr }
  }

  // ── Pull in a specific repo ─────────────────────────────────────────

  async function pullRepo(repoPath: string, remote = 'origin', branch?: string): Promise<{ success: boolean; error?: string }> {
    const args = ['pull', remote]
    if (branch) args.push(branch)
    const result = await gitCmd(repoPath, args)
    return result.code === 0
      ? { success: true }
      : { success: false, error: result.stderr }
  }

  // ── Fetch in a specific repo ────────────────────────────────────────

  async function fetchRepo(repoPath: string, remote = 'origin'): Promise<{ success: boolean; error?: string }> {
    const result = await gitCmd(repoPath, ['fetch', remote])
    return result.code === 0
      ? { success: true }
      : { success: false, error: result.stderr }
  }

  // ── Push in a specific repo ─────────────────────────────────────────

  async function pushRepo(repoPath: string, remote = 'origin', branch?: string): Promise<{ success: boolean; error?: string }> {
    const args = ['push', remote]
    if (branch) args.push(branch)
    const result = await gitCmd(repoPath, args)
    return result.code === 0
      ? { success: true }
      : { success: false, error: result.stderr }
  }

  // ── Check if working tree is dirty ──────────────────────────────────

  async function isDirty(repoPath: string): Promise<boolean> {
    const result = await gitCmd(repoPath, ['status', '--porcelain'])
    return result.code === 0 && result.stdout.length > 0
  }

  // ── Merge multiple epic branches into a target branch ───────────────

  async function mergeEpicBranches(
    epicBranches: Array<{ epicId: string; epicName: string; repoBranches: Map<string, string> }>,
    repos: Array<{ id: string; name: string; path: string }>,
    targetBranch: string,
    baseBranch: string,
  ): Promise<{ results: MergeResult[]; aborted: boolean }> {
    const results: MergeResult[] = []
    let aborted = false

    for (const repo of repos) {
      // Resolve epic branches that have a branch name for this repo
      const epicsForRepo = epicBranches
        .map(eb => ({ epicId: eb.epicId, epicName: eb.epicName, branchName: eb.repoBranches.get(repo.id) ?? '' }))
        .filter(eb => eb.branchName)

      if (epicsForRepo.length === 0) continue

      // Check if repo is dirty
      if (await isDirty(repo.path)) {
        for (const epic of epicsForRepo) {
          results.push({
            epicId: epic.epicId,
            epicName: epic.epicName,
            branchName: epic.branchName,
            repoPath: repo.path,
            repoName: repo.name,
            success: false,
            conflicted: false,
            output: 'Working tree is dirty. Please commit or stash changes first.',
          })
        }
        continue
      }

      // Check which epic branches exist in this repo
      const branchListResult = await gitCmd(repo.path, ['branch', '--list', '--format=%(refname:short)'])
      const existingBranches = branchListResult.code === 0
        ? branchListResult.stdout.split('\n').filter(Boolean)
        : []

      const epicBranchesInRepo = epicsForRepo.filter(eb => existingBranches.includes(eb.branchName))
      if (epicBranchesInRepo.length === 0) continue

      // Create target branch from base
      const createResult = await gitCmd(repo.path, ['checkout', '-b', targetBranch, baseBranch])
      if (createResult.code !== 0) {
        // Maybe branch already exists, try checkout
        const checkoutResult = await gitCmd(repo.path, ['checkout', targetBranch])
        if (checkoutResult.code !== 0) {
          for (const epic of epicBranchesInRepo) {
            results.push({
              epicId: epic.epicId,
              epicName: epic.epicName,
              branchName: epic.branchName,
              repoPath: repo.path,
              repoName: repo.name,
              success: false,
              conflicted: false,
              output: `Failed to create/checkout target branch: ${createResult.stderr}`,
            })
          }
          continue
        }
      }

      // Merge each epic branch
      for (const epic of epicBranchesInRepo) {
        const mergeResult = await gitCmd(repo.path, [
          'merge', epic.branchName, '--no-ff',
          '-m', `Merge ${epic.branchName} into ${targetBranch}`,
        ])

        if (mergeResult.code === 0) {
          results.push({
            epicId: epic.epicId,
            epicName: epic.epicName,
            branchName: epic.branchName,
            repoPath: repo.path,
            repoName: repo.name,
            success: true,
            conflicted: false,
            output: mergeResult.stdout,
          })
        } else {
          const conflicted = mergeResult.stdout.includes('CONFLICT') || mergeResult.stderr.includes('CONFLICT')
          results.push({
            epicId: epic.epicId,
            epicName: epic.epicName,
            branchName: epic.branchName,
            repoPath: repo.path,
            repoName: repo.name,
            success: false,
            conflicted,
            output: mergeResult.stderr || mergeResult.stdout,
          })

          // Abort the merge if there's a conflict
          if (conflicted) {
            await gitCmd(repo.path, ['merge', '--abort'])
            aborted = true
          }
        }
      }
    }

    return { results, aborted }
  }

  return {
    repoBranches,
    loading,
    refreshAllBranches,
    getCurrentBranch,
    checkoutInRepo,
    createBranchInRepo,
    pullRepo,
    fetchRepo,
    pushRepo,
    isDirty,
    mergeEpicBranches,
  }
}
