import os

root = r"c:\Users\jonat\OneDrive - IM3 Brasil\utils\sisTOPOGRAFIA"
exclude_dirs = {"node_modules", ".git", "coverage", ".venv", "__pycache__"}

def should_exclude(name):
    return name in exclude_dirs or name.startswith("__pycache__")

for dirpath, dirnames, filenames in os.walk(root):
    # Remove excluded dirs in-place so os.walk skips them
    dirnames[:] = [d for d in dirnames if not should_exclude(d)]
    
    level = dirpath.replace(root, "").count(os.sep)
    indent = "  " * level
    folder_name = os.path.basename(dirpath) or os.path.basename(root)
    if level > 0:
        print(f"{indent}|-- {folder_name}/")
    else:
        print(f"{folder_name}/")
    sub_indent = "  " * (level + 1)
    for f in filenames:
        if f == "list_tree.py":
            continue
        print(f"{sub_indent}|-- {f}")