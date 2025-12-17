@echo off
setlocal enabledelayedexpansion

REM 读取系统代理开关
for /f "tokens=3" %%A in ('reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyEnable ^| findstr ProxyEnable') do set PROXYENABLE=%%A

REM 读取系统代理地址（形如 127.0.0.1:10852）
for /f "tokens=3" %%A in ('reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyServer ^| findstr ProxyServer') do set PROXYSERVER=%%A

echo ProxyEnable=%PROXYENABLE%
echo ProxyServer=%PROXYSERVER%

if "%PROXYENABLE%"=="0x0" (
  echo System proxy is OFF. Unsetting git proxy...
  git config --global --unset http.proxy  2>nul
  git config --global --unset https.proxy 2>nul
  echo Done.
  exit /b 0
)

if "%PROXYSERVER%"=="" (
  echo ProxyServer not found. Please enable system proxy in your proxy app.
  exit /b 1
)

echo Setting git proxy to http://%PROXYSERVER% ...
git config --global http.proxy http://%PROXYSERVER%
git config --global https.proxy http://%PROXYSERVER%

echo Current git proxy:
git config --global --get http.proxy
git config --global --get https.proxy

echo Done.
