
# NovaPress - Lancement tâche SEC-001
$Host.UI.RawUI.WindowTitle = "Claude Code - SEC-001"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  NovaPress AI - Tâche SEC-001" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Lancement de Claude Code..." -ForegroundColor Yellow
Write-Host ""

# Changer vers le répertoire du projet
Set-Location "C:\\Users\\tkado\\Documents\\novapress-v2"

# Lancer Claude Code avec le prompt
claude --print "Projet NovaPress v2. Travaille sur la tâche SEC-001: \"Regenerer toutes les API keys\"\n\nDescription: Les cles API sont exposees dans .env et potentiellement dans l'historique git\n\nFichiers concernés:\n- backend/.env\n\nTests de validation:\n- Verifier que les anciennes cles ne fonctionnent plus\n\nIMPORTANT:\n1. Lis d'abord .claude/claude-progress.md pour le contexte\n2. Implémente la tâche complètement\n3. Quand tu as terminé, mets à jour .claude/features.json en changeant le status de \"SEC-001\" à \"completed\"\n4. Mets aussi à jour .claude/claude-progress.md avec un résumé de ce qui a été fait"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Tâche terminée!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Appuyez sur Entrée pour fermer..." -ForegroundColor Gray
Read-Host
