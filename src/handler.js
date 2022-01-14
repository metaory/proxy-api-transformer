const transform = require('jsonpath-object-transform');

const config = require('../config')
const runner = require('./runner')
const helper = require('./helper')

const { log, clear } = console
// const log = (msg, ...extra) => console.log(JSON.stringify(msg, null, 2), extra)

const API_KEYS = { // TODO read from DB/Properties
  '00000000-0000-0000-0000-000000000000': 'PARTNER A',
  '11111111-1111-1111-1111-111111111111': 'PARTNER B',
  '22222222-2222-2222-2222-222222222222': 'PARTNER C',
}

module.exports.init = async (event) => {
  const { headers, queryStringParameters, httpMethod, pathParameters: {proxy} } = event
  log `+++++++++++++++++++++++++++++`
  debugger

  const data = JSON.parse(event.body)
  const crushedData = helper.crushObj(data)
  const root = { query: queryStringParameters || {}, body: crushedData || {}, headers, jwt: {}, partner: 'NA', userId: 'NA' }

  const key = `${httpMethod}:${proxy}`
  const cfg = { ...config[key] }
  console.log(headers)

  if (!Object.keys(cfg).length) return { statusCode: 404 }
  if (!Object.keys(API_KEYS).includes(headers['x-api-key'])) return { statusCode: 403 }
  if (!headers['x-user-id']) return { statusCode: 401 }

  root.partner = API_KEYS[headers['x-api-key']]
  root.userId = headers['x-user-id']
  root.jwt = helper.decodeJwt(headers)

  log({key, proxy},cfg, {root})

  // Default single job syntax handle
  if (!cfg.jobs) { cfg.jobs = [ cfg ] }

  // Job Runner mode
  const runnerFlow = (cfg.mode || 'PARALLEL').toLowerCase()
  log({runnerFlow})

  // Run all jobs
  let out, status
  try {
    const res = await runner[runnerFlow](cfg.jobs, {root, data, headers})
    out = { ok: res.data.ok || true, ...res.data }
    status = res.status
  }
  catch (err) {
    console.log('ERR:message', err.message)
    const { response } = err
    console.log('ERR:response', err.response)
    return {
      headers: { 'Access-Control-Allow-Origin': '*', },
      statusCode: response ? response.status : 500,
      body: response ? response.statusText : err.message,
    }
  }

  // Transform final result
  if (cfg.transform && status === 200) {
    log('Running Transform', cfg.transform)
    switch (typeof cfg.transform) {
      case 'object': log('Running Object Transform')
        out = transform(out, cfg.transform);
        break
      case 'function': log('Running Function Transform')
        out = cfg.transform({...root, ...out})
        break
    }
  }

  // Callback
  if (cfg.callback && typeof cfg.callback === 'function') {
    cfg.callback(out)
  } 

  return {
    headers: { 'Access-Control-Allow-Origin': '*', },
    statusCode: status,
    body: JSON.stringify(out, null, 2)
  }
}
