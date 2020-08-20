#!/bin/bash
host="10.0.50.24"
user="ubuntu"
app_name="external-server"
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"


echo "dir $DIR"

cd $DIR


ssh $user@$host "rm -rdf ~/docker-building"

ssh $user@$host "mkdir -p ~/docker-building/front"
scp -r ../../front/build $user@$host:~/docker-building/front/build

ssh $user@$host "mkdir -p ~/docker-building/back"
scp -r ../../back/build $user@$host:~/docker-building/back/build
scp ../../back/package.json $user@$host:~/docker-building/back/package.json

scp ../DockerFile $user@$host:~/docker-building/DockerFile

ssh $user@$host "cd ~/docker-building && docker build -f ./DockerFile . -t elyspio/$app_name:arm64"
ssh $user@$host "docker push elyspio/$app_name:arm64"


scp ./docker-compose.yml $user@$host:/apps/$app_name/docker-compose.yml
ssh $user@$host "cd /apps/$app_name/ && docker-compose up -d"

