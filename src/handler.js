// const {JSONPath} = require('jsonpath-plus');
const jwt = require('jsonwebtoken')
const transform = require('jsonpath-object-transform');

const config = require('../config')
const runner = require('./runner')
const { log, clear } = console
// const log = (msg, ...extra) => console.log(JSON.stringify(msg, null, 2), extra)

module.exports.init = async (event, ctx) => {
  const { headers, queryStringParameters, httpMethod, pathParameters: {proxy} } = event

  const data = JSON.parse(event.body)
  const root = { query: queryStringParameters, body: data, jwt: {} }

  const key = `${httpMethod}:${proxy}`
  const cfg = { ...config[key] || { path: proxy, method: httpMethod } }

  // Set $.jwt.* context
  if (headers['Authorization']) {
    const [,token] = headers['Authorization'].split(' ')
    const decoded = jwt.decode(token,{complete: true}) || {}
    root.jwt = decoded.payload || {}
  }

  log({key, proxy},cfg, {root})

  // Default single job syntax handle
  if (!cfg.jobs) { cfg.jobs = [ cfg ] }

  // Job Runner mode
  const runnerFlow = (cfg.mode || 'PARALLEL').toLowerCase()
  log({runnerFlow})

  // Run all jobs
  let out
  try {
    out = await runner[runnerFlow](cfg.jobs, {root, data, headers})
  }
  catch (err) {
    console.error('ERR', err)
    const { res } = err // TODO
    return {
      headers: { 'Access-Control-Allow-Origin': '*', },
      statusCode: err.statusCode,
      body: err.statusMessage
    }
  }

  // Transform final result
  if (cfg.transform) {
    log('Running Transform', cfg.transform)
    switch (typeof cfg.transform) {
      case 'object': log('Running Object Transform')
        out = transform(out, cfg.transform);
        break
      case 'function': log('Running Function Transform')
        out = cfg.transform(out)
        break
    }
  }

  // Callback
  if (cfg.callback && typeof cfg.callback === 'function') {
    cfg.callback(out)
  } 

  return {
    headers: { 'Access-Control-Allow-Origin': '*', },
    statusCode: 200,
    body: JSON.stringify(out, null, 2)
  }
}
