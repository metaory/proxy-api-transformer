const {JSONPath} = require('jsonpath-plus')
const resolver = {}

resolver.resolveUrl = (tpl, data) => {
  let url = tpl

  console.log({url, data})

  while (url.includes('{')) { 
    const a = url.indexOf('{')
    const b = url.indexOf('}')

    const seg = url.substring(a + 1, b)

    const [ result ] = JSONPath({path: seg, json: data})

    url = url.replace(`{${seg}}`, result) 
  }

  return url
}

module.exports = resolver

