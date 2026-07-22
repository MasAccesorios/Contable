import sys

# Load current app.js
with open("js/app.js", "r", encoding="utf-8") as f:
    current_app_lines = f.readlines()

# Extract lines 1 to 183
if len(current_app_lines) > 184:
    # Just in case, try to find the comment
    idx = 0
    for i, line in enumerate(current_app_lines):
        if "Mantén todo el resto de tus funciones" in line:
            idx = i
            break
    if idx > 0:
        base_lines = current_app_lines[:idx]
    else:
        base_lines = current_app_lines[:183]
else:
    base_lines = current_app_lines[:183]

# Load backup
with open("js/app_backup.js", "r", encoding="utf-16le") as f:
    backup_lines = f.readlines()

# Find handleGlobalSearch in backup
start_idx = -1
for i, line in enumerate(backup_lines):
    if "handleGlobalSearch(query) {" in line:
        start_idx = i
        break

if start_idx == -1:
    print("Error: Could not find handleGlobalSearch in backup")
    sys.exit(1)

# Extract from handleGlobalSearch to the end
rest_lines = backup_lines[start_idx:]

# Now we need to replace the NAVIGATION section with the new SPA logic
# Find "async navigateTo(page, param = null) {"
nav_start_idx = -1
for i, line in enumerate(rest_lines):
    if "async navigateTo(page, param = null) {" in line:
        nav_start_idx = i
        break

# The end of navigateTo is a bit tricky, but we know what the new one looks like
# Let's just find the exact block and replace it.
# Wait, let's just do a string replacement on the whole rest_lines text.
rest_text = "".join(rest_lines)

old_nav_code = """    async navigateTo(page, param = null) {
        // Skip auth check for cliente_detail as it inherits from clientes
        const authPage = page === 'cliente_detail' ? 'clientes' : page;
        if (!Auth.canAccess(authPage)) {
            console.warn(`Intento de acceso denegado a la página: ${page}`);
            showToast('No tienes permisos para acceder a esta sección.', 'danger');
            if (this.currentPage !== 'dashboard') {
                this.navigateTo('dashboard');
            }
            return;
        }

        this.currentPage = page;

        // Update sidebar active state"""

new_nav_code = """    navigateBack() {
        if (this.navigationStack.length > 0) {
            const previous = this.navigationStack.pop();
            // Evitamos meter esta navegación "hacia atrás" en el stack usando un flag privado
            this._isNavigatingBack = true;
            this.navigateTo(previous.page, previous.param);
        } else {
            this.navigateTo('dashboard');
        }
    },

    async navigateTo(page, param = null) {
        // Skip auth check for cliente_detail as it inherits from clientes
        const authPage = page === 'cliente_detail' ? 'clientes' : page;
        if (!Auth.canAccess(authPage)) {
            console.warn(`Intento de acceso denegado a la página: ${page}`);
            showToast('No tienes permisos para acceder a esta sección.', 'danger');
            if (this.currentPage !== 'dashboard') {
                this.navigateTo('dashboard');
            }
            return;
        }

        // Push current page to stack if we are moving forward and not clicking the same menu
        if (!this._isNavigatingBack && this.currentPage !== page && this.currentPage) {
            // Avoid pushing duplicate back-to-back history
            if (this.navigationStack.length === 0 || this.navigationStack[this.navigationStack.length - 1].page !== this.currentPage) {
                this.navigationStack.push({ page: this.currentPage, param: this.currentParam });
            }
        }
        this._isNavigatingBack = false;

        this.currentPage = page;
        this.currentParam = param;

        // Update sidebar active state"""

if old_nav_code in rest_text:
    rest_text = rest_text.replace(old_nav_code, new_nav_code)
else:
    print("WARNING: Could not find the old navigation code exactly. Reverting to regex.")
    import re
    # We will insert navigateBack just before async navigateTo
    rest_text = re.sub(
        r'(\s*)async navigateTo\(page, param = null\) \{',
        r'\1navigateBack() {\1    if (this.navigationStack.length > 0) {\1        const previous = this.navigationStack.pop();\1        this._isNavigatingBack = true;\1        this.navigateTo(previous.page, previous.param);\1    } else {\1        this.navigateTo(\'dashboard\');\1    }\1}\1\1async navigateTo(page, param = null) {',
        rest_text
    )
    # And we also need to add the push stack logic inside navigateTo
    # Let's hope the direct replace works first.

final_content = "".join(base_lines) + "\n" + rest_text

# Remove any possible BOM from the final text
if final_content.startswith('\ufeff'):
    final_content = final_content[1:]

with open("js/app_merged.js", "w", encoding="utf-8") as f:
    f.write(final_content)

print("Merge complete. Result saved to js/app_merged.js")
