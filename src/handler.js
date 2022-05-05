const transform = require('jsonpath-object-transform');

const config = require('../config')
const runner = require('./runner')
const helper = require('./helper')
const { log, clear } = console

const API_KEYS = { // TODO read from DB/Properties
  '00000000-0000-0000-0000-000000000000': 'PARTNER_A',
  '11111111-1111-1111-1111-111111111111': 'PARTNER_B',
  '22222222-2222-2222-2222-222222222222': 'PARTNER_C',
}

exports.handler = async (event) => {
  log(JSON.stringify({ event }))
  const { headers, body, queryStringParameters, requestContext: { http: { method, userAgent } }, pathParameters: { proxy } } = event

  // CORS
  if (method === 'OPTIONS') {
    return { headers: { 'Access-Control-Allow-Origin': '*' }, statusCode: 200 }
  }

  let data
  if (body) try { data = JSON.parse(body) } catch (error) { data = {} }

  const crushedData = helper.crushObj(data)
  const root = { query: queryStringParameters || {}, body: crushedData || {}, headers, jwt: { userFromPartner: 'NA' }, clientId, partner: 'NA', userId: 'NA' }

  const key = `${method}:${proxy}`
  const cfg = { ...config[key] }

  const isNotFound = !Object.keys(cfg).length
  const isApiKeyValid = Object.keys(API_KEYS).includes(headers['x-api-key'])
  const isUserIdValid = !!headers['x-user-id']
  const isBearer = root.isBearer = 'authorization' in headers
  const isPublic = cfg.public || false

  if (isNotFound) return { statusCode: 404, body: JSON.stringify({ message: 'Not Found' }) }
  if (!isBearer && !isPublic) {
    if (!isApiKeyValid) return { statusCode: 403 }
    if (!isUserIdValid) return { statusCode: 401 }
  }

  root.jwt = helper.decodeJwt(headers)
  root.userId = headers['x-user-id']
  root.partner = API_KEYS[headers['x-api-key']]

  if (isBearer) {
    root.partner = root.jwt.userFromPartner
    if (root.jwt.username) root.userId = root.jwt.username.split('_')[1]
  }

  // Default single job syntax handle
  if (!cfg.jobs) { cfg.jobs = [cfg] }

  // Job Runner mode
  const runnerFlow = (cfg.mode || 'PARALLEL').toLowerCase()

  // Run all jobs
  let out, status
  try {
    const res = await runner[runnerFlow](cfg.jobs, { root, data, headers })
    out = res.data
    status = res.status
  }
  catch (err) {
    const { response } = err

    return {
      headers: { 'Access-Control-Allow-Origin': '*', },
      statusCode: response ? response.status : 500,
      body: response ? response.statusText : err.message,
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
        out = cfg.transform(root, out)
        break
    }
  }

  out = { ok: true, ...out }

  // Run Config Callback
  if (cfg.callback && typeof cfg.callback === 'function') {
    cfg.callback(root, out)
  }

  return {
    headers: { 'Access-Control-Allow-Origin': '*', },
    statusCode: status,
    body: JSON.stringify(out, null, 2)
  }
}
