@echo off
rem Doble clic aqui para compilar Patitas firmado para Google Play (.aab).
rem La primera vez crea la llave y te pide inventar su contrasena; despues solo la pide (no se guarda).
title Patitas - compilando para Google Play
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0herramientas\compilar-android.ps1" -Release
echo.
if errorlevel 1 (
  echo *** Algo fallo. Copia el mensaje de arriba y pegalo en el chat. ***
) else (
  echo *** Terminado. Ya puedes cerrar esta ventana y avisar en el chat. ***
)
echo.
pause
