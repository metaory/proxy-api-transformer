const axios = require('axios')
const {JSONPath} = require('jsonpath-plus');
const resolver = require('./resolver')

const signToken = (userId) => jwt.sign({ userId, foo: 'bar' }, 'shhhhh');
const runner = {}

// TODO
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
    data,
    headers,
    timeout: 10000,
  })
}

const invoke = (job, { root, data, headers }) => {
  const url = resolver.resolveUrl(job.path, root)

  let body = data
  if (job.request) { body = resolver.resolveObj(job.request, root) }

  return run({ url, method: job.method, data: body, headers, response: job.response })
}

runner.parallel = async (jobs, {root, data, headers}) => {
  headers['Authorization'] = signToken(root.userId)

  const promises = jobs.map(job => 
     invoke(job, {root, data, headers})
  )

  let status = 200
  const results = (await Promise.all(promises)).map((x, i) => {
    console.log({x: x.data.length,i}, jobs[i].response)
    if (!jobs[i].response) {
      return x.data
    }

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

runner.waterfall = async (jobs, {root, data, headers}) => {
  headers['Authorization'] = signToken(root.userId)

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

// let out = {}
// for (const key in jobs[i].response) {
//   const resolved = JSONPath({path: jobs[i].response[key], json: {...root, ...x.data}});
//   out[key] = resolved.length ? resolved : jobs[i].response[key]
//   if (Array.isArray(out[key]) && out[key].length === 1) out[key] = out[key][0]
// }
// return out

