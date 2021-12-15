const {JSONPath} = require('jsonpath-plus')
const resolver = {}

resolver.resolveUrl = (tpl, data) => {
  let url = tpl

  while (url.includes('{')) { 
    const a = url.indexOf('{')
    const b = url.indexOf('}')

    const seg = url.substring(a + 1, b)

    const [ result ] = JSONPath({path: seg, json: data})

    url = url.replace(`{${seg}}`, result) 
  }

  return url
}

resolver.resolveObj = (obj, data) => {
  return Object.keys(obj).reduce((acc, cur) => {
    console.log({cur}, typeof obj[cur], obj[cur])

    if (typeof obj[cur] === 'object') {
      acc[cur] = resolver.resolveObj(obj[cur], data)
    }
    else {
      const [ result ] = JSONPath({path: obj[cur], json: data})
      acc[cur] = result
    }

    return acc
  }, {})
}
module.exports = resolver

