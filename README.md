Proxy Api Transformer
=====================

### Transform, Mutate, Wrap your existing APIs

#### Serverless AWS Api gateway proxy function

### Features
- Map to an existing endpoint with transformed structure
- Combine several existing endpoints into Parallel workflow or Waterfall\*
- Resolve Request body / path, Response [JSONPath](https://github.com/JSONPath-Plus/JSONPath)
- Transform final jobs output using [jsonpath-object-transform](https://github.com/dvdln/jsonpath-object-transform) or pure javascript function
- Callback, usefull for attaching other workflows to an existing or new endpoint, such as counters, webhooks and more
- Rich Config syntax [sample config.js](./config/index.js#L12)

#### Sample Config
![sample](./assets/config.png)

