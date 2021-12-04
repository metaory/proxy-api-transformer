const jwt = require('jsonwebtoken')
const transform = require('jsonpath-object-transform');

const config = require('../../config')
const runner = require('../runner')
const { log, clear } = console

module.exports.init = async (event, ctx) => {
  const { headers, queryStringParameters, httpMethod, pathParameters: {proxy} } = event

  const data = JSON.parse(event.body)
  const root = { query: queryStringParameters, body: data, jwt: {} }

  const key = `${httpMethod}:${proxy}`
  const cfg = { ...config[key] || { path: proxy, method: httpMethod } }

  if (headers['Authorization']) {
    const [,token] = headers['Authorization'].split(' ')
    root.jwt = jwt.decode(token,{complete: true}).payload
  }

  log({key, proxy},cfg, {root})

  if (!cfg.jobs) { cfg.jobs = [ cfg ] }

  const runnerFlow = (cfg.mode || 'PARALLEL').toLowerCase()
  log({runnerFlow})

  let out
  out = await runner[runnerFlow](cfg.jobs, {root, data, headers})

  if (cfg.transform) {
    log('Running Transform', cfg.transform)
    switch (typeof cfg.transform) {
      case 'object':
        log('Running Object Transform')
        out = transform(out, cfg.transform);
        break
      case 'function':
        log('Running Function Transform')
        out = cfg.transform(out)
        break
    }
  }

  return {
    headers: { 'Access-Control-Allow-Origin': '*', },
    statusCode: 200,
    body: JSON.stringify(out, null, 2)
  }
}

