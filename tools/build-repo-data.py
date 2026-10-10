"""Genera js/data/repo.js con el contenido del repositorio de clase (bioinformatica_26-27).

Uso: python tools/build-repo-data.py RUTA_AL_REPO

- Normaliza los finales de línea a LF (Git en Windows suele convertirlos a CRLF),
  salvo 13-crlf.sh, que en el servidor lleva CRLF a propósito.
- 1HVR.pdb no se incluye entero (190 KB): la app genera uno sintético con los
  mismos recuentos de líneas ATOM y HETATM.
"""
import json
import os
import sys

repo = sys.argv[1]
files = {}
for base, dirs, names in os.walk(repo):
    dirs[:] = [d for d in dirs if d != '.git']
    for n in names:
        if n == '1HVR.pdb' or n == '.gitattributes':
            continue
        p = os.path.join(base, n)
        rel = os.path.relpath(p, repo).replace(os.sep, '/')
        with open(p, 'rb') as f:
            data = f.read().decode('utf-8').replace('\r\n', '\n')
        if n == '13-crlf.sh':
            data = data.replace('\n', '\r\n')
        files[rel] = {'c': data, 'x': rel.endswith('.sh') or rel.endswith('.py')}

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'js', 'data', 'repo.js')
with open(out, 'w', encoding='utf-8', newline='\n') as f:
    f.write('// Generado por tools/build-repo-data.py a partir del repositorio de clase.\n')
    f.write('// https://github.com/hperez-ucam/bioinformatica_26-27\n')
    f.write('export const REPO_FILES = ' + json.dumps(files, ensure_ascii=False, indent=1) + ';\n')
print(len(files), 'ficheros;', 'con CRLF:', [k for k, v in files.items() if '\r' in v['c']])
