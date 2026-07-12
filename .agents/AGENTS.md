# Reglas de Trabajo para Contable

## Sincronización Automática con GitHub
* **Regla:** Cada vez que realices una modificación en los archivos de código (`js`, `css`, `html`, etc.) y la verifiques, debes guardar los cambios en Git y subirlos (push) de forma automática al repositorio configurado.
* **Comandos obligatorios tras cambios:**
  ```powershell
  git add .
  git commit -m "Descripción clara del cambio"
  git push origin main
  ```
* **Objetivo:** Mantener actualizada la versión web alojada en GitHub Pages (`https://masaccesorios.github.io/Contable/`) en tiempo real.
