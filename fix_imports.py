import os
import re

modules_dir = r"d:\Contable\js\modules"

for root, _, files in os.walk(modules_dir):
    for f in files:
        if f.endswith('.js'):
            filepath = os.path.join(root, f)
            # Calculate depth from js/modules
            rel_path = os.path.relpath(root, modules_dir)
            
            if rel_path == '.':
                # File is in js/modules/
                db_import = "'../core/db.js'"
                crud_import = "'../shared/crud.js'"
            else:
                # File is in js/modules/subfolder/ (or deeper)
                depth = len(rel_path.split(os.sep))
                prefix = '../' * (depth + 1) # +1 to get out of modules/
                db_import = f"'{prefix}core/db.js'"
                crud_import = f"'{prefix}shared/crud.js'"

            try:
                with open(filepath, 'r', encoding='utf-8') as file:
                    content = file.read()
                encoding_used = 'utf-8'
            except UnicodeDecodeError:
                with open(filepath, 'r', encoding='latin-1') as file:
                    content = file.read()
                encoding_used = 'latin-1'
            
            # Replace old imports
            # DB import could be from '../db.js' or '../../db.js'
            content = re.sub(r"'[^']*db\.js'", db_import, content)
            # CRUD import was replaced by powershell earlier to 'shared/crud.js' blindly, let's fix it
            content = re.sub(r"'[^']*shared/crud\.js'", crud_import, content)

            with open(filepath, 'w', encoding=encoding_used) as file:
                file.write(content)

print("Imports updated!")
