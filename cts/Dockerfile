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

FROM node:14.17.3-alpine AS client-build
WORKDIR /usr/src/app
COPY --chown=node:node client /usr/src/app
RUN npm ci
RUN npm run build

FROM node:14.17.3-alpine
RUN apk add dumb-init
ENV NODE_ENV production
WORKDIR /usr/src/app
COPY --chown=node:node entrypoint.sh /usr/src/app
COPY --chown=node:node service /usr/src/app
COPY --chown=node:node migrations /usr/src/app/migrations
COPY --chown=node:node --from=client-build /usr/src/app/dist /usr/src/app/client
RUN rm package-lock.json && npm install && npm ci --only=production
RUN npm install -g nodemon
USER node
ENTRYPOINT []
CMD ["dumb-init", "./entrypoint.sh"]
EXPOSE 3399/tcp
