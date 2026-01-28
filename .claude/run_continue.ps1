[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
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

Set-Location "C:\\Users\\tkado\\Documents\\novapress-v2"

# Boucle continue - Claude Code enchaine les taches
& "C:\Users\tkado\.local\bin\claude.exe" "Tu es en mode AUTOMATIQUE CONTINU.

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
