![Architecture Diagram](arch.png)

## Running via Docker Compose

After cloning the repository, create a `.env` file in the `player/` directory. This file needs to include information for the following:

* How to access the LRS *from inside the container*
* The host port where the service can be accessed

For example:

```
HOST_PORT=63398
CONTENT_URL=http://localhost:63398/content
PLAYER_API_PROTOCOL=http
API_KEY="some API access key"
API_SECRET="an API access secret"
TOKEN_SECRET="some random string"
LRS_ENDPOINT="http://host.docker.internal:8081/20.1.x/lrs/default/"
LRS_USERNAME="dev-tools-xapi"
LRS_PASSWORD="dev-tools-xapi-password"
```

If no `PLAYER_API_PROTOCOL` is provided, it will default to `http`.

Then run,

    docker-compose up --build -d

To build and run the player service. Once run it will be available at the `HOST_PORT` mapped in the `.env` as above.