#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
. "$DIR/variables.sh"

echo "dir $DIR"
cd $DIR


ssh $sshConnection "rm -rdf ~/docker-building"

ssh $sshConnection "mkdir -p ~/docker-building/front"
scp -r ../../front/build $sshConnection:~/docker-building/front/build

ssh $sshConnection "mkdir -p ~/docker-building/back"
scp -r ../../back/build $sshConnection:~/docker-building/back/build
scp ../../back/package.json $sshConnection:~/docker-building/back/package.json

scp ../DockerFile $sshConnection:~/docker-building/DockerFile

ssh $sshConnection "cd ~/docker-building && docker build -f ./DockerFile . -t elyspio/$app:arm64"
ssh $sshConnection "docker push elyspio/$app:arm64"
