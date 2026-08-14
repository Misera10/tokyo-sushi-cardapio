@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "KIT=C:\EstudioFernandes\kits\estudio-fernandes-spec-driven-kit"
if not "%~1"=="" set "DESTINO=%~1"
if not defined DESTINO set /p "DESTINO=Caminho completo da pasta do projeto: "
if not defined DESTINO set "DESTINO=%CD%"
for %%I in ("%DESTINO%") do set "DESTINO=%%~fI"

if not exist "%DESTINO%\" (
  echo [ERRO] Pasta do projeto nao encontrada:
  echo %DESTINO%
  pause
  exit /b 1
)

if /I "%DESTINO%"=="C:\EstudioFernandes" (
  echo [ERRO] Escolha a pasta do projeto, nao a pasta central.
  pause
  exit /b 1
)

if not exist "%KIT%" (
  echo [ERRO] Kit Spec-Driven nao encontrado:
  echo %KIT%
  echo.
  pause
  exit /b 1
)

for %%I in ("%DESTINO%") do set "PASTA_ATUAL=%%~nxI"

echo.
echo ===============================================
echo  Estudio Fernandes - Aplicar Spec-Driven
echo ===============================================
echo.
echo Pasta atual:
echo %DESTINO%
echo.

set /p "NOME_SPEC=Nome da spec/projeto [%PASTA_ATUAL%]: "
if not defined NOME_SPEC set "NOME_SPEC=%PASTA_ATUAL%"

set "NOME_SPEC=!NOME_SPEC: =-!"
if "!NOME_SPEC!"=="-" set "NOME_SPEC=%PASTA_ATUAL%"
if not defined NOME_SPEC set "NOME_SPEC=%PASTA_ATUAL%"

echo.
echo Aplicando kit...

copy /Y "%KIT%\CONTEXT.md" "%DESTINO%\CONTEXT.md" >nul
if errorlevel 1 goto erro

copy /Y "%KIT%\AGENTS.md" "%DESTINO%\AGENTS.md" >nul
if errorlevel 1 goto erro

if not exist "%DESTINO%\docs" mkdir "%DESTINO%\docs"
if not exist "%DESTINO%\specs" mkdir "%DESTINO%\specs"
if not exist "%DESTINO%\harness" mkdir "%DESTINO%\harness"
if not exist "%DESTINO%\.agents" mkdir "%DESTINO%\.agents"

robocopy "%KIT%\docs" "%DESTINO%\docs" /E >nul
if errorlevel 8 goto erro

robocopy "%KIT%\specs" "%DESTINO%\specs" /E >nul
if errorlevel 8 goto erro

robocopy "%KIT%\harness" "%DESTINO%\harness" /E >nul
if errorlevel 8 goto erro

if exist "%KIT%\.agents" (
  robocopy "%KIT%\.agents" "%DESTINO%\.agents" /E >nul
  if errorlevel 8 goto erro
)

if not exist "%DESTINO%\specs\!NOME_SPEC!" (
  robocopy "%DESTINO%\specs\_template" "%DESTINO%\specs\!NOME_SPEC!" /E >nul
  if errorlevel 8 goto erro
)

echo.
echo Pronto. Projeto preparado com Spec-Driven.
echo.
echo Arquivos criados/atualizados:
echo - CONTEXT.md
echo - AGENTS.md
echo - docs\agentes
echo - docs\adr
echo - harness
echo - .agents\skills
echo - specs\_template
echo - specs\!NOME_SPEC!
echo.
echo Agora peca ao agente:
echo Leia AGENTS.md, CONTEXT.md, specs\!NOME_SPEC! e harness\ antes de implementar.
echo Consulte harness\tools\README.md antes de instalar ou acionar ferramenta externa.
echo.
echo Se tiver seguranca, auth, banco, backend ou painel admin:
echo Use as skills Mantis em .agents\skills junto com harness\workflows\seguranca-mantis.md.
echo.
pause
exit /b 0

:erro
echo.
echo [ERRO] Nao consegui aplicar o kit nesta pasta.
echo Verifique permissoes e tente novamente.
echo.
pause
exit /b 1
