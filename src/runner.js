const axios = require('axios')
const {JSONPath} = require('jsonpath-plus');
const resolver = require('./resolver')
const signToken = require('./service/legacyToken')

const sleep = (ms = 100) => new Promise(resolve => setTimeout(() => resolve(), ms))
const runner = {}

axios.interceptors.response.use(function (response) {
    // Any status code that lie within the range of 2xx cause this function to trigger
    // Do something with response data
    return response;
  }, function (error) {
    // Any status codes that falls outside the range of 2xx cause this function to trigger
    console.log `????????????`
    // Do something with response error
    return Promise.reject(error);
  });

/* -------------------------------- */

const run = (job) => {
  const {url, method, data, headers: _h, response} = job
  console.log({url, method, data, headers: _h, response})
  console.log `-------------------------------------` 
  console.log(job)
  console.log `-------------------------------------` 

  const headers = {
    Accept: '*/*',
     ...(_h.Authorization ? {Authorization: _h.Authorization} : {} )
  }

 return axios({
    url,
    method,
    data: ['post', 'put'].includes(method) ? data : null,
    // data,
    headers,
    timeout: 30000,
  })
}
/* -------------------------------- */

const invoke = (job, { root, data, headers }) => {
  const url = resolver.resolveUrl(job.path, root)

  let body = data
  if (job.request) { body = resolver.resolveObj(job.request, root) }

  return run({ url, method: job.method, data: body, headers, response: job.response })
}
/* -------------------------------- */

runner.parallel = async (jobs, {root, data, headers}) => {
  headers['Authorization'] = signToken(root.userId)

  const promises = jobs.map(job => invoke(job, {root, data, headers}))

  let status = 200
  const results = (await Promise.all(promises)).map((x, i) => {
    if (!jobs[i].response) return x.data 

    if (x.data.code && x.data.code !== '0000') {
      status = 400
      if (jobs[i].error_response) jobs[i].response = jobs[i].error_response
      else return x.data
    }

    return resolver.resolveObj(jobs[i].response, {...root, ...x.data})
  })
  const crushed = results.reduce((acc,cur) => ({...acc, ...cur}), {})

  return { data: crushed, status }
}

/* -------------------------------- */

runner.waterfall = async (jobs, {root, data, headers}) => {
  headers['Authorization'] = signToken(root.userId)

  let status = 200
  let results = {}
  let context = root
  for (const [ i, job ] of jobs.entries()) {
    console.log(' ==>', job)
    const x = await invoke(job, {root: context, data, headers})
    if (job.delay && !isNaN(job.delay)) {
      await sleep(job.delay)
    }
    console.log(i, '  :>', job.method, job.path, x.data)
    if (!jobs[i].response) {
      return x.data
    }

    if (x.data.code && x.data.code !== '0000') {
      status = 400
      if (jobs[i].error_response) {
        jobs[i].response = jobs[i].error_response
      }
      else return x.data
    }
    const resolved = resolver.resolveObj(jobs[i].response, {...context, ...x.data})

    context = { ...context, ...x.data }
    results = { ...results, ...resolved }

    if (status !== 200) break
  }

  return { data: results, status }
}

module.exports = runner

