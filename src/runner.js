const axios = require('axios')
const { JSONPath } = require('jsonpath-plus');
const resolver = require('./resolver')
const ErrorMap = require('../config/errors')
const signToken = (userId) => jwt.sign({ userId, foo: 'bar' }, 'shhhhh');

const sleep = (ms = 100) => new Promise(resolve => setTimeout(() => resolve(), ms))
const runner = {}

axios.interceptors.request.use(config => ({ ...config, startTime: new Date() }), Promise.reject)

axios.interceptors.response.use(response => {
  console.debug('@RES', response.data)

  const { data: { code: name, debug: [message] = [] } = { code: 'NA' } } = response
  const errorMap = ErrorMap[name]

  response.config.endTime = new Date()
  response.duration = response.config.endTime - response.config.startTime

  if (name && name !== '0000') {
    response.data = {
      ...response.data,
      ok: false,
      status: 400,
      debug_id: name,
      name,
      message,
      ...errorMap
    }
    response.status = response.data.status
    delete response.data.status
    delete response.data.debug
    delete response.data.code
    delete response.data.data
  }

  console.debug('@RE2', response.data)
  return response;
}, error => {
  console.error(error)
  const { response: { data, statusText, status } } = error

  error.config.endTime = new Date();
  error.duration = error.config.endTime - error.config.startTime;

  let message = statusText, debug_id, etc = {}

  if (data.code && data.debug && Array.isArray(data.debug)) {
    message = data.debug[0]
    debug_id = data.code
  }
  else {
    if (data.data && !Object.keys(data.data).length) delete data.data
    if (data.code) etc = { ...data }
  }

  return Promise.resolve({
    data: { ok: false, message, debug_id, ...etc },
    status: error.response.status
  });
});

/* -------------------------------- */

const run = (job) => {
  const { url, method, data, headers: _h } = job

  const headers = {
    Accept: '*/*',
    ...(_h.Authorization ? { Authorization: _h.Authorization } : {}),
  }

  return axios({
    url,
    method,
    // Exclude body for post/put requests
    data: ['post', 'put'].includes(method) ? data : null,
    headers,
    timeout: 20000,
  })
}
/* -------------------------------- */

const invoke = (job, { root, headers }) => {
  // Mock response when no Job path defined
  if (!job.path) { return Promise.resolve({ ok: true, data: job.response }) }

  // Resolve any variable in url config
  const resolvedUrl = resolver.resolveUrl(job.path, root)

  // Remove any null value along with its keys from querystring
  const url = resolver.sanatizeUrl(resolvedUrl)

  // Resolve request body if config is defined
  const body = job.request ? resolver.resolveObj(job.request, root) : null

  // Return job execution promise
  return run({ url, method: job.method, data: body, headers })
}
/* -------------------------------- */
runner.parallel = async (jobs, { root, data, headers }) => {
  // Forward Bearer token or sign new
  headers['Authorization'] = headers['authorization'] || signToken(root.userId)

  const promises = jobs.map(job => invoke(job, { root, data, headers }))

  let status = 200
  const results = (await Promise.all(promises)).map((x, i) => {
    if (!jobs[i].response) return x.data

    if (x.data.ok === false) { status = x.status; return x.data }

    return resolver.resolveObj(jobs[i].response, { ...root, ...x.data })
  })
  const crushed = results.reduce((acc, cur) => ({ ...acc, ...cur }), {})

  return { data: crushed, status }
}

/* -------------------------------- */

runner.waterfall = async (jobs, { root, data, headers }) => {
  // Forward Bearer token or sign new
  headers['Authorization'] = headers['authorization'] || signToken(root.userId)

  let status = 200
  let results = {}
  let context = root

  for (const [i, job] of jobs.entries()) {
    const x = await invoke(job, { root: context, data, headers })
    if (job.delay && !isNaN(job.delay)) {
      await sleep(job.delay)
    }

    if (!jobs[i].response) {
      return { data: x.data, status }
    }

    if (x.data.ok === false) { return x; }

    const resolved = resolver.resolveObj(jobs[i].response, { ...context, ...x.data })

    context = { ...context, ...x.data }
    results = { ...results, ...resolved }

    if (status !== 200) break
  }

  return { data: results, status }
}

module.exports = runner

