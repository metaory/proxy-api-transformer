const GH = 'https://api.github.com'

// "transform": "Object | Function *" // https://github.com/dvdln/jsonpath-object-transform | function
// "callback": "Function *" // called once workflow is settled
// "mode": "PARALLEL | WATERFALL*" // default is PARALLEL
// "path": "string" /* destination path */
// "method": "post|get|put|delete" /* destination method */
// "response": "$.*" /* response mapping */ // defaults to everything 

const cfg = {
  "GET:my-new-endpoint": { // new endpoint
    transform: {
      customers: ['$.customers', { name: '$.name' }],
      mission_names: "$.mission_names",
      bpi: "$.bpi"
    },
    jobs: [
      { // Get All Customers
        path: "https://api-101.glitch.me/customers?per_page={$.query.page}&user_id={$.jwt.userId}",
        response: {
          customers: "$.data.customers",
          welcome: "$.welcome",
        }
      },
      { // SpaceX past launches
        path: "https://api.spacexdata.com/v2/launches",
        response: {
          mission_names: "$..mission_name", // mission names
        }
      },
      { // Get Bitcoin Exchange Rate
        path: "https://api.coindesk.com/v1/bpi/currentprice.json",
        response: {
          bpi: "$.bpi",
        }
      },
    ]
  },
  // ......................................................
  "GET:myrepos": {
    "path": `${GH}/repos/{$.query.user}/{$.query.repo}`,
    "method": "get"
  },
  "GET:my-org-repos": {
    "path": `${GH}/orgs/{$.query.org}/repos`,
    "method": "get"
  },
  "GET:repo-names": {
    "path": "https://api.github.com/users/metaory/repos?per_page=100",
    "method": "get",
    "response": { id: "$.id", name: "$.name" }
  },
  "GET:repos": {
    "path": `${GH}/users/{$.query.user}/repos?per_page=100`,
    "method": "get",
    "response": { id: "$[*].id", name: "$[*].name" }
  },
  "GET:pet-fetch": {
    "path": `https://petstore.swagger.io/v2/pet/{$.query.id}`,
    "method": "get",
  },
  "POST:pet-create": {
    "path": `https://petstore.swagger.io/v2/pet`,
    "method": "post",
    "response": { id: "$.id", name: "$.name" }
  },

}
module.exports = cfg
