# Project Firefly Samples - AEM Assets Compute Worker with Photoshop APIs

This is a sample app that implements a custom Assets Compute Worker for AEM to generate cutout and automatically toned renditions by leveraging Photoshop APIs.

## Pre-requisites

You will need a project on Adobe Developer Console that is enabled with the following API services:
- I/O Management API
- Asset Compute
- I/O Events
- Adobe Photoshop API (Trial)

## Setup

- Populate the `.env` file in the project root and fill it with values as shown in `dot-env` file.

## Local Dev

- `aio app run` to start your local Dev server
- App will run on `localhost:9000` by default
- It allows you to test the rendition processing against your own uploaded images

## Deploy & Cleanup

- `aio app deploy` to build and deploy all actions on Runtime and static files to CDN
- `aio app undeploy` to undeploy the app

