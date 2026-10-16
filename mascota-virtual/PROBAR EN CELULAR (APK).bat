@echo off
rem Doble clic aqui para instalar Patitas en tu celular (APK de prueba, con herramientas de prueba).
rem Se instala aparte de la version de Play (com.souldevelopercompany.patitas.prueba).
title Patitas - APK de prueba
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0herramientas\compilar-android.ps1"
echo.
if errorlevel 1 (
  echo *** Algo fallo. Copia el mensaje de arriba y pegalo en el chat. ***
) else (
  echo *** Terminado. Ya puedes cerrar esta ventana y avisar en el chat. ***
)
echo.
pause
