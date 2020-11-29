from os import path

from generator import folder, generate

apis = [
    {"url": "http://localhost:4000/swagger/swagger.json", "path": path.join(folder, "..", "src", "core",  "apis", "back")}
]

if __name__ == '__main__':
    for api in apis:
        generate(api.get("url"), api.get("path"))
