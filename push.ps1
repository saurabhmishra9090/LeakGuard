$ErrorActionPreference = "Stop"

# Ensure we are inside a Git repository
git rev-parse --show-toplevel | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Git repository not found." -ForegroundColor Red
    exit 1
}

Write-Host "`nCurrent changes:" -ForegroundColor Cyan
git status --short

$confirm = Read-Host "`nStage all listed changes and continue? (y/n)"
if ($confirm -notmatch '^(y|yes)$') {
    Write-Host "Cancelled. No changes were pushed."
    exit 0
}

git add -A
if ($LASTEXITCODE -ne 0) {
    Write-Host "Git add failed." -ForegroundColor Red
    exit 1
}

$staged = @(git diff --cached --name-only)

if ($staged.Count -gt 0) {
    Write-Host "`nFiles to commit:" -ForegroundColor Cyan
    git diff --cached --name-status

    $message = Read-Host "`nEnter commit message"
    if ([string]::IsNullOrWhiteSpace($message)) {
        Write-Host "Commit message cannot be empty." -ForegroundColor Red
        exit 1
    }

    git commit -m "$message"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Commit failed. Check the output above." -ForegroundColor Red
        exit 1
    }
}
else {
    Write-Host "`nNo new changes to commit."
}

git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "Push failed. Check the error above." -ForegroundColor Red
    exit 1
}

Write-Host "`nSuccessfully pushed to GitHub!" -ForegroundColor Green