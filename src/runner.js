const axios = require('axios')
const {JSONPath} = require('jsonpath-plus');
const resolver = require('./resolver')
const runner = {}

// TODO
axios.interceptors.response.use(function (response) {
    return response;
  }, function (error) {
    console.log `????????????`
    return Promise.reject(error);
  });


const run = (job) => {
  const {url, method, data, headers: _h, response} = job

  const headers = {
    Accept: '*/*',
     ...(_h.Authorization ? {Authorization: _h.Authorization} : {} )
  }

 return axios({
    url,
    method,
    data,
    headers,
    timeout: 10000,
  })
}

runner.parallel = async (jobs, {root, data, headers}) => {
  const promises = jobs.map(job => {
    console.log('\n==>', job, '!', {data,root})

    const url = resolver.resolveUrl(job.path, root)

    let body = data
    if (job.request) { body = resolver.resolveObj(job.request, root) }

    return run({ url, method: job.method, data: body, headers, response: job.response })
  })

  const results = (await Promise.all(promises)).map((x, i) => {
    if (!jobs[i].response) {
      return x.data
    }

    if (x.data.code && x.data.code !== '0000') {
      if (jobs[i].error_response) jobs[i].response = jobs[i].error_response
      else return x.data
    }

    let out = {}
    for (const key in jobs[i].response) {
      out[key] = JSONPath({path: jobs[i].response[key], json: {...root, ...x.data}});
      if (Array.isArray(out[key]) && out[key].length === 1) out[key] = out[key][0]
    }

    return out
  })
  
  return results.reduce((acc,cur) => ({...acc, ...cur}), {})
}

runner.waterfall = async (jobs, {root, data, headers}) => {
  let out = []
  for (const job of jobs) {
    console.log('\n==>', job, {data,root})
    const url = resolver.resolveUrl(job.path, root)
    const res = await run({ url, method: job.method, data, headers, response: job.response })
    out.push(res)
  }
  return out
}
module.exports = runner

