from os import path

from generator import folder, generate

apis = [
    {"url": "https://elyspio.fr/authentication/swagger/swagger.json", "path": path.join(folder, "..", "..", "back", "src", "core", "apis", "authentication")},
]

if __name__ == '__main__':
    for api in apis:
        generate(api.get("url"), api.get("path"))
