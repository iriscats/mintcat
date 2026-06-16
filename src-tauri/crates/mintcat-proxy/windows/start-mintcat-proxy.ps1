#Requires -Version 5.1
<#
.SYNOPSIS
  以管理员身份：安装 CA → 启动 mintcat-proxy（hosts + 443）
.DESCRIPTION
  与 mintcat-proxy.exe 放在同一目录，或设置环境变量 MINTCAT_PROXY_EXE 指向可执行文件。
  若当前未提升权限，会弹出 UAC 以管理员重新运行本脚本。
.EXAMPLE
  .\start-mintcat-proxy.ps1
.EXAMPLE
  .\start-mintcat-proxy.ps1 -Offline
#>
param(
    [switch]$Offline,
    [string]$Bind = "0.0.0.0",
    [int]$Port = 443
)

$ErrorActionPreference = "Stop"

# 中文 Windows 控制台默认 CP936，与 UTF-8 脚本/日志混用会乱码；先切 UTF-8 再输出
try {
    $null = cmd /c "chcp 65001>nul"
} catch {}
$utf8 = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8

function Test-Administrator {
    $p = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Administrator)) {
    $argList = @(
        "-NoProfile"
        "-ExecutionPolicy", "Bypass"
        "-File", $PSCommandPath
    )
    if ($Offline) { $argList += "-Offline" }
    if ($Bind -ne "0.0.0.0") { $argList += "-Bind"; $argList += $Bind }
    if ($Port -ne 443) { $argList += "-Port"; $argList += $Port }
    $proc = Start-Process -FilePath "powershell.exe" -Verb RunAs -ArgumentList $argList -PassThru -Wait
    if ($proc -and $null -ne $proc.ExitCode) { exit $proc.ExitCode }
    exit 0
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$exe = $env:MINTCAT_PROXY_EXE
if (-not $exe) {
    $exe = Join-Path $scriptDir "mintcat-proxy.exe"
}
if (-not (Test-Path -LiteralPath $exe)) {
    Write-Error "找不到 mintcat-proxy.exe：$exe`n请将 exe 与本脚本放在同一目录，或设置环境变量 MINTCAT_PROXY_EXE。"
}

Write-Host "==> 安装 CA 到受信任的根证书颁发机构..." -ForegroundColor Cyan
& $exe cert install
if ($LASTEXITCODE -ne 0) {
    Write-Error "cert install 失败 (exit $LASTEXITCODE)。"
}

$startArgs = @("start", "--bind", $Bind, "-p", "$Port")
if ($Offline) {
    $startArgs += "--offline"
}

Write-Host "==> 启动代理（Ctrl+C 停止）..." -ForegroundColor Cyan
& $exe @startArgs
exit $LASTEXITCODE
