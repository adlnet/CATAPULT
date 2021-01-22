#!/bin/bash

# Copyright 2021 Rustici Software
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

echo "Creating Catapult CTS Database: '$DATABASE_NAME', Player Database: '$PLAYER_DATABASE_NAME' and User: '$DATABASE_USER'";
mysql --user=root --password=$MYSQL_ROOT_PASSWORD << END

CREATE DATABASE IF NOT EXISTS $DATABASE_NAME;
CREATE DATABASE IF NOT EXISTS $PLAYER_DATABASE_NAME;

CREATE USER '$DATABASE_USER'@'%' IDENTIFIED BY '$DATABASE_USER_PASSWORD';
GRANT ALL PRIVILEGES ON $DATABASE_NAME.* TO '$DATABASE_USER'@'%';
GRANT ALL PRIVILEGES ON $PLAYER_DATABASE_NAME.* TO '$DATABASE_USER'@'%';
FLUSH PRIVILEGES;

END
