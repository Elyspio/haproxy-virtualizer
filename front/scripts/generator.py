from os import listdir, path, unlink
from subprocess import call

# Constants
app = "generator.jar"
url = "https://repo1.maven.org/maven2/io/swagger/codegen/v3/swagger-codegen-cli/3.0.23/swagger-codegen-cli-3.0.23.jar"
format = "typescript-axios"

folder = path.dirname(__file__)


def ensure_typescript_file_content(p: str):
    files = list_file_recursively(p, lambda f: ".ts" in f)
    for file in files:
        file_path = path.join(p, file)
        with open(file_path, "r+") as f:
            s = f.read()
            if len(s) == 0:
                f.write("export {}")


def list_file_recursively(p: str, filtering: callable = None) -> list:
    files = listdir(p)

    for f in files:
        file_p = path.join(p, f)
        if path.isdir(file_p):
            files.remove(f)
            files += map(lambda x: path.join(f, x), list_file_recursively(file_p, filtering))
    if filtering is not None:
        files = list(filter(filtering, files))
    return files


def remove_non_typescript_files(p):
    generated_files = list_file_recursively(p, lambda f: ".ts" not in f)
    for file in generated_files:
        file_path = path.join(p, file)
        if path.isfile(file_path):
            unlink(file_path)


def generate(host: str, output: str):
    if app not in listdir(folder):
        print(f"Downloading swagger generator from {url})")
        call(f"wsl curl {url} -o {app}")

    call(f"java -jar {path.join(folder, app)} generate -i {host} -l {format} -o {output}")

    remove_non_typescript_files(output)
    ensure_typescript_file_content(output)
