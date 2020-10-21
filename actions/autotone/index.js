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