# Compila la app de Android de Patitas (copia adaptada del compilador de Mi Zoológico).
#
# Uso (desde la carpeta mascota-virtual, en PowerShell):
#   .\herramientas\compilar-android.ps1            -> APK de prueba (se instala aparte como "com.souldevelopercompany.patitas.prueba")
#   .\herramientas\compilar-android.ps1 -Release   -> .aab firmado para subir a Google Play
#       Con -Release la versión sube sola: 1.0.0 -> 1.1.0. Usa -Parche para 1.0.0 -> 1.0.1, o -SinSubir para dejarla igual.
#       La versión de tienda se compila SIN las "Herramientas de prueba" (VITE_TIENDA=1).
#
# La primera vez con -Release crea la llave de subida (Documents\llaves\patitas-subida.jks) y te pide
# que inventes su contraseña. La contraseña nunca se guarda: se pide en una ventanita en cada compilación.
#
# Necesita: Node.js, Java 21 y el SDK de Android (sirve el que trae Unity), igual que Mi Zoológico.
param([switch]$Release, [switch]$Parche, [switch]$SinSubir)

# Java escribe avisos por la salida de errores: no los tratamos como fallos (se revisa $LASTEXITCODE)
$ErrorActionPreference = 'Continue'
$proyecto = Split-Path -Parent $PSScriptRoot
$herramientas = "$env:USERPROFILE\Documents\herramientas-android"
$llave = "$env:USERPROFILE\Documents\llaves\patitas-subida.jks"
$alias = 'patitas'
$consola = 'https://play.google.com/console/u/0/developers/5099628434218070597/app/4971985063553773767/tracks/internal-testing'

# Java 21 portátil (si no existe, usa el JAVA_HOME que ya tengas)
$jdk = Get-ChildItem $herramientas -Directory -Filter 'jdk-21*' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($jdk) { $env:JAVA_HOME = $jdk.FullName }
if (-not $env:JAVA_HOME) { throw 'No encuentro Java 21: instálalo o pon JAVA_HOME.' }
$keytool = "$env:JAVA_HOME\bin\keytool.exe"

# Java en Windows falla con carpetas temporales de ruta muy larga: usamos una corta
$tmp = "$herramientas\tmp"
New-Item -ItemType Directory -Force $tmp -ErrorAction Stop | Out-Null
$corta = (New-Object -ComObject Scripting.FileSystemObject).GetFolder($tmp).ShortPath
$env:TMP = $corta; $env:TEMP = $corta
$env:JAVA_TOOL_OPTIONS = "-Djdk.net.unixdomain.tmpdir=$corta -Djava.io.tmpdir=$corta"

# SDK de Android: si falta android\local.properties, se usa ANDROID_HOME o el SDK que trae Unity
$local = Join-Path $proyecto 'android\local.properties'
if (-not (Test-Path $local)) {
    $sdk = $env:ANDROID_HOME
    if (-not $sdk) {
        $sdk = Get-ChildItem "$env:ProgramFiles\Unity\Hub\Editor\*\Editor\Data\PlaybackEngines\AndroidPlayer\SDK" -Directory -ErrorAction SilentlyContinue |
            Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
    }
    if (-not $sdk) { throw 'No encuentro el SDK de Android: instala el módulo Android en Unity Hub o pon ANDROID_HOME.' }
    [IO.File]::WriteAllText($local, "sdk.dir=$($sdk.Replace('\', '/').Replace(':', '\:'))`n")
    Write-Host "SDK de Android: $sdk" -ForegroundColor Cyan
}

