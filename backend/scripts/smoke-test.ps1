$ErrorActionPreference = "Stop"
$node = (Get-Command node).Source
$work = "C:\Users\DELL\OneDrive\Desktop\vegamart\backend"

$server = Start-Process -FilePath $node -ArgumentList "node_modules\tsx\dist\cli.cjs","src\server.ts" -WorkingDirectory $work -PassThru -RedirectStandardOutput "$work\smoke-server.log" -RedirectStandardError "$work\smoke-server.err.log"

try {
    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Milliseconds 1000
        try {
            $r = Invoke-WebRequest -Uri "http://localhost:8080/api/v1/health" -UseBasicParsing -TimeoutSec 3
            if ($r.StatusCode -eq 200) { $ready = $true; break }
        } catch { }
    }
    if (-not $ready) {
        Write-Output "SERVER DID NOT BECOME READY"
        Get-Content "$work\smoke-server.log" | Select-Object -Last 10
        exit 1
    }

    Write-Output "=== 1. GET /api/v1/health ==="
    (Invoke-WebRequest -Uri "http://localhost:8080/api/v1/health" -UseBasicParsing).Content

    Write-Output ""
    Write-Output "=== 2. GET /api/v1/health/db (expect degraded, DB offline) ==="
    (Invoke-WebRequest -Uri "http://localhost:8080/api/v1/health/db" -UseBasicParsing -TimeoutSec 15).Content

    Write-Output ""
    Write-Output "=== 3. GET / (root) ==="
    (Invoke-WebRequest -Uri "http://localhost:8080/" -UseBasicParsing).Content

    Write-Output ""
    Write-Output "=== 4. GET unknown route (expect 404 JSON) ==="
    $body = curl.exe -s -w "|HTTP %{http_code}" "http://localhost:8080/api/v1/nope"
    Write-Output $body

    Write-Output ""
    Write-Output "=== 5. Swagger docs (expect 200) ==="
    curl.exe -s -o NUL -w "docs HTTP %{http_code}`n" "http://localhost:8080/api/v1/docs/"

    Write-Output ""
    Write-Output "=== 6. CORS allowed origin ==="
    curl.exe -s -o NUL -w "good-origin HTTP %{http_code}`n" -H "Origin: http://localhost:3000" "http://localhost:8080/api/v1/health"
    Write-Output "=== 7. CORS blocked origin ==="
    curl.exe -s -o NUL -w "bad-origin HTTP %{http_code}`n" -H "Origin: http://evil.example.com" "http://localhost:8080/api/v1/health"
}
finally {
    if ($server -and -not $server.HasExited) {
        Stop-Process -Id $server.Id -Force
    }
}
