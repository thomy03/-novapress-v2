import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const FEATURES_FILE = path.join(process.cwd(), '.claude', 'features.json');
const CURRENT_TASK_FILE = path.join(process.cwd(), '.claude', 'current_task.json');
const PROJECT_DIR = process.cwd().replace(/\\/g, '\\\\');
const CLAUDE_EXE = 'C:\\Users\\tkado\\.local\\bin\\claude.exe';

// POST - Lancer Claude Code (mode continue ou tâche spécifique)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mode, featureId, phaseId } = body;

    // Mode "continue" - Continuer le projet automatiquement
    if (mode === 'continue') {
      return await launchContinueMode();
    }

    // Mode tâche spécifique
    if (featureId && phaseId) {
      return await launchSpecificTask(featureId, phaseId);
    }

    return NextResponse.json(
      { error: 'Invalid request. Use mode: "continue" or provide featureId/phaseId' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error launching task:', error);
    return NextResponse.json(
      { error: 'Failed to launch task', details: String(error) },
      { status: 500 }
    );
  }
}

// Lancer en mode "Continue" - reprend le projet
async function launchContinueMode() {
  const scriptPath = path.join(process.cwd(), '.claude', 'run_continue.ps1');

  // Script PowerShell - Mode boucle continue jusqu'à completion du projet
  const scriptContent = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "Claude Code - NovaPress (Auto)"

Write-Host ""
Write-Host "  =========================================" -ForegroundColor Cyan
Write-Host "    NovaPress AI - Mode Automatique" -ForegroundColor Cyan
Write-Host "  =========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Claude Code va continuer jusqu'a ce que" -ForegroundColor Yellow
Write-Host "  toutes les taches soient terminees." -ForegroundColor Yellow
Write-Host ""
Write-Host "  Ctrl+C pour arreter a tout moment." -ForegroundColor Gray
Write-Host ""

Set-Location "${PROJECT_DIR}"

# Boucle continue - Claude Code enchaine les taches
& "${CLAUDE_EXE}" "Tu es en mode AUTOMATIQUE CONTINU.

INSTRUCTIONS:
1. Lis .claude/features.json pour voir les taches pending
2. Prends la premiere tache avec status 'pending' (priorite aux 'blocking')
3. Implemente-la completement
4. Mets a jour features.json: change le status a 'completed', incremente metadata.completed, decremente metadata.pending
5. Mets a jour claude-progress.md avec un resume
6. IMPORTANT: Apres chaque tache, dis 'TACHE TERMINEE - Je continue avec la suivante' puis enchaine IMMEDIATEMENT sur la prochaine tache pending
7. Continue jusqu'a ce que metadata.pending = 0

Si tu rencontres un blocage ou une erreur que tu ne peux pas resoudre, ecris 'BLOCAGE:' suivi de la description dans claude-progress.md et arrete-toi.

Commence maintenant en lisant les fichiers et en prenant la premiere tache pending."
`;

  await fs.writeFile(scriptPath, scriptContent, 'utf-8');

  // Lancer PowerShell
  const child = spawn('cmd.exe', ['/c', 'start', 'powershell.exe', '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
    detached: true,
    stdio: 'ignore',
    shell: false
  });
  child.unref();

  return NextResponse.json({
    success: true,
    message: 'Claude Code lance - Mode Continue',
    mode: 'continue'
  });
}

// Lancer une tâche spécifique
async function launchSpecificTask(featureId: string, phaseId: string) {
  const fileContent = await fs.readFile(FEATURES_FILE, 'utf-8');
  const data = JSON.parse(fileContent);

  let feature = null;
  let phase = null;
  for (const p of data.phases) {
    if (p.id === phaseId) {
      phase = p;
      feature = p.features.find((f: { id: string }) => f.id === featureId);
      break;
    }
  }

  if (!feature || !phase) {
    return NextResponse.json({ error: 'Feature not found' }, { status: 404 });
  }

  // Mettre à jour le status
  feature.status = 'in_progress';
  data.metadata.in_progress = (data.metadata.in_progress || 0) + 1;
  data.metadata.pending = Math.max(0, (data.metadata.pending || 0) - 1);
  await fs.writeFile(FEATURES_FILE, JSON.stringify(data, null, 2), 'utf-8');

  // Sauvegarder la tâche courante
  await fs.writeFile(CURRENT_TASK_FILE, JSON.stringify({
    featureId, phaseId, feature,
    phase: { id: phase.id, name: phase.name },
    startedAt: new Date().toISOString(),
    status: 'running'
  }, null, 2), 'utf-8');

  const scriptPath = path.join(process.cwd(), '.claude', 'run_task.ps1');
  const filesStr = feature.files.map((f: string) => `- ${f}`).join('\\n');
  const testsStr = feature.tests.map((t: string) => `- ${t}`).join('\\n');

  const scriptContent = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "Claude Code - ${feature.id}"

Write-Host ""
Write-Host "  =====================================" -ForegroundColor Cyan
Write-Host "    NovaPress AI - ${feature.id}" -ForegroundColor Cyan
Write-Host "  =====================================" -ForegroundColor Cyan
Write-Host ""

Set-Location "${PROJECT_DIR}"

& "${CLAUDE_EXE}" "Travaille sur la tache ${feature.id}: ${feature.title}. Description: ${feature.description}. Fichiers: ${filesStr}. Tests: ${testsStr}. Quand termine, mets a jour .claude/features.json (status: completed) et .claude/claude-progress.md."
`;

  await fs.writeFile(scriptPath, scriptContent, 'utf-8');

  const child = spawn('cmd.exe', ['/c', 'start', 'powershell.exe', '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
    detached: true,
    stdio: 'ignore',
    shell: false
  });
  child.unref();

  return NextResponse.json({
    success: true,
    message: `Tache ${feature.id} lancee`,
    task: { featureId, phaseId }
  });
}

// GET - Obtenir le status de la tâche courante
export async function GET() {
  try {
    const content = await fs.readFile(CURRENT_TASK_FILE, 'utf-8');
    return NextResponse.json(JSON.parse(content));
  } catch {
    return NextResponse.json({ status: 'idle', message: 'No task running' });
  }
}
