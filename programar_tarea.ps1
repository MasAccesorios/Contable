# Definir la ruta del script de importacion
$scriptPath = "d:\Contable\importar_alegra.py"

# Crear la accion: ejecutar python launcher con el script como argumento
$action = New-ScheduledTaskAction -Execute "py" -Argument $scriptPath

# Crear el disparador: diario a las 2:00 AM
$trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM

# Configurar los ajustes de la tarea
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

# Registrar la tarea programada en Windows
Register-ScheduledTask -TaskName "Sincronizacion_Alegra_Antigravity" -Action $action -Trigger $trigger -Settings $settings -Description "Sincroniza automaticamente todos los modulos desde Alegra a Antigravity diariamente en la madrugada" -Force

Write-Host "Tarea Programada 'Sincronizacion_Alegra_Antigravity' registrada correctamente para correr diariamente a las 2:00 AM."
