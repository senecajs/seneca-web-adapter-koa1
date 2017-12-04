'use strict'

const _ = require('lodash')
const Parse = require('co-body')

module.exports = function koa (options, context, auth, routes, done) {
  const seneca = this

  // middleware is an object with keys defining middleware
  const middleware = options.middleware

  if (!context) {
    return done(new Error('no context provided'))
  }

  _.each(routes, route => {
    // pull out middleware from the route; map strings to options' middleware.
    // if we don't get a function, blow up hard - this is a user-code problem.
    const routeMiddleware = (route.middleware || []).map(_middleware => {
      const ret = _.isString(_middleware) ? middleware[_middleware] : _middleware
      if (!_.isFunction(ret)) {
        throw new Error(`expected valid middleware, got ${_middleware}`)
      }
      return ret
    })
    _.each(route.methods, method => {
      context[method.toLowerCase()].apply(context, [route.path].concat(routeMiddleware).concat([function * (next) {
        let body = {}

        if (['POST', 'PUT'].indexOf(this.req.method) > -1) {
          body = options.parseBody === false
            ? this.request.body
            : yield Parse(this)
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
      }]))
    })
  })

  done(null, {routes})
}
