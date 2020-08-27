DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

. "$DIR/variables.sh"

scp "$DIR/docker-compose.yml" "$sshConnection:/apps/$app/docker-compose.yml"
ssh $sshConnection "mkdir -p /apps/$app && cd /apps/$app && docker-compose up -d"
