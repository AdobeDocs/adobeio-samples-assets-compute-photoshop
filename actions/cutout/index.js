'use strict'

const { worker, SourceCorruptError } = require('@adobe/asset-compute-sdk')
const fs = require('fs').promises
const { downloadFile } = require('@adobe/httptransfer')
const { Files } = require('@adobe/aio-sdk')

exports.main = worker(async (source, rendition, params) => {
    // Example of how to throw a standard asset compute error
    // if e.g. the file is empty or broken.
    const stats = await fs.stat(source.path)
    if (stats.size === 0) {
        throw new SourceCorruptError('source file is empty')
    }

    console.log(source.path)
    let accessToken = params.auth && params.auth.accessToken

    const files = await Files.init()
    await files.copy(source.path, 'cutout/file.png', { localSrc: true })
    const downloadUrl = await files.generatePresignURL('cutout/file.png', { expiryInSeconds: 600})
    const uploadUrl = await files.generatePresignURL('cutout/rendition.png', { expiryInSeconds: 600, permissions: 'rwd' })
    
    const apiEndpoint = 'https://image.adobe.io/sensei/cutout'

    const options = {
      input: {
        href: downloadUrl,
        storage: 'external'
      },
      output: {
        href: uploadUrl,
        storage: 'azure',
        mask:{
          format: 'soft'
        }
      }
    }

    // fetch content from external api endpoint
    const res = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'x-api-key': params.apiKey
      },
      body: JSON.stringify(options)
    })
    if (!res.ok) {
      throw new Error('request to ' + apiEndpoint + ' failed with status code ' + res.status)
    }
    const content = await res.json()

    await new Promise(r => setTimeout(r, 5000))

    await downloadFile(uploadUrl, rendition.path)
})