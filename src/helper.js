const jwt = require('jsonwebtoken')

const helper = {}

const crushObj = helper.crushObj = (obj = {}) => Object.keys(obj || {}).reduce((acc, cur) => {
  if (typeof obj[cur] === 'object') {
    acc = { ...acc, ...crushObj(obj[cur]) }
  } else { acc[cur] = obj[cur] }
  return acc
}, {})

/* -------------------------------- */

helper.decodeJwt = (headers) => {
  if (headers['authorization']) {
    const [, token] = headers['authorization'].split(' ')
    const decoded = jwt.decode(token, { complete: true }) || { payload: {} }
    return decoded.payload || {}
  }
  return {}
}

module.exports = helper
