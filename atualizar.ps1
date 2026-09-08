# Baixa a versão mais recente da Farmacinha Leticia e substitui os arquivos.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$root = $PSScriptRoot

Write-Host '============================================'
Write-Host '   Atualizando a Farmacinha Leticia...'
Write-Host '============================================'
Write-Host ''

$url = 'https://codeload.github.com/eldneytorres/Farmacia-Leticia/zip/refs/heads/claude/oi-mssu57'
$tmp = Join-Path $env:TEMP ('farma_' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $tmp | Out-Null
$zip = Join-Path $tmp 'app.zip'

try {
    Write-Host 'Baixando a versao mais recente...'
    Invoke-WebRequest -Uri $url -OutFile $zip
    Write-Host 'Extraindo...'
    Expand-Archive -Path $zip -DestinationPath $tmp -Force
    $src = Get-ChildItem -Path $tmp -Directory | Select-Object -First 1
    if (-not $src) { throw 'Conteudo baixado nao encontrado.' }

    Write-Host 'Substituindo os arquivos...'
    # robocopy mescla os arquivos novos sem apagar a pasta node_modules
    robocopy $src.FullName $root /E /NFL /NDL /NJH /NJS /NC /NS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "Falha ao copiar os arquivos (codigo $LASTEXITCODE)." }

    Write-Host ''
    Write-Host 'Atualizado com sucesso!' -ForegroundColor Green
}
catch {
    Write-Host ''
    Write-Host ('Falha ao atualizar: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host 'Verifique sua conexao com a internet e tente de novo.'
    Read-Host 'Pressione Enter para sair'
    exit 1
}
finally {
    Remove-Item -Path $tmp -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ''
Write-Host 'Preparando componentes (se necessario)...'
Set-Location $root
& npm install
Write-Host ''
Write-Host 'Abrindo o aplicativo...'
& npm start
