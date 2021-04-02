#!/bin/sh

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

if [ RUN_MIGRATIONS ]; then
    node node_modules/.bin/knex migrate:latest
fi

# legacy-watch is used because it improves auto restart in our specific
# use case for development, mounted volume in container, see "Application
# isn't restarting" in the docs
exec nodemon --legacy-watch --watch index.js --watch knexfile.js --watch lib --watch plugins index.js
