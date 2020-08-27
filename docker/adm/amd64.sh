#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

. "$DIR/../variables.sh"
echo "APP $app"


cp "$DIR/../DockerFile" "$DIR/../../DockerFile"

if [ "$(uname -r | sed -n 's/.*\( *Microsoft *\).*/\1/ip')" = 'microsoft' ]; then
  powershell.exe "cd .. ; docker build -f ./DockerFile . -t elyspio/$app:amd64"
  powershell.exe "docker push elyspio/$app:amd64"
else
  cd .. && docker build -f ./DockerFile . -t elyspio/$app:amd64
  docker push elyspio/$app:amd64
fi

rm ../DockerFile
