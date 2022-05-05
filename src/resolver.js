const { JSONPath } = require('jsonpath-plus')
const querystring = require('querystring');
const resolver = {}

resolver.sanatizeUrl = (url) => {
  const parsed = querystring.parse(url.split('?')[1])
  for (const key in parsed) { if (parsed[key] === 'null') delete parsed[key] }
  return url.split('?')[0] + '?' + querystring.stringify(parsed)
}

resolver.resolveUrl = (tpl, data) => {
  let url = tpl

  while (url.includes('{')) {
    const a = url.indexOf('{')
    const b = url.indexOf('}')

    const seg = url.substring(a + 1, b)

    const [result] = JSONPath({ path: seg, json: data })

    url = url.replace(`{${seg}}`, result || null)
  }

  return url
}

resolver.resolveObj = (obj, data) => {
  if (typeof obj === 'string') {
    const [result] = JSONPath({ path: obj, json: data })
    return result
  }
  return Object.keys(obj).reduce((acc, cur) => {
    console.log({ cur }, typeof obj[cur], ':', obj[cur])

    // Recursively resolve objects
    if (obj[cur] && typeof obj[cur] === 'object' && !Array.isArray(obj[cur])) {
      acc[cur] = resolver.resolveObj(obj[cur], data)
    }
    else if (String(obj[cur]).startsWith('{')) {
      const result = resolver.resolveUrl(obj[cur], data)
      // Exclude undefined fields
      if (result !== undefined) acc[cur] = result
    }
    else if (String(obj[cur]).startsWith('$')) {
      const [result] = JSONPath({ path: obj[cur], json: data })
      // Exclude undefined fields
      if (result !== undefined) acc[cur] = result
    }
    else {
      acc[cur] = obj[cur]
    }

    return acc
  }, {})
}
module.exports = resolver

