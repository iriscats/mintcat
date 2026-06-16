#Requires -Version 5.1
<#
.SYNOPSIS
  清除所有累积的 mintcat-proxy CA 证书（从受信任的根证书颁发机构）
.DESCRIPTION
  以管理员身份运行，循环移除所有名为 "mintcat-proxy CA" 的重复证书。
  用于修复因旧版脚本导致的证书堆积问题。
.EXAMPLE
  .\cleanup-certs.ps1
#>

$ErrorActionPreference = "Stop"

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
    Start-Process -FilePath "powershell.exe" -Verb RunAs -ArgumentList @(
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $PSCommandPath
    ) -Wait
    exit 0
}

Write-Host "==> 正在查找 mintcat-proxy CA 证书..." -ForegroundColor Cyan

$certs = Get-ChildItem Cert:\LocalMachine\Root | Where-Object { $_.Subject -like "*mintcat-proxy*" }
$count = @($certs).Count

if ($count -gt 0) {
    $certs | Remove-Item -Force
    Write-Host "==> 已移除 $count 个 mintcat-proxy CA 证书。" -ForegroundColor Green
} else {
    Write-Host "==> 未找到 mintcat-proxy CA 证书。" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "按任意键退出..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
