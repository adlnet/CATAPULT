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

FROM node:18
RUN apt-get update && apt-get install dumb-init
ENV NODE_ENV production
WORKDIR /usr/src/app
COPY --chown=node:node entrypoint.sh /usr/src/app
COPY --chown=node:node service /usr/src/app
COPY --chown=node:node migrations /usr/src/app/migrations

RUN mkdir -p /usr/src/app/var/content && chown node:node /usr/src/app/var/content

RUN npm ci --only=production
RUN npm install -g nodemon
USER node
ENTRYPOINT []
CMD ["dumb-init", "./entrypoint.sh"]
EXPOSE 3398/tcp
