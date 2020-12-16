/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/**
 * API docs: https://adobedocs.github.io/photoshop-api-docs/#api-Sensei-cutout
 */

'use strict'

const { worker, SourceCorruptError } = require('@adobe/asset-compute-sdk')
const fs = require('fs').promises
const { Files } = require('@adobe/aio-sdk')
const Photoshop = require('@adobe/aio-lib-photoshop-api')
const { v4: uuid4 } = require('uuid')

exports.main = worker(async (source, rendition, params) => {
    const stats = await fs.stat(source.path)
    if (stats.size === 0) {
        throw new SourceCorruptError('source file is empty')
    }

    const files = await Files.init()

    const accessToken = params.auth && params.auth.accessToken
    const orgId = params.auth && params.auth.orgId
    // init Photoshop SDK client
    const psClient = await Photoshop.init(orgId, params.apiKey, accessToken, files)

    // create a new directory in aio-lib-files with unique name
    const imageId = uuid4()
    const aioSourcePath = `${imageId}/source.png`
    const aioRenditionPath = `${imageId}/rendition.png`

    await files.copy(source.path, aioSourcePath, { localSrc: true })

    // call Photoshop API to do cutout processing, and poll status until it's successful
    const result = await psClient.createCutout(aioSourcePath, aioRenditionPath)
    await result.pollUntilDone(1000)

    // download the rendition to local AEM Assets destination
    await files.copy(aioRenditionPath, rendition.path, { localDest: true })

    // clean up files processing folder in aio-lib-files
    await files.delete(`${imageId}/`)
})