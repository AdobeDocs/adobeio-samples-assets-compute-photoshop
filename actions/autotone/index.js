'use strict'

const { worker, SourceCorruptError } = require('@adobe/asset-compute-sdk')
const fs = require('fs').promises
const { downloadFile } = require('@adobe/httptransfer')
const { Files } = require('@adobe/aio-sdk')
const { stringParameters } = require('../utils')

exports.main = worker(async (source, rendition, params) => {
    // Example of how to throw a standard asset compute error
    // if e.g. the file is empty or broken.
    const stats = await fs.stat(source.path)
    if (stats.size === 0) {
        throw new SourceCorruptError('source file is empty')
    }

    console.log(JSON.stringify(source))
    const accessToken = params.auth && params.auth.accessToken

    const files = await Files.init()
    await files.copy(source.path, 'autotone/source.png', { localSrc: true })
    const downloadUrl = await files.generatePresignURL('autotone/source.png', { expiryInSeconds: 600})
    const uploadUrl = await files.generatePresignURL('autotone/rendition.png', { expiryInSeconds: 600, permissions: 'rwd' })
    
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

    await new Promise(r => setTimeout(r, 5000))

    await downloadFile(uploadUrl, rendition.path)
})