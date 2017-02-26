'use strict'

const _ = require('lodash')
const Parse = require('co-body')

module.exports = function koa (options, context, auth, routes, done) {
  const seneca = this

  if (!context) {
    return done(new Error('no context provided'))
  }

  _.each(routes, route => {
    _.each(route.methods, method => {
      context[method.toLowerCase()](route.path, function * (next) {
        let body = {}

        if (['POST', 'PUT'].indexOf(this.req.method) > -1) {
          body = yield Parse(this)
        }

        const query = Object.assign({}, this.request.query)

        const payload = {
          request$: this.request,
          response$: this.response,
          args: {body, query}
        }

        this.response.type = 'json'

        yield new Promise((resolve, reject) => {
          seneca.act(route.pattern, payload, (err, res) => {
            if (err) {
              return reject(err)
            }

            this.status = 200

            if (route.redirect) {
              this.redirect(route.redirect)
            }

            if (route.autoreply) {
              this.body = res
            }
            return resolve()
          })
        })
      })
    })
  })

  done(null, {routes})
}
