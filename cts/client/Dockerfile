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
COPY package.json package-lock.json ./
RUN npm ci
ENV PATH /usr/src/app/node_modules/.bin:$PATH

WORKDIR /usr/src/app/src
COPY --chown=node:node . /usr/src/app/src
USER node
CMD ["npm", "run", "serve"]
EXPOSE 3396/tcp
