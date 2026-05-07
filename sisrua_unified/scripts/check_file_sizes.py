import os

def count_lines(filepath):
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return sum(1 for line in f)
    except:
        return 0

results = []
for root, dirs, files in os.walk("sisrua_unified/server"):
    for file in files:
        if file.endswith((".ts", ".js")):
            path = os.path.join(root, file)
            lines = count_lines(path)
            if lines > 500:
                results.append((path, lines))

results.sort(key=lambda x: x[1], reverse=True)
for path, lines in results:
    print(f"{path} : {lines}")
