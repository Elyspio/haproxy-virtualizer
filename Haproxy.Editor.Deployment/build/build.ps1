$Env:DOCKER_TAG = $(Get-Date -Format "yyyy-MM-dd")


Set-Location $PSScriptRoot
docker compose build

$apiImage = "elyspio/haproxy-editor:$Env:DOCKER_TAG-api";
$frontImage = "elyspio/haproxy-editor:$Env:DOCKER_TAG-front";
$frontLatest = "elyspio/haproxy-editor:latest-front";
$apiLatest = "elyspio/haproxy-editor:latest-api";

docker image tag  $apiImage $apiLatest
docker image tag  $frontImage $frontLatest

docker push $apiImage
docker push $frontImage
docker push $apiLatest
docker push $frontLatest


Set-Location "P:/own/common/keycloak/kubernetes/apps/haproxy-editor"
./update.ps1 $Env:DOCKER_TAG

Pop-Location
Pop-Location
