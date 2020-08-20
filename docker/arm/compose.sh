host="10.0.50.24"
user="ubuntu"

scp ./docker-compose.yml $user@$host:/apps/external-server/docker-compose.yml
ssh $user@$host "cd apps/external-server && docker-compose -d"
