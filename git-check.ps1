param($Path = "c:\Users\Lenovo\Downloads\devsolvev2-agent-pages-manage-crawl-budget-dd8b\devsolvev2")

Push-Location $Path
try {
    git branch --list 2>&1
    Write-Host "`n---`nGit Status:`n" -ForegroundColor Cyan
    git status --short 2>&1
}
catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
Pop-Location