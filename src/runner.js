const axios = require('axios')
const {JSONPath} = require('jsonpath-plus');
const resolver = require('./resolver')
const runner = {}

runner.run = (job) => {
  const {url, method, data, headers: _h, response} = job

  const headers = {
    Accept: '*/*',
    ...(_h.Authorization ? {Authorization: _h.Authorization} : {} )
  }

  console.log(job)

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
    return runner.run({ url, method: job.method, data, headers, response: job.response })
  })
  const results = (await Promise.all(promises)).map((x, i) => {
    console.log({x: x.data.length,i}, jobs[i].response)
    if (!jobs[i].response) {
      return x.data
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

// TODO
runner.waterfall = async (jobs, {root, data, headers}) => {
  let out = []
  for (const job of jobs) {
    console.log('\n==>', job, {data,root})
    const url = resolver.resolveUrl(job.path, root)
    const res = await runner.run({ url, method: job.method, data, headers, response: job.response })
    out.push(res)
  }
  return out
}

module.exports = runner

