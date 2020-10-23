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
 * API docs: https://adobedocs.github.io/photoshop-api-docs/#api-Lightroom-auto_tone_post
 */

'use strict'

const { worker, SourceCorruptError } = require('@adobe/asset-compute-sdk')
const fs = require('fs').promises
const { downloadFile } = require('@adobe/httptransfer')
const { Files } = require('@adobe/aio-sdk')
const { v4: uuid4 } = require('uuid')

exports.main = worker(async (source, rendition, params) => {
    // Example of how to throw a standard asset compute error
    // if e.g. the file is empty or broken.
    const stats = await fs.stat(source.path)
    if (stats.size === 0) {
        throw new SourceCorruptError('source file is empty')
    }

    const accessToken = params.auth && params.auth.accessToken
    const imageId = uuid4()

    const files = await Files.init()
    await files.copy(source.path, `${imageId}/source.png`, { localSrc: true })
    const downloadUrl = await files.generatePresignURL(`${imageId}/source.png`, { expiryInSeconds: 600})
    const uploadUrl = await files.generatePresignURL(`${imageId}/rendition.png`, { expiryInSeconds: 600, permissions: 'rwd' })

    const apiEndpoint = 'https://image.adobe.io/lrService/autoTone'

    const options = {
      inputs: {
        href: downloadUrl,
        storage: 'external'
      },
      outputs: [
        {
          href: uploadUrl,
          storage: 'azure'
        }
      ]
    }

    const reqHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'x-api-key': params.apiKey
    }

    // fetch content from external api endpoint
    const res = await fetch(apiEndpoint, {
      method: 'POST',
      headers: reqHeaders,
      body: JSON.stringify(options)
    })
    if (!res.ok) {
      throw new Error('request to ' + apiEndpoint + ' failed with status code ' + res.status)
    }
    const content = await res.json()

    if (!content._links || !content._links.self || !content._links.self.href) {
      throw new Error('Photoshop API did not return expected value.')
    }

    let processed = false
    while (!processed) {
      // sleep 1s before the enterring loop
      await new Promise(r => setTimeout(r, 1000))
      const statusRes = await fetch(content._links.self.href, { headers: reqHeaders })
      const statusContent = await statusRes.json()
      const outputs = statusContent.outputs
      if (outputs.length > 0 && outputs[0].status === 'succeeded') {
        processed = true
      }
    }

    await downloadFile(uploadUrl, rendition.path)

    // clean up files processing folder
    await files.delete(`${imageId}/`)
})