# Ventanita para la contraseña (sirve aunque no haya consola). Con -Confirmar pide escribirla dos veces.
function Pedir-Clave([string]$aviso, [switch]$Confirmar) {
    Add-Type -AssemblyName System.Windows.Forms, System.Drawing
    $alto = if ($Confirmar) { 250 } else { 190 }
    $f = New-Object Windows.Forms.Form -Property @{ Text = 'Patitas - firma para Google Play'; Width = 440; Height = $alto; StartPosition = 'CenterScreen'; TopMost = $true; FormBorderStyle = 'FixedDialog'; MaximizeBox = $false; MinimizeBox = $false }
    $l = New-Object Windows.Forms.Label -Property @{ Text = $aviso; Left = 15; Top = 12; Width = 400; Height = 40 }
    $t = New-Object Windows.Forms.TextBox -Property @{ Left = 15; Top = 55; Width = 395; UseSystemPasswordChar = $true }
    $f.Controls.AddRange(@($l, $t))
    $y = 95
    if ($Confirmar) {
        $l2 = New-Object Windows.Forms.Label -Property @{ Text = 'Repítela:'; Left = 15; Top = 90; Width = 400 }
        $t2 = New-Object Windows.Forms.TextBox -Property @{ Left = 15; Top = 112; Width = 395; UseSystemPasswordChar = $true }
        $f.Controls.AddRange(@($l2, $t2))
        $y = 155
    }
    $ok = New-Object Windows.Forms.Button -Property @{ Text = 'Compilar'; Left = 230; Top = $y; Width = 85; DialogResult = 'OK' }
    $no = New-Object Windows.Forms.Button -Property @{ Text = 'Cancelar'; Left = 325; Top = $y; Width = 85; DialogResult = 'Cancel' }
    $f.Controls.AddRange(@($ok, $no)); $f.AcceptButton = $ok; $f.CancelButton = $no
    $f.Add_Shown({ $f.Activate(); $t.Focus() })
    if ($f.ShowDialog() -ne 'OK') { return $null }
    if ($Confirmar -and $t.Text -ne $t2.Text) { return '' }
    return $t.Text
}

# Antes de pedir la contraseña: tipos, tests y configuración (herramientas/revisar.mjs)
if ($Release) {
    Push-Location $proyecto
    node herramientas/revisar.mjs
    $codigo = $LASTEXITCODE
    Pop-Location
    if ($codigo -ne 0) { throw 'La revisión encontró problemas (arriba). Corrígelos antes de compilar para Play.' }
}

$propiedades = Join-Path $proyecto 'android\keystore.properties'
if ($Release -and -not $env:PATITAS_CLAVE) {
    if (-not (Test-Path $llave)) {
        # Primera vez: crear la llave de subida de Patitas
        New-Item -ItemType Directory -Force (Split-Path $llave) | Out-Null
        $aviso = 'Primera vez: inventa una contraseña para la llave de firma de Patitas (mínimo 6 caracteres). ¡Apúntala!'
        for ($intento = 1; $intento -le 3; $intento++) {
            $clave = Pedir-Clave $aviso -Confirmar
            if ($null -eq $clave) { throw 'Compilación cancelada.' }
            if ($clave.Length -ge 6) { break }
            $aviso = "Las contraseñas no coinciden o tienen menos de 6 caracteres (intento $intento de 3):"
            $clave = $null
        }
        if (-not $clave) { throw 'No se creó la llave.' }
        & $keytool -genkeypair -keystore $llave -alias $alias -keyalg RSA -keysize 2048 -validity 10000 `
            -storepass $clave -keypass $clave -dname 'CN=SoulDeveloperCompany, OU=Patitas, O=SoulDeveloperCompany' *> $null
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path $llave)) { throw 'No se pudo crear la llave.' }
        $env:PATITAS_CLAVE = $clave
        Remove-Variable clave
        Write-Host "Llave creada: $llave" -ForegroundColor Green
        Write-Host 'Guarda una copia de ese archivo y su contraseña (por ejemplo en tu Drive).' -ForegroundColor Yellow
    } else {
        $aviso = 'Escribe la contraseña de tu llave de firma (patitas-subida.jks):'
        for ($intento = 1; $intento -le 3; $intento++) {
            $clave = Pedir-Clave $aviso
            if ($null -eq $clave) { throw 'Compilación cancelada.' }
            & $keytool -list -keystore $llave -storepass $clave *> $null
            if ($LASTEXITCODE -eq 0) { $env:PATITAS_CLAVE = $clave; break }
            $aviso = "Esa contraseña no abre la llave (intento $intento de 3). Vuelve a escribirla:"
        }
        Remove-Variable clave -ErrorAction SilentlyContinue
        if (-not $env:PATITAS_CLAVE) { throw 'La contraseña no coincide con la llave.' }
        Write-Host 'Contraseña correcta.' -ForegroundColor Green
    }
    if (-not (Test-Path $propiedades)) {
        $contenido = "# Llave de subida a Google Play (este archivo no se sube a GitHub).`n" +
            "# La contraseña no se guarda aquí: compilar-android.ps1 -Release la pide al compilar.`n" +
            "storeFile=$($llave.Replace('\', '/'))`nkeyAlias=$alias`n"
        [IO.File]::WriteAllText($propiedades, $contenido)
    }
}

