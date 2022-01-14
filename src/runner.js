const axios = require('axios')
const { JSONPath } = require('jsonpath-plus');
const resolver = require('./resolver')
const ErrorMap = require('../config/errors')
const signToken = (userId) => jwt.sign({ userId, foo: 'bar' }, 'shhhhh');

const sleep = (ms = 100) => new Promise(resolve => setTimeout(() => resolve(), ms))
const runner = {}

// Customize Error Handling
axios.interceptors.response.use(function(response) {
  console.log('@RES', response.data)

  const { data: { code: name, debug: [message] = [] } } = response
  const errorMap = ErrorMap[name]

  // Custom Api status response logic
  if (name && name !== '0000') {
    response.data = {
      ok: false,
      status: 400,
      debug_id: name,
      name,
      message,
      ...errorMap
    }
    response.status = response.data.status
    delete response.data.status
  }

  console.log('@RE2', response.data)
  return response;
}, function(error) {
  console.log('@ERR', error.response)
  return Promise.resolve({
    data: {
      ok: false, message: error.response.statusText, code: error.response.status,
    },
    status: error.response.status
  });
});

/* -------------------------------- */

const run = (job) => {
  const { url, method, data, headers: _h, response } = job

  const headers = {
    Accept: '*/*',
    ...(_h.Authorization ? { Authorization: _h.Authorization } : {})
  }

  return axios({
    url,
    method,
    data: ['post', 'put'].includes(method) ? data : null,
    headers,
    timeout: 30000,
  })
}
/* -------------------------------- */

const invoke = (job, { root, data, headers }) => {
  const url = resolver.resolveUrl(job.path, root)

  let body = data
  if (job.request) { body = resolver.resolveObj(job.request, root) }
  console.log('BODY', '==', body)

  return run({ url, method: job.method, data: body, headers, response: job.response })
}
/* -------------------------------- */

runner.parallel = async (jobs, { root, data, headers }) => {
  headers['Authorization'] = signToken(root.userId)

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
  headers['Authorization'] = signToken(root.userId)

  let status = 200
  let results = {}
  let context = root

  for (const [i, job] of jobs.entries()) {
    console.log(' ==>', job)
    const x = await invoke(job, { root: context, data, headers })
    if (job.delay && !isNaN(job.delay)) {
      await sleep(job.delay)
    }
    console.log(i, '  :>', job.method, job.path, x.data)
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

