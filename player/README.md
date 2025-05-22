![Architecture Diagram](arch.png)

## Running via Docker Compose

After cloning the repository, create a `.env` file in the `player/` directory. This file needs to include information for the following:

* How to access the LRS *from inside the container*
* The host port where the service can be accessed

For example:
## Tables

| Variable  | Purpose | Suggested Value | Required? |
|:---------:|:-------:|:---------------:|:---------:|
| HOSTNAME  | The base URL or host address the player can be reached at, such as "localhost" |  No recommendation - but example is "localhost" | Yes|
| HOST_PORT | The port the player can be reached at on the home address | No recommendation - but example is "3398" | Yes |
| DB_HOST   | The name of the database the player uses | rdbms (This is the default database the player has in it's repo) | Yes|
| DB_NAME   | The name of the database being used by the player | catapult_player | Yes |
| DB_USERNAME | The default username for the database | catapult | Yes |
| DB_PASSWORD | The default password for the database | quartz | Yes |
| CONTENT_URL | The content URL is where the player serves up content. It is either the "PLAYER_STANDALONE_LAUNCH_URL_BASE/content" or "HOSTNAME/HOSTPORT/content") | Yes | 
| API_KEY     | This is the players access key or 'username' |  No recommendation - but example is "BasicKey" | Yes |
| API_SECRET  | This is the players password | No recommendation - but example is "BasicSecret" | Yes |
| TOKEN_SECRET | This is a secret token for the player when using JWT authentication |  No recommendation - but example is "BasicTokenSecret" | Yes |
| LRS_ENDPOINT | The endpoint to reach an LRS if using in conjuction with player | No recommendation | No - only used if using an LRS |
| LRS_USERNAME | The username to login to the LRS if used | No recommendation | No - only used if using an LRS |
| LRS_PASSWORD | The password to login to the LRS if used | No recommendation | No - only used if using an LRS |
| LRS_XAPI_VERSION | The LRS xAPI version ( if needed using an LRS) | No recommendation | No - only used if using an LRS |
| PLAYER_API_ROOT | The player API root, or location of the player to be used in networking with nginx | /cmi5/player | No - only used when using nginx to proxy |
| PLAYER_STANDALONE_LAUNCH_URL_BASE | The 'public friendly' location of the player. This is not the internal docker address, but the address that the player can be reached at from outside the network. | No recommendation - but example is "http://localhost/cmi5/player" | No - only used when using nginx to proxy |
| PLAYER_ALTERNATE_AUTH_HEADER | An optional header to check when processing auth from a client / browser request.  This is a rare configuration value and should only be used when when a deployment environment overrides the expected `Authorization` header.  The default auth header will still be used if the specified header value was not found in the request. | Empty, but for Platform One we use `cmi5Authorization` | No. |

Then run,

    docker-compose up --build -d

To build and run the player service. Once run it will be available at the `HOST_PORT` mapped in the `.env` as above.

## Running in a Docker container/network with NGINX server

When running the player as a service behind a docker network or NGINX server there are a few extra steps to take. The variables PLAYER_API_ROOT and PLAYER_STANDALONE_LAUNCH_URL_BASE need to be used. 

Also, be sure to add this to the nginx.conf:
```
location /cmi5/player {
    #
    proxy_pass https://"docker container name": :docker port"/cmi5/player;
}
```
This is the INTERNAL network address.