# 0) Subir la versión (versionName de android\app\build.gradle). Si la compilación falla, se deja como estaba.
$gradle = Join-Path $proyecto 'android\app\build.gradle'
$gradleAntes = [IO.File]::ReadAllText($gradle)
if ($Release -and -not $SinSubir) {
    $m = [regex]::Match($gradleAntes, 'versionName "(\d+)\.(\d+)\.(\d+)"')
    if (-not $m.Success) { throw 'No encuentro versionName "x.y.z" en build.gradle' }
    $may = [int]$m.Groups[1].Value; $men = [int]$m.Groups[2].Value; $par = [int]$m.Groups[3].Value
    if ($Parche) { $par++ } else { $men++; $par = 0 }
    $nueva = "$may.$men.$par"
    [IO.File]::WriteAllText($gradle, $gradleAntes.Replace($m.Value, "versionName `"$nueva`""))
    Write-Host "Versión: $($m.Groups[1].Value).$($m.Groups[2].Value).$($m.Groups[3].Value) -> $nueva" -ForegroundColor Cyan
}

# 1) Compilar el juego y copiarlo a la app (la versión de tienda va sin herramientas de prueba)
Push-Location $proyecto
if (-not (Test-Path 'node_modules')) { npm ci }
if ($Release) { $env:VITE_TIENDA = '1' } else { Remove-Item Env:VITE_TIENDA -ErrorAction SilentlyContinue }
npm run android:sync
$codigo = $LASTEXITCODE
Remove-Item Env:VITE_TIENDA -ErrorAction SilentlyContinue
if ($codigo -ne 0) { Pop-Location; [IO.File]::WriteAllText($gradle, $gradleAntes); throw 'Falló la copia del juego a Android.' }

# 2) Compilar
Push-Location android
if ($Release) {
    .\gradlew.bat bundleRelease --no-daemon
    $salida = 'android\app\build\outputs\bundle\release\app-release.aab'
} else {
    .\gradlew.bat assembleDebug --no-daemon
    $salida = 'android\app\build\outputs\apk\debug\app-debug.apk'
}
$codigo = $LASTEXITCODE
Pop-Location; Pop-Location
Remove-Item Env:PATITAS_CLAVE -ErrorAction SilentlyContinue
if ($codigo -ne 0) { [IO.File]::WriteAllText($gradle, $gradleAntes); throw 'Falló la compilación (la versión quedó como estaba).' }
if ($Release) {
    $firmado = & "$env:JAVA_HOME\bin\jarsigner.exe" -verify (Join-Path $proyecto $salida) 2>&1 | Select-String 'jar verified'
    if ($firmado) { Write-Host 'El .aab está firmado.' -ForegroundColor Green }
    else { Write-Host 'Ojo: el .aab NO está firmado (falta android\keystore.properties).' -ForegroundColor Yellow }
}
Write-Host "`nListo: $salida" -ForegroundColor Green
if ($Release -and $firmado) {
    # Deja todo listo para subirlo: la carpeta con el archivo y la página de Play Console
    Start-Process explorer.exe -ArgumentList "/select,`"$(Join-Path $proyecto $salida)`""
    Start-Process $consola
    Write-Host 'Abrí la carpeta y Play Console: pulsa «Crear nueva versión» y arrastra app-release.aab.' -ForegroundColor Green
}
